"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconPlus, IconBuildingStore, IconExternalLink, IconX, IconRepeat, IconBan } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import {
  type Invoice,
  INVOICE_STATUSES,
  INVOICE_STATUS_CLASS,
  INVOICE_TYPE_LABEL,
  KSEF_MICRO_THRESHOLD_PLN,
  formatMoney,
  isInvoiceOverdue,
} from "@/lib/invoices";
import { KSEF_STATUS_CLASS, KSEF_STATUS_LABEL } from "@/lib/ksef";
import { formatPlDate } from "@/lib/projects";
import { todayLocalISO } from "@/lib/dates";
import { useUI, useRegisterActions } from "../ui";
import { Popover, MenuRow, PropertyMenu } from "../Menu";
import { ExportCsvButton } from "../components";
import { InvoiceEditor } from "./InvoiceEditor";
import { CompanySettingsPanel } from "./CompanySettingsPanel";
import { RecurringPanel } from "./RecurringPanel";

type InvoiceRow = Invoice & { netto: number; vat: number; brutto: number };

export function InvoicesDashboard({ lang }: { lang: Locale }) {
  const { toast, confirm } = useUI();
  const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/invoices");
    if (res.status === 401) {
      window.location.reload();
      return;
    }
    const data = (await res.json()) as { invoices: InvoiceRow[] };
    setInvoices(data.invoices);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createInvoice = useCallback(async () => {
    const res = await fetch("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (!res.ok) {
      toast("Nie udało się utworzyć faktury.", "error");
      return;
    }
    const { id } = (await res.json()) as { id: string };
    await load();
    setOpenId(id);
  }, [toast, load]);

  const deleteInvoice = useCallback(
    async (id: string, numer: string | null) => {
      const ok = await confirm(`Usunąć fakturę ${numer ?? "(szkic)"}?`, { danger: true });
      if (!ok) return;
      const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast(data.error ?? "Nie udało się usunąć.", "error");
        return;
      }
      setInvoices((prev) => prev?.filter((i) => i.id !== id) ?? prev);
      toast("Faktura usunięta.");
    },
    [confirm, toast]
  );

  const updateStatus = useCallback(
    async (id: string, status: string) => {
      setInvoices((prev) => prev?.map((i) => (i.id === id ? { ...i, status: status as Invoice["status"] } : i)) ?? prev);
      const res = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) toast("Nie udało się zapisać.", "error");
    },
    [toast]
  );

  // Wystawionej faktury nie da się usunąć (zostawiłoby dziurę w numeracji) —
  // zamiast tego oznaczamy ją jako „Anulowana". Osobna akcja od „Usuń", żeby
  // przycisk na wierszu nie prowadził donikąd dla wystawionych faktur.
  const cancelInvoice = useCallback(
    async (id: string, numer: string | null) => {
      const ok = await confirm(
        `Anulować fakturę ${numer ?? ""}? Zostanie oznaczona jako „Anulowana" (numeru nie da się usunąć).`,
        { danger: true }
      );
      if (!ok) return;
      await updateStatus(id, "Anulowana");
      toast("Faktura anulowana.");
    },
    [confirm, updateStatus, toast]
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((checked: boolean, ids: string[]) => {
    setSelectedIds(checked ? new Set(ids) : new Set());
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const bulkUpdateStatus = useCallback(
    async (status: string) => {
      const ids = [...selectedIds];
      if (ids.length === 0) return;
      setBulkBusy(true);
      for (const id of ids) {
        await updateStatus(id, status);
      }
      setBulkBusy(false);
      toast(`Zaktualizowano status dla ${ids.length} faktur.`);
      clearSelection();
    },
    [selectedIds, updateStatus, toast, clearSelection]
  );

  const bulkDelete = useCallback(async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const ok = await confirm(`Usunąć ${ids.length} zaznaczonych faktur? Wystawionych (z numerem) nie da się usunąć — trzeba je anulować pojedynczo.`, {
      danger: true,
    });
    if (!ok) return;
    setBulkBusy(true);
    let removed = 0;
    for (const id of ids) {
      const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
      if (res.ok) removed += 1;
    }
    setBulkBusy(false);
    await load();
    clearSelection();
    if (removed === ids.length) toast(`Usunięto ${removed} faktur.`);
    else toast(`Usunięto ${removed} z ${ids.length} — reszta to wystawione faktury (ustaw status "Anulowana" zamiast usuwać).`, "error");
  }, [selectedIds, confirm, toast, clearSelection, load]);

  useRegisterActions([{ id: "add", label: "+ Nowa faktura", hint: "N", run: createInvoice }], [createInvoice]);

  const rows = useMemo(() => {
    let list = invoices ?? [];
    if (filterStatus) list = list.filter((i) => i.status === filterStatus);
    return list;
  }, [invoices, filterStatus]);

  // Grupowane wg waluty — sumowanie kwot z różnych walut w jedną liczbę
  // byłoby matematycznie bez sensu (faktura w EUR i w PLN to nie ta sama
  // "złotówka"), więc każda waluta dostaje własną sumę.
  const kpi = useMemo(() => {
    const list = invoices ?? [];
    const nieoplacone = new Map<string, number>();
    const poTerminie = new Map<string, number>();
    const thisMonth = todayLocalISO().slice(0, 7);
    let ksefMonthSalesPln = 0;
    for (const i of list) {
      // Proforma nie jest dokumentem fiskalnym — nie liczy się do przychodu/KPI.
      if (i.typ_dokumentu === "proforma") continue;
      const currency = i.waluta || "PLN";
      const overdue = isInvoiceOverdue(i);
      if (i.status === "Wystawiona" || overdue) nieoplacone.set(currency, (nieoplacone.get(currency) ?? 0) + i.brutto);
      if (overdue) poTerminie.set(currency, (poTerminie.get(currency) ?? 0) + i.brutto);
      // Licznik progu KSeF dla mikrofirm — tylko faktury w PLN, wystawione
      // (nie szkice/anulowane), wg daty wystawienia w bieżącym miesiącu.
      if (
        currency === "PLN" &&
        i.status !== "Szkic" &&
        i.status !== "Anulowana" &&
        i.data_wystawienia?.slice(0, 7) === thisMonth
      ) {
        ksefMonthSalesPln += i.brutto;
      }
    }
    return { nieoplacone, poTerminie, ksefMonthSalesPln };
  }, [invoices]);

  const formatKpi = (byCurrency: Map<string, number>) => {
    if (byCurrency.size === 0) return formatMoney(0);
    return Array.from(byCurrency.entries())
      .map(([currency, sum]) => formatMoney(sum, currency))
      .join(" + ");
  };

  if (!invoices) {
    return (
      <div className="space-y-3 p-4 sm:p-6">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-[var(--hairline)]" />
        <div className="h-64 animate-pulse rounded-2xl bg-[var(--hairline)]" />
      </div>
    );
  }

  const statusOpts = INVOICE_STATUSES.map((s) => ({ value: s, label: s }));

  return (
    <div className="-mx-4 sm:-mx-6">
      {/* Kompaktowy pasek narzędzi */}
      <div className="flex items-center gap-1 border-b hairline px-4 sm:px-6" style={{ height: "44px" }}>
        <span className="text-[13px] font-medium text-[var(--fg)]">Faktury</span>
        <span className="flex-1" />
        <Popover
          align="right"
          width={220}
          trigger={(open) => (
            <button onClick={open} className="rounded-md px-2 py-1 text-[12.5px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]">
              {filterStatus || "Status: wszystkie"}
            </button>
          )}
        >
          {(close) => (
            <div>
              <MenuRow label="Wszystkie" selected={!filterStatus} onClick={() => { setFilterStatus(""); close(); }} />
              {INVOICE_STATUSES.map((s) => (
                <MenuRow key={s} label={s} selected={filterStatus === s} onClick={() => { setFilterStatus(s); close(); }} />
              ))}
            </div>
          )}
        </Popover>
        <ExportCsvButton endpoint="/api/invoices/export" title="Rejestr sprzedaży" />
        <button
          onClick={() => setRecurringOpen(true)}
          className="flex h-6 items-center gap-1 rounded-md px-2 text-[12.5px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]"
          title="Faktury cykliczne"
        >
          <IconRepeat size={14} /> Cykliczne
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex h-6 items-center gap-1 rounded-md px-2 text-[12.5px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]"
          title="Dane firmy"
        >
          <IconBuildingStore size={14} /> Dane firmy
        </button>
        <button
          onClick={createInvoice}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]"
          title="Nowa faktura"
        >
          <IconPlus size={16} />
        </button>
      </div>

      <div className="px-4 py-4 sm:px-6">
        {/* KPI: nieopłacone / po terminie / próg KSeF dla mikrofirm */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-2xl sm:grid-cols-3">
          <div className="card-paper rounded-xl border hairline p-3">
            <div className="text-[11px] text-muted">Nieopłacone</div>
            <div className="mt-0.5 text-lg font-semibold text-[var(--fg)]">{formatKpi(kpi.nieoplacone)}</div>
          </div>
          <div className="card-paper rounded-xl border hairline p-3">
            <div className="text-[11px] text-muted">Po terminie</div>
            <div className={`mt-0.5 text-lg font-semibold ${kpi.poTerminie.size > 0 ? "text-red-400" : "text-[var(--fg)]"}`}>
              {formatKpi(kpi.poTerminie)}
            </div>
          </div>
          <div className="card-paper rounded-xl border hairline p-3" title="Mikroprzedsiębiorcy mogą do końca 2026 wystawiać faktury poza KSeF, dopóki miesięczna sprzedaż nie przekroczy tego progu.">
            <div className="text-[11px] text-muted">Sprzedaż (ten mies.) / próg KSeF</div>
            <div
              className={`mt-0.5 text-lg font-semibold ${
                kpi.ksefMonthSalesPln >= KSEF_MICRO_THRESHOLD_PLN
                  ? "text-red-400"
                  : kpi.ksefMonthSalesPln >= KSEF_MICRO_THRESHOLD_PLN * 0.7
                    ? "text-brand-gold"
                    : "text-[var(--fg)]"
              }`}
            >
              {formatMoney(kpi.ksefMonthSalesPln)} / {formatMoney(KSEF_MICRO_THRESHOLD_PLN)}
            </div>
            {kpi.ksefMonthSalesPln >= KSEF_MICRO_THRESHOLD_PLN && (
              <div className="mt-0.5 text-[11px] text-red-400">Próg przekroczony — KSeF może być już obowiązkowy.</div>
            )}
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="card-paper sticky top-2 z-30 mb-4 flex flex-wrap items-center gap-2 rounded-full px-4 py-2 text-xs">
            <span className="font-semibold">Zaznaczono: {selectedIds.size}</span>
            <Popover
              align="left"
              width={200}
              trigger={(open) => (
                <button onClick={open} disabled={bulkBusy} className="rounded-full border hairline px-3 py-1 text-xs text-[var(--fg)] disabled:opacity-50">
                  Zmień status na…
                </button>
              )}
            >
              {(close) => (
                <div>
                  {INVOICE_STATUSES.map((s) => (
                    <MenuRow
                      key={s}
                      label={s}
                      onClick={() => {
                        bulkUpdateStatus(s);
                        close();
                      }}
                    />
                  ))}
                </div>
              )}
            </Popover>
            <button
              onClick={bulkDelete}
              disabled={bulkBusy}
              className="flex items-center gap-1 rounded-full border border-red-500/40 px-3 py-1 text-red-400 disabled:opacity-50"
            >
              <IconX size={13} /> Usuń zaznaczone
            </button>
            <span className="flex-1" />
            <button onClick={clearSelection} className="rounded-full border hairline px-3 py-1 text-muted">
              Odznacz wszystko
            </button>
          </div>
        )}

        {rows.length === 0 ? (
          <div className="card-paper rounded-2xl p-10 text-center text-sm text-muted">
            <IconReceiptEmpty />
            <p className="mt-2">{filterStatus ? "Brak faktur o tym statusie." : "Brak faktur — utwórz pierwszą przyciskiem +."}</p>
          </div>
        ) : (
          <div className="card-paper overflow-x-auto rounded-2xl">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b hairline text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="p-2.5">
                    <input
                      type="checkbox"
                      checked={rows.length > 0 && rows.every((r) => selectedIds.has(r.id))}
                      onChange={(e) => toggleSelectAll(e.target.checked, rows.map((r) => r.id))}
                      className="h-3.5 w-3.5 cursor-pointer accent-[#4ea7fc]"
                      aria-label="Zaznacz wszystkie"
                    />
                  </th>
                  <th className="p-2.5 font-medium">Numer</th>
                  <th className="p-2.5 font-medium">Klient</th>
                  <th className="p-2.5 text-right font-medium">Brutto</th>
                  <th className="p-2.5 font-medium">Status</th>
                  <th className="p-2.5 font-medium">Termin</th>
                  <th className="p-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((inv) => {
                  const overdue = isInvoiceOverdue(inv);
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => setOpenId(inv.id)}
                      className={`cursor-pointer border-b hairline transition-colors hover:bg-[var(--hairline)]/40 ${
                        overdue ? "bg-red-500/[0.04]" : ""
                      } ${selectedIds.has(inv.id) ? "bg-[#4ea7fc]/[0.08]" : ""}`}
                    >
                      <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(inv.id)}
                          onChange={() => toggleSelect(inv.id)}
                          className="h-3.5 w-3.5 cursor-pointer accent-[#4ea7fc]"
                          aria-label={`Zaznacz ${inv.numer ?? "szkic"}`}
                        />
                      </td>
                      <td className="p-2.5 font-medium text-[var(--fg)]">
                        <span className="flex items-center gap-1.5">
                          {inv.numer ?? <span className="text-muted">szkic</span>}
                          <span className="rounded-full bg-[var(--hairline)] px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted" title="Język wydruku">
                            {inv.jezyk}
                          </span>
                          {inv.typ_dokumentu !== "faktura" && (
                            <span className="rounded-full bg-brand-gold/15 px-1.5 py-0.5 text-[10px] font-medium text-brand-gold" title="Typ dokumentu">
                              {INVOICE_TYPE_LABEL[inv.typ_dokumentu]}
                            </span>
                          )}
                          {inv.typ_dokumentu === "faktura" && inv.rozlicza_zaliczke_id && (
                            <span
                              className="rounded-full bg-brand-purple/15 px-1.5 py-0.5 text-[10px] font-medium text-brand-purple"
                              title="Faktura rozliczeniowa — rozlicza wcześniejszą zaliczkę (kwota w tabeli to reszta do zapłaty)"
                            >
                              Rozliczenie zaliczki
                            </span>
                          )}
                          {inv.ksef_status && inv.ksef_status !== "nie_wyslano" && (
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${KSEF_STATUS_CLASS[inv.ksef_status]}`}
                              title={`KSeF: ${KSEF_STATUS_LABEL[inv.ksef_status]}${inv.ksef_numer ? ` — ${inv.ksef_numer}` : ""}`}
                            >
                              KSeF{inv.ksef_status === "przyjeto" ? " ✓" : inv.ksef_status === "odrzucono" ? " ✕" : " …"}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="p-2.5">{inv.klient_nazwa || <span className="text-muted opacity-60">— brak —</span>}</td>
                      <td className="p-2.5 text-right tabular-nums">{formatMoney(inv.brutto, inv.waluta || "PLN")}</td>
                      <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                        <PropertyMenu value={inv.status} options={statusOpts} onChange={(v) => updateStatus(inv.id, v)} title="Zmień status">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${INVOICE_STATUS_CLASS[inv.status] ?? ""}`}>
                            {inv.status}
                          </span>
                        </PropertyMenu>
                      </td>
                      <td className={`p-2.5 ${overdue ? "font-medium text-red-400" : "text-muted"}`}>
                        {inv.termin_platnosci ? formatPlDate(inv.termin_platnosci) : "—"}
                      </td>
                      <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {inv.numer && (
                            <a
                              href={`/${lang}/admin/invoices/${inv.id}/print`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex text-muted hover:text-[var(--fg)]"
                              title="Podgląd / wydruk"
                            >
                              <IconExternalLink size={15} />
                            </a>
                          )}
                          {!inv.numer ? (
                            <button
                              onClick={() => deleteInvoice(inv.id, inv.numer)}
                              className="flex text-muted hover:text-red-400"
                              title="Usuń szkic"
                            >
                              <IconX size={15} />
                            </button>
                          ) : inv.status !== "Anulowana" ? (
                            <button
                              onClick={() => cancelInvoice(inv.id, inv.numer)}
                              className="flex text-muted hover:text-red-400"
                              title="Anuluj fakturę"
                            >
                              <IconBan size={15} />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal edytora faktury */}
      <AnimatePresence>
        {openId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-[2px] sm:p-8"
            onClick={() => setOpenId(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.14, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="card-paper my-auto w-full max-w-7xl rounded-2xl border hairline p-5 sm:p-6"
            >
              <InvoiceEditor
                id={openId}
                lang={lang}
                onClose={() => setOpenId(null)}
                onChange={load}
                onDeleted={(id) => {
                  setInvoices((prev) => prev?.filter((i) => i.id !== id) ?? prev);
                  setOpenId(null);
                }}
                onOpenInvoice={(rid) => setOpenId(rid)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal danych firmy */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-[2px] sm:p-8"
            onClick={() => setSettingsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.14, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="card-paper my-auto w-full max-w-lg rounded-2xl border hairline p-5 sm:p-6"
            >
              <CompanySettingsPanel onClose={() => setSettingsOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal faktur cyklicznych */}
      <AnimatePresence>
        {recurringOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-[2px] sm:p-8"
            onClick={() => setRecurringOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.14, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="card-paper my-auto w-full max-w-xl rounded-2xl border hairline p-5 sm:p-6"
            >
              <RecurringPanel onClose={() => setRecurringOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function IconReceiptEmpty() {
  return <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--hairline)] text-lg">🧾</div>;
}
