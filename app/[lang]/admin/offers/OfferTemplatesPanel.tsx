"use client";

import { useCallback, useEffect, useState } from "react";
import { IconX, IconTrash, IconPlus, IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { formatMoney } from "@/lib/invoices";
import { type OfferTemplate, type OfferTemplateItem, templateTotal } from "@/lib/offerTemplates";
import { useUI } from "../ui";
import { SekcjaProfilu, WierszPola, WierszUwaga } from "../ProfileSection";

export function OfferTemplatesPanel({ onClose }: { onClose: () => void }) {
  const { toast, confirm } = useUI();
  const [list, setList] = useState<OfferTemplate[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/offer-templates");
    const data = (await res.json()) as { templates: OfferTemplate[] };
    setList(data.templates);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createTemplate = useCallback(async () => {
    const res = await fetch("/api/offer-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nazwa: "Nowy szablon" }),
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
      const res = await fetch(`/api/offer-templates/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast("Nie udało się usunąć.", "error");
        return;
      }
      setList((prev) => prev?.filter((t) => t.id !== id) ?? prev);
      if (openId === id) setOpenId(null);
      toast("Szablon usunięty.");
    },
    [confirm, toast, openId]
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Szablony ofert</h2>
        <button onClick={onClose} className="flex items-center gap-1 rounded-full border hairline px-2.5 py-1 text-xs text-muted hover:text-[var(--fg)]">
          <IconX size={13} /> Zamknij
        </button>
      </div>
      <p className="mt-1 text-[12px] text-muted">
        Gotowe szkielety pozycji i uwag do wstawienia jako punkt startowy nowej oferty (przycisk „Wstaw z szablonu” w edytorze oferty) —
        po wstawieniu wszystko zostaje w pełni edytowalne.
      </p>

      <div className="mt-4 space-y-2">
        {list === null ? (
          <div className="h-24 animate-pulse rounded-lg bg-[var(--hairline)]" />
        ) : list.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted opacity-60">Brak szablonów — dodaj pierwszy.</p>
        ) : (
          list.map((t) => (
            <div key={t.id} className="rounded-lg border hairline">
              <button
                onClick={() => setOpenId((prev) => (prev === t.id ? null : t.id))}
                className="flex w-full items-center gap-2 px-3 py-2 text-left"
              >
                {openId === t.id ? <IconChevronDown size={14} className="text-muted" /> : <IconChevronRight size={14} className="text-muted" />}
                <span className="flex-1 text-sm text-[var(--fg)]">{t.nazwa || "(bez nazwy)"}</span>
                <span className="text-[11px] tabular-nums text-muted">{formatMoney(templateTotal(t.pozycje))}</span>
              </button>
              {openId === t.id && (
                <div className="border-t hairline p-3">
                  <TemplateForm template={t} onSaved={load} onDelete={() => deleteTemplate(t.id, t.nazwa)} />
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

function TemplateForm({ template, onSaved, onDelete }: { template: OfferTemplate; onSaved: () => void; onDelete: () => void }) {
  const { toast } = useUI();
  const [t, setT] = useState<OfferTemplate>(template);
  useEffect(() => setT(template), [template]);

  const patch = useCallback(
    async (p: Record<string, unknown>) => {
      const res = await fetch(`/api/offer-templates/${template.id}`, {
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

  const setItems = (items: OfferTemplateItem[]) => setT((p) => ({ ...p, pozycje: items }));
  const addItem = () => {
    const items = [...t.pozycje, { nazwa: "", ilosc: 1, jednostka: "szt.", cena: 0 }];
    setItems(items);
    patch({ pozycje: items });
  };
  // Tylko lokalny stan podczas pisania — zapis (patch) dopiero na onBlur, jak
  // w RecurringPanel.tsx (patch po każdym znaku ściga się z odświeżeniem
  // listy i gubi wpisywane znaki).
  const updateItemLocal = (i: number, patchFields: Partial<OfferTemplateItem>) => {
    setItems(t.pozycje.map((it, idx) => (idx === i ? { ...it, ...patchFields } : it)));
  };
  const commitItems = () => patch({ pozycje: t.pozycje });
  const removeItem = (i: number) => {
    const items = t.pozycje.filter((_, idx) => idx !== i);
    setItems(items);
    patch({ pozycje: items });
  };

  return (
    /* Moduł 59, paczka F+ — sekcje i wiersze te same, co w edytorze oferty. */
    <div className="space-y-4">
      <SekcjaProfilu tytul="Szablon">
        <TField label="Nazwa" value={t.nazwa} onSave={(v) => patch({ nazwa: v })} />
        <TField label="Opis" value={t.opis} onSave={(v) => patch({ opis: v })} placeholder="np. dla kogo ten pakiet" />
        <WierszUwaga>Opis widzisz tylko Ty w panelu — nie wychodzi do klienta.</WierszUwaga>
      </SekcjaProfilu>

      <SekcjaProfilu
        tytul="Pozycje"
        wiersze={false}
        akcje={
          <button onClick={addItem} className="rounded-full border hairline px-2.5 py-0.5 text-[11px]">
            + Pozycja
          </button>
        }
      >
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
                  value={it.jednostka}
                  onChange={(e) => updateItemLocal(i, { jednostka: e.target.value })}
                  onBlur={commitItems}
                  className="w-14 rounded-md border hairline bg-transparent px-1.5 py-1 text-center text-[13px] text-[var(--fg)]"
                />
                <input
                  type="number"
                  step="0.01"
                  value={it.cena}
                  onChange={(e) => updateItemLocal(i, { cena: Number(e.target.value) })}
                  onBlur={commitItems}
                  className="w-20 rounded-md border hairline bg-transparent px-1.5 py-1 text-right text-[13px] text-[var(--fg)]"
                />
                <span className="w-16 text-right text-[13px] tabular-nums">{formatMoney(it.ilosc * it.cena)}</span>
                <button onClick={() => removeItem(i)} className="flex w-5 justify-center text-muted hover:text-red-400">
                  <IconTrash size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-1.5 flex justify-end text-[12px] font-semibold text-[var(--fg)]">
          <span className="tabular-nums">{formatMoney(templateTotal(t.pozycje))}</span>
        </div>
      </SekcjaProfilu>

      {/* Bloki treści szablonu (runda 2 Modułu 57). Do tej pory sekcje wchodziły
          do szablonu WYŁĄCZNIE przez „zapisz tę ofertę jako szablon" — szablonu
          zrobionego od zera nie dało się nimi uzupełnić, a istniejących
          poprawić. Funkcja zbudowana w połowie jest gorsza niż jej brak, bo
          wygląda na działającą. */}
      <SekcjaProfilu
        tytul="Bloki treści"
        wiersze={false}
        akcje={
          <button
            onClick={() => {
              const sekcje = [...(t.sekcje ?? []), { tytul: "", tresc: "" }];
              setT((p) => ({ ...p, sekcje }));
              patch({ sekcje });
            }}
            className="rounded-full border hairline px-2.5 py-0.5 text-[11px] text-muted hover:text-[var(--fg)]"
          >
            + Blok
          </button>
        }
      >
        {(t.sekcje ?? []).length === 0 ? (
          <p className="rounded-lg border hairline px-2.5 py-2 text-[11px] text-muted opacity-70">
            Bez bloków szablon wstawi same pozycje — oferta będzie cennikiem bez opisu.
          </p>
        ) : (
          <div className="space-y-1.5">
            {(t.sekcje ?? []).map((sek, i) => (
              <div key={i} className="rounded-lg border hairline p-2">
                <div className="mb-1 flex items-center gap-1.5">
                  <input
                    value={sek.tytul}
                    onChange={(e) => {
                      const sekcje = (t.sekcje ?? []).map((x, idx) => (idx === i ? { ...x, tytul: e.target.value } : x));
                      setT((p) => ({ ...p, sekcje }));
                    }}
                    onBlur={() => patch({ sekcje: t.sekcje })}
                    placeholder="Nagłówek (np. Zakres prac)"
                    className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[12.5px] font-medium text-[var(--fg)] placeholder:text-muted hover:border-[var(--hairline)] focus:border-[var(--hairline)] focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      const sekcje = (t.sekcje ?? []).filter((_, idx) => idx !== i);
                      setT((p) => ({ ...p, sekcje }));
                      patch({ sekcje });
                    }}
                    className="text-muted hover:text-red-400"
                    title="Usuń blok"
                  >
                    <IconTrash size={12} />
                  </button>
                </div>
                <textarea
                  value={sek.tresc}
                  onChange={(e) => {
                    const sekcje = (t.sekcje ?? []).map((x, idx) => (idx === i ? { ...x, tresc: e.target.value } : x));
                    setT((p) => ({ ...p, sekcje }));
                  }}
                  onBlur={() => patch({ sekcje: t.sekcje })}
                  rows={3}
                  placeholder="Treść, którą przeczyta klient."
                  className="w-full rounded-md border hairline bg-transparent px-2 py-1.5 text-[12px] text-[var(--fg)] placeholder:text-muted"
                />
              </div>
            ))}
          </div>
        )}
        {/* Pola scalane były niewidoczne: działały, ale nikt nie mógł się
            domyślić, że istnieją. */}
        <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
          W treści bloków i uwag możesz wpisać <code>{"{{klient}}"}</code>, <code>{"{{kwota}}"}</code>,{" "}
          <code>{"{{wazna_do}}"}</code>, <code>{"{{dzis}}"}</code> — podstawią się przy wstawianiu szablonu do oferty.
        </p>
      </SekcjaProfilu>

      <SekcjaProfilu tytul="Domyślne uwagi" wiersze={false}>
        <textarea
          value={t.uwagi}
          onChange={(e) => setT((p) => ({ ...p, uwagi: e.target.value }))}
          onBlur={(e) => patch({ uwagi: e.target.value })}
          rows={3}
          placeholder="np. Zakres, warunki płatności, czas realizacji."
          className="w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
        />
      </SekcjaProfilu>

      <button onClick={onDelete} className="w-full rounded-full border hairline px-3 py-1.5 text-xs text-red-400">
        Usuń szablon
      </button>
    </div>
  );
}

/** Wiersz szablonu — wspólny `WierszPola` (Moduł 59, paczka F+). */
function TField({ label, value, onSave, placeholder }: { label: string; value: string; onSave: (v: string) => void; placeholder?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <WierszPola etykieta={label}>
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v !== value && onSave(v)}
        placeholder={placeholder}
        className="w-full rounded-lg border hairline bg-transparent py-1.5 text-[var(--fg)] placeholder:text-muted"
      />
    </WierszPola>
  );
}
