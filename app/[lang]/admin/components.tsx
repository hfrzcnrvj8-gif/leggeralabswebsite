"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { IconUsers, IconDownload, IconInfoCircle } from "@tabler/icons-react";
import { ContactChannelIcon } from "./icons";
import type { Locale } from "@/i18n/config";
import type { Client } from "@/lib/clients";
import { PROCESS_STEPS } from "@/lib/process";
import { todayLocalISO, addDaysLocalISO } from "@/lib/dates";
import { currentMonthRange } from "@/lib/export";
import { useUI } from "./ui";
import { PropertyMenu, Popover } from "./Menu";
import { LinkPicker, type LinkTarget } from "./LinkPicker";
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
      {/* Ikony przez ContactChannelIcon (Moduł 33) — ten sam znak kanału co na
          osi kontaktu i w odznakach list, z jednego źródła. */}
      {telefon && (
        <a href={`tel:${telefon}`} className={cls} title="Zadzwoń">
          <ContactChannelIcon kind="telefon" size={15} /> Zadzwoń
        </a>
      )}
      {email && (
        <a href={`mailto:${email}`} className={cls} title="Napisz maila">
          <ContactChannelIcon kind="email" size={15} /> Mail
        </a>
      )}
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" className={cls} title="Otwórz WhatsApp">
          <ContactChannelIcon kind="whatsapp" size={15} /> WhatsApp
        </a>
      )}
      {li && (
        <a href={li} target="_blank" rel="noopener noreferrer" className={cls} title="Otwórz profil LinkedIn">
          <ContactChannelIcon kind="linkedin" size={15} /> LinkedIn
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

/** Miękka podpowiedź o powiązaniu dokumentu z klientem (Moduł 30) — treść
 * pochodzi z `UNLINKED_CLIENT_HINT`/`clientMismatchHint` (lib/links.ts).
 * Świadomie tylko informuje: nic nie blokuje i niczego nie poprawia sama,
 * zgodnie z zasadą panelu „miękkie podpowiedzi zamiast twardych bramek"
 * (wzorem LEAD_STATUS_HINT). */
export function LinkHint({ text }: { text: string }) {
  return (
    <div className="mb-3 flex items-start gap-2 rounded-lg border hairline bg-[var(--hairline)]/40 px-3 py-2 text-[12px] text-muted">
      <IconInfoCircle size={14} className="mt-[1px] shrink-0" />
      <span>{text}</span>
    </div>
  );
}

/** Pole „Nabywca → powiązanie z klientem" na Fakturach i Ofertach (Moduł 30).
 *
 * Zastępuje dawny `ClientPickerButton`, który miał dwie wady: znikał całkowicie
 * przy pustej bazie (`clients.length === 0` → `return null`, więc na świeżym
 * panelu NIE DAŁO SIĘ powiązać niczego), i był czwartym wyglądem pickera obok
 * wspólnego `LinkPicker` z Modułu 22.
 *
 * `kinds={["client"]}` świadomie, mimo że faktura/oferta ma też `lead_id`:
 * `linkValueFor` jest WYŁĄCZNE w obrębie `kinds`, więc dorzucenie tu `"lead"`
 * kasowałoby `lead_id` przy wyborze klienta — a na ofercie to ślad
 * pochodzenia, z którego korzysta `lib/offerAccept.ts`. Leada wybiera się przy
 * TWORZENIU dokumentu (patrz NewDocumentButton), nie tutaj.
 *
 * `onPick(c)` dostaje pełnego klienta, bo wołający kopiuje z niego migawkę
 * danych nabywcy — patrz UNLINKED_CLIENT_HINT w lib/links.ts. */
export function ClientLinkPicker({
  clients,
  clientId,
  onPick,
  onCreate,
}: {
  clients: Client[];
  clientId: string | null;
  onPick: (c: Client | null) => void;
  /** „Załóż klienta z tych danych" — jedyne sensowne wyjście, gdy baza jest
   * pusta albo nabywcy jeszcze w niej nie ma. */
  onCreate?: () => void;
}) {
  const targets: LinkTarget[] = clients.map((c) => ({
    kind: "client" as const,
    id: c.id,
    nazwa: c.nazwa || "(bez nazwy)",
    hint: [c.nip && `NIP ${c.nip}`, [c.kod, c.miasto].filter(Boolean).join(" ")].filter(Boolean).join(" · ") || undefined,
    szukaj: `${c.nazwa ?? ""} ${c.nip ?? ""} ${c.miasto ?? ""} ${c.email ?? ""}`.toLowerCase(),
  }));

  return (
    <LinkPicker
      kinds={["client"]}
      targets={targets}
      value={{ client_id: clientId }}
      align="right"
      onPick={(_next, picked) => onPick(picked ? clients.find((c) => c.id === picked.id) ?? null : null)}
      trigger={(picked, open) => (
        <button
          onClick={open}
          className="flex items-center gap-1 rounded-full border hairline px-2.5 py-1 text-[11px] text-muted hover:text-[var(--fg)]"
          title={picked ? `Powiązany klient: ${picked.nazwa}` : "Powiąż z klientem z bazy i wypełnij jego danymi"}
        >
          <IconUsers size={12} /> {picked ? picked.nazwa : "Z bazy klientów"}
        </button>
      )}
      footer={
        onCreate
          ? (close) => (
              <button
                onClick={() => {
                  close();
                  onCreate();
                }}
                className="w-full rounded-md px-2.5 py-1.5 text-left text-[12.5px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]"
              >
                + Załóż klienta z danych nabywcy
              </button>
            )
          : undefined
      }
    />
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
