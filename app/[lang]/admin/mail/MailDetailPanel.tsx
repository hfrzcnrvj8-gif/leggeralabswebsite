"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { useUI } from "../ui";
import { MailStatusTag, replySubject, type MailMessageWithLinks, type MailStatus } from "./shared";

type Project = { id: string; tytul: string; status: string };

/** Profil wiadomości = wyśrodkowany modal (CLAUDE.md: dotyczy WSZYSTKICH
 * modułów). Overlay siedzi w MailDashboard, karta tutaj — wzorem
 * LeadDetailPanel/InvoiceEditor. Świadomie max-w-5xl (limit nadaje
 * dashboard): treść maila to jedna kolumna tekstu, więc pełna szerokość
 * ekranu pogorszyłaby czytelność, inaczej niż przy gęstym profilu leada. */
export function MailDetailPanel({
  lang,
  mailId,
  configured,
  onClose,
  onChanged,
}: {
  lang: Locale;
  mailId: string;
  configured: boolean;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const { toast, prompt } = useUI();
  const [mail, setMail] = useState<MailMessageWithLinks | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [projects, setProjects] = useState<Project[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/mail/${mailId}`);
    if (!res.ok) {
      toast("Nie udało się wczytać wiadomości.", "error");
      return;
    }
    const data = await res.json();
    setMail(data.message);
  }, [mailId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Projekty klienta dociągamy tylko wtedy, gdy mail jest do klienta
  // przypisany — bez tego "Z maila → zadanie" nie ma do czego się podpiąć.
  useEffect(() => {
    if (!mail?.client_id) {
      setProjects(null);
      return;
    }
    void (async () => {
      const res = await fetch(`/api/mail/${mailId}/to-task`);
      if (res.ok) setProjects((await res.json()).projects);
    })();
  }, [mail?.client_id, mailId]);

  const setStatus = useCallback(
    async (status: MailStatus) => {
      setBusy(true);
      try {
        const res = await fetch(`/api/mail/${mailId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) {
          toast("Nie udało się zmienić statusu.", "error");
          return;
        }
        await load();
        await onChanged();
        toast(status === "obsłużony" ? "Oznaczono jako obsłużone." : status === "zignorowany" ? "Wyciszono." : "Przywrócono do odpowiedzi.");
      } finally {
        setBusy(false);
      }
    },
    [mailId, load, onChanged, toast]
  );

  const send = useCallback(async () => {
    const text = replyText.trim();
    if (!text) {
      toast("Treść odpowiedzi nie może być pusta.", "error");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/mail/${mailId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast(data?.error || "Nie udało się wysłać odpowiedzi.", "error");
        return;
      }
      setReplyOpen(false);
      setReplyText("");
      await load();
      await onChanged();
      // Mail poszedł, ale coś pobocznego się nie udało (np. kopia w Sent) —
      // właściciel musi o tym wiedzieć, a nie zobaczyć zwykłe "wysłano".
      if (Array.isArray(data?.warnings) && data.warnings.length > 0) {
        toast(data.warnings.join(" "), "error");
      } else {
        toast("Odpowiedź wysłana.");
      }
    } finally {
      setSending(false);
    }
  }, [mailId, replyText, load, onChanged, toast]);

  const createLead = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/mail/${mailId}/create-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast(data?.error || "Nie udało się utworzyć leada.", "error");
        return;
      }
      await load();
      await onChanged();
      toast(data.reused ? `Przypisano do: ${data.nazwa}.` : `Utworzono leada: ${data.nazwa}.`);
    } finally {
      setBusy(false);
    }
  }, [mailId, load, onChanged, toast]);

  const toTask = useCallback(
    async (projectId: string) => {
      if (!mail) return;
      // prompt() nie umie wstępnie wypełnić pola, więc temat maila idzie jako
      // placeholder — pusta odpowiedź oznacza wtedy "weź temat", zamiast
      // zmuszać do przepisywania go ręcznie.
      const answer = await prompt("Treść zadania", { placeholder: mail.subject || "Zadanie z maila" });
      if (answer === null) return;
      const text = answer.trim() || mail.subject.trim();
      if (!text) {
        toast("Treść zadania nie może być pusta.", "error");
        return;
      }
      setBusy(true);
      try {
        const res = await fetch(`/api/mail/${mailId}/to-task`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project_id: projectId, text }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          toast(data?.error || "Nie udało się utworzyć zadania.", "error");
          return;
        }
        await load();
        await onChanged();
        toast("Zadanie dodane do projektu.");
      } finally {
        setBusy(false);
      }
    },
    [mail, mailId, load, onChanged, prompt, toast]
  );

  if (!mail) {
    return (
      <div className="card-paper max-h-[85vh] overflow-y-auto rounded-2xl border hairline p-6 sm:p-8">
        <div className="h-6 w-48 animate-pulse rounded bg-[var(--hairline)]" />
      </div>
    );
  }

  const unassigned = !mail.client_id && !mail.lead_id && mail.kierunek === "in";

  return (
    <div className="card-paper max-h-[85vh] overflow-y-auto rounded-2xl border hairline p-6 sm:p-8">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-medium">{mail.subject || "(bez tematu)"}</h2>
          <p className="mt-1 text-[13px] text-muted">
            {mail.kierunek === "out" ? "Do: " : "Od: "}
            {mail.from_name ? `${mail.from_name} <${mail.kierunek === "out" ? mail.to_addr : mail.from_addr}>` : mail.kierunek === "out" ? mail.to_addr : mail.from_addr}
          </p>
          <p className="text-[12px] text-muted opacity-70">
            {new Date(mail.received_at).toLocaleString("pl-PL", { dateStyle: "long", timeStyle: "short" })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <MailStatusTag status={mail.status as MailStatus} />
          <button onClick={onClose} className="rounded-full px-2 py-0.5 text-lg leading-none text-muted hover:text-[var(--fg)]" aria-label="Zamknij">
            ×
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px]">
        {mail.client_id && mail.client_nazwa && (
          <Link href={`/${lang}/admin/clients/${mail.client_id}`} className="rounded-full bg-brand-purple/15 px-2.5 py-1 text-brand-purple hover:opacity-80">
            👤 {mail.client_nazwa}
          </Link>
        )}
        {mail.lead_id && mail.lead_nazwa && (
          <Link href={`/${lang}/admin/leads/${mail.lead_id}`} className="rounded-full bg-brand-cyan/15 px-2.5 py-1 text-brand-cyan hover:opacity-80">
            🎯 {mail.lead_nazwa}
          </Link>
        )}
        {mail.invoice_id && mail.invoice_numer && (
          <Link href={`/${lang}/admin/invoices/${mail.invoice_id}`} className="rounded-full bg-brand-gold/15 px-2.5 py-1 text-brand-gold hover:opacity-80">
            🧾 {mail.invoice_numer}
          </Link>
        )}
        {unassigned && (
          <button
            onClick={createLead}
            disabled={busy}
            className="rounded-full border border-brand-cyan/40 px-2.5 py-1 text-brand-cyan hover:bg-brand-cyan/10 disabled:opacity-50"
          >
            + Utwórz leada z tego maila
          </button>
        )}
      </div>

      <div className="mb-5 rounded-xl border hairline bg-[var(--hairline)]/20 p-4">
        <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed">
          {mail.body_text || "(pusta treść)"}
        </pre>
      </div>

      {projects && projects.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 text-[12px] font-medium text-muted">Z maila → zadanie w projekcie:</p>
          <div className="flex flex-wrap gap-2">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => void toTask(p.id)}
                disabled={busy}
                className="rounded-full border hairline px-2.5 py-1 text-[12px] hover:bg-[var(--hairline)]/50 disabled:opacity-50"
              >
                📋 {p.tytul}
              </button>
            ))}
          </div>
        </div>
      )}

      {replyOpen ? (
        <div className="space-y-2">
          <p className="text-[12px] text-muted">
            Odpowiedź do <span className="font-medium">{mail.from_addr}</span> — temat: {replySubject(mail.subject)}
          </p>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            rows={8}
            autoFocus
            placeholder="Treść odpowiedzi…"
            className="w-full rounded-xl border hairline bg-transparent p-3 text-[13px] outline-none focus:border-brand-purple/50"
          />
          <div className="flex items-center gap-2">
            <button onClick={send} disabled={sending} className="btn-primary rounded-full px-4 py-1.5 text-[13px] disabled:opacity-50">
              {sending ? "Wysyłam…" : "Wyślij odpowiedź"}
            </button>
            <button onClick={() => setReplyOpen(false)} className="rounded-full px-3 py-1.5 text-[13px] text-muted hover:text-[var(--fg)]">
              Anuluj
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {mail.kierunek === "in" && (
            <button
              onClick={() => setReplyOpen(true)}
              disabled={!configured}
              title={configured ? undefined : "Skrzynka nie jest skonfigurowana — dodaj dane az.pl w zmiennych środowiskowych Vercela."}
              className="btn-primary rounded-full px-4 py-1.5 text-[13px] disabled:opacity-50"
            >
              ↩︎ Odpisz
            </button>
          )}
          {mail.status === "nowy" && (
            <button
              onClick={() => void setStatus("obsłużony")}
              disabled={busy}
              className="rounded-full border border-orange-500/40 px-3 py-1.5 text-[12px] text-orange-400 hover:bg-orange-500/10 disabled:opacity-50"
            >
              Obsłużone
            </button>
          )}
          {mail.status !== "nowy" && mail.kierunek === "in" && (
            <button
              onClick={() => void setStatus("nowy")}
              disabled={busy}
              className="rounded-full border hairline px-3 py-1.5 text-[12px] text-muted hover:text-[var(--fg)] disabled:opacity-50"
            >
              Przywróć do odpowiedzi
            </button>
          )}
          {mail.status !== "zignorowany" && mail.kierunek === "in" && (
            <button
              onClick={() => void setStatus("zignorowany")}
              disabled={busy}
              className="rounded-full border hairline px-3 py-1.5 text-[12px] text-muted hover:text-[var(--fg)] disabled:opacity-50"
            >
              Wycisz
            </button>
          )}
          {mail.from_addr && (
            <a
              href={`mailto:${mail.from_addr}?subject=${encodeURIComponent(replySubject(mail.subject))}`}
              className="rounded-full border hairline px-3 py-1.5 text-[12px] text-muted hover:text-[var(--fg)]"
            >
              Otwórz w Outlooku
            </a>
          )}
        </div>
      )}
    </div>
  );
}
