"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { useUI } from "../ui";
import { Popover, PropertyMenu, MenuRow } from "../Menu";
import {
  MailStatusTag,
  MailCategoryTag,
  MAIL_STATUSES,
  MAIL_STATUS_LABEL,
  MAIL_FOLDER_ICON,
  replySubject,
  forwardSubject,
  SIGNATURE_LANGS,
  SIGNATURE_LANG_LABEL,
  type SignatureLang,
  type MailMessageWithLinks,
  type MailStatus,
  type MailFolder,
} from "./shared";
import { MailBodyHtml } from "./MailBodyHtml";
import { MailComposeForm } from "./MailComposeForm";
import { TemplatePickerButton, useMailTemplates, type MailTemplate } from "./TemplatePickerButton";
import { useUndoSend } from "./useUndoSend";

type Project = { id: string; tytul: string; status: string };

/** Siostrzana wiadomość TEGO SAMEGO wątku (Moduł 4, Etap 3) — kształt zwracany
 * przez GET /api/mail/[id] w polu `thread`, patrz app/api/mail/[id]/route.ts. */
type ThreadSibling = {
  id: string;
  subject: string;
  from_addr: string;
  from_name: string;
  kierunek: string;
  folder: string;
  status: string;
  received_at: string;
};

/** Krótka data dla paska wątku — ten sam wzorzec co formatWhen()
 * w MailDashboard.tsx, ale osobna kopia (świadomie nie eksportowana stamtąd,
 * żeby nie ciągnąć zależności od pliku dashboardu z panelu podglądu). */
function formatThreadWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}

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
  replyShortcut,
  forwardShortcut,
  replyAllShortcut,
  onNavigateToContact,
  onOpenThreadMessage,
}: {
  lang: Locale;
  mailId: string;
  configured: boolean;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
  /** Inkrementowany nonce z `MailDashboard` (skrót klawiszowy "r", Etap 2
   * Modułu 4b) — zmiana wartości otwiera pole odpowiedzi bez myszki. Osobny
   * prop zamiast globalnego stanu, żeby ten komponent nie musiał nic wiedzieć
   * o obsłudze klawiatury rodzica. */
  replyShortcut?: number;
  /** Analogiczne nonce dla "f" (Przekaż) i "a" (Odpowiedz wszystkim) — 04e
   * runda 2, dorobione skróty wzorem Apple Mail zgłoszone przez właściciela. */
  forwardShortcut?: number;
  replyAllShortcut?: number;
  /** "Wróć do poczty" — wołane TUŻ PRZED przejściem do karty klienta/leada
   * (klik w tag niżej), żeby `MailDashboard` zapisał, gdzie byliśmy (folder/
   * filtry/otwarta wiadomość). Ten komponent nie zna tego stanu — należy do
   * rodzica, stąd callback zamiast własnej logiki localStorage tutaj. */
  onNavigateToContact?: () => void;
  /** Pasek wątku (Moduł 4, Etap 3) — klik w siostrę wywołuje to zamiast
   * lokalnej nawigacji, bo TEN komponent nie wie, czy żyje w kolumnie
   * podglądu (`MailDashboard.tsx` → `setOpenId`) czy na samodzielnej
   * podstronie (`[id]/MailDetail.tsx` → `router.push`). */
  onOpenThreadMessage?: (id: string) => void;
}) {
  const { toast, prompt } = useUI();
  const [mail, setMail] = useState<MailMessageWithLinks | null>(null);
  const [html, setHtml] = useState("");
  const [blockedImages, setBlockedImages] = useState(false);
  const [thread, setThread] = useState<ThreadSibling[]>([]);
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
    setThread(Array.isArray(data.thread) ? data.thread : []);
  }, [mailId, showImages, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Skrót "r" (MailDashboard) → otwórz odpowiedź. Pomijamy pierwsze
  // wywołanie efektu (montaż), żeby domyślna wartość propa nie otwierała
  // pola od razu przy wejściu w podgląd.
  const firstReplyShortcut = useRef(true);
  useEffect(() => {
    if (firstReplyShortcut.current) {
      firstReplyShortcut.current = false;
      return;
    }
    if (mail?.kierunek === "in" && configured) setReplyOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyShortcut]);

  // Skrót "f" → otwórz przekazanie. Ten sam wzorzec co replyShortcut wyżej
  // (04e runda 2, dorobione skróty wzorem Apple Mail).
  const firstForwardShortcut = useRef(true);
  useEffect(() => {
    if (firstForwardShortcut.current) {
      firstForwardShortcut.current = false;
      return;
    }
    if (configured) setForwardOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forwardShortcut]);

  // Skrót "a" → otwórz odpowiedź z DW wypełnionym z oryginału ("Odpowiedz
  // wszystkim"), analogicznie do przycisku w pasku akcji.
  const firstReplyAllShortcut = useRef(true);
  useEffect(() => {
    if (firstReplyAllShortcut.current) {
      firstReplyAllShortcut.current = false;
      return;
    }
    if (mail?.kierunek === "in" && configured) {
      setReplyCc(mail.cc_addr || "");
      setReplyOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyAllShortcut]);

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

  /** Flaga "ważne" (04e runda 2) — TYLKO lokalna (decyzja właściciela), nie
   * dotyka IMAP-a — patrz komentarz w lib/db.ts. */
  const toggleFlag = useCallback(async () => {
    if (!mail) return;
    const res = await fetch(`/api/mail/${mailId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flagged: !mail.flagged }),
    });
    if (!res.ok) {
      toast("Nie udało się zmienić flagi.", "error");
      return;
    }
    await load();
    await onChanged();
  }, [mail, mailId, load, onChanged, toast]);

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

  /** Przenosi wiadomość między folderami na serwerze (Etap 2 Modułu 4b) —
   * "Usuń"/"Archiwizuj"/"Przywróć do Odebranych" to zawsze prawdziwy MOVE
   * (RFC 6851), osobna oś od `status` ("Wycisz" niżej to inna, wcześniej
   * istniejąca akcja — zostaje jak była, decyzja właściciela 2026-07-16). */
  const moveTo = useCallback(
    async (folder: "trash" | "archive" | "inbox") => {
      setBusy(true);
      try {
        const res = await fetch(`/api/mail/${mailId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ move: folder }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          toast(data?.error || "Nie udało się przenieść wiadomości.", "error");
          return;
        }
        await onChanged();
        // Mail zniknął z aktualnie oglądanego folderu — lista i tak go
        // zaraz nie pokaże, więc zamykamy podgląd zamiast zostawiać go
        // otwartym na czymś, co już nie jest tu widoczne.
        onClose();
        toast(folder === "trash" ? "Przeniesiono do Kosza." : folder === "archive" ? "Zarchiwizowano." : "Przywrócono do Odebranych.");
      } finally {
        setBusy(false);
      }
    },
    [mailId, onChanged, onClose, toast]
  );

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
          {/* Hierarchia wzorem Apple Mail (04e pkt 4, porównanie ze zrzutem
              właściciela): nadawca to NAJBARDZIEJ wyróżniony element —
              większy niż temat, z adresem przygaszonym tuż obok. Wcześniej
              było odwrotnie (temat text-lg, nadawca mały pod spodem). */}
          <p className="truncate text-[16px] font-semibold leading-snug">
            {mail.kierunek === "out" ? "Do: " : ""}
            {mail.kierunek === "out" ? mail.to_addr : mail.from_name || mail.from_addr}
            {mail.kierunek === "in" && mail.from_name && (
              <span className="ml-2 text-[12px] font-normal text-muted opacity-60">{mail.from_addr}</span>
            )}
          </p>
          <p className="mt-1 truncate text-[13px] text-muted">{mail.subject || "(bez tematu)"}</p>
          <p className="mt-0.5 text-[11px] text-muted opacity-60">
            {new Date(mail.received_at).toLocaleString("pl-PL", { dateStyle: "long", timeStyle: "short" })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Flaga "ważne" (04e runda 2) — lokalna, patrz toggleFlag() wyżej. */}
          <button
            onClick={() => void toggleFlag()}
            title={mail.flagged ? "Usuń flagę" : "Oflaguj jako ważne"}
            className={`text-[16px] leading-none ${mail.flagged ? "text-brand-gold" : "text-muted opacity-40 hover:opacity-80"}`}
          >
            {mail.flagged ? "★" : "☆"}
          </button>
          {mail.kategoria && <MailCategoryTag kategoria={mail.kategoria} />}
          {/* Status klikalny wprost w tagu (04e runda 2, zgłoszone przez
              właściciela) — wcześniej zmiana statusu żyła WYŁĄCZNIE w menu
              "•••", tag był tylko do odczytu. `PropertyMenu` (../Menu, ten
              sam komponent co np. status leada) konsoliduje wszystkie trzy
              przejścia (Do odpowiedzi/Obsłużony/Zignorowany) w jednym
              miejscu — dlatego usunięte z overflow menu niżej. */}
          <PropertyMenu
            value={mail.status as MailStatus}
            options={MAIL_STATUSES.map((s) => ({ value: s, label: MAIL_STATUS_LABEL[s] }))}
            onChange={(s) => void setStatus(s)}
            align="right"
            title="Zmień status"
          >
            <MailStatusTag status={mail.status as MailStatus} />
          </PropertyMenu>
          <button onClick={onClose} className="rounded-full px-2 py-0.5 text-lg leading-none text-muted hover:text-[var(--fg)]" aria-label="Zamknij">
            ×
          </button>
        </div>
      </div>

      {/* Pasek wątku (Moduł 4, Etap 3) — inne wiadomości TEJ SAMEJ rozmowy,
          NIEZALEŻNIE od folderu (odpowiedź wysłana z panelu ląduje w
          Wysłane, oryginał bywa w Odebranych — to normalny przypadek, nie
          wyjątek). Świadomie minimalne: bez treści/podglądu, tylko tyle, żeby
          zidentyfikować i przeskoczyć — pełny składany widok konwersacji to
          NIE jest zakres tej rundy. */}
      {thread.length > 0 && (
        <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
          {thread.map((s) => (
            <button
              key={s.id}
              onClick={() => onOpenThreadMessage?.(s.id)}
              className="flex shrink-0 items-center gap-1.5 rounded-full border hairline px-2.5 py-1 text-[12px] text-muted hover:bg-[var(--hairline)]/40 hover:text-[var(--fg)]"
              title={s.subject || "(bez tematu)"}
            >
              <span aria-hidden>{s.kierunek === "out" ? "↩️" : "✉️"}</span>
              <span className="max-w-[140px] truncate">{s.kierunek === "out" ? "Ty" : s.from_name || s.from_addr}</span>
              {s.folder !== "inbox" && (
                <span aria-hidden title={s.folder}>
                  {MAIL_FOLDER_ICON[s.folder as MailFolder]}
                </span>
              )}
              <span className="opacity-70">{formatThreadWhen(s.received_at)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Pasek akcji na górze podglądu (Moduł 4e pkt 1) — zawsze widoczny bez
          przewijania, nawet przy długim mailu. Tryb odpowiedzi/przekazania
          ZASTĘPUJE pasek w tym samym miejscu, tak jak wcześniej robił to na
          dole. Grupowanie: główna akcja (.btn-primary) → drugorzędne, zawsze
          widoczne → rzadziej używane schowane w menu "•••" (Popover/MenuRow z
          ../Menu, ten sam komponent co pasek akcji zbiorczych w
          ClientsDashboard.tsx). */}
      {forwardOpen ? (
        <div className="mb-4">
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
        </div>
      ) : replyOpen ? (
        <div className="mb-4 space-y-2">
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
        <div className="mb-4 flex flex-wrap items-center gap-2">
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
          {mail.folder !== "archive" && (
            <button
              onClick={() => void moveTo("archive")}
              disabled={busy || !configured}
              title={configured ? undefined : "Skrzynka nie jest skonfigurowana — dodaj dane az.pl w zmiennych środowiskowych Vercela."}
              className="rounded-full border hairline px-3 py-1.5 text-[12px] text-muted hover:text-[var(--fg)] disabled:opacity-50"
            >
              🗄️ Archiwizuj
            </button>
          )}
          {mail.folder !== "trash" && (
            <button
              onClick={() => void moveTo("trash")}
              disabled={busy || !configured}
              title={configured ? undefined : "Skrzynka nie jest skonfigurowana — dodaj dane az.pl w zmiennych środowiskowych Vercela."}
              className="rounded-full border border-red-500/40 px-3 py-1.5 text-[12px] text-red-400 hover:bg-red-500/10 disabled:opacity-50"
            >
              🗑️ Usuń
            </button>
          )}

          <Popover
            align="right"
            width={200}
            trigger={(open) => (
              <button
                onClick={open}
                title="Więcej akcji"
                aria-label="Więcej akcji"
                className="rounded-full border hairline px-3 py-1.5 text-[13px] text-muted hover:text-[var(--fg)]"
              >
                •••
              </button>
            )}
          >
            {(close) => (
              <div>
                {/* Wycisz/Obsłużone/Przywróć do odpowiedzi — przeniesione do
                    klikalnego tagu statusu w nagłówku (PropertyMenu wyżej),
                    04e runda 2. Zostaje tu tylko to, co NIE jest zmianą
                    statusu: przeniesienie folderu i skrót do Outlooka. */}
                {(mail.folder === "trash" || mail.folder === "archive") && (
                  <MenuRow
                    label="Przywróć do Odebranych"
                    onClick={() => {
                      void moveTo("inbox");
                      close();
                    }}
                  />
                )}
                {mail.from_addr && (
                  <a
                    href={`mailto:${mail.from_addr}?subject=${encodeURIComponent(replySubject(mail.subject))}`}
                    onClick={close}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px] text-[#e9e9ea] hover:bg-[#232327]"
                  >
                    Otwórz w Outlooku
                  </a>
                )}
              </div>
            )}
          </Popover>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px]">
        {/* `?from=mail` + onNavigateToContact() (04e runda 3, "wróć do
            poczty" zgłoszone przez właściciela) — karta klienta/leada pokaże
            "← Wróć do poczty" zamiast domyślnego "← Wróć do tablicy". */}
        {mail.client_id && mail.client_nazwa && (
          <Link
            href={`/${lang}/admin/clients/${mail.client_id}?from=mail`}
            onClick={() => onNavigateToContact?.()}
            className="rounded-full bg-brand-purple/15 px-2.5 py-1 text-brand-purple hover:opacity-80"
          >
            👤 {mail.client_nazwa}
          </Link>
        )}
        {mail.lead_id && mail.lead_nazwa && (
          <Link
            href={`/${lang}/admin/leads/${mail.lead_id}?from=mail`}
            onClick={() => onNavigateToContact?.()}
            className="rounded-full bg-brand-cyan/15 px-2.5 py-1 text-brand-cyan hover:opacity-80"
          >
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

      {/* Baner listy dystrybucyjnej (Moduł 4e pkt 3) — wzorem Apple Mail, nad
          treścią maila. `list_unsubscribe_url` niesie GOTOWY link (http(s)
          albo mailto:) wyciągnięty z nagłówka `List-Unsubscribe` — to zwykły
          klik użytkownika, panel nigdy sam nie odpytuje ani nie POST-uje do
          cudzego URL-a wypisu w tle. */}
      {mail.list_unsubscribe_url && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border hairline bg-[var(--hairline)]/20 px-4 py-2.5 text-[12px]">
          <span className="text-muted">📭 Wiadomość z listy dystrybucyjnej.</span>
          <a
            href={mail.list_unsubscribe_url}
            {...(mail.list_unsubscribe_url.startsWith("mailto:") ? {} : { target: "_blank", rel: "noopener noreferrer" })}
            className="font-medium text-brand-purple hover:opacity-80"
          >
            Anuluj subskrypcję
          </a>
        </div>
      )}

      {/* HTML, gdy mail go ma (tak wygląda w Outlooku); wersja tekstowa jako
          zapas dla maili czysto tekstowych. max-w-[70ch] tylko na akapicie —
          karta wokół może być szeroka (04d pkt 4), ale linijki tekstu nie.
          `mx-auto` wycentrowuje blok: bez tego, na szerokim ekranie, całe
          puste miejsce lądowało tylko po prawej stronie (zgłoszone
          2026-07-16) — wycentrowanie rozkłada je symetrycznie. */}
      <div className="mb-5 mx-auto max-w-[70ch]">
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
    </div>
  );
}
