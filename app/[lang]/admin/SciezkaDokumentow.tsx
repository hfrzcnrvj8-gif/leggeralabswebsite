"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconFileText,
  IconFileCheck,
  IconFolder,
  IconReceipt,
  IconExternalLink,
  IconLink,
  type Icon as TablerIcon,
} from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import { useContextMenu, ContextMenu, ContextMenuItem, MenuDivider } from "./Menu";
import { useUI } from "./ui";
import { formatMoney } from "@/lib/invoices";

/**
 * Drzewko przepływu dokumentów: „z tej oferty powstała ta umowa, z niej ten
 * projekt i te faktury".
 *
 * **Dlaczego drzewko, a nie lista ze strzałkami** (zgłoszenie właściciela
 * 2026-07-27). Lista czyta się jak łańcuch — a rzeczywistość rozgałęzia się:
 * jedna umowa rodzi zaliczkę I fakturę końcową, umowa dostaje aneks, oferta
 * bywa bezpotomna. Ustawione w rzędzie wyglądały jak następstwo („z zaliczki
 * powstała faktura"), czyli ładna wersja nieprawdy. Kafelek + krawędź mówią
 * to, co jest: rodzeństwo obok siebie, potomstwo dalej w prawo.
 *
 * **Dlaczego bez biblioteki do grafów.** Wątek jednego klienta ma kilka
 * węzłów, a układ jest znany z góry (kolumna = etap lejka). Silnik
 * force-directed rysowałby tę samą informację w losowym miejscu przy każdym
 * wejściu — do tego waży więcej niż cały ten moduł. Kolumny liczy prosty
 * DFS, krawędzie to jedno SVG mierzone po ułożeniu kafelków.
 *
 * **Prawy przycisk na kafelku** daje te same akcje, co lista modułu — drzewko
 * ma być miejscem PRACY, nie obrazkiem do oglądania.
 */

export type WezelSciezki = {
  rodzaj: "offer" | "contract" | "project" | "invoice";
  id: string;
  prefiks: string;
  etykieta: string;
  status: string;
  rodzic: string | null;
  kwota: number | null;
  waluta: string | null;
  created_at: string;
};

const SEGMENT: Record<WezelSciezki["rodzaj"], string> = {
  offer: "offers",
  contract: "contracts",
  project: "projects",
  invoice: "invoices",
};

const IKONA: Record<WezelSciezki["rodzaj"], TablerIcon> = {
  offer: IconFileText,
  contract: IconFileCheck,
  project: IconFolder,
  invoice: IconReceipt,
};

/** Kolor kafelka niesie ETAP, nie status — status stoi obok słowem.
 * Gdyby kolor niósł jedno i drugie, drzewko miałoby dwie sprzeczne mapy
 * koloru naraz (lekcja z audytu słownika koloru). */
const AKCENT: Record<WezelSciezki["rodzaj"], string> = {
  offer: "text-brand-cyan",
  contract: "text-brand-purple",
  project: "text-brand-gold",
  invoice: "text-emerald-400",
};

/** Dokument zamknięty przygasa — wzrok ma iść do tego, co jeszcze żyje. */
const ZAMKNIETE = new Set(["Odrzucona", "Wygasła", "Anulowana", "Zapłacona", "Wdrożone", "Zamknięty"]);

type Ulozony = { wezel: WezelSciezki; kolumna: number; wiersz: number };

/** Układ: kolumna = głębokość w drzewie (etap), wiersz = kolejność DFS.
 * Dzieci idą pod rodzicem, więc gałąź czyta się z góry na dół bez krzyżowania
 * krawędzi — przy kilku węzłach to wystarcza i jest deterministyczne. */
function ulozDrzewo(wezly: WezelSciezki[]): Ulozony[] {
  const dzieci = new Map<string | null, WezelSciezki[]>();
  for (const w of wezly) {
    const klucz = w.rodzic && wezly.some((x) => x.id === w.rodzic) ? w.rodzic : null;
    dzieci.set(klucz, [...(dzieci.get(klucz) ?? []), w]);
  }
  const wynik: Ulozony[] = [];
  let wiersz = 0;
  const zejdz = (rodzic: string | null, kolumna: number) => {
    for (const w of dzieci.get(rodzic) ?? []) {
      wynik.push({ wezel: w, kolumna, wiersz: wiersz++ });
      zejdz(w.id, kolumna + 1);
    }
  };
  zejdz(null, 0);
  return wynik;
}

