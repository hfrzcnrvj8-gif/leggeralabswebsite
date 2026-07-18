"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { IconArrowUpRight, IconX, IconInbox, IconBrandLinkedin } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import {
  type Client,
  clientDaysSince,
  isClientOverdue,
  ContactChannelIcon,
  CONTACT_CHANNEL_LABEL,
  CONTACT_CHANNEL_CLASS,
  StatusTag,
  waLink,
} from "./shared";
import { Truncate } from "../components";
import { formatPlDate } from "@/lib/projects";
import { ContextMenu, useContextMenu } from "../Menu";
import { Tooltip } from "../Tooltip";
import { ContactChannelMenuItems, hasChannelActions } from "../ContactChannelMenu";
import { daysAgoLabel } from "@/lib/dates";
import { ClientMenuItems } from "./ClientContextMenu";

/**
 * Lista = tylko podgląd (Moduł 23, decyzja właściciela 2026-07-16: „lista jest
 * spisem, dane zmienia się w wizytówce" — WSZĘDZIE, nie tylko w leadach).
 *
 * Do 2026-07-17 dało się tu edytować inline 7 pól (nazwa, branża, telefon,
 * email, status, ostatni kontakt, notatki), co rozjeżdżało się z listą leadów,
 * która od początku była samym spisem. Zostaje wyłącznie **status** — jedyna
 * rzecz zmieniana w tabeli setki razy w tygodniu, i to nie „dana stała", tylko
 * bieżący etap pracy (dokładnie to samo uzasadnienie co w leads/TableView.tsx).
 * Reszta idzie przez profil, otwierany klikiem w nazwę albo ikoną obok.
 */
