"use client";

import { Modal } from "../Modal";
import { DateField } from "../DatePicker";
import { LinkPicker, type LinkValue } from "../LinkPicker";
import { EditableText, EditableTextarea } from "../components";
import { CyklPicker } from "../CyklPicker";
import { PRIORITY_LABEL, KropkaListy, type Reminder, type ReminderList } from "./shared";

/** Profil przypomnienia jako WYŚRODKOWANY MODAL — obowiązujący wzorzec profilu
 * rekordu w tym panelu (CLAUDE.md: nie wysuwany panel z prawej). Węższy niż
 * Leady/Klienci, bo treść to kilka pól, a nie dane + adres + log + mapa
 * procesu. */
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
    <Modal open onClose={onClose} card="my-auto w-full max-w-xl">
      <div className="card-paper max-h-[85vh] overflow-y-auto rounded-2xl p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <EditableText value={r.tytul} onSave={(v) => v.trim() && onPatch(r.id, { tytul: v.trim() })} />
          </div>
          <button onClick={onClose} aria-label="Zamknij" className="shrink-0 text-muted hover:text-[var(--fg)]">
            ✕
          </button>
        </div>

        <Pole etykieta="Notatka">
          <EditableTextarea value={r.notatka} onSave={(v) => onPatch(r.id, { notatka: v })} />
        </Pole>

        <Pole etykieta="Termin">
          <div className="flex flex-wrap items-center gap-2">
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
                  className="text-[11.5px] text-muted hover:text-[var(--fg)]"
                >
                  bez terminu
                </button>
              </>
            )}
          </div>
          {!r.termin && (
            <p className="mt-1 text-[11.5px] text-muted">
              Przypomnienie bez terminu jest w porządku — nie liczy się jako zaległość.
            </p>
          )}
        </Pole>

        {/* Powtarzanie tylko przy terminie i tylko na pozycji najwyższego
            poziomu — cykl odmierza się OD terminu, a powtarza się całe
            zadanie, nie krok w jego środku (patrz `lib/db.ts`, migracja
            przypomnień). Serwer pilnuje tego samego warunku; tu chodzi o to,
            żeby pole nie kusiło tam, gdzie i tak nic nie zapisze. */}
        {r.termin && !r.parent_id && (
          <Pole etykieta="Powtarzanie">
            <CyklPicker
              cykl={r.powtarzanie}
              doDnia={r.powtarzanie_do ?? ""}
              odDnia={r.termin}
              onChange={(next) =>
                onPatch(r.id, { powtarzanie: next.cykl, powtarzanie_do: next.doDnia || null })
              }
            />
            {r.powtarzanie && (
              <p className="mt-1 text-[11.5px] text-muted">
                Odhaczenie zamyka to wystąpienie — termin przeskoczy na kolejny cykl, zadanie zostanie na liście.
              </p>
            )}
          </Pole>
        )}

        <Pole etykieta="Priorytet">
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
        </Pole>

        <Pole etykieta="Lista">
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
        </Pole>

        <Pole etykieta="Powiązanie">
          <LinkPicker
            kinds={["client", "lead", "project"]}
            value={powiazanie}
            onPick={(next) => onPatch(r.id, next)}
          />
        </Pole>

        {r.ukonczone && r.ukonczone_at && (
          <p className="mt-3 text-[11.5px] text-muted">Odhaczone {r.ukonczone_at.slice(0, 16).replace("T", ", ")}</p>
        )}
      </div>
    </Modal>
  );
}

function Pole({ etykieta, children }: { etykieta: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1 text-[11px] uppercase tracking-wide text-muted">{etykieta}</div>
      {children}
    </div>
  );
}
