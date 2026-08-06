"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconMessageCircle,
  IconMail,
  IconSend,
  IconPhoneOff,
  IconPhoneIncoming,
  IconPhoneOutgoing,
  IconTrash,
} from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import {
  type Client,
  type ClientContact,
  CLIENT_STATUS_HINT,
  CLIENT_STATUS_STEP,
  ClientEventIcon,
  CLIENT_EVENT_TARGET,
  clientDaysSince,
  CLIENT_RHYTHMS,
  clientRhythmOverdue,
  clientSilenceDays,
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
import { ProcessMap, PillPicker, UmowSpotkanie } from "../components";
import { SekcjaProfilu, WierszPola } from "../ProfileSection";
import { SOURCE_CATEGORIES } from "@/lib/leads";
import { formatPlDate } from "@/lib/projects";
import { CONTRACT_TYP_LABEL, contractReference, type ContractTyp } from "@/lib/contracts";
import { offerReference } from "@/lib/offers";
import { SciezkaDokumentow, type WezelSciezki } from "../SciezkaDokumentow";
import { DocLinkPicker } from "../DocLinkPicker";
import { formatMoney } from "@/lib/invoices";
import { useUI } from "../ui";
import { DateField } from "../DatePicker";
import { todayLocalISO, addDaysLocalISO, daysAgoLabel, parsePgTimestamp } from "@/lib/dates";
import { MailStatusTag, type MailStatus } from "../mail/shared";
import { ViewTabs, ViewSwitch } from "../ViewTabs";
import { FieldChangesTab } from "../FieldChangesTab";
import { ClientContacts } from "./ClientContacts";
import type { FieldChange } from "@/lib/audit";
import { zglosWygasnieciesesji } from "../strazSesji";

type LinkedOffer = { id: string; tytul: string; status: string; wazna_do: string | null; created_at: string };
type LinkedInvoice = {
  id: string;
  numer: string | null;
  status: string;
  typ_dokumentu: string;
  /** Z czego wynika — ustawiane pickerem wprost w rejestrze (2026-07-27). */
  offer_id: string | null;
  contract_id: string | null;
  created_at: string;
};
/** Pola opinii (Moduł 15) jadą razem z projektem — patrz komentarz przy
 * zapytaniu w `app/api/clients/[id]/route.ts`. */
type LinkedProject = {
  id: string;
  tytul: string;
  status: string;
  termin: string | null;
  created_at: string;
  review_rating_jakosc: number | null;
  review_rating_terminowosc: number | null;
  review_rating_komunikacja: number | null;
  review_comment: string | null;
  review_submitted_at: string | null;
  review_consent_case_study: boolean;
};
/** Zaplanowany kontakt kontrolny (Moduł 17) — `done_at` puste = do zrobienia. */
type ClientFollowupItem = {
  id: string;
  project_id: string | null;
  due_date: string;
  powod: string;
  done_at: string | null;
  created_at: string;
};
/** Moduł 31 — umowy/NDA klienta. `project_id` jest tu po to, żeby dało się z
 * karty odróżnić umowę odblokowującą start projektu od wolnostojącej. */
type LinkedContract = {
  id: string;
  /** Także „dpa" i „aneks" — lista typów rosła (Moduły 58 i DPA), a ten alias
   * został przy dwóch. */
  typ: ContractTyp;
  status: string;
  project_id: string | null;
  offer_id: string | null;
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
/** Jeden krok ścieżki dokumentów — kształt 1:1 z `KrokSciezki` po stronie
 * trasy (app/api/clients/[id]). */
/** Kształt węzła mieszka w komponencie drzewka — tu tylko alias. */
type KrokSciezki = WezelSciezki;

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
  const { confirm, toast, zadanie } = useUI();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [changes, setChanges] = useState<FieldChange[]>([]);
  // Moduł 23 — profil rozbity na zakładki na prośbę właściciela 2026-07-16
  // („żeby nie wszystko kumulowało się na jednej stronie"). Stan trzymany tu, w
  // *DetailPanel, a nie w wrapperach — dzięki temu działa i w modalu z listy, i
  // na podstronie [id], bez dublowania.
  //
  // Moduł 54, krok 6: zakładka „Wizytówka" ZNIKŁA — jej treść (atrybuty) stoi
  // teraz stale w lewej kolumnie, więc zakładki zostały tylko dla tego, co
  // wypełnia prawą. Domyślną jest historia: to ona jest powodem, dla którego
  // otwiera się kartę klienta.
  const [tab, setTab] = useState<"history" | "linked" | "changes">("history");
  const [offers, setOffers] = useState<LinkedOffer[]>([]);
  const [invoices, setInvoices] = useState<LinkedInvoice[]>([]);
  const [projects, setProjects] = useState<LinkedProject[]>([]);
  const [contracts, setContracts] = useState<LinkedContract[]>([]);
  const [mail, setMail] = useState<ClientMail[]>([]);
  const [followups, setFollowups] = useState<ClientFollowupItem[]>([]);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [creatingDoc, setCreatingDoc] = useState<"offers" | "invoices" | null>(null);
  const [sciezki, setSciezki] = useState<KrokSciezki[][]>([]);

  /** Zapis powiązania „ten dokument wynika z tamtego" wprost z karty klienta.
   * Po zapisie przeładowujemy profil, żeby ścieżka narysowała się od razu —
   * inaczej trzeba by zgadywać, czy kliknięcie w ogóle coś zrobiło. */
  const polaczDokument = useCallback(
    async (modul: "invoices" | "contracts", docId: string, patch: Record<string, string | null>) => {
      const res = await fetch(`/api/${modul}/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        toast(d.error ?? "Nie udało się połączyć dokumentów.", "error");
        return;
      }
      toast("Połączono.");
      await load();
    },
    [toast]
  );
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [focusNote, setFocusNote] = useState(false);
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
      // Sesja wygasła: NIE przeładowujemy (etap 3). Przeładowanie kasowało
      // niezapisany formularz bez ostrzeżenia — pasek ze `strazSesji.ts`
      // mówi, co się stało, i pozwala zalogować się bez opuszczania ekranu.
      zglosWygasnieciesesji();
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
      followups: ClientFollowupItem[];
      contacts: ClientContact[];
      sciezki?: KrokSciezki[][];
    };
    setClient(data.client);
    setFeed(data.feed);
    setOffers(data.offers);
    setInvoices(data.invoices);
    setProjects(data.projects);
    setContracts(data.contracts ?? []);
    setMail(data.mail ?? []);
    setFollowups(data.followups ?? []);
    setContacts(data.contacts ?? []);
    setSciezki(data.sciezki ?? []);
    setNoteFollowup(data.client.next_followup ?? "");
    setNoteAction(data.client.next_action ?? "");
  }, [id]);

  useEffect(() => {
    setClient(null);
    setNotFound(false);
    setTab("history");
    load();
  }, [load]);

  // Fokus na polu wpisu po „Zapisz kontakt". Przez efekt, nie przez
  // `requestAnimationFrame` w kliknięciu: tamto wyprzedzało zamontowanie
  // zakładki (`ViewSwitch` animuje wejście), więc `ref` był jeszcze pusty
  // i fokus lądował na `body`. Jedna próba ponowna pokrywa czas animacji.
  useEffect(() => {
    if (!focusNote || tab !== "history") return;
    const zrob = () => {
      if (!noteRef.current) return false;
      noteRef.current.focus();
      setFocusNote(false);
      return true;
    };
    if (zrob()) return;
    // `ViewSwitch` animuje wejście zakładki, więc pole montuje się z opóźnieniem
    // i JEDNA próba ponowna bywa za wczesna (zmierzone: fokus zostawał na
    // `body`). Krótkie odpytywanie do skutku, maksymalnie przez sekundę.
    let probes = 0;
    const interval = setInterval(() => {
      if (zrob() || ++probes > 10) clearInterval(interval);
    }, 100);
    return () => clearInterval(interval);
  }, [focusNote, tab]);

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
    // Poziom „mocne" (Faza 4) — okno i jego treść przychodzą z trasy.
    const w = await zadanie(`/api/clients/${id}`, { method: "DELETE", doPrzepisania: client.nazwa });
    if (w.anulowane) return;
    if (!w.ok) {
      toast(w.dane.error || "Nie udało się usunąć klienta.", "error");
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
      // Bliźniak `LeadDetailPanel.submitNote` — powody i pomiary tam.
      // Formularz wraca do stanu WYJŚCIOWEGO (kierunek „wychodzący",
      // „oznacz kontakt" zaznaczone), a nie do pustego; pól „Przypomnij mi"
      // i „Następny krok" nie ruszamy, bo pokazują stan klienta i odświeży
      // je `load()`.
      setNoteText("");
      setNoteChannel("");
      setNoteDirection("wychodzacy");
      setNoteOutcome("");
      setNoteDurationMin("");
      setNoteDurationSec("");
      setMarkContacted(true);
      // Bez tego kolumny „Ostatni kontakt" i „Dni" na liście klientów
      // pokazywały „—" aż do przeładowania strony.
      if (markContacted) onFieldChange?.(id, "ostatni_kontakt", todayLocalISO());
      toast("Zapisano wpis.");
      load();
    } else {
      toast("Nie udało się zapisać wpisu.", "error");
    }
  };

  /** Ten sam ruch, co „Obsłużone" na Pulpicie (`markFollowupHandled`) — jedna
   * trasa, dwa wejścia. Z karty klienta ma sens wtedy, gdy kontakt odbył się
   * inną drogą (spotkanie, telefon) i mail z Pulpitu jest już bezprzedmiotowy. */
  const markFollowupDone = async (followupId: string) => {
    const res = await fetch(`/api/client-followups/${followupId}`, { method: "PATCH" });
    if (!res.ok) {
      toast("Nie udało się oznaczyć kontaktu.", "error");
      return;
    }
    setFollowups((prev) => prev.map((f) => (f.id === followupId ? { ...f, done_at: new Date().toISOString() } : f)));
    toast("Kontakt kontrolny oznaczony jako obsłużony.");
  };

  /** Nowy szkic oferty/faktury dla TEGO klienta i od razu przejście do niego —
   * patrz komentarz przy przyciskach. `klient_nazwa` jedzie razem z `client_id`,
   * bo to dwie różne rzeczy: pierwsze to migawka nabywcy na dokumencie, drugie
   * wskaźnik, na którym wisi karta klienta i kontakt retencyjny. */
  const createDocument = async (kind: "offers" | "invoices") => {
    if (!client) return;
    setCreatingDoc(kind);
    const res = await fetch(`/api/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        kind === "offers"
          ? { client_id: client.id, klient_nazwa: client.nazwa, tytul: `Oferta — ${client.nazwa}` }
          : { client_id: client.id, klient_nazwa: client.nazwa }
      ),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    if (!res.ok || !data.id) {
      setCreatingDoc(null);
      toast(kind === "offers" ? "Nie udało się utworzyć oferty." : "Nie udało się utworzyć faktury.", "error");
      return;
    }
    router.push(`/${lang}/admin/${kind}/${data.id}`);
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
  const reviewed = projects.filter((p) => p.review_submitted_at);

  const FEED_FILTERS: { value: typeof feedFilter; label: string }[] = [
    { value: "all", label: "Wszystko" },
    { value: "calls", label: "Połączenia" },
    { value: "system", label: "Systemowe" },
    { value: "notes", label: "Notatki" },
  ];
  // Maile z kartoteki, których nie ma na osi — np. dopięte do klienta po
  // fakcie przez dopasowanie adresu, bez wpisu na osi. Bez nich scalenie
  // gubiłoby korespondencję, którą osobna sekcja pokazywała.
  const znaneMaile = new Set(feed.map((f) => f.mail_message_id).filter(Boolean));
  const osCzasu = [
    ...feed,
    ...mail
      .filter((m) => !znaneMaile.has(m.id))
      .map((m) => ({
        id: `mail:${m.id}`,
        created_at: m.received_at,
        kind: "note" as const,
        text: m.subject || "(bez tematu)",
        amount: null,
        kanal: "email",
        kierunek: m.kierunek === "out" ? "wychodzacy" : "przychodzacy",
        wynik: null,
        czas_trwania_sek: null,
        related_id: null,
        mail_message_id: m.id,
        source: "system" as const,
      })),
    // `parsePgTimestamp`, NIE `new Date()` — baza oddaje „2026-07-26 19:12:44.487+01"
    // (spacja zamiast „T", strefa bez dwukropka). Chrome to wybacza, Safari nie:
    // dostaje NaN i sortowanie osi czasu wychodzi w losowej kolejności. Dług
    // spisany przy Module 57, spłacony w 59.
  ].sort((a, b) => (parsePgTimestamp(b.created_at)?.getTime() ?? 0) - (parsePgTimestamp(a.created_at)?.getTime() ?? 0));

  const filteredFeed = osCzasu.filter((f) => {
    if (feedFilter === "all") return true;
    if (feedFilter === "calls") return f.kanal === "telefon";
    if (feedFilter === "system") return f.source === "system";
    return f.kind === "note" && f.kanal !== "telefon";
  });

  return (
    <div className="card-paper max-h-[85vh] overflow-y-auto rounded-2xl border hairline p-6 sm:p-8 lg:flex lg:h-[85vh] lg:max-h-none lg:flex-col lg:overflow-hidden">
      <PanelHeader onClose={onClose} />

      {/* Nagłówek rekordu ZWARTY (runda czytelności 2026-07-26): tożsamość,
          status i akcje w jednym wierszu, jak pasek rekordu w Attio. Wcześniej
          te same rzeczy stały w czterech piętrach (nazwa → status → podpowiedź
          → cztery duże przyciski) i zjadały u góry profilu tyle wysokości, co
          dwie sekcje danych — a to jest nagłówek, nie treść.

          Na telefonie (`flex-wrap`) rozkłada się z powrotem na piętra, bo tam
          szerokości nie ma; `min-w-[12rem]` na nazwie pilnuje, żeby zawinęła
          się CAŁA, zamiast ucinać się w połowie firmy. */}
      <div className={onClose ? "mt-4" : ""}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <input
            value={client.nazwa}
            onChange={(e) => setClient((prev) => (prev ? { ...prev, nazwa: e.target.value } : prev))}
            onBlur={(e) => updateClient("nazwa", e.target.value)}
            className="min-w-[12rem] flex-1 bg-transparent text-2xl font-semibold tracking-tight text-[var(--fg)] outline-none"
          />
          <StatusTag status={client.status} onChange={(v) => updateClient("status", v)} />
          {/* Akcja GŁÓWNA obok szybkich kanałów. Attio prowadzi pasek rekordu
              od „New note", a apka od „Zaloguj rozmowę" — dlatego ta jedna
              zostaje z napisem, a kanały schodzą do samych ikon. */}
          <button
            onClick={() => {
              setTab("history");
              setFocusNote(true);
            }}
            className="flex h-[34px] items-center gap-1.5 rounded-lg border border-brand-purple/40 bg-brand-purple/10 px-3 text-[13px] font-medium text-[var(--fg)] hover:bg-brand-purple/15"
          >
            <IconMessageCircle size={15} /> Zapisz kontakt
          </button>
          <ContactQuickActions telefon={client.telefon} email={client.email} linkedinUrl={client.linkedin_url} zwarte />
          <button
            onClick={deleteClient}
            title="Usuń klienta z rejestru"
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border hairline text-muted hover:bg-red-500/10 hover:text-red-400"
            aria-label="Usuń klienta"
          >
            <IconTrash size={15} />
          </button>
        </div>
        <p className="mt-1.5 text-[12.5px] text-muted opacity-80">{CLIENT_STATUS_HINT[client.status]}</p>
      </div>

      {/* Układ boczny (Moduł 54, krok 6, wzorzec ze strony rekordu w Attio):
          wąska kolumna atrybutów przypięta po lewej, cała reszta szerokości na
          oś czasu i powiązania. Wcześniej jedno i drugie było zakładkami, więc
          czytanie historii z danymi klienta pod ręką było niemożliwe — trzeba
          było przełączać widok tam i z powrotem.

          Przypięcie robi `sticky` WZGLĘDEM KARTY (to ona jest kontenerem
          przewijania, `max-h-[85vh] overflow-y-auto`), a nie względem okna.
          Kolumna dostaje własny `overflow-y-auto` z limitem wysokości: bez
          niego atrybuty dłuższe niż ekran przypięłyby się z uciętym dołem, do
          którego nie da się już doscrollować.

          Poniżej `lg` (telefon, iPad w pionie) kolumn nie ma — i wtedy oś czasu
          idzie PIERWSZA (`order`), bo to ona jest treścią; atrybuty lądują pod
          nią, tak samo jak przed tą zmianą lądowały pod nagłówkiem. Pełna
          kartoteka na telefonie to i tak domena apki. */}
      <div className="mt-5 grid gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="order-2 min-w-0 lg:order-1 lg:h-full lg:overflow-y-auto lg:pr-2">
          {/* Atrybuty w NAZWANYCH sekcjach, po jednej płycie na grupę — wprost
              z apki (`Section("Kontakt")`, `Section("Dane")`
              w `KlientDetailView.swift`). Do rundy czytelności 2026-07-26 stała
              tu jedna siatka trzynastu pól bez żadnego podziału i to ona
              odpowiadała za „wszystko się zlewa": pola były w dobrej
              kolejności, tylko nic nie mówiło, gdzie kończy się jedna myśl,
              a zaczyna druga.

              Kolejność sekcji to kolejność pytań przy telefonie: najpierw
              „jak się z nimi skontaktować", potem „kiedy do nich wrócić",
              a dane rejestrowe i adres na końcu — bo do nich sięga się przy
              fakturze, nie w rozmowie. */}
          <div className="space-y-4">
            <SekcjaProfilu tytul="Kontakt" zwijalna>
              <WierszPola etykieta="Telefon">
                <EditableText value={client.telefon} onSave={(v) => updateClient("telefon", v)} />
              </WierszPola>
              <WierszPola etykieta="Email">
                <EditableText value={client.email} onSave={(v) => updateClient("email", v)} />
              </WierszPola>
              <WierszPola etykieta="WWW">
                <EditableText value={client.www} onSave={(v) => updateClient("www", v)} />
              </WierszPola>
              <WierszPola etykieta="LinkedIn">
                <EditableText value={client.linkedin_url} onSave={(v) => updateClient("linkedin_url", v)} />
              </WierszPola>
            </SekcjaProfilu>

            <SekcjaProfilu tytul="Rytm kontaktu" zwijalna>
              {/* Sufiks zamiast drugiej linijki: sama data wymaga liczenia
                  w głowie, a pytanie brzmi „jak dawno", nie „którego". */}
              <WierszPola
                etykieta="Ostatni kontakt"
                sufiks={
                  daysAgoLabel(clientDaysSince(client.ostatni_kontakt)) ? (
                    <span className="shrink-0 text-[11px] text-muted opacity-70">
                      {daysAgoLabel(clientDaysSince(client.ostatni_kontakt))}
                    </span>
                  ) : undefined
                }
              >
                <DateField value={client.ostatni_kontakt ?? ""} onChange={(v) => updateClient("ostatni_kontakt", v)} placeholder="—" />
              </WierszPola>
              {/* Pigułki „Jutro / Za 3 dni / Za tydzień" ŚWIADOMIE zdjęte z tego
                  wiersza (runda czytelności 2026-07-26): zawijały się na dwie
                  linie i robiły z niego 110 px przy 41 px sąsiadów — jeden
                  wiersz odpowiadał za połowę wrażenia krzywizny. Nie zniknęły
                  z panelu: stoją w formularzu „Nowy wpis" obok, czyli tam, gdzie
                  decyzja „wrócić za tydzień" i tak zapada — przy zapisywaniu
                  rozmowy, nie przy czytaniu wizytówki. */}
              <WierszPola etykieta="Przypomnij mi">
                <DateField value={client.next_followup ?? ""} onChange={(v) => updateClient("next_followup", v)} placeholder="—" />
              </WierszPola>
              {client.next_followup && (
                <WierszPola etykieta="Następny krok" title="Po co jest to przypomnienie">
                  <EditableText value={client.next_action} onSave={(v) => updateClient("next_action", v)} />
                </WierszPola>
              )}
              {/* Rytm kontaktu (2026-07-26) — wzorzec z Claya: rytm jest
                  decyzją PER RELACJA, nie stałą dla wszystkich. Domyślnie
                  „bez pilnowania", bo sztywny próg ciszy dla każdego klienta
                  został tu wcześniej świadomie odrzucony. Gdy rytm minie,
                  klient sam trafia do „wymaga działania dziś" i w poranny mail
                  — także wtedy, gdy nie ustawiłeś mu żadnej daty. */}
              <WierszPola
                etykieta="Odzywaj się"
                title="Co ile odzywać się do tego klienta"
                sufiks={
                  clientRhythmOverdue(client) ? (
                    // Pełne zdanie („Rytm minął — cisza od 47 dni") zawijało
                    // wiersz; w podpowiedzi mieści się w całości, a w wierszu
                    // zostaje to, co niesie alarm.
                    <span
                      className="shrink-0 rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-medium text-orange-400"
                      title={`Rytm minął — cisza od ${clientSilenceDays(client)} dni.`}
                    >
                      minął
                    </span>
                  ) : undefined
                }
              >
                <PillPicker
                  value={CLIENT_RHYTHMS.find((r) => r.miesiace === client.rytm_kontaktu_mies)?.label ?? "Bez pilnowania"}
                  options={CLIENT_RHYTHMS.map((r) => r.label)}
                  onChange={(label) => {
                    const wybrany = CLIENT_RHYTHMS.find((r) => r.label === label);
                    updateClient("rytm_kontaktu_mies", wybrany?.miesiace ? String(wybrany.miesiace) : "");
                  }}
                  placeholder="Bez pilnowania"
                  title="Co ile odzywać się do tego klienta"
                />
              </WierszPola>
            </SekcjaProfilu>

            {/* Pojedyncze pole „Osoba kontaktowa" zastąpione LISTĄ osób
                (Moduł 54, krok 4). Kolumna `osoba_kontaktowa` została w bazie
                jako migawka osoby głównej i serwer przepisuje ją sam, więc
                tutaj nie ma już czego edytować.

                `load` zamiast samego przeładowania listy, bo zmiana osoby
                głównej przepisuje migawkę na kliencie. */}
            <ClientContacts clientId={id} contacts={contacts} onChanged={load} waskaKolumna />

            <SekcjaProfilu tytul="Firma" zwijalna>
              <WierszPola etykieta="NIP">
                <EditableText value={client.nip} onSave={(v) => updateClient("nip", v)} />
              </WierszPola>
              <WierszPola etykieta="Branża">
                <EditableText value={client.branza} onSave={(v) => updateClient("branza", v)} />
              </WierszPola>
              {/* Skąd ten klient przyszedł — pole zapisywane przez trzy ścieżki
                  awansu z leada i do 2026-07-26 nieczytane przez NIC.
                  Edytowalne, bo klienci sprzed tej daty mają kategorię PUSTĄ,
                  a po niej liczy się pętla poleceń — pole nie do poprawienia
                  zostaje błędne na zawsze. Pełna lista kategorii (jak w profilu
                  leada): tu się je POPRAWIA, nie tworzy. */}
              <WierszPola etykieta="Skąd przyszedł">
                <PillPicker
                  value={client.zrodlo_kategoria}
                  options={[...SOURCE_CATEGORIES]}
                  onChange={(v) => updateClient("zrodlo_kategoria", v)}
                  placeholder="Wybierz"
                  title="Kategoria źródła"
                />
                <EditableText
                  value={client.zrodlo}
                  onSave={(v) => updateClient("zrodlo", v)}
                  placeholder="szczegóły"
                />
              </WierszPola>
            </SekcjaProfilu>

            <SekcjaProfilu tytul="Adres" zwijalna>
              <WierszPola etykieta="Ulica">
                <EditableText value={client.ulica} onSave={(v) => updateClient("ulica", v)} />
              </WierszPola>
              {/* Kod dostaje stałą, wąską szerokość zamiast połowy wiersza:
                  przy dwóch polach `flex-1` puste „—" zajmowało tyle samo, co
                  „Warszawa", i miasto zaczynało się w połowie wiersza —
                  w słupku wyrównanych wartości widać to od razu. */}
              <WierszPola etykieta="Kod / Miasto">
                <div className="w-[64px] shrink-0">
                  <EditableText value={client.kod} onSave={(v) => updateClient("kod", v)} placeholder="kod" />
                </div>
                <EditableText value={client.miasto} onSave={(v) => updateClient("miasto", v)} placeholder="miasto" />
              </WierszPola>
              <WierszPola etykieta="Kraj">
                <EditableText value={client.kraj} onSave={(v) => updateClient("kraj", v)} />
              </WierszPola>
            </SekcjaProfilu>

            {/* Notatka przypięta zostaje przy atrybutach, nie przy osi czasu:
                to stała prawda o kliencie („płaci przelewem, nie kartą"), a nie
                wpis z datą. Wpisy z datą mają swoje miejsce obok. */}
            <SekcjaProfilu tytul="Notatka przypięta" wiersze={false} zwijalna>
              <EditableTextarea value={client.notatki} onSave={(v) => updateClient("notatki", v)} />
            </SekcjaProfilu>
          </div>
        </aside>

        <div className="order-1 flex min-w-0 flex-col lg:order-2 lg:h-full lg:overflow-y-auto lg:pr-1">
          {/* Mapa procesu NAD zakładkami, nie w żadnej z nich — to „gdzie
              jesteśmy z tym klientem", czyli kontekst do wszystkiego, co niżej.
              Do kroku 6 siedziała na dole wizytówki, więc widać ją było tylko
              po przewinięciu wszystkich pól. */}
          <div className="mb-4">
            <label className="mb-1.5 block px-1 text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Proces sprzedaży
            </label>
            <ProcessMap currentStep={CLIENT_STATUS_STEP[client.status] ?? 3} lang={lang} />
          </div>

          <div className="flex h-9 items-center gap-4 border-b hairline">
            <ViewTabs
              value={tab}
              onChange={setTab}
              layoutId="client-detail-tab-underline"
              // Nazwy i KOLEJNOŚĆ 1:1 z apką (paczka E, kat. 5): tam profil
              // klienta ma „Dokumenty · Historia · Logi" w tej kolejności
              // (`KlientDetailView.Zakladka`; „Wizytówka" i „Akcje" odpadają
              // w panelu, bo atrybuty stoją w przypiętej kolumnie po lewej,
              // a akcje w nagłówku karty — układ boczny z Modułu 54).
              // „Powiązane" mówiło o mechanizmie, „Dokumenty" o treści.
              tabs={[
                { id: "linked", label: "Dokumenty" },
                { id: "history", label: "Historia" },
                { id: "changes", label: "Logi" },
              ]}
            />
          </div>

          <ViewSwitch viewKey={tab}>
            {tab === "linked" && (
              <div className="mt-6 space-y-4">
                {followups.length > 0 && (
                  <SekcjaProfilu tytul="Kontakty kontrolne" wiersze={false}>
                    <p className="mb-3 text-[12px] text-muted opacity-70">
                      Planowane automatycznie po wdrożeniu projektu (+14 i +90 dni). Szkic wiadomości przygotujesz na
                      Pulpicie w dniu terminu.
                    </p>
                    <ul className="space-y-1.5 text-sm">
                      {followups.map((f) => {
                        const zalegly = !f.done_at && f.due_date.slice(0, 10) <= todayLocalISO();
                        return (
                          <li
                            key={f.id}
                            className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 ${
                              zalegly ? "border-orange-500/30 bg-orange-500/[0.05]" : "hairline"
                            }`}
                          >
                            <span className={`shrink-0 text-[12px] ${zalegly ? "font-semibold text-orange-400" : "text-muted"}`}>
                              {formatPlDate(f.due_date)}
                            </span>
                            <span className={`min-w-0 flex-1 truncate ${f.done_at ? "text-muted line-through" : ""}`}>
                              {f.powod}
                            </span>
                            {f.done_at ? (
                              <span className="shrink-0 text-[11px] text-muted">obsłużony</span>
                            ) : (
                              <button
                                onClick={() => markFollowupDone(f.id)}
                                className="shrink-0 rounded-md px-2 py-0.5 text-[12px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]"
                              >
                                Obsłużone
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </SekcjaProfilu>
                )}

                {reviewed.length > 0 && (
                  <SekcjaProfilu tytul="Opinie" wiersze={false}>
                    <ul className="space-y-2 text-sm">
                      {reviewed.map((p) => {
                        const ocena = projectRating(p);
                        return (
                        <li key={p.id} className="rounded-xl border hairline p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Opinia bez gwiazdek jest możliwa (klient wypełnił sam
                                komentarz) — wtedy nie udajemy oceny. */}
                            {ocena != null && <span className="font-medium text-brand-gold">★ {ocena.toFixed(1)}</span>}
                            <Link href={`/${lang}/admin/projects/${p.id}`} className="min-w-0 flex-1 truncate hover:underline">
                              {p.tytul}
                            </Link>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
                                p.review_consent_case_study
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : "bg-[var(--hairline)] text-muted"
                              }`}
                              title="Zgoda na wykorzystanie opinii jako referencji/case study"
                            >
                              {p.review_consent_case_study ? "zgoda na referencję" : "bez zgody na referencję"}
                            </span>
                          </div>
                          {p.review_comment && <p className="mt-1.5 whitespace-pre-wrap text-[13px] text-muted">{p.review_comment}</p>}
                        </li>
                        );
                      })}
                    </ul>
                  </SekcjaProfilu>
                )}

                {/* Nowy dokument wprost z karty klienta (2026-07-26, druga runda
                    audytu). Do tej pory jedyna droga wiodła przez „+ Nowa oferta"
                    na ekranie Ofert i wybranie klienta z pickera — z profilu
                    klienta, czyli z miejsca, w którym akurat się stoi, nie dało
                    się zrobić nic.

                    Świadomie BEZ dedupe „jedna oferta na klienta" (inaczej niż
                    przy NDA z Modułu 51): druga oferta dla tego samego klienta
                    jest normalną sytuacją, a nie pomyłką. Rolę zabezpieczenia
                    gra tu natychmiastowe przejście do dokumentu — nowy szkic
                    nigdy nie zostaje niewidoczny, a przycisk jest w tym czasie
                    zablokowany, więc podwójne kliknięcie nie zrobi dwóch. */}
                <SekcjaProfilu
                  // Sekcja nazwana tym, co w niej leży — po zmianie nazwy
                  // zakładki na „Dokumenty" (paczka E) „Powiązane" byłoby
                  // drugą nazwą tej samej rzeczy o linijkę niżej.
                  tytul="Dokumenty i projekty"
                  wiersze={false}
                  akcje={
                    <>
                      <button
                        onClick={() => createDocument("offers")}
                        disabled={creatingDoc !== null}
                        className="rounded-full border hairline px-2.5 py-0.5 text-[11px] text-muted hover:text-[var(--fg)] disabled:opacity-50"
                      >
                        {creatingDoc === "offers" ? "Tworzę…" : "+ Nowa oferta"}
                      </button>
                      <button
                        onClick={() => createDocument("invoices")}
                        disabled={creatingDoc !== null}
                        className="rounded-full border hairline px-2.5 py-0.5 text-[11px] text-muted hover:text-[var(--fg)] disabled:opacity-50"
                      >
                        {creatingDoc === "invoices" ? "Tworzę…" : "+ Nowa faktura"}
                      </button>
                    </>
                  }
                >
                  {/* ŚCIEŻKA DOKUMENTÓW (2026-07-27) — prośba właściciela:
                      „widzieć, że z oferty 21 powstała umowa 32, a z niej
                      faktura 765". Listy niżej mówią, CO jest przypięte;
                      ścieżka mówi, co z czego WYNIKA — przy dwóch równoległych
                      wątkach sprzedaży to dwie różne historie, których sama
                      chronologia nie rozdziela. Wątki liczy serwer
                      (`zbudujSciezki`), z jawnych powiązań, nie ze zgadywania
                      po projekcie. */}
                  {sciezki.length > 0 && (
                    <div className="mb-5 space-y-2">
                      <div>
                        <h3 className="text-[11px] uppercase tracking-wide text-muted">Co z czego wynikło</h3>
                        <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted opacity-70">
                          Co z czego powstało — od lewej do prawej. Kliknij kafelek, żeby otworzyć dokument;
                          prawy przycisk daje podgląd, wydruk i link dla klienta. Pełny rejestr jest niżej.
                        </p>
                      </div>
                      {sciezki.map((sciezka, i) => (
                        <SciezkaDokumentow key={i} wezly={sciezka} lang={lang} />
                      ))}
                    </div>
                  )}
                  {sciezki.length === 0 && linkedCount > 1 && (
                    <p className="mb-4 rounded-lg card-inset px-3 py-2 text-[11.5px] leading-relaxed text-muted">
                      Żaden z tych dokumentów nie wynika jeszcze z innego. Ustaw to przy dokumencie niżej —
                      przy fakturze („wynika z”) albo przy umowie („z oferty”). Ścieżka narysuje się od razu.
                    </p>
                  )}
                  {linkedCount === 0 && (
                    <p className="text-sm text-muted opacity-60">
                      Nic jeszcze nie jest przypięte do tego klienta — zacznij od oferty.
                    </p>
                  )}
                  {linkedCount > 0 && (
                    <div className="space-y-4">
                      {sciezki.length > 0 && (
                        <h3 className="text-[11px] uppercase tracking-wide text-muted">Wszystkie dokumenty</h3>
                      )}
                      {offers.length > 0 && (
                        <LinkedGroup title="Oferty">
                          {offers.map((o) => (
                            <li key={o.id}>
                              <Link href={`/${lang}/admin/offers/${o.id}`} className="hover:underline">
                                {offerReference(o)}
                                {o.tytul ? ` — ${o.tytul}` : ""}
                              </Link>
                              <span className="text-muted"> — {o.status}{o.wazna_do ? `, ważna do ${formatPlDate(o.wazna_do)}` : ""}</span>
                            </li>
                          ))}
                        </LinkedGroup>
                      )}
                      {invoices.length > 0 && (
                        <LinkedGroup title="Faktury">
                          {invoices.map((i) => (
                            <li key={i.id} className="flex flex-wrap items-baseline gap-x-2">
                              <Link href={`/${lang}/admin/invoices/${i.id}`} className="hover:underline">
                                {i.numer ?? "(szkic)"}
                              </Link>
                              <span className="text-muted">— {i.status}</span>
                              {/* Łączenie dokumentów TU, przy dokumencie, a nie
                                  w innym module (zgłoszenie właściciela
                                  2026-07-27: „nie wiem, gdzie miałbym to
                                  ręcznie połączyć"). Podpowiedź odsyłająca do
                                  pola w edytorze faktury była instrukcją
                                  zamiast akcji. */}
                              <span className="ml-auto flex items-center gap-1 text-[11.5px] text-muted">
                                <span className="opacity-70">wynika z</span>
                                <DocLinkPicker
                                  rodzaj="contract"
                                  clientId={id}
                                  value={i.contract_id ?? null}
                                  onPick={(v) => polaczDokument("invoices", i.id, { contract_id: v })}
                                />
                                <span className="opacity-70">/</span>
                                <DocLinkPicker
                                  rodzaj="offer"
                                  clientId={id}
                                  value={i.offer_id ?? null}
                                  onPick={(v) => polaczDokument("invoices", i.id, { offer_id: v })}
                                />
                              </span>
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
                            <li key={c.id} className="flex flex-wrap items-baseline gap-x-2">
                              {/* Numer dokumentu, nie samo „Powierzenie danych"
                                  — ścieżka wyżej mówi „DPA-2026-E72339", a dwie
                                  nazwy tego samego dokumentu na jednym ekranie
                                  każą się domyślać, czy to ten sam (zgłoszenie
                                  właściciela 2026-07-27). */}
                              <Link href={`/${lang}/admin/contracts/${c.id}`} className="hover:underline">
                                {CONTRACT_TYP_LABEL[c.typ]} {contractReference(c)}
                              </Link>
                              <span className="text-muted">
                                {" "}
                                — {c.status}
                                {c.accepted_at ? `, podpisana ${formatPlDate(c.accepted_at)}` : ""}
                                {c.typ === "umowa" && !c.project_id ? ", bez projektu" : ""}
                              </span>
                              {c.typ === "umowa" && (
                                <span className="ml-auto flex items-center gap-1 text-[11.5px] text-muted">
                                  <span className="opacity-70">z oferty</span>
                                  <DocLinkPicker
                                    rodzaj="offer"
                                    clientId={id}
                                    value={c.offer_id ?? null}
                                    onPick={(v) => polaczDokument("contracts", c.id, { offer_id: v })}
                                    disabled={c.status === "Podpisana"}
                                  />
                                </span>
                              )}
                            </li>
                          ))}
                        </LinkedGroup>
                      )}
                    </div>
                  )}
                </SekcjaProfilu>
              </div>
            )}

            {tab === "history" && (
              <div>
                {/* Od `2xl` (≥1536 px) formularz odchodzi na WŁASNĄ kolumnę po
                    prawej, a oś czasu zajmuje resztę (zgłoszenie właściciela
                    2026-07-26: „w środku przepełnione, z prawej mnóstwo wolnego
                    miejsca"). Wcześniej oś miała twardy limit `max-w-5xl`, więc
                    na monitorze 2288 px zostawało pół ekranu pustki przy prawej
                    krawędzi — po podziale limit jest zbędny, bo przestrzeń zjada
                    formularz, a nie pustka.
                    Poniżej `2xl` podziału NIE ma: przy 700 px kolumny wyszłyby
                    dwa za wąskie słupki. Formularz wraca wtedy NAD oś, bo to
                    główna akcja tej zakładki. */}
                <div className="mt-6 space-y-4 2xl:grid 2xl:grid-cols-[minmax(0,1fr)_380px] 2xl:items-start 2xl:gap-6 2xl:space-y-0">
                  {/* Formularz na WŁASNEJ płycie — to jedyne miejsce w profilu,
                      w którym się PISZE, a leżąc na wspólnym tle wyglądał jak
                      pierwszy wpis osi. Przypięty, więc przy przewijaniu długiej
                      historii nie trzeba wracać na górę, żeby coś dopisać. */}
                  <SekcjaProfilu
                    tytul="Nowy wpis"
                    wiersze={false}
                    className="2xl:sticky 2xl:top-0 2xl:order-2"
                  >
                  <form onSubmit={submitNote} className="space-y-2">
                      {/* Wysokie pole na szerokim ekranie (zgłoszenie właściciela
                          2026-07-26: „wygląda, jakby się coś nie wczytało").
                          W trzeciej kolumnie formularz na trzy wiersze wyglądał
                          jak niedokończony kawałek strony obok wysokiej osi
                          czasu — a to jest miejsce, w którym się PISZE, więc
                          duże pole jest tu użyteczne, nie ozdobne. Poniżej
                          `2xl` formularz stoi nad osią i trzy wiersze są tam
                          właściwe: każdy dodatkowy odpycha historię w dół. */}
                    <textarea
                      ref={noteRef}
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
                      className="w-full rounded-xl border hairline bg-transparent px-3 py-2 text-sm text-[var(--fg)] placeholder:text-muted 2xl:min-h-[340px]"
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
                        // Menu W GÓRĘ — patrz bliźniak w `LeadDetailPanel.tsx`.
                        kierunek="gora"
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
                      {/* Bliźniak profilu leada — powody w `UmowSpotkanie`. */}
                      {client && (
                        <UmowSpotkanie rodzaj="klient" rekordId={id} nazwa={client.nazwa} />
                      )}
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
                  </SekcjaProfilu>

                  {/* JEDNA oś zamiast dwóch list (2026-07-26). Do tej pory nad
                      historią stała osobna sekcja „Korespondencja", a feed i tak
                      zawiera wpisy powstałe z tych samych maili — ten sam mail
                      widniał więc dwa razy (zgłoszenie właściciela). Maile, których
                      feed nie zna, dochodzą do osi niżej, więc scalenie niczego nie
                      gubi. Nadpisuje decyzję z 2026-07-15 o osobnej kartotece.

                      `plyta={false}`: wpisy mają własne obramowania, więc płyta
                      pod nimi zrobiłaby pudełko w pudełku. */}
                  <SekcjaProfilu
                    tytul="Pełna historia"
                    plyta={false}
                    className="2xl:order-1"
                    akcje={
                      osCzasu.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {FEED_FILTERS.map((f) => (
                            <button
                              key={f.value}
                              type="button"
                              onClick={() => setFeedFilter(f.value)}
                              className={`rounded-full border hairline px-2.5 py-0.5 text-[11px] ${
                                feedFilter === f.value ? "bg-[var(--fg)] text-[var(--bg)]" : "text-muted hover:bg-[var(--hairline)]"
                              }`}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      ) : undefined
                    }
                  >
                  {osCzasu.length === 0 ? (
                    <p className="text-sm text-muted opacity-60">Brak wpisów — dodaj pierwszy powyżej.</p>
                  ) : filteredFeed.length === 0 ? (
                    <p className="text-sm text-muted opacity-60">Brak wpisów w tym filtrze.</p>
                  ) : (
                    groupFeedByDay(filteredFeed).map((group) => (
                      <div key={group.label} className="mb-4 last:mb-0">
                        {/* Nagłówek dnia PRZYKLEJA SIĘ do góry karty przy
                            przewijaniu — jak w Wiadomościach iOS. Przy długiej
                            historii to jedyna rzecz, która mówi „czytasz teraz
                            marzec", gdy data wpisu dawno wyjechała w górę.
                            Tło jest konieczne: pod spodem przewijają się wpisy. */}
                        <div className="sticky top-0 z-10 -mx-1 bg-[var(--bg-soft)] px-1 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted opacity-90">
                          {group.label}
                        </div>
                        {/* Jeden ciąg na pionowej linii, nie stos osobnych kart
                            (runda czytelności 2026-07-26, wzorzec z Attio
                            i z historii zdarzeń w Linear). Ramka wokół każdego
                            wpisu dawała tyle krawędzi, że gubiła się ta jedna,
                            która coś znaczy — chronologia. Linia biegnie przez
                            środek odznak (lewy margines + `before`), a wpisy
                            rozdziela odstęp, nie obwódka. */}
                        <ul className="relative space-y-0.5 before:absolute before:bottom-3 before:left-[14px] before:top-3 before:w-px before:bg-[var(--hairline)] before:content-['']">
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
                              <li
                                key={`${f.source}:${f.id}`}
                                className="group relative flex items-start gap-2.5 rounded-lg py-2 pl-10 pr-2 text-sm hover:bg-hairline/60"
                              >
                                {/* Odznaka siedzi NA linii (ujemny lewy margines
                                    równy wcięciu listy), więc oś czasu ma jeden
                                    tor zamiast dwóch krawędzi. */}
                                <span
                                  className={`absolute left-0 top-2 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-[var(--bg-soft)] ${badge.cls}`}
                                  aria-hidden
                                >
                                  {badge.icon}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="mb-0.5 flex items-center justify-between gap-2">
                                    <span className="flex items-center gap-1.5 text-[11px] text-muted">
                                      <span className="font-medium">{badge.label}</span>
                                      <span className="tabular-nums">{formatTime(f.created_at)}</span>
                                      {f.czas_trwania_sek != null && <span>· {formatCallDuration(f.czas_trwania_sek)}</span>}
                                      {f.source === "lead" && (
                                        <span className="rounded-full bg-[var(--hairline)] px-1.5 py-0.5 text-[10px] text-muted" title="Wpis sprzed awansu na klienta">
                                          z etapu leada
                                        </span>
                                      )}
                                    </span>
                                    {/* Kosz pojawia się na najechanie — w ciągu
                                        bez ramek dwadzieścia stałych krzyżyków
                                        przy prawej krawędzi robiło własną,
                                        fałszywą kolumnę. */}
                                    {f.source === "client" && (
                                      <button
                                        onClick={() => deleteNote(f.id)}
                                        className="shrink-0 text-muted opacity-0 transition-opacity hover:text-red-400 focus:opacity-100 group-hover:opacity-100"
                                        aria-label="Usuń wpis"
                                        title="Usuń wpis"
                                      >
                                        <IconTrash size={13} />
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
                  </SekcjaProfilu>
                </div>
              </div>
            )}

            {tab === "changes" && <FieldChangesTab entity="client" changes={changes} />}
          </ViewSwitch>
        </div>
      </div>
    </div>
  );
}

/** Średnia z trzech ocen jednej opinii — ta sama arytmetyka, co w
 * `GET /api/clients` (podzapytanie `avg_rating`) i w `lib/projects.ts`.
 * `null`, gdy klient wypełnił samą treść bez gwiazdek. */
function projectRating(p: Pick<LinkedProject, "review_rating_jakosc" | "review_rating_terminowosc" | "review_rating_komunikacja">): number | null {
  const vals = [p.review_rating_jakosc, p.review_rating_terminowosc, p.review_rating_komunikacja].filter(
    (v): v is number => typeof v === "number"
  );
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function LinkedGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      {/* Świadomie BEZ kapitalików — te same kapitaliki nosi nagłówek sekcji
          „Powiązane" tuż wyżej, a to jest poziom niżej (grupa w sekcji).
          Dwa poziomy w jednym stylu czytają się jak jeden. */}
      <h3 className="mb-1 text-[11px] font-medium text-muted opacity-70">{title}</h3>
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

/** Odznaka i etykieta wpisu na osi — **kierunek widać po IKONIE, nie po
 * napisie** (zgłoszenie właściciela 2026-07-26: „na pierwszy rzut oka nie
 * widać, czy to akcja wychodząca czy przychodząca").
 *
 * Do tej pory ikona niosła sam kanał, a kierunek był małą pigułką z tekstem
 * „Ja → oni" / „Oni → ja" — czyli informacją, którą trzeba PRZECZYTAĆ, przy
 * elemencie, który ma być rozpoznawany wzrokiem. Teraz mail przychodzący ma
 * kopertę, wychodzący samolocik, a telefon strzałkę w dół albo w górę —
 * dokładnie tak, jak spis połączeń w iOS i jak zrobiliśmy to w apce.
 *
 * Etykieta („Mail przychodzący", „Nieodebrane") jest ta sama, co w apce —
 * jedno nazewnictwo na obu platformach.
 */
function feedBadge(f: { kanal: string | null; wynik: string | null; kind: string; kierunek: string | null; source: string }): {
  icon: ReactNode;
  cls: string;
  label: string;
} {
  const wychodzacy = f.kierunek === "wychodzacy";

  if (f.kanal === "telefon") {
    if (f.wynik === "nieodebrane") {
      return { icon: <IconPhoneOff size={14} />, cls: CALL_OUTCOME_CLASS.nieodebrane, label: "Nieodebrane" };
    }
    return {
      icon: wychodzacy ? <IconPhoneOutgoing size={14} /> : <IconPhoneIncoming size={14} />,
      cls: CONTACT_CHANNEL_CLASS.telefon,
      label: wychodzacy ? "Telefon wychodzący" : "Telefon przychodzący",
    };
  }

  if (f.kanal === "email") {
    return {
      icon: wychodzacy ? <IconSend size={14} /> : <IconMail size={14} />,
      cls: CONTACT_CHANNEL_CLASS.email,
      label: wychodzacy ? "Mail wychodzący" : "Mail przychodzący",
    };
  }

  if (f.kanal) {
    const kanal = f.kanal as keyof typeof CONTACT_CHANNEL_CLASS;
    return {
      icon: <ContactChannelIcon kind={f.kanal} size={14} />,
      cls: CONTACT_CHANNEL_CLASS[kanal],
      label: `${CONTACT_CHANNEL_LABEL[kanal]}${f.kierunek ? (wychodzacy ? " — wychodzące" : " — przychodzące") : ""}`,
    };
  }

  if (f.kind === "note") {
    return { icon: <IconMessageCircle size={14} />, cls: "bg-[var(--hairline)] text-muted", label: "Notatka" };
  }
  return { icon: <ClientEventIcon kind={f.kind} size={14} />, cls: "bg-[var(--hairline)] text-muted", label: "Zdarzenie" };
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
