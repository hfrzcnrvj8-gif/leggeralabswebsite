"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import {
  type Lead,
  type Activity,
  SOURCE_CATEGORIES,
  LEAD_STATUS_HINT,
  LEAD_STATUS_STEP,
  CONTACT_CHANNELS,
  CONTACT_CHANNEL_LABEL,
  CONTACT_CHANNEL_ICON,
  CONTACT_DIRECTIONS,
  CONTACT_DIRECTION_LABEL,
  ContactQuickActions,
  QuickDateChips,
  EditableText,
  EditableTextarea,
  StatusTag,
} from "./shared";
import { ProcessMap, PillPicker } from "../components";
import { useUI } from "../ui";
import { DateField } from "../DatePicker";
import { todayLocalISO, addDaysLocalISO } from "@/lib/dates";

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
  const [markContacted, setMarkContacted] = useState(true);
  const [saving, setSaving] = useState(false);
  const [promoting, setPromoting] = useState(false);

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
    const data = (await res.json()) as { lead: Lead; activity: Activity[] };
    setLead(data.lead);
    setActivity(data.activity);
    setNoteFollowup(data.lead.next_followup ?? "");
    setNoteAction(data.lead.next_action ?? "");
  }, [id]);

  useEffect(() => {
    setLead(null);
    setNotFound(false);
    load();
  }, [load]);

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
    const res = await fetch(`/api/leads/${id}/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: noteText.trim(),
        kanal: noteChannel || null,
        kierunek: noteDirection || null,
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
    <div className="card-paper max-h-[85vh] overflow-y-auto rounded-2xl border hairline p-6 sm:p-8">
      <PanelHeader onClose={onClose} />

      <div className={onClose ? "mt-4" : ""}>
        <div className="flex items-start justify-between gap-4">
          <input
            value={lead.firma}
            onChange={(e) => setLead((prev) => (prev ? { ...prev, firma: e.target.value } : prev))}
            onBlur={(e) => updateLead("firma", e.target.value)}
            className="w-full bg-transparent text-2xl font-semibold tracking-tight text-[var(--fg)] outline-none"
          />
          <button
            onClick={deleteLead}
            className="shrink-0 rounded-full border hairline px-3 py-1.5 text-xs text-red-400"
          >
            Usuń leada
          </button>
        </div>
        <input
          value={lead.osoba_kontaktowa}
          onChange={(e) => setLead((prev) => (prev ? { ...prev, osoba_kontaktowa: e.target.value } : prev))}
          onBlur={(e) => updateLead("osoba_kontaktowa", e.target.value)}
          placeholder="Osoba kontaktowa (imię i nazwisko)"
          className="mt-0.5 w-full bg-transparent text-sm text-muted outline-none placeholder:text-muted placeholder:opacity-60"
        />

        <div className="mt-2 flex items-center gap-2">
          <StatusTag status={lead.status} onChange={(v) => updateLead("status", v)} />
          {lead.client_id ? (
            <Link href={`/${lang}/admin/clients/${lead.client_id}`} className="text-[12.5px] text-muted hover:text-[var(--fg)] hover:underline">
              → Karta klienta
            </Link>
          ) : (
            <button
              onClick={promoteToClient}
              disabled={promoting}
              title="Gdy rozmowa realnie się zaczęła — utwórz klienta, żeby mieć jego historię kontaktu w jednym miejscu"
              className="rounded-full border hairline px-2.5 py-1 text-[11px] text-muted hover:text-[var(--fg)] disabled:opacity-50"
            >
              {promoting ? "Tworzę…" : "+ Utwórz klienta"}
            </button>
          )}
        </div>
        <p className="mt-2 text-[12.5px] text-muted opacity-80">{LEAD_STATUS_HINT[lead.status]}</p>

        <div className="mt-4">
          <ContactQuickActions telefon={lead.telefon} email={lead.email} linkedinUrl={lead.linkedin_url} />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Branża">
            <EditableText value={lead.branza} onSave={(v) => updateLead("branza", v)} />
          </Field>
          <Field label="Telefon">
            <EditableText value={lead.telefon} onSave={(v) => updateLead("telefon", v)} />
          </Field>
          <Field label="Email">
            <EditableText value={lead.email} onSave={(v) => updateLead("email", v)} />
          </Field>
          <Field label="WWW">
            <EditableText value={lead.www} onSave={(v) => updateLead("www", v)} />
          </Field>
          <Field label="LinkedIn">
            <EditableText value={lead.linkedin_url} onSave={(v) => updateLead("linkedin_url", v)} />
          </Field>
          <Field label="Ulica">
            <EditableText value={lead.ulica} onSave={(v) => updateLead("ulica", v)} />
          </Field>
          <Field label="Kod / Miasto">
            <div className="flex gap-2">
              <EditableText value={lead.kod} onSave={(v) => updateLead("kod", v)} />
              <EditableText value={lead.miasto} onSave={(v) => updateLead("miasto", v)} />
            </div>
          </Field>
          <Field label="Kraj">
            <EditableText value={lead.kraj} onSave={(v) => updateLead("kraj", v)} />
          </Field>
          <Field label="Źródło">
            <PillPicker
              value={lead.zrodlo_kategoria}
              options={SOURCE_CATEGORIES}
              onChange={(v) => updateLead("zrodlo_kategoria", v)}
              placeholder="— wybierz kategorię —"
              title="Zmień kategorię źródła"
            />
          </Field>
          <Field label="Szczegóły źródła">
            <EditableText value={lead.zrodlo} onSave={(v) => updateLead("zrodlo", v)} />
          </Field>
          <Field label="Ostatni kontakt">
            <DateField value={lead.ostatni_kontakt ?? ""} onChange={(v) => updateLead("ostatni_kontakt", v)} placeholder="—" />
          </Field>
          <Field label="Przypomnij mi">
            <DateField value={lead.next_followup ?? ""} onChange={(v) => updateLead("next_followup", v)} placeholder="—" />
          </Field>
          {lead.next_followup && (
            <Field label="Następny krok (po co przypomnienie)">
              <EditableText value={lead.next_action} onSave={(v) => updateLead("next_action", v)} />
            </Field>
          )}
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-[11px] text-muted">Notatka przypięta</label>
          <EditableTextarea value={lead.notatki} onSave={(v) => updateLead("notatki", v)} />
        </div>
      </div>

      <div className="mt-6 border-t hairline pt-6">
        <h2 className="mb-4 text-lg font-semibold">Log aktywności</h2>

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
            placeholder="Co się wydarzyło? np. zadzwoniłem, obiecał odpowiedzieć do piątku… (Cmd+Enter, by zapisać)"
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

        {activity.length === 0 ? (
          <p className="text-sm text-muted opacity-60">📭 Brak wpisów — dodaj pierwszy powyżej.</p>
        ) : (
          <ul className="space-y-3">
            {activity.map((a) => (
              <li key={a.id} className="rounded-xl border hairline p-3 text-sm">
                <div className="mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] text-muted">
                    {a.kanal && (
                      <span aria-hidden title={CONTACT_CHANNEL_LABEL[a.kanal as keyof typeof CONTACT_CHANNEL_LABEL]}>
                        {CONTACT_CHANNEL_ICON[a.kanal as keyof typeof CONTACT_CHANNEL_ICON]}
                      </span>
                    )}
                    {formatDate(a.created_at)}
                    {a.kierunek && (
                      <span className="rounded-full bg-[var(--hairline)] px-1.5 py-0.5 text-[10px]">
                        {CONTACT_DIRECTION_LABEL[a.kierunek as keyof typeof CONTACT_DIRECTION_LABEL]}
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => deleteNote(a.id)}
                    className="text-muted hover:text-red-400"
                    aria-label="Usuń wpis"
                    title="Usuń wpis"
                  >
                    ✕
                  </button>
                </div>
                <p className="whitespace-pre-wrap">{a.text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 border-t hairline pt-6">
        <h2 className="mb-4 text-lg font-semibold">Proces sprzedaży</h2>
        <ProcessMap currentStep={LEAD_STATUS_STEP[lead.status] ?? 1} />
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] text-muted">{label}</label>
      {children}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
