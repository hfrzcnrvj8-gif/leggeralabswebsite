"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import {
  type Lead,
  daysSince,
  isOverdue,
  EditableText,
  EditableTextarea,
  StatusTag,
} from "./shared";

export function TableView({
  leads,
  lang,
  selectedId,
  onUpdate,
  onDelete,
  onOpen,
}: {
  leads: Lead[];
  lang: Locale;
  selectedId?: string | null;
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
          (styl Linear) — bez tego nie było widać, że tabela w ogóle scrolluje. */}
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
        className="max-h-[70vh] overflow-auto rounded-2xl"
      >
        <table className="w-full text-xs">
          <thead>
            <tr className="sticky top-0 z-10 border-b hairline bg-[var(--bg-soft)] text-left uppercase tracking-wide text-muted">
              <th className="min-w-[140px] bg-[var(--bg-soft)] p-2">Firma</th>
              <th className="min-w-[110px] bg-[var(--bg-soft)] p-2">Branża</th>
              <th className="min-w-[110px] bg-[var(--bg-soft)] p-2">Telefon</th>
              <th className="min-w-[150px] bg-[var(--bg-soft)] p-2">Email</th>
              <th className="min-w-[130px] bg-[var(--bg-soft)] p-2">WWW</th>
              <th className="min-w-[110px] bg-[var(--bg-soft)] p-2">Źródło</th>
              <th className="min-w-[100px] bg-[var(--bg-soft)] p-2">Status</th>
              <th className="min-w-[110px] bg-[var(--bg-soft)] p-2">Ostatni kontakt</th>
              <th className="bg-[var(--bg-soft)] p-2">Dni</th>
              <th className="min-w-[220px] bg-[var(--bg-soft)] p-2">Notatki</th>
              <th className="bg-[var(--bg-soft)] p-2"></th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr>
                <td colSpan={11} className="p-8 text-center text-sm text-muted opacity-60">
                  Brak leadów pasujących do filtrów.
                </td>
              </tr>
            )}
            {leads.map((lead) => {
              const d = daysSince(lead.ostatni_kontakt);
              const overdueRow = isOverdue(lead);
              const selected = selectedId === lead.id;
              return (
                <tr
                  key={lead.id}
                  className={`border-b hairline align-top transition-colors ${
                    overdueRow ? "bg-orange-500/[0.06]" : ""
                  } ${selected ? "bg-brand-cyan/[0.08]" : ""}`}
                >
                  <td className="p-2">
                    <EditableText value={lead.firma} onSave={(v) => onUpdate(lead.id, "firma", v)} />
                  </td>
                  <td className="p-2">
                    <EditableText value={lead.branza} onSave={(v) => onUpdate(lead.id, "branza", v)} />
                  </td>
                  <td className="p-2">
                    <EditableText value={lead.telefon} onSave={(v) => onUpdate(lead.id, "telefon", v)} />
                  </td>
                  <td className="p-2">
                    <EditableText value={lead.email} onSave={(v) => onUpdate(lead.id, "email", v)} />
                  </td>
                  <td className="p-2">
                    <EditableText value={lead.www} onSave={(v) => onUpdate(lead.id, "www", v)} />
                  </td>
                  <td className="p-2">
                    <EditableText value={lead.zrodlo} onSave={(v) => onUpdate(lead.id, "zrodlo", v)} />
                  </td>
                  <td className="p-2">
                    <StatusTag status={lead.status} onChange={(v) => onUpdate(lead.id, "status", v)} />
                  </td>
                  <td className="p-2">
                    <input
                      type="date"
                      value={lead.ostatni_kontakt ?? ""}
                      onChange={(e) => onUpdate(lead.id, "ostatni_kontakt", e.target.value)}
                      className="rounded-lg border border-transparent bg-transparent text-xs text-[var(--fg)] hover:border-[var(--hairline)] focus:border-brand-cyan/60 focus:outline-none"
                    />
                  </td>
                  <td className="p-2">
                    {d === null ? (
                      "—"
                    ) : (
                      <span className={overdueRow ? "font-semibold text-orange-400" : "text-muted"}>{d} dni</span>
                    )}
                  </td>
                  <td className="p-2">
                    <EditableTextarea value={lead.notatki} onSave={(v) => onUpdate(lead.id, "notatki", v)} />
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
                        className="text-muted hover:text-[var(--fg)]"
                        title="Otwórz szczegóły"
                      >
                        ↗
                      </Link>
                      <button
                        onClick={() => onDelete(lead.id, lead.firma)}
                        className="text-muted hover:text-red-400"
                        aria-label={`Usuń ${lead.firma}`}
                        title="Usuń"
                      >
                        ✕
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
