"use client";

export {
  type Project,
  type ProjectTask,
  type ProjectActivity,
  type ProjectMilestone,
  type ProjectResource,
  PROJECT_STATUSES,
  PROJECT_PRIORITIES,
  PROJECT_STATUS_CLASS,
  PROJECT_STATUS_DOT,
  PROJECT_HEALTHS,
  PROJECT_HEALTH_CLASS,
  isProjectOverdue,
  progressOf,
} from "@/lib/projects";

import { PROJECT_STATUSES, PROJECT_STATUS_CLASS, PROJECT_HEALTHS, PROJECT_HEALTH_CLASS } from "@/lib/projects";
import { StatusPill } from "../components";

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
