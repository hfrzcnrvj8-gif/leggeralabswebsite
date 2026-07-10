"use client";

import { useEffect, useState } from "react";

export type Lead = {
  id: string;
  firma: string;
  branza: string;
  kontakt: string;
  zrodlo: string;
  status: string;
  ostatni_kontakt: string | null;
  notatki: string;
  created_at: string;
  updated_at: string;
};

export type SeedLead = Pick<
  Lead,
  "firma" | "branza" | "kontakt" | "zrodlo" | "status" | "notatki"
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

// Startowa pula leadów zebrana ręcznie (Wilanów + Przysucha/Radom).
export const SEED: SeedLead[] = [
  { firma: "Kancelaria Prawna Tomasz Borawski", branza: "Kancelaria prawna", kontakt: "+48 883 384 005 / biuro@radcaborawski.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Kancelaria Radcy Prawnego Anna Czechowska-Miszczak", branza: "Kancelaria prawna", kontakt: "604 448 808 / kancelaria@czechowskamiszczak.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Kancelaria Adwokacka Maciej Płacheta", branza: "Kancelaria prawna", kontakt: "+48 696 599 733", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Kancelaria Adwokacka Jakub Wróblewski", branza: "Kancelaria prawna", kontakt: "+48 691 130 236", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Kancelaria Szeffner i Wspólnicy", branza: "Kancelaria prawna", kontakt: "kancelaria-szeffner.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "EFEKTA Biuro Rachunkowe", branza: "Biuro rachunkowe", kontakt: "+48 22 403 40 98 / biuro@efekta.waw.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Anioły Przedsiębiorczości", branza: "Biuro rachunkowe", kontakt: "+48 788 811 118 w.55 / ksiegowosc@ap-wb.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "K2Tax", branza: "Biuro rachunkowe", kontakt: "+48 606 266 277", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Euro Finance", branza: "Biuro rachunkowe", kontakt: "608 658 212", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Biuro Rachunkowe Agnieszka Kwiatkowska", branza: "Biuro rachunkowe", kontakt: "a.kwiatkowska@kwiatkowska.com.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "I&M Księgowi.pl", branza: "Biuro rachunkowe", kontakt: "imksiegowi.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "TaxClear", branza: "Biuro rachunkowe", kontakt: "+48 668 880 050", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Kancelaria Notarialna Kwiatkowska & Famurat", branza: "Notariusz", kontakt: "(22) 258 77 32", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Kancelaria Notarialna Józef Wadowski", branza: "Notariusz", kontakt: "notariuszwadowski.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Kancelaria Notarialna Aleksandra Więcek", branza: "Notariusz", kontakt: "ul. Sarmacka 6 lok. U8", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Kancelaria Notarialna Magdalena Sikorska", branza: "Notariusz", kontakt: "Miasteczko Wilanów", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Kancelaria Notarialna W&W", branza: "Notariusz", kontakt: "Mokotów/Ursynów/Wilanów", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Dental Wilanów", branza: "Klinika stomatologiczna", kontakt: "dentalwilanow.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Dentistree", branza: "Klinika stomatologiczna", kontakt: "ul. Oś Królewska 18 lok. U2", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Nieckula Dental Clinic", branza: "Klinika stomatologiczna", kontakt: "stomatologiawilanow.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "XO Dental Clinic", branza: "Klinika stomatologiczna", kontakt: "xodentalclinic.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Cićkiewicz Clinic", branza: "Klinika stomatologiczna", kontakt: "cickiewiczclinic.com", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Smile Makers", branza: "Klinika stomatologiczna", kontakt: "532 108 507", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Elżbieta Chotecka Biuro Rachunkowe", branza: "Biuro rachunkowe", kontakt: "ul. Hubala 43/10, Przysucha", zrodlo: "Przysucha - ciepły?", status: "Do kontaktu", notatki: "Sprawdzić czy ktoś z rodziny zna osobiście" },
  { firma: "Biuro Rachunkowe Sylwia Płuciennik", branza: "Biuro rachunkowe", kontakt: "ul. Grodzka 10, Przysucha", zrodlo: "Przysucha - ciepły?", status: "Do kontaktu", notatki: "Sprawdzić czy ktoś z rodziny zna osobiście" },
  { firma: "Biuro Rachunkowe Anna Sobczyk-Józwowiak", branza: "Biuro rachunkowe", kontakt: "Przysucha", zrodlo: "Przysucha - ciepły?", status: "Do kontaktu", notatki: "Sprawdzić czy ktoś z rodziny zna osobiście" },
  { firma: "Marzanna Lisowska Biuro Rachunkowe", branza: "Biuro rachunkowe", kontakt: "Przysucha", zrodlo: "Przysucha - ciepły?", status: "Do kontaktu", notatki: "Sprawdzić czy ktoś z rodziny zna osobiście" },
  { firma: "NO TAX Biuro Rachunkowe", branza: "Biuro rachunkowe", kontakt: "600 348 168 / notax.biuro@gmail.com, Radom", zrodlo: "Radom - www", status: "Do kontaktu", notatki: "" },
];

export function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function isOverdue(lead: Lead): boolean {
  if (lead.status === "Nowe zgłoszenie ze strony") return true;
  if (lead.status !== "Napisano - czeka na odpowiedź") return false;
  const d = daysSince(lead.ostatni_kontakt);
  return d !== null && d >= 4;
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
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v !== value) onSave(v);
      }}
      className="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-xs text-[var(--fg)] transition-colors hover:border-[var(--hairline)] focus:border-brand-cyan/60 focus:outline-none"
    />
  );
}

export function EditableTextarea({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <textarea
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v !== value) onSave(v);
      }}
      rows={2}
      className="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-xs text-[var(--fg)] transition-colors hover:border-[var(--hairline)] focus:border-brand-cyan/60 focus:outline-none"
    />
  );
}
