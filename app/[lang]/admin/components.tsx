"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { IconUsers, IconDownload } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import type { Client } from "@/lib/clients";
import { PROCESS_STEPS } from "@/lib/process";
import { todayLocalISO, addDaysLocalISO } from "@/lib/dates";
import { currentMonthRange } from "@/lib/export";
import { useUI } from "./ui";
import { PropertyMenu, Popover } from "./Menu";
import { DateField } from "./DatePicker";
import { waLink, linkedinLink } from "@/lib/contact";

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

  // Przelicz także przy zmianie SZEROKOŚCI pola, nie tylko treści. Wysokość
  // zależy od zawijania tekstu, więc pomiar zrobiony przy innej szerokości jest
  // nieaktualny — a dotąd nic go nie odświeżało. Złapane 2026-07-17 na nowym
  // profilu notatki: pole montuje się w trakcie animacji wejścia strony, mierzy
  // się przy szerokości bliskiej zeru (jedna linijka zawija się na ~20), zapisuje
  // 468 px i zostaje z tym na zawsze. Ten sam błąd czyha wszędzie indziej, gdzie
  // pole zmienia szerokość po zamontowaniu (zwijany sidebar, obrót telefonu).
  //
  // Reagujemy TYLKO na zmianę szerokości: obserwujemy element, któremu sami
  // ustawiamy wysokość, więc bezwarunkowe resize() w callbacku potrafiłoby się
  // zapętlić. Szerokości nie dotykamy, więc ten warunek przerywa sprzężenie.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let lastWidth = el.clientWidth;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w === lastWidth) return;
      lastWidth = w;
      resize();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
  // Klikalna pigułka statusu otwierająca własne menu (styl Linear) zamiast
  // natywnego <select>, które psuło „feel" panelu. Kolor pigułki z classMap,
  // menu z pełną listą statusów i haczykiem przy wybranym.
  return (
    <PropertyMenu
      value={value}
      options={options.map((s) => ({ value: s, label: s }))}
      onChange={onChange}
      title="Zmień status"
    >
      <span
        className={`cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-medium ${classMap[value] ?? ""} ${className}`}
      >
        {value}
      </span>
    </PropertyMenu>
  );
}

/** Rząd dużych, dotykowych przycisków szybkiego kontaktu (Moduł 3, kanały
 * kontaktu) — na telefonie każdy z nich otwiera od razu właściwą aplikację
 * (dzwoni / SMS-owy klient mail / WhatsApp / LinkedIn), na desktopie
 * domyślny program pocztowy / WhatsApp Web / przeglądarkę. Panel niczego nie
 * wysyła sam — to zwykłe linki `tel:`/`mailto:`/`wa.me`. Cele dotykowe min.
 * ~44px (`min-h-[44px]`) — istotne na wąskim ekranie, patrz Moduł 5. */
export function ContactQuickActions({
  telefon,
  email,
  linkedinUrl,
}: {
  telefon: string;
  email: string;
  linkedinUrl: string;
}) {
  const wa = waLink(telefon);
  const li = linkedinLink(linkedinUrl);
  if (!telefon && !email && !wa && !li) return null;

  const cls =
    "flex min-h-[44px] items-center gap-1.5 rounded-full border hairline px-3.5 py-2 text-[13px] font-medium text-[var(--fg)] hover:bg-[var(--hairline)]";

  return (
    <div className="flex flex-wrap gap-2">
      {telefon && (
        <a href={`tel:${telefon}`} className={cls} title="Zadzwoń">
          📞 Zadzwoń
        </a>
      )}
      {email && (
        <a href={`mailto:${email}`} className={cls} title="Napisz maila">
          ✉️ Mail
        </a>
      )}
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" className={cls} title="Otwórz WhatsApp">
          💬 WhatsApp
        </a>
      )}
      {li && (
        <a href={li} target="_blank" rel="noopener noreferrer" className={cls} title="Otwórz profil LinkedIn">
          🔗 LinkedIn
        </a>
      )}
    </div>
  );
}

