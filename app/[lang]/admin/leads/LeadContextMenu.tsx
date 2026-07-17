"use client";

import type { Locale } from "@/i18n/config";
import { ContextMenuItem, MenuDivider, MenuLabel } from "../Menu";
import { useCopy } from "../ui";
import { type Lead, STATUSES } from "./shared";

/**
 * Treść menu kontekstowego leada — wspólna dla Tablicy i Tabeli, żeby prawy
 * przycisk dawał to samo niezależnie od widoku (i żeby nie rozjechały się przy
 * kolejnej zmianie).
 *
 * Menu jest SKRÓTEM, nie jedyną drogą: krzyżyk „Usuń" i StatusTag na karcie
 * zostają (odkrywalność — patrz brief Modułu 25). Wartość dokładana ponad
 * istniejące przyciski to kopiowanie danych kontaktowych i otwarcie w nowej
 * karcie — dziś nie ma na to żadnej afordancji.
 */
export function LeadMenuItems({
  lead,
  lang,
  close,
  onUpdate,
  onDelete,
  onOpen,
}: {
  lead: Lead;
  lang: Locale;
  close: () => void;
  onUpdate: (id: string, field: string, value: string) => void;
  onDelete: (id: string, firma: string) => void;
  onOpen: (id: string) => void;
}) {
  const copy = useCopy();
  const run = (fn: () => void) => {
    close();
    fn();
  };

  return (
    <>
      <ContextMenuItem
        icon="↗"
        label="Otwórz"
        onClick={() => run(() => onOpen(lead.id))}
      />
      <ContextMenuItem
        icon="⧉"
        label="Otwórz w nowej karcie"
        onClick={() =>
          run(() => window.open(`/${lang}/admin/leads/${lead.id}`, "_blank", "noopener"))
        }
      />

      <MenuDivider />
      <MenuLabel>Kopiuj</MenuLabel>
      <ContextMenuItem
        icon="🏢"
        label="Nazwa firmy"
        onClick={() => run(() => void copy(lead.firma, "Nazwa firmy"))}
      />
      {lead.email && (
        <ContextMenuItem
          icon="✉️"
          label="E-mail"
          onClick={() => run(() => void copy(lead.email, "E-mail"))}
        />
      )}
      {lead.telefon && (
        <ContextMenuItem
          icon="📞"
          label="Telefon"
          onClick={() => run(() => void copy(lead.telefon, "Telefon"))}
        />
      )}

      <MenuDivider />
      <MenuLabel>Status</MenuLabel>
      {STATUSES.filter((s) => s !== lead.status).map((s) => (
        <ContextMenuItem
          key={s}
          label={s}
          onClick={() => run(() => onUpdate(lead.id, "status", s))}
        />
      ))}

      <MenuDivider />
      <ContextMenuItem
        icon="🗑"
        label="Usuń"
        danger
        onClick={() => run(() => onDelete(lead.id, lead.firma))}
      />
    </>
  );
}
