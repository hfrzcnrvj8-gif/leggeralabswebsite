"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { IconArrowUpRight, IconX, IconInbox, IconBrandLinkedin } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import {
  type Lead,
  daysSince,
  isOverdue,
  leadSourceLabel,
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
import { LeadMenuItems } from "./LeadContextMenu";

/**
 * Lista = tylko podgląd. Dane stałe leada (nazwa, kontakt, adres, źródło)
 * edytuje się wyłącznie w profilu (LeadDetailPanel, otwierany klikiem w
 * nazwę firmy albo ikoną obok) — status zostaje edytowalny bezpośrednio w
 * wierszu, bo to główna akcja robocza dnia codziennego, nie dana stała.
 * `table-fixed` + kolumny procentowe zamiast sztywnych `min-w-[]px`, żeby
 * tabela realnie wykorzystywała całą dostępną szerokość ekranu, a nie tylko
 * sumę minimalnych szerokości kolumn.
 */
export function TableView({
  leads,
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
  leads: Lead[];
  lang: Locale;
  selectedId?: string | null;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onUpdate: (id: string, field: string, value: string) => void;
  onDelete: (id: string, firma: string) => void;
  onOpen: (id: string) => void;
  /** Patrz KanbanBoard.tsx — ta sama odznaka, ten sam filtr (Moduł 34). */
  activeChannel?: string;
  onFilterChannel?: (kanal: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const ctl = useContextMenu<Lead>();
  // Osobne menu dla odznaki kanału (Moduł 34) — karta/wiersz ma już swoje
  // menu pod prawym przyciskiem, więc bez drugiego kontrolera prawy klik na
  // odznace otwierałby menu rekordu, nie akcje kontaktowe.
  const channelCtl = useContextMenu<Lead>();

  const updateScrollShadows = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  return (
    // `flex flex-1 flex-col min-h-0` (Moduł 35) — karta tabeli sięga dołu okna.
    // `md:flex-1`, nie `flex-1` (Moduł 5): na telefonie karta ma obejmować
    // tylko listę — z `flex-1` rozciągała się na całą wysokość okna i pod
    // ostatnim leadem zostawał wielki pusty prostokąt. Od `md` rozciąganie
    // wraca (Moduł 35 — tabela sięga dołu okna).
    <div className="card-paper relative flex flex-col rounded-2xl md:min-h-0 md:flex-1">
      {/* ——— TELEFON: lista kart (Moduł 5) ———
          Tabela niżej ma 10 kolumn i `min-w-[900px]`, więc na 375 px zmuszałaby
          do ciągłego przewijania w bok. Karta pokazuje to, czego właściciel
          realnie szuka w terenie: kto, w jakim statusie, jak dawno kontakt — i
          pozwala od razu zadzwonić / napisać, bez wchodzenia w profil.
          Świadomie BEZ checkboxów zaznaczania: operacje masowe (eksport
          zaznaczonych, zmiana statusu paczki) to praca biurkowa, a na telefonie
          kosztowałyby cel dotykowy w każdej karcie. Zostają od `md`. */}
      <div className="flex flex-col md:hidden">
        {leads.length === 0 && (
          <div className="p-8 text-center text-sm text-muted opacity-60">
            <IconInbox size={18} className="mx-auto mb-1.5 opacity-70" />
            Brak leadów pasujących do filtrów.
          </div>
        )}
        {leads.map((lead) => {
          const d = daysSince(lead.ostatni_kontakt);
          const overdueRow = isOverdue(lead);
          const wa = waLink(lead.telefon);
          const meta = [lead.osoba_kontaktowa, lead.branza, lead.miasto].filter(Boolean).join(" · ");
          // ≥44 px — minimalny wygodny cel dotykowy (wytyczne Apple), ten sam
          // rozmiar co `ContactQuickActions` w profilu.
          const quickCls =
            "flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full border hairline px-3 text-[12.5px] font-medium text-[var(--fg)]";
          return (
            <div
              key={lead.id}
              onContextMenu={(e) => ctl.openAt(e, lead)}
              className={`border-b hairline px-3 py-3 last:border-0 ${overdueRow ? "bg-orange-500/[0.06]" : ""}`}
            >
              <div className="flex items-start gap-2">
                <button onClick={() => onOpen(lead.id)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[14px] font-medium text-[var(--fg)]">{lead.firma}</span>
                  {meta && <span className="mt-0.5 block truncate text-[12px] text-muted">{meta}</span>}
                </button>
                <StatusTag status={lead.status} onChange={(v) => onUpdate(lead.id, "status", v)} />
              </div>

              <div className="mt-1.5 text-[11.5px]">
                <span className={overdueRow ? "font-semibold text-orange-400" : "text-muted"}>
                  {lead.ostatni_kontakt
                    ? `Kontakt: ${formatPlDate(lead.ostatni_kontakt)}${daysAgoLabel(d) ? ` · ${daysAgoLabel(d)}` : ""}`
                    : "Brak kontaktu"}
                </span>
              </div>

              {(lead.telefon || lead.email || wa) && (
                <div className="mt-2 flex gap-1.5">
                  {lead.telefon && (
                    <a href={`tel:${lead.telefon}`} className={quickCls} aria-label={`Zadzwoń do ${lead.firma}`}>
                      <ContactChannelIcon kind="telefon" size={15} /> Zadzwoń
                    </a>
                  )}
                  {wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={quickCls}
                      aria-label={`WhatsApp do ${lead.firma}`}
                    >
                      <ContactChannelIcon kind="whatsapp" size={15} /> WhatsApp
                    </a>
                  )}
                  {lead.email && (
                    <a href={`mailto:${lead.email}`} className={quickCls} aria-label={`Napisz do ${lead.firma}`}>
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
      {/* Cienie sygnalizujące, że w poziomie jest jeszcze coś do przewinięcia
          (styl Linear) — na wąskich ekranach tabela wciąż może scrollować. */}
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
        // Dawniej `max-h-[70vh]`: sztywne 70% ekranu NIEZALEŻNIE od tego, ile
        // miejsca realnie zostało — stąd pasek przewijania w połowie strony i
        // martwe pole pod spodem. Teraz tabela bierze dokładnie tyle, ile jest.
        className="min-w-full flex-1 overflow-auto rounded-2xl md:min-h-0"
      >
        <table className="w-full min-w-[900px] table-fixed text-xs">
          {/* Wszystkie kolumny w procentach (sumujące się do 100%), żaden
              px-owy wyjątek — inaczej table-fixed nie rozciąga tabeli na
              całą dostępną szerokość, tylko zostawia martwe miejsce z boku. */}
          <colgroup>
            <col className="w-[3%]" />
            <col className="w-[22%]" />
            <col className="w-[9%]" />
            <col className="w-[15%]" />
            <col className="w-[8%]" />
            <col className="w-[13%]" />
            <col className="w-[12%]" />
            <col className="w-[9%]" />
            <col className="w-[4%]" />
            <col className="w-[5%]" />
          </colgroup>
          <thead>
            <tr className="sticky top-0 z-10 border-b hairline bg-[var(--bg-soft)] text-left uppercase tracking-wide text-muted">
              <th className="bg-[var(--bg-soft)] p-2">
                <input
                  type="checkbox"
                  checked={leads.length > 0 && leads.every((l) => selectedIds.has(l.id))}
                  onChange={(e) => onToggleSelectAll(e.target.checked)}
                  className="h-3.5 w-3.5 cursor-pointer accent-[#4ea7fc]"
                  aria-label="Zaznacz wszystkie"
                />
              </th>
              <th className="bg-[var(--bg-soft)] p-2">Firma</th>
              <th className="bg-[var(--bg-soft)] p-2">Branża</th>
              <th className="bg-[var(--bg-soft)] p-2">Kontakt</th>
              <th className="bg-[var(--bg-soft)] p-2">Miasto</th>
              <th className="bg-[var(--bg-soft)] p-2">Źródło</th>
              <th className="bg-[var(--bg-soft)] p-2">Status</th>
              <th className="bg-[var(--bg-soft)] p-2">Ostatni kontakt</th>
              <th className="bg-[var(--bg-soft)] p-2">Dni</th>
              <th className="bg-[var(--bg-soft)] p-2"></th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr>
                <td colSpan={10} className="p-8 text-center text-sm text-muted opacity-60">
                  <IconInbox size={18} className="mx-auto mb-1.5 opacity-70" />
                  Brak leadów pasujących do filtrów.
                </td>
              </tr>
            )}
            {leads.map((lead) => {
              const d = daysSince(lead.ostatni_kontakt);
              // Zmienna, nie lead.ostatni_kanal wprost: w callbacku onClick TS gubi
              // zawężenie z `&&` (closure może odpalić później), a `!` tylko by je uciszył.
              const kanal = lead.ostatni_kanal;
              const overdueRow = isOverdue(lead);
              const selected = selectedId === lead.id;
              const checked = selectedIds.has(lead.id);
              const kontakt = [lead.telefon, lead.email].filter(Boolean);
              return (
                <tr
                  key={lead.id}
                  onContextMenu={(e) => ctl.openAt(e, lead)}
                  className={`border-b hairline align-top transition-colors ${
                    overdueRow ? "bg-orange-500/[0.06]" : ""
                  } ${selected ? "bg-[#4ea7fc]/[0.08]" : ""} ${checked ? "bg-[#4ea7fc]/[0.08]" : ""}`}
                >
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleSelect(lead.id)}
                      className="h-3.5 w-3.5 cursor-pointer accent-[#4ea7fc]"
                      aria-label={`Zaznacz ${lead.firma}`}
                    />
                  </td>
                  <td className="p-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <button
                        onClick={() => onOpen(lead.id)}
                        className="block min-w-0 flex-1 truncate text-left font-medium text-[var(--fg)] hover:underline"
                        title={lead.firma}
                      >
                        {lead.firma}
                      </button>
                      {kanal && (
                        <Tooltip
                          label={
                            <>
                              Ostatni kontakt:{" "}
                              {CONTACT_CHANNEL_LABEL[kanal as keyof typeof CONTACT_CHANNEL_LABEL] ?? kanal}
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
                              if (!hasChannelActions(lead)) return;
                              e.stopPropagation();
                              channelCtl.openAt(e, lead);
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
                    {lead.osoba_kontaktowa && (
                      <Truncate value={lead.osoba_kontaktowa} className="text-[11px] text-muted opacity-80" />
                    )}
                  </td>
                  <td className="p-2">
                    <Truncate value={lead.branza} />
                  </td>
                  <td className="p-2">
                    {kontakt.length === 0 ? (
                      <span className="text-muted opacity-40">—</span>
                    ) : (
                      kontakt.map((c) => <Truncate key={c} value={c} />)
                    )}
                    {lead.linkedin_url && (
                      <span className="flex items-center gap-1 text-[11px] text-muted opacity-80">
                        <IconBrandLinkedin size={11} className="shrink-0" />
                        <Truncate value={lead.linkedin_url} />
                      </span>
                    )}
                  </td>
                  <td className="p-2">
                    <Truncate value={lead.miasto} />
                  </td>
                  <td className="p-2">
                    <Truncate value={leadSourceLabel(lead)} />
                  </td>
                  <td className="p-2">
                    <StatusTag status={lead.status} onChange={(v) => onUpdate(lead.id, "status", v)} />
                  </td>
                  <td className="p-2">
                    <Truncate value={formatPlDate(lead.ostatni_kontakt)} />
                  </td>
                  <td className="p-2">
                    {d === null ? (
                      "—"
                    ) : (
                      <span className={overdueRow ? "font-semibold text-orange-400" : "text-muted"}>{d}</span>
                    )}
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/${lang}/admin/leads/${lead.id}`}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
                          e.preventDefault();
                          onOpen(lead.id);
                        }}
                        className="flex text-muted hover:text-[var(--fg)]"
                        title="Otwórz profil"
                      >
                        <IconArrowUpRight size={15} />
                      </Link>
                      <button
                        onClick={() => onDelete(lead.id, lead.firma)}
                        className="flex text-muted hover:text-red-400"
                        aria-label={`Usuń ${lead.firma}`}
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
        {(lead, close) => (
          <LeadMenuItems
            lead={lead}
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
