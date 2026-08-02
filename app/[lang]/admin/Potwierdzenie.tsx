"use client";

/**
 * Potwierdzanie działań nieodwracalnych w interfejsie — Faza 4 planu
 * `docs/PLAN-ZAPLECZE.md`.
 *
 * ── KTO TU RZĄDZI ─────────────────────────────────────────────────────────
 * **Trasa.** Ten plik nie wie, które działania są nieodwracalne, i nie ma jak
 * się tego domyślić. Wysyła żądanie normalnie; jeśli trasa odpowie **428**
 * z opisem potwierdzenia, dopiero wtedy pokazuje okno — a treść okna (tytuł,
 * skutek, napis na przycisku, czy trzeba coś przepisać) przychodzi
 * z odpowiedzi, nie jest tu zapisana.
 *
 * To nie jest ozdoba architektury, tylko jedyny sposób, żeby lista działań
 * nieodwracalnych nie rozjechała się na dwie kopie — panelową i serwerową.
 * Faza 2 pokazała, jak to wygląda, gdy się rozjedzie: bramka wysyłki działała
 * tylko tam, gdzie ktoś zajrzał. Tu panel FIZYCZNIE nie wie o barierze,
 * dopóki trasa mu o niej nie powie, więc nie ma czego zapomnieć.
 *
 * Jedyna rzecz, której trasa NIE przysyła, to wartość do przepisania przy
 * poziomie „mocne" — odesłanie jej zamieniłoby mocne potwierdzenie
 * w formalność (wystarczyłoby przepisać ją z odmowy do kolejnego żądania).
 * Tę wartość podaje wołający, który i tak ma rekord na ekranie:
 * `doPrzepisania`.
 *
 * ── GDZIE TO SIEDZI ───────────────────────────────────────────────────────
 * Samo OKNO renderuje `AdminUIProvider` (`ui.tsx`), raz na cały panel — tak
 * samo jak `confirm()`/`prompt()`. Dlatego żaden z kilkunastu ekranów, które
 * kasują rekordy, nie musi wstawiać własnego węzła w drzewo ani o nim
 * pamiętać. Wołający dostaje samo `zadanie()` z `useUI()`.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { IconAlertTriangle, IconX } from "@tabler/icons-react";
import { NAGLOWEK_FRAZY, NAGLOWEK_POTWIERDZENIA, normalizujFraze } from "@/lib/nieodwracalne";
import { SPRING, EASE_LIQUID } from "@/lib/motion";

/** Opis potwierdzenia tak, jak przysyła go trasa w odpowiedzi 428. */
export type OpisPotwierdzenia = {
  powod: string;
  dzialanie: string;
  poziom: "zwykle" | "mocne";
  tytul: string;
  skutek: string;
  przycisk: string;
  coPrzepisac?: string;
};

/**
 * Zgoda zapamiętana na czas JEDNEJ serii (np. „usuń 5 zaznaczonych leadów").
 *
 * Z punktu widzenia właściciela to jedno działanie, więc pyta raz — pytanie
 * przy każdym z pięciu rekordów uczyłoby klikać „tak" bez czytania, czyli
 * niszczyłoby dokładnie to, co ta faza buduje. Obiekt tworzy wołający przed
 * pętlą (`nowaSeria()`) i wyrzuca po niej; nic się nie zapamiętuje dłużej niż
 * jedno kliknięcie właściciela.
 */
export type ZgodaSerii = { dzialanie: string | null; fraza: string | null };

export function nowaSeria(): ZgodaSerii {
  return { dzialanie: null, fraza: null };
}

export type OpcjeZadania = {
  method?: "POST" | "PATCH" | "PUT" | "DELETE";
  body?: Record<string, unknown>;
  /** Wartość do przepisania przy poziomie „mocne" — nazwa klienta, numer
   *  faktury, tytuł projektu. */
  doPrzepisania?: string | null;
  /** Wspólna zgoda dla serii żądań, patrz `ZgodaSerii`. */
  seria?: ZgodaSerii;
};

export type WynikZadania = {
  ok: boolean;
  status: number;
  dane: Record<string, unknown> & { error?: string };
  /** Właściciel zamknął okno potwierdzenia. To nie jest błąd — nie krzycz. */
  anulowane?: boolean;
};

/** Pyta właściciela; zwraca przepisaną frazę (albo `null` przy poziomie
 *  „zwykłe”), a `false` gdy odmówił. */
export type PoprosOPotwierdzenie = (opis: OpisPotwierdzenia, doPrzepisania: string | null) => Promise<string | null | false>;

/**
 * Żądanie, które samo obsługuje odmowę „to jest nieodwracalne".
 *
 * Czysta funkcja, bez Reacta — stan okna trzyma `AdminUIProvider`, a tutaj
 * przychodzi wyłącznie jako `popros`. Dzięki temu tę samą ścieżkę da się
 * przetestować bez montowania drzewa.
 */
