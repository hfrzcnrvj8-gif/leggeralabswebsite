"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useUI } from "./ui";

// Generyczne komponenty UI współdzielone przez wszystkie moduły panelu
// (leady, projekty, notatnik, kalendarz) — jedno miejsce zamiast kopiowania
// tych samych "edytowalnych" pól i pigułek statusu w każdym module osobno.

/** Liczba, która "dolicza się" do nowej wartości zamiast skakać —
 * drobny, ale bardzo charakterystyczny dla Linear szczegół. */
function AnimatedNumber({ value }: { value: number }) {
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 120, damping: 20 });
  const rounded = useTransform(spring, (v) => Math.round(v).toString());
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    motionVal.set(value);
  }, [value, motionVal]);

  useEffect(() => rounded.on("change", (v) => setDisplay(v)), [rounded]);

  return <motion.span>{display}</motion.span>;
}

export function SummaryCard({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <motion.div
      layout
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 26 }}
      className={`card-paper min-w-[110px] rounded-2xl px-4 py-3 ${
        alert ? "border-red-500/30 bg-red-500/[0.04]" : ""
      }`}
    >
      <div className={`text-xl font-bold ${alert ? "text-red-400" : ""}`}>
        <AnimatedNumber value={value} />
      </div>
      <div className="text-[11px] text-muted">{label}</div>
    </motion.div>
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
      className="w-full min-w-[6ch] rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-xs text-[var(--fg)] transition-colors hover:border-[var(--hairline)] focus:border-[#4ea7fc]/60 focus:outline-none"
    />
  );
}

// Rośnie razem z treścią zamiast ucinać długi tekst w sztywnej wysokości.
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
      className="block w-full resize-none overflow-hidden whitespace-pre-wrap break-words rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-xs text-[var(--fg)] transition-colors hover:border-[var(--hairline)] focus:border-[#4ea7fc]/60 focus:outline-none"
    />
  );
}

/** Klikalna "pigułka" statusu — tag i selektor naraz (styl Linear). Generyczna
 * wersja parametryzowana listą opcji i mapą klas, żeby leady i projekty mogły
 * współdzielić ten sam wygląd bez współdzielenia listy statusów. */
export function StatusPill({
  value,
  options,
  classMap,
  onChange,
  className = "",
}: {
  value: string;
  options: readonly string[];
  classMap: Record<string, string>;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`cursor-pointer appearance-none rounded-full border-none px-2.5 py-1 text-[11px] font-medium outline-none ${classMap[value] ?? ""} ${className}`}
    >
      {options.map((s) => (
        <option key={s} value={s} className="bg-[var(--bg-soft)] text-[var(--fg)]">
          {s}
        </option>
      ))}
    </select>
  );
}

type SavedView = { id: string; name: string; filters: Record<string, string> };

/** Nazwane, zapisane kombinacje filtrów (np. "Leady gorące", "Projekty
 * zagrożone") — coś więcej niż jeden zapamiętany ostatni filtr. Trzymane w
 * localStorage per moduł (przekazany storageKey), świadomie bez tabeli w
 * bazie — to lokalna wygoda, nie dane biznesowe do synchronizacji. */
export function SavedViews({
  storageKey,
  currentFilters,
  onApply,
}: {
  storageKey: string;
  currentFilters: Record<string, string>;
  onApply: (filters: Record<string, string>) => void;
}) {
  const { prompt, confirm, toast } = useUI();
  const [views, setViews] = useState<SavedView[]>([]);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      try {
        setViews(JSON.parse(saved));
      } catch {
        // ignoruj uszkodzony zapis
      }
    }
  }, [storageKey]);

  const persist = (next: SavedView[]) => {
    setViews(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const saveCurrent = async () => {
    const hasFilters = Object.values(currentFilters).some(Boolean);
    if (!hasFilters) {
      toast("Ustaw najpierw jakiś filtr, żeby było co zapisać.", "error");
      return;
    }
    const name = await prompt("Nazwa widoku:", { placeholder: "np. Leady gorące" });
    if (!name) return;
    persist([...views, { id: crypto.randomUUID(), name, filters: currentFilters }]);
  };

  const removeView = async (id: string, name: string) => {
    const ok = await confirm(`Usunąć widok "${name}"?`, { danger: true });
    if (!ok) return;
    persist(views.filter((v) => v.id !== id));
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {views.map((v) => (
        <span
          key={v.id}
          className="group flex items-center gap-1 rounded-full border hairline pl-2.5 pr-1 py-1 text-[11px] text-muted"
        >
          <button onClick={() => onApply(v.filters)} className="hover:text-[var(--fg)]">
            {v.name}
          </button>
          <button
            onClick={() => removeView(v.id, v.name)}
            className="rounded-full px-1 opacity-0 hover:text-red-400 group-hover:opacity-100"
            aria-label={`Usuń widok ${v.name}`}
            title="Usuń widok"
          >
            ✕
          </button>
        </span>
      ))}
      <button
        onClick={saveCurrent}
        className="rounded-full border border-dashed hairline px-2.5 py-1 text-[11px] text-muted hover:text-[var(--fg)]"
      >
        + Zapisz widok
      </button>
    </div>
  );
}
