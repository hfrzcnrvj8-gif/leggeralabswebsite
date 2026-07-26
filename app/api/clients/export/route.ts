import { NextResponse } from "next/server";
import { getSql, ensureClientsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { toCsv } from "@/lib/export";
import { todayLocalISO } from "@/lib/dates";

export const runtime = "nodejs";

/** GET /api/clients/export — CSV rejestru klientów.
 *
 * Bez zakresu dat, cały rejestr na raz — jak `leads/export`, nie jak
 * `invoices/export`. Faktury i koszty mają zakres, bo księgowa rozlicza
 * miesiąc; rejestru klientów się nie rozlicza, tylko przegląda. Do tego
 * `ostatni_kontakt` i `next_followup` są opcjonalne, więc filtrowanie po
 * którejkolwiek dacie po cichu gubiłoby klientów, z którymi jeszcze nie było
 * kontaktu — a eksport, który bez ostrzeżenia gubi wiersze, jest gorszy niż
 * brak eksportu, bo się mu ufa. */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureClientsSchema();
  const sql = getSql();

  const rows = await sql`
    SELECT nazwa, osoba_kontaktowa, nip, branza, telefon, email, www, linkedin_url,
      ulica, kod, miasto, kraj, status, zrodlo_kategoria, zrodlo,
      ostatni_kontakt, next_followup, next_action, notatki
    FROM clients ORDER BY nazwa ASC;
  `;

  // „Osoba kontaktowa" i źródło dołożone 2026-07-26. Oba stały się polami
  // pierwszej kategorii przy audycie Klientów (osoba wita adresata w mailu
  // retencyjnym, źródło mówi, czy pętla poleceń działa), a eksport — jedyna
  // droga do wyniesienia rejestru poza panel — o obu milczał.
  const header = [
    "Nazwa", "Osoba kontaktowa", "NIP", "Branża", "Telefon", "Email", "WWW", "LinkedIn",
    "Ulica", "Kod", "Miasto", "Kraj", "Status", "Kategoria źródła", "Źródło",
    "Ostatni kontakt", "Następny kontakt", "Następny krok", "Notatki",
  ];
  const body = rows.map((r) => [
    String(r.nazwa ?? ""),
    String(r.osoba_kontaktowa ?? ""),
    String(r.nip ?? ""),
    String(r.branza ?? ""),
    String(r.telefon ?? ""),
    String(r.email ?? ""),
    String(r.www ?? ""),
    String(r.linkedin_url ?? ""),
    String(r.ulica ?? ""),
    String(r.kod ?? ""),
    String(r.miasto ?? ""),
    String(r.kraj ?? ""),
    String(r.status ?? ""),
    String(r.zrodlo_kategoria ?? ""),
    String(r.zrodlo ?? ""),
    String(r.ostatni_kontakt ?? "").slice(0, 10),
    String(r.next_followup ?? "").slice(0, 10),
    String(r.next_action ?? ""),
    String(r.notatki ?? ""),
  ]);

  const csv = toCsv([header, ...body]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="klienci_${todayLocalISO()}.csv"`,
    },
  });
}
