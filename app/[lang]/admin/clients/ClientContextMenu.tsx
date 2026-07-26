"use client";

import type { Locale } from "@/i18n/config";
import {
  IconArrowUpRight,
  IconExternalLink,
  IconBuilding,
  IconHash,
  IconMail,
  IconPhone,
  IconTrash,
  IconBellPlus,
  IconCheck,
} from "@tabler/icons-react";
import { ContextMenuItem, MenuDivider, MenuLabel } from "../Menu";
import { useCopy } from "../ui";
import { type Client, CLIENT_STATUSES, isClientOverdue } from "./shared";
import { addDaysLocalISO, todayLocalISO } from "@/lib/dates";

/**
 * Treść menu kontekstowego klienta — wspólna dla Tablicy i Tabeli (ten sam
 * wzorzec co LeadMenuItems). Menu jest skrótem: widoczne przyciski zostają.
 * Kopiowanie NIP-u to realna wartość dodana — dziś nie ma na to przycisku
 * nigdzie w liście, a przy wystawianiu faktury/przelewie potrzebny jest stale.
 */
export function ClientMenuItems({
  client,
  lang,
  close,
  onUpdate,
  onDelete,
  onOpen,
}: {
  client: Client;
  lang: Locale;
  close: () => void;
  onUpdate: (id: string, field: string, value: string) => void;
  onDelete: (id: string, nazwa: string) => void;
  onOpen: (id: string) => void;
}) {
  const copy = useCopy();
  const run = (fn: () => void) => {
    close();
    fn();
  };

  return (
    <>
      {/* Parytet z menu przytrzymania w apce (2026-07-26). „Obsłużone" gasi
          przypomnienie i stawia dzisiejszy kontakt — świadomie NIE rusza
          statusu relacji, w odróżnieniu od leadów: u klienta status to długa
          oś, której jedna rozmowa nie przesuwa. */}
      {isClientOverdue(client) && (
        <ContextMenuItem
          icon={<IconCheck size={14} />}
          label="Oznacz jako obsłużone"
          onClick={() =>
            run(() => {
              onUpdate(client.id, "next_followup", "");
              onUpdate(client.id, "ostatni_kontakt", todayLocalISO());
            })
          }
        />
      )}
      <ContextMenuItem
        icon={<IconBellPlus size={14} />}
        label="Przypomnij za tydzień"
        onClick={() =>
          run(() => {
            onUpdate(client.id, "next_followup", addDaysLocalISO(7));
            onUpdate(client.id, "next_action", "wrócić do rozmowy");
          })
        }
      />
      <MenuDivider />
      <ContextMenuItem icon={<IconArrowUpRight size={14} />} label="Otwórz" onClick={() => run(() => onOpen(client.id))} />
      <ContextMenuItem
        icon={<IconExternalLink size={14} />}
        label="Otwórz w nowej karcie"
        onClick={() =>
          run(() => window.open(`/${lang}/admin/clients/${client.id}`, "_blank", "noopener"))
        }
      />

      <MenuDivider />
      <MenuLabel>Kopiuj</MenuLabel>
      <ContextMenuItem
        icon={<IconBuilding size={14} />}
        label="Nazwa"
        onClick={() => run(() => void copy(client.nazwa, "Nazwa"))}
      />
      {client.nip && (
        <ContextMenuItem icon={<IconHash size={14} />} label="NIP" onClick={() => run(() => void copy(client.nip, "NIP"))} />
      )}
      {client.email && (
        <ContextMenuItem
          icon={<IconMail size={14} />}
          label="E-mail"
          onClick={() => run(() => void copy(client.email, "E-mail"))}
        />
      )}
      {client.telefon && (
        <ContextMenuItem
          icon={<IconPhone size={14} />}
          label="Telefon"
          onClick={() => run(() => void copy(client.telefon, "Telefon"))}
        />
      )}

      <MenuDivider />
      <MenuLabel>Status</MenuLabel>
      {CLIENT_STATUSES.filter((s) => s !== client.status).map((s) => (
        <ContextMenuItem key={s} label={s} onClick={() => run(() => onUpdate(client.id, "status", s))} />
      ))}

      <MenuDivider />
      <ContextMenuItem
        icon={<IconTrash size={14} />}
        label="Usuń"
        danger
        onClick={() => run(() => onDelete(client.id, client.nazwa))}
      />
    </>
  );
}
