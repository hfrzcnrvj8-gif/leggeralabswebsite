"use client";

import type { Locale } from "@/i18n/config";
import { IconArrowUpRight, IconExternalLink, IconBuilding, IconMail, IconPhone, IconTrash } from "@tabler/icons-react";
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
        icon={<IconArrowUpRight size={14} />}
        label="Otwórz"
        onClick={() => run(() => onOpen(lead.id))}
      />
      <ContextMenuItem
        icon={<IconExternalLink size={14} />}
        label="Otwórz w nowej karcie"
        onClick={() =>
          run(() => window.open(`/${lang}/admin/leads/${lead.id}`, "_blank", "noopener"))
        }
      />

      <MenuDivider />
      <MenuLabel>Kopiuj</MenuLabel>
      <ContextMenuItem
        icon={<IconBuilding size={14} />}
        label="Nazwa firmy"
        onClick={() => run(() => void copy(lead.firma, "Nazwa firmy"))}
      />
      {lead.email && (
        <ContextMenuItem
          icon={<IconMail size={14} />}
          label="E-mail"
          onClick={() => run(() => void copy(lead.email, "E-mail"))}
        />
      )}
      {lead.telefon && (
        <ContextMenuItem
          icon={<IconPhone size={14} />}
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
        icon={<IconTrash size={14} />}
        label="Usuń"
        danger
        onClick={() => run(() => onDelete(lead.id, lead.firma))}
      />
    </>
  );
}
