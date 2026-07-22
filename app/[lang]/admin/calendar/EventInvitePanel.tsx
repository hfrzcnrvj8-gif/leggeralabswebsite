"use client";

// Zaproszenia na spotkanie (2026-07-22, brief 27 pkt 2) — jedno okno, dwa
// widoki: KTO JUŻ WIE (lista uczestników z odpowiedziami) i KOGO ZAPROSIĆ
// (kompozytor maila). Świadomie w jednym modalu: „czy Kowalski potwierdził"
// i „przypomnę mu jeszcze raz" to jedna myśl, a nie dwa miejsca w panelu.
//
// Uczestnicy powstają dopiero przy wysyłce (patrz POST /api/events/:id/invite)
// — dlatego to okno na pustym wydarzeniu pokazuje po prostu formularz, bez
// pustej listy udającej, że coś się dzieje.

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { SPRING } from "@/lib/motion";
import { IconCalendarCheck, IconCalendarX, IconTrash } from "@tabler/icons-react";
import type { HubEvent } from "@/lib/events";
import { formatPlDate } from "@/lib/projects";
import {
  ATTENDEE_STATUS_CLASS,
  ATTENDEE_STATUS_LABEL,
  type AttendeeStatus,
  type EventAttendee,
} from "@/lib/eventInvites";
import { MailComposeForm } from "../mail/MailComposeForm";
import { useUI } from "../ui";

/** Domyślna treść zaproszenia — właściciel ma ją DOPISAĆ, nie napisać od zera
 * (decyzja 2026-07-22: wysyłka przez kompozytor właśnie po to, żeby dało się
 * dorzucić zdanie od siebie). Bez podpisu: dokłada go serwer, tak jak w
 * każdym innym mailu z panelu. */
function inviteText(event: HubEvent): string {
  const kiedy = event.godzina
    ? `${formatPlDate(event.data)}, godz. ${event.godzina}`
    : formatPlDate(event.data);
  return [
    "Dzień dobry,",
    "",
    `potwierdzam nasze spotkanie: ${event.tytul}.`,
    `Termin: ${kiedy}.`,
    ...(event.lokalizacja ? [`Miejsce: ${event.lokalizacja}.`] : []),
    "",
    "Do wiadomości dołączam zaproszenie — jednym kliknięciem („Przyjmuję”) wpiszesz spotkanie do swojego kalendarza i dasz mi znać, że termin pasuje.",
  ].join("\n");
}

/** Domyślna treść odwołania. Bez podawania powodu i bez propozycji nowego
 * terminu — jedno i drugie jest decyzją właściciela, a wpisane za niego
 * brzmiałoby jak obietnica, której nie składał. */
function cancelText(event: HubEvent): string {
  const kiedy = event.godzina
    ? `${formatPlDate(event.data)}, godz. ${event.godzina}`
    : formatPlDate(event.data);
  return [
    "Dzień dobry,",
    "",
    `muszę odwołać nasze spotkanie: ${event.tytul} (${kiedy}).`,
    "",
    "Ta wiadomość usunie je również z Twojego kalendarza. Przepraszam za zamieszanie.",
  ].join("\n");
}

