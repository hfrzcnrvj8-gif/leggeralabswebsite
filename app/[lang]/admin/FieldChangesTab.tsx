"use client";

import { useState } from "react";
import { AUDIT_PREVIEW_CHARS, auditFieldLabel, type AuditEntity, type FieldChange } from "@/lib/audit";

/**
 * Zakładka „Logi zmian" (Moduł 23) — wspólna dla klienta i leada.
 *
 * Odpowiada na „kiedy i z czego na co", a NIE na „kto" — panel jest
 * jednoosobowy, więc kolumny użytkownika świadomie nie ma (patrz lib/audit.ts).
 * Log jest wyłącznie do czytania: to zapis tego, co się stało, więc nie ma tu
 * ani edycji, ani kasowania wpisów.
 */
export function FieldChangesTab({ entity, changes }: { entity: AuditEntity; changes: FieldChange[] }) {
  if (changes.length === 0) {
    return (
      <div className="mt-6">
        <p className="text-sm text-muted opacity-60">
          Brak zmian do pokazania — log zapisuje każdą edycję pola od teraz.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <p className="mb-4 text-[12px] text-muted opacity-70">
        Każda zmiana pola — kiedy i z czego na co. Log jest tylko do odczytu.
      </p>
      {groupByDay(changes).map((group) => (
        <div key={group.label} className="mb-4 last:mb-0">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted opacity-60">{group.label}</div>
          <ul className="space-y-2">
            {group.items.map((c) => (
              <ChangeRow key={c.id} entity={entity} change={c} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ChangeRow({ entity, change }: { entity: AuditEntity; change: FieldChange }) {
  const [expanded, setExpanded] = useState(false);
  const oldValue = change.old_value ?? "";
  const newValue = change.new_value ?? "";
  // Decyzja właściciela 2026-07-17: długie pola (notatka) pokazują skrót, a
  // pełną treść rozwija się klikiem — inaczej jedna zmiana notatki zajmuje pół
  // ekranu i spycha resztę logu w dół.
  const isLong = oldValue.length > AUDIT_PREVIEW_CHARS || newValue.length > AUDIT_PREVIEW_CHARS;
  const show = (v: string) => (expanded || !isLong ? v : truncate(v));

  return (
    <li className="rounded-xl border hairline p-3 text-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-medium">{auditFieldLabel(entity, change.field)}</span>
        <span className="shrink-0 text-[11px] text-muted">{formatTime(change.created_at)}</span>
      </div>
      <div className="flex flex-wrap items-baseline gap-2 text-[13px]">
        <ValueChip value={show(oldValue)} muted />
        <span className="text-muted" aria-hidden>
          →
        </span>
        <ValueChip value={show(newValue)} />
      </div>
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 text-[11px] text-muted hover:text-[var(--fg)]"
        >
          {expanded ? "Zwiń" : "Pokaż całość"}
        </button>
      )}
    </li>
  );
}

/** Pusta wartość dostaje kursywne „(puste)" zamiast znikać — inaczej
 * wyczyszczenie pola wyglądałoby na uszkodzony wpis. */
function ValueChip({ value, muted = false }: { value: string; muted?: boolean }) {
  if (!value) {
    return <span className="italic text-muted opacity-60">(puste)</span>;
  }
  return (
    <span
      className={`whitespace-pre-wrap rounded-lg bg-[var(--hairline)]/50 px-1.5 py-0.5 ${
        muted ? "text-muted line-through opacity-70" : "text-[var(--fg)]"
      }`}
    >
      {value}
    </span>
  );
}

function truncate(v: string): string {
  return v.length > AUDIT_PREVIEW_CHARS ? `${v.slice(0, AUDIT_PREVIEW_CHARS)}…` : v;
}

/** „Dziś"/„Wczoraj"/data — kosmetyczne grupowanie osi, jak w historii kontaktu
 * (ClientDetailPanel). Nie steruje żadną regułą biznesową, więc świadomie bez
 * todayLocalISO(). */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Dziś";
  if (sameDay(d, yesterday)) return "Wczoraj";
  return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function groupByDay(items: FieldChange[]): { label: string; items: FieldChange[] }[] {
  const groups: { label: string; items: FieldChange[] }[] = [];
  for (const item of items) {
    const label = dayLabel(item.created_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}
