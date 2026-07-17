"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { IconMessageCircle, IconCornerUpLeft, IconMail, IconPhoneOff } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import {
  type Client,
  CLIENT_STATUS_HINT,
  CLIENT_STATUS_STEP,
  ClientEventIcon,
  CLIENT_EVENT_TARGET,
  CONTACT_CHANNELS,
  CONTACT_CHANNEL_LABEL,
  ContactChannelIcon,
  CONTACT_CHANNEL_CLASS,
  CONTACT_DIRECTIONS,
  CONTACT_DIRECTION_LABEL,
  CALL_OUTCOMES,
  CALL_OUTCOME_LABEL,
  CallOutcomeIcon,
  CALL_OUTCOME_CLASS,
  formatCallDuration,
  ContactQuickActions,
  QuickDateChips,
  EditableText,
  EditableTextarea,
  StatusTag,
} from "./shared";
import { ProcessMap, PillPicker } from "../components";
import { formatPlDate } from "@/lib/projects";
import { CONTRACT_TYP_LABEL } from "@/lib/contracts";
import { formatMoney } from "@/lib/invoices";
import { useUI } from "../ui";
import { DateField } from "../DatePicker";
import { todayLocalISO, addDaysLocalISO } from "@/lib/dates";
import { MailStatusTag, type MailStatus } from "../mail/shared";
import { ViewTabs, ViewSwitch } from "../ViewTabs";
import { FieldChangesTab } from "../FieldChangesTab";
import type { FieldChange } from "@/lib/audit";

type LinkedOffer = { id: string; tytul: string; status: string; wazna_do: string | null; created_at: string };
type LinkedInvoice = { id: string; numer: string | null; status: string; typ_dokumentu: string; created_at: string };
type LinkedProject = { id: string; tytul: string; status: string; termin: string | null; created_at: string };
/** Moduł 31 — umowy/NDA klienta. `project_id` jest tu po to, żeby dało się z
 * karty odróżnić umowę odblokowującą start projektu od wolnostojącej. */
type LinkedContract = {
  id: string;
  typ: "umowa" | "nda";
  status: string;
  project_id: string | null;
  accepted_at: string | null;
  created_at: string;
};
/** Kartoteka korespondencji (04d pkt 2) — osobny rejestr obok scalonego
 * feedu, na wyraźną prośbę właściciela 2026-07-15. */
type ClientMail = { id: string; subject: string; kierunek: "in" | "out"; status: string; received_at: string };

/** Jeden scalony chronologiczny feed z trzech źródeł (patrz
 * app/api/clients/[id]/route.ts): ręczne notatki klienta, notatki
 * dociągnięte z leada sprzed awansu na klienta, i zdarzenia systemowe
 * (oferta wysłana, faktura wystawiona/opłacona itd.). */
type FeedItem = {
  id: string;
  created_at: string;
  kind: string;
  text: string;
  amount: number | null;
  kanal: string | null;
  kierunek: string | null;
  wynik: string | null;
  czas_trwania_sek: number | null;
  /** Id oferty/faktury/projektu/umowy, do którego się odnosi (Moduł 12) —
   * null gdy zdarzenie świadomie bez celu (patrz CLIENT_EVENT_TARGET). */
  related_id: string | null;
  /** Id wiadomości, z której powstał ten wpis (Moduł 4) — wpis na osi jest
   * tylko skrótem, link prowadzi do pełnej treści w Poczcie. Null dla wpisów
   * niebędących mailem i dla maili usuniętych przez retencję. */
  mail_message_id: string | null;
  source: "client" | "lead" | "system";
};

/**
 * Rdzeń widoku szczegółów klienta — dane kontaktowe, status relacji,
 * chronologiczny log kontaktu ("kiedy/jak/w jakiej sprawie" — to co prosił
 * właściciel), plus powiązane oferty/faktury/projekty w jednym miejscu.
 * Wzorem LeadDetailPanel.tsx: ten sam kształt panelu/podstrony.
 */
