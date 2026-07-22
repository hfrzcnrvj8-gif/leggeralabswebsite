import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureRemindersSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";
import { isPlausibleTimeString, normalizePriority } from "@/lib/reminders";
import { normalizujCykl, pierwszeWystapienieOd } from "@/lib/recurrence";
import { todayLocalISO } from "@/lib/dates";

export const runtime = "nodejs";

/** Przesuwa termin powtarzalnego przypomnienia na kolejne wystąpienie zamiast
 * je gasić. Zwraca `false`, gdy nie ma czego przesuwać — bo przypomnienie nie
 * jest powtarzalne, nie ma terminu, albo seria właśnie się skończyła
 * (`powtarzanie_do` minęło). Wołający wykonuje wtedy zwykłe odhaczenie.
 *
 * Ostatnie wystąpienie serii MA się dać ukończyć na dobre — inaczej zadanie
 * z datą końca nigdy by nie zniknęło z listy, a to jest cichy sposób na to,
 * żeby lista zaczęła kłamać. */
async function przesunSerie(sql: ReturnType<typeof getSql>, id: string): Promise<boolean> {
  const rows = (await sql`
    SELECT termin::text AS termin, powtarzanie,
           powtarzanie_do::text AS powtarzanie_do, powtarzanie_od::text AS powtarzanie_od
    FROM reminders WHERE id = ${id};
  `) as unknown as {
    termin: string | null;
    powtarzanie: string | null;
    powtarzanie_do: string | null;
    powtarzanie_od: string | null;
  }[];
  const r = rows[0];
  if (!r?.termin) return false;
  const cykl = normalizujCykl(r.powtarzanie);
  if (!cykl) return false;

  // Rytm liczymy od KOTWICY, nie od bieżącego terminu — inaczej „co miesiąc
  // od 31." po jednym lutym przykleiłoby się do 28. na zawsze. Kotwicy może
  // brakować przy wierszach sprzed tej migracji; bieżący termin jest wtedy
  // najlepszym, co mamy.
  const kotwica = r.powtarzanie_od ?? r.termin;
  // Odhaczone wystąpienie to `termin`, więc szukamy PO nim — a jeśli zadanie
  // było zaległe, wracamy na najbliższy przyszły punkt rytmu, zamiast od razu
  // podstawiać kolejny przeterminowany dzień.
  const od = r.termin > todayLocalISO() ? r.termin : todayLocalISO();
  const nastepny = pierwszeWystapienieOd(
    { start: kotwica, cykl, doISO: r.powtarzanie_do, pominiete: [r.termin] },
    od
  );
  if (!nastepny) return false;

  await sql`
    UPDATE reminders
    SET termin = ${nastepny}, ukonczone = false, ukonczone_at = NULL
    WHERE id = ${id};
  `;
  return true;
}

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
      // Ręczna zmiana terminu PRZESTAWIA kotwicę serii — właściciel przesuwa
      // rytm, a nie jedno wystąpienie (pojedyncze wystąpienie przesuwa się
      // przez odhaczenie). Bez tego „co miesiąc" po przeniesieniu na inny
      // dzień dalej liczyłoby się od starej daty.
      await sql`
        UPDATE reminders
        SET termin = ${trimmed}, powtarzanie_od = CASE WHEN powtarzanie IS NULL THEN NULL ELSE ${trimmed}::date END
        WHERE id = ${id};
      `;
    } else {
      // Zdjęcie terminu zabiera ze sobą godzinę — patrz komentarz w POST.
      // I cykl: powtarzanie odmierza się OD terminu, więc bez niego zostałaby
      // seria bez punktu zaczepienia.
      await sql`
        UPDATE reminders
        SET termin = NULL, godzina = NULL, powtarzanie = NULL, powtarzanie_do = NULL, powtarzanie_od = NULL
        WHERE id = ${id};
      `;
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

    // Odhaczenie POWTARZALNEGO przypomnienia zamyka WYSTĄPIENIE, nie serię
    // (decyzja właściciela z 2026-07-22, wzorzec Apple Reminders): „rozliczenie
    // z księgową zrobione na lipiec" ≠ „nigdy więcej się nie rozliczam".
    // Zamiast gasić zadanie, przesuwamy `termin` na kolejny cykl i zostawiamy
    // je nieukończone.
    //
    // Decyzja SERWERA, nie klienta — dokładnie tak jak `ukonczone_at`. Panel
    // i apka odhaczają tym samym PATCH-em co dotąd i obie dostają to samo
    // zachowanie, bez powielania reguły w dwóch językach.
    //
    // Przesuwamy od DZISIAJ, nie od starego terminu: zaległe comiesięczne
    // zadanie odhaczone po trzech miesiącach ma wrócić za miesiąc, a nie
    // wyskoczyć od razu z kolejnym zaległym terminem sprzed dwóch miesięcy.
    const przesuniete = value ? await przesunSerie(sql, id) : false;
    if (!przesuniete) {
      await sql`
        UPDATE reminders
        SET ukonczone = ${value}, ukonczone_at = ${value ? "now()" : null}::timestamptz
        WHERE id = ${id};
      `;
    }
  }
  if ("powtarzanie" in body) {
    const cykl = normalizujCykl(body.powtarzanie);
    if (cykl) {
      // Cykl tylko na pozycji z terminem i tylko na najwyższym poziomie —
      // powtarza się całe zadanie, nie krok w jego środku (patrz komentarz
      // przy migracji w `lib/db.ts`). Warunek jest w SQL-u, żeby jedno
      // zapytanie rozstrzygało oba przypadki bez rundy w drugą stronę.
      await sql`
        UPDATE reminders
        SET powtarzanie = ${cykl}, powtarzanie_od = termin
        WHERE id = ${id} AND termin IS NOT NULL AND parent_id IS NULL;
      `;
    } else {
      await sql`
        UPDATE reminders SET powtarzanie = NULL, powtarzanie_do = NULL, powtarzanie_od = NULL WHERE id = ${id};
      `;
    }
  }
  if ("powtarzanie_do" in body) {
    const raw = body.powtarzanie_do;
    if (typeof raw === "string" && raw.trim()) {
      const trimmed = raw.trim();
      if (!isPlausibleDateString(trimmed)) {
        return NextResponse.json({ error: "invalid powtarzanie_do" }, { status: 400 });
      }
      await sql`UPDATE reminders SET powtarzanie_do = ${trimmed} WHERE id = ${id} AND powtarzanie IS NOT NULL;`;
    } else {
      await sql`UPDATE reminders SET powtarzanie_do = NULL WHERE id = ${id};`;
    }
  }
  if ("flaga" in body) {
    await sql`UPDATE reminders SET flaga = ${body.flaga === true} WHERE id = ${id};`;
  }
  if ("przy_wyjsciu" in body) {
    await sql`UPDATE reminders SET przy_wyjsciu = ${body.przy_wyjsciu === true} WHERE id = ${id};`;
  }
  if ("parent_id" in body) {
    const raw = body.parent_id;
    const wartosc = typeof raw === "string" && raw.trim() ? raw : null;
    // Zadanie nie może być swoim własnym rodzicem — jeden warunek chroni przed
    // cyklem, którego reszta kodu (zagnieżdżanie w GET) by nie przeżyła.
    if (wartosc === id) {
      return NextResponse.json({ error: "reminder cannot be its own parent" }, { status: 400 });
    }
    await sql`UPDATE reminders SET parent_id = ${wartosc} WHERE id = ${id};`;
  }
  if ("lokalizacja" in body || "lokalizacja_lat" in body) {
    // Miejsce zapisuje się w KOMPLECIE albo wcale: nazwa bez współrzędnych to
    // notatka, a współrzędne bez nazwy to liczby, których nikt nie przeczyta.
    // Ustawianie ich osobnymi PATCH-ami dawałoby stany pośrednie, w których
    // apka nie wie, czy ma pilnować obszaru.
    const nazwa = typeof body.lokalizacja === "string" && body.lokalizacja.trim()
      ? body.lokalizacja.trim().slice(0, 300)
      : null;
    const liczba = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const lat = liczba(body.lokalizacja_lat);
    const lon = liczba(body.lokalizacja_lon);
    const promien = liczba(body.lokalizacja_promien);
    await sql`
      UPDATE reminders
      SET lokalizacja = ${nazwa},
          lokalizacja_lat = ${nazwa ? lat : null},
          lokalizacja_lon = ${nazwa ? lon : null},
          lokalizacja_promien = ${nazwa && promien !== null ? Math.max(50, Math.min(10000, Math.round(promien))) : null}
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
