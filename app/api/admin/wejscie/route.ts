import { NextRequest, NextResponse } from "next/server";
import { isAuthed, sessionCookie } from "@/lib/auth";

/**
 * Mostek uwierzytelnienia dla wbudowanego panelu w aplikacji iPada (hybryda,
 * 2026-07-23). Apka iOS uwierzytelnia się tokenem urządzenia
 * (`Authorization: Bearer`), ale STRONY panelu (HTML, SSR) sprawdzają sesję
 * po CIASTECZKU. WKWebView potrafi ustawić nagłówek tylko na pierwszym żądaniu
 * nawigacji — więc tu, na tym jednym żądaniu, wymieniamy ważny Bearer na
 * ciasteczko sesji i przekierowujemy do celu. Kolejne nawigacje w webview idą
 * już samym ciasteczkiem.
 *
 * Bezpieczeństwo:
 *  - `isAuthed()` sprawdza Bearer PRZED ciasteczkiem (patrz `lib/auth.ts`),
 *    więc bez ważnego tokenu urządzenia zwracamy 401 i niczego nie ustawiamy.
 *  - `cel` jest ograniczony do ścieżek WEWNĄTRZ panelu (`/<lang>/admin...`),
 *    żeby nie dało się zrobić z tego otwartego przekierowania.
 *  - Ciasteczko jest `secure`, więc realnie działa wyłącznie po HTTPS
 *    (produkcja). Na localhost panel i tak wpuszcza DEV_ADMIN_BYPASS.
 */

function bezpiecznyCel(raw: string | null): string {
  const domyslny = "/pl/admin";
  if (!raw) return domyslny;
  // Musi być ścieżką względną (jeden wiodący "/", nie "//" = protocol-relative)
  // i prowadzić do obszaru panelu.
  if (!raw.startsWith("/") || raw.startsWith("//")) return domyslny;
  if (!/^\/[a-z]{2}\/admin(\/|$|\?|#)/.test(raw)) return domyslny;
  return raw;
}

export async function GET(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const cel = bezpiecznyCel(req.nextUrl.searchParams.get("cel"));
  const res = NextResponse.redirect(new URL(cel, req.nextUrl.origin));
  const spec = sessionCookie();
  if (spec) res.cookies.set(spec.name, spec.value, spec.options);
  // Bez pośredniego cache'owania — to jednorazowe wejście uwierzytelniające.
  res.headers.set("Cache-Control", "no-store");
  return res;
}
