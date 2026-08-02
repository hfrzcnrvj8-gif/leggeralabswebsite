"use client";

/**
 * Bramka wysyłki w interfejsie — Faza 2 planu `docs/PLAN-ZAPLECZE.md`.
 *
 * Dwa miejsca, jedno źródło (`lib/bramkaWysylki.ts`), decyzja właściciela
 * z 2026-08-02:
 *
 * - **`PasekBramki`** — stoi przy dokumencie i mówi o brakach ZAWCZASU, żeby
 *   dało się je poprawić na spokojnie. Wynik przychodzi z `GET` dokumentu,
 *   nie jest liczony w przeglądarce: dane wystawcy siedzą w osobnej tabeli,
 *   której edytor nigdy nie wołał (i dlatego oferta wyszła anonimowa — A2).
 * - **`useWysylkaZBramka`** — zatrzymuje w momencie kliknięcia „Wyślij”
 *   i pokazuje listę. Blokady kończą sprawę, ostrzeżenia przechodzi się
 *   jednym kliknięciem „Wyślij mimo to”.
 *
 * **Odmawia TRASA, nie ten plik.** Hook tylko ładnie pokazuje to, co trasa
 * i tak zwróciła — 400 przy blokadzie, 409 przy samych ostrzeżeniach. Gdyby
 * ktoś wysłał to samo żądanie z apki albo curl-em, dostanie tę samą odmowę
 * (audyt Modułu 57: blokada w interfejsie nie jest blokadą).
 */

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconAlertTriangle, IconBan, IconSend, IconX } from "@tabler/icons-react";
import type { WynikBramki, Zastrzezenie } from "@/lib/bramkaWysylki";
import { useUI } from "./ui";
import { SPRING, EASE_LIQUID } from "@/lib/motion";

// ── Pasek przy dokumencie ──────────────────────────────────────────────────

/**
 * Lista zastrzeżeń przy dokumencie. Nie renderuje się wcale, gdy nie ma
 * o czym mówić — cichy dokument to dokument gotowy do wysyłki.
 */
export function PasekBramki({ bramka, className = "" }: { bramka?: WynikBramki | null; className?: string }) {
  const wszystkie = [...(bramka?.blokady ?? []), ...(bramka?.ostrzezenia ?? [])];
  if (wszystkie.length === 0) return null;

  const blokuje = (bramka?.blokady.length ?? 0) > 0;
  return (
    <div
      className={`card-inset rounded-xl border p-3 ${blokuje ? "border-red-500/30" : "border-brand-gold/30"} ${className}`}
    >
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
        {blokuje ? <IconBan size={13} className="text-red-400" /> : <IconAlertTriangle size={13} className="text-brand-gold" />}
        {blokuje ? "Zanim to wyjdzie do klienta" : "Warto sprawdzić przed wysyłką"}
      </div>
      <ul className="space-y-1.5">
        {wszystkie.map((z) => (
          <WierszZastrzezenia key={z.id} z={z} />
        ))}
      </ul>
    </div>
  );
}

function WierszZastrzezenia({ z }: { z: Zastrzezenie }) {
  const blokada = z.powaga === "blokada";
  return (
    <li className="flex gap-2 text-[12.5px] leading-snug">
      {/* Kolor niesie STAN i pilność, ikona rodzaj (słownik koloru panelu):
          czerwień = nie wyjdzie, złoto marki = wyjdzie, ale sprawdź. */}
      {blokada ? (
        <IconBan size={14} className="mt-[2px] shrink-0 text-red-400" />
      ) : (
        <IconAlertTriangle size={14} className="mt-[2px] shrink-0 text-brand-gold" />
      )}
      <span>
        <span className="text-[var(--fg)]">{z.tekst}</span>
        {z.gdzie && <span className="text-muted"> → {z.gdzie}</span>}
      </span>
    </li>
  );
}

// ── Okno przed wysyłką ─────────────────────────────────────────────────────

type StanOkna = { bramka: WynikBramki; rozwiaz: (zgoda: boolean) => void } | null;

export type WynikWysylki = {
  /** Wysłano. */
  ok: boolean;
  /** Odpowiedź trasy (do komunikatu o błędzie i do danych zwrotnych). */
  dane: Record<string, unknown> & { error?: string };
  /** Właściciel zamknął okno bramki — to NIE jest błąd, nie krzycz o nim. */
  anulowane?: boolean;
};

/**
 * Wysyłka, która sama obsługuje odmowę bramki.
 *
 * Wołający dostaje `wyslij(...)` i węzeł `oknoBramki` do wstawienia w drzewo.
 * Powtórzenie żądania z `mimo_ostrzezen: true` robi hook — bo inaczej każdy
 * z pięciu przycisków „Wyślij” w panelu musiałby znać ten protokół osobno,
 * a to jest dokładnie ten rodzaj powielenia, który Faza 1 sprzątała
 * w przepisywaniu danych klienta.
 */