export async function wykonajZadanie(
  url: string,
  opcje: OpcjeZadania | undefined,
  popros: PoprosOPotwierdzenie
): Promise<WynikZadania> {
  const method = opcje?.method ?? "POST";

  const wykonaj = async (potw: { dzialanie: string; fraza: string | null } | null) => {
    const headers: Record<string, string> = {};
    if (opcje?.body !== undefined) headers["Content-Type"] = "application/json";
    if (potw) {
      headers[NAGLOWEK_POTWIERDZENIA] = potw.dzialanie;
      // `encodeURIComponent`, bo nagłówki HTTP niosą tylko latin-1, a tu jadą
      // nazwy w rodzaju „Wdrożenie w Łodzi" — pierwsze „ł" wywaliłoby `fetch`,
      // zanim żądanie by wyszło. Serwer odkodowuje w jednym miejscu
      // (`odczytajPotwierdzenie`).
      if (potw.fraza != null) headers[NAGLOWEK_FRAZY] = encodeURIComponent(potw.fraza);
    }
    const res = await fetch(url, {
      method,
      headers,
      ...(opcje?.body !== undefined ? { body: JSON.stringify(opcje.body) } : {}),
    });
    const dane = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
    return { res, dane };
  };

  // Zgoda z tej samej serii — jeśli właściciel potwierdził już przy pierwszym
  // rekordzie, kolejne idą bez pytania.
  const zSerii = opcje?.seria?.dzialanie ? { dzialanie: opcje.seria.dzialanie, fraza: opcje.seria.fraza } : null;

  let { res, dane } = await wykonaj(zSerii);

  // Sprawdzamy POWÓD (obecność opisu), nie sam kod — to samo założenie
  // o kodzie 409 zawiodło już przy bramce wysyłki, gdzie 409 zwraca też
  // unieważniony link i podpisana umowa.
  const opis = dane.potwierdzenie as OpisPotwierdzenia | undefined;
  if (res.status === 428 && opis) {
    const fraza = await popros(opis, opcje?.doPrzepisania ?? null);
    if (fraza === false) return { ok: false, status: res.status, dane, anulowane: true };

    if (opcje?.seria) {
      opcje.seria.dzialanie = opis.dzialanie;
      opcje.seria.fraza = fraza;
    }
    ({ res, dane } = await wykonaj({ dzialanie: opis.dzialanie, fraza }));
  }

  return { ok: res.ok, status: res.status, dane };
}

// ── Okno ───────────────────────────────────────────────────────────────────

export type StanPotwierdzenia = {
  opis: OpisPotwierdzenia;
  doPrzepisania: string | null;
  resolve: (fraza: string | null | false) => void;
};

export function OknoPotwierdzenia({ stan }: { stan: StanPotwierdzenia }) {
  const [wpisane, setWpisane] = useState("");
  const mocne = stan.opis.poziom === "mocne" && !!normalizujFraze(stan.doPrzepisania);
  // Porównanie tą samą funkcją co na serwerze — inaczej przycisk bywałby
  // aktywny przy frazie, którą trasa i tak odrzuci (albo odwrotnie). Ostatnie
  // słowo ma serwer; to jest wyłącznie wygoda.
  const zgadzaSie = !mocne || normalizujFraze(wpisane) === normalizujFraze(stan.doPrzepisania);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: EASE_LIQUID }}
      // z-[210] — NAD menu i popoverami (`z-[200]`, patrz Menu.tsx). Okno
      // potwierdzenia bywa otwierane z pozycji menu kontekstowego, a okno,
      // które da się przykryć tym, z czego je otwarto, nie jest barierą
      // (część znaleziska D3).
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onClick={() => stan.resolve(false)}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={SPRING}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") stan.resolve(false);
        }}
        className="card-paper w-full max-w-md rounded-2xl p-5"
        role="alertdialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <IconAlertTriangle size={16} className="shrink-0 text-brand-gold" />
            {stan.opis.tytul}
          </h2>
          <button
            onClick={() => stan.resolve(false)}
            className="rounded-full border hairline p-1 text-muted hover:text-[var(--fg)]"
            aria-label="Zamknij"
          >
            <IconX size={14} />
          </button>
        </div>

        {/* Skutek, nie „tej operacji nie można cofnąć". Zdanie, które nie mówi
            CO się stanie, jest formalnością do odklikania — na tym polegało
            znalezisko D1. */}
        <p className="mt-2 text-[13px] leading-relaxed">{stan.opis.skutek}</p>

        {mocne && (
          <div className="mt-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Przepisz {stan.opis.coPrzepisac ?? "wartość"}, aby potwierdzić
            </div>
            <div className="card-inset mt-1.5 select-all rounded-lg border hairline px-3 py-2 text-[13px] font-medium">
              {stan.doPrzepisania}
            </div>
            <input
              autoFocus
              value={wpisane}
              onChange={(e) => setWpisane(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") stan.resolve(false);
                if (e.key === "Enter" && zgadzaSie) stan.resolve(wpisane);
              }}
              className="mt-2 w-full rounded-lg border hairline bg-transparent px-3 py-2 text-[13px] text-[var(--fg)] placeholder:text-muted focus:border-zaznaczenie/60 focus:outline-none"
              placeholder="Przepisz powyższe"
              aria-label={`Przepisz ${stan.opis.coPrzepisac ?? "wartość"}`}
            />
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            autoFocus={!mocne}
            onClick={() => stan.resolve(false)}
            className="rounded-full border hairline px-3 py-1.5 text-xs"
          >
            Anuluj
          </button>
          <button
            disabled={!zgadzaSie}
            onClick={() => stan.resolve(mocne ? wpisane : null)}
            className="rounded-full bg-red-500/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {stan.opis.przycisk}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
