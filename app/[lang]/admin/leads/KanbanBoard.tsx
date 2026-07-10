"use client";

import { useState } from "react";
import { type Lead, STATUSES, STATUS_DOT, daysSince, isOverdue } from "./shared";

export function KanbanBoard({
  leads,
  onUpdate,
  onDelete,
}: {
  leads: Lead[];
  onUpdate: (id: string, field: string, value: string) => void;
  onDelete: (id: string, firma: string) => void;
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
            {col.items.map((lead) => {
              const overdue = isOverdue(lead);
              const d = daysSince(lead.ostatni_kontakt);
              return (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/lead-id", lead.id);
                    setDraggingId(lead.id);
                  }}
                  onDragEnd={() => setDraggingId(null)}
                  className={`card-paper cursor-grab rounded-xl p-2.5 active:cursor-grabbing ${
                    draggingId === lead.id ? "opacity-40" : ""
                  } ${overdue ? "border-orange-500/40" : ""}`}
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <span className="text-xs font-medium leading-snug">{lead.firma}</span>
                    <button
                      onClick={() => onDelete(lead.id, lead.firma)}
                      className="shrink-0 text-muted hover:text-red-400"
                      title="Usuń"
                    >
                      ✕
                    </button>
                  </div>
                  {lead.branza && <div className="text-[11px] text-muted">{lead.branza}</div>}
                  {lead.kontakt && (
                    <div className="mt-1 truncate text-[11px] text-muted opacity-80" title={lead.kontakt}>
                      {lead.kontakt}
                    </div>
                  )}
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[10px] text-muted opacity-70">{lead.zrodlo}</span>
                    {d !== null && (
                      <span className={`text-[10px] font-medium ${overdue ? "text-orange-400" : "text-muted"}`}>
                        {d} dni temu
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
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
