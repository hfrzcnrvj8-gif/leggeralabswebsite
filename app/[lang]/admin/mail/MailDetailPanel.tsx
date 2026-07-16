"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { useUI } from "../ui";
import {
  MailStatusTag,
  MailCategoryTag,
  replySubject,
  forwardSubject,
  SIGNATURE_LANGS,
  SIGNATURE_LANG_LABEL,
  type SignatureLang,
  type MailMessageWithLinks,
  type MailStatus,
} from "./shared";
import { MailBodyHtml } from "./MailBodyHtml";
import { MailComposeForm } from "./MailComposeForm";
import { TemplatePickerButton, useMailTemplates, type MailTemplate } from "./TemplatePickerButton";
import { useUndoSend } from "./useUndoSend";

type Project = { id: string; tytul: string; status: string };

/** Podgląd wiadomości. W `MailDashboard` renderowany bezpośrednio obok listy
 * (kolumna podglądu, nie modal — 04d pkt 4: pełna szerokość ekranu zamiast
 * wąskiego okna), na `[id]/page.tsx` jako samodzielna strona pod stałym
 * linkiem. Karta sama może być szeroka, ale treść maila to jedna kolumna
 * tekstu — `max-w-[70ch]` niżej ogranicza TYLKO akapit, żeby długie linie nie
 * ciągnęły się przez cały ekran. */
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
  const [html, setHtml] = useState("");
  const [blockedImages, setBlockedImages] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyCc, setReplyCc] = useState("");
  const [forwardOpen, setForwardOpen] = useState(false);
  // Domyślnie polski; przełącznik przy pisaniu (decyzja właściciela
  // 2026-07-15 — świadomie ręcznie, nie automatem po kraju klienta).
  const [podpis, setPodpis] = useState<SignatureLang | null>("pl");
  const [busy, setBusy] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const templates = useMailTemplates();
  // "Cofnij wysyłkę" (Etap 1 Modułu 4b) — dotyczy WSZYSTKICH ścieżek wysyłki,
  // tu: Odpisz/Odpowiedz wszystkim. Przekazanie ma własną instancję w
  // MailComposeForm.
  const { countdown, start, cancel, sending } = useUndoSend();

  const load = useCallback(async () => {
    const res = await fetch(`/api/mail/${mailId}${showImages ? "?images=1" : ""}`);
    if (!res.ok) {
      toast("Nie udało się wczytać wiadomości.", "error");
      return;
    }
    const data = await res.json();
    setMail(data.message);
    setHtml(data.html || "");
    setBlockedImages(Boolean(data.blockedImages));
  }, [mailId, showImages, toast]);

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

  const send = useCallback(() => {
    const text = replyText.trim();
    if (!text) {
      toast("Treść odpowiedzi nie może być pusta.", "error");
      return;
    }
    start(async () => {
      const res = await fetch(`/api/mail/${mailId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, podpis, cc: replyCc }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast(data?.error || "Nie udało się wysłać odpowiedzi.", "error");
        return;
      }
      setReplyOpen(false);
      setReplyText("");
      setReplyCc("");
      await load();
      await onChanged();
      // Mail poszedł, ale coś pobocznego się nie udało (np. kopia w Sent) —
      // właściciel musi o tym wiedzieć, a nie zobaczyć zwykłe "wysłano".
      if (Array.isArray(data?.warnings) && data.warnings.length > 0) {
        toast(data.warnings.join(" "), "error");
      } else {
        toast("Odpowiedź wysłana.");
      }
    });
  }, [mailId, replyText, replyCc, podpis, load, onChanged, toast, start]);

  const applyTemplate = useCallback((t: MailTemplate) => {
    setReplyText((prev) => (prev.trim() ? `${prev}\n\n${t.tresc}` : t.tresc));
  }, []);

  /** Szkic AI (Moduł 7) — zawsze NADPISUJE całe pole treścią propozycji
   * (decyzja właściciela 2026-07-16): to pełna propozycja odpowiedzi, nie
   * fragment do doklejenia jak szablon. Model nigdy nie wysyła nic sam —
   * właściciel widzi tekst w polu i normalnie go poprawia/wysyła. */
  const requestDraft = useCallback(async () => {
    setDraftLoading(true);
    try {
      const res = await fetch(`/api/mail/${mailId}/draft-reply`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast(data?.error || "Model AI chwilowo niedostępny — napisz odpowiedź ręcznie.", "error");
        return;
      }
      setReplyText(data.draft || "");
    } finally {
      setDraftLoading(false);
    }
  }, [mailId, toast]);

  /** Wspólne dla "Utwórz leada" i "Utwórz klienta" — te same kroki, inny
   * endpoint. Właściciel decyduje kliknięciem, czy piszący to dopiero lead do
   * przepchnięcia przez lejek, czy od razu realna relacja (prośba
   * 2026-07-15). Panel tego nie zgaduje. */
  const createContact = useCallback(
    async (kind: "lead" | "client") => {
      setBusy(true);
      try {
        const res = await fetch(`/api/mail/${mailId}/create-${kind}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          toast(data?.error || `Nie udało się utworzyć ${kind === "lead" ? "leada" : "klienta"}.`, "error");
          return;
        }
        await load();
        await onChanged();
        toast(
          data.reused
            ? `Przypisano do: ${data.nazwa}.`
            : `Utworzono ${kind === "lead" ? "leada" : "klienta"}: ${data.nazwa}.`
        );
      } finally {
        setBusy(false);
      }
    },
    [mailId, load, onChanged, toast]
  );

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

  // "Utwórz leada" ma sens tylko dla wiadomości od CZŁOWIEKA. Przy reklamie
  // proponowanie leada z robota (np. jobalerts-noreply@linkedin.com) było
  // dokładnie tym, co właściciel zgłosił jako bez sensu 2026-07-15.
  const unassigned = !mail.client_id && !mail.lead_id && mail.kierunek === "in" && mail.kategoria !== "reklama";

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
          {mail.kategoria && <MailCategoryTag kategoria={mail.kategoria} />}
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
          <>
            <button
              onClick={() => void createContact("lead")}
              disabled={busy}
              className="rounded-full border border-brand-cyan/40 px-2.5 py-1 text-brand-cyan hover:bg-brand-cyan/10 disabled:opacity-50"
            >
              🎯 Utwórz leada
            </button>
            <button
              onClick={() => void createContact("client")}
              disabled={busy}
              className="rounded-full border border-brand-purple/40 px-2.5 py-1 text-brand-purple hover:bg-brand-purple/10 disabled:opacity-50"
            >
              👤 Utwórz klienta
            </button>
          </>
        )}
      </div>

      {/* HTML, gdy mail go ma (tak wygląda w Outlooku); wersja tekstowa jako
          zapas dla maili czysto tekstowych. max-w-[70ch] tylko na akapicie —
          karta wokół może być szeroka (04d pkt 4), ale linijki tekstu nie. */}
      <div className="mb-5 max-w-[70ch]">
        {html ? (
          <MailBodyHtml html={html} blockedImages={blockedImages} onShowImages={() => setShowImages(true)} />
        ) : (
          <div className="rounded-xl border hairline bg-[var(--hairline)]/20 p-4">
            <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed">
              {mail.body_text || "(pusta treść)"}
            </pre>
          </div>
        )}
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

      {forwardOpen ? (
        <MailComposeForm
          mode="forward"
          initialSubject={forwardSubject(mail.subject)}
          hint="Poniżej zostanie doklejona oryginalna wiadomość (nagłówek + treść)."
          endpoint={`/api/mail/${mailId}/forward`}
          onSent={async () => {
            await load();
            await onChanged();
          }}
          onClose={() => setForwardOpen(false)}
        />
      ) : replyOpen ? (
        <div className="space-y-2">
          <p className="text-[12px] text-muted">
            Odpowiedź do <span className="font-medium">{mail.from_addr}</span> — temat: {replySubject(mail.subject)}
          </p>
          <input
            value={replyCc}
            onChange={(e) => setReplyCc(e.target.value)}
            placeholder="DW (opcjonalnie, adresy po przecinku)"
            className="w-full rounded-xl border hairline bg-transparent px-3 py-2 text-[13px] outline-none focus:border-brand-purple/50"
          />
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            rows={8}
            autoFocus
            placeholder="Treść odpowiedzi…"
            className="w-full rounded-xl border hairline bg-transparent p-3 text-[13px] outline-none focus:border-brand-purple/50"
          />

          {/* Podpis dokleja panel przy wysyłce — świadomie NIE wrzucamy go do
              pola edycji, żeby nie dało się go przypadkiem nadpisać ani wysłać
              w nieaktualnej wersji. */}
          <div className="flex flex-wrap items-center gap-1 text-[12px]">
            <span className="mr-1 text-muted opacity-70">Podpis:</span>
            {SIGNATURE_LANGS.map((l) => (
              <button
                key={l}
                onClick={() => setPodpis(l as SignatureLang)}
                className={`rounded-full px-2.5 py-0.5 transition ${
                  podpis === l ? "bg-[var(--hairline)] font-medium" : "text-muted hover:text-[var(--fg)]"
                }`}
              >
                {SIGNATURE_LANG_LABEL[l as SignatureLang]}
              </button>
            ))}
            <button
              onClick={() => setPodpis(null)}
              className={`rounded-full px-2.5 py-0.5 transition ${
                podpis === null ? "bg-[var(--hairline)] font-medium" : "text-muted hover:text-[var(--fg)]"
              }`}
            >
              Bez podpisu
            </button>
            <span className="ml-auto flex items-center gap-1">
              <button
                onClick={() => void requestDraft()}
                disabled={draftLoading}
                title="Model AI zaproponuje treść odpowiedzi na podstawie tego maila — do poprawienia przed wysłaniem"
                className="rounded-full border hairline px-2.5 py-0.5 text-muted hover:text-[var(--fg)] disabled:opacity-50"
              >
                {draftLoading ? "Generuję…" : "✨ Zaproponuj szkic"}
              </button>
              <TemplatePickerButton templates={templates} onPick={applyTemplate} />
            </span>
          </div>

          <div className="flex items-center gap-2">
            {sending ? (
              <>
                <span className="rounded-full bg-[var(--hairline)] px-4 py-1.5 text-[13px] text-muted">Wysyłam za {countdown}s…</span>
                <button onClick={cancel} className="rounded-full border hairline px-3 py-1.5 text-[13px] hover:bg-[var(--hairline)]/50">
                  Cofnij
                </button>
              </>
            ) : (
              <>
                <button onClick={send} className="btn-primary rounded-full px-4 py-1.5 text-[13px]">
                  Wyślij odpowiedź
                </button>
                <button onClick={() => setReplyOpen(false)} className="rounded-full px-3 py-1.5 text-[13px] text-muted hover:text-[var(--fg)]">
                  Anuluj
                </button>
              </>
            )}
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
          {mail.kierunek === "in" && mail.cc_addr && (
            <button
              onClick={() => {
                setReplyCc(mail.cc_addr || "");
                setReplyOpen(true);
              }}
              disabled={!configured}
              title={configured ? undefined : "Skrzynka nie jest skonfigurowana — dodaj dane az.pl w zmiennych środowiskowych Vercela."}
              className="rounded-full border hairline px-3 py-1.5 text-[13px] text-muted hover:text-[var(--fg)] disabled:opacity-50"
            >
              ↩︎ Odpowiedz wszystkim
            </button>
          )}
          <button
            onClick={() => setForwardOpen(true)}
            disabled={!configured}
            title={configured ? undefined : "Skrzynka nie jest skonfigurowana — dodaj dane az.pl w zmiennych środowiskowych Vercela."}
            className="rounded-full border hairline px-3 py-1.5 text-[13px] text-muted hover:text-[var(--fg)] disabled:opacity-50"
          >
            ➜ Przekaż
          </button>
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
