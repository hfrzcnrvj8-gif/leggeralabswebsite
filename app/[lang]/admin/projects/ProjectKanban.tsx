"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  IconCircleDashed,
  IconCircle,
  IconProgress,
  IconProgressCheck,
  IconCircleCheckFilled,
  IconCircleMinus,
  IconPointFilled,
  IconAlertTriangleFilled,
  type Icon as TablerIcon,
} from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import { type Project, PROJECT_STATUSES, PROJECT_PRIORITIES, PROJECT_HEALTHS, isProjectOverdue, formatPlDate, ProjectIcon } from "./shared";
import {
  PropertyMenu,
  type MenuOption,
  ContextMenu,
  ContextMenuItem,
  MenuDivider,
  MenuLabel,
  useContextMenu,
} from "../Menu";
import { useCopy } from "../ui";

// Status jako ikona (styl Linear) — kształt koła oddaje etap, nie słowo.
const STATUS_ICON: Record<string, { icon: TablerIcon; className: string }> = {
  "Pomysł": { icon: IconCircleDashed, className: "text-[#8a8f98]" },
  "Planowanie": { icon: IconCircle, className: "text-[#8a8f98]" },
  "W trakcie": { icon: IconProgress, className: "text-[#e2a336]" },
  "Testy / review": { icon: IconProgressCheck, className: "text-[#4ea7fc]" },
  "Wdrożone": { icon: IconCircleCheckFilled, className: "text-[#3fb987]" },
  "Wstrzymane": { icon: IconCircleMinus, className: "text-[#8a8f98]" },
};

// Priorytet jako słupki sygnału (jak w Linear), Krytyczny = ostrzeżenie.
export function PriorityIcon({ priorytet }: { priorytet: string }) {
  if (priorytet === "Krytyczny") {
    return <IconAlertTriangleFilled size={13} className="shrink-0 text-[#e5484d]" title="Priorytet: Krytyczny" />;
  }
  const level = priorytet === "Niski" ? 1 : priorytet === "Normalny" ? 2 : priorytet === "Wysoki" ? 3 : 0;
  if (level === 0) return null;
  return (
    <span className="flex shrink-0 items-end gap-[1.5px]" title={`Priorytet: ${priorytet}`}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`w-[2.5px] rounded-[1px] ${i <= level ? "bg-[#8a8f98]" : "bg-[#2a2b2f]"}`}
          style={{ height: `${3 + i * 2}px` }}
        />
      ))}
    </span>
  );
}

export const HEALTH_COLOR: Record<string, string> = {
  "Na dobrej drodze": "text-[#3fb987]",
  "Zagrożony": "text-[#e2a336]",
  "Zerwany": "text-[#e5484d]",
};
const HEALTH_DOT: Record<string, string> = {
  "Zagrożony": "text-[#e2a336]",
  "Zerwany": "text-[#e5484d]",
};

export function statusIconEl(status: string, size = 15) {
  const st = STATUS_ICON[status];
  const Ico = st?.icon ?? IconCircle;
  return <Ico size={size} className={st?.className ?? "text-muted"} />;
}

