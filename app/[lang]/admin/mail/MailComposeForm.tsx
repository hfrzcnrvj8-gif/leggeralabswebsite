"use client";

// Etap 1 Modułu 4b — formularz wspólny dla "Nowa wiadomość" i "Przekaż":
// odbiorca (RecipientField — z bazy lub dowolny adres), DW/UDW, temat
// (ukryty przy przekazaniu — bierze się z oryginału po stronie serwera),
// treść, załączniki, podpis, szablon, cofnij wysyłkę. "Odpowiedz"/"Odpowiedz
// wszystkim" zostają w MailDetailPanel — to inny kształt (temat/odbiorca
// stałe, bierze się z wątku), więc nie ma po co wciskać ich w ten sam
// komponent.
//
// Druga runda (po teście na żywo, 2026-07-16): większe okno bliższe Apple
// Mail, chipy zamiast tekstu dla Do/DW/UDW (naprawdę wieloosobowe, nie tylko
// wizualnie), załączniki (TYLKO wysyłka, w pamięci — patrz komentarz przy
// MAIL_ATTACHMENT_* w lib/mail.ts), oraz naprawa stanu wysyłki: `submitting`
// z useUndoSend() pokazuje spinner MIĘDZY końcem odliczania a odpowiedzią
// serwera — bez tego UI wyglądał na zawieszony przez kilka sekund realnej
// wysyłki SMTP+IMAP.
import { useState } from "react";
import { motion } from "framer-motion";
import {
  SIGNATURE_LANGS,
  SIGNATURE_LANG_LABEL,
  parseAddressList,
  MAIL_ATTACHMENT_MIME_TYPES,
  MAIL_ATTACHMENT_MAX_FILE_BYTES,
  MAIL_ATTACHMENT_MAX_TOTAL_BYTES,
  type SignatureLang,
} from "./shared";
import { RecipientField, useMailContacts } from "./RecipientPicker";
import { TemplatePickerButton, useMailTemplates, type MailTemplate } from "./TemplatePickerButton";
import { useUndoSend } from "./useUndoSend";
import { useUI } from "../ui";

