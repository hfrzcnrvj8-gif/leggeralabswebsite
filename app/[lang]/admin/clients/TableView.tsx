"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { IconArrowUpRight, IconX, IconInbox } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import {
  type Client,
  clientDaysSince,
  isClientOverdue,
  EditableText,
  EditableTextarea,
  StatusTag,
} from "./shared";
import { DateField } from "../DatePicker";

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
              <th className="min-w-[110px] bg-[var(--bg-soft)] p-2">Ostatni kontakt</th>
              <th className="bg-[var(--bg-soft)] p-2">Dni</th>
              <th className="min-w-[220px] bg-[var(--bg-soft)] p-2">Notatki</th>
              <th className="bg-[var(--bg-soft)] p-2"></th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 && (
              <tr>
                <td colSpan={10} className="p-8 text-center text-sm text-muted opacity-60">
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
                    <EditableText value={client.nazwa} onSave={(v) => onUpdate(client.id, "nazwa", v)} />
                  </td>
                  <td className="p-2">
                    <EditableText value={client.branza} onSave={(v) => onUpdate(client.id, "branza", v)} />
                  </td>
                  <td className="p-2">
                    <EditableText value={client.telefon} onSave={(v) => onUpdate(client.id, "telefon", v)} />
                  </td>
                  <td className="p-2">
                    <EditableText value={client.email} onSave={(v) => onUpdate(client.id, "email", v)} />
                  </td>
                  <td className="p-2">
                    <StatusTag status={client.status} onChange={(v) => onUpdate(client.id, "status", v)} />
                  </td>
                  <td className="p-2">
                    <DateField value={client.ostatni_kontakt ?? ""} onChange={(v) => onUpdate(client.id, "ostatni_kontakt", v)} placeholder="—" />
                  </td>
                  <td className="p-2">
                    {d === null ? "—" : <span className={overdueRow ? "font-semibold text-orange-400" : "text-muted"}>{d} dni</span>}
                  </td>
                  <td className="p-2">
                    <EditableTextarea value={client.notatki} onSave={(v) => onUpdate(client.id, "notatki", v)} />
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