export function EventInvitePanel({
  event,
  defaultEmail,
  onClose,
  onSent,
}: {
  event: HubEvent;
  /** Adres klienta/leada powiązanego z wydarzeniem — wpisany od razu w „Do",
   * żeby najczęstszy przypadek był zerem kliknięć. */
  defaultEmail: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const { confirm, toast } = useUI();
  const [attendees, setAttendees] = useState<EventAttendee[] | null>(null);
  /** null = lista uczestników; dalej to dwa tryby TEGO SAMEGO kompozytora. */
  const [composing, setComposing] = useState<"invite" | "cancel" | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/events/${event.id}/attendees`);
    if (!res.ok) {
      setAttendees([]);
      return;
    }
    const data = await res.json().catch(() => null);
    setAttendees(Array.isArray(data?.attendees) ? data.attendees : []);
  }, [event.id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Puste wydarzenie → od razu kompozytor (patrz komentarz na górze pliku).
  useEffect(() => {
    if (attendees && attendees.length === 0) setComposing("invite");
  }, [attendees]);

  const remove = async (a: EventAttendee) => {
    if (!(await confirm(`Usunąć ${a.email} z listy zaproszonych? Jego kalendarz nic o tym nie dowie się — to porządek w panelu, nie odwołanie spotkania.`))) return;
    const res = await fetch(`/api/events/${event.id}/attendees?email=${encodeURIComponent(a.email)}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Nie udało się usunąć uczestnika.", "error");
      return;
    }
    await load();
    onSent();
  };

  if (composing) {
    const zaproszeni = (attendees ?? []).map((a) => a.email).join(", ");
    const odwolanie = composing === "cancel";
    return (
      <MailComposeForm
        mode={odwolanie ? "cancel" : "invite"}
        endpoint={`/api/events/${event.id}/${odwolanie ? "cancel-invite" : "invite"}`}
        initialTo={zaproszeni || defaultEmail}
        initialSubject={`${odwolanie ? "Odwołane" : "Zaproszenie"}: ${event.tytul}`}
        initialText={odwolanie ? cancelText(event) : inviteText(event)}
        hint={
          odwolanie
            ? "Do wiadomości dołączymy odwołanie kalendarzowe — spotkanie zniknie z kalendarza odbiorcy. Samo wydarzenie zostaje w panelu."
            : "Do wiadomości dołączymy zaproszenie kalendarzowe — odbiorca zobaczy przyciski „Przyjmuję / Może / Odrzucam”, a jego odpowiedź wróci tutaj."
        }
        onSent={async () => {
          await load();
          onSent();
        }}
        onClose={onClose}
      />
    );
  }

  // Odwoływać jest co komu tylko wtedy, gdy ktoś ma to spotkanie u siebie.
  const doOdwolania = (attendees ?? []).some((a) => a.status !== "odwolane");

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 8, transition: { duration: 0.15 } }}
      transition={SPRING}
      className="card-paper w-full overflow-hidden rounded-2xl border hairline"
    >
      <div className="flex items-center justify-between border-b hairline px-6 py-4">
        <div>
          <h2 className="text-lg font-medium">Zaproszeni na spotkanie</h2>
          <p className="mt-0.5 text-[12px] text-muted">
            {event.tytul} · {formatPlDate(event.data)}
            {event.godzina ? `, godz. ${event.godzina}` : ""}
          </p>
        </div>
        <button onClick={onClose} className="rounded-full px-2 py-0.5 text-lg leading-none text-muted hover:text-[var(--fg)]" aria-label="Zamknij">
          ×
        </button>
      </div>

      <ul className="divide-y hairline px-6">
        {(attendees ?? []).map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-[13px]">{a.nazwa || a.email}</p>
              {a.nazwa && <p className="truncate text-[11px] text-muted">{a.email}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className={`text-[12px] ${ATTENDEE_STATUS_CLASS[a.status as AttendeeStatus] ?? "text-muted"}`}>
                {ATTENDEE_STATUS_LABEL[a.status as AttendeeStatus] ?? a.status}
              </span>
              <button onClick={() => remove(a)} className="text-muted hover:text-[var(--fg)]" aria-label={`Usuń ${a.email}`} title="Usuń z listy">
                <IconTrash size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-3 border-t hairline px-6 py-4">
        <p className="text-[11px] text-muted opacity-70">
          Odpowiedzi wracają mailem — panel odnotuje je przy najbliższym pobraniu poczty.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {doOdwolania && (
            <button
              onClick={() => setComposing("cancel")}
              className="rounded-full border hairline px-3 py-1.5 text-[13px] text-muted hover:text-[var(--fg)]"
              title="Wyślij odwołanie — spotkanie zniknie z kalendarzy zaproszonych"
            >
              <IconCalendarX size={14} className="mr-1.5 inline align-[-2px]" />
              Odwołaj spotkanie
            </button>
          )}
          <button onClick={() => setComposing("invite")} className="btn-primary rounded-full px-4 py-1.5 text-[13px]">
            <IconCalendarCheck size={14} className="mr-1.5 inline align-[-2px]" />
            Wyślij ponownie
          </button>
        </div>
      </div>
    </motion.div>
  );
}
