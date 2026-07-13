"use client";

// Koszty cykliczne (Moduł 9) — wzorem app/[lang]/admin/invoices/RecurringPanel.tsx,
// ale generuje szkice KOSZTÓW, nie faktur. Dzienny raport (app/api/leads/notify)
// tworzy nowy koszt "Nieopłacony" ze skopiowanymi danymi szablonu, gdy nadejdzie
// next_run — właściciel i tak musi ręcznie sprawdzić kwotę i oznaczyć jako opłacony.

import { useCallback, useEffect, useState } from "react";
import { IconX, IconTrash, IconPlus, IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import {
  type RecurringCost,
  type PaymentMethod,
  COST_CATEGORIES,
  VAT_RATES,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  costBrutto,
  formatMoney,
} from "./shared";
import { RECURRING_CYCLES, RECURRING_CYCLE_LABEL, type RecurringCycle } from "@/lib/recurring";
import { useUI } from "../ui";
import { PropertyMenu } from "../Menu";
import { DateField } from "../DatePicker";

type ProjectOption = { id: string; tytul: string };

export function RecurringCostsPanel({ onClose }: { onClose: () => void }) {
  const { toast, confirm } = useUI();
  const [list, setList] = useState<RecurringCost[] | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [recRes, projRes] = await Promise.all([fetch("/api/recurring-costs"), fetch("/api/projects")]);
    const data = (await recRes.json()) as { recurring: RecurringCost[] };
    setList(data.recurring);
    if (projRes.ok) {
      const pdata = (await projRes.json()) as { projects: ProjectOption[] };
      setProjects(pdata.projects);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createTemplate = useCallback(async () => {
    const res = await fetch("/api/recurring-costs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nazwa: "Nowy szablon", cykl: "miesiecznie" }),
    });
    if (!res.ok) {
      toast("Nie udało się utworzyć szablonu.", "error");
      return;
    }
    const { id } = (await res.json()) as { id: string };
    await load();
    setOpenId(id);
  }, [toast, load]);

  const deleteTemplate = useCallback(
    async (id: string, nazwa: string) => {
      const ok = await confirm(`Usunąć szablon „${nazwa}”?`, { danger: true });
      if (!ok) return;
      const res = await fetch(`/api/recurring-costs/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast("Nie udało się usunąć.", "error");
        return;
      }
      setList((prev) => prev?.filter((r) => r.id !== id) ?? prev);
      if (openId === id) setOpenId(null);
      toast("Szablon usunięty.");
    },
    [confirm, toast, openId]
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Koszty cykliczne</h2>
        <button onClick={onClose} className="flex items-center gap-1 rounded-full border hairline px-2.5 py-1 text-xs text-muted hover:text-[var(--fg)]">
          <IconX size={13} /> Zamknij
        </button>
      </div>
      <p className="mt-1 text-[12px] text-muted">
        Szablon generuje codziennie (przez ten sam raport co przypomnienia o płatnościach) nowy koszt-szkic, gdy nadejdzie
        termin — sprawdzenie kwoty i oznaczenie jako opłacony robisz ręcznie z listy kosztów.
      </p>

      <div className="mt-4 space-y-2">
        {list === null ? (
          <div className="h-24 animate-pulse rounded-lg bg-[var(--hairline)]" />
        ) : list.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted opacity-60">Brak szablonów — dodaj pierwszy (np. abonament, subskrypcja).</p>
        ) : (
          list.map((r) => (
            <div key={r.id} className="rounded-lg border hairline">
              <button
                onClick={() => setOpenId((prev) => (prev === r.id ? null : r.id))}
                className="flex w-full items-center gap-2 px-3 py-2 text-left"
              >
                {openId === r.id ? <IconChevronDown size={14} className="text-muted" /> : <IconChevronRight size={14} className="text-muted" />}
                <span className="flex-1 text-sm text-[var(--fg)]">{r.nazwa || "(bez nazwy)"}</span>
                <span className="text-[11px] text-muted">{RECURRING_CYCLE_LABEL[r.cykl]}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${r.active ? "bg-emerald-500/15 text-emerald-400" : "bg-[var(--hairline)] text-muted"}`}>
                  {r.active ? "aktywny" : "wstrzymany"}
                </span>
              </button>
              {openId === r.id && (
                <div className="border-t hairline p-3">
                  <TemplateForm template={r} projects={projects} onSaved={load} onDelete={() => deleteTemplate(r.id, r.nazwa)} />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <button
        onClick={createTemplate}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border hairline px-3 py-1.5 text-xs text-muted hover:text-[var(--fg)]"
      >
        <IconPlus size={13} /> Nowy szablon
      </button>
    </div>
  );
}

function TemplateForm({
  template,
  projects,
  onSaved,
  onDelete,
}: {
  template: RecurringCost;
  projects: ProjectOption[];
  onSaved: () => void;
  onDelete: () => void;
}) {
  const { toast } = useUI();
  const [t, setT] = useState<RecurringCost>(template);
  useEffect(() => setT(template), [template]);

  const patch = useCallback(
    async (p: Record<string, unknown>) => {
      const res = await fetch(`/api/recurring-costs/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      if (!res.ok) {
        toast("Nie udało się zapisać.", "error");
        return;
      }
      onSaved();
    },
    [template.id, toast, onSaved]
  );

  const projectLabel = projects.find((p) => p.id === t.project_id)?.tytul ?? "Brak";

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <TField label="Nazwa szablonu" value={t.nazwa} onSave={(v) => patch({ nazwa: v })} placeholder="np. Netflix, hosting…" />
        <TField label="Dostawca" value={t.dostawca_nazwa} onSave={(v) => patch({ dostawca_nazwa: v })} />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <TField label="NIP dostawcy" value={t.dostawca_nip} onSave={(v) => patch({ dostawca_nip: v })} placeholder="opcjonalnie" />
        <TField label="Numer konta dostawcy" value={t.dostawca_konto} onSave={(v) => patch({ dostawca_konto: v })} placeholder="opcjonalnie" />
      </div>

      <div className="grid grid-cols-4 gap-2.5">
        <div>
          <label className="mb-1 block text-[11px] text-muted">Kategoria</label>
          <PropertyMenu
            value={t.kategoria}
            options={COST_CATEGORIES.map((c) => ({ value: c, label: c }))}
            onChange={(v) => {
              setT((p) => ({ ...p, kategoria: v }));
              patch({ kategoria: v });
            }}
          >
            <span className="block w-full rounded-lg border hairline px-2.5 py-1.5 text-sm text-[var(--fg)]">{t.kategoria}</span>
          </PropertyMenu>
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted">Kwota netto</label>
          <input
            type="number"
            step="0.01"
            value={t.kwota_netto}
            onChange={(e) => setT((p) => ({ ...p, kwota_netto: Number(e.target.value) }))}
            onBlur={(e) => patch({ kwota_netto: Number(e.target.value) })}
            className="w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted">VAT</label>
          <PropertyMenu
            value={t.vat_stawka}
            options={VAT_RATES.map((r) => ({ value: r, label: r === "zw" || r === "np" ? r : `${r}%` }))}
            onChange={(v) => {
              setT((p) => ({ ...p, vat_stawka: v }));
              patch({ vat_stawka: v });
            }}
          >
            <span className="block w-full rounded-lg border hairline px-2.5 py-1.5 text-sm text-[var(--fg)]">
              {t.vat_stawka === "zw" || t.vat_stawka === "np" ? t.vat_stawka : `${t.vat_stawka}%`}
            </span>
          </PropertyMenu>
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted">Brutto</label>
          <div className="px-2.5 py-1.5 text-sm font-medium text-[var(--fg)]">{formatMoney(costBrutto(t.kwota_netto, t.vat_stawka))}</div>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[11px] text-muted">Metoda płatności</label>
        <PropertyMenu
          value={(t.metoda_platnosci as PaymentMethod) ?? ""}
          options={[{ value: "" as PaymentMethod, label: "Brak" }, ...PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))]}
          onChange={(v) => {
            setT((p) => ({ ...p, metoda_platnosci: v || null }));
            patch({ metoda_platnosci: v || null });
          }}
        >
          <span className="block w-full rounded-lg border hairline px-2.5 py-1.5 text-sm text-[var(--fg)]">
            {t.metoda_platnosci ? PAYMENT_METHOD_LABEL[t.metoda_platnosci as PaymentMethod] ?? t.metoda_platnosci : "Brak"}
          </span>
        </PropertyMenu>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <div>
          <label className="mb-1 block text-[11px] text-muted">Cykl</label>
          <PropertyMenu
            value={t.cykl}
            options={RECURRING_CYCLES.map((c) => ({ value: c, label: RECURRING_CYCLE_LABEL[c] }))}
            onChange={(v) => {
              setT((p) => ({ ...p, cykl: v as RecurringCycle }));
              patch({ cykl: v });
            }}
          >
            <span className="block w-full rounded-lg border hairline px-2.5 py-1.5 text-sm text-[var(--fg)]">{RECURRING_CYCLE_LABEL[t.cykl]}</span>
          </PropertyMenu>
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted">Najbliższe wystawienie</label>
          <DateField value={t.next_run} onChange={(v) => { setT((p) => ({ ...p, next_run: v })); patch({ next_run: v }); }} />
        </div>
        <label className="mt-5 flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={t.active}
            onChange={(e) => {
              setT((p) => ({ ...p, active: e.target.checked }));
              patch({ active: e.target.checked });
            }}
            className="h-4 w-4 cursor-pointer accent-[#4ea7fc]"
          />
          Aktywny
        </label>
      </div>

      <div>
        <label className="mb-1 block text-[11px] text-muted">Projekt</label>
        <PropertyMenu
          value={t.project_id ?? ""}
          options={[{ value: "", label: "Brak" }, ...projects.map((p) => ({ value: p.id, label: p.tytul }))]}
          onChange={(v) => {
            setT((p) => ({ ...p, project_id: v || null }));
            patch({ project_id: v || null });
          }}
        >
          <span className="block w-full rounded-lg border hairline px-2.5 py-1.5 text-sm text-[var(--fg)]">{projectLabel}</span>
        </PropertyMenu>
      </div>

      <button onClick={onDelete} className="w-full rounded-full border hairline px-3 py-1.5 text-xs text-red-400">
        Usuń szablon
      </button>
    </div>
  );
}

function TField({ label, value, onSave, placeholder }: { label: string; value: string; onSave: (v: string) => void; placeholder?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <div>
      <label className="mb-1 block text-[11px] text-muted">{label}</label>
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v !== value && onSave(v)}
        placeholder={placeholder}
        className="w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
      />
    </div>
  );
}
