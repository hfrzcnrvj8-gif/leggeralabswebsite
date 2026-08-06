"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { IconPlus, IconX, IconPaperclip, IconCloudDownload, IconRepeat, IconArrowUpRight, IconBuilding, IconHash, IconCoin, IconTrash, IconCash } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import { type Cost, type PaymentMethod, COST_STATUSES, COST_CATEGORIES, PAYMENT_METHOD_LABEL, formatMoney } from "@/lib/costs";
import { PaymentMethodIcon } from "../icons";
import { formatPlDate } from "@/lib/projects";
import { todayLocalISO } from "@/lib/dates";
import { stopienPilnosci, opisPilnosci, PILNOSC_TEXT } from "@/lib/kolorStanu";
import { useUI, useRegisterActions, useCopy } from "../ui";
import { StanListy, StanBledu } from "../StanPusty";
import { useSkrotyListy } from "../klawiatura";
import { PoleSzukania } from "../PoleSzukania";
import { pobierzJSON, komunikatBledu } from "../dane";
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
import { ExpandingIconButton } from "../ExpandingIconButton";
import { Tooltip } from "../Tooltip";
import { DateField } from "../DatePicker";
import { StatusTag, wPln, maPrzelicznik, dniPoTerminieKosztu } from "./shared";
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
      trigger={(open, isOpen) => (
        <ExpandingIconButton
          label="Pobierz z KSeF"
          icon={<IconCloudDownload size={15} />}
          onClick={open}
          active={isOpen}
        />
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

export function CostsDashboard({ lang }: { lang: Locale }) {
  const { toast, confirm, zadanie } = useUI();
  const searchParams = useSearchParams();
  const [costs, setCosts] = useState<Cost[] | null>(null);
  // Trzeci wariant pustego stanu (paczka E) — patrz komentarz w LeadsDashboard.
  const [blad, setBlad] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const ctl = useContextMenu<Cost>();
  const copy = useCopy();
  const [editorBusy, setEditorBusy] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterKategoria, setFilterKategoria] = useState("");
  const [szukaj, setSzukaj] = useState("");
  const szukajRef = useRef<HTMLInputElement>(null);
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
    try {
      const data = await pobierzJSON<{ costs: Cost[] }>("/api/costs");
      setCosts(data.costs);
      setBlad(null);
    } catch (e) {
      setBlad(komunikatBledu(e));
    }
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
      const w = await zadanie(`/api/costs/${id}`, { method: "DELETE" });
      if (w.anulowane) return;
      if (!w.ok) {
        toast(w.dane.error || "Nie udało się usunąć.", "error");
        return;
      }
      setCosts((prev) => prev?.filter((c) => c.id !== id) ?? prev);
      toast("Koszt usunięty.");
    },
    [zadanie, toast]
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
    const igla = szukaj.trim().toLowerCase();
    if (igla) {
      list = list.filter(
        (c) =>
          (c.dostawca_nazwa ?? "").toLowerCase().includes(igla) ||
          (c.opis ?? "").toLowerCase().includes(igla) ||
          (c.project_tytul ?? "").toLowerCase().includes(igla)
      );
    }
    return list;
  }, [costs, projectFilter, filterStatus, filterKategoria, szukaj]);

  // „/", j/k i Enter — wspólny hook (Moduł 59, paczka C).
  const { wiersz } = useSkrotyListy({
    elementy: rows,
    otworz: (c) => setOpenId(c.id),
    szukajRef,
    wyczyscSzukanie: () => setSzukaj(""),
    aktywne: !openId && !recurringOpen,
  });

  const kpi = useMemo(() => {
    const list = costs ?? [];
    const thisMonthDay = todayLocalISO();
    const thisMonth = thisMonthDay.slice(0, 7);
    let miesiac = 0;
    let nieoplacone = 0;
    // Najdłuższa zaległość wśród nieopłaconych — to ona, a nie sama kwota,
    // rozstrzyga kolor kafelka (patrz komentarz przy renderze).
    let najstarszaZaleglosc = 0;
    // Koszty, których nie da się przeliczyć (waluta obca bez kursu — import
    // z KSeF). Liczymy je osobno i mówimy o nich wprost, zamiast doliczać
    // kursem 1 i zaniżać sumę bez śladu.
    let bezKursu = 0;
    for (const c of list) {
      // `wPln` — koszt w EUR wchodził do tych sum jako złotówki (Moduł 63).
      // KPI są zawsze w PLN, bo inaczej „Wydatki tego miesiąca" nie miałyby
      // jednej jednostki.
      if (!maPrzelicznik(c.waluta, c.kurs_pln)) {
        bezKursu++;
        continue;
      }
      const brutto = wPln(c.kwota_brutto, c.kurs_pln);
      if (c.data_wydatku?.slice(0, 7) === thisMonth) miesiac += brutto;
      if (c.status === "Nieopłacony") {
        nieoplacone += brutto;
        najstarszaZaleglosc = Math.max(najstarszaZaleglosc, dniPoTerminieKosztu(c, thisMonthDay) ?? 0);
      }
    }
    return { miesiac, nieoplacone, najstarszaZaleglosc, bezKursu };
  }, [costs]);

  if (!costs) {
    // Szkielet ładowania TYLKO wtedy, gdy naprawdę czekamy. Do paczki E awaria
    // wczytania zostawiała `costs === null`, czyli ten szkielet pulsował
    // w nieskończoność i nic nie mówił.
    if (blad) {
      return (
        <div className="p-4 sm:p-6">
          <div className="card-paper rounded-2xl">
            <StanBledu blad={blad} onPonow={load} />
          </div>
        </div>
      );
    }
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
        <PoleSzukania ref={szukajRef} value={szukaj} onChange={setSzukaj} podpowiedz="Szuka po dostawcy, opisie kosztu i nazwie projektu" />
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
        <ExpandingIconButton label="Koszty cykliczne" icon={<IconRepeat size={15} />} onClick={() => setRecurringOpen(true)} />
        <ExpandingIconButton label="Dodaj koszt" icon={<IconPlus size={16} />} onClick={createCost} />
      </div>

      <div className="flex flex-1 flex-col px-4 py-4 sm:px-6 md:min-h-0">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-stretch">
          <div className="grid grid-cols-2 gap-3 sm:max-w-md lg:w-72 lg:shrink-0">
            <div className="card-paper rounded-xl border hairline p-3">
              <div className="text-[11px] text-muted">Koszty w tym miesiącu</div>
              <div className="mt-0.5 text-lg font-semibold text-[var(--fg)]">{formatMoney(kpi.miesiac)}</div>
              {/* Wykluczenie nie może być ciche — suma bez tej adnotacji
                  wyglądałaby na kompletną. */}
              {kpi.bezKursu > 0 && (
                <div className="mt-1 text-[10.5px] leading-snug text-brand-orange">
                  {kpi.bezKursu === 1 ? "1 koszt bez kursu" : `${kpi.bezKursu} koszty bez kursu`} — nie wliczone
                </div>
              )}
            </div>
            <div className="card-paper rounded-xl border hairline p-3">
              <div className="text-[11px] text-muted">Nieopłacone</div>
              {/* Kolor idzie z RAMPY PILNOŚCI, nie z samego faktu, że coś jest
                  nieopłacone. Do Modułu 63 stało tu `text-red-400` wpisane
                  z palca — czyli kafelek świecił na czerwono ZAWSZE, gdy tylko
                  firma miała jakikolwiek niezapłacony rachunek. To wprost
                  zaprzeczało regule zapisanej piętro wyżej, przy
                  `COST_STATUS_CLASS` („świadomie NIE czerwień — nieopłacony
                  koszt to zdrowy, normalny stan przez większość życia"), i
                  odbierało czerwieni znaczenie: kolor, który świeci zawsze,
                  przestaje cokolwiek znaczyć. Teraz czerwień pojawia się
                  dopiero, gdy realnie minął termin. */}
              <div
                className={`mt-0.5 text-lg font-semibold ${
                  kpi.najstarszaZaleglosc > 0 ? PILNOSC_TEXT[stopienPilnosci(kpi.najstarszaZaleglosc)] : "text-[var(--fg)]"
                }`}
              >
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
              <div className="card-paper rounded-2xl">
                <StanListy
                  blad={blad}
                  onPonow={load}
                  filtrAktywny={!!filterStatus || !!filterKategoria || !!projectFilter || !!szukaj.trim()}
                  onWyczyscFiltr={() => { setFilterStatus(""); setFilterKategoria(""); setSzukaj(""); }}
                  filtrTytul="Żaden koszt nie pasuje"
                  filtrOpis={projectFilter
                    ? "Ten projekt nie ma jeszcze kosztów w wybranym zakresie — filtr projektu zdejmiesz, wracając do pełnego rejestru."
                    : "Koszty w rejestrze są, ale żaden nie spełnia zaznaczonych warunków."}
                  ikona={IconCash}
                  tytul="Rejestr kosztów jest pusty"
                  opis="Bez kosztów rentowność projektu jest tylko przychodem — panel nie ma czego od niego odjąć, a księgowa nie ma czego rozliczyć."
                  akcja={
                    <button onClick={createCost} className="rounded-lg border hairline px-3 py-1.5 text-[12.5px] hover:bg-[var(--hairline)]">
                      + Dodaj koszt
                    </button>
                  }
                />
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
                      <th className="p-2.5 font-medium">Termin</th>
                      <th className="p-2.5 font-medium">Data wydatku</th>
                      <th className="p-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c, i) => (
                      <tr
                        key={c.id}
                        onClick={() => setOpenId(c.id)}
                        onContextMenu={(e) => ctl.openAt(e, c)}
                        {...wiersz(i, "cursor-pointer border-b hairline transition-colors hover:bg-hairline/80")}
                      >
                        <td className="p-2.5 font-medium text-[var(--fg)]">
                          <span className="flex items-center gap-1.5">
                            {c.dostawca_nazwa || <span className="text-muted">bez nazwy</span>}
                            {c.zalacznik_nazwa && (
                              <Tooltip label="Ma załącznik">
                                <IconPaperclip size={12} className="shrink-0 text-muted" />
                              </Tooltip>
                            )}
                          </span>
                        </td>
                        <td className="p-2.5 text-muted">{c.kategoria}</td>
                        <td className="p-2.5 text-muted">{c.project_tytul ?? "—"}</td>
                        <td className="p-2.5 text-right tabular-nums">
                          {formatMoney(c.kwota_brutto, c.waluta)}
                          {/* Równowartość w złotych pod kwotą oryginalną — bez
                              niej wiersz w EUR nie daje się porównać z resztą
                              listy ani z KPI, które są zawsze w PLN. */}
                          {c.kurs_pln != null && (
                            <div className="text-[11px] text-muted">≈ {formatMoney(wPln(c.kwota_brutto, c.kurs_pln))}</div>
                          )}
                        </td>
                        <td className="p-2.5 text-muted">
                          {c.metoda_platnosci ? (
                            <Tooltip label={PAYMENT_METHOD_LABEL[c.metoda_platnosci as PaymentMethod] ?? c.metoda_platnosci}>
                              <span className="inline-flex"><PaymentMethodIcon method={c.metoda_platnosci as PaymentMethod} size={14} /></span>
                            </Tooltip>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                          <StatusTag status={c.status} onChange={(v) => updateStatus(c.id, v)} />
                        </td>
                        <TerminKosztu cost={c} />
                        <td className="p-2.5 text-muted">{c.data_wydatku ? formatPlDate(c.data_wydatku) : "—"}</td>
                        <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            {/* Adres rekordu (paczka E) — ten sam wzorzec co
                                w Leadach i Klientach: zwykły klik otwiera modal
                                (szybciej), Cmd/Ctrl+klik nową kartę, a sam
                                odnośnik daje się skopiować i wkleić. */}
                            <Link
                              href={`/${lang}/admin/costs/${c.id}`}
                              onClick={(e) => {
                                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
                                e.preventDefault();
                                setOpenId(c.id);
                              }}
                              className="flex cel-dotykowy text-muted hover:text-[var(--fg)]"
                              title="Otwórz koszt"
                            >
                              <IconArrowUpRight size={15} />
                            </Link>
                            <ExpandingIconButton
                              label="Usuń"
                              icon={<IconX size={15} />}
                              onClick={() => deleteCost(c.id, c.dostawca_nazwa)}
                              tone="danger"
                            />
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

/**
 * Termin płatności w wierszu listy (Moduł 63).
 *
 * Kolor bierze się z RAMPY PILNOŚCI (`stopienPilnosci`), a nie z osobnej mapy
 * kosztów: to ta sama oś co przy fakturach sprzedażowych, tylko obrócona —
 * tam ktoś nie zapłacił nam, tu my nie zapłaciliśmy komuś. Czerwień jest więc
 * końcem rampy, nie trzecim kolorem statusu (`COST_STATUS_CLASS` dalej mówi
 * złoto/zieleń). Na jednym wierszu wychodzą dwie osie i tylko dwie: STAN
 * w pigułce statusu, PILNOŚĆ na dacie.
 *
 * Koszt opłacony nie bywa spóźniony — `dniPoTerminieKosztu` zwraca wtedy
 * `null`, więc data gaśnie do szarości sama, bez warunku w widoku.
 */
function TerminKosztu({ cost }: { cost: Cost }) {
  const dni = dniPoTerminieKosztu(cost, todayLocalISO());
  const stopien = stopienPilnosci(dni);
  if (!cost.termin_platnosci) return <td className="p-2.5 text-muted">—</td>;
  const opis = opisPilnosci(dni);
  const tresc = (
    <span className={stopien === "wTerminie" ? "text-muted" : `font-medium ${PILNOSC_TEXT[stopien]}`}>
      {formatPlDate(cost.termin_platnosci)}
    </span>
  );
  return <td className="p-2.5">{opis ? <Tooltip label={opis}>{tresc}</Tooltip> : tresc}</td>;
}
