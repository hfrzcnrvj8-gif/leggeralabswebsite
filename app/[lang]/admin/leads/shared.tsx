"use client";

// Typy i czysta logika (bez React) mieszkają w lib/leads.ts, żeby mogły być
// re-używane też przez serwerowy route wysyłający dzienny raport mailowy —
// tu tylko re-eksportujemy je dla wygody istniejących importów. Generyczne
// komponenty UI (EditableText/EditableTextarea/SummaryCard) mieszkają w
// ../components.tsx, współdzielone z modułem projektów.
export {
  type Lead,
  type Activity,
  type SeedLead,
  STATUSES,
  STATUS_CLASS,
  STATUS_DOT,
  SEED,
  SOURCE_CATEGORIES,
  LEAD_STATUS_HINT,
  LEAD_STATUS_STEP,
  daysSince,
  isOverdue,
  overdueReason,
  leadSourceLabel,
  guessSourceCategory,
  findSimilarLead,
} from "@/lib/leads";

export {
  type ContactChannel,
  type ContactDirection,
  type CallOutcome,
  CONTACT_CHANNELS,
  CONTACT_CHANNEL_LABEL,
  CONTACT_CHANNEL_ICON,
  CONTACT_CHANNEL_CLASS,
  CONTACT_DIRECTIONS,
  CONTACT_DIRECTION_LABEL,
  CALL_OUTCOMES,
  CALL_OUTCOME_LABEL,
  CALL_OUTCOME_ICON,
  CALL_OUTCOME_CLASS,
  formatCallDuration,
  waLink,
  linkedinLink,
} from "@/lib/contact";

export { SummaryCard, EditableText, EditableTextarea, ContactQuickActions, QuickDateChips } from "../components";

import { STATUSES, STATUS_CLASS } from "@/lib/leads";
import { StatusPill } from "../components";

/**
 * Klikalna "pigułka" statusu leada — cienki wrapper na generyczny StatusPill
 * z listą statusów/kolorów właściwą dla leadów.
 */
export function StatusTag({
  status,
  onChange,
  className = "",
}: {
  status: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <StatusPill value={status} options={STATUSES} classMap={STATUS_CLASS} onChange={onChange} className={className} />
  );
}
