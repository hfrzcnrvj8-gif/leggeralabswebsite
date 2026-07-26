"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconPlus,
  IconX,
  IconExternalLink,
  IconLayoutGrid,
  IconFileDescription,
  IconSearch,
  IconEye,
  IconCopy,
  IconMail,
  IconBell,
  IconThumbDown,
  IconClockOff,
  IconCheck,
} from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import { type Offer, OFFER_STATUSES, OFFER_STATUS_CLASS, CLOSED_OFFER_STATUSES, isOfferExpired, weightedOfferValue, offerLiczySieDoStatystyk } from "@/lib/offers";
import { formatMoney } from "@/lib/invoices";
import { addDaysToISO, todayLocalISO } from "@/lib/dates";
import { formatPlDate } from "@/lib/projects";
import { useUI, useRegisterActions } from "../ui";
import { Popover, MenuRow, MenuDivider, PropertyMenu, useContextMenu, ContextMenu, ContextMenuItem } from "../Menu";
import { ExpandingIconButton } from "../ExpandingIconButton";
import { Tooltip } from "../Tooltip";
import { InfoDot } from "../components";
import { OfferEditor } from "./OfferEditor";
import { OfferTemplatesPanel } from "./OfferTemplatesPanel";
import { OknoOdrzucenia } from "./RejectDialog";
import { Modal } from "../Modal";
import { NewDocumentDialog, type NewDocumentLink } from "../NewDocumentDialog";
import { invalidateLinkTargets } from "../LinkPicker";

type OfferRow = Offer & { kwota: number };

/** Wartość filtra „po terminie" — nie jest statusem z bazy, więc trzyma się
 * poza `OFFER_STATUSES` (patrz komentarz przy filtrowaniu). */
const PO_TERMINIE = "__po_terminie__";

