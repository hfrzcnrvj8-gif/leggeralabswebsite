// Czysta logika OCR wizytówek (Faza 13.2 #1) — prompt do modelu wizyjnego i
// walidacja jego odpowiedzi. Model zawsze tylko PROPONUJE wartości do
// formularza nowego leada; właściciel edytuje/zatwierdza/zapisuje ręcznie
// (patrz CLAUDE.md — jedyny dopuszczony wyjątek od "zero AI w logice panelu",
// ta sama zasada co przy paragonach: lib/costs-ocr.ts).

/** Ten sam model wizyjny co przy paragonach — najmniejszy/najszybszy dostępny
 * na Macu właściciela (patrz HUB_SETUP.md → "Infrastruktura AI"). */
export const CARD_MODEL = "qwen3-vl:8b";

export const CARD_SYSTEM = `Jesteś asystentem odczytującym dane z wizytówki (business card) ze zdjęcia.
Zwróć WYŁĄCZNIE czysty JSON (bez markdown, bez komentarzy, bez dodatkowego tekstu) o dokładnie takim kształcie:
{"firma": string, "osoba": string, "stanowisko": string, "telefon": string, "email": string, "www": string}

Zasady:
- "firma": nazwa firmy/organizacji z wizytówki.
- "osoba": imię i nazwisko osoby (bez tytułów zawodowych — te idą do "stanowisko").
- "stanowisko": stanowisko/rola (np. "CEO", "Dyrektor sprzedaży"), jeśli podane.
- "telefon": numer telefonu dokładnie tak, jak wydrukowany (ze spacjami/prefiksem +48). Jeśli jest kilka, wybierz komórkowy/główny.
- "email": adres e-mail dokładnie tak, jak wydrukowany.
- "www": adres strony WWW, jeśli podany (bez "http://").
- Jeśli nie jesteś pewien wartości danego pola, zwróć dla niego pusty string "" — NIGDY nie zgaduj.`;

export const CARD_PROMPT = "Odczytaj dane z załączonej wizytówki i zwróć JSON zgodnie z instrukcją.";

export type CardSuggestion = {
  firma: string;
  osoba: string;
  stanowisko: string;
  telefon: string;
  email: string;
  www: string;
};

/** Parsuje i waliduje surową odpowiedź modelu. Pola, które nie przejdą
 * walidacji, zostają puste zamiast wpisywać śmieciową wartość do formularza —
 * właściciel uzupełnia je ręcznie jak dziś. Nigdy nie rzuca. */
export function parseCardResponse(raw: string): CardSuggestion {
  const empty: CardSuggestion = {
    firma: "",
    osoba: "",
    stanowisko: "",
    telefon: "",
    email: "",
    www: "",
  };

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return empty;

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return empty;
  }
  if (!parsed || typeof parsed !== "object") return empty;
  const obj = parsed as Record<string, unknown>;

  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

  const firma = str(obj.firma, 300);
  const osoba = str(obj.osoba, 200);
  const stanowisko = str(obj.stanowisko, 200);
  const telefon = str(obj.telefon, 100);

  // E-mail akceptowany tylko, gdy wygląda jak adres (jedna @, kropka po niej).
  // Inaczej model "przeczytał" coś, co adresem nie jest — puste pole zamiast śmiecia.
  const emailRaw = str(obj.email, 200);
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw : "";

  // WWW — bez schematu (http/https) i bez końcowego ukośnika, dla spójności.
  const www = str(obj.www, 200).replace(/^https?:\/\//i, "").replace(/\/+$/, "");

  return { firma, osoba, stanowisko, telefon, email, www };
}
