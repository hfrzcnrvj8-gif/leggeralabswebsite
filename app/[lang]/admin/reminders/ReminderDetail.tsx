"use client";

import { Modal } from "../Modal";
import { DateField } from "../DatePicker";
import { LinkPicker, type LinkValue } from "../LinkPicker";
import { EditableText, EditableTextarea } from "../components";
import { CyklPicker } from "../CyklPicker";
import { SekcjaProfilu, WierszPola, WierszUwaga } from "../ProfileSection";
import { PRIORITY_LABEL, KropkaListy, type Reminder, type ReminderList } from "./shared";

/** Profil przypomnienia jako WYŚRODKOWANY MODAL — obowiązujący wzorzec profilu
 * rekordu w tym panelu (CLAUDE.md: nie wysuwany panel z prawej). Węższy niż
 * Leady/Klienci, bo treść to kilka pól, a nie dane + adres + log + mapa
 * procesu.
 *
 * Pola idą przez `SekcjaProfilu`/`WierszPola` (Moduł 59, paczka F) — wcześniej
 * ten plik miał WŁASNY komponent `Pole` z etykietą NAD wartością, czyli piąty
 * układ tego samego wiersza w panelu. Etykieta po lewej daje pionową krawędź,
 * po której oko skanuje w dół; powód i pomiary: `../ProfileSection.tsx`. */
export function ReminderDetail({
  reminder,
  lists,
  onClose,
  onPatch,
}: {
  reminder: Reminder | null;
  lists: ReminderList[];
  onClose: () => void;
  onPatch: (id: string, pola: Record<string, unknown>) => void | Promise<void>;
}) {
  if (!reminder) return null;
  return (
    <Modal open onClose={onClose} card="my-auto w-full max-w-xl">
      <TrescPrzypomnienia reminder={reminder} lists={lists} onZamknij={onClose} onPatch={onPatch} />
    </Modal>
  );
}

/** Sama treść profilu, bez okna — żeby podstrona `/admin/reminders/<id>`
 * (ADRES REKORDU, paczka E) renderowała DOKŁADNIE ten sam profil, co modal,
 * a nie własną kopię, która z czasem się rozjedzie. Ta sama zasada, co
 * w Notatniku i Projektach. */
