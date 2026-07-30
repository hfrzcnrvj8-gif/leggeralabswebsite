"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { IconPlus, IconTrash, IconPencil, IconInfoCircle, IconBoxMultiple, IconArrowUpRight } from "@tabler/icons-react";
import { Modal } from "../Modal";
import { FilterPills, FilterPillsBar } from "../FilterPills";
import { useUI, useRegisterActions } from "../ui";
import { StanListy } from "../StanPusty";
import { useSkrotyListy } from "../klawiatura";
import { PoleSzukania } from "../PoleSzukania";
import { pobierzJSON, komunikatBledu } from "../dane";
import { CatalogCategoryIcon } from "../icons";
import { SekcjaProfilu, WierszPola, WierszUwaga } from "../ProfileSection";
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

export function CatalogDashboard({ lang }: { lang: string }) {
  const { toast, confirm } = useUI();
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  // Trzeci wariant pustego stanu (paczka E) — patrz komentarz w LeadsDashboard.
  const [blad, setBlad] = useState<string | null>(null);
  const [kategoria, setKategoria] = useState<string>(WSZYSTKIE);
  const [szukaj, setSzukaj] = useState("");
  const szukajRef = useRef<HTMLInputElement>(null);
  const [edytowany, setEdytowany] = useState<CatalogItem | null>(null);
  const [formOtwarty, setFormOtwarty] = useState(false);

  const wczytaj = useCallback(async () => {
    try {
      const dane = await pobierzJSON<{ items: CatalogItem[] }>("/api/catalog");
      setItems(dane.items);
      setBlad(null);
    } catch (e) {
      setBlad(komunikatBledu(e));
    }
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

  const widoczne = useMemo(() => {
    let list = kategoria === WSZYSTKIE ? items ?? [] : (items ?? []).filter((it) => it.kategoria === kategoria);
    const igla = szukaj.trim().toLowerCase();
    if (igla) {
      list = list.filter(
        (it) =>
          it.nazwa.toLowerCase().includes(igla) ||
          (it.opis ?? "").toLowerCase().includes(igla) ||
          (it.dostawca ?? "").toLowerCase().includes(igla)
      );
    }
    return list;
  }, [items, kategoria, szukaj]);

  // W widoku „Wszystkie" grupujemy po kategorii (nagłówki), w wybranej
  // kategorii — płaska lista bez nagłówków (byłyby jednym powtórzonym tytułem).
  const grupy = useMemo(() => {
    if (kategoria !== WSZYSTKIE) return [{ kat: kategoria as CatalogCategory, items: widoczne }];
    return CATALOG_CATEGORIES.map((k) => ({ kat: k, items: widoczne.filter((it) => it.kategoria === k) })).filter(
      (g) => g.items.length > 0
    );
  }, [kategoria, widoczne]);

  /** Kolejność kursora = kolejność czytania listy: grupa po grupie, w każdej
   *  z góry na dół. Sama `widoczne` ma inny porządek niż ekran, bo w widoku
   *  „Wszystkie" pozycje są przetasowane na kategorie. */
  const plaskie = useMemo(() => grupy.flatMap((g) => g.items), [grupy]);
  const indeksy = useMemo(() => new Map(plaskie.map((it, i) => [it.id, i])), [plaskie]);

  // „/", j/k i Enter — wspólny hook (Moduł 59, paczka C). Enter otwiera to
  // samo, co klik w wiersz: formularz edycji (w katalogu to najczęstsza
  // czynność — profil pod adresem wystawia osobna ikona).
  const { wiersz } = useSkrotyListy({
    elementy: plaskie,
    otworz: otworzEdycje,
    szukajRef,
    wyczyscSzukanie: () => setSzukaj(""),
    aktywne: !formOtwarty,
  });

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

      {(items?.length ?? 0) > 0 && (
        <div className="mb-2 flex h-9 items-center rounded-lg border hairline px-2">
          <PoleSzukania
            ref={szukajRef}
            value={szukaj}
            onChange={setSzukaj}
            podpowiedz="Szuka po nazwie komponentu, opisie i dostawcy"
            className="ml-0"
          />
        </div>
      )}

      {pigulki.length > 1 && (
        <FilterPillsBar>
          <FilterPills value={kategoria} onChange={setKategoria} pills={pigulki} layoutId="catalog-cats" />
        </FilterPillsBar>
      )}

      {/* Do paczki E ten ekran przy awarii wczytania zostawał na „Wczytuję…"
          w nieskończoność — `items` nigdy nie przestawało być `null`. */}
      {items === null && !blad ? (
        <p className="mt-6 text-center text-[13px] text-muted">Wczytuję…</p>
      ) : plaskie.length === 0 ? (
        <div className="card-paper mt-6 rounded-2xl">
          <StanListy
            blad={blad}
            onPonow={wczytaj}
            filtrAktywny={kategoria !== WSZYSTKIE || !!szukaj.trim()}
            onWyczyscFiltr={() => { setKategoria(WSZYSTKIE); setSzukaj(""); }}
            filtrTytul="Nic nie pasuje"
            filtrOpis="Komponenty w katalogu są, ale żaden nie spełnia zaznaczonych warunków."
            ikona={IconBoxMultiple}
            tytul="Katalog jest pusty"
            opis="Katalog to klocki, z których składasz ofertę jednym kliknięciem — bez niego każdą pozycję wpisujesz od nowa, a koszt zakupu i marża nie mają skąd się wziąć."
            akcja={
              <button
                onClick={otworzNowy}
                className="btn-primary flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold"
              >
                <IconPlus size={16} /> Dodaj komponent
              </button>
            }
          />
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
                    <WierszKomponentu
                      c={c}
                      lang={lang}
                      onEdytuj={() => otworzEdycje(c)}
                      onUsun={() => usun(c)}
                      pokazKategorie={false}
                      {...wiersz(indeksy.get(c.id) ?? -1)}
                    />
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
  lang,
  onEdytuj,
  onUsun,
  pokazKategorie,
  className,
  ...reszta
}: {
  c: CatalogItem;
  lang: string;
  onEdytuj: () => void;
  onUsun: () => void;
  pokazKategorie: boolean;
  /** Podświetlenie kursora j/k — składane przez `wiersz()` z `klawiatura.ts`. */
  className?: string;
  "data-kursor"?: "1";
}) {
  const marza = catalogMargin(c.cena_netto, c.koszt_zakupu);
  const marzaProc = catalogMarginPercent(c.cena_netto, c.koszt_zakupu);
  const zakres = hasPriceRange(c.cena_min, c.cena_max);

  return (
    <div className={`group card-paper flex items-start gap-3 rounded-xl px-3 py-2.5 ${className ?? ""}`} {...reszta}>
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
        {/* Adres rekordu (paczka E) — profil komponentu pod własnym linkiem;
            zwykły klik zostaje przy formularzu edycji, bo to najczęstsza
            czynność w katalogu. */}
        <Link
          href={`/${lang}/admin/catalog/${c.id}`}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
            e.preventDefault();
            onEdytuj();
          }}
          title="Otwórz komponent"
          className="text-muted opacity-0 transition-opacity hover:text-[var(--fg)] focus:opacity-100 group-hover:opacity-100"
        >
          <IconArrowUpRight size={15} />
        </Link>
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
export function CatalogFormModal({
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

        <div className="space-y-4">
          <SekcjaProfilu tytul="Komponent">
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
            <Pole label="Jednostka">
              <input value={jednostka} onChange={(e) => setJednostka(e.target.value)} list="catalog-jednostki" className={inputCls} />
              <datalist id="catalog-jednostki">
                {JEDNOSTKI.map((j) => (
                  <option key={j} value={j} />
                ))}
              </datalist>
            </Pole>
          </SekcjaProfilu>

          <SekcjaProfilu tytul="Cena">
            <Pole label="Cena bazowa" hint="Ta kwota (netto) wpada na pozycję oferty/faktury.">
              <input value={cena} onChange={(e) => setCena(e.target.value)} inputMode="decimal" placeholder="0" className={inputCls} />
            </Pole>
            <Pole label="Widełki od">
              <input value={cenaMin} onChange={(e) => setCenaMin(e.target.value)} inputMode="decimal" placeholder="—" className={inputCls} />
            </Pole>
            <Pole label="Widełki do" hint="Widełki są opcjonalne — dolna i górna granica netto.">
              <input value={cenaMax} onChange={(e) => setCenaMax(e.target.value)} inputMode="decimal" placeholder="—" className={inputCls} />
            </Pole>
            <Pole label="Stawka VAT">
              <select value={vat} onChange={(e) => setVat(e.target.value)} className={inputCls}>
                {VAT_RATES.map((v) => (
                  <option key={v} value={v}>
                    {v === "zw" ? "zw." : v === "np" ? "np." : `${v}%`}
                  </option>
                ))}
              </select>
            </Pole>
          </SekcjaProfilu>

          {/* Blok wrażliwy — własna sekcja z jawnym ostrzeżeniem w pierwszym
              wierszu, żeby było jasne, że to dane wewnętrzne (nie dla klienta). */}
          <SekcjaProfilu tytul="Tylko dla Ciebie">
            <WierszUwaga>
              <IconInfoCircle size={13} className="mt-0.5 shrink-0" /> Nie trafia na wydruk oferty ani faktury.
            </WierszUwaga>
            <Pole label="Koszt zakupu">
              <input value={koszt} onChange={(e) => setKoszt(e.target.value)} inputMode="decimal" placeholder="—" className={inputCls} />
            </Pole>
            <Pole label="Dostawca">
              <input value={dostawca} onChange={(e) => setDostawca(e.target.value)} placeholder="—" className={inputCls} />
            </Pole>
            {marza != null && (
              <WierszPola etykieta="Marża">
                <span className="text-[13px] text-[var(--fg)]">
                  {formatMoney(marza)}
                  {marzaProc != null && <span className="text-muted"> ({marzaProc.toFixed(0)}% ceny)</span>}
                </span>
              </WierszPola>
            )}
          </SekcjaProfilu>

          <SekcjaProfilu tytul="Opis" wiersze={false}>
            <textarea
              value={opis}
              onChange={(e) => setOpis(e.target.value)}
              rows={2}
              placeholder="np. Stacja pod lokalny model 7–14B, RAG dla 1–5 osób."
              className={`${inputCls} resize-none`}
            />
            <p className="mt-1 text-[11px] text-muted">Krótka notatka — co zawiera, dla kogo.</p>
          </SekcjaProfilu>
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

/** Wiersz formularza komponentu — wspólny `WierszPola`, ten sam co w profilach
 *  (Moduł 59, paczka F+, decyzja właściciela 2026-07-29). Podpowiedź idzie
 *  OSOBNYM wierszem: fragment daje sekcji dwoje dzieci, więc kreska między nimi
 *  rysuje się sama, a wiersz zachowuje stałą wysokość. */
function Pole({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <>
      <WierszPola etykieta={label}>{children}</WierszPola>
      {hint && <WierszUwaga>{hint}</WierszUwaga>}
    </>
  );
}