export function OffersDashboard({ lang }: { lang: Locale }) {
  const { toast, confirm } = useUI();
  const [offers, setOffers] = useState<OfferRow[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [szukaj, setSzukaj] = useState("");
  /** Pełny rozmiar rejestru z serwera — patrz OFFERS_LIMIT w trasie. Gdy jest
   * większy niż to, co przyszło, lista mówi o tym WPROST zamiast po cichu
   * gubić oferty (i liczyć z nich wskaźniki). */
  const [total, setTotal] = useState(0);
  const szukajRef = useRef<HTMLInputElement>(null);
  const [kursor, setKursor] = useState(0);
  /** Id oferty, dla której otwarte jest okno „dlaczego odrzucona". */
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  /** Menu pod prawym przyciskiem — jedno na listę, nie na wiersz
   * (patrz `useContextMenu` w Menu.tsx). Do tej pory prawy przycisk na
   * ofercie nie robił nic. */
  const ctx = useContextMenu<OfferRow>();

  const load = useCallback(async () => {
    const res = await fetch("/api/offers");
    if (res.status === 401) {
      window.location.reload();
      return;
    }
    const data = (await res.json()) as { offers: OfferRow[]; total?: number };
    setOffers(data.offers);
    setTotal(data.total ?? data.offers.length);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Moduł 30: zamiast tworzyć od razu pusty szkic (`body: "{}"`), najpierw
  // pytamy „dla kogo?". Wybór leada uruchamia w POST /api/offers awans leada
  // na klienta — trasa, której do tego modułu nic w panelu nie wołało.
  const createOffer = useCallback(() => setNewOpen(true), []);

  const createOfferFor = useCallback(
    async (link: NewDocumentLink) => {
      setNewOpen(false);
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(link),
      });
      if (!res.ok) {
        toast("Nie udało się utworzyć oferty.", "error");
        return;
      }
      const { id } = (await res.json()) as { id: string };
      // Wybór leada mógł właśnie założyć klienta — odśwież wspólny cache
      // LinkPickera, żeby inne ekrany go zobaczyły bez przeładowania.
      if (link.lead_id) invalidateLinkTargets();
      await load();
      setOpenId(id);
    },
    [toast, load]
  );

  const deleteOffer = useCallback(
    async (id: string, tytul: string) => {
      const ok = await confirm(`Usunąć ofertę "${tytul || "(bez tytułu)"}"?`, { danger: true });
      if (!ok) return;
      const res = await fetch(`/api/offers/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast("Nie udało się usunąć.", "error");
        return;
      }
      setOffers((prev) => prev?.filter((o) => o.id !== id) ?? prev);
      // `total` to rozmiar rejestru po stronie serwera — bez tego ostrzeżenie
      // o sufi­cie zapalało się po ZWYKŁYM usunięciu („widzisz 4 z 5 ofert"),
      // choć nic się nie gubiło (zgłoszenie właściciela 2026-07-26).
      setTotal((t) => Math.max(0, t - 1));
      toast("Oferta usunięta.");
    },
    [confirm, toast]
  );

  const zapiszStatus = useCallback(
    async (id: string, status: string, powod?: string, komentarz?: string) => {
      setOffers((prev) => prev?.map((o) => (o.id === id ? { ...o, status: status as Offer["status"] } : o)) ?? prev);
      const res = await fetch(`/api/offers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...(powod ? { powod_odrzucenia: powod, komentarz_odrzucenia: komentarz ?? "" } : {}) }),
      });
      if (!res.ok) toast("Nie udało się zapisać.", "error");
    },
    [toast]
  );

  /** Odrzucenie idzie przez to samo okno co w profilu oferty (RejectDialog) —
   * inaczej powód zapisywałby się tylko wtedy, gdy właściciel akurat wszedł
   * w profil, a statystyka „na czym przegrywamy" miałaby dziury zależne od
   * tego, którą drogą kliknął. */
  const updateStatus = useCallback(
    async (id: string, status: string) => {
      if (status === "Odrzucona") {
        setRejectFor(id);
        return;
      }
      await zapiszStatus(id, status);
    },
    [zapiszStatus]
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((checked: boolean, ids: string[]) => {
    setSelectedIds(checked ? new Set(ids) : new Set());
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Jedno żądanie na całe zaznaczenie (`/api/offers/bulk`), nie jedno na
  // ofertę — wzorem Klientów (Moduł 54, krok 3b). Przy 30 zaznaczonych pętla
  // robiła 30 rund HTTP, a każda z nich własną rundę do bazy.
  const bulkUpdateStatus = useCallback(
    async (status: string) => {
      const ids = [...selectedIds];
      if (ids.length === 0) return;
      setBulkBusy(true);
      const res = await fetch("/api/offers/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status }),
      });
      setBulkBusy(false);
      if (!res.ok) {
        toast("Nie udało się zapisać.", "error");
        return;
      }
      setOffers((prev) => prev?.map((o) => (selectedIds.has(o.id) ? { ...o, status: status as Offer["status"] } : o)) ?? prev);
      toast(`Zaktualizowano status dla ${ids.length} ofert.`);
      clearSelection();
    },
    [selectedIds, toast, clearSelection]
  );

  const bulkDelete = useCallback(async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const ok = await confirm(`Usunąć ${ids.length} zaznaczonych ofert?`, { danger: true });
    if (!ok) return;
    setBulkBusy(true);
    const res = await fetch("/api/offers/bulk", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    setBulkBusy(false);
    if (!res.ok) {
      toast("Nie udało się usunąć.", "error");
      return;
    }
    setOffers((prev) => prev?.filter((o) => !selectedIds.has(o.id)) ?? prev);
    setTotal((t) => Math.max(0, t - ids.length));
    toast(`Usunięto ${ids.length} ofert.`);
    clearSelection();
  }, [selectedIds, confirm, toast, clearSelection]);

  /** Szybkie akcje z menu kontekstowego — świadomie te same trasy, których
   * używa profil oferty, żeby nie powstała druga implementacja tego samego. */
  const duplicateOffer = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/offers/${id}/duplicate`, { method: "POST" });
      if (!res.ok) {
        toast("Nie udało się zduplikować oferty.", "error");
        return;
      }
      await load();
      toast("Utworzono duplikat jako nowy szkic.");
    },
    [load, toast]
  );

  const sendOffer = useCallback(
    async (o: OfferRow) => {
      if (!o.klient_email) {
        toast("Brak adresu e-mail klienta — uzupełnij go w ofercie.", "error");
        return;
      }
      const ok = await confirm(`Wysłać ofertę na ${o.klient_email}?`, {});
      if (!ok) return;
      const res = await fetch(`/api/offers/${o.id}/send`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast(data.error ?? "Nie udało się wysłać oferty.", "error");
        return;
      }
      await load();
      toast("Oferta wysłana mailem.");
    },
    [confirm, load, toast]
  );

  const remindOffer = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/offers/${id}/remind`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast(data.error ?? "Nie udało się wysłać przypomnienia.", "error");
        return;
      }
      toast("Przypomnienie wysłane.");
    },
    [toast]
  );

  useRegisterActions([{ id: "add", label: "+ Nowa oferta", hint: "N", run: createOffer }], [createOffer]);

  const rows = useMemo(() => {
    let list = offers ?? [];
    // `PO_TERMINIE` to filtr wyliczany, nie status z bazy — oferta po terminie
    // wciąż ma status „Wysłana"/„Szkic", więc bez tego nie dało się jej znaleźć
    // inaczej niż wzrokiem po czerwonej dacie.
    if (filterStatus === PO_TERMINIE) list = list.filter(isOfferExpired);
    else if (filterStatus) list = list.filter((o) => o.status === filterStatus);
    const igla = szukaj.trim().toLowerCase();
    if (igla) {
      list = list.filter(
        (o) => o.tytul.toLowerCase().includes(igla) || (o.klient_nazwa ?? "").toLowerCase().includes(igla)
      );
    }
    return list;
  }, [offers, filterStatus, szukaj]);

  // Kursor po liście (j/k jak w Leadach i Klientach) nie może wskazywać poza
  // przefiltrowaną listę — inaczej Enter otwierałby ofertę, której nie widać.
  useEffect(() => {
    setKursor((k) => Math.min(k, Math.max(0, rows.length - 1)));
  }, [rows.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cel = e.target as HTMLElement | null;
      const wPolu = !!cel && (cel.tagName === "INPUT" || cel.tagName === "TEXTAREA" || cel.isContentEditable);
      if (e.key === "Escape" && wPolu && cel === szukajRef.current) {
        setSzukaj("");
        szukajRef.current?.blur();
        return;
      }
      if (wPolu || e.metaKey || e.ctrlKey || e.altKey) return;
      // Modal profilu ma własną obsługę klawiszy — lista nie może pod nim
      // przewijać kursora ani otwierać drugiej oferty.
      if (openId || newOpen || templatesOpen || rejectFor) return;
      if (e.key === "/") {
        e.preventDefault();
        szukajRef.current?.focus();
      } else if (e.key === "j") {
        setKursor((k) => Math.min(k + 1, Math.max(0, rows.length - 1)));
      } else if (e.key === "k") {
        setKursor((k) => Math.max(k - 1, 0));
      } else if (e.key === "Enter") {
        const cel = rows[kursor];
        if (cel) setOpenId(cel.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, kursor, openId, newOpen, templatesOpen, rejectFor]);

  const kpi = useMemo(() => {
    // Oferty zastąpione nowszą wersją NIE wchodzą do liczników — jedna
    // rozmowa handlowa liczyłaby się wtedy dwa razy, a skuteczność spadałaby
    // przy każdej poprawce zakresu (patrz offerLiczySieDoStatystyk).
    const list = (offers ?? []).filter(offerLiczySieDoStatystyk);
    let wToku = 0;
    let zaakceptowane = 0;
    let wazony = 0;
    let liczbaZaakceptowanych = 0;
    let liczbaOdrzuconych = 0;
    let wygasajace = 0;
    let poTerminie = 0;
    let poTerminieKwota = 0;
    let sumaWszystkich = 0;
    const today = todayLocalISO();
    const zaTydzien = addDaysToISO(today, 7);
    for (const o of list) {
      if (o.status === "Wysłana" || o.status === "Szkic") wToku += o.kwota;
      if (o.status === "Zaakceptowana") {
        zaakceptowane += o.kwota;
        liczbaZaakceptowanych += 1;
      }
      if (o.status === "Odrzucona") liczbaOdrzuconych += 1;
      wazony += weightedOfferValue(o.status, o.kwota);
      sumaWszystkich += o.kwota;
      // Otwarte oferty z ważnością w najbliższym tygodniu — te, gdzie warto
      // jeszcze zadzwonić, zanim wygasną same z siebie.
      if (!CLOSED_OFFER_STATUSES.has(o.status) && o.wazna_do && o.wazna_do >= today && o.wazna_do <= zaTydzien) {
        wygasajace += 1;
      }
      // Oferta po terminie wciąż ma otwarty status, więc wchodzi do „W toku"
      // i do ważonego pipeline'u jak żywa. Nie zmieniamy tych liczb po cichu
      // (to byłaby druga definicja tego samego wskaźnika) — mówimy wprost,
      // ile z nich jest martwych.
      if (isOfferExpired(o)) {
        poTerminie += 1;
        poTerminieKwota += o.kwota;
      }
    }
    // Skuteczność liczona tylko z ofert ROZSTRZYGNIĘTYCH — wliczanie otwartych
    // zaniżałoby ją tym bardziej, im więcej ofert właśnie wisi w toku.
    const rozstrzygniete = liczbaZaakceptowanych + liczbaOdrzuconych;
    const skutecznosc = rozstrzygniete > 0 ? Math.round((liczbaZaakceptowanych / rozstrzygniete) * 100) : null;
    const srednia = list.length > 0 ? sumaWszystkich / list.length : 0;
    // Waluty NIE przeliczamy — panel nie ma i nie będzie miał kursu (zero
    // źródeł zewnętrznych w logice). Zamiast po cichu sumować euro ze
    // złotówkami, mówimy o tym pod wskaźnikami.
    const obceWaluty = [...new Set(list.map((o) => o.waluta || "PLN").filter((w) => w !== "PLN"))];
    return { wToku, zaakceptowane, wazony, skutecznosc, rozstrzygniete, wygasajace, poTerminie, poTerminieKwota, srednia, obceWaluty };
  }, [offers]);

  if (!offers) {
    return (
      <div className="space-y-3 p-4 sm:p-6">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-[var(--hairline)]" />
        <div className="h-64 animate-pulse rounded-2xl bg-[var(--hairline)]" />
      </div>
    );
  }

  const statusOpts = OFFER_STATUSES.map((s) => ({ value: s, label: s }));

  return (
    // `flex flex-1 flex-col md:min-h-0` (Moduł 35) — przekazuje wysokość okna w dół.
    <div className="-mx-4 flex flex-1 flex-col sm:-mx-6 md:min-h-0">
      <div className="flex shrink-0 items-center gap-1 border-b hairline px-4 sm:px-6" style={{ height: "44px" }}>
        <span className="text-[13px] font-medium text-[var(--fg)]">Oferty</span>
        <div className="ml-3 flex min-w-0 flex-1 items-center gap-1.5 text-muted">
          <IconSearch size={13} className="shrink-0" />
          <input
            ref={szukajRef}
            value={szukaj}
            onChange={(e) => setSzukaj(e.target.value)}
            placeholder="Szukaj po tytule lub kliencie   /"
            className="min-w-0 max-w-[280px] flex-1 bg-transparent text-[12.5px] text-[var(--fg)] placeholder:text-muted focus:outline-none"
          />
        </div>
        <Popover
          align="right"
          width={220}
          trigger={(open) => (
            <button onClick={open} className="flex h-6 items-center rounded-md px-2 text-[12.5px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]">
              {filterStatus === PO_TERMINIE ? "Po terminie" : filterStatus || "Status: wszystkie"}
            </button>
          )}
        >
          {(close) => (
            <div>
              <MenuRow label="Wszystkie" selected={!filterStatus} onClick={() => { setFilterStatus(""); close(); }} />
              {OFFER_STATUSES.map((s) => (
                <MenuRow key={s} label={s} selected={filterStatus === s} onClick={() => { setFilterStatus(s); close(); }} />
              ))}
              <MenuDivider />
              <MenuRow
                label="Po terminie ważności"
                selected={filterStatus === PO_TERMINIE}
                onClick={() => { setFilterStatus(PO_TERMINIE); close(); }}
              />
            </div>
          )}
        </Popover>
        <ExpandingIconButton label="Szablony ofert" icon={<IconLayoutGrid size={15} />} onClick={() => setTemplatesOpen(true)} />
        <ExpandingIconButton label="Nowa oferta" icon={<IconPlus size={16} />} onClick={createOffer} />
      </div>

      <div className="flex flex-1 flex-col px-4 py-4 sm:px-6 md:min-h-0">
        {/* Moduł 27: było `sm:max-w-2xl sm:grid-cols-3` (~900 px pustki obok).
            Sześć kolumn na szerokim ekranie, symetrycznie z Fakturami. */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <div className="card-paper rounded-xl border hairline p-3">
            <div className="text-[11px] text-muted">W toku</div>
            <div className="mt-0.5 text-lg font-semibold text-[var(--fg)]">{formatMoney(kpi.wToku)}</div>
            {kpi.poTerminie > 0 && (
              <button
                onClick={() => setFilterStatus(PO_TERMINIE)}
                title="Pokaż oferty po terminie ważności"
                className="mt-0.5 text-left text-[11px] text-brand-gold underline decoration-dotted underline-offset-2"
              >
                w tym {kpi.poTerminie} po terminie — {formatMoney(kpi.poTerminieKwota)}
              </button>
            )}
          </div>
          <div className="card-paper rounded-xl border hairline p-3">
            <div className="text-[11px] text-muted">Zaakceptowane</div>
            <div className="mt-0.5 text-lg font-semibold text-emerald-400">{formatMoney(kpi.zaakceptowane)}</div>
          </div>
          <div className="card-paper rounded-xl border hairline p-3">
            <div className="flex items-center gap-1 text-[11px] text-muted">
              Ważony pipeline
              <InfoDot text="Suma otwartych ofert ważona szacowanym prawdopodobieństwem zamknięcia wg statusu — ta sama liczba co „Pipeline ofert” na Pulpicie." />
            </div>
            <div className="mt-0.5 text-lg font-semibold text-[var(--fg)]">{formatMoney(kpi.wazony)}</div>
          </div>
          <div className="card-paper rounded-xl border hairline p-3">
            <div className="flex items-center gap-1 text-[11px] text-muted">
              Skuteczność
              <InfoDot text="Udział zaakceptowanych wśród ofert rozstrzygniętych (zaakceptowane + odrzucone). Oferty wciąż otwarte nie są liczone." />
            </div>
            <div className="mt-0.5 text-lg font-semibold text-[var(--fg)]">
              {kpi.skutecznosc === null ? "—" : `${kpi.skutecznosc}%`}
            </div>
            <div className="mt-0.5 text-[11px] text-muted">
              {kpi.rozstrzygniete === 0 ? "brak rozstrzygniętych" : `z ${kpi.rozstrzygniete} rozstrzygniętych`}
            </div>
          </div>
          <div className="card-paper rounded-xl border hairline p-3">
            <div className="flex items-center gap-1 text-[11px] text-muted">
              Wygasają w 7 dni
              <InfoDot text="Otwarte oferty, których ważność kończy się w ciągu najbliższych 7 dni." />
            </div>
            <div className={`mt-0.5 text-lg font-semibold ${kpi.wygasajace > 0 ? "text-brand-gold" : "text-[var(--fg)]"}`}>{kpi.wygasajace}</div>
          </div>
          <div className="card-paper rounded-xl border hairline p-3">
            <div className="text-[11px] text-muted">Średnia wartość oferty</div>
            <div className="mt-0.5 text-lg font-semibold text-[var(--fg)]">{formatMoney(kpi.srednia)}</div>
          </div>
        </div>

        {kpi.obceWaluty.length > 0 && (
          <p className="-mt-2 mb-3 text-[11px] text-muted">
            Wskaźniki sumują kwoty bez przeliczania walut — na liście są też oferty w{" "}
            {kpi.obceWaluty.join(", ")}.
          </p>
        )}

        {selectedIds.size > 0 && (
          <div className="card-paper sticky top-2 z-30 mb-4 flex flex-wrap items-center gap-2 rounded-full px-4 py-2 text-xs">
            <span className="font-semibold">Zaznaczono: {selectedIds.size}</span>
            <Popover
              align="left"
              width={200}
              trigger={(open) => (
                <button onClick={open} disabled={bulkBusy} className="rounded-full border hairline px-3 py-1 text-xs text-[var(--fg)] disabled:opacity-50">
                  Zmień status na…
                </button>
              )}
            >
              {(close) => (
                <div>
                  {OFFER_STATUSES.map((s) => (
                    <MenuRow
                      key={s}
                      label={s}
                      onClick={() => {
                        bulkUpdateStatus(s);
                        close();
                      }}
                    />
                  ))}
                </div>
              )}
            </Popover>
            <button
              onClick={bulkDelete}
              disabled={bulkBusy}
              className="flex items-center gap-1 rounded-full border border-red-500/40 px-3 py-1 text-red-400 disabled:opacity-50"
            >
              <IconX size={13} /> Usuń zaznaczone
            </button>
            <span className="flex-1" />
            <button onClick={clearSelection} className="rounded-full border hairline px-3 py-1 text-muted">
              Odznacz wszystko
            </button>
          </div>
        )}

        {offers.length > 0 && total > offers.length && (
          <div className="mb-3 rounded-xl border border-brand-gold/40 bg-brand-gold/10 px-3 py-2 text-[12px] text-brand-gold">
            Widzisz {offers.length} z {total} ofert — reszta jest w bazie, ale nie na tej liście. Wskaźniki
            u góry liczą się z tego, co widać, więc od tej chwili są zaniżone. Powiedz o tym Claude’owi:
            czas na stronicowanie.
          </div>
        )}

        {rows.length === 0 ? (
          <div className="card-paper rounded-2xl p-10 text-center text-sm text-muted">
            <IconOfferEmpty />
            {/* Pusty stan ma mówić, czego brakuje i co to zmienia (ustalenie A1)
                — samo „brak ofert" nie tłumaczy, po co w ogóle wchodzić w ten
                ekran. */}
            {szukaj.trim() || filterStatus ? (
              <>
                <p className="mt-2">Nic nie pasuje do tego, czego szukasz.</p>
                <button
                  onClick={() => { setSzukaj(""); setFilterStatus(""); }}
                  className="mt-2 rounded-full border hairline px-3 py-1 text-xs text-[var(--fg)]"
                >
                  Wyczyść filtry
                </button>
              </>
            ) : (
              <>
                <p className="mt-2 text-[var(--fg)]">Nie ma jeszcze żadnej oferty.</p>
                <p className="mx-auto mt-1 max-w-md text-[12.5px]">
                  Oferta to moment, w którym rozmowa zamienia się w liczby. Gdy klient ją zaakceptuje,
                  panel sam założy projekt i szkic faktury, a lead z niej zrobiony awansuje na klienta.
                </p>
                <button onClick={createOffer} className="btn-primary mt-3 rounded-full px-4 py-1.5 text-xs font-semibold">
                  + Nowa oferta
                </button>
              </>
            )}
          </div>
        ) : (
          // `flex-1` + `overflow-auto` (Moduł 35): tabela sięga dołu okna i przewija
          // się w środku, zamiast kończyć się na ostatnim wierszu.
          <div className="card-paper flex-1 overflow-auto rounded-2xl md:min-h-0">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b hairline text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="p-2.5">
                    <input
                      type="checkbox"
                      checked={rows.length > 0 && rows.every((r) => selectedIds.has(r.id))}
                      onChange={(e) => toggleSelectAll(e.target.checked, rows.map((r) => r.id))}
                      className="h-3.5 w-3.5 cursor-pointer accent-[#4ea7fc]"
                      aria-label="Zaznacz wszystkie"
                    />
                  </th>
                  <th className="p-2.5 font-medium">Tytuł</th>
                  <th className="p-2.5 font-medium">Klient</th>
                  <th className="p-2.5 text-right font-medium">Kwota</th>
                  <th className="p-2.5 font-medium">Status</th>
                  <th className="p-2.5 font-medium">Ważna do</th>
                  <th className="p-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o, i) => {
                  const expired = isOfferExpired(o);
                  return (
                    <tr
                      key={o.id}
                      onClick={() => setOpenId(o.id)}
                      onContextMenu={(e) => ctx.openAt(e, o)}
                      className={`cursor-pointer border-b hairline transition-colors hover:bg-[var(--hairline)]/40 ${
                        expired ? "bg-red-500/[0.04]" : ""
                      } ${selectedIds.has(o.id) ? "bg-[#4ea7fc]/[0.08]" : ""} ${
                        i === kursor ? "ring-1 ring-inset ring-brand-purple/50" : ""
                      }`}
                    >
                      <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(o.id)}
                          onChange={() => toggleSelect(o.id)}
                          className="h-3.5 w-3.5 cursor-pointer accent-[#4ea7fc]"
                          aria-label={`Zaznacz ${o.tytul || "(bez tytułu)"}`}
                        />
                      </td>
                      <td className="p-2.5 font-medium text-[var(--fg)]">
                        <span className="flex items-center gap-1.5">
                          {o.tytul || <span className="text-muted">(bez tytułu)</span>}
                          {o.wersja > 1 && (
                            <Tooltip label="Nowsza wersja wcześniejszej oferty">
                              <span className="rounded-full bg-[var(--hairline)] px-1.5 py-0.5 text-[10px] font-medium text-muted">
                                v{o.wersja}
                              </span>
                            </Tooltip>
                          )}
                          {o.otwarta_at && !CLOSED_OFFER_STATUSES.has(o.status) && (
                            <Tooltip label={`Klient otworzył ofertę ${o.liczba_otwarc}×`}>
                              <span className="flex items-center gap-0.5 rounded-full bg-brand-cyan/15 px-1.5 py-0.5 text-[10px] font-medium text-brand-cyan">
                                <IconEye size={11} /> {o.liczba_otwarc}
                              </span>
                            </Tooltip>
                          )}
                          <Tooltip label="Język wydruku">
                            <span className="rounded-full bg-[var(--hairline)] px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted">
                              {o.jezyk}
                            </span>
                          </Tooltip>
                        </span>
                      </td>
                      <td className="p-2.5">{o.klient_nazwa || <span className="text-muted opacity-60">— brak —</span>}</td>
                      <td className="p-2.5 text-right tabular-nums">{formatMoney(o.kwota, o.waluta || "PLN")}</td>
                      <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                        <PropertyMenu value={o.status} options={statusOpts} onChange={(v) => updateStatus(o.id, v)} title="Zmień status">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${OFFER_STATUS_CLASS[o.status] ?? ""}`}>
                            {o.status}
                          </span>
                        </PropertyMenu>
                      </td>
                      <td className={`p-2.5 ${expired ? "font-medium text-red-400" : "text-muted"}`}>
                        {o.wazna_do ? formatPlDate(o.wazna_do) : "—"}
                      </td>
                      <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <ExpandingIconButton
                            label="Podgląd / wydruk"
                            icon={<IconExternalLink size={15} />}
                            href={`/${lang}/admin/offers/${o.id}/print`}
                            newTab
                          />
                          <ExpandingIconButton
                            label="Usuń"
                            icon={<IconX size={15} />}
                            onClick={() => deleteOffer(o.id, o.tytul)}
                            tone="danger"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Menu kontekstowe jest SKRÓTEM — wszystko, co w nim jest, da się
          zrobić też widocznymi przyciskami albo w profilu oferty. */}
      <ContextMenu ctl={ctx} width={230}>
        {(o, close) => (
          <>
            <ContextMenuItem
              icon={<IconFileDescription size={14} />}
              label="Otwórz ofertę"
              onClick={() => {
                close();
                setOpenId(o.id);
              }}
            />
            <ContextMenuItem
              icon={<IconExternalLink size={14} />}
              label="Podgląd / wydruk"
              onClick={() => {
                close();
                window.open(`/${lang}/admin/offers/${o.id}/print`, "_blank");
              }}
            />
            <MenuDivider />
            <ContextMenuItem
              icon={<IconMail size={14} />}
              label={o.status === "Szkic" ? "Wyślij mailem" : "Wyślij ponownie"}
              disabled={!o.klient_email || CLOSED_OFFER_STATUSES.has(o.status)}
              onClick={() => {
                close();
                sendOffer(o);
              }}
            />
            <ContextMenuItem
              icon={<IconBell size={14} />}
              label="Przypomnij mailem"
              disabled={o.status !== "Wysłana" || !o.klient_email}
              onClick={() => {
                close();
                remindOffer(o.id);
              }}
            />
            <MenuDivider />
            <ContextMenuItem
              icon={<IconCheck size={14} />}
              label="Oznacz: zaakceptowana"
              disabled={o.status === "Zaakceptowana"}
              onClick={() => {
                close();
                setOpenId(o.id);
                toast("Akceptacja zakłada projekt i fakturę — potwierdź ją w ofercie.");
              }}
            />
            <ContextMenuItem
              icon={<IconThumbDown size={14} />}
              label="Klient odrzucił…"
              disabled={o.status === "Odrzucona"}
              onClick={() => {
                close();
                setRejectFor(o.id);
              }}
            />
            <ContextMenuItem
              icon={<IconClockOff size={14} />}
              label="Oznacz jako wygasłą"
              disabled={CLOSED_OFFER_STATUSES.has(o.status)}
              onClick={() => {
                close();
                zapiszStatus(o.id, "Wygasła");
              }}
            />
            <MenuDivider />
            <ContextMenuItem
              icon={<IconCopy size={14} />}
              label="Duplikuj ofertę"
              onClick={() => {
                close();
                duplicateOffer(o.id);
              }}
            />
            <ContextMenuItem
              icon={<IconX size={14} />}
              label="Usuń ofertę"
              danger
              onClick={() => {
                close();
                deleteOffer(o.id, o.tytul);
              }}
            />
          </>
        )}
      </ContextMenu>

      <Modal
        open={!!openId}
        onClose={() => setOpenId(null)}
        // Pełna szerokość jak w Leadach i Klientach (zgłoszenie właściciela
        // 2026-07-26: „po bokach są wolne przestrzenie"). Wysokość i własne
        // przewijanie kolumn są w OfferEditor — tam, gdzie jest treść.
        card="card-paper my-auto w-full rounded-2xl border hairline p-5 sm:p-6"
      >
        {openId && (
          <OfferEditor
            id={openId}
            lang={lang}
            onClose={() => setOpenId(null)}
            onChange={load}
            onDeleted={(id) => {
              setOffers((prev) => prev?.filter((o) => o.id !== id) ?? prev);
              setTotal((t) => Math.max(0, t - 1));
              setOpenId(null);
            }}
          />
        )}
      </Modal>

      <Modal
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        z={95}
        card="card-paper my-auto w-full max-w-xl rounded-2xl border hairline p-5 sm:p-6"
      >
        <OfferTemplatesPanel onClose={() => setTemplatesOpen(false)} />
      </Modal>

      <Modal
        open={!!rejectFor}
        onClose={() => setRejectFor(null)}
        z={95}
        card="card-paper my-auto w-full max-w-md rounded-2xl border hairline p-5"
      >
        {rejectFor && (
          <OknoOdrzucenia
            onCancel={() => setRejectFor(null)}
            onConfirm={(powod, komentarz) => {
              const id = rejectFor;
              setRejectFor(null);
              zapiszStatus(id, "Odrzucona", powod, komentarz);
            }}
          />
        )}
      </Modal>

      <NewDocumentDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onPick={createOfferFor}
        tytul="Nowa oferta — dla kogo?"
        opis="Powiązanie decyduje o tym, czy oferta trafi na kartę klienta i czy po zamknięciu projektu panel przypomni o kontakcie. Możesz je dodać także później."
        leadNote="założy klienta"
      />
    </div>
  );
}

function IconOfferEmpty() {
  return (
    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--hairline)] text-muted">
      <IconFileDescription size={20} />
    </div>
  );
}
