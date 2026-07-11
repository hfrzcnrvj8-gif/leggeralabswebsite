"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconPlus, IconBuildingStore, IconExternalLink, IconX } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import {
  type Invoice,
  INVOICE_STATUSES,
  INVOICE_STATUS_CLASS,
  formatMoney,
  isInvoiceOverdue,
} from "@/lib/invoices";
import { formatPlDate } from "@/lib/projects";
import { useUI, useRegisterActions } from "../ui";
import { Popover, MenuRow, PropertyMenu } from "../Menu";
import { InvoiceEditor } from "./InvoiceEditor";
import { CompanySettingsPanel } from "./CompanySettingsPanel";

type InvoiceRow = Invoice & { netto: number; vat: number; brutto: number };

export function InvoicesDashboard({ lang }: { lang: Locale }) {
  const { toast, confirm } = useUI();
  const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");

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
        toast("Nie udało się usunąć.", "error");
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

  useRegisterActions([{ id: "add", label: "+ Nowa faktura", hint: "N", run: createInvoice }], [createInvoice]);

  const rows = useMemo(() => {
    let list = invoices ?? [];
    if (filterStatus) list = list.filter((i) => i.status === filterStatus);
    return list;
  }, [invoices, filterStatus]);

  const kpi = useMemo(() => {
    const list = invoices ?? [];
    let nieoplacone = 0;
    let poTerminie = 0;
    for (const i of list) {
      const overdue = isInvoiceOverdue(i);
      if (i.status === "Wystawiona" || overdue) nieoplacone += i.brutto;
      if (overdue) poTerminie += i.brutto;
    }
    return { nieoplacone, poTerminie };
  }, [invoices]);

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
        {/* KPI: nieopłacone / po terminie */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
          <div className="card-paper rounded-xl border hairline p-3">
            <div className="text-[11px] text-muted">Nieopłacone</div>
            <div className="mt-0.5 text-lg font-semibold text-[var(--fg)]">{formatMoney(kpi.nieoplacone)}</div>
          </div>
          <div className="card-paper rounded-xl border hairline p-3">
            <div className="text-[11px] text-muted">Po terminie</div>
            <div className={`mt-0.5 text-lg font-semibold ${kpi.poTerminie > 0 ? "text-red-400" : "text-[var(--fg)]"}`}>
              {formatMoney(kpi.poTerminie)}
            </div>
          </div>
        </div>

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
                      }`}
                    >
                      <td className="p-2.5 font-medium text-[var(--fg)]">{inv.numer ?? <span className="text-muted">szkic</span>}</td>
                      <td className="p-2.5">{inv.klient_nazwa || <span className="text-muted opacity-60">— brak —</span>}</td>
                      <td className="p-2.5 text-right tabular-nums">{formatMoney(inv.brutto)}</td>
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
                          <button
                            onClick={() => deleteInvoice(inv.id, inv.numer)}
                            className="flex text-muted hover:text-red-400"
                            title="Usuń"
                          >
                            <IconX size={15} />
                          </button>
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
              className="card-paper my-auto w-full max-w-3xl rounded-2xl border hairline p-5 sm:p-6"
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
    </div>
  );
}

function IconReceiptEmpty() {
  return <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--hairline)] text-lg">🧾</div>;
}
