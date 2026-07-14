"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconPlus, IconX, IconExternalLink } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import {
  type Contract,
  CONTRACT_STATUSES,
  CONTRACT_STATUS_CLASS,
  CONTRACT_TYP_LABEL,
} from "@/lib/contracts";
import { formatMoney } from "@/lib/invoices";
import { useUI, useRegisterActions } from "../ui";
import { Popover, MenuRow, PropertyMenu } from "../Menu";
import { ContractEditor } from "./ContractEditor";

export function ContractsDashboard({ lang }: { lang: Locale }) {
  const { toast, confirm, prompt } = useUI();
  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/contracts");
    if (res.status === 401) {
      window.location.reload();
      return;
    }
    const data = (await res.json()) as { contracts: Contract[] };
    setContracts(data.contracts);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createDraft = useCallback(
    async (typ: "umowa" | "nda") => {
      const nazwa = await prompt("Nazwa drugiej strony (firma / osoba) — możesz zostawić puste, np. tylko do podglądu szablonu:", {
        placeholder: "np. Kancelaria X sp. z o.o.",
      });
      if (nazwa === null) return;
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typ, klient_nazwa: nazwa }),
      });
      if (!res.ok) {
        toast(`Nie udało się utworzyć dokumentu (${CONTRACT_TYP_LABEL[typ]}).`, "error");
        return;
      }
      const { id } = (await res.json()) as { id: string };
      await load();
      setOpenId(id);
    },
    [prompt, toast, load]
  );

  const createNda = useCallback(() => createDraft("nda"), [createDraft]);
  const createUmowa = useCallback(() => createDraft("umowa"), [createDraft]);

  const deleteContract = useCallback(
    async (id: string, nazwa: string) => {
      const ok = await confirm(`Usunąć dokument "${nazwa || "(bez nazwy)"}"?`, { danger: true });
      if (!ok) return;
      const res = await fetch(`/api/contracts/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast("Nie udało się usunąć.", "error");
        return;
      }
      setContracts((prev) => prev?.filter((c) => c.id !== id) ?? prev);
      toast("Dokument usunięty.");
    },
    [confirm, toast]
  );

  const updateStatus = useCallback(
    async (id: string, status: string) => {
      setContracts((prev) => prev?.map((c) => (c.id === id ? { ...c, status: status as Contract["status"] } : c)) ?? prev);
      const res = await fetch(`/api/contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) toast("Nie udało się zapisać.", "error");
    },
    [toast]
  );

  useRegisterActions(
    [
      { id: "add", label: "+ Nowa umowa", hint: "N", run: createUmowa },
      { id: "add-nda", label: "+ Nowe NDA", run: createNda },
    ],
    [createUmowa, createNda]
  );

  const rows = useMemo(() => {
    let list = contracts ?? [];
    if (filterStatus) list = list.filter((c) => c.status === filterStatus);
    return list;
  }, [contracts, filterStatus]);

  if (!contracts) {
    return (
      <div className="space-y-3 p-4 sm:p-6">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-[var(--hairline)]" />
        <div className="h-64 animate-pulse rounded-2xl bg-[var(--hairline)]" />
      </div>
    );
  }

  const statusOpts = CONTRACT_STATUSES.map((s) => ({ value: s, label: s }));

  return (
    <div className="-mx-4 sm:-mx-6">
      <div className="flex items-center gap-1 border-b hairline px-4 sm:px-6" style={{ height: "44px" }}>
        <span className="text-[13px] font-medium text-[var(--fg)]">Umowy</span>
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
              {CONTRACT_STATUSES.map((s) => (
                <MenuRow key={s} label={s} selected={filterStatus === s} onClick={() => { setFilterStatus(s); close(); }} />
              ))}
            </div>
          )}
        </Popover>
        <Popover
          align="right"
          width={180}
          trigger={(open) => (
            <button
              onClick={open}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]"
              title="Nowy dokument"
            >
              <IconPlus size={16} />
            </button>
          )}
        >
          {(close) => (
            <div>
              <MenuRow label="+ Nowa umowa" onClick={() => { close(); createUmowa(); }} />
              <MenuRow label="+ Nowe NDA" onClick={() => { close(); createNda(); }} />
            </div>
          )}
        </Popover>
      </div>

      <div className="px-4 py-4 sm:px-6">
        <p className="mb-4 max-w-2xl text-[12.5px] text-muted">
          Umowy zwykle powstają automatycznie z zaakceptowanej oferty (przycisk „Wygeneruj umowę” w edytorze oferty),
          NDA zwykle przyciskiem „Wyślij NDA” w profilu leada — ale przyciskiem + powyżej możesz utworzyć wolnostojący
          szkic każdego z nich w dowolnej chwili, np. żeby podejrzeć szablon klauzul.
        </p>

        {rows.length === 0 ? (
          <div className="card-paper rounded-2xl p-10 text-center text-sm text-muted">
            <IconContractEmpty />
            <p className="mt-2">{filterStatus ? "Brak dokumentów o tym statusie." : "Brak dokumentów."}</p>
          </div>
        ) : (
          <div className="card-paper overflow-x-auto rounded-2xl">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b hairline text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="p-2.5 font-medium">Typ</th>
                  <th className="p-2.5 font-medium">Druga strona</th>
                  <th className="p-2.5 text-right font-medium">Kwota</th>
                  <th className="p-2.5 font-medium">Status</th>
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
                    <td className="p-2.5 font-medium text-[var(--fg)]">{CONTRACT_TYP_LABEL[c.typ]}</td>
                    <td className="p-2.5">{c.klient_nazwa || <span className="text-muted opacity-60">— brak —</span>}</td>
                    <td className="p-2.5 text-right tabular-nums">{c.typ === "umowa" ? formatMoney(c.cena) : "—"}</td>
                    <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                      <PropertyMenu value={c.status} options={statusOpts} onChange={(v) => updateStatus(c.id, v)} title="Zmień status">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${CONTRACT_STATUS_CLASS[c.status] ?? ""}`}>
                          {c.status}
                        </span>
                      </PropertyMenu>
                    </td>
                    <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <a
                          href={`/${lang}/admin/contracts/${c.id}/print`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex text-muted hover:text-[var(--fg)]"
                          title="Podgląd / wydruk"
                        >
                          <IconExternalLink size={15} />
                        </a>
                        <button onClick={() => deleteContract(c.id, c.klient_nazwa)} className="flex text-muted hover:text-red-400" title="Usuń">
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
              className="card-paper my-auto w-full max-w-3xl rounded-2xl border hairline p-5 sm:p-6"
            >
              <ContractEditor
                id={openId}
                lang={lang}
                onClose={() => setOpenId(null)}
                onChange={load}
                onDeleted={(id) => {
                  setContracts((prev) => prev?.filter((c) => c.id !== id) ?? prev);
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

function IconContractEmpty() {
  return <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--hairline)] text-lg">📝</div>;
}
