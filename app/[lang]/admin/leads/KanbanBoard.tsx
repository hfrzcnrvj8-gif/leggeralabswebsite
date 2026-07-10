"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Locale } from "@/i18n/config";
import { type Lead, STATUSES, STATUS_DOT, daysSince, isOverdue, StatusTag } from "./shared";

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
          className={`w-72 shrink-0 rounded-2xl border p-2 transition-colors ${
            dragOverStatus === col.status
              ? "border-brand-cyan/50 bg-brand-cyan/[0.05]"
              : "border hairline bg-[var(--bg-soft)]/60"
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
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onOpen(lead.id);
                  }}
                  className={`card-paper cursor-pointer rounded-xl p-2.5 transition-colors hover:border-brand-cyan/30 active:cursor-grabbing ${
                    draggingId === lead.id ? "opacity-40" : ""
                  } ${overdue ? "border-orange-500/40" : ""} ${
                    selectedIds.has(lead.id) ? "border-brand-purple/50 bg-brand-purple/[0.06]" : ""
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
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-brand-cyan"
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
                  {lead.branza && <div className="text-[11px] text-muted">{lead.branza}</div>}
                  {(lead.telefon || lead.email || lead.www) && (
                    <div className="mt-1 space-y-0.5 text-[11px] text-muted opacity-80">
                      {lead.telefon && <div className="break-words">{lead.telefon}</div>}
                      {lead.email && <div className="break-all">{lead.email}</div>}
                      {lead.www && <div className="break-all">{lead.www}</div>}
                    </div>
                  )}
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span onClick={(e) => e.stopPropagation()}>
                      <StatusTag status={lead.status} onChange={(v) => onUpdate(lead.id, "status", v)} />
                    </span>
                    {d !== null && (
                      <span className={`shrink-0 text-[10px] font-medium ${overdue ? "text-orange-400" : "text-muted"}`}>
                        {d} dni temu
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[10px] text-muted opacity-70">{lead.zrodlo}</div>
                </motion.div>
              );
            })}
            </AnimatePresence>
            {col.items.length === 0 && (
              <div className="rounded-xl border border-dashed hairline p-3 text-center text-[11px] text-muted opacity-50">
                🌤️ Pusto
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
