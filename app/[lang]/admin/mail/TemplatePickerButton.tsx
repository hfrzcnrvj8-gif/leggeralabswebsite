"use client";

// Etap 1 Modułu 4b — szablony wiadomości (Superhuman Snippets). Wzorem
// dropdownu szablonów ofert w OfferEditor.tsx: Popover z listą, kliknięcie
// wstawia gotową treść (i temat, jeśli pole na niego przyjmuje).
import { useEffect, useState } from "react";
import { Popover } from "../Menu";

export type MailTemplate = { id: string; nazwa: string; temat: string; tresc: string };

export function useMailTemplates(): MailTemplate[] | null {
  const [templates, setTemplates] = useState<MailTemplate[] | null>(null);
  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/mail-templates");
      if (res.ok) setTemplates(((await res.json()) as { templates: MailTemplate[] }).templates);
    })();
  }, []);
  return templates;
}

export function TemplatePickerButton({ templates, onPick }: { templates: MailTemplate[] | null; onPick: (t: MailTemplate) => void }) {
  if (!templates || templates.length === 0) return null;
  return (
    <Popover
      width={260}
      trigger={(open) => (
        <button
          type="button"
          onClick={open}
          className="rounded-full border hairline px-2.5 py-1 text-[12px] text-muted hover:text-[var(--fg)]"
          title="Wstaw gotowy szablon"
        >
          📄 Szablon
        </button>
      )}
    >
      {(close) => (
        <div className="max-h-72 overflow-y-auto">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                onPick(t);
                close();
              }}
              className="flex w-full flex-col px-2.5 py-1.5 text-left hover:bg-[var(--hairline)]"
            >
              <span className="truncate text-[13px] text-[var(--fg)]">{t.nazwa || "(bez nazwy)"}</span>
              {t.tresc && <span className="truncate text-[11px] text-muted">{t.tresc.slice(0, 80)}</span>}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}
