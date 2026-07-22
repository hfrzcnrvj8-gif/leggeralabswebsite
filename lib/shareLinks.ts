import { randomUUID } from "crypto";
import type { Sql } from "@/lib/db";

/** Moduł 40 — ręczne unieważnianie publicznych linków.
 *
 * Pięć rodzajów tokenów w linkach wysyłanych mailem (oferta, umowa/NDA,
 * faktura, wezwanie do zapłaty, formularz opinii) jest **wieczne** — to
 * świadoma decyzja właściciela z 2026-07-22 (faktura sprzed dwóch lat ma się
 * dalej otwierać, a link umierający sam generowałby telefony "nie działa mi
 * Pana link"). Zamiast wygasania: ręczny przycisk w panelu, wtedy gdy
 * właściciel wie, że link poszedł nie tam.
 *
 * DWIE ZASADY, KTÓRE ŁATWO ZŁAMAĆ:
 *
 * 1. **Unieważnienie NIE kasuje tokenu.** Pusty `share_token` byłby
 *    nieodróżnialny od "nigdy nie wysłany", a kolejne "Wyślij mailem"
 *    wygenerowałoby nowy przez `ensure*ShareToken()` i **cicho przywróciło
 *    dostęp**. Od tego jest osobna kolumna `*_revoked_at`.
 * 2. **"Wygeneruj nowy" nie może iść przez `ensure*ShareToken()`** — te
 *    zaczynają się od `if (existingToken) return existingToken;`, więc
 *    oddałyby dokładnie ten sam, martwy token. Nowy wpisujemy wprost
 *    `UPDATE`-em, razem z wyzerowaniem `*_revoked_at` w tym samym zapytaniu.
 */

export type ShareLinkKind = "offer" | "contract" | "invoice" | "wezwanie" | "project";

export const SHARE_LINK_KINDS: ShareLinkKind[] = ["offer", "contract", "invoice", "wezwanie", "project"];

export function isShareLinkKind(v: string): v is ShareLinkKind {
  return (SHARE_LINK_KINDS as string[]).includes(v);
}

/** Etykieta rodzaju linku — do komunikatów w panelu i wpisów w logu. */
export const SHARE_LINK_LABEL: Record<ShareLinkKind, string> = {
  offer: "oferty",
  contract: "umowy",
  invoice: "faktury",
  wezwanie: "wezwania do zapłaty",
  project: "formularza opinii",
};

function newToken(): string {
  return randomUUID().replace(/-/g, "");
}

/** Ustawia znacznik unieważnienia. Zwraca `null`, gdy nie ma czego
 * unieważniać (brak rekordu albo link nigdy nie został wygenerowany).
 *
 * SQL rozpisany rodzaj po rodzaju, nie sklejany ze zmiennych: nazwy tabel
 * i kolumn nie przechodzą przez parametry zapytania, a sklejanie stringów
 * w SQL to dokładnie ta klasa błędu, której ten moduł ma pilnować. */
export async function revokeShareLink(sql: Sql, kind: ShareLinkKind, id: string): Promise<{ revokedAt: string } | null> {
  let rows: Record<string, unknown>[];
  switch (kind) {
    case "offer":
      rows = await sql`UPDATE offers SET share_revoked_at = now(), updated_at = now()
        WHERE id = ${id} AND share_token IS NOT NULL RETURNING share_revoked_at AS revoked_at;`;
      break;
    case "contract":
      rows = await sql`UPDATE contracts SET share_revoked_at = now(), updated_at = now()
        WHERE id = ${id} AND share_token IS NOT NULL RETURNING share_revoked_at AS revoked_at;`;
      break;
    case "invoice":
      rows = await sql`UPDATE invoices SET share_revoked_at = now(), updated_at = now()
        WHERE id = ${id} AND share_token IS NOT NULL RETURNING share_revoked_at AS revoked_at;`;
      break;
    case "wezwanie":
      rows = await sql`UPDATE invoices SET wezwanie_share_revoked_at = now(), updated_at = now()
        WHERE id = ${id} AND wezwanie_share_token IS NOT NULL RETURNING wezwanie_share_revoked_at AS revoked_at;`;
      break;
    case "project":
      rows = await sql`UPDATE projects SET review_revoked_at = now(), updated_at = now()
        WHERE id = ${id} AND review_token IS NOT NULL RETURNING review_revoked_at AS revoked_at;`;
      break;
  }
  const revokedAt = rows[0]?.revoked_at;
  if (revokedAt == null) return null;
  // Neon (HTTP) oddaje TIMESTAMPTZ jako tekst, PGlite w dev jako obiekt Date —
  // ujednolicamy do ISO, żeby panel nie dostał "Tue Jul 22 2026 …", z którego
  // formatPlDate() nie wyciągnie daty.
  return { revokedAt: revokedAt instanceof Date ? revokedAt.toISOString() : String(revokedAt) };
}

/** Wpisuje NOWY token i zeruje znacznik unieważnienia — jednym `UPDATE`-em,
 * z pominięciem idempotentnych `ensure*ShareToken()` (patrz zasada 2 wyżej).
 * Zwraca `null`, gdy nie ma takiego rekordu. */
export async function regenerateShareLink(sql: Sql, kind: ShareLinkKind, id: string): Promise<{ token: string } | null> {
  const token = newToken();
  let rows: Record<string, unknown>[];
  switch (kind) {
    case "offer":
      rows = await sql`UPDATE offers SET share_token = ${token}, share_revoked_at = NULL, updated_at = now()
        WHERE id = ${id} RETURNING id;`;
      break;
    case "contract":
      rows = await sql`UPDATE contracts SET share_token = ${token}, share_revoked_at = NULL, updated_at = now()
        WHERE id = ${id} RETURNING id;`;
      break;
    case "invoice":
      rows = await sql`UPDATE invoices SET share_token = ${token}, share_revoked_at = NULL, updated_at = now()
        WHERE id = ${id} RETURNING id;`;
      break;
    case "wezwanie":
      rows = await sql`UPDATE invoices SET wezwanie_share_token = ${token}, wezwanie_share_revoked_at = NULL, updated_at = now()
        WHERE id = ${id} RETURNING id;`;
      break;
    case "project":
      rows = await sql`UPDATE projects SET review_token = ${token}, review_revoked_at = NULL, updated_at = now()
        WHERE id = ${id} RETURNING id;`;
      break;
  }
  if (rows.length === 0) return null;
  return { token };
}

/** Komunikat 410 dla drugiej strony — jeden dla wszystkich pięciu tras, żeby
 * nie rozjechał się między dokumentami. Świadomie mówi, że dokument istnieje
 * (inaczej niż 404), bo odbiorca ma wiedzieć, że nie pomylił adresu. */
export const SHARE_LINK_REVOKED_MESSAGE = "Ten link został unieważniony przez wystawcę.";
