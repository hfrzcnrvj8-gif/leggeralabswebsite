"use client";

export {
  type Project,
  type ProjectTask,
  type ProjectActivity,
  type ProjectMilestone,
  type ProjectResource,
  type ProjectOnboardingItem,
  DEFAULT_ONBOARDING_ITEMS,
  ONBOARDING_INCOMPLETE_HINT,
  buildOnboardingWelcomeMessage,
  PROJECT_STATUSES,
  PROJECT_PRIORITIES,
  PROJECT_STATUS_CLASS,
  PROJECT_STATUS_DOT,
  PROJECT_HEALTHS,
  PROJECT_HEALTH_CLASS,
  isProjectOverdue,
  progressOf,
  isPlausibleDateString,
  formatPlDate,
  relativeDeadline,
  daysFromToday,
  PROJECT_COLORS,
  PROJECT_ICONS,
  DEFAULT_PROJECT_COLOR,
  DEFAULT_PROJECT_ICON,
  PROJECT_STATUS_HEX,
  DEFAULT_STATUS_HEX,
} from "@/lib/projects";

import {
  PROJECT_STATUSES,
  PROJECT_STATUS_CLASS,
  PROJECT_HEALTHS,
  PROJECT_HEALTH_CLASS,
  PROJECT_COLORS as COLORS,
  PROJECT_ICONS as ICONS,
  DEFAULT_PROJECT_COLOR as DEF_COLOR,
  DEFAULT_PROJECT_ICON as DEF_ICON,
} from "@/lib/projects";
import { IconCheck } from "@tabler/icons-react";
import { StatusPill } from "../components";
import { Popover } from "../Menu";

/** Kolorowy kwadracik-ikona projektu (emoji na przygaszonym tle koloru
 * akcentu) — tożsamość projektu w listach, na tablicy i osi czasu. */
export function ProjectIcon({
  kolor,
  ikona,
  size = 16,
  className = "",
}: {
  kolor?: string | null;
  ikona?: string | null;
  size?: number;
  className?: string;
}) {
  const color = kolor || DEF_COLOR;
  const icon = ikona || DEF_ICON;
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-[5px] ${className}`}
      style={{ width: size, height: size, backgroundColor: `${color}33`, fontSize: Math.round(size * 0.62), lineHeight: 1 }}
    >
      {icon}
    </span>
  );
}

/** Wybór koloru + ikony projektu — klik w ikonę otwiera popover z paletą
 * kolorów i siatką emoji. Nie zamyka się po każdym wyborze, żeby dało się
 * ustawić i kolor, i ikonę za jednym otwarciem. */
export function ProjectIconPicker({
  kolor,
  ikona,
  onChange,
  size = 32,
}: {
  kolor?: string | null;
  ikona?: string | null;
  onChange: (patch: { kolor?: string; ikona?: string }) => void;
  size?: number;
}) {
  const curColor = kolor || DEF_COLOR;
  const curIcon = ikona || DEF_ICON;
  return (
    <Popover
      align="left"
      width={232}
      trigger={(open) => (
        <button onClick={open} className="rounded-[6px] transition-transform hover:scale-105" title="Kolor i ikona projektu">
          <ProjectIcon kolor={kolor} ikona={ikona} size={size} />
        </button>
      )}
    >
      {() => (
        <div className="p-2.5">
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[#62666d]">Kolor</div>
          <div className="mb-3 grid grid-cols-5 gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onChange({ kolor: c })}
                className="flex h-7 w-7 items-center justify-center rounded-md"
                style={{ backgroundColor: c }}
                title={c}
              >
                {curColor === c && <IconCheck size={15} className="text-white drop-shadow" />}
              </button>
            ))}
          </div>
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[#62666d]">Ikona</div>
          <div className="grid grid-cols-8 gap-1">
            {ICONS.map((ic) => (
              <button
                key={ic}
                onClick={() => onChange({ ikona: ic })}
                className={`flex h-6 w-6 items-center justify-center rounded-md text-[14px] hover:bg-[#232327] ${
                  curIcon === ic ? "bg-[#232327] ring-1 ring-[#4ea7fc]/60" : ""
                }`}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>
      )}
    </Popover>
  );
}

export function ProjectStatusTag({
  status,
  onChange,
  className = "",
}: {
  status: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <StatusPill
      value={status}
      options={PROJECT_STATUSES}
      classMap={PROJECT_STATUS_CLASS}
      onChange={onChange}
      className={className}
    />
  );
}

/** Pigułka "zdrowia" projektu (Na dobrej drodze/Zagrożony/Zerwany) —
 * niezależna od statusu na tablicy, ustawiana ręcznie, styl Linear. */
export function ProjectHealthTag({
  zdrowie,
  onChange,
  className = "",
}: {
  zdrowie: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <StatusPill
      value={zdrowie}
      options={PROJECT_HEALTHS}
      classMap={PROJECT_HEALTH_CLASS}
      onChange={onChange}
      className={className}
    />
  );
}
