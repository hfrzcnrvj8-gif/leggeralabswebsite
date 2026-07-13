"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import {
  type Client,
  CLIENT_STATUS_HINT,
  CLIENT_STATUS_STEP,
  CLIENT_EVENT_ICON,
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
import { formatPlDate } from "@/lib/projects";
import { formatMoney } from "@/lib/invoices";
import { useUI } from "../ui";
import { DateField } from "../DatePicker";
import { todayLocalISO } from "@/lib/dates";

type LinkedOffer = { id: string; tytul: string; status: string; wazna_do: string | null; created_at: string };
type LinkedInvoice = { id: string; numer: string | null; status: string; typ_dokumentu: string; created_at: string };
type LinkedProject = { id: string; tytul: string; status: string; termin: string | null; created_at: string };

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
  const [offers, setOffers] = useState<LinkedOffer[]>([]);
  const [invoices, setInvoices] = useState<LinkedInvoice[]>([]);
  const [projects, setProjects] = useState<LinkedProject[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteFollowup, setNoteFollowup] = useState("");
  const [noteAction, setNoteAction] = useState("");
  const [noteChannel, setNoteChannel] = useState("");
  const [noteDirection, setNoteDirection] = useState("wychodzacy");
  const [markContacted, setMarkContacted] = useState(true);
  const [saving, setSaving] = useState(false);

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
    };
    setClient(data.client);
    setFeed(data.feed);
    setOffers(data.offers);
    setInvoices(data.invoices);
    setProjects(data.projects);
    setNoteFollowup(data.client.next_followup ?? "");
    setNoteAction(data.client.next_action ?? "");
  }, [id]);

  useEffect(() => {
    setClient(null);
    setNotFound(false);
    load();
  }, [load]);

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
    const res = await fetch(`/api/clients/${id}/activity`, {
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
      setNoteText("");
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

  const linkedCount = offers.length + invoices.length + projects.length;

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
      </div>

      {linkedCount > 0 && (
        <div className="mt-6 border-t hairline pt-6">
          <h2 className="mb-4 text-lg font-semibold">Powiązane</h2>
          <div className="space-y-4">
            {offers.length > 0 && (
              <LinkedGroup title="Oferty">
                {offers.map((o) => (
                  <li key={o.id}>
                    <Link href={`/${lang}/admin/offers/${o.id}/print`} target="_blank" className="hover:underline">
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
                    <Link href={`/${lang}/admin/invoices/${i.id}/print`} target="_blank" className="hover:underline">
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
          </div>
        </div>
      )}

      <div className="mt-6 border-t hairline pt-6">
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

        {feed.length === 0 ? (
          <p className="text-sm text-muted opacity-60">📭 Brak wpisów — dodaj pierwszy powyżej.</p>
        ) : (
          <ul className="space-y-3">
            {feed.map((f) => (
              <li key={`${f.source}:${f.id}`} className="rounded-xl border hairline p-3 text-sm">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[11px] text-muted">
                    <span aria-hidden>
                      {f.kanal
                        ? CONTACT_CHANNEL_ICON[f.kanal as keyof typeof CONTACT_CHANNEL_ICON]
                        : f.kind === "note"
                          ? "💬"
                          : (CLIENT_EVENT_ICON[f.kind] ?? "•")}
                    </span>
                    {formatDate(f.created_at)}
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
                <p className="whitespace-pre-wrap">
                  {f.text}
                  {f.amount != null && <span className="font-medium"> — {formatMoney(f.amount)}</span>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 border-t hairline pt-6">
        <h2 className="mb-4 text-lg font-semibold">Proces sprzedaży</h2>
        <ProcessMap currentStep={CLIENT_STATUS_STEP[client.status] ?? 3} />
      </div>
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