export function TrescPrzypomnienia({
  reminder,
  lists,
  onZamknij,
  onPatch,
}: {
  reminder: Reminder;
  lists: ReminderList[];
  /** `null` = brak przycisku zamykania (podstrona wychodzi linkiem „wróć"). */
  onZamknij: (() => void) | null;
  onPatch: (id: string, pola: Record<string, unknown>) => void | Promise<void>;
}) {
  const r = reminder;

  // Powiązania są WZAJEMNIE WYŁĄCZNE — dokładnie ta sama zasada, co
  // w notatkach i wydarzeniach; `LinkPicker` sam ją stosuje i oddaje gotowy
  // komplet kolumn do wysłania.
  const powiazanie: LinkValue = {
    client_id: r.client_id,
    lead_id: r.lead_id,
    project_id: r.project_id,
  };

  return (
      <div className="card-paper max-h-[85vh] overflow-y-auto rounded-2xl p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <EditableText value={r.tytul} onSave={(v) => v.trim() && onPatch(r.id, { tytul: v.trim() })} />
          </div>
          {onZamknij && (
            <button onClick={onZamknij} aria-label="Zamknij" className="shrink-0 text-muted hover:text-[var(--fg)]">
              ✕
            </button>
          )}
        </div>

        <div className="space-y-4">
          <SekcjaProfilu tytul="Termin">
            <WierszPola etykieta="Termin">
              {/* Data przez wspólny `DatePicker`, nie surowy `<input type="date">`
                  — pułapka z niepełnym rokiem („0202") jest tam już rozwiązana
                  (CLAUDE.md). */}
              <DateField
                value={r.termin ?? ""}
                onChange={(v) => onPatch(r.id, { termin: v || null })}
              />
              {r.termin && (
                <>
                  <input
                    type="time"
                    value={r.godzina ?? ""}
                    onChange={(e) => onPatch(r.id, { godzina: e.target.value || null })}
                    className="rounded-lg border border-[var(--hairline)] bg-transparent px-2 py-1 text-[12.5px] text-[var(--fg)]"
                  />
                  <button
                    onClick={() => onPatch(r.id, { termin: null })}
                    className="shrink-0 text-[11.5px] text-muted hover:text-[var(--fg)]"
                  >
                    bez terminu
                  </button>
                </>
              )}
            </WierszPola>

            {/* Powtarzanie tylko przy terminie i tylko na pozycji najwyższego
                poziomu — cykl odmierza się OD terminu, a powtarza się całe
                zadanie, nie krok w jego środku (patrz `lib/db.ts`, migracja
                przypomnień). Serwer pilnuje tego samego warunku; tu chodzi o to,
                żeby pole nie kusiło tam, gdzie i tak nic nie zapisze. */}
            {r.termin && !r.parent_id && (
              <WierszPola etykieta="Powtarzanie">
                <CyklPicker
            wlasnaEtykieta={false}
                  cykl={r.powtarzanie}
                  doDnia={r.powtarzanie_do ?? ""}
                  odDnia={r.termin}
                  onChange={(next) =>
                    onPatch(r.id, { powtarzanie: next.cykl, powtarzanie_do: next.doDnia || null })
                  }
                />
              </WierszPola>
            )}

            {/* Wyjaśnienia stoją WŁASNYM wierszem sekcji, a nie pod wartością:
                `WierszPola` ma stałą wysokość i druga linijka w środku łamie
                rytm, o który w tym układzie chodzi (patrz `ProfileSection.tsx`,
                punkt 1 — wiersze skaczące o 70 px czytają się jak krzywy stół). */}
            {!r.termin && (
              <WierszUwaga>Przypomnienie bez terminu jest w porządku — nie liczy się jako zaległość.</WierszUwaga>
            )}
            {r.termin && !r.parent_id && r.powtarzanie && (
              <WierszUwaga>
                Odhaczenie zamyka to wystąpienie — termin przeskoczy na kolejny cykl, zadanie zostanie na liście.
              </WierszUwaga>
            )}
          </SekcjaProfilu>

          <SekcjaProfilu tytul="Porządek">
            <WierszPola etykieta="Priorytet">
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((p) => (
                  <button
                    key={p}
                    onClick={() => onPatch(r.id, { priorytet: p })}
                    className={`rounded-full px-2.5 py-1 text-[11.5px] transition-colors ${
                      r.priorytet === p
                        ? "bg-brand-gold/20 text-brand-gold"
                        : "text-muted hover:text-[var(--fg)]"
                    }`}
                  >
                    {PRIORITY_LABEL[p]}
                  </button>
                ))}
              </div>
            </WierszPola>

            <WierszPola etykieta="Lista">
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => onPatch(r.id, { lista_id: null })}
                  className={`rounded-full px-2.5 py-1 text-[11.5px] ${
                    r.lista_id ? "text-muted hover:text-[var(--fg)]" : "bg-[var(--hairline)] text-[var(--fg)]"
                  }`}
                >
                  Bez listy
                </button>
                {lists.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => onPatch(r.id, { lista_id: l.id })}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] ${
                      r.lista_id === l.id ? "bg-[var(--hairline)] text-[var(--fg)]" : "text-muted hover:text-[var(--fg)]"
                    }`}
                  >
                    <KropkaListy kolor={l.kolor} />
                    {l.nazwa}
                  </button>
                ))}
              </div>
            </WierszPola>

            <WierszPola etykieta="Powiązanie">
              <LinkPicker
                kinds={["client", "lead", "project"]}
                value={powiazanie}
                onPick={(next) => onPatch(r.id, next)}
              />
            </WierszPola>
          </SekcjaProfilu>

          {/* Notatka ma własną sekcję bez wierszy — treść wielolinijkowa nie
              wchodzi do wiersza o stałej wysokości. */}
          <SekcjaProfilu tytul="Notatka" wiersze={false}>
            <EditableTextarea value={r.notatka} onSave={(v) => onPatch(r.id, { notatka: v })} />
          </SekcjaProfilu>
        </div>

        {r.ukonczone && r.ukonczone_at && (
          <p className="mt-4 text-[11.5px] text-muted">Odhaczone {r.ukonczone_at.slice(0, 16).replace("T", ", ")}</p>
        )}
      </div>
  );
}

