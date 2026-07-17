"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Locale } from "@/i18n/config";
import {
  type Client,
  CLIENT_STATUSES,
  CLIENT_STATUS_DOT,
  clientDaysSince,
  isClientOverdue,
  ContactChannelIcon,
  CONTACT_CHANNEL_LABEL,
  CONTACT_CHANNEL_CLASS,
  StatusTag,
} from "./shared";
import { ContextMenu, useContextMenu } from "../Menu";
import { Tooltip } from "../Tooltip";
import { ContactChannelMenuItems, hasChannelActions } from "../ContactChannelMenu";
import { daysAgoLabel } from "@/lib/dates";
import { ClientMenuItems } from "./ClientContextMenu";

export function KanbanBoard({
  clients,
  lang,
  selectedIds,
  onToggleSelect,
  onUpdate,
  onDelete,
  onOpen,
  activeChannel,
  onFilterChannel,
}: {
  clients: Client[];
  lang: Locale;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onUpdate: (id: string, field: string, value: string) => void;
  onDelete: (id: string, nazwa: string) => void;
  onOpen: (id: string) => void;
  /** Aktualnie filtrowany kanał — jego odznaka jest podświetlona. */
  activeChannel?: string;
  /** Klik w odznakę kanału filtruje listę (Moduł 34). */
  onFilterChannel?: (kanal: string) => void;
}) {
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const ctl = useContextMenu<Client>();
  // Osobne menu dla odznaki kanału (Moduł 34) — karta/wiersz ma już swoje
  // menu pod prawym przyciskiem, więc bez drugiego kontrolera prawy klik na
  // odznace otwierałby menu rekordu, nie akcje kontaktowe.
  const channelCtl = useContextMenu<Client>();
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const columns = CLIENT_STATUSES.map((status) => ({
    status,
    items: clients.filter((c) => c.status === status),
  }));

  return (
    // `flex-1 min-h-0` + `items-stretch` (Moduł 35) — kolumny do dołu okna,
    // pasek przewijania przy krawędzi, upuszczanie działa na całej wysokości.
    <div className="flex flex-1 items-stretch gap-3 overflow-x-auto pb-2 md:min-h-0">
      {columns.map((col) => (
        <div
          key={col.status}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverStatus(col.status);
          }}
          onDragLeave={() => setDragOverStatus((s) => (s === col.status ? null : s))}
          onDrop={(e) => {
            e.preventDefault();
            const id = e.dataTransfer.getData("text/client-id");
            if (id) onUpdate(id, "status", col.status);
            setDragOverStatus(null);
            setDraggingId(null);
          }}
          // Bez ramki — patrz komentarz w leads/KanbanBoard.tsx (ten sam
          // wzorzec kolumny, ta sama zmiana z audytu 2026-07-16).
          className={`flex w-72 shrink-0 flex-col rounded-lg p-2 transition-colors ${
            dragOverStatus === col.status ? "bg-[#4ea7fc]/[0.08] ring-1 ring-[#4ea7fc]/40" : ""
          }`}
        >
          <div className="mb-2 flex items-center gap-2 px-1">
            <span className={`h-2 w-2 rounded-full ${CLIENT_STATUS_DOT[col.status] ?? "bg-[var(--fg-muted)]"}`} />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{col.status}</h3>
            <span className="ml-auto rounded-full bg-[var(--hairline)] px-1.5 py-0.5 text-[10px] text-muted">
              {col.items.length}
            </span>
          </div>

          {/* Karty przewijają się WEWNĄTRZ kolumny — przy długiej liście
              kolumna nie rozpycha strony (Moduł 35). */}
          <div className="flex min-h-[40px] flex-1 flex-col gap-2 overflow-y-auto md:min-h-0">
            <AnimatePresence initial={false}>
            {col.items.map((client) => {
              const overdue = isClientOverdue(client);
              const d = clientDaysSince(client.ostatni_kontakt);
              // Patrz leads/KanbanBoard.tsx — zmienna zamiast pola, bo w callbacku
              // onClick TS gubi zawężenie z `&&`.
              const kanal = client.ostatni_kanal;
              return (
                <motion.div
                  key={client.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  draggable
                  onDragStart={(e) => {
                    (e as unknown as React.DragEvent).dataTransfer.setData("text/client-id", client.id);
                    setDraggingId(client.id);
                  }}
                  onDragEnd={() => setDraggingId(null)}
                  onClick={() => onOpen(client.id)}
                  onContextMenu={(e) => ctl.openAt(e, client)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onOpen(client.id);
                  }}
                  className={`card-paper cursor-pointer rounded-xl p-2.5 transition-colors hover:border-[#4ea7fc]/30 active:cursor-grabbing ${
                    draggingId === client.id ? "opacity-40" : ""
                  } ${overdue ? "border-orange-500/40" : ""} ${
                    selectedIds.has(client.id) ? "border-[#4ea7fc]/50 bg-[#4ea7fc]/[0.06]" : ""
                  }`}
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <span className="flex min-w-0 items-start gap-1.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(client.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          onToggleSelect(client.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-[#4ea7fc]"
                        aria-label={`Zaznacz ${client.nazwa}`}
                      />
                      <span className="text-xs font-medium leading-snug">{client.nazwa || "(bez nazwy)"}</span>
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(client.id, client.nazwa);
                      }}
                      className="shrink-0 text-muted hover:text-red-400"
                      aria-label={`Usuń ${client.nazwa}`}
                      title="Usuń"
                    >
                      ✕
                    </button>
                  </div>
                  {(client.branza || client.avg_rating != null) && (
                    <div className="flex items-center gap-1.5 text-[11px] text-muted">
                      {client.branza && <span>{client.branza}</span>}
                      {client.avg_rating != null && (
                        <span className="text-brand-gold" title={`Średnia ocena z opinii: ${client.avg_rating.toFixed(1)}/5`}>
                          ★ {client.avg_rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  )}
                  {(client.telefon || client.email || client.www) && (
                    <div className="mt-1 space-y-0.5 text-[11px] text-muted opacity-80">
                      {client.telefon && <div className="break-words">{client.telefon}</div>}
                      {client.email && <div className="break-all">{client.email}</div>}
                      {client.www && <div className="break-all">{client.www}</div>}
                    </div>
                  )}
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span onClick={(e) => e.stopPropagation()}>
                      <StatusTag status={client.status} onChange={(v) => onUpdate(client.id, "status", v)} />
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      {kanal && (
                        <Tooltip
                          label={
                            <>
                              Ostatni kontakt: {CONTACT_CHANNEL_LABEL[kanal as keyof typeof CONTACT_CHANNEL_LABEL] ?? kanal}
                              {daysAgoLabel(d) && ` · ${daysAgoLabel(d)}`}
                              <span className="block text-muted">
                                {activeChannel === kanal ? "Kliknij, by wyczyścić filtr" : "Kliknij, by odfiltrować ten kanał"}
                              </span>
                              <span className="block text-muted">Prawy przycisk: zadzwoń, napisz…</span>
                            </>
                          }
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onFilterChannel?.(kanal);
                            }}
                            onContextMenu={(e) => {
                              // stopPropagation, inaczej wyżej otworzy się menu
                              // rekordu. Puste menu nie ma sensu — gdy nie ma
                              // czym się skontaktować, zostawiamy menu rekordu.
                              if (!hasChannelActions(client)) return;
                              e.stopPropagation();
                              channelCtl.openAt(e, client);
                            }}
                            aria-label={`Filtruj: ${CONTACT_CHANNEL_LABEL[kanal as keyof typeof CONTACT_CHANNEL_LABEL] ?? kanal}`}
                            className={`flex h-4 w-4 items-center justify-center rounded-full transition-transform hover:scale-110 ${
                              CONTACT_CHANNEL_CLASS[kanal as keyof typeof CONTACT_CHANNEL_CLASS] ?? ""
                            } ${activeChannel === kanal ? "ring-1 ring-[#4ea7fc]" : ""}`}
                          >
                            <ContactChannelIcon kind={kanal} size={10} />
                          </button>
                        </Tooltip>
                      )}
                      {overdue ? (
                        <span className="text-[10px] font-medium text-orange-400">przypomnienie dziś</span>
                      ) : (
                        d !== null && <span className="text-[10px] text-muted">{d} dni temu</span>
                      )}
                    </span>
                  </div>
                </motion.div>
              );
            })}
            </AnimatePresence>
            {col.items.length === 0 && (
              <div className="rounded-xl border border-dashed hairline p-3 text-center text-[11px] text-muted opacity-50">
                Pusto
              </div>
            )}
          </div>
        </div>
      ))}
      <ContextMenu ctl={ctl}>
        {(client, close) => (
          <ClientMenuItems
            client={client}
            lang={lang}
            close={close}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onOpen={onOpen}
          />
        )}
      </ContextMenu>

      {/* Menu kanału (Moduł 34) — akcje kontaktowe bez wchodzenia w profil.
          Osobne od menu rekordu wyżej; te same helpery co ContactQuickActions. */}
      <ContextMenu ctl={channelCtl} width={200}>
        {(rec, close) => <ContactChannelMenuItems contact={rec} close={close} />}
      </ContextMenu>
    </div>
  );
}
