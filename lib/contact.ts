// Wspólny rejestr kanałów kontaktu — używany zarówno przez leady, jak i
// klientów (lib/leads.ts, lib/clients.ts, ich shared.tsx). Moduł 3 (kanały
// kontaktu, docs/plany-modulow/03-kanaly-kontaktu.md): panel NIE wysyła nic
// sam — daje tylko rejestr (kanał + kierunek wpisu na osi) i odnośniki
// tel:/mailto:/wa.me/LinkedIn, które na telefonie otwierają właściwą
// aplikację. Zero AI, zero bramki SMS/WhatsApp Business API.

export const CONTACT_CHANNELS = ["telefon", "email", "whatsapp", "linkedin", "spotkanie", "inne"] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

export const CONTACT_CHANNEL_LABEL: Record<ContactChannel, string> = {
  telefon: "Telefon",
  email: "Email",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
  spotkanie: "Spotkanie",
  inne: "Inne",
};

export const CONTACT_CHANNEL_ICON: Record<ContactChannel, string> = {
  telefon: "📞",
  email: "✉️",
  whatsapp: "💬",
  linkedin: "🔗",
  spotkanie: "🤝",
  inne: "📝",
};

/** Kierunek wpisu na osi — kto zainicjował ten konkretny kontakt. Dzięki
 * temu reguła "czeka na odpowiedź" (patrz isOverdue w lib/leads.ts) działa
 * tak samo dla telefonu/WhatsAppu jak dziś dla maila, niezależnie od kanału. */
export const CONTACT_DIRECTIONS = ["wychodzacy", "przychodzacy"] as const;
export type ContactDirection = (typeof CONTACT_DIRECTIONS)[number];

export const CONTACT_DIRECTION_LABEL: Record<ContactDirection, string> = {
  wychodzacy: "Ja → oni",
  przychodzacy: "Oni → ja",
};

/** Zwraca link https://wa.me/<numer> dla danego numeru telefonu, albo null
 * gdy numeru nie da się jednoznacznie znormalizować — w takim wypadku UI po
 * prostu nie pokazuje przycisku WhatsApp zamiast zgadywać błędny numer.
 * Numer 9-cyfrowy bez prefiksu traktujemy jako krajowy (+48, decyzja
 * właściciela 2026-07-13 — większość danych startowych to firmy w PL). */
export function waLink(telefon: string): string | null {
  const raw = (telefon || "").trim();
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return null;

  if (digits.startsWith("+")) {
    const n = digits.slice(1);
    return /^\d{8,15}$/.test(n) ? `https://wa.me/${n}` : null;
  }
  if (digits.startsWith("00")) {
    const n = digits.slice(2);
    return /^\d{8,15}$/.test(n) ? `https://wa.me/${n}` : null;
  }
  const bare = digits.replace(/^0+/, "");
  if (/^\d{9}$/.test(bare)) return `https://wa.me/48${bare}`;
  if (/^\d{10,15}$/.test(bare)) return `https://wa.me/${bare}`;
  return null;
}

/** Dokłada https:// do zapisanego linku LinkedIn, jeśli go brakuje — właściciel
 * wpisuje często sam "linkedin.com/in/..." bez protokołu. Puste pole = brak
 * linku, UI po prostu nie pokazuje przycisku. */
export function linkedinLink(url: string): string | null {
  const t = (url || "").trim();
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}
