"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { Locale } from "@/i18n/config";
import { type Lead, STATUSES, STATUS_DOT, daysSince, isOverdue, StatusTag } from "./shared";

export function KanbanBoard({
  leads,
  lang,
  onUpdate,
  onDelete,
  onOpen,
}: {
  leads: Lead[];
  lang: Locale;
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
                  className={`card-paper cursor-grab rounded-xl p-2.5 active:cursor-grabbing ${
                    draggingId === lead.id ? "opacity-40" : ""
                  } ${overdue ? "border-orange-500/40" : ""}`}
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <Link
                      href={`/${lang}/admin/leads/${lead.id}`}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
                        e.preventDefault();
                        onOpen(lead.id);
                      }}
                      className="text-xs font-medium leading-snug hover:underline"
                    >
                      {lead.firma}
                    </Link>
                    <button
                      onClick={() => onDelete(lead.id, lead.firma)}
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
                    <StatusTag status={lead.status} onChange={(v) => onUpdate(lead.id, "status", v)} />
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
                Pusto
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
