// Logika podsumowania wątku poczty (Moduł 49) — prompt do modelu tekstowego.
// Model zawsze tylko PROPONUJE streszczenie do przeczytania w MailDetailPanel;
// niczego nie wysyła, niczego nie zapisuje (patrz CLAUDE.md,
// docs/plany-modulow/49-ai-podsumowanie-watku.md).

// Ten sam model co szkice odpowiedzi (Moduł 7) — jakość polskiej prozy ma tu
// podobne znaczenie, funkcja też jest klikana pojedynczo, nie w pętli.
export const SUMMARY_MODEL = "qwen3.6:27b";

export type ThreadSummaryMessage = {
  fromName: string;
  kierunek: string;
  receivedAt: string;
  bodyText: string;
};

export const SUMMARY_SYSTEM = `Jesteś asystentem streszczającym PO POLSKU wątek mailowy dla Patryka, prowadzącego agencję Leggera Labs (AI-automation consultancy).

Zasady:
- Napisz krótkie streszczenie (kilka zdań) skupione na AKTUALNYM STANIE rozmowy: na czym stanęło, jakie ustalenia zapadły, jakie pytania/sprawy są wciąż otwarte. NIE relacjonuj wątku wiadomość po wiadomości.
- Pisz WYŁĄCZNIE treść streszczenia — bez nagłówków, bez markdown, bez cudzysłowów wokół całości.
- NIGDY nie zmyślaj faktów (dat, kwot, ustaleń), których nie ma w treści wiadomości. Czego nie wiesz z dostarczonej treści, pomiń — nie zgaduj.
- To tylko PROPOZYCJA do przeczytania — nic w tym wątku nie zostanie wysłane ani zapisane na podstawie Twojej odpowiedzi.`;

/** Buduje prompt z chronologicznej listy wiadomości wątku — cały kontekst
 * zbiera kod, model nie grzebie sam w bazie. */
export function buildSummaryPrompt(messages: ThreadSummaryMessage[]): string {
  const parts: string[] = ["Wątek mailowy (od najstarszej wiadomości):"];
  for (const m of messages) {
    const who = m.kierunek === "out" ? "Ty (Patryk)" : m.fromName || "Kontakt";
    parts.push(`--- ${who}, ${m.receivedAt} ---\n${m.bodyText || "(pusta treść)"}`);
  }
  parts.push("Napisz streszczenie zgodnie z instrukcją systemową.");
  return parts.join("\n\n");
}

/** Sprząta odpowiedź modelu z typowych naleciałości (blok ``` / cudzysłów
 * wokół całości) — ten sam wzorzec co cleanDraftText() w lib/mail-draft.ts.
 * Nigdy nie rzuca. */
export function cleanSummaryText(raw: string): string {
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
