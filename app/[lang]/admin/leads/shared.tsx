"use client";

import { useEffect, useRef, useState } from "react";

export type Lead = {
  id: string;
  firma: string;
  branza: string;
  /** @deprecated zlepione pole z czasów przed rozbiciem na telefon/email/www — trzymane tylko dla wstecznej zgodności ze starymi wpisami */
  kontakt: string;
  telefon: string;
  email: string;
  www: string;
  zrodlo: string;
  status: string;
  ostatni_kontakt: string | null;
  next_followup: string | null;
  notatki: string;
  created_at: string;
  updated_at: string;
};

export type Activity = {
  id: string;
  lead_id: string;
  text: string;
  created_at: string;
};

export type SeedLead = Pick<
  Lead,
  "firma" | "branza" | "telefon" | "email" | "www" | "zrodlo" | "status" | "notatki"
>;

export const STATUSES = [
  "Nowe zgłoszenie ze strony",
  "Do kontaktu",
  "Napisano - czeka na odpowiedź",
  "Przypomnienie wysłane",
  "Rozmowa umówiona",
  "Pilotaż w trakcie",
  "Zamknięte - sukces",
  "Odrzucone / brak zainteresowania",
] as const;

// Odznaki statusu — półprzezroczyste na kolorze marki, czytelne w obu
// motywach (jasnym i ciemnym) dzięki alpha-blend zamiast litych barw.
export const STATUS_CLASS: Record<string, string> = {
  "Nowe zgłoszenie ze strony": "bg-red-500/15 text-red-400 dark:text-red-300",
  "Do kontaktu": "bg-[var(--hairline)] text-muted",
  "Napisano - czeka na odpowiedź": "bg-brand-gold/15 text-brand-gold",
  "Przypomnienie wysłane": "bg-orange-500/15 text-orange-400",
  "Rozmowa umówiona": "bg-brand-cyan/15 text-brand-cyan",
  "Pilotaż w trakcie": "bg-emerald-500/15 text-emerald-400",
  "Zamknięte - sukces": "bg-emerald-500/20 text-emerald-400 font-semibold",
  "Odrzucone / brak zainteresowania": "bg-[var(--hairline)] text-muted opacity-70",
};

// Kropka statusu w widoku kanban — pełny kolor marki/semantyczny.
export const STATUS_DOT: Record<string, string> = {
  "Nowe zgłoszenie ze strony": "bg-red-500",
  "Do kontaktu": "bg-[var(--fg-muted)]",
  "Napisano - czeka na odpowiedź": "bg-brand-gold",
  "Przypomnienie wysłane": "bg-orange-500",
  "Rozmowa umówiona": "bg-brand-cyan",
  "Pilotaż w trakcie": "bg-emerald-500",
  "Zamknięte - sukces": "bg-emerald-600",
  "Odrzucone / brak zainteresowania": "bg-[var(--hairline)]",
};

