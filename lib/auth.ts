import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";

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
  const expected = sessionToken();
  if (!expected) return false;
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return safeEqual(token, expected);
}
