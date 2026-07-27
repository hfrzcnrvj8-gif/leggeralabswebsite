"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { SPRING, SPRING_SOFT } from "@/lib/motion";
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
import { ExpandingIconButton } from "./ExpandingIconButton";
import { Tooltip } from "./Tooltip";
import { waLink, linkedinLink } from "@/lib/contact";

// Generyczne komponenty UI współdzielone przez wszystkie moduły panelu
// (leady, projekty, notatnik, kalendarz) — jedno miejsce zamiast kopiowania
// tych samych "edytowalnych" pól i pigułek statusu w każdym module osobno.

/** Liczba, która "dolicza się" do nowej wartości zamiast skakać —
 * drobny, ale bardzo charakterystyczny dla Linear szczegół. */
function AnimatedNumber({ value }: { value: number }) {
  const motionVal = useMotionValue(0);
  // ŚWIADOMY wyjątek od standardowego SPRING (420/32): licznik ma się „doliczać"
  // powoli i widocznie — standardowa sztywność skończyłaby zliczanie, zanim oko
  // je zauważy. `SPRING_SOFT` (120/20) z lib/motion.ts.
  const spring = useSpring(motionVal, SPRING_SOFT);
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
      transition={SPRING}
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

export function EditableText({
  value,
  onSave,
  // Puste pole bez podpowiedzi wygląda jak dziura w układzie, a nie jak pole
  // do wypełnienia — na wizytówce rekordu było ich naraz po kilka (runda
  // czytelności 2026-07-26). Myślnik jest tym, co w tej roli pokazują Attio,
  // Linear i Notion; `placeholder`, nie wartość, więc nic nie trafia do bazy.
  placeholder = "—",
  /** Pole tylko do odczytu — dla dokumentów zamkniętych blokadą (podpisana
   * umowa). Bez tego pole wygląda na edytowalne, przyjmuje wpisany tekst
   * i dopiero serwer odbija je komunikatem 409 — czyli interfejs obiecuje
   * coś, czego trasa nie pozwoli zrobić (audyt Modułu 11). */
  readOnly = false,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      value={v}
      placeholder={placeholder}
      title={readOnly ? "Dokument jest podpisany — treści nie zmieniamy" : value || undefined}
      readOnly={readOnly}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (!readOnly && v !== value) onSave(v);
      }}
      className={`w-full min-w-[6ch] rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-xs text-[var(--fg)] transition-colors placeholder:text-muted placeholder:opacity-60 focus:outline-none ${
        readOnly ? "cursor-default opacity-70" : "hover:border-[var(--hairline)] focus:border-[#4ea7fc]/60"
      }`}
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
  // Wariant do nagłówka rekordu (runda czytelności 2026-07-26): sama ikona,
  // nazwa w podpowiedzi. Cztery przyciski z napisami zjadały u góry profilu
  // tyle wysokości, co dwie sekcje danych — a to są akcje, których się szuka
  // wzrokiem raz i potem zna ich miejsce, jak paska akcji rekordu w Attio.
  // Dotyk zostaje obsłużony: 34 px to nadal cel palcem, a na telefonie profil
  // i tak otwiera się arkuszem na pełną szerokość.
  zwarte = false,
}: {
  telefon: string;
  email: string;
  linkedinUrl: string;
  zwarte?: boolean;
}) {
  const wa = waLink(telefon);
  const li = linkedinLink(linkedinUrl);
  if (!telefon && !email && !wa && !li) return null;

  const cls = zwarte
    ? "flex h-[34px] w-[34px] items-center justify-center rounded-lg border hairline text-[var(--fg)] hover:bg-[var(--hairline)]"
    : "flex min-h-[44px] items-center gap-1.5 rounded-full border hairline px-3.5 py-2 text-[13px] font-medium text-[var(--fg)] hover:bg-[var(--hairline)]";
  const podpis = (tekst: string) => (zwarte ? null : <> {tekst}</>);

  return (
    <div className="flex flex-wrap gap-1.5">
      {/* Ikony przez ContactChannelIcon (Moduł 33) — ten sam znak kanału co na
          osi kontaktu i w odznakach list, z jednego źródła. */}
      {telefon && (
        <a href={`tel:${telefon}`} className={cls} title="Zadzwoń">
          <ContactChannelIcon kind="telefon" size={15} />
          {podpis("Zadzwoń")}
        </a>
      )}
      {email && (
        <a href={`mailto:${email}`} className={cls} title="Napisz maila">
          <ContactChannelIcon kind="email" size={15} />
          {podpis("Mail")}
        </a>
      )}
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" className={cls} title="Otwórz WhatsApp">
          <ContactChannelIcon kind="whatsapp" size={15} />
          {podpis("WhatsApp")}
        </a>
      )}
      {li && (
        <a href={li} target="_blank" rel="noopener noreferrer" className={cls} title="Otwórz profil LinkedIn">
          <ContactChannelIcon kind="linkedin" size={15} />
          {podpis("LinkedIn")}
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
 * informacyjna, nigdy nie blokuje przejścia dalej. Stoi nad zakładkami profilu
 * leada/klienta, podświetla krok wg statusu (LEAD_STATUS_STEP /
 * CLIENT_STATUS_STEP).
 *
 * **Domyślnie ZWINIĘTA do jednej linijki** (runda czytelności 2026-07-26).
 * Piętnaście pigułek nie mieści się w żadnej realnej szerokości, więc pas
 * przewijał się w poziomie i był ucięty prawą krawędzią — z paska kontekstu
 * robił się najbardziej „niedokończony" element ekranu. Pytanie brzmi zwykle
 * „na którym jestem", a nie „jak brzmi cała lista"; pełna mapa jest o jedno
 * kliknięcie dalej i wtedy ZAWIJA się do kilku linii, zamiast chować kroki
 * za krawędzią (krok, o którego istnieniu nie wiesz, to krok pominięty). */
export function ProcessMap({ currentStep }: { currentStep: number }) {
  const [rozwinieta, setRozwinieta] = useState(false);
  const biezacy = PROCESS_STEPS.find((s) => s.step === currentStep);
  const postep = Math.round((currentStep / PROCESS_STEPS.length) * 100);

  return (
    <div>
      <button
        onClick={() => setRozwinieta((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1 text-left hover:bg-[var(--hairline)]"
        title={rozwinieta ? "Zwiń mapę procesu" : "Pokaż wszystkie 15 kroków"}
      >
        <span className="shrink-0 text-[12px] tabular-nums text-muted">
          {currentStep}/{PROCESS_STEPS.length}
        </span>
        <span className="shrink-0 text-[13px] font-medium text-[var(--fg)]">{biezacy?.label ?? "—"}</span>
        {/* Pasek zjada resztę wiersza — to on niesie „ile jeszcze przede mną",
            czyli dokładnie to, co dawał ciąg wyszarzonych pigułek. */}
        <span className="h-1 min-w-[40px] flex-1 overflow-hidden rounded-full bg-[var(--hairline)]">
          <span
            className="block h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-pink"
            style={{ width: `${postep}%` }}
          />
        </span>
        <span className="shrink-0 text-[11px] text-muted opacity-70">{rozwinieta ? "zwiń" : "wszystkie kroki"}</span>
      </button>

      {rozwinieta && (
        <ol className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 px-1">
          {PROCESS_STEPS.map(({ step, label }, i) => {
            const isCurrent = step === currentStep;
            const isDone = step < currentStep;
            return (
              <li key={step} className="flex items-center gap-1.5">
                <span
                  title={label}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] ${
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
      )}
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

/** Dyskretne „i" przy liczbie KPI — pełne objaśnienie (2-3 zdania) wychodzi
 * dopiero po najechaniu na tę ikonę (Moduł 34b, wybór właściciela). Wcześniej
 * całe karty KPI miały natywny `title` na całym kaflu; teraz objaśnienie jest
 * jawnie oznaczone i nie wyskakuje przy przypadkowym najechaniu na kafelek. */
export function InfoDot({ text }: { text: string }) {
  return (
    <Tooltip label={text}>
      <span className="inline-flex cursor-help align-middle text-muted/60 transition-colors hover:text-muted">
        <IconInfoCircle size={13} />
      </span>
    </Tooltip>
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
export function ExportCsvButton({
  endpoint,
  title = "Eksport CSV",
  // Po JAKIEJ dacie filtruje zakres — różne rejestry mierzą czas czym innym
  // (faktura datą wystawienia, koszt datą wydatku, czas pracy datą wpisu).
  // Domyślna wartość jest prawdziwa dla Faktur i Kosztów, czyli dla dwóch
  // miejsc, w których ten przycisk stał, zanim doszedł trzeci.
  zakresWg = "wg daty wystawienia/wydatku",
}: { endpoint: string; title?: string; zakresWg?: string }) {
  const defaults = currentMonthRange(todayLocalISO());
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  return (
    // Moduł 34b: wyzwalacz to ikona-pigułka (jak w Leadach), nie przycisk z
    // tekstem — pasek ma być spójny. Podpis pigułki = `title` („Rejestr
    // sprzedaży"/„Rejestr zakupów"); klik otwiera Popover z zakresem dat.
    <Popover
      align="right"
      width={240}
      trigger={(open, isOpen) => (
        <ExpandingIconButton
          label={title}
          icon={<IconDownload size={15} />}
          onClick={open}
          active={isOpen}
        />
      )}
    >
      {(close) => (
        <div className="space-y-2.5 p-3">
          <p className="text-[11px] text-muted">Zakres dat ({zakresWg})</p>
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
