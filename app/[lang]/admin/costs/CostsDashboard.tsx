"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { IconPlus, IconX, IconPaperclip, IconCloudDownload, IconRepeat, IconArrowUpRight, IconBuilding, IconHash, IconCoin, IconTrash, IconCash } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import { type Cost, type PaymentMethod, COST_STATUSES, COST_CATEGORIES, PAYMENT_METHOD_LABEL, formatMoney } from "@/lib/costs";
import { PaymentMethodIcon } from "../icons";
import { formatPlDate } from "@/lib/projects";
import { todayLocalISO } from "@/lib/dates";
import { useUI, useRegisterActions, useCopy } from "../ui";
import {
  Popover,
  MenuRow,
  PropertyMenu,
  ContextMenu,
  ContextMenuItem,
  MenuDivider,
  MenuLabel,
  useContextMenu,
} from "../Menu";
import { ExportCsvButton } from "../components";
import { DateField } from "../DatePicker";
import { StatusTag } from "./shared";
import { CostEditor } from "./CostEditor";
import { RecurringCostsPanel } from "./RecurringCostsPanel";
import { SpendTrendChart } from "./SpendTrendChart";
import { Modal } from "../Modal";

/** Import faktur zakupowych z KSeF (Faza 3, część 2). Odpytuje rządowy KSeF o
 * faktury, gdzie jesteśmy nabywcą, i tworzy z nich gotowe wpisy w Kosztach.
 * Wyłącznie środowisko testowe MF — bramka po stronie API. */
function ImportKsefButton({ onImported }: { onImported: () => void }) {
  const { toast } = useUI();
  const today = todayLocalISO();
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (close: () => void) => {
      setBusy(true);
      try {
        const res = await fetch("/api/costs/import-ksef", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from, to }),
        });
        const data = (await res.json().catch(() => null)) as
          | { ok: boolean; imported?: number; skipped?: number; found?: number; error?: string }
          | null;
        if (!data?.ok) {
          toast(data?.error || "Nie udało się pobrać faktur z KSeF.", "error");
          return;
        }
        const imp = data.imported ?? 0;
        const skip = data.skipped ?? 0;
        if (imp === 0 && (data.found ?? 0) === 0) {
          toast("Brak faktur zakupowych w KSeF w tym zakresie.");
        } else if (imp === 0) {
          toast(`Brak nowych faktur (${skip} już zaimportowanych).`);
        } else {
          toast(`Pobrano ${imp} ${imp === 1 ? "fakturę" : "faktur"} z KSeF${skip ? `, pominięto ${skip} już zaimportowanych` : ""}.`);
        }
        onImported();
        close();
      } catch {
        toast("Nie udało się połączyć z KSeF.", "error");
      } finally {
        setBusy(false);
      }
    },
    [from, to, toast, onImported]
  );

  return (
    <Popover
      align="right"
      width={260}
      trigger={(open) => (
        <button
          onClick={open}
          className="flex h-6 items-center gap-1 rounded-md px-2 text-[12.5px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]"
          title="Pobierz faktury zakupowe z KSeF"
        >
          <IconCloudDownload size={14} /> Pobierz z KSeF
        </button>
      )}
    >
      {(close) => (
        <div className="space-y-2.5 p-3">
          <p className="text-[11px] text-muted">Zakres dat wystawienia (max 3 miesiące)</p>
          <div className="flex items-center gap-1.5">
            <DateField value={from} onChange={setFrom} placeholder="Od" />
            <span className="text-[11px] text-muted">–</span>
            <DateField value={to} onChange={setTo} placeholder="Do" />
          </div>
          <p className="text-[10.5px] leading-snug text-muted">
            Faktury, na których jesteś nabywcą, trafią do Kosztów jako gotowe wpisy z załączonym oryginałem. Środowisko testowe.
          </p>
          <button
            onClick={() => run(close)}
            disabled={busy}
            className="btn-primary flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
          >
            <IconCloudDownload size={13} /> {busy ? "Pobieram…" : "Pobierz i zaimportuj"}
          </button>
        </div>
      )}
    </Popover>
  );
}

