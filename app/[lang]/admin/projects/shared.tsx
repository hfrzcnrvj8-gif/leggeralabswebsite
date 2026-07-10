"use client";

export {
  type Project,
  type ProjectTask,
  type ProjectActivity,
  PROJECT_STATUSES,
  PROJECT_PRIORITIES,
  PROJECT_STATUS_CLASS,
  PROJECT_STATUS_DOT,
  isProjectOverdue,
} from "@/lib/projects";

import { PROJECT_STATUSES, PROJECT_STATUS_CLASS } from "@/lib/projects";
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
