// Logika szkiców odpowiedzi mailowych (Moduł 7) — prompt do modelu tekstowego
// i sprzątanie jego odpowiedzi. Model zawsze tylko PROPONUJE treść do pola
// odpowiedzi w MailDetailPanel; właściciel poprawia/zatwierdza/wysyła ręcznie
// (patrz CLAUDE.md, docs/plany-modulow/07-ai-szkice-mailowe.md).

/** Model do szkiców — wybrany 2026-07-16 z listy modeli tekstowych
 * zainstalowanych na Macu właściciela: największy z rodziny "qwen3.x" poza
 * wariantami wizyjnymi (qwen2.5vl/qwen3-vl, patrz OCR_MODEL w
 * lib/costs-ocr.ts), coderem i embeddingami. Przy szkicu maila jakość
 * polskiej prozy ma większe znaczenie niż przy OCR-owym odczycie pól, a
 * funkcja jest klikana pojedynczo (nie w pętli), więc większy/wolniejszy
 * model jest tu uzasadniony. */
export const DRAFT_MODEL = "qwen3.6:27b";

export type MailDraftClientContext = {
  nazwa: string;
  branza: string;
  status: string;
  ostatniaNotatka: string | null;
};

export const DRAFT_SYSTEM = `Jesteś asystentem piszącym PO POLSKU szkice odpowiedzi na maile w imieniu Patryka, prowadzącego agencję Leggera Labs (AI-automation consultancy).

Zasady:
- Ton: rzeczowy i uprzejmy. Długość: dopasowana do treści maila, na który odpowiadasz — krótkie pytanie zasługuje na krótką odpowiedź, dłuższe/wieloczęściowe pytanie na odpowiednio dłuższą.
- Pisz WYŁĄCZNIE treść odpowiedzi — bez tematu, bez nagłówków, bez markdown, bez cudzysłowów wokół całości.
- Możesz zacząć od naturalnego zwrotu powitalnego, ale NIE dodawaj na końcu formalnego zamknięcia z podpisem/imieniem nadawcy — podpis dokleja się do wiadomości osobno, poza tym tekstem.
- NIGDY nie zmyślaj faktów (dat, kwot, ustaleń, obietnic), których nie ma w dostarczonym kontekście. Jeśli odpowiedź wymagałaby szczegółu, którego nie znasz z kontekstu, napisz wprost, że trzeba to sprawdzić/dopytać, zamiast zgadywać.
- To tylko PROPOZYCJA do edycji przez człowieka przed wysłaniem.`;

/** Buduje prompt użytkownika z maila źródłowego i (jeśli mail jest dopięty)
 * krótkiego kontekstu klienta/leada — cały kontekst zbiera kod, model nie
 * grzebie sam w bazie. */
export function buildDraftPrompt(opts: { subject: string; bodyText: string; client: MailDraftClientContext | null }): string {
  const parts: string[] = [];
  parts.push(`Temat maila: ${opts.subject || "(bez tematu)"}`);
  parts.push(`Treść maila, na który odpowiadasz:\n${opts.bodyText || "(pusta treść)"}`);

  if (opts.client) {
    const c = opts.client;
    const bits = [c.nazwa && `firma: ${c.nazwa}`, c.branza && `branża: ${c.branza}`, c.status && `status: ${c.status}`].filter(Boolean);
    if (bits.length > 0) parts.push(`Kontekst kontaktu: ${bits.join(", ")}.`);
    if (c.ostatniaNotatka) parts.push(`Ostatnia notatka z historii kontaktu: ${c.ostatniaNotatka}`);
  }

  parts.push("Napisz szkic odpowiedzi zgodnie z instrukcją systemową.");
  return parts.join("\n\n");
}

/** Sprząta odpowiedź modelu z typowych naleciałości — mimo instrukcji model
 * czasem i tak owija całość w blok ``` albo cudzysłów. Nigdy nie rzuca. */
export function cleanDraftText(raw: string): string {
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
