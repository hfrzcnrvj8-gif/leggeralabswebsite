"use client";

// Etap 1 Modułu 4b — formularz wspólny dla "Nowa wiadomość" i "Przekaż":
// odbiorca (RecipientField — z bazy lub dowolny adres), DW, temat (ukryty
// przy przekazaniu — bierze się z oryginału po stronie serwera), treść,
// podpis, szablon, cofnij wysyłkę. "Odpowiedz"/"Odpowiedz wszystkim"
// zostają w MailDetailPanel — to inny kształt (temat/odbiorca stałe, bierze
// się z wątku), więc nie ma po co wciskać ich w ten sam komponent.
import { useState } from "react";
import { SIGNATURE_LANGS, SIGNATURE_LANG_LABEL, type SignatureLang } from "./shared";
import { RecipientField, useMailContacts } from "./RecipientPicker";
import { TemplatePickerButton, useMailTemplates, type MailTemplate } from "./TemplatePickerButton";
import { useUndoSend } from "./useUndoSend";
import { useUI } from "../ui";

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
  const [to, setTo] = useState(initialTo);
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(initialSubject);
  const [text, setText] = useState("");
  const [podpis, setPodpis] = useState<SignatureLang | null>("pl");
  const { countdown, start, cancel, sending } = useUndoSend();

  const applyTemplate = (t: MailTemplate) => {
    setText((prev) => (prev.trim() ? `${prev}\n\n${t.tresc}` : t.tresc));
    if (mode === "compose" && t.temat && !subject.trim()) setSubject(t.temat);
  };

  const submit = () => {
    if (!to.trim()) {
      toast("Podaj adres odbiorcy.", "error");
      return;
    }
    if (!text.trim() && mode === "compose") {
      toast("Treść wiadomości nie może być pusta.", "error");
      return;
    }
    start(async () => {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, cc, subject, text, podpis }),
      });
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
      onClose();
    });
  };

  return (
    <div className="card-paper max-h-[85vh] overflow-y-auto rounded-2xl border hairline p-6 sm:p-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium">{mode === "forward" ? "Przekaż wiadomość" : "Nowa wiadomość"}</h2>
        <button onClick={onClose} className="rounded-full px-2 py-0.5 text-lg leading-none text-muted hover:text-[var(--fg)]" aria-label="Zamknij">
          ×
        </button>
      </div>

      <div className="space-y-2">
        <RecipientField value={to} onChange={setTo} contacts={contacts} placeholder="Do: adres@domena.pl" />
        <RecipientField value={cc} onChange={setCc} contacts={contacts} placeholder="DW (opcjonalnie, adresy po przecinku)" multiple />
        {mode === "compose" && (
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Temat"
            className="w-full rounded-xl border hairline bg-transparent px-3 py-2 text-[13px] outline-none focus:border-brand-purple/50"
          />
        )}
        {hint && <p className="text-[12px] text-muted opacity-70">{hint}</p>}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          autoFocus
          placeholder={mode === "forward" ? "Komentarz (opcjonalnie)…" : "Treść wiadomości…"}
          className="w-full rounded-xl border hairline bg-transparent p-3 text-[13px] outline-none focus:border-brand-purple/50"
        />

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
            className={`rounded-full px-2.5 py-0.5 transition ${podpis === null ? "bg-[var(--hairline)] font-medium" : "text-muted hover:text-[var(--fg)]"}`}
          >
            Bez podpisu
          </button>
          <span className="ml-auto">
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
              <button onClick={submit} className="btn-primary rounded-full px-4 py-1.5 text-[13px]">
                {mode === "forward" ? "Przekaż" : "Wyślij"}
              </button>
              <button onClick={onClose} className="rounded-full px-3 py-1.5 text-[13px] text-muted hover:text-[var(--fg)]">
                Anuluj
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
