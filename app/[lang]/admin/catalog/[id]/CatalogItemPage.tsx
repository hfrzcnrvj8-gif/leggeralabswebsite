"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import { useUI } from "../../ui";
import { StanBledu } from "../../StanPusty";
import { pobierzJSON, komunikatBledu, BladPanelu } from "../../dane";
import { SekcjaProfilu, WierszPola } from "../../ProfileSection";
import { CatalogCategoryIcon } from "../../icons";
import { CatalogFormModal } from "../CatalogDashboard";
import {
  catalogCategoryLabel,
  catalogMargin,
  catalogMarginPercent,
  hasPriceRange,
  formatMoney,
  etykietaVat,
  klasaStraty,
  type CatalogItem,
} from "../shared";

/** Podstrona komponentu katalogu — ADRES REKORDU (Moduł 59, paczka E).
 *
 * Katalog był jedynym modułem, w którym rekord nie miał PROFILU w ogóle:
 * pozycja istniała jako wiersz listy i formularz edycji, więc nie dało się
 * do niej odesłać linkiem ani zobaczyć jej danych bez wchodzenia w tryb
 * edycji. Widok czytania idzie przez `SekcjaProfilu`/`WierszPola`, czyli ten
 * sam wiersz „etykieta — wartość", co reszta panelu (paczka F); samą edycję
 * otwiera DOKŁADNIE ten formularz, co lista — bez drugiej kopii pól. */
export function CatalogItemPage({ id, lang }: { id: string; lang: Locale }) {
  const { toast, confirm } = useUI();
  const router = useRouter();
  const [item, setItem] = useState<CatalogItem | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [nieznalezione, setNieznalezione] = useState(false);
  const [formOtwarty, setFormOtwarty] = useState(false);

  const wczytaj = useCallback(async () => {
    try {
      const dane = await pobierzJSON<{ item: CatalogItem }>(`/api/catalog/${id}`);
      setItem(dane.item);
      setBlad(null);
      setNieznalezione(false);
    } catch (e) {
      if (e instanceof BladPanelu && e.status === 404) {
        setNieznalezione(true);
        setBlad(null);
        return;
      }
      setBlad(komunikatBledu(e));
    }
  }, [id]);

  useEffect(() => {
    wczytaj();
  }, [wczytaj]);

  const usun = useCallback(async () => {
    if (!item) return;
    if (!(await confirm(`Usunąć „${item.nazwa}” z katalogu?`, { danger: true }))) return;
    const res = await fetch(`/api/catalog/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Nie udało się usunąć komponentu.", "error");
      return;
    }
    router.push(`/${lang}/admin/catalog`);
  }, [item, confirm, toast, router, lang]);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/${lang}/admin/catalog`} className="text-sm text-muted hover:text-[var(--fg)]">
        ← Wróć do katalogu
      </Link>

      <div className="mt-3">
        {nieznalezione ? (
          <div className="card-paper rounded-2xl p-8 text-center">
            <p className="text-[13.5px] text-[var(--fg)]">Nie ma takiego komponentu</p>
            <p className="mx-auto mt-1 max-w-[42ch] text-[12.5px] text-muted">
              Został usunięty z katalogu albo link jest stary. Oferty, w których już go użyto, mają zapisaną własną
              kopię pozycji i nic im się nie stało.
            </p>
          </div>
        ) : blad ? (
          <div className="card-paper rounded-2xl">
            <StanBledu blad={blad} onPonow={wczytaj} />
          </div>
        ) : item ? (
          <div className="card-paper rounded-2xl border hairline p-5 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <CatalogCategoryIcon kind={item.kategoria} size={18} className="shrink-0 text-muted" />
                <h1 className="min-w-0 truncate text-lg font-semibold">{item.nazwa}</h1>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  onClick={() => setFormOtwarty(true)}
                  className="flex items-center gap-1 rounded-lg border hairline px-2.5 py-1 text-[12px] text-muted hover:text-[var(--fg)]"
                >
                  <IconPencil size={14} /> Edytuj
                </button>
                <button onClick={usun} aria-label="Usuń" className="p-1 text-muted hover:text-red-400">
                  <IconTrash size={15} />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <SekcjaProfilu tytul="Pozycja">
                <WierszPola etykieta="Kategoria">{catalogCategoryLabel(item.kategoria)}</WierszPola>
                <WierszPola etykieta="Jednostka">{item.jednostka}</WierszPola>
                <WierszPola etykieta="Dostawca">{item.dostawca || "—"}</WierszPola>
              </SekcjaProfilu>

              <SekcjaProfilu tytul="Cena">
                <WierszPola etykieta="Cena netto">
                  {formatMoney(item.cena_netto, item.waluta)} / {item.jednostka}
                </WierszPola>
                <WierszPola etykieta="Waluta">{item.waluta}</WierszPola>
                {/* `{item.vat_stawka}%` pisało na tym ekranie „zw.%" i „np.%" —
                    jedyne miejsce w panelu, które nie znało tego wyjątku. */}
                <WierszPola etykieta="Stawka VAT">{etykietaVat(item.vat_stawka)}</WierszPola>
                <WierszPola etykieta="Widełki">
                  {hasPriceRange(item.cena_min, item.cena_max)
                    ? `${formatMoney(item.cena_min as number, item.waluta)} – ${formatMoney(item.cena_max as number, item.waluta)}`
                    : "—"}
                </WierszPola>
              </SekcjaProfilu>

              {/* Koszt i marża są TYLKO dla właściciela — nie trafiają na wydruk
                  dla klienta. Osobna sekcja mówi to samym podziałem. */}
              <SekcjaProfilu tytul="Tylko dla Ciebie">
                <WierszPola etykieta="Koszt zakupu">
                  {item.koszt_zakupu != null ? formatMoney(item.koszt_zakupu, item.waluta) : "—"}
                </WierszPola>
                <WierszPola etykieta="Marża">
                  {(() => {
                    const m = catalogMargin(item.cena_netto, item.koszt_zakupu);
                    const p = catalogMarginPercent(item.cena_netto, item.koszt_zakupu);
                    if (m == null) return "—";
                    // Ujemna marża = strata i tylko ona dostaje czerwień.
                    return (
                      <span className={klasaStraty(m, "text-[var(--fg)]")}>
                        {formatMoney(m, item.waluta)}
                        {p != null ? ` (${p.toFixed(0)}%)` : ""}
                      </span>
                    );
                  })()}
                </WierszPola>
              </SekcjaProfilu>

              {item.opis && (
                <SekcjaProfilu tytul="Opis" wiersze={false}>
                  <p className="whitespace-pre-wrap text-[13px] text-[var(--fg)]">{item.opis}</p>
                </SekcjaProfilu>
              )}
            </div>
          </div>
        ) : (
          <div className="h-64 animate-pulse rounded-2xl bg-[var(--plyta)]" />
        )}
      </div>

      {formOtwarty && item && (
        <CatalogFormModal
          initial={item}
          onClose={() => setFormOtwarty(false)}
          // Formularz oddaje CAŁĄ odświeżoną listę (tak działa PATCH katalogu),
          // więc bieżącą pozycję wyjmujemy z niej po id zamiast dopytywać.
          onSaved={(items) => {
            setItem(items.find((i) => i.id === item.id) ?? item);
            setFormOtwarty(false);
          }}
          onError={(msg) => toast(msg, "error")}
        />
      )}
    </div>
  );
}