// Listy opcji do menu (z ikonami) — budowane raz, współdzielone z panelem
// szczegółów, żeby wygląd właściwości był identyczny wszędzie.
export const STATUS_OPTS: MenuOption<string>[] = PROJECT_STATUSES.map((s) => ({
  value: s,
  label: s,
  icon: statusIconEl(s, 15),
}));
export const PRIORITY_OPTS: MenuOption<string>[] = PROJECT_PRIORITIES.map((p) => ({
  value: p,
  label: p,
  icon: <PriorityIcon priorytet={p} />,
}));
export const HEALTH_OPTS: MenuOption<string>[] = PROJECT_HEALTHS.map((h) => ({
  value: h,
  label: h,
  icon: <IconPointFilled size={12} className={HEALTH_COLOR[h] ?? "text-muted"} />,
}));

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
  const ctl = useContextMenu<Project>();
  const copy = useCopy();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const anySelected = selectedIds.size > 0;

  const columns = PROJECT_STATUSES.map((status) => ({
    status,
    items: projects.filter((p) => p.status === status),
  }));

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((col) => {
        const st = STATUS_ICON[col.status];
        const StatusIco = st?.icon ?? IconCircle;
        return (
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
            // Ten sam stan `dragOver` co w Leadach/Klientach (audyt
            // 2026-07-16) — wcześniej samo bledziutkie tło 0.04 bez obrysu,
            // ledwo widoczne przy przeciąganiu.
            className={`w-[300px] shrink-0 rounded-lg transition-colors ${
              dragOverStatus === col.status ? "bg-[#4ea7fc]/[0.08] ring-1 ring-[#4ea7fc]/40" : ""
            }`}
          >
            {/* Nagłówek kolumny — ikona statusu + nazwa + licznik, bez ramki */}
            <div className="mb-1 flex items-center gap-2 px-1 py-1.5">
              <StatusIco size={14} className={st?.className ?? "text-muted"} />
              <h3 className="text-[13px] font-medium text-[var(--fg)]">{col.status}</h3>
              <span className="text-[12px] text-muted">{col.items.length}</span>
            </div>

            <div className="flex min-h-[8px] flex-col gap-1.5">
              <AnimatePresence initial={false}>
                {col.items.map((p) => {
                  const overdue = isProjectOverdue(p);
                  const selected = selectedIds.has(p.id);
                  const showRisk = p.zdrowie && HEALTH_DOT[p.zdrowie];
                  const hasTasks = typeof p.task_total === "number" && p.task_total > 0;
                  return (
                    <motion.div
                      key={p.id}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                      draggable
                      onDragStart={(e) => {
                        (e as unknown as React.DragEvent).dataTransfer.setData("text/project-id", p.id);
                        setDraggingId(p.id);
                      }}
                      onDragEnd={() => setDraggingId(null)}
                      onClick={() => onOpen(p.id)}
                      onContextMenu={(e) => ctl.openAt(e, p)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") onOpen(p.id);
                      }}
                      className={`group relative cursor-pointer rounded-lg border bg-[var(--bg-soft)] px-3 py-2.5 transition-colors hover:border-[#3a3b40] active:cursor-grabbing ${
                        draggingId === p.id ? "opacity-40" : ""
                      } ${
                        selected ? "border-[#4ea7fc]/60 bg-[#4ea7fc]/[0.06]" : "border-[var(--hairline)]"
                      }`}
                    >
                      {/* Checkbox — na hover (lub gdy coś zaznaczone), lewy górny róg */}
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => {
                          e.stopPropagation();
                          onToggleSelect(p.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Zaznacz ${p.tytul}`}
                        className={`absolute left-2 top-2.5 h-3.5 w-3.5 cursor-pointer accent-[#4ea7fc] transition-opacity ${
                          anySelected || selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        }`}
                      />

                      {/* Tytuł ze statusem-ikoną (klikalną); przesuwa się gdy widać checkbox */}
                      <div
                        className={`flex items-start gap-2 transition-[margin] ${
                          anySelected ? "ml-5" : "group-hover:ml-5"
                        }`}
                      >
                        <span className="mt-[1px] shrink-0">
                          <PropertyMenu
                            value={p.status}
                            options={STATUS_OPTS}
                            onChange={(v) => onUpdate(p.id, "status", v)}
                            title="Zmień status"
                          >
                            {statusIconEl(p.status, 15)}
                          </PropertyMenu>
                        </span>
                        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] font-medium leading-snug text-[var(--fg)]">
                          <ProjectIcon kolor={p.kolor} ikona={p.ikona} size={16} />
                          <span className="min-w-0 flex-1">{p.tytul}</span>
                        </span>
                      </div>

                      {/* Wiersz meta — każda właściwość klikalna osobno (menu), ikony zamiast słów */}
                      <div className="mt-2 flex items-center gap-2 text-muted">
                        <PropertyMenu
                          value={p.priorytet}
                          options={PRIORITY_OPTS}
                          onChange={(v) => onUpdate(p.id, "priorytet", v)}
                          title={`Priorytet: ${p.priorytet}`}
                        >
                          <PriorityIcon priorytet={p.priorytet} />
                        </PropertyMenu>
                        <PropertyMenu
                          value={p.zdrowie}
                          options={HEALTH_OPTS}
                          onChange={(v) => onUpdate(p.id, "zdrowie", v)}
                          title={`Zdrowie: ${p.zdrowie}`}
                        >
                          <IconPointFilled
                            size={12}
                            className={`${HEALTH_COLOR[p.zdrowie] ?? "text-[#3a3b40]"} ${
                              showRisk ? "" : "opacity-40 group-hover:opacity-100"
                            }`}
                          />
                        </PropertyMenu>
                        {hasTasks && (
                          <span className="flex items-center gap-1">
                            <span className="h-1 w-8 overflow-hidden rounded-full bg-[#2a2b2f]">
                              <span
                                className="block h-full rounded-full bg-[#4ea7fc]"
                                style={{ width: `${Math.round(((p.task_done ?? 0) / (p.task_total ?? 1)) * 100)}%` }}
                              />
                            </span>
                            <span className="text-[11px]">{p.task_done ?? 0}/{p.task_total}</span>
                          </span>
                        )}
                        <span className="flex-1" />
                        {p.termin && (
                          <span className={`text-[11px] ${overdue ? "text-[#e5484d]" : "text-muted"}`}>
                            {formatPlDate(p.termin)}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        );
      })}
      <ContextMenu ctl={ctl}>
        {(p, close) => {
          const run = (fn: () => void) => {
            close();
            fn();
          };
          return (
            <>
              <ContextMenuItem icon="↗" label="Otwórz" onClick={() => run(() => onOpen(p.id))} />
              <ContextMenuItem
                icon="⧉"
                label="Otwórz w nowej karcie"
                onClick={() =>
                  run(() => window.open(`/${lang}/admin/projects/${p.id}`, "_blank", "noopener"))
                }
              />

              <MenuDivider />
              <ContextMenuItem
                icon="📝"
                label="Kopiuj tytuł"
                onClick={() => run(() => void copy(p.tytul, "Tytuł"))}
              />

              <MenuDivider />
              <MenuLabel>Status</MenuLabel>
              {PROJECT_STATUSES.filter((s) => s !== p.status).map((s) => (
                <ContextMenuItem
                  key={s}
                  label={s}
                  onClick={() => run(() => onUpdate(p.id, "status", s))}
                />
              ))}

              <MenuDivider />
              <ContextMenuItem
                icon="🗑"
                label="Usuń"
                danger
                onClick={() => run(() => onDelete(p.id, p.tytul))}
              />
            </>
          );
        }}
      </ContextMenu>
    </div>
  );
}

