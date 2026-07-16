"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { IconArrowUpRight, IconX, IconInbox } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import {
  type Client,
  clientDaysSince,
  isClientOverdue,
  CONTACT_CHANNEL_ICON,
  CONTACT_CHANNEL_LABEL,
  CONTACT_CHANNEL_CLASS,
  StatusTag,
} from "./shared";
import { Truncate } from "../components";
import { formatPlDate } from "@/lib/projects";

/**
 * Lista = tylko podgląd (Moduł 23, decyzja właściciela 2026-07-16: „lista jest
 * spisem, dane zmienia się w wizytówce" — WSZĘDZIE, nie tylko w leadach).
 *
 * Do 2026-07-17 dało się tu edytować inline 7 pól (nazwa, branża, telefon,
 * email, status, ostatni kontakt, notatki), co rozjeżdżało się z listą leadów,
 * która od początku była samym spisem. Zostaje wyłącznie **status** — jedyna
 * rzecz zmieniana w tabeli setki razy w tygodniu, i to nie „dana stała", tylko
 * bieżący etap pracy (dokładnie to samo uzasadnienie co w leads/TableView.tsx).
 * Reszta idzie przez profil, otwierany klikiem w nazwę albo ikoną obok.
 */
export function TableView({
  clients,
  lang,
  selectedId,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onUpdate,
  onDelete,
  onOpen,
}: {
  clients: Client[];
  lang: Locale;
  selectedId?: string | null;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onUpdate: (id: string, field: string, value: string) => void;
  onDelete: (id: string, nazwa: string) => void;
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
      <div ref={scrollRef} onScroll={updateScrollShadows} className="max-h-[70vh] overflow-auto rounded-2xl">
        <table className="w-full text-xs">
          <thead>
            <tr className="sticky top-0 z-10 border-b hairline bg-[var(--bg-soft)] text-left uppercase tracking-wide text-muted">
              <th className="bg-[var(--bg-soft)] p-2">
                <input
                  type="checkbox"
                  checked={clients.length > 0 && clients.every((c) => selectedIds.has(c.id))}
                  onChange={(e) => onToggleSelectAll(e.target.checked)}
                  className="h-3.5 w-3.5 cursor-pointer accent-[#4ea7fc]"
                  aria-label="Zaznacz wszystkie"
                />
              </th>
              <th className="min-w-[160px] bg-[var(--bg-soft)] p-2">Nazwa</th>
              <th className="min-w-[110px] bg-[var(--bg-soft)] p-2">Branża</th>
              <th className="min-w-[110px] bg-[var(--bg-soft)] p-2">Telefon</th>
              <th className="min-w-[150px] bg-[var(--bg-soft)] p-2">Email</th>
              <th className="min-w-[100px] bg-[var(--bg-soft)] p-2">Status</th>
              <th className="min-w-[70px] bg-[var(--bg-soft)] p-2">Ocena</th>
              <th className="min-w-[110px] bg-[var(--bg-soft)] p-2">Ostatni kontakt</th>
              <th className="bg-[var(--bg-soft)] p-2">Dni</th>
              <th className="min-w-[220px] bg-[var(--bg-soft)] p-2">Notatki</th>
              <th className="bg-[var(--bg-soft)] p-2"></th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 && (
              <tr>
                <td colSpan={11} className="p-8 text-center text-sm text-muted opacity-60">
                  <IconInbox size={18} className="mx-auto mb-1.5 opacity-70" />
                  Brak klientów pasujących do filtrów.
                </td>
              </tr>
            )}
            {clients.map((client) => {
              const d = clientDaysSince(client.ostatni_kontakt);
              const overdueRow = isClientOverdue(client);
              const selected = selectedId === client.id;
              const checked = selectedIds.has(client.id);
              return (
                <tr
                  key={client.id}
                  className={`border-b hairline align-top transition-colors ${
                    overdueRow ? "bg-orange-500/[0.06]" : ""
                  } ${selected ? "bg-[#4ea7fc]/[0.08]" : ""} ${checked ? "bg-[#4ea7fc]/[0.08]" : ""}`}
                >
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleSelect(client.id)}
                      className="h-3.5 w-3.5 cursor-pointer accent-[#4ea7fc]"
                      aria-label={`Zaznacz ${client.nazwa}`}
                    />
                  </td>
                  <td className="p-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <button
                        onClick={() => onOpen(client.id)}
                        className="block min-w-0 flex-1 truncate text-left font-medium text-[var(--fg)] hover:underline"
                        title={client.nazwa}
                      >
                        {client.nazwa}
                      </button>
                      {client.ostatni_kanal && (
                        <span
                          aria-hidden
                          title={`Ostatni kontakt: ${CONTACT_CHANNEL_LABEL[client.ostatni_kanal as keyof typeof CONTACT_CHANNEL_LABEL] ?? client.ostatni_kanal}`}
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] ${
                            CONTACT_CHANNEL_CLASS[client.ostatni_kanal as keyof typeof CONTACT_CHANNEL_CLASS] ?? ""
                          }`}
                        >
                          {CONTACT_CHANNEL_ICON[client.ostatni_kanal as keyof typeof CONTACT_CHANNEL_ICON]}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-2">
                    <Truncate value={client.branza} />
                  </td>
                  <td className="p-2">
                    <Truncate value={client.telefon} />
                  </td>
                  <td className="p-2">
                    <Truncate value={client.email} />
                    {client.linkedin_url && (
                      <Truncate value={`🔗 ${client.linkedin_url}`} className="text-[11px] text-muted opacity-80" />
                    )}
                  </td>
                  <td className="p-2">
                    <StatusTag status={client.status} onChange={(v) => onUpdate(client.id, "status", v)} />
                  </td>
                  <td className="p-2">
                    {client.avg_rating != null ? (
                      <span className="text-brand-gold" title={`Średnia ocena z opinii: ${client.avg_rating.toFixed(1)}/5`}>
                        ★ {client.avg_rating.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-muted opacity-50">—</span>
                    )}
                  </td>
                  <td className="p-2">
                    <Truncate value={formatPlDate(client.ostatni_kontakt)} />
                  </td>
                  <td className="p-2">
                    {d === null ? "—" : <span className={overdueRow ? "font-semibold text-orange-400" : "text-muted"}>{d} dni</span>}
                  </td>
                  <td className="p-2">
                    <Truncate value={client.notatki} />
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/${lang}/admin/clients/${client.id}`}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
                          e.preventDefault();
                          onOpen(client.id);
                        }}
                        className="flex text-muted hover:text-[var(--fg)]"
                        title="Otwórz szczegóły"
                      >
                        <IconArrowUpRight size={15} />
                      </Link>
                      <button
                        onClick={() => onDelete(client.id, client.nazwa)}
                        className="flex text-muted hover:text-red-400"
                        aria-label={`Usuń ${client.nazwa}`}
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
