"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconPlus, IconX, IconExternalLink, IconLayoutGrid } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import { type Offer, OFFER_STATUSES, OFFER_STATUS_CLASS, isOfferExpired, weightedOfferValue } from "@/lib/offers";
import { formatMoney } from "@/lib/invoices";
import { formatPlDate } from "@/lib/projects";
import { useUI, useRegisterActions } from "../ui";
import { Popover, MenuRow, PropertyMenu } from "../Menu";
import { OfferEditor } from "./OfferEditor";
import { OfferTemplatesPanel } from "./OfferTemplatesPanel";

type OfferRow = Offer & { kwota: number };

export function OffersDashboard({ lang }: { lang: Locale }) {
  const { toast, confirm } = useUI();
  const [offers, setOffers] = useState<OfferRow[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/offers");
    if (res.status === 401) {
      window.location.reload();
      return;
    }
    const data = (await res.json()) as { offers: OfferRow[] };
    setOffers(data.offers);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createOffer = useCallback(async () => {
    const res = await fetch("/api/offers", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (!res.ok) {
      toast("Nie udało się utworzyć oferty.", "error");
      return;
    }
    const { id } = (await res.json()) as { id: string };
    await load();
    setOpenId(id);
  }, [toast, load]);

  const deleteOffer = useCallback(
    async (id: string, tytul: string) => {
      const ok = await confirm(`Usunąć ofertę "${tytul || "(bez tytułu)"}"?`, { danger: true });
      if (!ok) return;
      const res = await fetch(`/api/offers/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast("Nie udało się usunąć.", "error");
        return;
      }
      setOffers((prev) => prev?.filter((o) => o.id !== id) ?? prev);
      toast("Oferta usunięta.");
    },
    [confirm, toast]
  );

  const updateStatus = useCallback(
    async (id: string, status: string) => {
      setOffers((prev) => prev?.map((o) => (o.id === id ? { ...o, status: status as Offer["status"] } : o)) ?? prev);
      const res = await fetch(`/api/offers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) toast("Nie udało się zapisać.", "error");
    },
    [toast]
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
      toast(`Zaktualizowano status dla ${ids.length} ofert.`);
      clearSelection();
    },
    [selectedIds, updateStatus, toast, clearSelection]
  );

  const bulkDelete = useCallback(async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const ok = await confirm(`Usunąć ${ids.length} zaznaczonych ofert?`, { danger: true });
    if (!ok) return;
    setBulkBusy(true);
    for (const id of ids) {
      await fetch(`/api/offers/${id}`, { method: "DELETE" });
    }
    setBulkBusy(false);
    setOffers((prev) => prev?.filter((o) => !selectedIds.has(o.id)) ?? prev);
    toast(`Usunięto ${ids.length} ofert.`);
    clearSelection();
  }, [selectedIds, confirm, toast, clearSelection]);

  useRegisterActions([{ id: "add", label: "+ Nowa oferta", hint: "N", run: createOffer }], [createOffer]);

  const rows = useMemo(() => {
    let list = offers ?? [];
    if (filterStatus) list = list.filter((o) => o.status === filterStatus);
    return list;
  }, [offers, filterStatus]);

  const kpi = useMemo(() => {
    const list = offers ?? [];
    let wToku = 0;
    let zaakceptowane = 0;
    let wazony = 0;
    for (const o of list) {
      if (o.status === "Wysłana" || o.status === "Szkic") wToku += o.kwota;
      if (o.status === "Zaakceptowana") zaakceptowane += o.kwota;
      wazony += weightedOfferValue(o.status, o.kwota);
    }
    return { wToku, zaakceptowane, wazony };
  }, [offers]);

  if (!offers) {
    return (
      <div className="space-y-3 p-4 sm:p-6">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-[var(--hairline)]" />
        <div className="h-64 animate-pulse rounded-2xl bg-[var(--hairline)]" />
      </div>
    );
  }

  const statusOpts = OFFER_STATUSES.map((s) => ({ value: s, label: s }));

  return (
    <div className="-mx-4 sm:-mx-6">
      <div className="flex items-center gap-1 border-b hairline px-4 sm:px-6" style={{ height: "44px" }}>
        <span className="text-[13px] font-medium text-[var(--fg)]">Oferty</span>
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
              {OFFER_STATUSES.map((s) => (
                <MenuRow key={s} label={s} selected={filterStatus === s} onClick={() => { setFilterStatus(s); close(); }} />
              ))}
            </div>
          )}
        </Popover>
        <button
          onClick={() => setTemplatesOpen(true)}
          className="flex h-6 items-center gap-1 rounded-md px-2 text-[12.5px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]"
          title="Szablony ofert"
        >
          <IconLayoutGrid size={14} /> Szablony
        </button>
        <button
          onClick={createOffer}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]"
          title="Nowa oferta"
        >
          <IconPlus size={16} />
        </button>
      </div>

      <div className="px-4 py-4 sm:px-6">
        <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-2xl sm:grid-cols-3">
          <div className="card-paper rounded-xl border hairline p-3">
            <div className="text-[11px] text-muted">W toku</div>
            <div className="mt-0.5 text-lg font-semibold text-[var(--fg)]">{formatMoney(kpi.wToku)}</div>
          </div>
          <div className="card-paper rounded-xl border hairline p-3">
            <div className="text-[11px] text-muted">Zaakceptowane</div>
            <div className="mt-0.5 text-lg font-semibold text-emerald-400">{formatMoney(kpi.zaakceptowane)}</div>
          </div>
          <div className="card-paper rounded-xl border hairline p-3" title="Suma otwartych ofert ważona szacowanym prawdopodobieństwem zamknięcia wg statusu — ta sama liczba co „Pipeline ofert” na Pulpicie.">
            <div className="text-[11px] text-muted">Ważony pipeline</div>
            <div className="mt-0.5 text-lg font-semibold text-[var(--fg)]">{formatMoney(kpi.wazony)}</div>
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
                  {OFFER_STATUSES.map((s) => (
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
            <IconOfferEmpty />
            <p className="mt-2">{filterStatus ? "Brak ofert o tym statusie." : "Brak ofert — utwórz pierwszą przyciskiem +."}</p>
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
                  <th className="p-2.5 font-medium">Tytuł</th>
                  <th className="p-2.5 font-medium">Klient</th>
                  <th className="p-2.5 text-right font-medium">Kwota</th>
                  <th className="p-2.5 font-medium">Status</th>
                  <th className="p-2.5 font-medium">Ważna do</th>
                  <th className="p-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const expired = isOfferExpired(o);
                  return (
                    <tr
                      key={o.id}
                      onClick={() => setOpenId(o.id)}
                      className={`cursor-pointer border-b hairline transition-colors hover:bg-[var(--hairline)]/40 ${
                        expired ? "bg-red-500/[0.04]" : ""
                      } ${selectedIds.has(o.id) ? "bg-[#4ea7fc]/[0.08]" : ""}`}
                    >
                      <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(o.id)}
                          onChange={() => toggleSelect(o.id)}
                          className="h-3.5 w-3.5 cursor-pointer accent-[#4ea7fc]"
                          aria-label={`Zaznacz ${o.tytul || "(bez tytułu)"}`}
                        />
                      </td>
                      <td className="p-2.5 font-medium text-[var(--fg)]">
                        <span className="flex items-center gap-1.5">
                          {o.tytul || <span className="text-muted">(bez tytułu)</span>}
                          <span className="rounded-full bg-[var(--hairline)] px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted" title="Język wydruku">
                            {o.jezyk}
                          </span>
                        </span>
                      </td>
                      <td className="p-2.5">{o.klient_nazwa || <span className="text-muted opacity-60">— brak —</span>}</td>
                      <td className="p-2.5 text-right tabular-nums">{formatMoney(o.kwota)}</td>
                      <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                        <PropertyMenu value={o.status} options={statusOpts} onChange={(v) => updateStatus(o.id, v)} title="Zmień status">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${OFFER_STATUS_CLASS[o.status] ?? ""}`}>
                            {o.status}
                          </span>
                        </PropertyMenu>
                      </td>
                      <td className={`p-2.5 ${expired ? "font-medium text-red-400" : "text-muted"}`}>
                        {o.wazna_do ? formatPlDate(o.wazna_do) : "—"}
                      </td>
                      <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={`/${lang}/admin/offers/${o.id}/print`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex text-muted hover:text-[var(--fg)]"
                            title="Podgląd / wydruk"
                          >
                            <IconExternalLink size={15} />
                          </a>
                          <button
                            onClick={() => deleteOffer(o.id, o.tytul)}
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
              <OfferEditor
                id={openId}
                lang={lang}
                onClose={() => setOpenId(null)}
                onChange={load}
                onDeleted={(id) => {
                  setOffers((prev) => prev?.filter((o) => o.id !== id) ?? prev);
                  setOpenId(null);
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {templatesOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-[2px] sm:p-8"
            onClick={() => setTemplatesOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.14, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="card-paper my-auto w-full max-w-xl rounded-2xl border hairline p-5 sm:p-6"
            >
              <OfferTemplatesPanel onClose={() => setTemplatesOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function IconOfferEmpty() {
  return <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--hairline)] text-lg">📄</div>;
}
