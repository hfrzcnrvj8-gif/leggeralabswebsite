"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Locale } from "@/i18n/config";
import {
  type Lead,
  STATUSES,
  STATUS_DOT,
  daysSince,
  isOverdue,
  leadSourceLabel,
  ContactChannelIcon,
  CONTACT_CHANNEL_LABEL,
  CONTACT_CHANNEL_CLASS,
  StatusTag,
} from "./shared";
import { ContextMenu, useContextMenu } from "../Menu";
import { LeadMenuItems } from "./LeadContextMenu";

export function KanbanBoard({
  leads,
  lang,
  selectedIds,
  onToggleSelect,
  onUpdate,
  onDelete,
  onOpen,
}: {
  leads: Lead[];
  lang: Locale;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onUpdate: (id: string, field: string, value: string) => void;
  onDelete: (id: string, firma: string) => void;
  onOpen: (id: string) => void;
}) {
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // Jedno menu na całą tablicę, nie na kartę — kliknięta karta siedzi w stanie.
  const ctl = useContextMenu<Lead>();

  const columns = STATUSES.map((status) => ({
    status,
    items: leads.filter((l) => l.status === status),
  }));

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {columns.map((col) => (
        <div
          key={col.status}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverStatus(col.status);
          }}
          onDragLeave={() => setDragOverStatus((s) => (s === col.status ? null : s))}
          onDrop={(e) => {
            e.preventDefault();
            const id = e.dataTransfer.getData("text/lead-id");
            if (id) onUpdate(id, "status", col.status);
            setDragOverStatus(null);
            setDraggingId(null);
          }}
          // Kolumna bez ramki i bez własnego tła (audyt wizualny 2026-07-16) —
          // wcześniej karta leada w obramowanej kolumnie dawała ramkę w ramce,
          // czyli dokładnie ten „poskładany z klocków” efekt, który zgłosił
          // właściciel. Tak samo wygląda Kanban Projektów i tak robi Linear.
          // Cenę za brak ramki płacimy przy przeciąganiu (nie widać pudełka
          // celu), więc stan `dragOver` jest tu MOCNIEJSZY niż był: obrys
          // `ring` + wyraźniejsze tło zamiast samej zmiany koloru ramki.
          className={`w-72 shrink-0 rounded-lg p-2 transition-colors ${
            dragOverStatus === col.status ? "bg-[#4ea7fc]/[0.08] ring-1 ring-[#4ea7fc]/40" : ""
          }`}
        >
          <div className="mb-2 flex items-center gap-2 px-1">
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[col.status] ?? "bg-[var(--fg-muted)]"}`} />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{col.status}</h3>
            <span className="ml-auto rounded-full bg-[var(--hairline)] px-1.5 py-0.5 text-[10px] text-muted">
              {col.items.length}
            </span>
          </div>

          <div className="flex min-h-[40px] flex-col gap-2">
            <AnimatePresence initial={false}>
            {col.items.map((lead) => {
              const overdue = isOverdue(lead);
              const d = daysSince(lead.ostatni_kontakt);
              return (
                <motion.div
                  key={lead.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  draggable
                  onDragStart={(e) => {
                    (e as unknown as React.DragEvent).dataTransfer.setData("text/lead-id", lead.id);
                    setDraggingId(lead.id);
                  }}
                  onDragEnd={() => setDraggingId(null)}
                  onClick={() => onOpen(lead.id)}
                  onContextMenu={(e) => ctl.openAt(e, lead)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onOpen(lead.id);
                  }}
                  className={`card-paper cursor-pointer rounded-xl p-2.5 transition-colors hover:border-[#4ea7fc]/30 active:cursor-grabbing ${
                    draggingId === lead.id ? "opacity-40" : ""
                  } ${overdue ? "border-orange-500/40" : ""} ${
                    selectedIds.has(lead.id) ? "border-[#4ea7fc]/50 bg-[#4ea7fc]/[0.06]" : ""
                  }`}
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <span className="flex min-w-0 items-start gap-1.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lead.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          onToggleSelect(lead.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-[#4ea7fc]"
                        aria-label={`Zaznacz ${lead.firma}`}
                      />
                      <span className="text-xs font-medium leading-snug">{lead.firma}</span>
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(lead.id, lead.firma);
                      }}
                      className="shrink-0 text-muted hover:text-red-400"
                      aria-label={`Usuń ${lead.firma}`}
                      title="Usuń"
                    >
                      ✕
                    </button>
                  </div>
                  {(lead.branza || lead.osoba_kontaktowa) && (
                    <div className="text-[11px] text-muted">
                      {[lead.branza, lead.osoba_kontaktowa].filter(Boolean).join(" · ")}
                    </div>
                  )}
                  {(lead.telefon || lead.email || lead.miasto) && (
                    <div className="mt-1 space-y-0.5 text-[11px] text-muted opacity-80">
                      {lead.telefon && <div className="break-words">{lead.telefon}</div>}
                      {lead.email && <div className="break-all">{lead.email}</div>}
                      {lead.miasto && <div className="break-words">{lead.miasto}</div>}
                    </div>
                  )}
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span onClick={(e) => e.stopPropagation()}>
                      <StatusTag status={lead.status} onChange={(v) => onUpdate(lead.id, "status", v)} />
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      {lead.ostatni_kanal && (
                        <span
                          aria-hidden
                          title={`Ostatni kontakt: ${CONTACT_CHANNEL_LABEL[lead.ostatni_kanal as keyof typeof CONTACT_CHANNEL_LABEL] ?? lead.ostatni_kanal}`}
                          className={`flex h-4 w-4 items-center justify-center rounded-full ${
                            CONTACT_CHANNEL_CLASS[lead.ostatni_kanal as keyof typeof CONTACT_CHANNEL_CLASS] ?? ""
                          }`}
                        >
                          <ContactChannelIcon kind={lead.ostatni_kanal} size={10} />
                        </span>
                      )}
                      {d !== null && (
                        <span className={`text-[10px] font-medium ${overdue ? "text-orange-400" : "text-muted"}`}>
                          {d} dni temu
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[10px] text-muted opacity-70">{leadSourceLabel(lead)}</div>
                </motion.div>
              );
            })}
            </AnimatePresence>
            {col.items.length === 0 && (
              <div className="rounded-xl border border-dashed hairline p-3 text-center text-[11px] text-muted opacity-50">
                Pusto
              </div>
            )}
          </div>
        </div>
      ))}
      <ContextMenu ctl={ctl}>
        {(lead, close) => (
          <LeadMenuItems
            lead={lead}
            lang={lang}
            close={close}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onOpen={onOpen}
          />
        )}
      </ContextMenu>
    </div>
  );
}
