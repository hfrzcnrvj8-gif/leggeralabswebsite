"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { useUI } from "../../ui";
import { StanBledu } from "../../StanPusty";
import { pobierzJSON, komunikatBledu, BladPanelu } from "../../dane";
import { TrescPrzypomnienia } from "../ReminderDetail";
import type { Reminder, ReminderList } from "../shared";

/** Podstrona przypomnienia — ADRES REKORDU (Moduł 59, paczka E).
 *
 * Renderuje ten sam profil, co modal na liście (`TrescPrzypomnienia`), więc
 * nie powstaje druga wersja tych samych pól. Wczytuje rekord po id, bo w
 * przeciwieństwie do listy nie ma go skąd wziąć — i dlatego `GET
 * /api/reminders/:id` powstał razem z tą stroną. */
export function ReminderPage({ id, lang }: { id: string; lang: Locale }) {
  const { toast } = useUI();
  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [lists, setLists] = useState<ReminderList[]>([]);
  const [blad, setBlad] = useState<string | null>(null);
  const [nieznalezione, setNieznalezione] = useState(false);

  const wczytaj = useCallback(async () => {
    try {
      const [dane, listy] = await Promise.all([
        pobierzJSON<{ reminder: Reminder }>(`/api/reminders/${id}`),
        pobierzJSON<{ lists: ReminderList[] }>("/api/reminders/lists"),
      ]);
      setReminder(dane.reminder);
      setLists(listy.lists);
      setBlad(null);
      setNieznalezione(false);
    } catch (e) {
      // 404 to inna sprawa niż awaria: rekord mógł zostać usunięty, a wtedy
      // „spróbuj ponownie" niczego nie naprawi (kat. 6 listy kontrolnej —
      // trzy sytuacje, trzy różne komunikaty).
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

  const patch = useCallback(
    async (rid: string, pola: Record<string, unknown>) => {
      const res = await fetch(`/api/reminders/${rid}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(pola),
      });
      if (!res.ok) {
        toast("Nie udało się zapisać zmiany.", "error");
        return;
      }
      await wczytaj();
    },
    [toast, wczytaj]
  );

  return (
    <div className="mx-auto max-w-xl">
      <Link href={`/${lang}/admin/reminders`} className="text-sm text-muted hover:text-[var(--fg)]">
        ← Wróć do przypomnień
      </Link>
      <div className="mt-3">
        {nieznalezione ? (
          <div className="card-paper rounded-2xl p-8 text-center">
            <p className="text-[13.5px] text-[var(--fg)]">Nie ma takiego przypomnienia</p>
            <p className="mx-auto mt-1 max-w-[42ch] text-[12.5px] text-muted">
              Zostało odhaczone i usunięte albo link jest stary. Lista wyżej pokazuje wszystko, co jeszcze wisi.
            </p>
          </div>
        ) : blad ? (
          <div className="card-paper rounded-2xl">
            <StanBledu blad={blad} onPonow={wczytaj} />
          </div>
        ) : reminder ? (
          <>
            <TrescPrzypomnienia reminder={reminder} lists={lists} onZamknij={null} onPatch={patch} />
            {/* Podzadania widać na LIŚCIE (z wcięciem pod rodzicem), więc na
                podstronie muszą być też — inaczej ten sam rekord miałby dwa
                różne zestawy treści zależnie od drogi wejścia. Modal na liście
                ich nie pokazuje, bo tam stoją linijkę niżej, na widoku. */}
            {reminder.podzadania?.length ? (
              <div className="card-paper mt-3 rounded-2xl p-5">
                <h2 className="mb-2 text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">Podzadania</h2>
                <ul className="space-y-1.5">
                  {reminder.podzadania.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 text-[13px]">
                      <button
                        onClick={() => patch(s.id, { ukonczone: !s.ukonczone })}
                        aria-label={s.ukonczone ? "Cofnij odhaczenie" : "Odhacz"}
                        className={`flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full border ${
                          s.ukonczone ? "border-brand-purple bg-brand-purple" : "border-[var(--hairline)]"
                        }`}
                      />
                      <Link
                        href={`/${lang}/admin/reminders/${s.id}`}
                        className={`min-w-0 flex-1 truncate hover:underline ${
                          s.ukonczone ? "text-muted line-through" : "text-[var(--fg)]"
                        }`}
                      >
                        {s.tytul}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : (
          <div className="h-64 animate-pulse rounded-2xl bg-[var(--plyta)]" />
        )}
      </div>
    </div>
  );
}
