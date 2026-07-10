"use client";

import { useEffect, useRef, useState } from "react";

// Typy i czysta logika (bez React) mieszkają w lib/leads.ts, żeby mogły być
// re-używane też przez serwerowy route wysyłający dzienny raport mailowy —
// tu tylko re-eksportujemy je dla wygody istniejących importów.
export {
  type Lead,
  type Activity,
  type SeedLead,
  STATUSES,
  STATUS_CLASS,
  STATUS_DOT,
  SEED,
  daysSince,
  isOverdue,
  overdueReason,
} from "@/lib/leads";

import { STATUSES, STATUS_CLASS } from "@/lib/leads";

/**
 * Klikalna "pigułka" statusu — jeden element wizualny pełniący rolę tagu
 * i selektora naraz (styl Linear). Używana w tabeli, na kartach kanban i
 * na podstronie leada, żeby zmiana statusu nie wymagała przeciągania.
 */
export function StatusTag({
  status,
  onChange,
  className = "",
}: {
  status: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <select
      value={status}
      onChange={(e) => onChange(e.target.value)}
      className={`cursor-pointer appearance-none rounded-full border-none px-2.5 py-1 text-[11px] font-medium outline-none ${STATUS_CLASS[status] ?? ""} ${className}`}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s} className="bg-[var(--bg-soft)] text-[var(--fg)]">
          {s}
        </option>
      ))}
    </select>
  );
}

export function SummaryCard({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div
      className={`card-paper min-w-[110px] rounded-2xl px-4 py-3 ${
        alert ? "border-red-500/30 bg-red-500/[0.04]" : ""
      }`}
    >
      <div className={`text-xl font-bold ${alert ? "text-red-400" : ""}`}>{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}

export function EditableText({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      value={v}
      title={value || undefined}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v !== value) onSave(v);
      }}
      className="w-full min-w-[6ch] rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-xs text-[var(--fg)] transition-colors hover:border-[var(--hairline)] focus:border-brand-cyan/60 focus:outline-none"
    />
  );
}

// Rośnie razem z treścią (zamiast sztywnych 2 wierszy), więc dłuższe
// notatki nie są wizualnie ucinane w tabeli/podstronie — cały tekst zawsze
// widać, bez przewijania w ukrytym, niewidocznym scrollu.
export function EditableTextarea({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setV(value), [value]);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  useEffect(() => {
    resize();
  }, [v]);

  return (
    <textarea
      ref={ref}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v !== value) onSave(v);
      }}
      rows={1}
      className="block w-full resize-none overflow-hidden whitespace-pre-wrap break-words rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-xs text-[var(--fg)] transition-colors hover:border-[var(--hairline)] focus:border-brand-cyan/60 focus:outline-none"
    />
  );
}
