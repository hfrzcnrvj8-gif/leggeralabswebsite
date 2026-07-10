"use client";

import { useCallback, useEffect, useState } from "react";
import { type Lead, type Activity, EditableText, EditableTextarea, StatusTag } from "./shared";
import { useUI } from "../ui";

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
  onClose,
  onDeleted,
  onFieldChange,
}: {
  id: string;
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
  const [markContacted, setMarkContacted] = useState(true);
  const [saving, setSaving] = useState(false);

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
        next_followup: noteFollowup || null,
        ...(markContacted ? { ostatni_kontakt: new Date().toISOString().slice(0, 10) } : {}),
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
      <div>
        <PanelHeader onClose={onClose} />
        <p className="mt-6 text-sm text-muted">Nie znaleziono takiego leada — może został usunięty.</p>
      </div>
    );
  }

  if (!lead) {
    return (
      <div>
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
    <div>
      <PanelHeader onClose={onClose} />

      <div className="card-paper mt-4 rounded-3xl p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <input
            value={lead.firma}
            onChange={(e) => setLead((prev) => (prev ? { ...prev, firma: e.target.value } : prev))}
            onBlur={(e) => updateLead("firma", e.target.value)}
            className="w-full bg-transparent font-serif text-2xl font-semibold tracking-tight text-[var(--fg)] outline-none"
          />
          <button
            onClick={deleteLead}
            className="shrink-0 rounded-full border hairline px-3 py-1.5 text-xs text-red-400"
          >
            Usuń leada
          </button>
        </div>

        <div className="mt-2">
          <StatusTag status={lead.status} onChange={(v) => updateLead("status", v)} />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
          <Field label="Źródło">
            <EditableText value={lead.zrodlo} onSave={(v) => updateLead("zrodlo", v)} />
          </Field>
          <Field label="Ostatni kontakt">
            <input
              type="date"
              value={lead.ostatni_kontakt ?? ""}
              onChange={(e) => updateLead("ostatni_kontakt", e.target.value)}
              className="w-full rounded-lg border hairline bg-transparent px-2 py-1.5 text-sm text-[var(--fg)]"
            />
          </Field>
          <Field label="Przypomnij mi">
            <input
              type="date"
              value={lead.next_followup ?? ""}
              onChange={(e) => updateLead("next_followup", e.target.value)}
              className="w-full rounded-lg border hairline bg-transparent px-2 py-1.5 text-sm text-[var(--fg)]"
            />
          </Field>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-[11px] text-muted">Notatka przypięta</label>
          <EditableTextarea value={lead.notatki} onSave={(v) => updateLead("notatki", v)} />
        </div>
      </div>

      <div className="card-paper mt-6 rounded-3xl p-6 sm:p-8">
        <h2 className="mb-4 font-serif text-lg font-semibold">Log aktywności</h2>

        <form onSubmit={submitNote} className="mb-6 space-y-2">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Co się wydarzyło? np. zadzwoniłem, obiecał odpowiedzieć do piątku…"
            rows={3}
            className="w-full rounded-xl border hairline bg-transparent px-3 py-2 text-sm text-[var(--fg)] placeholder:text-muted"
          />
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
              <input
                type="date"
                value={noteFollowup}
                onChange={(e) => setNoteFollowup(e.target.value)}
                className="rounded-lg border hairline bg-transparent px-2 py-1 text-xs text-[var(--fg)]"
              />
            </label>
            <button
              type="submit"
              disabled={saving || !noteText.trim()}
              className="btn-primary ml-auto rounded-full px-4 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Zapisuję…" : "Dodaj wpis"}
            </button>
          </div>
        </form>

        {activity.length === 0 ? (
          <p className="text-sm text-muted opacity-60">Brak wpisów — dodaj pierwszy powyżej.</p>
        ) : (
          <ul className="space-y-3">
            {activity.map((a) => (
              <li key={a.id} className="rounded-xl border hairline p-3 text-sm">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] text-muted">{formatDate(a.created_at)}</span>
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
