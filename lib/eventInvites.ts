// Zaproszenia na spotkania (2026-07-22, brief 27 pkt 2) — czysta logika bez
// Reacta i bez bazy: typy uczestnika, słownik statusów i PARSOWANIE ODPOWIEDZI
// z pliku .ics, który klient odsyła klikając „Przyjmuję/Odrzucam" w swoim
// kliencie poczty.
//
// Dlaczego pełne METHOD:REQUEST, a nie sam załącznik (decyzja właściciela
// 2026-07-22): klient ma zobaczyć w mailu przyciski odpowiedzi, a panel ma
// wiedzieć, czy ktoś potwierdził. Sam załącznik .ics wpada do kalendarza, ale
// nie mówi NIC z powrotem — a „czy klient potwierdził" to jedyne pytanie,
// które właściciel realnie zadaje dzień przed spotkaniem.
//
// Kanał zwrotny to zwykła poczta: odpowiedź klienta przychodzi jako mail
// z częścią `text/calendar; method=REPLY`, którą łapie sync IMAP
// (lib/mailSync.ts). Żadnego webhooka ani osobnej usługi — skrzynka az.pl,
// którą panel i tak czyta co godzinę.

/** Status uczestnika, w słowniku panelu. Mapowanie na PARTSTAT z RFC 5545
 * niżej — trzymamy WŁASNE nazwy, bo to one lądują w bazie i w UI, a PARTSTAT
 * jest szczegółem formatu. */
export type AttendeeStatus = "oczekuje" | "przyjete" | "wstepnie" | "odrzucone" | "odwolane";

export const ATTENDEE_STATUSES: readonly AttendeeStatus[] = ["oczekuje", "przyjete", "wstepnie", "odrzucone", "odwolane"];

export const ATTENDEE_STATUS_LABEL: Record<AttendeeStatus, string> = {
  oczekuje: "Czeka na odpowiedź",
  przyjete: "Przyjmuje",
  wstepnie: "Może być",
  odrzucone: "Odrzuca",
  // Jedyny status, którego NIE ustawia uczestnik, tylko my. Dlatego nie ma go
  // w mapowaniu PARTSTAT niżej i dlatego odpowiedź, która przyjdzie PO
  // odwołaniu, już go nie nadpisze (patrz applyCalendarReply w lib/mailSync).
  odwolane: "Spotkanie odwołane",
};

/** Klasy koloru — ta sama oś znaczeniowa co statusy w reszcie panelu
 * (patrz „słownik koloru": zielony = potwierdzone, bursztyn = niepewne,
 * szary = brak sygnału). Czerwieni świadomie unikamy dla odmowy: klient,
 * który nie może przyjść, to nie awaria. */
export const ATTENDEE_STATUS_CLASS: Record<AttendeeStatus, string> = {
  oczekuje: "text-muted",
  przyjete: "text-emerald-400",
  wstepnie: "text-brand-gold",
  odrzucone: "text-muted line-through",
  odwolane: "text-muted line-through opacity-70",
};

export type EventAttendee = {
  id: string;
  event_id: string;
  email: string;
  nazwa: string;
  status: AttendeeStatus;
  /** Kiedy poszło do niego zaproszenie (NULL = dopisany, jeszcze nie zaproszony). */
  wyslane_at: string | null;
  /** Kiedy przyszła jego ostatnia odpowiedź. */
  odpowiedz_at: string | null;
  created_at: string;
};

/** PARTSTAT (RFC 5545 §3.2.12) → nasz status. Nieznane wartości
 * (`DELEGATED`, `IN-PROCESS`) świadomie wracają jako `oczekuje`: klient
 * czegoś użył, ale nie powiedział „będę" ani „nie będę". */
export function partstatToStatus(partstat: string): AttendeeStatus {
  switch (partstat.trim().toUpperCase()) {
    case "ACCEPTED":
      return "przyjete";
    case "TENTATIVE":
      return "wstepnie";
    case "DECLINED":
      return "odrzucone";
    default:
      return "oczekuje";
  }
}

/** Odpowiedź jednego uczestnika wyczytana z części `text/calendar`. */
export type CalendarReply = {
  /** UID wydarzenia — u nas `<event.id>@leggeralabs.pl`. */
  uid: string;
  /** Adres uczestnika, małymi literami, bez `mailto:`. */
  email: string;
  status: AttendeeStatus;
};

/**
 * Rozwija złamane linie ICS (RFC 5545 §3.1: kontynuacja zaczyna się od spacji
 * albo tabulatora). Bez tego długi ATTENDEE — a te są długie, bo niosą CN
 * i PARTSTAT — rozjeżdża się na dwie linie i regexp poniżej nic nie znajduje.
 * To jest ta pułapka, przez którą „parser działa u mnie, a nie działa na
 * mailu z Outlooka".
 */
function unfoldICS(raw: string): string[] {
  const out: string[] = [];
  for (const line of raw.replace(/\r\n/g, "\n").split("\n")) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

/**
 * Wyciąga odpowiedź z treści pliku .ics. Zwraca `null`, gdy to nie jest
 * odpowiedź na zaproszenie (`METHOD:REPLY`) — a więc także dla zwykłego
 * zaproszenia przysłanego NAM przez kogoś innego (`METHOD:REQUEST`), którego
 * ten moduł świadomie nie obsługuje: panel jest organizatorem, nie
 * uczestnikiem cudzych spotkań.
 *
 * Bierzemy PIERWSZEGO uczestnika: w odpowiedzi wg RFC jest dokładnie jeden —
 * ten, kto odpowiada. Klienci poczty czasem dokładają ORGANIZER-a, dlatego
 * czytamy wyłącznie linie ATTENDEE.
 */
export function parseCalendarReply(ics: string): CalendarReply | null {
  const lines = unfoldICS(ics);
  if (!lines.some((l) => /^METHOD:\s*REPLY\s*$/i.test(l))) return null;

  const uidLine = lines.find((l) => /^UID:/i.test(l));
  const uid = uidLine ? uidLine.slice(uidLine.indexOf(":") + 1).trim() : "";
  if (!uid) return null;

  const attendeeLine = lines.find((l) => /^ATTENDEE[;:]/i.test(l));
  if (!attendeeLine) return null;

  const mailto = attendeeLine.match(/mailto:([^\s;:,]+)/i);
  if (!mailto) return null;

  const partstat = attendeeLine.match(/PARTSTAT=([A-Z-]+)/i);

  return {
    uid,
    email: mailto[1].trim().toLowerCase(),
    status: partstatToStatus(partstat?.[1] ?? ""),
  };
}

/** Nasz UID → id wydarzenia. Zwraca `null` dla UID-ów spoza panelu (klient
 * może odpowiedzieć na zaproszenie od kogoś zupełnie innego, a my dostaniemy
 * kopię jako DW). */
export function eventIdFromUID(uid: string): string | null {
  const m = uid.trim().match(/^([0-9a-f-]{36})@leggeralabs\.pl$/i);
  return m ? m[1].toLowerCase() : null;
}

/** UID wydarzenia w ICS — JEDNO miejsce, bo musi być identyczny w feedzie
 * subskrypcji (`buildICS`) i w zaproszeniu, inaczej kalendarz właściciela
 * pokazałby to samo spotkanie dwa razy. */
export function icsUID(eventId: string): string {
  return `${eventId}@leggeralabs.pl`;
}