export function useWysylkaZBramka(): {
  wyslij: (url: string, opcje?: { body?: Record<string, unknown> }) => Promise<WynikWysylki>;
  oknoBramki: React.ReactNode;
} {
  const [stan, setStan] = useState<StanOkna>(null);
  // Faza 4 — wysyłka dokumentu jest na liście działań nieodwracalnych, więc
  // trasa oddaje 428, zanim cokolwiek wyjdzie. Obsługę tego kroku ma
  // `useZadanieZPotwierdzeniem`; tutaj zostaje wyłącznie bramka z Fazy 2.
  //
  // Kolejność jest celowa i wynika z kolejności na serwerze: najpierw „czy to
  // wolno wysłać" (bramka), dopiero potem „czy na pewno teraz"
  // (potwierdzenie). Przy dokumencie bez zastrzeżeń właściciel widzi JEDNO
  // okno; dwa tylko wtedy, gdy sam przechodzi ostrzeżenie „mimo to".
  const { zadanie } = useUI();

  const wyslij = useCallback(
    async (url: string, opcje?: { body?: Record<string, unknown> }): Promise<WynikWysylki> => {
      const wykonaj = (mimo: boolean) =>
        zadanie(url, {
          method: "POST",
          body: { ...(opcje?.body ?? {}), ...(mimo ? { mimo_ostrzezen: true } : {}) },
        });

      let wynik = await wykonaj(false);
      if (wynik.anulowane) return { ok: false, dane: wynik.dane, anulowane: true };

      // `dane.bramka` rozstrzyga, czy to odmowa bramki — samego kodu nie da się
      // użyć jako sygnału: 409 zwraca też unieważniony link i już podpisana
      // umowa, a 400 kilka innych rzeczy. Sprawdzaj powód, nie kod.
      const bramka = wynik.dane.bramka as WynikBramki | undefined;
      if (!wynik.ok && bramka) {
        const zgoda = await new Promise<boolean>((rozwiaz) => setStan({ bramka, rozwiaz }));
        setStan(null);
        // Blokada nie ma przycisku wysyłki, więc `zgoda` może być tu `true`
        // tylko przy samych ostrzeżeniach — ale sprawdzamy jeszcze raz, żeby
        // przypadkowe „Potwierdź" nigdy nie obeszło blokady.
        if (!zgoda || bramka.blokady.length > 0) return { ok: false, dane: wynik.dane, anulowane: true };
        wynik = await wykonaj(true);
        if (wynik.anulowane) return { ok: false, dane: wynik.dane, anulowane: true };
      }

      return { ok: wynik.ok, dane: wynik.dane };
    },
    [zadanie]
  );

  const oknoBramki = (
    <AnimatePresence>
      {stan && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: EASE_LIQUID }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
          onClick={() => stan.rozwiaz(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={SPRING}
            onClick={(e) => e.stopPropagation()}
            className="card-paper w-full max-w-lg rounded-2xl p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-[15px] font-semibold">
                {stan.bramka.blokady.length > 0 ? "Tego nie wyślemy" : "Zanim to wyjdzie do klienta"}
              </h2>
              <button
                onClick={() => stan.rozwiaz(false)}
                className="rounded-full border hairline p-1 text-muted hover:text-[var(--fg)]"
                aria-label="Zamknij"
              >
                <IconX size={14} />
              </button>
            </div>
            <p className="mt-1 text-[12px] text-muted">
              {stan.bramka.blokady.length > 0
                ? "Popraw to, co niżej — dopiero wtedy dokument da się wysłać."
                : "To nie są błędy, tylko rzeczy, które klient zobaczy. Decyzja należy do Ciebie."}
            </p>

            <ul className="mt-4 space-y-2">
              {[...stan.bramka.blokady, ...stan.bramka.ostrzezenia].map((z) => (
                <WierszZastrzezenia key={z.id} z={z} />
              ))}
            </ul>

            <div className="mt-5 flex justify-end gap-2">
              <button
                autoFocus
                onClick={() => stan.rozwiaz(false)}
                className="rounded-full border hairline px-3 py-1.5 text-xs"
              >
                {stan.bramka.blokady.length > 0 ? "Wracam do dokumentu" : "Anuluj"}
              </button>
              {/* „Wyślij mimo to" pojawia się WYŁĄCZNIE przy samych
                  ostrzeżeniach — przy blokadzie nie ma czego potwierdzać
                  i przycisk, który i tak dostałby odmowę z trasy, byłby
                  kłamstwem. */}
              {stan.bramka.blokady.length === 0 && (
                <button
                  onClick={() => stan.rozwiaz(true)}
                  className="flex items-center gap-1.5 rounded-full bg-[var(--fg)] px-3 py-1.5 text-xs font-medium text-[var(--bg)] hover:opacity-90"
                >
                  <IconSend size={13} /> Wyślij mimo to
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Okno POTWIERDZENIA renderuje `AdminUIProvider` raz na cały panel, więc
  // wołający wstawia w drzewo tylko okno bramki, dokładnie jak dotąd.
  return { wyslij, oknoBramki };
}
