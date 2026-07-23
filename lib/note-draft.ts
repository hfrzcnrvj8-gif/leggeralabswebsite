// Logika szkiców notatek z maila (Moduł 50) — prompt do modelu tekstowego.
// Model zawsze tylko PROPONUJE treść notatki do zatwierdzenia w małym modalu
// w MailDetailPanel; zapis do Notatnika następuje wyłącznie po ręcznym
// kliknięciu „Zapisz notatkę" (patrz CLAUDE.md,
// docs/plany-modulow/50-ai-szkic-notatki.md). Świadomie tylko źródło „mail" —
// notatka z rozmowy telefonicznej zostaje poza zakresem v1 (brak transkrypcji).

import type { MailDraftClientContext } from "./mail-draft";

export type { MailDraftClientContext };

/** Ten sam model co szkice odpowiedzi (Moduł 7) i podsumowania wątku
 * (Moduł 49) — jakość polskiej prozy ma tu podobne znaczenie, funkcja też
 * jest klikana pojedynczo, nie w pętli. */
export const NOTE_DRAFT_MODEL = "qwen3.6:27b";

export const NOTE_DRAFT_SYSTEM = `Jesteś asystentem piszącym PO POLSKU krótkie notatki do CRM dla Patryka, prowadzącego agencję Leggera Labs (AI-automation consultancy).

Zasady:
- Notatka to NIE treść maila przepisana ani streszczona wiadomość po wiadomości — to ISTOTA rozmowy: ustalenia, terminy, kwoty, następne kroki — jeśli faktycznie są w treści.
- Pisz rzeczowo i zwięźle (kilka zdań, nie dłużej niż to konieczne). Pierwsza linijka może pełnić rolę krótkiego tytułu.
- Pisz WYŁĄCZNIE treść notatki — bez nagłówków, bez markdown, bez cudzysłowów wokół całości.
- NIGDY nie zmyślaj faktów (dat, kwot, ustaleń), których nie ma w dostarczonej treści. Czego nie wiesz z maila, pomiń — nie zgaduj.
- To tylko PROPOZYCJA do edycji przez człowieka przed zapisaniem w Notatniku.`;

/** Buduje prompt z maila źródłowego i (jeśli mail jest dopięty) krótkiego
 * kontekstu klienta/leada — ten sam kształt kontekstu co buildDraftPrompt()
 * w lib/mail-draft.ts. Cały kontekst zbiera kod, model nie grzebie sam
 * w bazie. */
export function buildNoteDraftPrompt(opts: { subject: string; bodyText: string; client: MailDraftClientContext | null }): string {
  const parts: string[] = [];
  parts.push(`Temat maila: ${opts.subject || "(bez tematu)"}`);
  parts.push(`Treść maila, z którego ma powstać notatka:\n${opts.bodyText || "(pusta treść)"}`);

  if (opts.client) {
    const c = opts.client;
    const bits = [c.nazwa && `firma: ${c.nazwa}`, c.branza && `branża: ${c.branza}`, c.status && `status: ${c.status}`].filter(Boolean);
    if (bits.length > 0) parts.push(`Kontekst kontaktu: ${bits.join(", ")}.`);
    if (c.ostatniaNotatka) parts.push(`Ostatnia notatka z historii kontaktu: ${c.ostatniaNotatka}`);
  }

  parts.push("Napisz szkic notatki zgodnie z instrukcją systemową.");
  return parts.join("\n\n");
}

/** Sprząta odpowiedź modelu z typowych naleciałości — ten sam wzorzec co
 * cleanDraftText() w lib/mail-draft.ts i cleanSummaryText() w
 * lib/mail-summary.ts. Nigdy nie rzuca. */
export function cleanNoteDraftText(raw: string): string {
  let text = raw.trim();
  text = text
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/```$/, "")
    .trim();
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    text = text.slice(1, -1).trim();
  }
  return text;
}
