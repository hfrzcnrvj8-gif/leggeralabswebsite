"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconX, IconTrash, IconCheck, IconLoader2 } from "@tabler/icons-react";
import { type Cost, COST_CATEGORIES, VAT_RATES, costBrutto, formatMoney } from "@/lib/costs";
import { useUI } from "../ui";
import { DateField } from "../DatePicker";
import { Popover, MenuRow } from "../Menu";
import { StatusTag } from "./shared";

type ProjectOption = { id: string; tytul: string };

export function CostEditor({
  id,
  onClose,
  onChange,
  onDeleted,
}: {
  id: string;
  onClose: () => void;
  onChange?: () => void;
  onDeleted?: (id: string) => void;
}) {
  const { toast, confirm } = useUI();
  const [cost, setCost] = useState<Cost | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const savedTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    const [costRes, projectsRes] = await Promise.all([fetch(`/api/costs/${id}`), fetch("/api/projects")]);
    if (!costRes.ok) return;
    const data = (await costRes.json()) as { cost: Cost };
    setCost(data.cost);
    if (projectsRes.ok) {
      const pdata = (await projectsRes.json()) as { projects: ProjectOption[] };
      setProjects(pdata.projects);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const flashSaved = useCallback(() => {
    setSaveState("saved");
    if (savedTimer.current) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaveState("idle"), 1500);
  }, []);

  const patch = useCallback(
    async (body: Partial<Cost> & Record<string, unknown>) => {
      setCost((prev) => (prev ? { ...prev, ...body } : prev));
      setSaveState("saving");
      const res = await fetch(`/api/costs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        flashSaved();
        onChange?.();
        // Kwota netto/VAT/status mogą przeliczyć brutto/data_platnosci po
        // stronie serwera — dociągnij świeży stan zamiast zgadywać lokalnie.
        const fresh = await fetch(`/api/costs/${id}`);
        if (fresh.ok) {
          const data = (await fresh.json()) as { cost: Cost };
          setCost(data.cost);
        }
      } else {
        setSaveState("idle");
        toast("Nie udało się zapisać.", "error");
      }
    },
    [id, flashSaved, onChange, toast]
  );

  const remove = useCallback(async () => {
    const ok = await confirm(`Usunąć koszt „${cost?.dostawca_nazwa || "bez nazwy dostawcy"}”?`, { danger: true });
    if (!ok) return;
    const res = await fetch(`/api/costs/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Nie udało się usunąć.", "error");
      return;
    }
    toast("Koszt usunięty.");
    onDeleted?.(id);
  }, [id, cost, confirm, toast, onDeleted]);

  if (!cost) {
    return (
      <div className="flex items-center justify-center p-10">
        <IconLoader2 className="animate-spin text-muted" size={22} />
      </div>
    );
  }

  const projectLabel = projects.find((p) => p.id === cost.project_id)?.tytul ?? "Brak";

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <StatusTag status={cost.status} onChange={(v) => patch({ status: v as Cost["status"] })} />
          {saveState === "saving" && <IconLoader2 className="animate-spin text-muted" size={14} />}
          {saveState === "saved" && <IconCheck className="text-emerald-400" size={14} />}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={remove} className="flex text-muted hover:text-red-400" title="Usuń koszt">
            <IconTrash size={16} />
          </button>
          <button onClick={onClose} className="flex text-muted hover:text-[var(--fg)]" title="Zamknij">
            <IconX size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Dostawca</span>
          <input
            defaultValue={cost.dostawca_nazwa}
            onBlur={(e) => e.target.value !== cost.dostawca_nazwa && patch({ dostawca_nazwa: e.target.value })}
            className="w-full rounded-md border hairline bg-transparent px-2.5 py-1.5 text-[13px] text-[var(--fg)] outline-none focus:border-brand-purple/60"
            placeholder="Nazwa dostawcy"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">NIP dostawcy</span>
          <input
            defaultValue={cost.dostawca_nip}
            onBlur={(e) => e.target.value !== cost.dostawca_nip && patch({ dostawca_nip: e.target.value })}
            className="w-full rounded-md border hairline bg-transparent px-2.5 py-1.5 text-[13px] text-[var(--fg)] outline-none focus:border-brand-purple/60"
            placeholder="opcjonalnie"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Kategoria</span>
          <Popover
            align="left"
            width={200}
            trigger={(open) => (
              <button
                onClick={open}
                className="flex w-full items-center justify-between rounded-md border hairline px-2.5 py-1.5 text-left text-[13px] text-[var(--fg)] hover:bg-[var(--hairline)]"
              >
                {cost.kategoria}
              </button>
            )}
          >
            {(close) => (
              <div>
                {COST_CATEGORIES.map((k) => (
                  <MenuRow key={k} label={k} selected={cost.kategoria === k} onClick={() => { patch({ kategoria: k }); close(); }} />
                ))}
              </div>
            )}
          </Popover>
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Projekt</span>
          <Popover
            align="left"
            width={240}
            trigger={(open) => (
              <button
                onClick={open}
                className="flex w-full items-center justify-between rounded-md border hairline px-2.5 py-1.5 text-left text-[13px] text-[var(--fg)] hover:bg-[var(--hairline)]"
              >
                {projectLabel}
              </button>
            )}
          >
            {(close) => (
              <div className="max-h-64 overflow-y-auto">
                <MenuRow label="Brak" selected={!cost.project_id} onClick={() => { patch({ project_id: null }); close(); }} />
                {projects.map((p) => (
                  <MenuRow key={p.id} label={p.tytul} selected={cost.project_id === p.id} onClick={() => { patch({ project_id: p.id }); close(); }} />
                ))}
              </div>
            )}
          </Popover>
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Kwota netto</span>
          <input
            type="number"
            step="0.01"
            defaultValue={cost.kwota_netto}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v !== cost.kwota_netto) patch({ kwota_netto: v });
            }}
            className="w-full rounded-md border hairline bg-transparent px-2.5 py-1.5 text-[13px] text-[var(--fg)] outline-none focus:border-brand-purple/60"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Stawka VAT</span>
          <Popover
            align="left"
            width={140}
            trigger={(open) => (
              <button
                onClick={open}
                className="flex w-full items-center justify-between rounded-md border hairline px-2.5 py-1.5 text-left text-[13px] text-[var(--fg)] hover:bg-[var(--hairline)]"
              >
                {cost.vat_stawka === "zw" || cost.vat_stawka === "np" ? cost.vat_stawka : `${cost.vat_stawka}%`}
              </button>
            )}
          >
            {(close) => (
              <div>
                {VAT_RATES.map((r) => (
                  <MenuRow key={r} label={r === "zw" || r === "np" ? r : `${r}%`} selected={cost.vat_stawka === r} onClick={() => { patch({ vat_stawka: r }); close(); }} />
                ))}
              </div>
            )}
          </Popover>
        </label>

        <div className="block">
          <span className="mb-1 block text-[11px] text-muted">Kwota brutto</span>
          <div className="px-2.5 py-1.5 text-[13px] font-medium text-[var(--fg)]">{formatMoney(costBrutto(cost.kwota_netto, cost.vat_stawka))}</div>
        </div>

        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Data wydatku</span>
          <DateField value={cost.data_wydatku ?? ""} onChange={(v) => patch({ data_wydatku: v })} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Data płatności</span>
          <DateField value={cost.data_platnosci ?? ""} onChange={(v) => patch({ data_platnosci: v })} placeholder="Ustaw datę" />
        </label>

        <label className="col-span-full block">
          <span className="mb-1 block text-[11px] text-muted">Opis</span>
          <textarea
            defaultValue={cost.opis}
            onBlur={(e) => e.target.value !== cost.opis && patch({ opis: e.target.value })}
            rows={3}
            className="w-full resize-none rounded-md border hairline bg-transparent px-2.5 py-1.5 text-[13px] text-[var(--fg)] outline-none focus:border-brand-purple/60"
            placeholder="Notatka o wydatku…"
          />
        </label>
      </div>
    </div>
  );
}