function formatBytes(n: number): string {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function MailComposeForm({
  mode,
  initialTo = "",
  initialSubject = "",
  hint,
  endpoint,
  onSent,
  onClose,
}: {
  mode: "compose" | "forward";
  initialTo?: string;
  initialSubject?: string;
  /** Podpowiedź nad treścią (np. przy przekazaniu: co dokładnie zostanie doklejone). */
  hint?: string;
  endpoint: string;
  onSent: () => void | Promise<void>;
  onClose: () => void;
}) {
  const { toast } = useUI();
  const contacts = useMailContacts();
  const templates = useMailTemplates();
  const [to, setTo] = useState<string[]>(() => parseAddressList(initialTo));
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subject, setSubject] = useState(initialSubject);
  const [text, setText] = useState("");
  const [podpis, setPodpis] = useState<SignatureLang | null>("pl");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [justSent, setJustSent] = useState(false);
  const { countdown, start, cancel, sending, submitting } = useUndoSend();

  const applyTemplate = (t: MailTemplate) => {
    setText((prev) => (prev.trim() ? `${prev}\n\n${t.tresc}` : t.tresc));
    if (mode === "compose" && t.temat && !subject.trim()) setSubject(t.temat);
  };

  const addFiles = (files: FileList | File[]) => {
    const incoming = Array.from(files);
    let runningTotal = attachments.reduce((s, a) => s + a.size, 0);
    const next: File[] = [];
    for (const f of incoming) {
      if (!(MAIL_ATTACHMENT_MIME_TYPES as readonly string[]).includes(f.type)) {
        toast(`Niedozwolony typ pliku: ${f.name}.`, "error");
        continue;
      }
      if (f.size > MAIL_ATTACHMENT_MAX_FILE_BYTES) {
        toast(`Plik za duży: ${f.name} (max ${formatBytes(MAIL_ATTACHMENT_MAX_FILE_BYTES)}).`, "error");
        continue;
      }
      runningTotal += f.size;
      if (runningTotal > MAIL_ATTACHMENT_MAX_TOTAL_BYTES) {
        toast(`Łączny rozmiar załączników przekracza ${formatBytes(MAIL_ATTACHMENT_MAX_TOTAL_BYTES)}.`, "error");
        continue;
      }
      next.push(f);
    }
    if (next.length > 0) setAttachments((prev) => [...prev, ...next]);
  };

  const submit = () => {
    if (to.length === 0) {
      toast("Podaj adres odbiorcy.", "error");
      return;
    }
    if (!text.trim() && mode === "compose") {
      toast("Treść wiadomości nie może być pusta.", "error");
      return;
    }
    start(async () => {
      const fd = new FormData();
      fd.append("to", to.join(", "));
      fd.append("cc", cc.join(", "));
      fd.append("bcc", bcc.join(", "));
      fd.append("subject", subject);
      fd.append("text", text);
      if (podpis) fd.append("podpis", podpis);
      for (const f of attachments) fd.append("attachments", f);

      try {
        const res = await fetch(endpoint, { method: "POST", body: fd });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          toast(data?.error || "Nie udało się wysłać wiadomości.", "error");
          return;
        }
        await onSent();
        if (Array.isArray(data?.warnings) && data.warnings.length > 0) {
          toast(data.warnings.join(" "), "error");
        } else {
          toast(mode === "forward" ? "Wiadomość przekazana." : "Wiadomość wysłana.");
        }
        setJustSent(true);
        window.setTimeout(onClose, 900);
      } catch (e) {
        console.error("[MailComposeForm] wysyłka nie powiodła się", e);
        toast("Nie udało się wysłać wiadomości — sprawdź połączenie i spróbuj ponownie.", "error");
      }
    });
  };

  const busy = sending || submitting || justSent;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 8, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="card-paper flex h-[80vh] max-h-[80vh] w-full flex-col overflow-hidden rounded-2xl border hairline"
    >
      <div className="flex shrink-0 items-center justify-between border-b hairline px-6 py-4 sm:px-8">
        <h2 className="text-lg font-medium">{mode === "forward" ? "Przekaż wiadomość" : "Nowa wiadomość"}</h2>
        <button onClick={onClose} className="rounded-full px-2 py-0.5 text-lg leading-none text-muted hover:text-[var(--fg)]" aria-label="Zamknij">
          ×
        </button>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto px-6 py-1 sm:px-8">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <RecipientField label="Do:" value={to} onChange={setTo} contacts={contacts} placeholder="adres@domena.pl" />
          </div>
          {!showCcBcc && (
            <button type="button" onClick={() => setShowCcBcc(true)} className="ml-2 shrink-0 text-[11px] text-muted hover:text-[var(--fg)]">
              Cc/Bcc
            </button>
          )}
        </div>
        {showCcBcc && <RecipientField label="DW:" value={cc} onChange={setCc} contacts={contacts} placeholder="opcjonalnie" />}
        {showCcBcc && <RecipientField label="UDW:" value={bcc} onChange={setBcc} contacts={contacts} placeholder="opcjonalnie" />}
        {mode === "compose" && (
          <div className="flex items-center gap-1.5 border-b hairline py-2">
            <span className="w-11 shrink-0 text-[12px] text-muted">Temat:</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 bg-transparent py-1 text-[13px] outline-none"
            />
          </div>
        )}
        {hint && <p className="mt-2 text-[12px] text-muted opacity-70">{hint}</p>}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
          }}
          rows={14}
          autoFocus
          placeholder={mode === "forward" ? "Komentarz (opcjonalnie)… — możesz też upuścić tu plik" : "Treść wiadomości… — możesz też upuścić tu plik"}
          className="mt-3 min-h-[200px] flex-1 resize-none rounded-xl border hairline bg-transparent p-3 text-[13px] outline-none focus:border-brand-purple/50"
        />

        {attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {attachments.map((f, i) => (
              <span key={`${f.name}-${i}`} className="flex items-center gap-1.5 rounded-full bg-[var(--hairline)] px-2.5 py-1 text-[12px]">
                📎 {f.name} <span className="text-muted">· {formatBytes(f.size)}</span>
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={`Usuń załącznik ${f.name}`}
                  className="text-muted hover:text-[var(--fg)]"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t hairline px-6 py-4 sm:px-8">
        <div className="mb-3 flex flex-wrap items-center gap-1 text-[12px]">
          <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border hairline px-2.5 py-1 text-muted hover:text-[var(--fg)]">
            📎 Załącz plik
            <input
              type="file"
              multiple
              accept={MAIL_ATTACHMENT_MIME_TYPES.join(",")}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
                e.target.value = "";
              }}
              className="hidden"
            />
          </label>
          <span className="mx-1 text-muted opacity-70">Podpis:</span>
          {SIGNATURE_LANGS.map((l) => (
            <button
              key={l}
              onClick={() => setPodpis(l as SignatureLang)}
              className={`rounded-full px-2.5 py-0.5 transition ${
                podpis === l ? "pill-active font-medium" : "text-muted hover:text-[var(--fg)]"
              }`}
            >
              {SIGNATURE_LANG_LABEL[l as SignatureLang]}
            </button>
          ))}
          <button
            onClick={() => setPodpis(null)}
            className={`rounded-full px-2.5 py-0.5 transition ${podpis === null ? "bg-[var(--hairline)] font-medium" : "text-muted hover:text-[var(--fg)]"}`}
          >
            Bez podpisu
          </button>
          <span className="ml-auto">
            <TemplatePickerButton templates={templates} onPick={applyTemplate} />
          </span>
        </div>

        <div className="flex items-center gap-2">
          {justSent ? (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-full bg-emerald-500/15 px-4 py-1.5 text-[13px] text-emerald-400"
            >
              ✓ {mode === "forward" ? "Wiadomość przekazana." : "Wiadomość wysłana."}
            </motion.span>
          ) : submitting ? (
            <span className="flex items-center gap-2 rounded-full bg-[var(--hairline)] px-4 py-1.5 text-[13px] text-muted">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
              Wysyłam…
            </span>
          ) : sending ? (
            <>
              <span className="rounded-full bg-[var(--hairline)] px-4 py-1.5 text-[13px] text-muted">Wysyłam za {countdown}s…</span>
              <button onClick={cancel} className="rounded-full border hairline px-3 py-1.5 text-[13px] hover:bg-[var(--hairline)]/50">
                Cofnij
              </button>
            </>
          ) : (
            <>
              <button onClick={submit} disabled={busy} className="btn-primary rounded-full px-4 py-1.5 text-[13px] disabled:opacity-50">
                {mode === "forward" ? "Przekaż" : "Wyślij"}
              </button>
              <button onClick={onClose} className="rounded-full px-3 py-1.5 text-[13px] text-muted hover:text-[var(--fg)]">
                Anuluj
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
