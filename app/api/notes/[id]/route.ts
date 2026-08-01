import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureHubSchema, ensureLinksSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { odczytajTekst, odczytajFlage } from "@/lib/notes";

export const runtime = "nodejs";

/** GET /api/notes/:id — single note. Admin-only.
 *
 * Zasila podstronę `/admin/notes/[id]` (Moduł 26) — ta ładuje jeden rekord po
 * bezpośrednim linku, zamiast ciągnąć całą listę i szukać w niej. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await ensureHubSchema();
  await ensureLinksSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT n.*, p.tytul AS project_tytul, e.data AS event_data, m.subject AS source_mail_subject
    FROM notes n
    LEFT JOIN projects p ON p.id = n.project_id
    LEFT JOIN events e ON e.id = n.event_id
    LEFT JOIN mail_messages m ON m.id = n.source_mail_id
    WHERE n.id = ${id};
  `;
  if (!rows[0]) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ note: rows[0] });
}

/** PATCH /api/notes/:id — update fields. Admin-only.
 *
 * DWUFAZOWY (wzorzec z Modułu 66): najpierw KOMPLET sprawdzeń, dopiero potem
 * zapisy. `neon()` nie ma transakcji, więc atomowość bierze się stąd, że po
 * pierwszym `UPDATE` nie ma już czego odrzucić — inaczej żądanie z dwoma
 * polami, z których drugie jest błędne, zapisywałoby pierwsze i oddawało
 * błąd, a komunikat „nie udało się zapisać" byłby nieprawdą. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  const zle = (error: string) => NextResponse.json({ error }, { status: 400 });

  await ensureHubSchema();
  await ensureLinksSchema();
  const sql = getSql();

  /* ---- FAZA 1: sprawdzenia. Żadnego zapisu poniżej tej linii aż do FAZY 2. */

  // Treść bez przycinania — wcięcia i puste linie są częścią notatki.
  const tytulIn = odczytajTekst(body, "tytul");
  if (tytulIn.rodzaj === "blad") return zle(tytulIn.powod);
  const trescIn = odczytajTekst(body, "tresc", { przytnij: false });
  if (trescIn.rodzaj === "blad") return zle(trescIn.powod);
  const tagiIn = odczytajTekst(body, "tagi");
  if (tagiIn.rodzaj === "blad") return zle(tagiIn.powod);

  const pinnedIn = odczytajFlage(body, "pinned");
  if (pinnedIn.rodzaj === "blad") return zle(pinnedIn.powod);
  const archivedIn = odczytajFlage(body, "archived");
  if (archivedIn.rodzaj === "blad") return zle(archivedIn.powod);

  // Powiązania (Moduł 26). Klient i lead przychodzą razem, jednym obiektem z
  // linkValueFor(), więc ustawiamy oba naraz zamiast per-pole.
  const zmieniaPowiazanie = "client_id" in body || "lead_id" in body;
  let clientId: string | null = null;
  let leadId: string | null = null;
  if (zmieniaPowiazanie) {
    const odczytajRef = (
      pole: "client_id" | "lead_id"
    ): { ok: true; wartosc: string | null } | { ok: false } => {
      const raw = body[pole];
      if (raw === null || raw === undefined || raw === "") return { ok: true, wartosc: null };
      if (typeof raw !== "string") return { ok: false };
      const t = raw.trim();
      return { ok: true, wartosc: t ? t : null };
    };
    const c = odczytajRef("client_id");
    if (!c.ok) return zle("client_id musi być tekstem albo null");
    const l = odczytajRef("lead_id");
    if (!l.ok) return zle("lead_id musi być tekstem albo null");
    clientId = c.wartosc;
    leadId = l.wartosc;

    // Wyłączność egzekwowana NA SERWERZE. `noteLinkValue()` w lib/notes.ts
    // stoi na założeniu, że najwyżej jedno z pól jest niepuste — do audytu
    // 2026-08-02 pilnował tego wyłącznie klient (LinkPicker), więc żądanie
    // z oboma polami naraz zapisywało oba i cicho łamało ten inwariant.
    if (clientId && leadId) {
      return zle("client_id i lead_id wykluczają się — notatka wiąże się z klientem ALBO z leadem");
    }
    // Klucz obcy to nie walidacja: nieistniejące id kończyło się gołym 500
    // (lekcja z Modułu 66). Sprawdzamy SELECT-em, żeby oddać 400 z powodem.
    if (clientId) {
      const rows = await sql`SELECT id FROM clients WHERE id = ${clientId};`;
      if (!rows[0]) return zle("nie ma takiego klienta");
    }
    if (leadId) {
      const rows = await sql`SELECT id FROM leads WHERE id = ${leadId};`;
      if (!rows[0]) return zle("nie ma takiego leada");
    }
  }

  // Notatka musi istnieć — inaczej wszystkie UPDATE-y trafiają w pustkę,
  // a odpowiedź `{"ok":true}` mówi, że zapisano (ta sama cicha odmowa, którą
  // Moduł 66 wyciął przy Przypomnieniach).
  const istnieje = await sql`SELECT id FROM notes WHERE id = ${id};`;
  if (!istnieje[0]) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  /* ---- FAZA 2: zapisy. Od tego miejsca nic nie może już odmówić. */

  if (tytulIn.rodzaj === "ustaw") {
    await sql`UPDATE notes SET tytul = ${tytulIn.wartosc}, updated_at = now() WHERE id = ${id};`;
  }
  if (trescIn.rodzaj === "ustaw") {
    await sql`UPDATE notes SET tresc = ${trescIn.wartosc}, updated_at = now() WHERE id = ${id};`;
  }
  if (tagiIn.rodzaj === "ustaw") {
    await sql`UPDATE notes SET tagi = ${tagiIn.wartosc}, updated_at = now() WHERE id = ${id};`;
  }

  // Bez `updated_at = now()`: zmiana powiązania to porządkowanie, nie praca
  // nad treścią, a sort listy idzie po updated_at — przypięcie klienta nie
  // powinno wypychać notatki na górę.
  if (zmieniaPowiazanie) {
    await sql`UPDATE notes SET client_id = ${clientId}, lead_id = ${leadId} WHERE id = ${id};`;
  }

  if (pinnedIn.rodzaj === "ustaw") {
    await sql`UPDATE notes SET pinned = ${pinnedIn.wartosc} WHERE id = ${id};`;
  }

  // `archived: true/false` w API → znacznik czasu w bazie. Klient nie zna się
  // na zegarze serwera, a data archiwizacji to informacja („kiedy zeszło z
  // biurka"), nie parametr od wołającego.
  if (archivedIn.rodzaj === "ustaw") {
    await sql`UPDATE notes SET archived_at = ${archivedIn.wartosc ? new Date().toISOString() : null} WHERE id = ${id};`;
  }

  return NextResponse.json({ ok: true });
}

/** DELETE /api/notes/:id — remove a note. Admin-only.
 *
 * Zostaje mimo archiwum (decyzja właściciela 2026-07-17: „oba, archiwum
 * główne, usuwanie w tle") — w UI dostępne dopiero z zakładki Archiwum. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await ensureHubSchema();
  const sql = getSql();
  // `RETURNING id` zamiast kasowania na ślepo: bez tego usunięcie czegoś,
  // czego nie ma, wyglądało w UI identycznie jak usunięcie udane — więc
  // zdublowana zakładka i stary link nie miały jak się pokazać (to samo
  // domknęły Katalog i Koszty). Liczba wierszy zamiast `rowCount`, bo
  // `neon()` oddaje zwykłą tablicę.
  const usuniete = await sql`DELETE FROM notes WHERE id = ${id} RETURNING id;`;
  if (!usuniete[0]) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
