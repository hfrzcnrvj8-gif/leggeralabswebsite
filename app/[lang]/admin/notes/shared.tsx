"use client";

// Notatnik — warstwa wspólna UI (wzorzec z CLAUDE.md: `lib/<moduł>.ts` czyste,
// `shared.tsx` to re-export + komponenty/hooki specyficzne dla UI).
//
// Notatnik dostał ten plik dopiero w Module 26, bo dopiero teraz ma DWA
// miejsca renderujące tę samą notatkę: kartę na liście i profil (modal +
// podstrona `[id]`). Akcje żyją tu, żeby oba wołały jedno zachowanie — inaczej
// „archiwizuj" z karty i „archiwizuj" z profilu byłyby dwiema implementacjami,
// które z czasem się rozjadą.

import Link from "next/link";
import { IconCalendar, IconCalendarPlus, IconFolder } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { Locale } from "@/i18n/config";
import { formatPlDate, isPlausibleDateString } from "@/lib/projects";
import { todayLocalISO } from "@/lib/dates";
import { type Note, parseTags } from "@/lib/notes";
import { useUI } from "../ui";

export { parseTags, matchesTab, noteLinkValue, NOTE_TABS } from "@/lib/notes";
export type { Note, NoteActivity, NoteTab } from "@/lib/notes";

/** Akcje notatki. `onChanged` woła się po każdej udanej zmianie — wołający
 * decyduje, czy przeładować listę, czy pojedynczy rekord. */
export function useNoteActions(onChanged: () => void) {
  const { toast, confirm } = useUI();
  const router = useRouter();

  const patch = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      const res = await fetch(`/api/notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast("Nie udało się zapisać zmiany.", "error");
        return false;
      }
      onChanged();
      return true;
    },
    [onChanged, toast]
  );

  const togglePin = useCallback(
    (note: Note) => patch(note.id, { pinned: !note.pinned }),
    [patch]
  );

  const setArchived = useCallback(
    async (note: Note, archived: boolean) => {
      const ok = await patch(note.id, { archived });
      if (ok) toast(archived ? "Notatka w archiwum." : "Notatka wróciła na biurko.");
      return ok;
    },
    [patch, toast]
  );

  /** Trwałe usunięcie — świadomie dostępne tylko z zakładki Archiwum
   * (decyzja właściciela 2026-07-17: archiwum główne, usuwanie w tle). */
  const remove = useCallback(
    async (note: Note) => {
      const ok = await confirm("Usunąć tę notatkę bezpowrotnie? Tej operacji nie da się cofnąć.", {
        danger: true,
      });
      if (!ok) return false;
      const res = await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast("Nie udało się usunąć.", "error");
        return false;
      }
      onChanged();
      toast("Notatka usunięta.");
      return true;
    },
    [confirm, onChanged, toast]
  );

  /** „Przekuj w projekt". Serwer pilnuje, żeby nie powstał drugi projekt —
   * `existing: true` znaczy „już było", więc tylko otwieramy istniejący. */
  const promote = useCallback(
    async (note: Note, lang: Locale) => {
      const res = await fetch(`/api/notes/${note.id}/promote`, { method: "POST" });
      if (!res.ok) {
        toast("Nie udało się utworzyć projektu.", "error");
        return;
      }
      const data = (await res.json()) as { id: string; existing: boolean };
      onChanged();
      toast(data.existing ? "Ta notatka ma już projekt — otwieram go." : "Przekuto w projekt.");
      router.push(`/${lang}/admin/projects/${data.id}`);
    },
    [onChanged, router, toast]
  );

  /** „Do kalendarza". Data waliduje się też na serwerze (pułapka
   * `<input type="date">` z niepełnym rokiem — CLAUDE.md). */
  const schedule = useCallback(
    async (note: Note, data: string, godzina: string) => {
      const res = await fetch(`/api/notes/${note.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, godzina }),
      });
      if (!res.ok) {
        toast("Nie udało się utworzyć wydarzenia. Sprawdź datę.", "error");
        return false;
      }
      const out = (await res.json()) as { existing: boolean };
      onChanged();
      toast(out.existing ? "Ta notatka jest już w kalendarzu." : "Dodano do kalendarza.");
      return true;
    },
    [onChanged, toast]
  );

  return { patch, togglePin, setArchived, remove, promote, schedule };
}