/** Szybkie chipy najczęstszych przypomnień (jutro/za 3 dni/za tydzień) —
 * szybsze na telefonie niż kręcenie kołem daty za każdym razem, wzorem
 * Front/Close.com. Nie zastępuje DateField (dowolna data), tylko go
 * uzupełnia dla najczęstszych przypadków. */
export function QuickDateChips({ onPick }: { onPick: (iso: string) => void }) {
  const options: { label: string; days: number }[] = [
    { label: "Jutro", days: 1 },
    { label: "Za 3 dni", days: 3 },
    { label: "Za tydzień", days: 7 },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.days}
          type="button"
          onClick={() => onPick(addDaysLocalISO(o.days))}
          className="rounded-full border hairline px-2.5 py-1 text-[11px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Miękka ściągawka 15-krokowego procesu (lib/process.ts) — wyłącznie
 * informacyjna, nigdy nie blokuje przejścia dalej. Renderowana na dole
 * panelu leada/klienta, podświetla krok wg statusu (LEAD_STATUS_STEP /
 * CLIENT_STATUS_STEP). Kroki przed aktualnym są "odhaczone", po — wyszarzone. */
export function ProcessMap({ currentStep }: { currentStep: number }) {
  return (
    <div className="overflow-x-auto">
      <ol className="flex min-w-max items-center gap-1.5">
        {PROCESS_STEPS.map(({ step, label }, i) => {
          const isCurrent = step === currentStep;
          const isDone = step < currentStep;
          return (
            <li key={step} className="flex items-center gap-1.5">
              <span
                title={label}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] whitespace-nowrap ${
                  isCurrent
                    ? "bg-gradient-to-r from-brand-purple to-brand-pink font-semibold text-white"
                    : isDone
                      ? "text-muted opacity-60"
                      : "text-muted opacity-35"
                }`}
              >
                <span aria-hidden>{isCurrent ? "●" : isDone ? "✓" : "○"}</span>
                {label}
              </span>
              {i < PROCESS_STEPS.length - 1 && <span className="text-muted opacity-30">→</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Neutralna klikalna pigułka do wyboru z ustalonej listy opcji, bez
 * kolorowania per wartość (w przeciwieństwie do StatusPill) — np. kategoria
 * źródła leada. Puste `value` pokazuje `placeholder`. */
export function PillPicker({
  value,
  options,
  onChange,
  placeholder = "— wybierz —",
  title = "Zmień",
}: {
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  placeholder?: string;
  title?: string;
}) {
  return (
    <PropertyMenu value={value} options={options.map((s) => ({ value: s, label: s }))} onChange={onChange} title={title}>
      <span className="cursor-pointer rounded-full border hairline px-2.5 py-1 text-[11px] text-muted hover:text-[var(--fg)]">
        {value || placeholder}
      </span>
    </PropertyMenu>
  );
}

/** Jednolinijkowy tekst z wielokropkiem, gdy nie mieści się w kolumnie —
 * pełna treść zostaje dostępna przez natywny tooltip (title). Zastępuje
 * zwykłe <input>/<span>, które w wąskich kolumnach tabeli po prostu ucinały
 * tekst bez żadnego śladu, że coś jest ukryte. */
export function Truncate({ value, className = "" }: { value: string; className?: string }) {
  if (!value) return <span className="text-muted opacity-40">—</span>;
  return (
    <span className={`block truncate ${className}`} title={value}>
      {value}
    </span>
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

/** Link "→ Karta klienta", jeśli rekord ma podpiętego klienta (patrz
 * lib/clients.ts) — wzorem LeadDetailPanel.tsx, wydzielony żeby nie kopiować
 * tego samego znacznika w OfferEditor/InvoiceEditor/ProjectDetailPanel. */
export function ClientLinkChip({
  clientId,
  lang,
  className = "",
}: {
  clientId: string | null;
  lang: Locale;
  className?: string;
}) {
  if (!clientId) return null;
  return (
    <Link
      href={`/${lang}/admin/clients/${clientId}`}
      className={`text-[12.5px] text-muted hover:text-[var(--fg)] hover:underline ${className}`}
    >
      → Karta klienta
    </Link>
  );
}

/** Przycisk „Z bazy klientów" + rozwijana lista z wyszukiwarką — wypełnia dane
 * nabywcy zapisanym klientem. Współdzielony przez edytory Faktur i Ofert (te
 * same pola: nazwa/NIP/adres/e-mail). Zwraca null przy pustej bazie klientów. */
export function ClientPickerButton({ clients, onPick }: { clients: Client[]; onPick: (c: Client) => void }) {
  if (clients.length === 0) return null;
  return (
    <Popover
      width={320}
      trigger={(open) => (
        <button
          onClick={open}
          className="flex items-center gap-1 rounded-full border hairline px-2.5 py-1 text-[11px] text-muted hover:text-[var(--fg)]"
          title="Wypełnij danymi zapisanego klienta z bazy"
        >
          <IconUsers size={12} /> Z bazy klientów
        </button>
      )}
    >
      {(close) => (
        <ClientPickerList
          clients={clients}
          onPick={(c) => {
            onPick(c);
            close();
          }}
        />
      )}
    </Popover>
  );
}

function ClientPickerList({ clients, onPick }: { clients: Client[]; onPick: (c: Client) => void }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? clients.filter((c) => `${c.nazwa} ${c.nip} ${c.miasto}`.toLowerCase().includes(needle))
    : clients;
  return (
    <div className="max-h-72 overflow-y-auto">
      <div className="p-1.5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Szukaj klienta (nazwa / NIP / miasto)…"
          autoFocus
          className="w-full rounded-md border hairline bg-transparent px-2 py-1 text-[12.5px] text-[var(--fg)] placeholder:text-muted"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="px-3 py-3 text-center text-[12px] text-muted">Brak dopasowań.</p>
      ) : (
        filtered.map((c) => (
          <button
            key={c.id}
            onClick={() => onPick(c)}
            className="flex w-full flex-col px-2.5 py-1.5 text-left hover:bg-[var(--hairline)]"
          >
            <span className="truncate text-[13px] text-[var(--fg)]">{c.nazwa || "(bez nazwy)"}</span>
            <span className="truncate text-[11px] text-muted">
              {[c.nip && `NIP ${c.nip}`, [c.kod, c.miasto].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}
            </span>
          </button>
        ))
      )}
    </div>
  );
}

/** Przycisk „Eksport CSV" z wyborem zakresu dat — rejestr dla księgowej.
 * `endpoint` to ścieżka API zwracająca CSV (np. `/api/invoices/export`),
 * współdzielona przez Faktury i Koszty (Faza 4 mapy drogowej ERP). Domyślny
 * zakres: bieżący miesiąc. Pobieranie przez zwykły link `<a>` (GET z ciasteczkiem
 * sesji, przeglądarka sama obsłuży `Content-Disposition: attachment`) — bez
 * fetch+blob, bo to zbędna komplikacja dla prostego pobrania pliku. */
export function ExportCsvButton({ endpoint, title = "Eksport CSV" }: { endpoint: string; title?: string }) {
  const defaults = currentMonthRange(todayLocalISO());
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  return (
    <Popover
      align="right"
      width={240}
      trigger={(open) => (
        <button
          onClick={open}
          className="flex h-6 items-center gap-1 rounded-md px-2 text-[12.5px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]"
          title={`${title} dla księgowej`}
        >
          <IconDownload size={14} /> Eksport CSV
        </button>
      )}
    >
      {(close) => (
        <div className="space-y-2.5 p-3">
          <p className="text-[11px] text-muted">Zakres dat (wg daty wystawienia/wydatku)</p>
          <div className="flex items-center gap-1.5">
            <DateField value={from} onChange={setFrom} placeholder="Od" />
            <span className="text-[11px] text-muted">–</span>
            <DateField value={to} onChange={setTo} placeholder="Do" />
          </div>
          <a
            href={`${endpoint}?from=${from}&to=${to}`}
            target="_blank"
            rel="noreferrer"
            onClick={close}
            className="btn-primary flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
          >
            <IconDownload size={13} /> Pobierz CSV
          </a>
        </div>
      )}
    </Popover>
  );
}
