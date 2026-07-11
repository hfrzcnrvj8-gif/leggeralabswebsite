"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconPlus, IconX, IconExternalLink } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import { type Offer, OFFER_STATUSES, OFFER_STATUS_CLASS, isOfferExpired } from "@/lib/offers";
import { formatMoney } from "@/lib/invoices";
import { formatPlDate } from "@/lib/projects";
import { useUI, useRegisterActions } from "../ui";
import { Popover, MenuRow, PropertyMenu } from "../Menu";
import { OfferEditor } from "./OfferEditor";

type OfferRow = Offer & { kwota: number };

export function OffersDashboard({ lang }: { lang: Locale }) {
  const { toast, confirm } = useUI();
  const [offers, setOffers] = useState<OfferRow[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("");

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
    for (const o of list) {
      if (o.status === "Wysłana" || o.status === "Szkic") wToku += o.kwota;
      if (o.status === "Zaakceptowana") zaakceptowane += o.kwota;
    }
    return { wToku, zaakceptowane };
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
          onClick={createOffer}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]"
          title="Nowa oferta"
        >
          <IconPlus size={16} />
        </button>
      </div>

      <div className="px-4 py-4 sm:px-6">
        <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
          <div className="card-paper rounded-xl border hairline p-3">
            <div className="text-[11px] text-muted">W toku</div>
            <div className="mt-0.5 text-lg font-semibold text-[var(--fg)]">{formatMoney(kpi.wToku)}</div>
          </div>
          <div className="card-paper rounded-xl border hairline p-3">
            <div className="text-[11px] text-muted">Zaakceptowane</div>
            <div className="mt-0.5 text-lg font-semibold text-emerald-400">{formatMoney(kpi.zaakceptowane)}</div>
          </div>
        </div>

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
                      }`}
                    >
                      <td className="p-2.5 font-medium text-[var(--fg)]">{o.tytul || <span className="text-muted">(bez tytułu)</span>}</td>
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
    </div>
  );
}

function IconOfferEmpty() {
  return <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--hairline)] text-lg">📄</div>;
}
