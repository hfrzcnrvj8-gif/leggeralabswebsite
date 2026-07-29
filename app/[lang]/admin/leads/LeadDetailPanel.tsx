"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { IconMessageCircle, IconPhoneOff, IconLink, IconTrash } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import {
  type Lead,
  type Activity,
  SOURCE_CATEGORIES,
  LEAD_STATUS_HINT,
  LEAD_STATUS_STEP,
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
import { SekcjaProfilu, WierszPola } from "../ProfileSection";
import { CONTRACT_STATUS_CLASS } from "@/lib/contracts";
import { LinkPicker } from "../LinkPicker";
import { useUI } from "../ui";
import { DateField } from "../DatePicker";
import { todayLocalISO, addDaysLocalISO } from "@/lib/dates";
import { ViewTabs, ViewSwitch } from "../ViewTabs";
import { FieldChangesTab } from "../FieldChangesTab";
import type { FieldChange } from "@/lib/audit";

/**
 * Rdzeń widoku szczegółów leada — pola, log aktywności. Używany zarówno
 * jako wysuwany panel ("peek", styl Linear) bezpośrednio z tablicy/tabeli,
 * jak i jako samodzielna podstrona /admin/leads/[id] dla bezpośrednich
 * linków/zakładek (patrz [id]/LeadDetail.tsx — cienki wrapper).
 *
 * `onClose` obecne = tryb panelu (przycisk ✕ zamiast linku powrotu).
 * `onFieldChange`/`onDeleted` pozwalają rodzicowi (LeadsDashboard) trzymać
 * listę leadów zsynchronizowaną bez dodatkowego zapytania sieciowego —
 * ten komponent sam odpowiada za zapis, rodzic tylko odzwierciedla zmianę
 * lokalnie.
 */
