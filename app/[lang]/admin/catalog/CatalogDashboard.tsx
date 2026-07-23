"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconPlus, IconTrash, IconPencil, IconInfoCircle } from "@tabler/icons-react";
import { Modal } from "../Modal";
import { FilterPills, FilterPillsBar } from "../FilterPills";
import { useUI, useRegisterActions } from "../ui";
import { CatalogCategoryIcon } from "../icons";
import { VAT_RATES } from "@/lib/invoices";
import {
  CATALOG_CATEGORIES,
  CATALOG_CATEGORY_LABELS,
  DEFAULT_CATALOG_CATEGORY,
  catalogCategoryLabel,
  catalogMargin,
  catalogMarginPercent,
  hasPriceRange,
  formatMoney,
  KategoriaTag,
  type CatalogItem,
  type CatalogCategory,
} from "./shared";

const WSZYSTKIE = "__wszystkie__";

/** Podpowiedzi jednostek — datalist, nie sztywna lista (właściciel może wpisać
 * własną). „mies." dla serwisu/utrzymania (powtarzalny przychód), „godz." dla
 * robocizny. */
const JEDNOSTKI = ["szt.", "kpl.", "mies.", "godz.", "usł.", "lic."];

export function CatalogDashboard() {
  const { toast, confirm } = useUI();
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [kategoria, setKategoria] = useState<string>(WSZYSTKIE);
  const [edytowany, setEdytowany] = useState<CatalogItem | null>(null);
  const [formOtwarty, setFormOtwarty] = useState(false);

  const wczytaj = useCallback(async () => {
    const res = await fetch("/api/catalog");
    if (res.status === 401) {
      window.location.reload();
      return;
    }
    const dane = (await res.json()) as { items: CatalogItem[] };
    setItems(dane.items);
  }, []);

  useEffect(() => {
    wczytaj();
  }, [wczytaj]);

  const otworzNowy = useCallback(() => {
    setEdytowany(null);
    setFormOtwarty(true);
  }, []);

  const otworzEdycje = useCallback((c: CatalogItem) => {
    setEdytowany(c);
    setFormOtwarty(true);
  }, []);

  const usun = useCallback(
    async (c: CatalogItem) => {
      if (!(await confirm(`Usunąć „${c.nazwa}" z katalogu? Oferty i faktury, które z niej korzystały, zostają nietknięte.`)))
        return;
      setItems((prev) => prev?.filter((x) => x.id !== c.id) ?? null);
      await fetch(`/api/catalog/${c.id}`, { method: "DELETE" });
    },
    [confirm]
  );

  useRegisterActions([{ id: "add", label: "+ Dodaj komponent", run: otworzNowy }], [otworzNowy]);

  // Pigułki: „Wszystkie" + tylko kategorie, które mają choć jedną pozycję
  // (pusty filtr po kategorii bez wpisów byłby ślepą uliczką), z licznikiem.
  const liczniki = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items ?? []) m.set(it.kategoria, (m.get(it.kategoria) ?? 0) + 1);
    return m;
  }, [items]);

  const pigulki = useMemo(
    () => [
      { id: WSZYSTKIE, label: `Wszystkie${items?.length ? ` (${items.length})` : ""}` },
      ...CATALOG_CATEGORIES.filter((k) => liczniki.has(k)).map((k) => ({
        id: k,
        label: `${CATALOG_CATEGORY_LABELS[k]} (${liczniki.get(k)})`,
      })),
    ],
    [items, liczniki]
  );

  const widoczne = useMemo(
    () => (kategoria === WSZYSTKIE ? items ?? [] : (items ?? []).filter((it) => it.kategoria === kategoria)),
    [items, kategoria]
  );

  // W widoku „Wszystkie" grupujemy po kategorii (nagłówki), w wybranej
  // kategorii — płaska lista bez nagłówków (byłyby jednym powtórzonym tytułem).
  const grupy = useMemo(() => {
    if (kategoria !== WSZYSTKIE) return [{ kat: kategoria as CatalogCategory, items: widoczne }];
    return CATALOG_CATEGORIES.map((k) => ({ kat: k, items: widoczne.filter((it) => it.kategoria === k) })).filter(
      (g) => g.items.length > 0
    );
  }, [kategoria, widoczne]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <header className="mb-1 flex items-baseline justify-between gap-3">
        <h1 className="text-liquid text-2xl font-semibold">Katalog</h1>
        <button
          onClick={otworzNowy}
          className="flex items-center gap-1 rounded-full border hairline px-3 py-1 text-xs text-muted hover:text-[var(--fg)]"
        >
          <IconPlus size={14} /> Dodaj komponent
        </button>
      </header>
      <p className="mb-4 max-w-2xl text-[12.5px] text-muted">
        Biblioteka klocków — sprzęt, software, robocizna i serwis z widełkami cen — z których składasz ofertę per
        klient. Koszt zakupu i marża są tylko dla Ciebie; nie trafiają na wydruk dla klienta.
      </p>

      {pigulki.length > 1 && (
        <FilterPillsBar>
          <FilterPills value={kategoria} onChange={setKategoria} pills={pigulki} layoutId="catalog-cats" />
        </FilterPillsBar>
      )}

      {items === null ? (
        <p className="mt-6 text-center text-[13px] text-muted">Wczytuję…</p>
      ) : items.length === 0 ? (
        <div className="card-paper mt-6 rounded-2xl px-5 py-8 text-center">
          <p className="text-[13.5px] text-[var(--fg)]">Katalog jest pusty.</p>
          <p className="mx-auto mt-1 max-w-md text-[12.5px] text-muted">
            Dodaj pierwszy komponent (np. „Serwer 1× RTX 4090", „Wdrożenie RAG", „Serwis miesięczny"), a potem składaj
            z nich oferty jednym kliknięciem.
          </p>
          <button
            onClick={otworzNowy}
            className="btn-primary mx-auto mt-4 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold"
          >
            <IconPlus size={16} /> Dodaj komponent
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-6">
          {grupy.map((g) => (
            <section key={g.kat}>
              {kategoria === WSZYSTKIE && (
                <h2 className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-muted">
                  <CatalogCategoryIcon kind={g.kat} size={13} />
                  {CATALOG_CATEGORY_LABELS[g.kat]}
                  <span className="opacity-60">· {g.items.length}</span>
                </h2>
              )}
              <ul className="space-y-1.5">
                {g.items.map((c) => (
                  <li key={c.id}>
                    <WierszKomponentu c={c} onEdytuj={() => otworzEdycje(c)} onUsun={() => usun(c)} pokazKategorie={false} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {formOtwarty && (
        <CatalogFormModal
          initial={edytowany}
          onClose={() => setFormOtwarty(false)}
          onSaved={(items) => {
            setItems(items);
            setFormOtwarty(false);
          }}
          onError={(msg) => toast(msg, "error")}
        />
      )}
    </div>
  );
}

function WierszKomponentu({
  c,
  onEdytuj,
  onUsun,
  pokazKategorie,
}: {
  c: CatalogItem;
  onEdytuj: () => void;
  onUsun: () => void;
  pokazKategorie: boolean;
}) {
  const marza = catalogMargin(c.cena_netto, c.koszt_zakupu);
  const marzaProc = catalogMarginPercent(c.cena_netto, c.koszt_zakupu);
  const zakres = hasPriceRange(c.cena_min, c.cena_max);

  return (
    <div className="group card-paper flex items-start gap-3 rounded-xl px-3 py-2.5">
      <CatalogCategoryIcon kind={c.kategoria} size={16} className="mt-0.5 shrink-0 text-muted" />
      <button onClick={onEdytuj} className="min-w-0 flex-1 text-left">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[13.5px] font-medium text-[var(--fg)]">{c.nazwa}</span>
          {pokazKategorie && <KategoriaTag kategoria={c.kategoria} />}
          {c.dostawca && <span className="text-[11.5px] text-muted">· {c.dostawca}</span>}
        </span>
        {c.opis && <span className="mt-0.5 block truncate text-[12px] text-muted">{c.opis}</span>}
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px]">
          <span className="text-[var(--fg)]">
            {formatMoney(c.cena_netto)}
            <span className="text-muted"> / {c.jednostka} netto</span>
          </span>
          {zakres && (
            <span className="text-brand-cyan">
              widełki {formatMoney(c.cena_min as number)}–{formatMoney(c.cena_max as number)}
            </span>
          )}
          {marza != null && (
            <span className="text-muted" title="Twoja marża — nie trafia do klienta">
              marża {formatMoney(marza)}
              {marzaProc != null && ` (${marzaProc.toFixed(0)}%)`}
            </span>
          )}
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={onEdytuj}
          aria-label="Edytuj"
          className="text-muted opacity-0 transition-opacity hover:text-[var(--fg)] focus:opacity-100 group-hover:opacity-100"
        >
          <IconPencil size={15} />
        </button>
        <button
          onClick={onUsun}
          aria-label="Usuń"
          className="text-muted opacity-0 transition-opacity hover:text-red-400 focus:opacity-100 group-hover:opacity-100"
        >
          <IconTrash size={15} />
        </button>
      </div>
    </div>
  );
}

/** Formularz dodawania/edycji. Renderowany warunkowo (montuje się świeżo przy
 * każdym otwarciu), więc stan początkowy z `initial` czytamy raz w inicjatorze
 * useState — bez ryzyka „starej wartości" znanego z innych ekranów. */
function CatalogFormModal({
  initial,
  onClose,
  onSaved,
  onError,
}: {
  initial: CatalogItem | null;
  onClose: () => void;
  onSaved: (items: CatalogItem[]) => void;
  onError: (msg: string) => void;
}) {
  const [nazwa, setNazwa] = useState(initial?.nazwa ?? "");
  const [kat, setKat] = useState<string>(initial?.kategoria ?? DEFAULT_CATALOG_CATEGORY);
  const [cena, setCena] = useState(initial ? String(initial.cena_netto) : "");
  const [cenaMin, setCenaMin] = useState(initial?.cena_min != null ? String(initial.cena_min) : "");
  const [cenaMax, setCenaMax] = useState(initial?.cena_max != null ? String(initial.cena_max) : "");
  const [jednostka, setJednostka] = useState(initial?.jednostka ?? "szt.");
  const [vat, setVat] = useState(initial?.vat_stawka ?? "23");
  const [koszt, setKoszt] = useState(initial?.koszt_zakupu != null ? String(initial.koszt_zakupu) : "");
  const [dostawca, setDostawca] = useState(initial?.dostawca ?? "");
  const [opis, setOpis] = useState(initial?.opis ?? "");
  const [zapisuje, setZapisuje] = useState(false);

  const cenaNum = Number(cena) || 0;
  const kosztNum = koszt.trim() === "" ? null : Number(koszt);
  const marza = catalogMargin(cenaNum, kosztNum);
  const marzaProc = catalogMarginPercent(cenaNum, kosztNum);

  const zapisz = useCallback(async () => {
    if (!nazwa.trim()) {
      onError("Podaj nazwę komponentu.");
      return;
    }
    setZapisuje(true);
    const body = {
      nazwa: nazwa.trim(),
      kategoria: kat,
      cena_netto: cena,
      cena_min: cenaMin,
      cena_max: cenaMax,
      jednostka,
      vat_stawka: vat,
      koszt_zakupu: koszt,
      dostawca,
      opis,
    };
    const res = initial
      ? await fetch(`/api/catalog/${initial.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        })
      : await fetch("/api/catalog", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
    setZapisuje(false);
    if (!res.ok) {
      onError("Nie udało się zapisać komponentu.");
      return;
    }
    const dane = (await res.json()) as { items: CatalogItem[] };
    onSaved(dane.items);
  }, [nazwa, kat, cena, cenaMin, cenaMax, jednostka, vat, koszt, dostawca, opis, initial, onSaved, onError]);

  return (
    <Modal open onClose={onClose} card="my-auto w-full max-w-lg">
      <div className="card-paper max-h-[85vh] overflow-y-auto rounded-2xl p-5">
        <h2 className="mb-4 text-[15px] font-semibold">{initial ? "Edytuj komponent" : "Nowy komponent"}</h2>

        <div className="space-y-3">
          <Pole label="Nazwa">
            <input
              autoFocus
              value={nazwa}
              onChange={(e) => setNazwa(e.target.value)}
              placeholder="np. Serwer 1× RTX 4090, 128 GB RAM"
              className={inputCls}
            />
          </Pole>

          <Pole label="Kategoria">
            <select value={kat} onChange={(e) => setKat(e.target.value)} className={inputCls}>
              {CATALOG_CATEGORIES.map((k) => (
                <option key={k} value={k}>
                  {CATALOG_CATEGORY_LABELS[k]}
                </option>
              ))}
            </select>
          </Pole>

          <div className="grid grid-cols-2 gap-3">
            <Pole label="Cena bazowa (netto)" hint="Ta kwota wpada na pozycję oferty/faktury.">
              <input value={cena} onChange={(e) => setCena(e.target.value)} inputMode="decimal" placeholder="0" className={inputCls} />
            </Pole>
            <Pole label="Jednostka">
              <input value={jednostka} onChange={(e) => setJednostka(e.target.value)} list="catalog-jednostki" className={inputCls} />
              <datalist id="catalog-jednostki">
                {JEDNOSTKI.map((j) => (
                  <option key={j} value={j} />
                ))}
              </datalist>
            </Pole>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Pole label="Widełki od (netto)" hint="Opcjonalne — dolna granica.">
              <input value={cenaMin} onChange={(e) => setCenaMin(e.target.value)} inputMode="decimal" placeholder="—" className={inputCls} />
            </Pole>
            <Pole label="Widełki do (netto)" hint="Opcjonalne — górna granica.">
              <input value={cenaMax} onChange={(e) => setCenaMax(e.target.value)} inputMode="decimal" placeholder="—" className={inputCls} />
            </Pole>
          </div>

          <Pole label="Stawka VAT">
            <select value={vat} onChange={(e) => setVat(e.target.value)} className={inputCls}>
              {VAT_RATES.map((v) => (
                <option key={v} value={v}>
                  {v === "zw" ? "zw." : v === "np" ? "np." : `${v}%`}
                </option>
              ))}
            </select>
          </Pole>

          {/* Blok wrażliwy — wizualnie oddzielony, żeby było jasne, że to
              dane wewnętrzne (nie dla klienta). */}
          <div className="rounded-xl border hairline bg-[var(--hairline)]/20 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[11.5px] text-muted">
              <IconInfoCircle size={13} /> Tylko dla Ciebie — nie trafia na wydruk oferty/faktury.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Pole label="Koszt zakupu (netto)">
                <input value={koszt} onChange={(e) => setKoszt(e.target.value)} inputMode="decimal" placeholder="—" className={inputCls} />
              </Pole>
              <Pole label="Dostawca">
                <input value={dostawca} onChange={(e) => setDostawca(e.target.value)} placeholder="—" className={inputCls} />
              </Pole>
            </div>
            {marza != null && (
              <p className="mt-2 text-[12px] text-muted">
                Marża: <span className="text-[var(--fg)]">{formatMoney(marza)}</span>
                {marzaProc != null && ` (${marzaProc.toFixed(0)}% ceny)`}
              </p>
            )}
          </div>

          <Pole label="Opis" hint="Krótka notatka — co zawiera, dla kogo.">
            <textarea
              value={opis}
              onChange={(e) => setOpis(e.target.value)}
              rows={2}
              placeholder="np. Stacja pod lokalny model 7–14B, RAG dla 1–5 osób."
              className={`${inputCls} resize-none`}
            />
          </Pole>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border hairline px-3 py-2 text-sm text-muted hover:text-[var(--fg)]">
            Anuluj
          </button>
          <button
            onClick={zapisz}
            disabled={zapisuje}
            className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {zapisuje ? "Zapisuję…" : initial ? "Zapisz zmiany" : "Dodaj do katalogu"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const inputCls =
  "w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-[13px] text-[var(--fg)] placeholder:text-muted focus:border-brand-purple focus:outline-none";

function Pole({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-0.5 block text-[11px] text-muted opacity-70">{hint}</span>}
    </label>
  );
}
