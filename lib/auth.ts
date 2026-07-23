import { cookies, headers } from "next/headers";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { getSql, ensureDeviceTokensSchema } from "./db";

const COOKIE_NAME = "leggera_admin_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function sessionToken(): string | null {
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!password || !secret) return null;
  return createHash("sha256").update(`${password}:${secret}`).digest("hex");
}

/** Compares a submitted password against ADMIN_PASSWORD, timing-safe. */
export function checkPassword(input: string): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || !input) return false;
  return safeEqual(input, password);
}

export async function createSession(): Promise<void> {
  const token = sessionToken();
  if (!token) return;
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

/**
 * Specyfikacja ciasteczka sesji do ustawienia BEZPOŚREDNIO na odpowiedzi
 * (`res.cookies.set(...)`) — używa jej trasa `/api/admin/wejscie`, która
 * uwierzytelnia aplikację iPada tokenem urządzenia i wpuszcza ją do panelu
 * webowego (WKWebView) z ustawionym ciasteczkiem. `createSession()` robi to
 * samo przez `next/headers`, ale przy przekierowaniu pewniej jest ustawić
 * ciasteczko wprost na obiekcie odpowiedzi. `null`, gdy brak konfiguracji.
 */
export function sessionCookie(): {
  name: string;
  value: string;
  options: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax";
    path: string;
    maxAge: number;
  };
} | null {
  const token = sessionToken();
  if (!token) return null;
  return {
    name: COOKIE_NAME,
    value: token,
    options: { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: MAX_AGE_SECONDS },
  };
}

/**
 * ── Tokeny per-urządzenie (Faza 1 aplikacji natywnej, 2026-07-19) ──────────
 *
 * Aplikacja iOS nie ma ciasteczek przeglądarki, więc dostaje własny kanał:
 * losowy token per-urządzenie w nagłówku `Authorization: Bearer <token>`.
 * Decyzja właściciela: per-urządzenie Z MOŻLIWOŚCIĄ ODEBRANIA — zgubiony
 * telefon odcina się jednym kliknięciem w panelu, bez zmiany hasła.
 *
 * W bazie leży wyłącznie SHA-256 tokenu (wyciek bazy nie wycieka tokenów);
 * pełną wartość widzi tylko urządzenie, jednorazowo w odpowiedzi logowania.
 * Panel webowy działa jak dotąd — ciasteczko pozostaje nietknięte.
 */

function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Tworzy token dla nowego urządzenia. Zwracany `token` pokazuje się TYLKO
 * raz — dalej istnieje już wyłącznie jego hash. */
export async function createDeviceToken(deviceName: string): Promise<{ id: string; token: string }> {
  await ensureDeviceTokensSchema();
  const sql = getSql();
  const id = randomUUID();
  const token = randomBytes(32).toString("hex");
  await sql`
    INSERT INTO device_tokens (id, token_hash, device_name)
    VALUES (${id}, ${hashDeviceToken(token)}, ${deviceName});
  `;
  return { id, token };
}

function bearerFromHeader(authorization: string | null): string | null {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

/** Sprawdza token z nagłówka i przy okazji odnotowuje użycie (jedno
 * zapytanie — neon() płaci żądaniem HTTP za każde, więc nie rozdzielamy). */
async function bearerAuthed(token: string): Promise<boolean> {
  await ensureDeviceTokensSchema();
  const sql = getSql();
  const rows = await sql`
    UPDATE device_tokens SET last_used_at = now()
    WHERE token_hash = ${hashDeviceToken(token)} AND revoked_at IS NULL
    RETURNING id;
  `;
  return rows.length > 0;
}

/** Unieważnia token niesiony w bieżącym żądaniu (wylogowanie z urządzenia). */
export async function revokeCurrentDeviceToken(): Promise<void> {
  const hdrs = await headers();
  const token = bearerFromHeader(hdrs.get("authorization"));
  if (!token) return;
  await ensureDeviceTokensSchema();
  const sql = getSql();
  await sql`UPDATE device_tokens SET revoked_at = now() WHERE token_hash = ${hashDeviceToken(token)};`;
}

export async function isAuthed(): Promise<boolean> {
  // Dev-only obejście logowania — POTRÓJNIE zabezpieczone, żeby nigdy nie
  // zadziałało na produkcji: (1) NODE_ENV musi być "development" (Vercel
  // zawsze ustawia "production"), (2) jawna zgoda przez DEV_ADMIN_BYPASS=1,
  // (3) ta zmienna żyje tylko w .env.local, który jest w .gitignore i nie
  // jest deployowany. Pozwala widzieć zalogowany panel na localhost bez
  // hasła — samo logowanie na http://localhost i tak nie działa, bo cookie
  // sesji ma secure:true (wymaga HTTPS).
  if (process.env.NODE_ENV === "development" && process.env.DEV_ADMIN_BYPASS === "1") {
    return true;
  }
  // Klient natywny: nagłówek `Authorization: Bearer` (tokeny per-urządzenie,
  // patrz sekcja niżej). Sprawdzany PRZED ciasteczkiem, ale tylko gdy w ogóle
  // jest — przeglądarka go nie wysyła, więc panel webowy nie płaci ani jednym
  // dodatkowym zapytaniem do bazy.
  const hdrs = await headers();
  const bearer = bearerFromHeader(hdrs.get("authorization"));
  if (bearer) return bearerAuthed(bearer);

  const expected = sessionToken();
  if (!expected) return false;
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return safeEqual(token, expected);
}
