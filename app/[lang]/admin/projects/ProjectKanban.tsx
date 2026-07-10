"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { Locale } from "@/i18n/config";
import {
  type Project,
  PROJECT_STATUSES,
  PROJECT_STATUS_DOT,
  PROJECT_HEALTH_CLASS,
  isProjectOverdue,
  ProjectStatusTag,
} from "./shared";

export function ProjectKanban({
  projects,
  lang,
  onUpdate,
  onDelete,
  onOpen,
}: {
  projects: Project[];
  lang: Locale;
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
              ? "border-brand-cyan/50 bg-brand-cyan/[0.05]"
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
                  className={`card-paper cursor-grab rounded-xl p-2.5 active:cursor-grabbing ${
                    draggingId === p.id ? "opacity-40" : ""
                  } ${overdue ? "border-orange-500/40" : ""}`}
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <Link
                      href={`/${lang}/admin/projects/${p.id}`}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
                        e.preventDefault();
                        onOpen(p.id);
                      }}
                      className="text-xs font-medium leading-snug hover:underline"
                    >
                      {p.tytul}
                    </Link>
                    <button
                      onClick={() => onDelete(p.id, p.tytul)}
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
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <ProjectStatusTag status={p.status} onChange={(v) => onUpdate(p.id, "status", v)} />
                    <div className="flex shrink-0 items-center gap-2">
                      {typeof p.task_total === "number" && p.task_total > 0 && (
                        <span className="text-[10px] text-muted">{p.task_done}/{p.task_total} zadań</span>
                      )}
                      {p.termin && (
                        <span className={`text-[10px] font-medium ${overdue ? "text-orange-400" : "text-muted"}`}>
                          termin: {p.termin}
                        </span>
                      )}
                    </div>
                  </div>
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
