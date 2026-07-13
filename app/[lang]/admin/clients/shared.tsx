"use client";

// Wzorem app/[lang]/admin/leads/shared.tsx — typy i czysta logika w
// lib/clients.ts, tu tylko re-eksport + StatusTag specyficzny dla klientów.
export {
  type Client,
  type ClientActivity,
  type ClientEvent,
  type ClientStatus,
  CLIENT_STATUSES,
  CLIENT_STATUS_CLASS,
  CLIENT_STATUS_DOT,
  CLIENT_STATUS_HINT,
  CLIENT_STATUS_STEP,
  CLIENT_EVENT_ICON,
  clientDaysSince,
  isClientOverdue,
  clientOverdueReason,
} from "@/lib/clients";

export {
  type ContactChannel,
  type ContactDirection,
  CONTACT_CHANNELS,
  CONTACT_CHANNEL_LABEL,
  CONTACT_CHANNEL_ICON,
  CONTACT_DIRECTIONS,
  CONTACT_DIRECTION_LABEL,
  waLink,
  linkedinLink,
} from "@/lib/contact";

export { SummaryCard, EditableText, EditableTextarea, ContactQuickActions, QuickDateChips } from "../components";

import { CLIENT_STATUSES, CLIENT_STATUS_CLASS, type ClientStatus } from "@/lib/clients";
import { StatusPill } from "../components";

export function StatusTag({
  status,
  onChange,
  className = "",
}: {
  status: ClientStatus;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <StatusPill value={status} options={CLIENT_STATUSES} classMap={CLIENT_STATUS_CLASS} onChange={onChange} className={className} />
  );
}
