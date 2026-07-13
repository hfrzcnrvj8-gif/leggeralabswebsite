"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { IconArrowUpRight, IconX, IconInbox } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import {
  type Lead,
  daysSince,
  isOverdue,
  leadSourceLabel,
  StatusTag,
} from "./shared";
import { Truncate } from "../components";
import { formatPlDate } from "@/lib/projects";

/**
 * Lista = tylko podgląd. Dane stałe leada (nazwa, kontakt, adres, źródło)
 * edytuje się wyłącznie w profilu (LeadDetailPanel, otwierany klikiem w
 * nazwę firmy albo ikoną obok) — status zostaje edytowalny bezpośrednio w
 * wierszu, bo to główna akcja robocza dnia codziennego, nie dana stała.
 * `table-fixed` + kolumny procentowe zamiast sztywnych `min-w-[]px`, żeby
 * tabela realnie wykorzystywała całą dostępną szerokość ekranu, a nie tylko
 * sumę minimalnych szerokości kolumn.
 */
export function TableView({
  leads,
  lang,
  selectedId,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onUpdate,
  onDelete,
  onOpen,
}: {
  leads: Lead[];
  lang: Locale;
  selectedId?: string | null;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onUpdate: (id: string, field: string, value: string) => void;
  onDelete: (id: string, firma: string) => void;
  onOpen: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollShadows = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  return (
    <div className="card-paper relative rounded-2xl">
      {/* Cienie sygnalizujące, że w poziomie jest jeszcze coś do przewinięcia
          (styl Linear) — na wąskich ekranach tabela wciąż może scrollować. */}
      <div
        className={`pointer-events-none absolute inset-y-0 left-0 z-20 w-8 rounded-l-2xl bg-gradient-to-r from-[var(--bg-soft)] to-transparent transition-opacity ${
          canScrollLeft ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden
      />
      <div
        className={`pointer-events-none absolute inset-y-0 right-0 z-20 w-8 rounded-r-2xl bg-gradient-to-l from-[var(--bg-soft)] to-transparent transition-opacity ${
          canScrollRight ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden
      />
      <div
        ref={scrollRef}
        onScroll={updateScrollShadows}
        className="max-h-[70vh] min-w-full overflow-auto rounded-2xl"
      >
        <table className="w-full min-w-[900px] table-fixed text-xs">
          {/* Wszystkie kolumny w procentach (sumujące się do 100%), żaden
              px-owy wyjątek — inaczej table-fixed nie rozciąga tabeli na
              całą dostępną szerokość, tylko zostawia martwe miejsce z boku. */}
          <colgroup>
            <col className="w-[3%]" />
            <col className="w-[22%]" />
            <col className="w-[9%]" />
            <col className="w-[15%]" />
            <col className="w-[8%]" />
            <col className="w-[13%]" />
            <col className="w-[12%]" />
            <col className="w-[9%]" />
            <col className="w-[4%]" />
            <col className="w-[5%]" />
          </colgroup>
          <thead>
            <tr className="sticky top-0 z-10 border-b hairline bg-[var(--bg-soft)] text-left uppercase tracking-wide text-muted">
              <th className="bg-[var(--bg-soft)] p-2">
                <input
                  type="checkbox"
                  checked={leads.length > 0 && leads.every((l) => selectedIds.has(l.id))}
                  onChange={(e) => onToggleSelectAll(e.target.checked)}
                  className="h-3.5 w-3.5 cursor-pointer accent-[#4ea7fc]"
                  aria-label="Zaznacz wszystkie"
                />
              </th>
              <th className="bg-[var(--bg-soft)] p-2">Firma</th>
              <th className="bg-[var(--bg-soft)] p-2">Branża</th>
              <th className="bg-[var(--bg-soft)] p-2">Kontakt</th>
              <th className="bg-[var(--bg-soft)] p-2">Miasto</th>
              <th className="bg-[var(--bg-soft)] p-2">Źródło</th>
              <th className="bg-[var(--bg-soft)] p-2">Status</th>
              <th className="bg-[var(--bg-soft)] p-2">Ostatni kontakt</th>
              <th className="bg-[var(--bg-soft)] p-2">Dni</th>
              <th className="bg-[var(--bg-soft)] p-2"></th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr>
                <td colSpan={10} className="p-8 text-center text-sm text-muted opacity-60">
                  <IconInbox size={18} className="mx-auto mb-1.5 opacity-70" />
                  Brak leadów pasujących do filtrów.
                </td>
              </tr>
            )}
            {leads.map((lead) => {
              const d = daysSince(lead.ostatni_kontakt);
              const overdueRow = isOverdue(lead);
              const selected = selectedId === lead.id;
              const checked = selectedIds.has(lead.id);
              const kontakt = [lead.telefon, lead.email].filter(Boolean);
              return (
                <tr
                  key={lead.id}
                  className={`border-b hairline align-top transition-colors ${
                    overdueRow ? "bg-orange-500/[0.06]" : ""
                  } ${selected ? "bg-[#4ea7fc]/[0.08]" : ""} ${checked ? "bg-[#4ea7fc]/[0.08]" : ""}`}
                >
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleSelect(lead.id)}
                      className="h-3.5 w-3.5 cursor-pointer accent-[#4ea7fc]"
                      aria-label={`Zaznacz ${lead.firma}`}
                    />
                  </td>
                  <td className="p-2">
                    <button
                      onClick={() => onOpen(lead.id)}
                      className="block w-full truncate text-left font-medium text-[var(--fg)] hover:underline"
                      title={lead.firma}
                    >
                      {lead.firma}
                    </button>
                    {lead.osoba_kontaktowa && (
                      <Truncate value={lead.osoba_kontaktowa} className="text-[11px] text-muted opacity-80" />
                    )}
                  </td>
                  <td className="p-2">
                    <Truncate value={lead.branza} />
                  </td>
                  <td className="p-2">
                    {kontakt.length === 0 ? (
                      <span className="text-muted opacity-40">—</span>
                    ) : (
                      kontakt.map((c) => <Truncate key={c} value={c} />)
                    )}
                  </td>
                  <td className="p-2">
                    <Truncate value={lead.miasto} />
                  </td>
                  <td className="p-2">
                    <Truncate value={leadSourceLabel(lead)} />
                  </td>
                  <td className="p-2">
                    <StatusTag status={lead.status} onChange={(v) => onUpdate(lead.id, "status", v)} />
                  </td>
                  <td className="p-2">
                    <Truncate value={formatPlDate(lead.ostatni_kontakt)} />
                  </td>
                  <td className="p-2">
                    {d === null ? (
                      "—"
                    ) : (
                      <span className={overdueRow ? "font-semibold text-orange-400" : "text-muted"}>{d}</span>
                    )}
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/${lang}/admin/leads/${lead.id}`}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
                          e.preventDefault();
                          onOpen(lead.id);
                        }}
                        className="flex text-muted hover:text-[var(--fg)]"
                        title="Otwórz profil"
                      >
                        <IconArrowUpRight size={15} />
                      </Link>
                      <button
                        onClick={() => onDelete(lead.id, lead.firma)}
                        className="flex text-muted hover:text-red-400"
                        aria-label={`Usuń ${lead.firma}`}
                        title="Usuń"
                      >
                        <IconX size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
