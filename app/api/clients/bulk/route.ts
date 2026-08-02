import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureClientsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { odczytajPotwierdzenie, odmowaPotwierdzenia } from "@/lib/nieodwracalne";
import { CLIENT_STATUSES } from "@/lib/clients";
import { logFieldChangesBatch, deleteFieldChangesBatch } from "@/lib/auditLog";

export const runtime = "nodejs";

/**
 * Operacje masowe na klientach (Moduł 54, krok 3b).
 *
 * Do 2026-07-26 pasek zaznaczenia w `ClientsDashboard` wołał `PATCH`/`DELETE`
 * po jednym na klienta — przy 50 zaznaczonych to 50 rund HTTP z przeglądarki,
 * a że `neon()` płaci własną rundę za KAŻDE zapytanie SQL, koszt mnożył się
 * jeszcze raz po stronie serwera.
 *
 * Tu jest to trzy zapytania niezależnie od liczby zaznaczonych: stan sprzed
 * zapisu, `UPDATE ... WHERE id = ANY`, wsadowy audyt.
 */

/** Ile rekordów wolno ruszyć jedną operacją. Zaznaczenie w panelu bierze się
 * z widocznej listy, więc realnie to dziesiątki — limit jest bezpiecznikiem
 * przed żądaniem sklejonym ręcznie, nie ograniczeniem pracy. */
const BULK_LIMIT = 500;

/** Pola przyjmowane wsadowo — świadomie WĄSKA lista, nie kopia wszystkich
 * dwudziestu gałęzi z `PATCH /api/clients/:id`.
 *
 * Wsadowo zmienia się to, co ma sens dla wielu rekordów naraz: status (pasek
 * zaznaczenia) i kategoria źródła (auto-porządkowanie `tidySources`). Adres,
 * notatki czy daty kontaktu są z definicji per klient — gdyby kiedyś doszło
 * pole, dopisz je TUTAJ razem z jego limitem długości, a nie w wywołaniu. */
const BULK_FIELDS: Record<string, { max: number; oneOf?: readonly string[] }> = {
  status: { max: 50, oneOf: CLIENT_STATUSES },
  zrodlo_kategoria: { max: 100 },
  branza: { max: 200 },
  next_action: { max: 500 },
};

/** Wyciąga i sprawdza listę id z ciała żądania. */
function readIds(body: Record<string, unknown> | null): string[] | null {
  if (!body || !Array.isArray(body.ids)) return null;
  const ids = body.ids.filter((v): v is string => typeof v === "string" && v.length > 0);
  if (ids.length === 0 || ids.length > BULK_LIMIT) return null;
  return [...new Set(ids)];
}

/** PATCH /api/clients/bulk — ustawia te same pola na wielu klientach.
 * Ciało: `{ ids: string[], pola: Record<string, string> }`. */
export async function PATCH(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const ids = readIds(body);
  if (!ids) return NextResponse.json({ error: "invalid ids" }, { status: 400 });

  const pola = (body?.pola ?? {}) as Record<string, unknown>;
  // Walidacja PRZED zapisem — tak jak w PATCH-u pojedynczego klienta log ma
  // zawierać wartość, którą baza faktycznie przyjęła, a nie tę z żądania.
  const applied: Record<string, string> = {};
  for (const [field, spec] of Object.entries(BULK_FIELDS)) {
    if (!(field in pola)) continue;
    const raw = typeof pola[field] === "string" ? (pola[field] as string).slice(0, spec.max) : "";
    if (spec.oneOf && !spec.oneOf.includes(raw)) {
      return NextResponse.json({ error: `invalid ${field}` }, { status: 400 });
    }
    applied[field] = raw;
  }
  const fields = Object.keys(applied);
  if (fields.length === 0) return NextResponse.json({ error: "no fields" }, { status: 400 });

  await ensureClientsSchema();
  const sql = getSql();

  const beforeRows = (await sql`SELECT * FROM clients WHERE id = ANY(${ids}::text[]);`) as unknown as Record<
    string,
    unknown
  >[];
  if (beforeRows.length === 0) return NextResponse.json({ ok: true, updated: 0 });

  // Jeden UPDATE na pole (nie na rekord) — pól jest najwyżej kilka, rekordów
  // dziesiątki. Nazwa kolumny pochodzi wyłącznie z BULK_FIELDS, więc mimo
  // sklejania nie ma tu drogi dla danych z żądania.
  for (const field of fields) {
    switch (field) {
      case "status":
        await sql`UPDATE clients SET status = ${applied.status}, updated_at = now() WHERE id = ANY(${ids}::text[]);`;
        break;
      case "zrodlo_kategoria":
        await sql`UPDATE clients SET zrodlo_kategoria = ${applied.zrodlo_kategoria}, updated_at = now() WHERE id = ANY(${ids}::text[]);`;
        break;
      case "branza":
        await sql`UPDATE clients SET branza = ${applied.branza}, updated_at = now() WHERE id = ANY(${ids}::text[]);`;
        break;
      case "next_action":
        await sql`UPDATE clients SET next_action = ${applied.next_action}, updated_at = now() WHERE id = ANY(${ids}::text[]);`;
        break;
    }
  }

  await logFieldChangesBatch(
    "client",
    beforeRows.map((before) => ({ entityId: String(before.id), before, after: applied }))
  );

  return NextResponse.json({ ok: true, updated: beforeRows.length });
}

/** DELETE /api/clients/bulk — usuwa wielu klientów naraz. Ciało: `{ ids }`.
 *
 * Reguły te same, co przy pojedynczym usuwaniu (`/api/clients/:id`): powiązane
 * oferty/faktury/projekty zostają, tylko odpięte (`ON DELETE SET NULL`), a
 * audyt zmian kasujemy jawnie, bo `field_changes` nie ma klucza obcego i
 * zostałyby w nim surowe e-maile usuniętych klientów (RODO, Audyt 2). */
export async function DELETE(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const ids = readIds(body);
  if (!ids) return NextResponse.json({ error: "invalid ids" }, { status: 400 });

  // POTWIERDZENIE (Faza 4), poziom „mocne" — przepisuje się LICZBĘ
  // zaznaczonych. Przy masowym usuwaniu realne ryzyko nie polega na tym, że
  // ktoś pomyli klienta, tylko na tym, że nie zauważy, ilu ich zaznaczył.
  const odmowaPotw = odmowaPotwierdzenia("klienci-usun-masowo", odczytajPotwierdzenie(req.headers), String(ids.length));
  if (odmowaPotw) {
    return NextResponse.json({ error: odmowaPotw.error, potwierdzenie: odmowaPotw.potwierdzenie }, { status: odmowaPotw.status });
  }

  await ensureClientsSchema();
  const sql = getSql();
  await sql`DELETE FROM clients WHERE id = ANY(${ids}::text[]);`;
  await deleteFieldChangesBatch("client", ids);
  return NextResponse.json({ ok: true, deleted: ids.length });
}