// Startowa pula leadów zebrana ręcznie (Wilanów + Przysucha/Radom), z
// telefonem/mailem/www rozbitymi na osobne pola u źródła.
export const SEED: SeedLead[] = [
  { firma: "Kancelaria Prawna Tomasz Borawski", branza: "Kancelaria prawna", telefon: "+48 883 384 005", email: "biuro@radcaborawski.pl", www: "radcaborawski.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Kancelaria Radcy Prawnego Anna Czechowska-Miszczak", branza: "Kancelaria prawna", telefon: "604 448 808", email: "kancelaria@czechowskamiszczak.pl", www: "czechowskamiszczak.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Kancelaria Adwokacka Maciej Płacheta", branza: "Kancelaria prawna", telefon: "+48 696 599 733", email: "", www: "adwokatplacheta.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Kancelaria Adwokacka Jakub Wróblewski", branza: "Kancelaria prawna", telefon: "+48 691 130 236", email: "", www: "kancelaria-wroblewski.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Kancelaria Szeffner i Wspólnicy", branza: "Kancelaria prawna", telefon: "", email: "", www: "kancelaria-szeffner.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "EFEKTA Biuro Rachunkowe", branza: "Biuro rachunkowe", telefon: "+48 22 403 40 98", email: "biuro@efekta.waw.pl", www: "efekta.waw.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Anioły Przedsiębiorczości", branza: "Biuro rachunkowe", telefon: "+48 788 811 118 w.55", email: "ksiegowosc@ap-wb.pl", www: "", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "K2Tax", branza: "Biuro rachunkowe", telefon: "+48 606 266 277", email: "", www: "k2tax.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Euro Finance", branza: "Biuro rachunkowe", telefon: "608 658 212", email: "", www: "euro-finance.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Biuro Rachunkowe Agnieszka Kwiatkowska", branza: "Biuro rachunkowe", telefon: "", email: "a.kwiatkowska@kwiatkowska.com.pl", www: "", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "I&M Księgowi.pl", branza: "Biuro rachunkowe", telefon: "", email: "", www: "imksiegowi.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "TaxClear", branza: "Biuro rachunkowe", telefon: "+48 668 880 050", email: "", www: "taxclear.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Kancelaria Notarialna Kwiatkowska & Famurat", branza: "Notariusz", telefon: "(22) 258 77 32", email: "", www: "wilanow-notariusz.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Kancelaria Notarialna Józef Wadowski", branza: "Notariusz", telefon: "", email: "", www: "notariuszwadowski.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Kancelaria Notarialna Aleksandra Więcek", branza: "Notariusz", telefon: "", email: "", www: "", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "ul. Sarmacka 6 lok. U8" },
  { firma: "Kancelaria Notarialna Magdalena Sikorska", branza: "Notariusz", telefon: "", email: "", www: "", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "Miasteczko Wilanów" },
  { firma: "Kancelaria Notarialna W&W", branza: "Notariusz", telefon: "", email: "", www: "", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "Obsługuje Mokotów/Ursynów/Wilanów" },
  { firma: "Dental Wilanów", branza: "Klinika stomatologiczna", telefon: "", email: "", www: "dentalwilanow.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Dentistree", branza: "Klinika stomatologiczna", telefon: "", email: "", www: "dentistree.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "ul. Oś Królewska 18 lok. U2" },
  { firma: "Nieckula Dental Clinic", branza: "Klinika stomatologiczna", telefon: "", email: "", www: "stomatologiawilanow.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "XO Dental Clinic", branza: "Klinika stomatologiczna", telefon: "", email: "", www: "xodentalclinic.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Cićkiewicz Clinic", branza: "Klinika stomatologiczna", telefon: "", email: "", www: "cickiewiczclinic.com", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Smile Makers", branza: "Klinika stomatologiczna", telefon: "532 108 507", email: "", www: "smilemakers.com.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Elżbieta Chotecka Biuro Rachunkowe", branza: "Biuro rachunkowe", telefon: "", email: "", www: "", zrodlo: "Przysucha - ciepły?", status: "Do kontaktu", notatki: "ul. Hubala 43/10, Przysucha. Sprawdzić czy ktoś z rodziny zna osobiście" },
  { firma: "Biuro Rachunkowe Sylwia Płuciennik", branza: "Biuro rachunkowe", telefon: "", email: "", www: "", zrodlo: "Przysucha - ciepły?", status: "Do kontaktu", notatki: "ul. Grodzka 10, Przysucha. Sprawdzić czy ktoś z rodziny zna osobiście" },
  { firma: "Biuro Rachunkowe Anna Sobczyk-Józwowiak", branza: "Biuro rachunkowe", telefon: "", email: "", www: "", zrodlo: "Przysucha - ciepły?", status: "Do kontaktu", notatki: "Przysucha. Sprawdzić czy ktoś z rodziny zna osobiście" },
  { firma: "Marzanna Lisowska Biuro Rachunkowe", branza: "Biuro rachunkowe", telefon: "", email: "", www: "", zrodlo: "Przysucha - ciepły?", status: "Do kontaktu", notatki: "Przysucha. Sprawdzić czy ktoś z rodziny zna osobiście" },
  { firma: "NO TAX Biuro Rachunkowe", branza: "Biuro rachunkowe", telefon: "600 348 168 / 601 373 770", email: "notax.biuro@gmail.com", www: "", zrodlo: "Radom - www", status: "Do kontaktu", notatki: "" },
];

export function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

const CLOSED_STATUSES = new Set(["Zamknięte - sukces", "Odrzucone / brak zainteresowania"]);

export function isOverdue(lead: Lead): boolean {
  if (CLOSED_STATUSES.has(lead.status)) return false;
  if (lead.status === "Nowe zgłoszenie ze strony") return true;

  // Jawnie ustawiona data przypomnienia bierze pierwszeństwo nad sztywną
  // regułą — jeśli ją ustawiłeś, to Ty decydujesz kiedy się odezwać.
  if (lead.next_followup) {
    const today = new Date().toISOString().slice(0, 10);
    return lead.next_followup <= today;
  }

  if (lead.status !== "Napisano - czeka na odpowiedź") return false;
  const d = daysSince(lead.ostatni_kontakt);
  return d !== null && d >= 4;
}

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
