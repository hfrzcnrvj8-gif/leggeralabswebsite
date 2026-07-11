"use client";

import { useCallback, useEffect, useState } from "react";
import { IconX, IconTrash, IconPlus, IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { VAT_RATES, INVOICE_LANGS, INVOICE_LANG_LABEL, INVOICE_CURRENCIES, formatMoney, itemBrutto } from "@/lib/invoices";
import { RECURRING_CYCLES, RECURRING_CYCLE_LABEL, type RecurringCycle, type RecurringInvoice, type RecurringItem } from "@/lib/recurring";
import { useUI } from "../ui";
import { PropertyMenu } from "../Menu";
import { DateField } from "../DatePicker";

export function RecurringPanel({ onClose }: { onClose: () => void }) {
  const { toast, confirm } = useUI();
  const [list, setList] = useState<RecurringInvoice[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/recurring");
    const data = (await res.json()) as { recurring: RecurringInvoice[] };
    setList(data.recurring);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createTemplate = useCallback(async () => {
    const res = await fetch("/api/recurring", {
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
      const res = await fetch(`/api/recurring/${id}`, { method: "DELETE" });
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
        <h2 className="text-base font-semibold">Faktury cykliczne</h2>
        <button onClick={onClose} className="flex items-center gap-1 rounded-full border hairline px-2.5 py-1 text-xs text-muted hover:text-[var(--fg)]">
          <IconX size={13} /> Zamknij
        </button>
      </div>
      <p className="mt-1 text-[12px] text-muted">
        Szablon generuje codziennie (przez ten sam raport co przypomnienia o płatnościach) nowy szkic faktury, gdy nadejdzie termin —
        wystawienie i wysyłkę robisz ręcznie z listy faktur.
      </p>

      <div className="mt-4 space-y-2">
        {list === null ? (
          <div className="h-24 animate-pulse rounded-lg bg-[var(--hairline)]" />
        ) : list.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted opacity-60">Brak szablonów — dodaj pierwszy.</p>
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
                  <TemplateForm template={r} onSaved={load} onDelete={() => deleteTemplate(r.id, r.nazwa)} />
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

function TemplateForm({ template, onSaved, onDelete }: { template: RecurringInvoice; onSaved: () => void; onDelete: () => void }) {
  const { toast } = useUI();
  const [t, setT] = useState<RecurringInvoice>(template);
  useEffect(() => setT(template), [template]);

  const patch = useCallback(
    async (p: Record<string, unknown>) => {
      const res = await fetch(`/api/recurring/${template.id}`, {
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

  const setItems = (items: RecurringItem[]) => setT((p) => ({ ...p, pozycje: items }));
  const addItem = () => {
    const items = [...t.pozycje, { nazwa: "", ilosc: 1, jednostka: "szt.", cena_netto: 0, vat_stawka: "23" }];
    setItems(items);
    patch({ pozycje: items });
  };
  // Tylko lokalny stan podczas pisania — zapis (patch) dopiero na onBlur
  // (updateItemCommitted), żeby patch po każdym znaku nie ścigał się z
  // odświeżeniem listy (`onSaved` → nowy obiekt `template` → reset `t` przez
  // useEffect), co gubiło wpisywane znaki.
  const updateItemLocal = (i: number, patchFields: Partial<RecurringItem>) => {
    setItems(t.pozycje.map((it, idx) => (idx === i ? { ...it, ...patchFields } : it)));
  };
  const updateItemCommitted = (i: number, patchFields: Partial<RecurringItem>) => {
    const items = t.pozycje.map((it, idx) => (idx === i ? { ...it, ...patchFields } : it));
    setItems(items);
    patch({ pozycje: items });
  };
  const commitItems = () => patch({ pozycje: t.pozycje });
  const removeItem = (i: number) => {
    const items = t.pozycje.filter((_, idx) => idx !== i);
    setItems(items);
    patch({ pozycje: items });
  };

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <TField label="Nazwa szablonu" value={t.nazwa} onSave={(v) => patch({ nazwa: v })} />
        <TField label="E-mail nabywcy" value={t.klient_email} onSave={(v) => patch({ klient_email: v })} placeholder="klient@…" />
      </div>
      <TField label="Nazwa nabywcy" value={t.klient_nazwa} onSave={(v) => patch({ klient_nazwa: v })} />
      <div className="grid grid-cols-2 gap-2.5">
        <TField label="NIP" value={t.klient_nip} onSave={(v) => patch({ klient_nip: v })} />
        <TField label="Ulica" value={t.klient_ulica} onSave={(v) => patch({ klient_ulica: v })} />
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        <TField label="Kod" value={t.klient_kod} onSave={(v) => patch({ klient_kod: v })} />
        <TField label="Miasto" value={t.klient_miasto} onSave={(v) => patch({ klient_miasto: v })} />
        <TField label="Kraj" value={t.klient_kraj} onSave={(v) => patch({ klient_kraj: v })} />
      </div>

      <div className="grid grid-cols-4 gap-2.5">
        <div>
          <label className="mb-1 block text-[11px] text-muted">Waluta</label>
          <PropertyMenu
            value={t.waluta}
            options={INVOICE_CURRENCIES.map((c) => ({ value: c, label: c }))}
            onChange={(v) => {
              setT((p) => ({ ...p, waluta: v }));
              patch({ waluta: v });
            }}
          >
            <span className="block w-full rounded-lg border hairline px-2.5 py-1.5 text-sm text-[var(--fg)]">{t.waluta}</span>
          </PropertyMenu>
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted">Język</label>
          <PropertyMenu
            value={t.jezyk}
            options={INVOICE_LANGS.map((l) => ({ value: l, label: INVOICE_LANG_LABEL[l] }))}
            onChange={(v) => {
              setT((p) => ({ ...p, jezyk: v as RecurringInvoice["jezyk"] }));
              patch({ jezyk: v });
            }}
          >
            <span className="block w-full rounded-lg border hairline px-2.5 py-1.5 text-sm text-[var(--fg)]">{INVOICE_LANG_LABEL[t.jezyk]}</span>
          </PropertyMenu>
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted">Termin (dni)</label>
          <input
            type="number"
            value={t.termin_dni}
            onChange={(e) => setT((p) => ({ ...p, termin_dni: Number(e.target.value) }))}
            onBlur={(e) => patch({ termin_dni: Number(e.target.value) })}
            className="w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)]"
          />
        </div>
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
      </div>

      <div className="grid grid-cols-2 gap-2.5">
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
        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="text-[11px] uppercase tracking-wide text-muted">Pozycje</h3>
          <button onClick={addItem} className="rounded-full border hairline px-2.5 py-0.5 text-[11px]">
            + Pozycja
          </button>
        </div>
        {t.pozycje.length === 0 ? (
          <p className="py-2 text-center text-xs text-muted opacity-60">Brak pozycji.</p>
        ) : (
          <div className="space-y-1.5">
            {t.pozycje.map((it, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  value={it.nazwa}
                  onChange={(e) => updateItemLocal(i, { nazwa: e.target.value })}
                  onBlur={commitItems}
                  placeholder="Nazwa usługi"
                  className="min-w-0 flex-1 rounded-md border hairline bg-transparent px-2 py-1 text-[13px] text-[var(--fg)] placeholder:text-muted"
                />
                <input
                  type="number"
                  value={it.ilosc}
                  onChange={(e) => updateItemLocal(i, { ilosc: Number(e.target.value) })}
                  onBlur={commitItems}
                  className="w-12 rounded-md border hairline bg-transparent px-1.5 py-1 text-right text-[13px] text-[var(--fg)]"
                />
                <input
                  type="number"
                  step="0.01"
                  value={it.cena_netto}
                  onChange={(e) => updateItemLocal(i, { cena_netto: Number(e.target.value) })}
                  onBlur={commitItems}
                  className="w-20 rounded-md border hairline bg-transparent px-1.5 py-1 text-right text-[13px] text-[var(--fg)]"
                />
                <div className="w-14 text-center">
                  <PropertyMenu
                    value={it.vat_stawka}
                    options={VAT_RATES.map((r) => ({ value: r, label: r === "zw" || r === "np" ? r : `${r}%` }))}
                    onChange={(v) => updateItemCommitted(i, { vat_stawka: v })}
                  >
                    <span className="rounded-md border hairline px-2 py-1 text-[12px] text-[var(--fg)]">
                      {it.vat_stawka === "zw" || it.vat_stawka === "np" ? it.vat_stawka : `${it.vat_stawka}%`}
                    </span>
                  </PropertyMenu>
                </div>
                <span className="w-16 text-right text-[13px] tabular-nums">{formatMoney(itemBrutto(it), t.waluta)}</span>
                <button onClick={() => removeItem(i)} className="flex w-5 justify-center text-muted hover:text-red-400">
                  <IconTrash size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
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
