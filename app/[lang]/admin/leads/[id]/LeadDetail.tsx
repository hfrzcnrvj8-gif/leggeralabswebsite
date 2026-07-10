"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/config";
import {
  type Lead,
  type Activity,
  EditableText,
  EditableTextarea,
  StatusTag,
} from "../shared";

export function LeadDetail({ id, lang }: { id: string; lang: Locale }) {
  const router = useRouter();
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
    load();
  }, [load]);

  const updateLead = async (field: string, value: string) => {
    setLead((prev) => (prev ? { ...prev, [field]: value } : prev));
    await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
  };

  const deleteLead = async () => {
    if (!lead) return;
    if (!window.confirm(`Usunąć "${lead.firma}" z rejestru? Tego nie da się cofnąć.`)) return;
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    router.push(`/${lang}/admin/leads`);
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
      load();
    }
  };

  const deleteNote = async (activityId: string) => {
    if (!window.confirm("Usunąć ten wpis z logu?")) return;
    await fetch(`/api/leads/${id}/activity/${activityId}`, { method: "DELETE" });
    setActivity((prev) => prev.filter((a) => a.id !== activityId));
  };

  if (notFound) {
    return (
      <div>
        <BackLink lang={lang} />
        <p className="mt-6 text-sm text-muted">Nie znaleziono takiego leada — może został usunięty.</p>
      </div>
    );
  }

  if (!lead) {
    return <p className="text-sm text-muted">Ładowanie…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <BackLink lang={lang} />

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

function BackLink({ lang }: { lang: Locale }) {
  return (
    <Link href={`/${lang}/admin/leads`} className="text-sm text-muted hover:text-[var(--fg)]">
      ← Wróć do tablicy
    </Link>
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
