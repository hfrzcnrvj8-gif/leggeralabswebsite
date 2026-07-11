"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Locale } from "@/i18n/config";
import {
  type Project,
  PROJECT_STATUSES,
  PROJECT_STATUS_DOT,
  PROJECT_HEALTH_CLASS,
  isProjectOverdue,
  ProjectStatusTag,
  formatPlDate,
} from "./shared";

export function ProjectKanban({
  projects,
  lang,
  selectedIds,
  onToggleSelect,
  onUpdate,
  onDelete,
  onOpen,
}: {
  projects: Project[];
  lang: Locale;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onUpdate: (id: string, field: string, value: string) => void;
  onDelete: (id: string, tytul: string) => void;
  onOpen: (id: string) => void;
}) {
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const columns = PROJECT_STATUSES.map((status) => ({
    status,
    items: projects.filter((p) => p.status === status),
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
            const id = e.dataTransfer.getData("text/project-id");
            if (id) onUpdate(id, "status", col.status);
            setDragOverStatus(null);
            setDraggingId(null);
          }}
          className={`w-72 shrink-0 rounded-2xl border p-2 transition-colors ${
            dragOverStatus === col.status
              ? "border-[#4ea7fc]/50 bg-[#4ea7fc]/[0.05]"
              : "border hairline bg-[var(--bg-soft)]/60"
          }`}
        >
          <div className="mb-2 flex items-center gap-2 px-1">
            <span className={`h-2 w-2 rounded-full ${PROJECT_STATUS_DOT[col.status] ?? "bg-[var(--fg-muted)]"}`} />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{col.status}</h3>
            <span className="ml-auto rounded-full bg-[var(--hairline)] px-1.5 py-0.5 text-[10px] text-muted">
              {col.items.length}
            </span>
          </div>

          <div className="flex min-h-[40px] flex-col gap-2">
            <AnimatePresence initial={false}>
            {col.items.map((p) => {
              const overdue = isProjectOverdue(p);
              return (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  draggable
                  onDragStart={(e) => {
                    (e as unknown as React.DragEvent).dataTransfer.setData("text/project-id", p.id);
                    setDraggingId(p.id);
                  }}
                  onDragEnd={() => setDraggingId(null)}
                  onClick={() => onOpen(p.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onOpen(p.id);
                  }}
                  className={`card-paper cursor-pointer rounded-xl p-2.5 transition-colors hover:border-[#4ea7fc]/30 active:cursor-grabbing ${
                    draggingId === p.id ? "opacity-40" : ""
                  } ${overdue ? "border-orange-500/40" : ""} ${
                    selectedIds.has(p.id) ? "border-[#4ea7fc]/50 bg-[#4ea7fc]/[0.06]" : ""
                  }`}
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <span className="flex min-w-0 items-start gap-1.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          onToggleSelect(p.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-[#4ea7fc]"
                        aria-label={`Zaznacz ${p.tytul}`}
                      />
                      <span className="text-xs font-medium leading-snug">{p.tytul}</span>
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(p.id, p.tytul);
                      }}
                      className="shrink-0 text-muted hover:text-red-400"
                      aria-label={`Usuń ${p.tytul}`}
                      title="Usuń"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    {p.zdrowie && p.zdrowie !== "Na dobrej drodze" && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${PROJECT_HEALTH_CLASS[p.zdrowie] ?? ""}`}>
                        {p.zdrowie}
                      </span>
                    )}
                    {p.priorytet && <span className="text-[11px] text-muted">Priorytet: {p.priorytet}</span>}
                  </div>
                  {typeof p.task_total === "number" && p.task_total > 0 && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--hairline)]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#4ea7fc] to-[#4ea7fc] transition-all"
                          style={{ width: `${Math.round(((p.task_done ?? 0) / p.task_total) * 100)}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-[10px] text-muted">{p.task_done ?? 0}/{p.task_total}</span>
                    </div>
                  )}
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span onClick={(e) => e.stopPropagation()}>
                      <ProjectStatusTag status={p.status} onChange={(v) => onUpdate(p.id, "status", v)} />
                    </span>
                    {p.termin && (
                      <span className={`shrink-0 text-[10px] font-medium ${overdue ? "text-orange-400" : "text-muted"}`}>
                        termin: {formatPlDate(p.termin)}
                      </span>
                    )}
                  </div>
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
