"use client";

import type { Locale } from "@/i18n/config";
import { ContextMenuItem, MenuDivider, MenuLabel } from "../Menu";
import { useCopy } from "../ui";
import { type Client, CLIENT_STATUSES } from "./shared";

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
      <ContextMenuItem icon="↗" label="Otwórz" onClick={() => run(() => onOpen(client.id))} />
      <ContextMenuItem
        icon="⧉"
        label="Otwórz w nowej karcie"
        onClick={() =>
          run(() => window.open(`/${lang}/admin/clients/${client.id}`, "_blank", "noopener"))
        }
      />

      <MenuDivider />
      <MenuLabel>Kopiuj</MenuLabel>
      <ContextMenuItem
        icon="🏢"
        label="Nazwa"
        onClick={() => run(() => void copy(client.nazwa, "Nazwa"))}
      />
      {client.nip && (
        <ContextMenuItem icon="#️⃣" label="NIP" onClick={() => run(() => void copy(client.nip, "NIP"))} />
      )}
      {client.email && (
        <ContextMenuItem
          icon="✉️"
          label="E-mail"
          onClick={() => run(() => void copy(client.email, "E-mail"))}
        />
      )}
      {client.telefon && (
        <ContextMenuItem
          icon="📞"
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
        icon="🗑"
        label="Usuń"
        danger
        onClick={() => run(() => onDelete(client.id, client.nazwa))}
      />
    </>
  );
}
