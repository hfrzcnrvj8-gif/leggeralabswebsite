"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { StanBledu } from "../../StanPusty";
import { pobierzJSON, komunikatBledu, BladPanelu } from "../../dane";
import { SekcjaProfilu, WierszPola } from "../../ProfileSection";
import { formatPlDate } from "@/lib/projects";
import { CYKL_LABEL, normalizujCykl } from "@/lib/recurrence";
import type { HubEvent } from "@/lib/events";

/** Podstrona wydarzenia — ADRES REKORDU (Moduł 59, paczka E).
 *
 * Kalendarz był ostatnim modułem, do którego rekordu nie dało się odesłać
 * linkiem: wydarzenie otwierało się wyłącznie przez kliknięcie w dzień
 * w siatce. „Przyślij mi link do tego spotkania" nie miało odpowiedzi.
 *
 * Świadomie WIDOK, nie edytor: samo wydarzenie poprawia się w kalendarzu, przy
 * dniu, na którym stoi — bo tam widać kontekst (co jest obok, czy się nakłada).
 * Ta strona ma odpowiadać na „co to za termin i kiedy”, a poprawianie zostaje
 * tam, gdzie było. Świadomie BEZ przycisku „pokaż ten dzień w siatce”:
 * `CalendarView` nie czyta dziś żadnego parametru dnia z adresu, więc taki
 * przycisk byłby martwą afordancją (kat. 2 listy kontrolnej). */
export function EventPage({ id, lang }: { id: string; lang: Locale }) {
  const [event, setEvent] = useState<HubEvent | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [nieznalezione, setNieznalezione] = useState(false);

  const wczytaj = useCallback(async () => {
    try {
      const dane = await pobierzJSON<{ event: HubEvent }>(`/api/events/${encodeURIComponent(id)}`);
      setEvent(dane.event);
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

  const czas = event?.godzina
    ? `${event.godzina}${event.czas_trwania_min ? ` · ${event.czas_trwania_min} min` : ""}`
    : "cały dzień";

  return (
    <div className="mx-auto max-w-xl">
      <Link href={`/${lang}/admin/calendar`} className="text-sm text-muted hover:text-[var(--fg)]">
        ← Wróć do kalendarza
      </Link>

      <div className="mt-3">
        {nieznalezione ? (
          <div className="card-paper rounded-2xl p-8 text-center">
            <p className="text-[13.5px] text-[var(--fg)]">Nie ma takiego wydarzenia</p>
            <p className="mx-auto mt-1 max-w-[42ch] text-[12.5px] text-muted">
              Zostało usunięte albo link jest stary. Kalendarz pokazuje wszystko, co nadal stoi w terminarzu.
            </p>
          </div>
        ) : blad ? (
          <div className="card-paper rounded-2xl">
            <StanBledu blad={blad} onPonow={wczytaj} />
          </div>
        ) : event ? (
          <div className="card-paper rounded-2xl border hairline p-5 sm:p-6">
            <h1 className="mb-4 text-lg font-semibold">{event.tytul}</h1>

            <div className="space-y-4">
              <SekcjaProfilu tytul="Termin">
                <WierszPola etykieta="Data">{formatPlDate(event.data)}</WierszPola>
                <WierszPola etykieta="Godzina">{czas}</WierszPola>
                {event.data_koniec && (
                  <WierszPola etykieta="Koniec">{formatPlDate(event.data_koniec)}</WierszPola>
                )}
                <WierszPola etykieta="Powtarzanie">
                  {(() => {
                    const c = normalizujCykl(event.powtarzanie);
                    return c ? CYKL_LABEL[c] : "jednorazowo";
                  })()}
                </WierszPola>
                <WierszPola etykieta="Miejsce">{event.lokalizacja || "—"}</WierszPola>
              </SekcjaProfilu>

              {event.opis && (
                <SekcjaProfilu tytul="Opis" wiersze={false}>
                  <p className="whitespace-pre-wrap text-[13px] text-[var(--fg)]">{event.opis}</p>
                </SekcjaProfilu>
              )}
            </div>

          </div>
        ) : (
          <div className="h-64 animate-pulse rounded-2xl bg-[var(--plyta)]" />
        )}
      </div>
    </div>
  );
}