export function LeadDetailPanel({
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
  const [lead, setLead] = useState<Lead | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
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
  const [promoting, setPromoting] = useState(false);
  const [sendingNda, setSendingNda] = useState(false);
  // NDA tego leada (Moduł 51) — status z serwera, nie domysł z kliknięcia.
  const [nda, setNda] = useState<{ id: string; status: string } | null>(null);
  const [changes, setChanges] = useState<FieldChange[]>([]);
  // Moduł 23 — zakładki, jak u klienta (ClientDetailPanel). Stan tutaj, nie w
  // wrapperach, więc działa i w modalu z listy, i na podstronie [id].
  //
  // Moduł 54, krok 6: zakładka „Wizytówka" ZNIKŁA — atrybuty stoją stale
  // w lewej kolumnie, dokładnie jak u klienta. Zostały dwie zakładki, bo lead
  // nie ma czego wkładać do „Powiązanych" (oferty i faktury wiszą na kliencie).
  const [tab, setTab] = useState<"history" | "changes">("history");
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [focusNote, setFocusNote] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/leads/${id}`);
    if (res.status === 401) {
      window.location.reload();
      return;
    }
    if (res.status === 404) {
      setNotFound(true);
      return;
    }
    const data = (await res.json()) as {
      lead: Lead;
      activity: Activity[];
      nda: { id: string; status: string } | null;
    };
    setLead(data.lead);
    setActivity(data.activity);
    setNda(data.nda ?? null);
    setNoteFollowup(data.lead.next_followup ?? "");
    setNoteAction(data.lead.next_action ?? "");
  }, [id]);

  useEffect(() => {
    setLead(null);
    setNotFound(false);
    setTab("history");
    load();
  }, [load]);

  // Fokus na polu wpisu po „Zapisz kontakt" — kopia mechanizmu z profilu
  // klienta wraz z powodem: `ViewSwitch` animuje wejście zakładki, więc `ref`
  // bywa jeszcze pusty i jedna próba ponowna potrafi być za wczesna.
  useEffect(() => {
    if (!focusNote || tab !== "history") return;
    const zrob = () => {
      if (!noteRef.current) return false;
      noteRef.current.focus();
      setFocusNote(false);
      return true;
    };
    if (zrob()) return;
    let probes = 0;
    const interval = setInterval(() => {
      if (zrob() || ++probes > 10) clearInterval(interval);
    }, 100);
    return () => clearInterval(interval);
  }, [focusNote, tab]);

  // Log zmian dociągany po otwarciu zakładki — i za każdym jej otwarciem, bo
  // właściciel mógł właśnie coś zmienić w wizytówce obok.
  useEffect(() => {
    if (tab !== "changes") return;
    let cancelled = false;
    fetch(`/api/leads/${id}/changes`)
      .then((res) => (res.ok ? res.json() : { changes: [] }))
      .then((data: { changes: FieldChange[] }) => {
        if (!cancelled) setChanges(data.changes ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tab, id]);

  const updateLead = async (field: string, value: string) => {
    setLead((prev) => (prev ? { ...prev, [field]: value } : prev));
    onFieldChange?.(id, field, value);
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (!res.ok) toast("Nie udało się zapisać zmiany.", "error");
  };

  const deleteLead = async () => {
    if (!lead) return;
    const ok = await confirm(`Usunąć "${lead.firma}" z rejestru? Tego nie da się cofnąć.`, { danger: true });
    if (!ok) return;
    const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Nie udało się usunąć leada.", "error");
      return;
    }
    toast("Lead usunięty.");
    onDeleted?.(id);
  };

  const submitNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSaving(true);
    const durationSec =
      noteOutcome === "odebrane" ? (Number(noteDurationMin) || 0) * 60 + (Number(noteDurationSec) || 0) : null;
    const res = await fetch(`/api/leads/${id}/activity`, {
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
      const data = (await res.json()) as { activity: Activity[] };
      setActivity(data.activity);
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

  const promoteToClient = async () => {
    setPromoting(true);
    const res = await fetch(`/api/leads/${id}/promote`, { method: "POST" });
    setPromoting(false);
    if (res.ok) {
      const data = (await res.json()) as { id: string };
      setLead((prev) => (prev ? { ...prev, client_id: data.id } : prev));
      onFieldChange?.(id, "client_id", data.id);
      toast("Utworzono klienta.");
    } else {
      toast("Nie udało się utworzyć klienta.", "error");
    }
  };

  const prepareNda = async () => {
    setSendingNda(true);
    const res = await fetch("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ typ: "nda", lead_id: id }),
    });
    setSendingNda(false);
    if (res.ok) {
      // Serwer dedupuje po `lead_id` (Moduł 51) — `existing` znaczy „to jest
      // ten sam dokument, który już masz", nie „utworzono nowy".
      const data = (await res.json()) as { id: string; existing?: boolean };
      setNda((prev) => prev ?? { id: data.id, status: "Szkic" });
      toast(
        data.existing
          ? "To NDA już istnieje — otwieram je zamiast tworzyć drugie."
          : "Przygotowano NDA — dokończ i wyślij w module Umowy."
      );
      window.open(`/${lang}/admin/contracts/${data.id}`, "_blank");
    } else {
      toast("Nie udało się przygotować NDA.", "error");
    }
  };

  const deleteNote = async (activityId: string) => {
    const ok = await confirm("Usunąć ten wpis z logu?", { danger: true });
    if (!ok) return;
    const res = await fetch(`/api/leads/${id}/activity/${activityId}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Nie udało się usunąć wpisu.", "error");
      return;
    }
    setActivity((prev) => prev.filter((a) => a.id !== activityId));
  };

  if (notFound) {
    return (
      <div className="card-paper max-h-[85vh] overflow-y-auto rounded-2xl border hairline p-6 sm:p-8">
        <PanelHeader onClose={onClose} />
        <p className="mt-6 text-sm text-muted">Nie znaleziono takiego leada — może został usunięty.</p>
      </div>
    );
  }

  if (!lead) {
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

  return (
    <div className="card-paper max-h-[85vh] overflow-y-auto rounded-2xl border hairline p-6 sm:p-8 lg:flex lg:h-[85vh] lg:max-h-none lg:flex-col lg:overflow-hidden">
      <PanelHeader onClose={onClose} />

      {/* Nagłówek zwarty — bliźniak `ClientDetailPanel.tsx`, powody tam.
          U leada w tym samym wierszu musi się zmieścić więcej (osoba
          kontaktowa, awans na klienta, NDA), więc drugi rząd zostaje —
          ale mieści rzeczy związane ze SOBĄ, a nie kolejne piętro tego
          samego nagłówka. */}
      <div className={onClose ? "mt-4" : ""}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <input
            value={lead.firma}
            onChange={(e) => setLead((prev) => (prev ? { ...prev, firma: e.target.value } : prev))}
            onBlur={(e) => updateLead("firma", e.target.value)}
            className="min-w-[12rem] flex-1 bg-transparent text-2xl font-semibold tracking-tight text-[var(--fg)] outline-none"
          />
          <StatusTag status={lead.status} onChange={(v) => updateLead("status", v)} />
          <button
            onClick={() => {
              setTab("history");
              setFocusNote(true);
            }}
            className="flex h-[34px] items-center gap-1.5 rounded-lg border border-brand-purple/40 bg-brand-purple/10 px-3 text-[13px] font-medium text-[var(--fg)] hover:bg-brand-purple/15"
          >
            <IconMessageCircle size={15} /> Zapisz kontakt
          </button>
          <ContactQuickActions telefon={lead.telefon} email={lead.email} linkedinUrl={lead.linkedin_url} zwarte />
          <button
            onClick={deleteLead}
            title="Usuń leada z rejestru"
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border hairline text-muted hover:bg-red-500/10 hover:text-red-400"
            aria-label="Usuń leada"
          >
            <IconTrash size={15} />
          </button>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <input
            value={lead.osoba_kontaktowa}
            onChange={(e) => setLead((prev) => (prev ? { ...prev, osoba_kontaktowa: e.target.value } : prev))}
            onBlur={(e) => updateLead("osoba_kontaktowa", e.target.value)}
            placeholder="Osoba kontaktowa (imię i nazwisko)"
            className="min-w-[10rem] flex-1 bg-transparent text-sm text-muted outline-none placeholder:text-muted placeholder:opacity-60"
          />
          {lead.client_id ? (
            <Link href={`/${lang}/admin/clients/${lead.client_id}`} className="text-[12.5px] text-muted hover:text-[var(--fg)] hover:underline">
              → Karta klienta
            </Link>
          ) : (
            <>
              {/* Moduł 22 — „ten lead to firma, którą już mam w bazie".
                  Kolumna leads.client_id istniała od Modułu 12, ale wypełniał
                  ją tylko awans, więc jedynym wyjściem było „+ Utwórz
                  klienta" — czyli drugi rekord tej samej firmy. Picker stoi
                  PRZED przyciskiem właśnie dlatego. */}
              <LinkPicker
                kinds={["client"]}
                value={{ client_id: lead.client_id }}
                onPick={(next) => updateLead("client_id", next.client_id ?? "")}
                placeholder="Podepnij istniejącego"
                trigger={(picked, open) => (
                  <button
                    onClick={open}
                    title="Gdy ta firma jest już w bazie klientów — podepnij ją zamiast tworzyć duplikat"
                    className="rounded-full border hairline px-2.5 py-1 text-[11px] text-muted hover:text-[var(--fg)]"
                  >
                    <><IconLink size={12} className="mr-1 inline align-[-2px]" />{picked ? picked.nazwa : "Podepnij istniejącego"}</>
                  </button>
                )}
              />
              <button
                onClick={promoteToClient}
                disabled={promoting}
                title="Gdy rozmowa realnie się zaczęła — utwórz klienta, żeby mieć jego historię kontaktu w jednym miejscu"
                className="rounded-full border hairline px-2.5 py-1 text-[11px] text-muted hover:text-[var(--fg)] disabled:opacity-50"
              >
                {promoting ? "Tworzę…" : "+ Utwórz klienta"}
              </button>
            </>
          )}
          {/* NDA: gdy dokument już jest, przycisk ustępuje miejsca pigułce ze
              statusem — „czy NDA poszło i czy jest podpisane" to informacja,
              której profil leada wcześniej nie nosił wcale (Moduł 51). Nazwa
              „Przygotuj", nie „Wyślij", bo to tworzy szkic; wysyłka jest w
              module Umowy. */}
          {nda ? (
            <Link
              href={`/${lang}/admin/contracts/${nda.id}`}
              title="Otwórz NDA tego leada w module Umowy"
              className={`rounded-full px-2.5 py-1 text-[11px] ${CONTRACT_STATUS_CLASS[nda.status] ?? "bg-[var(--hairline)] text-muted"}`}
            >
              NDA: {nda.status.toLowerCase()}
            </Link>
          ) : (
            <button
              onClick={prepareNda}
              disabled={sendingNda}
              title="Gdy rozmowa dotknie wewnętrznych systemów/danych klienta, zanim cokolwiek podpiszecie — przygotuj NDA przed rozmową odkrywczą"
              className="rounded-full border hairline px-2.5 py-1 text-[11px] text-muted hover:text-[var(--fg)] disabled:opacity-50"
            >
              {sendingNda ? "Tworzę…" : "+ Przygotuj NDA"}
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[12.5px] text-muted opacity-80">{LEAD_STATUS_HINT[lead.status]}</p>
      </div>

      {/* Układ boczny — bliźniak `ClientDetailPanel.tsx` (Moduł 54, krok 6).
          Powody, pułapki i to, czego świadomie NIE zrobiliśmy (karta o stałej
          wysokości), opisuje `HUB_SETUP.md` → „Moduł 54 — Klienci, krok 6";
          nie powielam ich tu, bo dwa opisy tej samej decyzji rozjeżdżają się
          przy pierwszej poprawce. */}
      <div className="mt-5 grid gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="order-2 min-w-0 lg:order-1 lg:h-full lg:overflow-y-auto lg:pr-2">
          {/* Sekcje i ich kolejność 1:1 z profilem klienta (runda czytelności
              2026-07-26) — u leada nie ma tylko „Osób kontaktowych", bo to
              wciąż jedno pole w nagłówku. Powód całego zabiegu: `SekcjaProfilu`
              w `../ProfileSection.tsx`. */}
          <div className="space-y-4">
            <SekcjaProfilu tytul="Kontakt" zwijalna>
              <WierszPola etykieta="Telefon">
                <EditableText value={lead.telefon} onSave={(v) => updateLead("telefon", v)} />
              </WierszPola>
              <WierszPola etykieta="Email">
                <EditableText value={lead.email} onSave={(v) => updateLead("email", v)} />
              </WierszPola>
              <WierszPola etykieta="WWW">
                <EditableText value={lead.www} onSave={(v) => updateLead("www", v)} />
              </WierszPola>
              <WierszPola etykieta="LinkedIn">
                <EditableText value={lead.linkedin_url} onSave={(v) => updateLead("linkedin_url", v)} />
              </WierszPola>
            </SekcjaProfilu>

            <SekcjaProfilu tytul="Rytm kontaktu" zwijalna>
              <WierszPola etykieta="Ostatni kontakt">
                <DateField value={lead.ostatni_kontakt ?? ""} onChange={(v) => updateLead("ostatni_kontakt", v)} placeholder="—" />
              </WierszPola>
              {/* Pigułki terminów świadomie NIE w tym wierszu — patrz ten sam
                  komentarz w `ClientDetailPanel.tsx`. Stoją w „Nowym wpisie". */}
              <WierszPola etykieta="Przypomnij mi">
                <DateField value={lead.next_followup ?? ""} onChange={(v) => updateLead("next_followup", v)} placeholder="—" />
              </WierszPola>
              {lead.next_followup && (
                <WierszPola etykieta="Następny krok" title="Po co jest to przypomnienie">
                  <EditableText value={lead.next_action} onSave={(v) => updateLead("next_action", v)} />
                </WierszPola>
              )}
            </SekcjaProfilu>

            <SekcjaProfilu tytul="Firma" zwijalna>
              <WierszPola etykieta="Branża">
                <EditableText value={lead.branza} onSave={(v) => updateLead("branza", v)} />
              </WierszPola>
              <WierszPola etykieta="Skąd przyszedł">
                <PillPicker
                  value={lead.zrodlo_kategoria}
                  options={SOURCE_CATEGORIES}
                  onChange={(v) => updateLead("zrodlo_kategoria", v)}
                  placeholder="Wybierz"
                  title="Zmień kategorię źródła"
                />
                <EditableText value={lead.zrodlo} onSave={(v) => updateLead("zrodlo", v)} placeholder="szczegóły" />
              </WierszPola>
            </SekcjaProfilu>

            <SekcjaProfilu tytul="Adres" zwijalna>
              <WierszPola etykieta="Ulica">
                <EditableText value={lead.ulica} onSave={(v) => updateLead("ulica", v)} />
              </WierszPola>
              {/* Wąski kod, szerokie miasto — patrz komentarz w profilu
                  klienta. */}
              <WierszPola etykieta="Kod / Miasto">
                <div className="w-[64px] shrink-0">
                  <EditableText value={lead.kod} onSave={(v) => updateLead("kod", v)} placeholder="kod" />
                </div>
                <EditableText value={lead.miasto} onSave={(v) => updateLead("miasto", v)} placeholder="miasto" />
              </WierszPola>
              <WierszPola etykieta="Kraj">
                <EditableText value={lead.kraj} onSave={(v) => updateLead("kraj", v)} />
              </WierszPola>
            </SekcjaProfilu>

            {/* Notatka przypięta zostaje przy atrybutach, nie przy osi czasu:
                to stała prawda o leadzie, a nie wpis z datą. */}
            <SekcjaProfilu tytul="Notatka przypięta" wiersze={false} zwijalna>
              <EditableTextarea value={lead.notatki} onSave={(v) => updateLead("notatki", v)} />
            </SekcjaProfilu>
          </div>
        </aside>

        <div className="order-1 flex min-w-0 flex-col lg:order-2 lg:h-full lg:overflow-y-auto lg:pr-1">
          {/* Mapa procesu NAD zakładkami — „gdzie jesteśmy z tym leadem" to
              kontekst do wszystkiego, co niżej. */}
          <div className="mb-4">
            <label className="mb-1.5 block px-1 text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Proces sprzedaży
            </label>
            <ProcessMap currentStep={LEAD_STATUS_STEP[lead.status] ?? 1} />
          </div>

          <div className="flex h-9 items-center gap-4 border-b hairline">
            <ViewTabs
              value={tab}
              onChange={setTab}
              layoutId="lead-detail-tab-underline"
              // Nazwy 1:1 z apką (paczka E, kat. 5 listy kontrolnej): tam ta
              // sama treść siedzi pod „Historia" i „Logi" (`LeadDetailView.
              // Zakladka`). Dwie nazwy tej samej zakładki na dwóch ekranach
              // każą uczyć się dwóch schematów zamiast jednego.
              tabs={[
                { id: "history", label: "Historia" },
                { id: "changes", label: "Logi" },
              ]}
            />
          </div>

          <ViewSwitch viewKey={tab}>
            {/* Podział na oś + przypięty formularz po prawej od `2xl` —
                bliźniak zakładki historii u klienta, powody w komentarzu tam. */}
            {tab === "history" && (
              <div className="mt-6 space-y-4 2xl:grid 2xl:grid-cols-[minmax(0,1fr)_380px] 2xl:items-start 2xl:gap-6 2xl:space-y-0">
                {/* Formularz na własnej płycie — to jedyne miejsce w profilu,
                    w którym się PISZE, a na wspólnym tle wyglądał jak pierwszy
                    wpis osi. */}
                <SekcjaProfilu tytul="Nowy wpis" wiersze={false} className="2xl:sticky 2xl:top-0 2xl:order-2">
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
                    placeholder="Co się wydarzyło? np. zadzwoniłem, obiecał odpowiedzieć do piątku… (Cmd+Enter, by zapisać)"
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
                      <input
                        type="checkbox"
                        checked={markContacted}
                        onChange={(e) => setMarkContacted(e.target.checked)}
                      />
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
                      placeholder="Następny krok — po co to przypomnienie? np. oddzwonić, spytać o budżet"
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

                {/* `plyta={false}`: wpisy mają własne obramowania, więc płyta
                    pod nimi zrobiłaby pudełko w pudełku. */}
                <SekcjaProfilu tytul="Log aktywności" plyta={false} className="2xl:order-1">
                {activity.length === 0 ? (
                  <p className="text-sm text-muted opacity-60">Brak wpisów — dodaj pierwszy powyżej.</p>
                ) : (
                  groupActivityByDay(activity).map((group) => (
                    <div key={group.label} className="mb-4 last:mb-0">
                      {/* Nagłówek dnia przykleja się do góry karty przy
                          przewijaniu — jak w Wiadomościach iOS i jak u klienta. */}
                      <div className="sticky top-0 z-10 -mx-1 bg-[var(--bg-soft)] px-1 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted opacity-90">
                        {group.label}
                      </div>
                      {/* Jeden ciąg na pionowej linii — bliźniak osi z profilu
                          klienta, powody w komentarzu tam. */}
                      <ul className="relative space-y-0.5 before:absolute before:bottom-3 before:left-[14px] before:top-3 before:w-px before:bg-[var(--hairline)] before:content-['']">
                        {group.items.map((a) => {
                          const badge = activityBadge(a);
                          return (
                            <li
                              key={a.id}
                              className="group relative flex items-start gap-2.5 rounded-lg py-2 pl-10 pr-2 text-sm hover:bg-[var(--hairline)]/60"
                            >
                              <span
                                className={`absolute left-0 top-2 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-[var(--bg-soft)] ${badge.cls}`}
                                aria-hidden
                              >
                                {badge.icon}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="mb-0.5 flex items-center justify-between gap-2">
                                  <span className="flex items-center gap-1.5 text-[11px] text-muted">
                                    {formatTime(a.created_at)}
                                    {a.czas_trwania_sek != null && <span>· {formatCallDuration(a.czas_trwania_sek)}</span>}
                                    {a.kierunek && (
                                      <span className="rounded-full bg-[var(--hairline)] px-1.5 py-0.5 text-[10px]">
                                        {CONTACT_DIRECTION_LABEL[a.kierunek as keyof typeof CONTACT_DIRECTION_LABEL]}
                                      </span>
                                    )}
                                  </span>
                                  <button
                                    onClick={() => deleteNote(a.id)}
                                    className="shrink-0 text-muted opacity-0 transition-opacity hover:text-red-400 focus:opacity-100 group-hover:opacity-100"
                                    aria-label="Usuń wpis"
                                    title="Usuń wpis"
                                  >
                                    <IconTrash size={13} />
                                  </button>
                                </div>
                                <p className="whitespace-pre-wrap">{a.text}</p>
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
            )}

            {tab === "changes" && <FieldChangesTab entity="lead" changes={changes} />}
          </ViewSwitch>
        </div>
      </div>
    </div>
  );
}

function PanelHeader({ onClose }: { onClose?: () => void }) {
  if (!onClose) return null;
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted">Szczegóły leada</span>
      <button
        onClick={onClose}
        className="rounded-full border hairline px-2.5 py-1 text-xs text-muted hover:text-[var(--fg)]"
        aria-label="Zamknij"
        title="Zamknij (Esc)"
      >
        ✕ Zamknij
      </button>
    </div>
  );
}

/** Kolorowa odznaka wpisu na osi — wzorem iOS: nieodebrane połączenie ma
 * pierwszeństwo (czerwone) przed zwykłym kolorem kanału, inne kanały mają
 * swój stały kolor (CONTACT_CHANNEL_CLASS), brak kanału = neutralny dymek. */
function activityBadge(a: { kanal: string | null; wynik: string | null }): { icon: ReactNode; cls: string } {
  if (a.kanal === "telefon" && a.wynik === "nieodebrane") {
    return { icon: <CallOutcomeIcon kind="nieodebrane" size={14} />, cls: CALL_OUTCOME_CLASS.nieodebrane };
  }
  if (a.kanal) {
    return {
      icon: <ContactChannelIcon kind={a.kanal} size={14} />,
      cls: CONTACT_CHANNEL_CLASS[a.kanal as keyof typeof CONTACT_CHANNEL_CLASS],
    };
  }
  return { icon: <IconMessageCircle size={14} />, cls: "bg-[var(--hairline)] text-muted" };
}

/** "Dziś" / "Wczoraj" / "DD.MM.YYYY" — czysto kosmetyczne grupowanie osi po
 * dniu (styl Wiadomości/Telefonu w iOS), nie autorytatywna reguła biznesowa
 * jak todayLocalISO() w lib/dates.ts. */
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

function groupActivityByDay<T extends { created_at: string }>(items: T[]): { label: string; items: T[] }[] {
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