export function ClientDetailPanel({
  id,
  lang,
  onClose,
  onDeleted,
  onFieldChange,
}: {
  id: string;
  lang: Locale;
  onClose?: () => void;
  onDeleted?: (id: string) => void;
  onFieldChange?: (id: string, field: string, value: string) => void;
}) {
  const { confirm, toast } = useUI();
  const [client, setClient] = useState<Client | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [changes, setChanges] = useState<FieldChange[]>([]);
  // Moduł 23 — profil rozbity na zakładki na prośbę właściciela 2026-07-16
  // („żeby nie wszystko kumulowało się na jednej stronie"). Stan trzymany tu, w
  // *DetailPanel, a nie w wrapperach — dzięki temu działa i w modalu z listy, i
  // na podstronie [id], bez dublowania.
  const [tab, setTab] = useState<"card" | "history" | "changes">("card");
  const [offers, setOffers] = useState<LinkedOffer[]>([]);
  const [invoices, setInvoices] = useState<LinkedInvoice[]>([]);
  const [projects, setProjects] = useState<LinkedProject[]>([]);
  const [contracts, setContracts] = useState<LinkedContract[]>([]);
  const [mail, setMail] = useState<ClientMail[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteFollowup, setNoteFollowup] = useState("");
  const [noteAction, setNoteAction] = useState("");
  const [noteChannel, setNoteChannel] = useState("");
  const [noteDirection, setNoteDirection] = useState("wychodzacy");
  const [noteOutcome, setNoteOutcome] = useState("");
  const [noteDurationMin, setNoteDurationMin] = useState("");
  const [noteDurationSec, setNoteDurationSec] = useState("");
  const [markContacted, setMarkContacted] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedFilter, setFeedFilter] = useState<"all" | "calls" | "system" | "notes">("all");

  const load = useCallback(async () => {
    const res = await fetch(`/api/clients/${id}`);
    if (res.status === 401) {
      window.location.reload();
      return;
    }
    if (res.status === 404) {
      setNotFound(true);
      return;
    }
    const data = (await res.json()) as {
      client: Client;
      feed: FeedItem[];
      offers: LinkedOffer[];
      invoices: LinkedInvoice[];
      projects: LinkedProject[];
      contracts: LinkedContract[];
      mail: ClientMail[];
    };
    setClient(data.client);
    setFeed(data.feed);
    setOffers(data.offers);
    setInvoices(data.invoices);
    setProjects(data.projects);
    setContracts(data.contracts ?? []);
    setMail(data.mail ?? []);
    setNoteFollowup(data.client.next_followup ?? "");
    setNoteAction(data.client.next_action ?? "");
  }, [id]);

  useEffect(() => {
    setClient(null);
    setNotFound(false);
    setTab("card");
    load();
  }, [load]);

  // Log zmian dociągany dopiero po otwarciu zakładki — i za KAŻDYM jej
  // otwarciem, bo właściciel mógł właśnie coś zmienić w wizytówce obok.
  useEffect(() => {
    if (tab !== "changes") return;
    let cancelled = false;
    fetch(`/api/clients/${id}/changes`)
      .then((res) => (res.ok ? res.json() : { changes: [] }))
      .then((data: { changes: FieldChange[] }) => {
        if (!cancelled) setChanges(data.changes ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tab, id]);

  const updateClient = async (field: string, value: string) => {
    setClient((prev) => (prev ? { ...prev, [field]: value } : prev));
    onFieldChange?.(id, field, value);
    const res = await fetch(`/api/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (!res.ok) toast("Nie udało się zapisać zmiany.", "error");
  };

  const deleteClient = async () => {
    if (!client) return;
    const ok = await confirm(`Usunąć "${client.nazwa}" z rejestru klientów? Powiązane oferty/faktury/projekty zostaną, tylko odpięte.`, {
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Nie udało się usunąć klienta.", "error");
      return;
    }
    toast("Klient usunięty.");
    onDeleted?.(id);
  };

  const submitNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSaving(true);
    const durationSec =
      noteOutcome === "odebrane" ? (Number(noteDurationMin) || 0) * 60 + (Number(noteDurationSec) || 0) : null;
    const res = await fetch(`/api/clients/${id}/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: noteText.trim(),
        kanal: noteChannel || null,
        kierunek: noteDirection || null,
        wynik: noteOutcome || null,
        czas_trwania_sek: durationSec,
        next_followup: noteFollowup || null,
        next_action: noteAction || null,
        ...(markContacted ? { ostatni_kontakt: todayLocalISO() } : {}),
      }),
    });
    setSaving(false);
    if (res.ok) {
      setNoteText("");
      setNoteOutcome("");
      setNoteDurationMin("");
      setNoteDurationSec("");
      toast("Zapisano wpis.");
      load();
    } else {
      toast("Nie udało się zapisać wpisu.", "error");
    }
  };

  const deleteNote = async (activityId: string) => {
    const ok = await confirm("Usunąć ten wpis z historii kontaktu?", { danger: true });
    if (!ok) return;
    const res = await fetch(`/api/clients/${id}/activity/${activityId}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Nie udało się usunąć wpisu.", "error");
      return;
    }
    setFeed((prev) => prev.filter((f) => f.id !== activityId));
  };

  if (notFound) {
    return (
      <div className="card-paper max-h-[85vh] overflow-y-auto rounded-2xl border hairline p-6 sm:p-8">
        <PanelHeader onClose={onClose} />
        <p className="mt-6 text-sm text-muted">Nie znaleziono takiego klienta — może został usunięty.</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="card-paper max-h-[85vh] overflow-y-auto rounded-2xl border hairline p-6 sm:p-8">
        <PanelHeader onClose={onClose} />
        <div className="mt-6 space-y-3">
          <div className="h-6 w-2/3 animate-pulse rounded-lg bg-[var(--hairline)]" />
          <div className="h-4 w-1/3 animate-pulse rounded-lg bg-[var(--hairline)]" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-[var(--hairline)]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const linkedCount = offers.length + invoices.length + projects.length + contracts.length;

  const FEED_FILTERS: { value: typeof feedFilter; label: string }[] = [
    { value: "all", label: "Wszystko" },
    { value: "calls", label: "Połączenia" },
    { value: "system", label: "Systemowe" },
    { value: "notes", label: "Notatki" },
  ];
  const filteredFeed = feed.filter((f) => {
    if (feedFilter === "all") return true;
    if (feedFilter === "calls") return f.kanal === "telefon";
    if (feedFilter === "system") return f.source === "system";
    return f.kind === "note" && f.kanal !== "telefon";
  });

  return (
    <div className="card-paper max-h-[85vh] overflow-y-auto rounded-2xl border hairline p-6 sm:p-8">
      <PanelHeader onClose={onClose} />

      <div className={onClose ? "mt-4" : ""}>
        <div className="flex items-start justify-between gap-4">
          <input
            value={client.nazwa}
            onChange={(e) => setClient((prev) => (prev ? { ...prev, nazwa: e.target.value } : prev))}
            onBlur={(e) => updateClient("nazwa", e.target.value)}
            className="w-full bg-transparent text-2xl font-semibold tracking-tight text-[var(--fg)] outline-none"
          />
          <button onClick={deleteClient} className="shrink-0 rounded-full border hairline px-3 py-1.5 text-xs text-red-400">
            Usuń klienta
          </button>
        </div>

        <div className="mt-2">
          <StatusTag status={client.status} onChange={(v) => updateClient("status", v)} />
        </div>
        <p className="mt-2 text-[12.5px] text-muted opacity-80">{CLIENT_STATUS_HINT[client.status]}</p>

        <div className="mt-4">
          <ContactQuickActions telefon={client.telefon} email={client.email} linkedinUrl={client.linkedin_url} />
        </div>
      </div>

      {/* Nazwa, status i szybkie akcje zostają NAD zakładkami — to tożsamość
          rekordu i główna akcja dnia, więc mają być pod ręką niezależnie od
          tego, którą zakładkę właściciel akurat czyta. */}
      <div className="mt-5 flex h-9 items-center gap-4 border-b hairline">
        <ViewTabs
          value={tab}
          onChange={setTab}
          layoutId="client-detail-tab-underline"
          tabs={[
            { id: "card", label: "Wizytówka" },
            { id: "history", label: "Historia kontaktu" },
            { id: "changes", label: "Logi zmian" },
          ]}
        />
      </div>

      <ViewSwitch viewKey={tab}>
        {tab === "card" && (
          <div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="NIP">
                <EditableText value={client.nip} onSave={(v) => updateClient("nip", v)} />
              </Field>
              <Field label="Branża">
                <EditableText value={client.branza} onSave={(v) => updateClient("branza", v)} />
              </Field>
              <Field label="Telefon">
                <EditableText value={client.telefon} onSave={(v) => updateClient("telefon", v)} />
              </Field>
              <Field label="Email">
                <EditableText value={client.email} onSave={(v) => updateClient("email", v)} />
              </Field>
              <Field label="WWW">
                <EditableText value={client.www} onSave={(v) => updateClient("www", v)} />
              </Field>
              <Field label="LinkedIn">
                <EditableText value={client.linkedin_url} onSave={(v) => updateClient("linkedin_url", v)} />
              </Field>
              <Field label="Ulica">
                <EditableText value={client.ulica} onSave={(v) => updateClient("ulica", v)} />
              </Field>
              <Field label="Kod / Miasto">
                <div className="flex gap-2">
                  <EditableText value={client.kod} onSave={(v) => updateClient("kod", v)} />
                  <EditableText value={client.miasto} onSave={(v) => updateClient("miasto", v)} />
                </div>
              </Field>
              <Field label="Kraj">
                <EditableText value={client.kraj} onSave={(v) => updateClient("kraj", v)} />
              </Field>
              <Field label="Ostatni kontakt">
                <DateField value={client.ostatni_kontakt ?? ""} onChange={(v) => updateClient("ostatni_kontakt", v)} placeholder="—" />
              </Field>
              <Field label="Przypomnij mi">
                <DateField value={client.next_followup ?? ""} onChange={(v) => updateClient("next_followup", v)} placeholder="—" />
              </Field>
              {client.next_followup && (
                <Field label="Następny krok (po co przypomnienie)">
                  <EditableText value={client.next_action} onSave={(v) => updateClient("next_action", v)} />
                </Field>
              )}
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-[11px] text-muted">Notatka przypięta</label>
              <EditableTextarea value={client.notatki} onSave={(v) => updateClient("notatki", v)} />
            </div>

            {linkedCount > 0 && (
              <div className="mt-6 border-t hairline pt-6">
                <h2 className="mb-4 text-lg font-semibold">Powiązane</h2>
                <div className="space-y-4">
                  {offers.length > 0 && (
                    <LinkedGroup title="Oferty">
                      {offers.map((o) => (
                        <li key={o.id}>
                          <Link href={`/${lang}/admin/offers/${o.id}`} className="hover:underline">
                            {o.tytul || "(bez tytułu)"}
                          </Link>
                          <span className="text-muted"> — {o.status}{o.wazna_do ? `, ważna do ${formatPlDate(o.wazna_do)}` : ""}</span>
                        </li>
                      ))}
                    </LinkedGroup>
                  )}
                  {invoices.length > 0 && (
                    <LinkedGroup title="Faktury">
                      {invoices.map((i) => (
                        <li key={i.id}>
                          <Link href={`/${lang}/admin/invoices/${i.id}`} className="hover:underline">
                            {i.numer ?? "(szkic)"}
                          </Link>
                          <span className="text-muted"> — {i.status}</span>
                        </li>
                      ))}
                    </LinkedGroup>
                  )}
                  {projects.length > 0 && (
                    <LinkedGroup title="Projekty">
                      {projects.map((p) => (
                        <li key={p.id}>
                          <Link href={`/${lang}/admin/projects/${p.id}`} className="hover:underline">
                            {p.tytul}
                          </Link>
                          <span className="text-muted"> — {p.status}{p.termin ? `, termin ${formatPlDate(p.termin)}` : ""}</span>
                        </li>
                      ))}
                    </LinkedGroup>
                  )}
                  {/* Moduł 31 — do tej pory jedyny moduł, o którym karta klienta
                      milczała, mimo że od niego zależy start jego projektów. */}
                  {contracts.length > 0 && (
                    <LinkedGroup title="Umowy i NDA">
                      {contracts.map((c) => (
                        <li key={c.id}>
                          <Link href={`/${lang}/admin/contracts/${c.id}`} className="hover:underline">
                            {CONTRACT_TYP_LABEL[c.typ]}
                          </Link>
                          <span className="text-muted">
                            {" "}
                            — {c.status}
                            {c.accepted_at ? `, podpisana ${formatPlDate(c.accepted_at)}` : ""}
                            {c.typ === "umowa" && !c.project_id ? ", bez projektu" : ""}
                          </span>
                        </li>
                      ))}
                    </LinkedGroup>
                  )}
                </div>
              </div>
            )}

            {/* Mapa procesu zostaje na wizytówce — to „gdzie jesteśmy z tym
                klientem", czyli kontekst do danych obok, a nie historia. */}
            <div className="mt-6 border-t hairline pt-6">
              <h2 className="mb-4 text-lg font-semibold">Proces sprzedaży</h2>
              <ProcessMap currentStep={CLIENT_STATUS_STEP[client.status] ?? 3} />
            </div>
          </div>
        )}

        {tab === "history" && (
          <div>
            {mail.length > 0 && (
              <div className="mt-6">
                <h2 className="mb-1 text-lg font-semibold">Korespondencja</h2>
                <p className="mb-4 text-[12px] text-muted opacity-70">
                  Wszystkie maile tego klienta — pełna treść w Poczcie pod linkiem.
                </p>
                <ul className="space-y-1.5">
                  {mail.map((m) => (
                    <li key={m.id}>
                      <Link
                        href={`/${lang}/admin/mail/${m.id}`}
                        className="flex items-center gap-2.5 rounded-xl border hairline px-3 py-2 text-sm hover:bg-[var(--hairline)]/40"
                      >
                        <span className="shrink-0 text-base" aria-hidden>
                          {m.kierunek === "out" ? <IconCornerUpLeft size={13} /> : <IconMail size={13} />}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{m.subject || "(bez tematu)"}</span>
                        <MailStatusTag status={m.status as MailStatus} />
                        <span className="shrink-0 text-[11px] text-muted">{formatPlDate(m.received_at)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className={mail.length > 0 ? "mt-6 border-t hairline pt-6" : "mt-6"}>
              <h2 className="mb-1 text-lg font-semibold">Pełna historia</h2>
              <p className="mb-4 text-[12px] text-muted opacity-70">
                Notatki i zdarzenia systemowe (oferty, faktury, wpłaty) w jednej chronologicznej osi.
              </p>

              <form onSubmit={submitNote} className="mb-6 space-y-2">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder="Kiedy, jak i w jakiej sprawie się kontaktowałeś? np. rozmowa telefoniczna, umówiliśmy się na demo za 2 tygodnie… (Cmd+Enter, by zapisać)"
                  rows={3}
                  className="w-full rounded-xl border hairline bg-transparent px-3 py-2 text-sm text-[var(--fg)] placeholder:text-muted"
                />

                <div className="flex flex-wrap items-center gap-2">
                  <PillPicker
                    value={noteChannel ? CONTACT_CHANNEL_LABEL[noteChannel as keyof typeof CONTACT_CHANNEL_LABEL] : ""}
                    options={CONTACT_CHANNELS.map((c) => CONTACT_CHANNEL_LABEL[c])}
                    onChange={(label) => {
                      const found = CONTACT_CHANNELS.find((c) => CONTACT_CHANNEL_LABEL[c] === label);
                      setNoteChannel(found ?? "");
                    }}
                    placeholder="Kanał — wybierz"
                    title="Jakim kanałem?"
                  />
                  <div className="flex overflow-hidden rounded-full border hairline text-[11px]">
                    {CONTACT_DIRECTIONS.map((dir) => (
                      <button
                        key={dir}
                        type="button"
                        onClick={() => setNoteDirection(dir)}
                        className={`min-h-[30px] px-2.5 ${
                          noteDirection === dir ? "bg-[var(--fg)] text-[var(--bg)]" : "text-muted hover:bg-[var(--hairline)]"
                        }`}
                      >
                        {CONTACT_DIRECTION_LABEL[dir]}
                      </button>
                    ))}
                  </div>
                </div>

                {noteChannel === "telefon" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex overflow-hidden rounded-full border hairline text-[11px]">
                      {CALL_OUTCOMES.map((o) => (
                        <button
                          key={o}
                          type="button"
                          onClick={() => setNoteOutcome(o)}
                          className={`flex min-h-[30px] items-center gap-1 px-2.5 ${
                            noteOutcome === o ? `${CALL_OUTCOME_CLASS[o]} font-medium` : "text-muted hover:bg-[var(--hairline)]"
                          }`}
                        >
                          <CallOutcomeIcon kind={o} size={13} />
                          {CALL_OUTCOME_LABEL[o]}
                        </button>
                      ))}
                    </div>
                    {noteOutcome === "odebrane" && (
                      <div className="flex items-center gap-1.5 text-xs text-muted">
                        <input
                          type="number"
                          min={0}
                          value={noteDurationMin}
                          onChange={(e) => setNoteDurationMin(e.target.value)}
                          placeholder="0"
                          className="w-12 rounded-md border hairline bg-transparent px-2 py-1 text-center text-[var(--fg)]"
                        />
                        min
                        <input
                          type="number"
                          min={0}
                          max={59}
                          value={noteDurationSec}
                          onChange={(e) => setNoteDurationSec(e.target.value)}
                          placeholder="0"
                          className="w-12 rounded-md border hairline bg-transparent px-2 py-1 text-center text-[var(--fg)]"
                        />
                        s
                      </div>
                    )}
                  </div>
                )}

                {noteChannel === "telefon" && noteDirection === "przychodzacy" && noteOutcome === "nieodebrane" && !noteFollowup && (
                  <button
                    type="button"
                    onClick={() => {
                      setNoteFollowup(addDaysLocalISO(1));
                      setNoteAction("Oddzwonić");
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-left text-xs text-red-400 hover:bg-red-500/15"
                  >
                    <IconPhoneOff size={12} className="mr-1 inline align-[-2px]" />Nieodebrane od klienta — ustaw przypomnienie na jutro
                  </button>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <input type="checkbox" checked={markContacted} onChange={(e) => setMarkContacted(e.target.checked)} />
                    Oznacz jako dzisiejszy kontakt
                  </label>
                  <label className="flex items-center gap-2 text-xs text-muted">
                    Przypomnij mi:
                    <DateField value={noteFollowup} onChange={setNoteFollowup} placeholder="—" />
                  </label>
                  <QuickDateChips onPick={setNoteFollowup} />
                </div>
                {noteFollowup && (
                  <input
                    value={noteAction}
                    onChange={(e) => setNoteAction(e.target.value)}
                    placeholder="Następny krok — po co to przypomnienie? np. wysłać ofertę po demo"
                    className="w-full rounded-xl border hairline bg-transparent px-3 py-2 text-xs text-[var(--fg)] placeholder:text-muted"
                  />
                )}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving || !noteText.trim()}
                    className="bg-[var(--fg)] text-[var(--bg)] hover:opacity-90 rounded-full px-4 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? "Zapisuję…" : "Dodaj wpis"}
                  </button>
                </div>
              </form>

              {feed.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {FEED_FILTERS.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setFeedFilter(f.value)}
                      className={`rounded-full border hairline px-2.5 py-1 text-[11px] ${
                        feedFilter === f.value ? "bg-[var(--fg)] text-[var(--bg)]" : "text-muted hover:bg-[var(--hairline)]"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}

              {feed.length === 0 ? (
                <p className="text-sm text-muted opacity-60">Brak wpisów — dodaj pierwszy powyżej.</p>
              ) : filteredFeed.length === 0 ? (
                <p className="text-sm text-muted opacity-60">Brak wpisów w tym filtrze.</p>
              ) : (
                groupFeedByDay(filteredFeed).map((group) => (
                  <div key={group.label} className="mb-4 last:mb-0">
                    <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted opacity-60">{group.label}</div>
                    <ul className="space-y-2">
                      {group.items.map((f) => {
                        const badge = feedBadge(f);
                        // Moduł 12 — zdarzenie klikalne, gdy ma zapisany cel
                        // (oferta/faktura/projekt/umowa) i typ zdarzenia wie, dokąd
                        // prowadzi (patrz CLIENT_EVENT_TARGET). Starsze zdarzenia
                        // sprzed migracji nie mają related_id — zostają bez linku.
                        const targetSegment = CLIENT_EVENT_TARGET[f.kind];
                        // Wpis z maila (Moduł 4) linkuje do pełnej treści w Poczcie;
                        // reszta — do rekordu wg CLIENT_EVENT_TARGET.
                        const href = f.mail_message_id
                          ? `/${lang}/admin/mail/${f.mail_message_id}`
                          : f.related_id && targetSegment
                            ? `/${lang}/admin/${targetSegment}/${f.related_id}`
                            : null;
                        const text = (
                          <p className={`whitespace-pre-wrap ${href ? "hover:underline" : ""}`}>
                            {f.text}
                            {f.amount != null && <span className="font-medium"> — {formatMoney(f.amount)}</span>}
                          </p>
                        );
                        return (
                          <li key={`${f.source}:${f.id}`} className="flex items-start gap-2.5 rounded-xl border hairline p-3 text-sm">
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] ${badge.cls}`}
                              aria-hidden
                            >
                              {badge.icon}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="mb-0.5 flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5 text-[11px] text-muted">
                                  {formatTime(f.created_at)}
                                  {f.czas_trwania_sek != null && <span>· {formatCallDuration(f.czas_trwania_sek)}</span>}
                                  {f.kierunek && (
                                    <span className="rounded-full bg-[var(--hairline)] px-1.5 py-0.5 text-[10px]">
                                      {CONTACT_DIRECTION_LABEL[f.kierunek as keyof typeof CONTACT_DIRECTION_LABEL]}
                                    </span>
                                  )}
                                  {f.source === "lead" && (
                                    <span className="rounded-full bg-[var(--hairline)] px-1.5 py-0.5 text-[10px] text-muted" title="Wpis sprzed awansu na klienta">
                                      z etapu leada
                                    </span>
                                  )}
                                </span>
                                {f.source === "client" && (
                                  <button onClick={() => deleteNote(f.id)} className="text-muted hover:text-red-400" aria-label="Usuń wpis" title="Usuń wpis">
                                    ✕
                                  </button>
                                )}
                              </div>
                              {href ? <Link href={href}>{text}</Link> : text}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === "changes" && <FieldChangesTab entity="client" changes={changes} />}
      </ViewSwitch>
    </div>
  );
}

function LinkedGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">{title}</h3>
      <ul className="space-y-1 text-sm">{children}</ul>
    </div>
  );
}

function PanelHeader({ onClose }: { onClose?: () => void }) {
  if (!onClose) return null;
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted">Szczegóły klienta</span>
      <button onClick={onClose} className="rounded-full border hairline px-2.5 py-1 text-xs text-muted hover:text-[var(--fg)]" aria-label="Zamknij" title="Zamknij (Esc)">
        ✕ Zamknij
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] text-muted">{label}</label>
      {children}
    </div>
  );
}

/** Kolorowa odznaka wpisu na osi — wzorem iOS: nieodebrane połączenie
 * czerwone, inne kanały mają swój stały kolor, zdarzenia systemowe i
 * notatki bez kanału dostają neutralne tło. */
function feedBadge(f: { kanal: string | null; wynik: string | null; kind: string }): { icon: ReactNode; cls: string } {
  if (f.kanal === "telefon" && f.wynik === "nieodebrane") {
    return { icon: <CallOutcomeIcon kind="nieodebrane" size={14} />, cls: CALL_OUTCOME_CLASS.nieodebrane };
  }
  if (f.kanal) {
    return {
      icon: <ContactChannelIcon kind={f.kanal} size={14} />,
      cls: CONTACT_CHANNEL_CLASS[f.kanal as keyof typeof CONTACT_CHANNEL_CLASS],
    };
  }
  if (f.kind === "note") return { icon: <IconMessageCircle size={14} />, cls: "bg-[var(--hairline)] text-muted" };
  return { icon: <ClientEventIcon kind={f.kind} size={14} />, cls: "bg-[var(--hairline)] text-muted" };
}

/** "Dziś" / "Wczoraj" / "DD.MM.YYYY" — kosmetyczne grupowanie osi po dniu
 * (styl Wiadomości/Telefonu w iOS), niezwiązane z todayLocalISO() z
 * lib/dates.ts (ta funkcja nie steruje żadną regułą biznesową). */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Dziś";
  if (sameDay(d, yesterday)) return "Wczoraj";
  return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function groupFeedByDay<T extends { created_at: string }>(items: T[]): { label: string; items: T[] }[] {
  const groups: { label: string; items: T[] }[] = [];
  for (const item of items) {
    const label = dayLabel(item.created_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}