export function SciezkaDokumentow({
  wezly,
  lang,
  aktywny,
}: {
  wezly: WezelSciezki[];
  lang: Locale;
  /** Węzeł „tu jesteś" — profil dokumentu podaje własne id. Bez tego mini-mapa
   * w profilu każe szukać wzrokiem, który kafelek to ten otwarty. */
  aktywny?: string;
}) {
  // useMemo, NIE gołe wywołanie: `ulozDrzewo` zwraca nową tablicę przy każdym
  // renderze, więc `przelicz` (zależny od niej) też był nowy, efekt strzelał
  // ponownie, `setKrawedzie` renderowało — i tak w kółko, aż React przerywał
  // („Maximum update depth exceeded"). Złapane od razu na ekranie, bo widok
  // ma własną barierę awarii.
  const ulozone = useMemo(() => ulozDrzewo(wezly), [wezly]);
  const kolumn = Math.max(...ulozone.map((u) => u.kolumna)) + 1;
  const router = useRouter();
  const { toast, prompt } = useUI();
  const ctx = useContextMenu<WezelSciezki>();

  const boxRef = useRef<HTMLDivElement>(null);
  const kafelki = useRef(new Map<string, HTMLDivElement>());
  const [krawedzie, setKrawedzie] = useState<{ d: string; id: string }[]>([]);

  /** Krawędzie rysujemy PO ułożeniu kafelków, z ich realnych pozycji —
   * liczone z góry rozjeżdżałyby się przy każdej zmianie szerokości okna,
   * długości numeru albo rozmiaru czcionki. */
  const przelicz = useCallback(() => {
    const box = boxRef.current;
    if (!box) return;
    const baza = box.getBoundingClientRect();
    const nowe: { d: string; id: string }[] = [];
    for (const u of ulozone) {
      if (!u.wezel.rodzic) continue;
      const dziecko = kafelki.current.get(u.wezel.id);
      const rodzic = kafelki.current.get(u.wezel.rodzic);
      if (!dziecko || !rodzic) continue;
      const a = rodzic.getBoundingClientRect();
      const b = dziecko.getBoundingClientRect();
      const x1 = a.right - baza.left;
      const y1 = a.top + a.height / 2 - baza.top;
      const x2 = b.left - baza.left;
      const y2 = b.top + b.height / 2 - baza.top;
      const mid = x1 + (x2 - x1) / 2;
      // Łamana z zaokrąglonym rogiem, nie krzywa Béziera: przy dwóch węzłach
      // jeden nad drugim krzywa robi się falą, a proces ma wyglądać na proces.
      nowe.push({
        id: u.wezel.id,
        d:
          Math.abs(y2 - y1) < 2
            ? `M ${x1} ${y1} L ${x2} ${y2}`
            : `M ${x1} ${y1} L ${mid - 8} ${y1} Q ${mid} ${y1} ${mid} ${y1 + (y2 > y1 ? 8 : -8)} L ${mid} ${y2 - (y2 > y1 ? 8 : -8)} Q ${mid} ${y2} ${mid + 8} ${y2} L ${x2} ${y2}`,
      });
    }
    // Podmieniamy stan tylko przy realnej zmianie geometrii — ResizeObserver
    // potrafi strzelić przy zmianie o zero pikseli, a każde `setState` tutaj
    // uruchamia kolejny pomiar.
    setKrawedzie((stare) =>
      stare.length === nowe.length && stare.every((k, i) => k.id === nowe[i].id && k.d === nowe[i].d) ? stare : nowe
    );
  }, [ulozone]);

  useLayoutEffect(() => {
    przelicz();
  }, [przelicz]);

  useEffect(() => {
    const obs = new ResizeObserver(() => przelicz());
    if (boxRef.current) obs.observe(boxRef.current);
    window.addEventListener("resize", przelicz);
    return () => {
      obs.disconnect();
      window.removeEventListener("resize", przelicz);
    };
  }, [przelicz]);

  const otworz = useCallback(
    (w: WezelSciezki, nowaKarta = false) => {
      const url = `/${lang}/admin/${SEGMENT[w.rodzaj]}/${w.id}`;
      if (nowaKarta) window.open(url, "_blank");
      else router.push(url);
    },
    [lang, router]
  );

  /** Link dla klienta — tylko tam, gdzie publiczna strona w ogóle istnieje
   * (projekt jej nie ma). Wołamy tę samą trasę co moduły, żeby unieważnienie
   * linku (Moduł 40) działało tak samo z drzewka. */
  const kopiujLink = useCallback(
    async (w: WezelSciezki) => {
      const kind = w.rodzaj === "offer" ? "offer" : w.rodzaj === "contract" ? "contract" : "invoice";
      const res = await fetch(`/api/share-links/${kind}/${w.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ensure" }),
      });
      if (!res.ok) {
        toast("Nie udało się przygotować linku.", "error");
        return;
      }
      const data = (await res.json()) as { url: string; revokedAt: string | null };
      if (data.revokedAt) {
        toast("Ten link jest unieważniony — wygeneruj nowy w dokumencie.", "error");
        return;
      }
      try {
        await navigator.clipboard.writeText(data.url);
        toast("Link dla klienta skopiowany.");
      } catch {
        await prompt("Skopiuj link ręcznie (Cmd/Ctrl+C):", { placeholder: data.url });
      }
    },
    [toast, prompt]
  );

  return (
    <>
      <div
        ref={boxRef}
        className="relative overflow-x-auto rounded-lg card-inset p-3"
        /* Kolumny na SZEROKOŚĆ TREŚCI, nie `1fr` — przy czterech etapach
           i wąskiej karcie kafelki rozjeżdżały się po całej szerokości, a
           krawędzie robiły się metrowymi kreskami przez pustkę. Drzewko ma
           być zwarte i czytać się jednym rzutem oka. */
        style={{ display: "grid", gridTemplateColumns: `repeat(${kolumn}, max-content)`, gap: "8px 20px" }}
      >
        {/* Krawędzie pod kafelkami — `pointer-events: none`, żeby nie zjadały
            kliknięć i prawego przycisku. */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          {krawedzie.map((k) => (
            <path key={k.id} d={k.d} fill="none" stroke="var(--hairline)" strokeWidth={1.5} />
          ))}
        </svg>

        {ulozone.map((u) => {
          const Ikona = IKONA[u.wezel.rodzaj];
          const przygaszony = ZAMKNIETE.has(u.wezel.status);
          return (
            <div
              key={u.wezel.id}
              ref={(el) => {
                if (el) kafelki.current.set(u.wezel.id, el);
                else kafelki.current.delete(u.wezel.id);
              }}
              style={{ gridColumn: u.kolumna + 1, gridRow: u.wiersz + 1 }}
              onClick={() => otworz(u.wezel)}
              onContextMenu={(e) => ctx.openAt(e, u.wezel)}
              title={`${u.wezel.prefiks} ${u.wezel.etykieta} — ${u.wezel.status}`}
              className={`relative z-[1] w-[150px] cursor-pointer rounded-lg border bg-[var(--bg)] px-2.5 py-1.5 transition-colors hover:bg-[var(--hairline)]/50 ${
                u.wezel.id === aktywny ? "border-brand-purple/60 ring-1 ring-brand-purple/40" : "hairline"
              } ${przygaszony ? "opacity-60" : ""}`}
            >
              <div className="flex items-center gap-1.5">
                <Ikona size={13} className={AKCENT[u.wezel.rodzaj]} />
                <span className="text-[10.5px] uppercase tracking-wide text-muted">{u.wezel.prefiks}</span>
              </div>
              <div className="mt-0.5 truncate text-[12.5px] font-medium text-[var(--fg)]">{u.wezel.etykieta}</div>
              <div className="mt-0.5 flex items-baseline justify-between gap-2">
                <span className="truncate text-[10.5px] text-muted">{u.wezel.status}</span>
                {u.wezel.kwota != null && u.wezel.kwota > 0 && (
                  <span className="shrink-0 text-[10.5px] tabular-nums text-muted">
                    {formatMoney(u.wezel.kwota, u.wezel.waluta || "PLN")}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ContextMenu ctl={ctx} width={220}>
        {(w, close) => (
          <>
            <ContextMenuItem
              icon={<IconFileText size={14} />}
              label="Otwórz"
              onClick={() => {
                close();
                otworz(w);
              }}
            />
            <ContextMenuItem
              icon={<IconExternalLink size={14} />}
              label="Otwórz w nowej karcie"
              onClick={() => {
                close();
                otworz(w, true);
              }}
            />
            {w.rodzaj !== "project" && (
              <>
                <MenuDivider />
                <ContextMenuItem
                  icon={<IconExternalLink size={14} />}
                  label="Podgląd / wydruk"
                  onClick={() => {
                    close();
                    window.open(`/${lang}/admin/${SEGMENT[w.rodzaj]}/${w.id}/print`, "_blank");
                  }}
                />
                <ContextMenuItem
                  icon={<IconLink size={14} />}
                  label="Kopiuj link dla klienta"
                  disabled={w.status === "Szkic"}
                  onClick={() => {
                    close();
                    kopiujLink(w);
                  }}
                />
              </>
            )}
          </>
        )}
      </ContextMenu>
    </>
  );
}
