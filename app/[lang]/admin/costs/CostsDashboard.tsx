"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { IconPlus, IconX } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import { type Cost, COST_STATUSES, COST_CATEGORIES, formatMoney } from "@/lib/costs";
import { formatPlDate } from "@/lib/projects";
import { todayLocalISO } from "@/lib/dates";
import { useUI, useRegisterActions } from "../ui";
import { Popover, MenuRow, PropertyMenu } from "../Menu";
import { StatusTag } from "./shared";
import { CostEditor } from "./CostEditor";

export function CostsDashboard({ lang: _lang }: { lang: Locale }) {
  const { toast, confirm } = useUI();
  const searchParams = useSearchParams();
  const [costs, setCosts] = useState<Cost[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterKategoria, setFilterKategoria] = useState("");
  const projectFilter = searchParams.get("project");

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
    <div className="-mx-4 sm:-mx-6">
      <div className="flex items-center gap-1 border-b hairline px-4 sm:px-6" style={{ height: "44px" }}>
        <span className="text-[13px] font-medium text-[var(--fg)]">Koszty</span>
        <span className="flex-1" />
        <Popover
          align="right"
          width={200}
          trigger={(open) => (
            <button onClick={open} className="rounded-md px-2 py-1 text-[12.5px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]">
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
            <button onClick={open} className="rounded-md px-2 py-1 text-[12.5px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]">
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
        <button
          onClick={createCost}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]"
          title="Dodaj koszt"
        >
          <IconPlus size={16} />
        </button>
      </div>

      <div className="px-4 py-4 sm:px-6">
        <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
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

        {rows.length === 0 ? (
          <div className="card-paper rounded-2xl p-10 text-center text-sm text-muted">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--hairline)] text-lg">💸</div>
            <p className="mt-2">{filterStatus || filterKategoria || projectFilter ? "Brak kosztów spełniających filtry." : "Brak kosztów — dodaj pierwszy przyciskiem +."}</p>
          </div>
        ) : (
          <div className="card-paper overflow-x-auto rounded-2xl">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b hairline text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="p-2.5 font-medium">Dostawca</th>
                  <th className="p-2.5 font-medium">Kategoria</th>
                  <th className="p-2.5 font-medium">Projekt</th>
                  <th className="p-2.5 text-right font-medium">Brutto</th>
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
                    className="cursor-pointer border-b hairline transition-colors hover:bg-[var(--hairline)]/40"
                  >
                    <td className="p-2.5 font-medium text-[var(--fg)]">{c.dostawca_nazwa || <span className="text-muted">bez nazwy</span>}</td>
                    <td className="p-2.5 text-muted">{c.kategoria}</td>
                    <td className="p-2.5 text-muted">{c.project_tytul ?? "—"}</td>
                    <td className="p-2.5 text-right tabular-nums">{formatMoney(c.kwota_brutto)}</td>
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
              className="card-paper my-auto w-full max-w-xl rounded-2xl border hairline p-5 sm:p-6"
            >
              <CostEditor
                id={openId}
                onClose={() => setOpenId(null)}
                onChange={load}
                onDeleted={(id) => {
                  setCosts((prev) => prev?.filter((c) => c.id !== id) ?? prev);
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
