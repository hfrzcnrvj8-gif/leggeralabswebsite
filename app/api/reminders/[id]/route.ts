import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureRemindersSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";
import { isPlausibleTimeString, normalizePriority } from "@/lib/reminders";

export const runtime = "nodejs";

/** PATCH /api/reminders/:id — zmiana pól, pole po polu. Admin-only. */
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

  await ensureRemindersSchema();
  const sql = getSql();

  if ("tytul" in body) {
    const tytul = typeof body.tytul === "string" ? body.tytul.trim() : "";
    if (!tytul) {
      return NextResponse.json({ error: "tytul must not be empty" }, { status: 400 });
    }
    await sql`UPDATE reminders SET tytul = ${tytul.slice(0, 300)} WHERE id = ${id};`;
  }
  if ("notatka" in body) {
    const value = typeof body.notatka === "string" ? body.notatka.slice(0, 2000) : "";
    await sql`UPDATE reminders SET notatka = ${value} WHERE id = ${id};`;
  }
  if ("termin" in body) {
    const raw = body.termin;
    if (typeof raw === "string" && raw.trim()) {
      const trimmed = raw.trim();
      if (!isPlausibleDateString(trimmed)) {
        return NextResponse.json({ error: "invalid termin" }, { status: 400 });
      }
      await sql`UPDATE reminders SET termin = ${trimmed} WHERE id = ${id};`;
    } else {
      // Zdjęcie terminu zabiera ze sobą godzinę — patrz komentarz w POST.
      await sql`UPDATE reminders SET termin = NULL, godzina = NULL WHERE id = ${id};`;
    }
  }
  if ("godzina" in body) {
    const raw = body.godzina;
    if (typeof raw === "string" && raw.trim()) {
      const trimmed = raw.trim();
      if (!isPlausibleTimeString(trimmed)) {
        return NextResponse.json({ error: "invalid godzina" }, { status: 400 });
      }
      // Godzina tylko na przypomnieniu, które ma termin — inaczej cicho
      // powstaje „14:00 nigdy".
      await sql`UPDATE reminders SET godzina = ${trimmed} WHERE id = ${id} AND termin IS NOT NULL;`;
    } else {
      await sql`UPDATE reminders SET godzina = NULL WHERE id = ${id};`;
    }
  }
  if ("priorytet" in body) {
    await sql`UPDATE reminders SET priorytet = ${normalizePriority(body.priorytet)} WHERE id = ${id};`;
  }
  if ("ukonczone" in body) {
    // `ukonczone_at` ustawia SERWER, nie klient — data odhaczenia ma być
    // faktem z jednego zegara, a nie tym, co pokazuje telefon.
    const value = body.ukonczone === true;
    await sql`
      UPDATE reminders
      SET ukonczone = ${value}, ukonczone_at = ${value ? "now()" : null}::timestamptz
      WHERE id = ${id};
    `;
  }
  for (const kolumna of ["lista_id", "lead_id", "client_id", "project_id"] as const) {
    if (kolumna in body) {
      const raw = body[kolumna];
      const value = typeof raw === "string" && raw.trim() ? raw : null;
      if (kolumna === "lista_id") {
        await sql`UPDATE reminders SET lista_id = ${value} WHERE id = ${id};`;
      } else if (kolumna === "lead_id") {
        await sql`UPDATE reminders SET lead_id = ${value} WHERE id = ${id};`;
      } else if (kolumna === "client_id") {
        await sql`UPDATE reminders SET client_id = ${value} WHERE id = ${id};`;
      } else {
        await sql`UPDATE reminders SET project_id = ${value} WHERE id = ${id};`;
      }
    }
  }

  return NextResponse.json({ ok: true });
}

/** DELETE /api/reminders/:id — usuwa przypomnienie. Admin-only. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await ensureRemindersSchema();
  const sql = getSql();
  await sql`DELETE FROM reminders WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