export function TableView({
  clients,
  lang,
  selectedId,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onUpdate,
  onDelete,
  onOpen,
  activeChannel,
  onFilterChannel,
}: {
  clients: Client[];
  lang: Locale;
  selectedId?: string | null;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onUpdate: (id: string, field: string, value: string) => void;
  onDelete: (id: string, nazwa: string) => void;
  onOpen: (id: string) => void;
  /** Patrz clients/KanbanBoard.tsx — ta sama odznaka, ten sam filtr. */
  activeChannel?: string;
  onFilterChannel?: (kanal: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const ctl = useContextMenu<Client>();
  // Osobne menu dla odznaki kanału (Moduł 34) — karta/wiersz ma już swoje
  // menu pod prawym przyciskiem, więc bez drugiego kontrolera prawy klik na
  // odznace otwierałby menu rekordu, nie akcje kontaktowe.
  const channelCtl = useContextMenu<Client>();

  const updateScrollShadows = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  return (
    // `md:flex-1` (Moduł 5): na telefonie karta obejmuje samą listę, bez
    // rozciągania na całą wysokość okna. Od `md` wraca zachowanie z Modułu 35
    // (tabela sięga dołu okna).
    <div className="card-paper relative flex flex-col rounded-2xl md:min-h-0 md:flex-1">
      {/* ——— TELEFON: lista kart (Moduł 5) ———
          Bliźniacze z leads/TableView.tsx: tabela ma 9 kolumn i na 375 px
          zmuszałaby do przewijania w bok. Karta pokazuje kto / status / jak
          dawno kontakt i pozwala od razu zadzwonić. Bez checkboxów zaznaczania
          — operacje masowe zostają pracą biurkową (od `md`). */}
      <div className="flex flex-col md:hidden">
        {clients.length === 0 && (
          <div className="p-8 text-center text-sm text-muted opacity-60">
            <IconInbox size={18} className="mx-auto mb-1.5 opacity-70" />
            Brak klientów pasujących do filtrów.
          </div>
        )}
        {clients.map((client) => {
          const d = clientDaysSince(client.ostatni_kontakt);
          const overdueRow = isClientOverdue(client);
          const wa = waLink(client.telefon);
          const meta = [client.osoba_kontaktowa, client.branza, client.miasto].filter(Boolean).join(" · ");
          // Skala typografii telefonu — patrz leads/TableView.tsx (Paczka 6).
          const quickCls =
            "touch-press flex min-h-[46px] flex-1 items-center justify-center gap-1.5 rounded-full border hairline px-3 text-[13.5px] font-medium text-[var(--fg)]";
          return (
            <div
              key={client.id}
              onContextMenu={(e) => ctl.openAt(e, client)}
              className={`border-b hairline px-4 py-4 last:border-0 ${overdueRow ? "bg-orange-500/[0.06]" : ""}`}
            >
              {/* Nazwa na całą szerokość — patrz leads/TableView.tsx (Paczka 6). */}
              <button onClick={() => onOpen(client.id)} className="block w-full text-left">
                <span className="block truncate text-[17px] font-semibold leading-tight text-[var(--fg)]">
                  {client.nazwa}
                </span>
                {meta && <span className="mt-1 block truncate text-[13.5px] text-muted">{meta}</span>}
              </button>

              <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[13px]">
                <StatusTag status={client.status} onChange={(v) => onUpdate(client.id, "status", v)} />
                <span className={overdueRow ? "font-semibold text-orange-400" : "text-muted"}>
                  {client.ostatni_kontakt
                    ? `${formatPlDate(client.ostatni_kontakt)}${daysAgoLabel(d) ? ` · ${daysAgoLabel(d)}` : ""}`
                    : "Brak kontaktu"}
                </span>
              </div>

              {(client.telefon || client.email || wa) && (
                <div className="mt-3 flex gap-2">
                  {client.telefon && (
                    <a href={`tel:${client.telefon}`} className={quickCls} aria-label={`Zadzwoń do ${client.nazwa}`}>
                      <ContactChannelIcon kind="telefon" size={15} /> Zadzwoń
                    </a>
                  )}
                  {wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={quickCls}
                      aria-label={`WhatsApp do ${client.nazwa}`}
                    >
                      <ContactChannelIcon kind="whatsapp" size={15} /> WhatsApp
                    </a>
                  )}
                  {client.email && (
                    <a href={`mailto:${client.email}`} className={quickCls} aria-label={`Napisz do ${client.nazwa}`}>
                      <ContactChannelIcon kind="email" size={15} /> Mail
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ——— iPad / desktop: pełna tabela (bez zmian) ——— */}
      <div className="relative hidden flex-1 flex-col md:flex md:min-h-0">
      <div
        className={`pointer-events-none absolute inset-y-0 left-0 z-20 w-8 rounded-l-2xl bg-gradient-to-r from-[var(--bg-soft)] to-transparent transition-opacity ${
          canScrollLeft ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden
      />
      <div
        className={`pointer-events-none absolute inset-y-0 right-0 z-20 w-8 rounded-r-2xl bg-gradient-to-l from-[var(--bg-soft)] to-transparent transition-opacity ${
          canScrollRight ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden
      />
      <div
        ref={scrollRef}
        onScroll={updateScrollShadows}
        // Patrz leads/TableView.tsx — `max-h-[70vh]` zamienione na `flex-1`.
        className="flex-1 overflow-auto rounded-2xl md:min-h-0"
      >
        <table className="w-full text-xs">
          <thead>
            <tr className="sticky top-0 z-10 border-b hairline bg-[var(--bg-soft)] text-left uppercase tracking-wide text-muted">
              <th className="bg-[var(--bg-soft)] p-2">
                <input
                  type="checkbox"
                  checked={clients.length > 0 && clients.every((c) => selectedIds.has(c.id))}
                  onChange={(e) => onToggleSelectAll(e.target.checked)}
                  className="h-3.5 w-3.5 cursor-pointer accent-[#4ea7fc]"
                  aria-label="Zaznacz wszystkie"
                />
              </th>
              {/* Kolumny znikają stopniowo wg ważności (Moduł 5, Paczka 4) —
                  suma samych `min-w` to ~1030 px, a iPad w pionie daje tabeli
                  494 px, więc bez tego połowa tabeli była poza ekranem.
                  ZAWSZE: zaznaczenie, Nazwa, Telefon, Status, akcje.
                  Od `lg`: Email, Ostatni kontakt. Od `xl`: Branża, Ocena, Dni,
                  Notatki. Ukrywamy `<th>` I odpowiadające `<td>` — inaczej
                  wiersze rozjadą się względem nagłówka. */}
              <th className="min-w-[160px] bg-[var(--bg-soft)] p-2">Nazwa</th>
              <th className="hidden min-w-[110px] bg-[var(--bg-soft)] p-2 xl:table-cell">Branża</th>
              <th className="min-w-[110px] bg-[var(--bg-soft)] p-2">Telefon</th>
              <th className="hidden min-w-[150px] bg-[var(--bg-soft)] p-2 lg:table-cell">Email</th>
              <th className="min-w-[100px] bg-[var(--bg-soft)] p-2">Status</th>
              <th className="hidden min-w-[70px] bg-[var(--bg-soft)] p-2 xl:table-cell">Ocena</th>
              <th className="hidden min-w-[110px] bg-[var(--bg-soft)] p-2 lg:table-cell">Ostatni kontakt</th>
              <th className="hidden bg-[var(--bg-soft)] p-2 xl:table-cell">Dni</th>
              <th className="hidden min-w-[220px] bg-[var(--bg-soft)] p-2 xl:table-cell">Notatki</th>
              <th className="bg-[var(--bg-soft)] p-2"></th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 && (
              <tr>
                <td colSpan={11} className="p-8 text-center text-sm text-muted opacity-60">
                  <IconInbox size={18} className="mx-auto mb-1.5 opacity-70" />
                  Brak klientów pasujących do filtrów.
                </td>
              </tr>
            )}
            {clients.map((client) => {
              const d = clientDaysSince(client.ostatni_kontakt);
              // Patrz leads/KanbanBoard.tsx — zmienna zamiast pola, bo w callbacku
              // onClick TS gubi zawężenie z `&&`.
              const kanal = client.ostatni_kanal;
              const overdueRow = isClientOverdue(client);
              const selected = selectedId === client.id;
              const checked = selectedIds.has(client.id);
              return (
                <tr
                  key={client.id}
                  onContextMenu={(e) => ctl.openAt(e, client)}
                  className={`border-b hairline align-top transition-colors ${
                    overdueRow ? "bg-orange-500/[0.06]" : ""
                  } ${selected ? "bg-[#4ea7fc]/[0.08]" : ""} ${checked ? "bg-[#4ea7fc]/[0.08]" : ""}`}
                >
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleSelect(client.id)}
                      className="h-3.5 w-3.5 cursor-pointer accent-[#4ea7fc]"
                      aria-label={`Zaznacz ${client.nazwa}`}
                    />
                  </td>
                  <td className="p-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <button
                        onClick={() => onOpen(client.id)}
                        className="block min-w-0 flex-1 truncate text-left font-medium text-[var(--fg)] hover:underline"
                        title={client.nazwa}
                      >
                        {client.nazwa}
                      </button>
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
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-110 ${
                              CONTACT_CHANNEL_CLASS[kanal as keyof typeof CONTACT_CHANNEL_CLASS] ?? ""
                            } ${activeChannel === kanal ? "ring-1 ring-[#4ea7fc]" : ""}`}
                          >
                            <ContactChannelIcon kind={kanal} size={10} />
                          </button>
                        </Tooltip>
                      )}
                    </div>
                  </td>
                  <td className="hidden p-2 xl:table-cell">
                    <Truncate value={client.branza} />
                  </td>
                  <td className="p-2">
                    <Truncate value={client.telefon} />
                  </td>
                  <td className="hidden p-2 lg:table-cell">
                    <Truncate value={client.email} />
                    {client.linkedin_url && (
                      <span className="flex items-center gap-1 text-[11px] text-muted opacity-80">
                        <IconBrandLinkedin size={11} className="shrink-0" />
                        <Truncate value={client.linkedin_url} />
                      </span>
                    )}
                  </td>
                  <td className="p-2">
                    <StatusTag status={client.status} onChange={(v) => onUpdate(client.id, "status", v)} />
                  </td>
                  <td className="hidden p-2 xl:table-cell">
                    {client.avg_rating != null ? (
                      <span className="text-brand-gold" title={`Średnia ocena z opinii: ${client.avg_rating.toFixed(1)}/5`}>
                        ★ {client.avg_rating.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-muted opacity-50">—</span>
                    )}
                  </td>
                  <td className="hidden p-2 lg:table-cell">
                    <Truncate value={formatPlDate(client.ostatni_kontakt)} />
                  </td>
                  <td className="hidden p-2 xl:table-cell">
                    {d === null ? "—" : <span className={overdueRow ? "font-semibold text-orange-400" : "text-muted"}>{d} dni</span>}
                  </td>
                  <td className="hidden p-2 xl:table-cell">
                    <Truncate value={client.notatki} />
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/${lang}/admin/clients/${client.id}`}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
                          e.preventDefault();
                          onOpen(client.id);
                        }}
                        className="flex text-muted hover:text-[var(--fg)]"
                        title="Otwórz szczegóły"
                      >
                        <IconArrowUpRight size={15} />
                      </Link>
                      <button
                        onClick={() => onDelete(client.id, client.nazwa)}
                        className="flex text-muted hover:text-red-400"
                        aria-label={`Usuń ${client.nazwa}`}
                        title="Usuń"
                      >
                        <IconX size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </div>
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