/** Plakietki „przekuto w…" — klikalny ślad po projekcie i wydarzeniu.
 * Widoczne tylko, gdy coś powstało; dla świeżej notatki nie ma tu nic. */
export function NoteBadges({ note, lang }: { note: Note; lang: Locale }) {
  if (!note.project_id && !note.event_id) return null;
  const cls =
    "inline-flex items-center gap-1 rounded-full border hairline px-2 py-0.5 text-[10.5px] text-muted transition-colors hover:text-[var(--fg)]";
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {note.project_id && (
        <Link href={`/${lang}/admin/projects/${note.project_id}`} className={cls}>
          <IconFolder size={12} /> <span className="max-w-[16ch] truncate">{note.project_tytul || "Projekt"}</span>
        </Link>
      )}
      {note.event_id && (
        <Link href={`/${lang}/admin/calendar`} className={cls}>
          <IconCalendar size={12} /> {note.event_data ? formatPlDate(note.event_data) : "W kalendarzu"}
        </Link>
      )}
    </div>
  );
}

/**
 * „Do kalendarza" — przycisk, który rozwija się w mały formularz data +
 * godzina (decyzja właściciela 2026-07-17: zostajemy w Notatniku, bez skoku
 * do Kalendarza). Gdy wydarzenie już istnieje, formularza nie ma — jest tylko
 * plakietka w NoteBadges, bo drugiego wydarzenia i tak nie da się utworzyć.
 *
 * Godzina jest opcjonalna: pusta = wydarzenie całodniowe, dokładnie jak w
 * Kalendarzu (`events.godzina` NULL).
 */
export function NoteScheduleForm({
  note,
  onSchedule,
}: {
  note: Note;
  onSchedule: (data: string, godzina: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(todayLocalISO());
  const [godzina, setGodzina] = useState("");
  const [saving, setSaving] = useState(false);

  if (note.event_id) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border hairline px-2.5 py-1 text-[11px] text-muted transition-colors hover:text-[var(--fg)]"
      >
        <IconCalendarPlus size={12} className="mr-1 inline align-[-2px]" />Do kalendarza
      </button>
    );
  }

  const submit = async () => {
    // Ta sama walidacja co na serwerze — `<input type="date">` potrafi oddać
    // rok „0202", gdy pole straci fokus w trakcie wpisywania (CLAUDE.md).
    if (!isPlausibleDateString(data)) return;
    setSaving(true);
    const ok = await onSchedule(data, godzina);
    setSaving(false);
    if (ok) setOpen(false);
  };

  return (
    <div className="flex w-full flex-wrap items-center gap-1.5">
      <input
        type="date"
        value={data}
        onChange={(e) => setData(e.target.value)}
        className="rounded-md border hairline bg-transparent px-1.5 py-1 text-[11px] text-[var(--fg)]"
      />
      <input
        type="time"
        value={godzina}
        onChange={(e) => setGodzina(e.target.value)}
        title="Godzina — opcjonalna, pusta = wydarzenie całodniowe"
        className="rounded-md border hairline bg-transparent px-1.5 py-1 text-[11px] text-[var(--fg)]"
      />
      <button
        onClick={submit}
        disabled={saving || !isPlausibleDateString(data)}
        className="rounded-md border hairline px-2 py-1 text-[11px] text-[var(--fg)] disabled:opacity-50"
      >
        {saving ? "…" : "Dodaj"}
      </button>
      <button
        onClick={() => setOpen(false)}
        className="rounded-md px-1.5 py-1 text-[11px] text-muted hover:text-[var(--fg)]"
      >
        Anuluj
      </button>
    </div>
  );
}

/** Tekst, po którym filtruje wyszukiwarka: tytuł + treść + tagi + log.
 * Przed Modułem 26 były to tylko tytuł i treść. */
export function noteHaystack(note: Note): string {
  return `${note.tytul} ${note.tresc} ${parseTags(note.tagi).join(" ")} ${note.log_text ?? ""}`.toLowerCase();
}