export function CostsDashboard({ lang: _lang }: { lang: Locale }) {
  const { toast, confirm } = useUI();
  const searchParams = useSearchParams();
  const [costs, setCosts] = useState<Cost[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const ctl = useContextMenu<Cost>();
  const copy = useCopy();
  const [editorBusy, setEditorBusy] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterKategoria, setFilterKategoria] = useState("");
  const [recurringOpen, setRecurringOpen] = useState(false);
  const projectFilter = searchParams.get("project");

  // Zamknięcie edytora kosztu jest warunkowe — w trakcie odczytu AI (OCR
  // paragonu) zamknięcie porzuciłoby trwający odczyt, więc zamiast tego
  // pokazujemy podpowiedź. Jedna funkcja obsługuje i kliknięcie w tło
  // modala, i przycisk „Zamknij” w samym edytorze.
  const closeEditor = useCallback(() => {
    if (editorBusy) {
      toast("Trwa odczyt AI — poczekaj na zakończenie przed zamknięciem.");
      return;
    }
    setOpenId(null);
  }, [editorBusy, toast]);

  const load = useCallback(async () => {
    const res = await fetch("/api/costs");
    if (res.status === 401) {
      window.location.reload();
      return;
    }
    const data = (await res.json()) as { costs: Cost[] };
    setCosts(data.costs);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createCost = useCallback(async () => {
    const res = await fetch("/api/costs", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (!res.ok) {
      toast("Nie udało się dodać kosztu.", "error");
      return;
    }
    const { id } = (await res.json()) as { id: string };
    await load();
    setOpenId(id);
  }, [toast, load]);

  const deleteCost = useCallback(
    async (id: string, dostawca: string) => {
      const ok = await confirm(`Usunąć koszt „${dostawca || "bez nazwy dostawcy"}”?`, { danger: true });
      if (!ok) return;
      const res = await fetch(`/api/costs/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast("Nie udało się usunąć.", "error");
        return;
      }
      setCosts((prev) => prev?.filter((c) => c.id !== id) ?? prev);
      toast("Koszt usunięty.");
    },
    [confirm, toast]
  );

  const updateStatus = useCallback(
    async (id: string, status: string) => {
      setCosts((prev) => prev?.map((c) => (c.id === id ? { ...c, status: status as Cost["status"] } : c)) ?? prev);
      const res = await fetch(`/api/costs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) toast("Nie udało się zapisać.", "error");
      else load();
    },
    [toast, load]
  );

  useRegisterActions([{ id: "add", label: "+ Dodaj koszt", hint: "N", run: createCost }], [createCost]);

  const rows = useMemo(() => {
    let list = costs ?? [];
    if (projectFilter) list = list.filter((c) => c.project_id === projectFilter);
    if (filterStatus) list = list.filter((c) => c.status === filterStatus);
    if (filterKategoria) list = list.filter((c) => c.kategoria === filterKategoria);
    return list;
  }, [costs, projectFilter, filterStatus, filterKategoria]);

  const kpi = useMemo(() => {
    const list = costs ?? [];
    const thisMonth = todayLocalISO().slice(0, 7);
    let miesiac = 0;
    let nieoplacone = 0;
    for (const c of list) {
      if (c.data_wydatku?.slice(0, 7) === thisMonth) miesiac += c.kwota_brutto;
      if (c.status === "Nieopłacony") nieoplacone += c.kwota_brutto;
    }
    return { miesiac, nieoplacone };
  }, [costs]);

  if (!costs) {
    return (
      <div className="space-y-3 p-4 sm:p-6">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-[var(--hairline)]" />
        <div className="h-64 animate-pulse rounded-2xl bg-[var(--hairline)]" />
      </div>
    );
  }

  return (
    // `flex flex-1 flex-col md:min-h-0` (Moduł 35) — przekazuje wysokość okna w dół.
    <div className="-mx-4 flex flex-1 flex-col sm:-mx-6 md:min-h-0">
      <div className="flex shrink-0 items-center gap-1 border-b hairline px-4 sm:px-6" style={{ height: "44px" }}>
        <span className="text-[13px] font-medium text-[var(--fg)]">Koszty</span>
        <span className="flex-1" />
        <Popover
          align="right"
          width={200}
          trigger={(open) => (
            <button onClick={open} className="flex h-6 items-center rounded-md px-2 text-[12.5px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]">
              {filterKategoria || "Kategoria: wszystkie"}
            </button>
          )}
        >
          {(close) => (
            <div>
              <MenuRow label="Wszystkie" selected={!filterKategoria} onClick={() => { setFilterKategoria(""); close(); }} />
              {COST_CATEGORIES.map((k) => (
                <MenuRow key={k} label={k} selected={filterKategoria === k} onClick={() => { setFilterKategoria(k); close(); }} />
              ))}
            </div>
          )}
        </Popover>
        <Popover
          align="right"
          width={180}
          trigger={(open) => (
            <button onClick={open} className="flex h-6 items-center rounded-md px-2 text-[12.5px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]">
              {filterStatus || "Status: wszystkie"}
            </button>
          )}
        >
          {(close) => (
            <div>
              <MenuRow label="Wszystkie" selected={!filterStatus} onClick={() => { setFilterStatus(""); close(); }} />
              {COST_STATUSES.map((s) => (
                <MenuRow key={s} label={s} selected={filterStatus === s} onClick={() => { setFilterStatus(s); close(); }} />
              ))}
            </div>
          )}
        </Popover>
        <ImportKsefButton onImported={load} />
        <ExportCsvButton endpoint="/api/costs/export" title="Rejestr zakupów" />
        <button
          onClick={() => setRecurringOpen(true)}
          className="flex h-6 items-center gap-1 rounded-md px-2 text-[12.5px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]"
          title="Koszty cykliczne"
        >
          <IconRepeat size={14} /> Cykliczne
        </button>
        <button
          onClick={createCost}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]"
          title="Dodaj koszt"
        >
          <IconPlus size={16} />
        </button>
      </div>

      <div className="flex flex-1 flex-col px-4 py-4 sm:px-6 md:min-h-0">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-stretch">
          <div className="grid grid-cols-2 gap-3 sm:max-w-md lg:w-72 lg:shrink-0">
            <div className="card-paper rounded-xl border hairline p-3">
              <div className="text-[11px] text-muted">Koszty w tym miesiącu</div>
              <div className="mt-0.5 text-lg font-semibold text-[var(--fg)]">{formatMoney(kpi.miesiac)}</div>
            </div>
            <div className="card-paper rounded-xl border hairline p-3">
              <div className="text-[11px] text-muted">Nieopłacone</div>
              <div className={`mt-0.5 text-lg font-semibold ${kpi.nieoplacone > 0 ? "text-red-400" : "text-[var(--fg)]"}`}>
                {formatMoney(kpi.nieoplacone)}
              </div>
            </div>
          </div>

          {costs.length > 0 && !projectFilter && (
            <div className="card-paper min-w-0 flex-1 rounded-xl border hairline p-3.5">
              <SpendTrendChart />
            </div>
          )}
        </div>

        <div className="min-w-0">
            {rows.length === 0 ? (
              <div className="card-paper rounded-2xl p-10 text-center text-sm text-muted">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--hairline)] text-muted"><IconCash size={20} /></div>
                <p className="mt-2">{filterStatus || filterKategoria || projectFilter ? "Brak kosztów spełniających filtry." : "Brak kosztów — dodaj pierwszy przyciskiem +."}</p>
              </div>
            ) : (
              // `flex-1` + `overflow-auto` (Moduł 35): tabela sięga dołu okna i przewija
              // się w środku, zamiast kończyć się na ostatnim wierszu.
              <div className="card-paper flex-1 overflow-auto rounded-2xl md:min-h-0">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b hairline text-left text-[11px] uppercase tracking-wide text-muted">
                      <th className="p-2.5 font-medium">Dostawca</th>
                      <th className="p-2.5 font-medium">Kategoria</th>
                      <th className="p-2.5 font-medium">Projekt</th>
                      <th className="p-2.5 text-right font-medium">Brutto</th>
                      <th className="p-2.5 font-medium">Płatność</th>
                      <th className="p-2.5 font-medium">Status</th>
                      <th className="p-2.5 font-medium">Data wydatku</th>
                      <th className="p-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => (
                      <tr
                        key={c.id}
                        onClick={() => setOpenId(c.id)}
                        onContextMenu={(e) => ctl.openAt(e, c)}
                        className="cursor-pointer border-b hairline transition-colors hover:bg-[var(--hairline)]/40"
                      >
                        <td className="p-2.5 font-medium text-[var(--fg)]">
                          <span className="flex items-center gap-1.5">
                            {c.dostawca_nazwa || <span className="text-muted">bez nazwy</span>}
                            {c.zalacznik_nazwa && <IconPaperclip size={12} className="shrink-0 text-muted" title="Ma załącznik" />}
                          </span>
                        </td>
                        <td className="p-2.5 text-muted">{c.kategoria}</td>
                        <td className="p-2.5 text-muted">{c.project_tytul ?? "—"}</td>
                        <td className="p-2.5 text-right tabular-nums">{formatMoney(c.kwota_brutto)}</td>
                        <td className="p-2.5 text-muted" title={c.metoda_platnosci ? PAYMENT_METHOD_LABEL[c.metoda_platnosci as PaymentMethod] ?? c.metoda_platnosci : ""}>
                          {c.metoda_platnosci ? <PaymentMethodIcon method={c.metoda_platnosci as PaymentMethod} size={14} /> : "—"}
                        </td>
                        <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                          <StatusTag status={c.status} onChange={(v) => updateStatus(c.id, v)} />
                        </td>
                        <td className="p-2.5 text-muted">{c.data_wydatku ? formatPlDate(c.data_wydatku) : "—"}</td>
                        <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end">
                            <button onClick={() => deleteCost(c.id, c.dostawca_nazwa)} className="flex text-muted hover:text-red-400" title="Usuń">
                              <IconX size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      </div>

      <Modal
        open={!!openId}
        onClose={closeEditor}
        card="card-paper my-auto w-full max-w-xl rounded-2xl border hairline p-5 sm:p-6"
      >
        {openId && (
          <CostEditor
            id={openId}
            onClose={closeEditor}
            onChange={load}
            onDeleted={(id) => {
              setCosts((prev) => prev?.filter((c) => c.id !== id) ?? prev);
              setOpenId(null);
            }}
            onBusyChange={setEditorBusy}
          />
        )}
      </Modal>

      <Modal
        open={recurringOpen}
        onClose={() => setRecurringOpen(false)}
        z={95}
        card="card-paper my-auto w-full max-w-xl rounded-2xl border hairline p-5 sm:p-6"
      >
        <RecurringCostsPanel onClose={() => setRecurringOpen(false)} />
      </Modal>

      <ContextMenu ctl={ctl}>
        {(c, close) => {
          const run = (fn: () => void) => {
            close();
            fn();
          };
          return (
            <>
              <ContextMenuItem icon={<IconArrowUpRight size={14} />} label="Otwórz" onClick={() => run(() => setOpenId(c.id))} />

              <MenuDivider />
              <MenuLabel>Kopiuj</MenuLabel>
              <ContextMenuItem
                icon={<IconBuilding size={14} />}
                label="Dostawca"
                onClick={() => run(() => void copy(c.dostawca_nazwa, "Dostawca"))}
              />
              {c.dostawca_nip && (
                <ContextMenuItem
                  icon={<IconHash size={14} />}
                  label="NIP dostawcy"
                  onClick={() => run(() => void copy(c.dostawca_nip, "NIP dostawcy"))}
                />
              )}
              <ContextMenuItem
                icon={<IconCoin size={14} />}
                label="Kwota brutto"
                onClick={() => run(() => void copy(formatMoney(c.kwota_brutto), "Kwota brutto"))}
              />

              <MenuDivider />
              <MenuLabel>Status</MenuLabel>
              {COST_STATUSES.filter((s) => s !== c.status).map((s) => (
                <ContextMenuItem
                  key={s}
                  label={s}
                  onClick={() => run(() => void updateStatus(c.id, s))}
                />
              ))}

              <MenuDivider />
              <ContextMenuItem
                icon={<IconTrash size={14} />}
                label="Usuń"
                danger
                onClick={() => run(() => void deleteCost(c.id, c.dostawca_nazwa))}
              />
            </>
          );
        }}
      </ContextMenu>
    </div>
  );
}
