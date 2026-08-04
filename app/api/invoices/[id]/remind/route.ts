import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureInvoicesSchema, ensureInvoiceShareToken, ensureInvoiceWezwanieShareToken, logClientEvent, kopertaDokumentu } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import {
  daysOverdue,
  poziomyWindykacji,
  reminderEmailText,
  dunningEmailText,
  dunningReference,
  lateInterestAmount,
  REMINDER_LEVEL_LABEL,
} from "@/lib/invoices";
import { odczytajPotwierdzenie, odmowaPotwierdzenia } from "@/lib/nieodwracalne";

export const runtime = "nodejs";

/** POST /api/invoices/:id/remind — ręczne wysłanie kolejnego kroku
 * eskalacji windykacji, wyzwalane z panelu.
 *
 * Poziom (1 uprzejme / 2 stanowcze / 3 formalne wezwanie do zapłaty) **wybiera
 * właściciel** — od kroku 2 planu `docs/PLAN-PO-DRUGIM-PRZEJSCIU.md`
 * (znalezisko C2, decyzja właściciela 2026-08-04). Panel podpowiada poziom
 * z dni zwłoki i wysyła go, gdy w body nic nie ma (tak wołają starsze wersje
 * apki iOS), ale wolno wskazać dowolny z trzech — byle nie NIŻSZY niż ten,
 * który już wyszedł do klienta. Granicę trzyma `poziomyWindykacji()`, wspólna
 * z panelem, żeby lista w rozwijaczu i to, co przyjmuje trasa, nie mogły się
 * rozjechać.
 *
 * Do 2026-08-04 wyboru nie było: faktura 48 dni po terminie, do której nikt
 * nigdy nie napisał, mogła dostać wyłącznie formalne wezwanie do zapłaty. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await ensureInvoicesSchema();
    const sql = getSql();
    const rows = await sql`
      SELECT i.*, COALESCE(t.brutto, 0)::float8 AS brutto
      FROM invoices i
      LEFT JOIN (
        SELECT invoice_id, SUM(ilosc * cena_netto * (1 - rabat_procent / 100) * (1 + CASE WHEN vat_stawka ~ '^[0-9]+$' THEN vat_stawka::numeric / 100 ELSE 0 END)) AS brutto
        FROM invoice_items GROUP BY invoice_id
      ) t ON t.invoice_id = i.id
      WHERE i.id = ${id};
    `;
    const inv = rows[0];
    if (!inv) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!inv.numer) return NextResponse.json({ error: "Faktura nie jest jeszcze wystawiona." }, { status: 400 });
    if (!inv.klient_email) return NextResponse.json({ error: "Brak adresu e-mail nabywcy — uzupełnij go w edytorze." }, { status: 400 });

    const dni = daysOverdue({ termin_platnosci: inv.termin_platnosci as string | null });
    // Poziom przychodzi w body. Brak pola = „wyślij podpowiadany" — tak wołają
    // apka iOS i starsze wersje panelu, więc trasa musi to znieść bez zmian po
    // ich stronie.
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const poziomy = poziomyWindykacji({
      termin_platnosci: inv.termin_platnosci as string | null,
      reminder_level: Number(inv.reminder_level) || 0,
    });
    const podano = body?.poziom != null;
    const wybrany = Number(body?.poziom);
    if (podano && !poziomy.dozwolone.includes(wybrany as 1 | 2 | 3)) {
      // Wprost, co poszło nie tak: „nie da się cofnąć poniżej wysłanego" jest
      // informacją dla właściciela, nie tylko odmową.
      return NextResponse.json(
        {
          error:
            wybrany >= 1 && wybrany <= 3
              ? `Do klienta wyszło już „${REMINDER_LEVEL_LABEL[poziomy.minimum]?.toLowerCase() ?? `poziom ${poziomy.minimum}`}" — nie da się teraz wysłać łagodniejszego pisma.`
              : "Nieznany poziom windykacji.",
        },
        { status: 400 }
      );
    }
    const level = podano ? (wybrany as 1 | 2 | 3) : poziomy.sugerowany;
    // Moduł 40 — poziom 3 idzie linkiem do wezwania, niższe linkiem do
    // faktury; unieważniony jest ten, którego akurat użyjemy.
    if (level === 3 ? inv.wezwanie_share_revoked_at : inv.share_revoked_at) {
      return NextResponse.json(
        {
          error:
            level === 3
              ? "Link do wezwania jest unieważniony — wygeneruj nowy przed wysyłką."
              : "Link do tej faktury jest unieważniony — wygeneruj nowy przed wysyłką.",
        },
        { status: 409 }
      );
    }
    // POTWIERDZENIE (Faza 4) — dopiero tu, bo dopiero teraz wiadomo, KTÓRA to
    // wiadomość: poziom 3 to formalne wezwanie do zapłaty, a to zupełnie inny
    // list niż uprzejme przypomnienie. Okno ma powiedzieć prawdę o tym, co
    // wychodzi, więc pyta osobnym zdaniem dla każdego z nich.
    const odmowaPotw = odmowaPotwierdzenia(
      level === 3 ? "wezwanie-wyslij" : "faktura-przypomnij",
      odczytajPotwierdzenie(req.headers)
    );
    if (odmowaPotw) {
      return NextResponse.json({ error: odmowaPotw.error, potwierdzenie: odmowaPotw.potwierdzenie }, { status: odmowaPotw.status });
    }

    const brutto = Number(inv.brutto);
    const waluta = String(inv.waluta || "PLN");
    const terminPlatnosci = inv.termin_platnosci ? String(inv.termin_platnosci) : null;
    const numer = String(inv.numer);
    const clientId = typeof inv.client_id === "string" ? inv.client_id : null;

    // Znalezisko A4 — ile wiadomości w tej sprawie NAPRAWDĘ już wyszło.
    // Liczymy wiersze historii, nie `reminder_level`: poziom mówi „jak
    // wysoko", a szablon pyta „ile razy". Te dwie liczby rozjeżdżają się przy
    // każdym pominiętym progu — przy 14 dniach zwłoki panel wysyłał od razu
    // poziom 2, a wiadomość była pierwsza.
    const wyslanoWczesniej = Number(
      (await sql`SELECT COUNT(*)::int AS ile FROM invoice_reminders WHERE invoice_id = ${id};`)[0]?.ile ?? 0
    );
    // Powitanie i podpis z danych panelu (znalezisko D3). `settings` czytamy
    // raz — poziom 3 potrzebuje z nich jeszcze stawki odsetek.
    const ustawienia = (await sql`SELECT * FROM company_settings WHERE id = 'default';`)[0] ?? null;
    const koperta = await kopertaDokumentu(sql, inv, ustawienia);

    if (level === 3) {
      const token = await ensureInvoiceWezwanieShareToken(sql, id, typeof inv.wezwanie_share_token === "string" ? inv.wezwanie_share_token : null);
      const url = `${req.nextUrl.origin}/pl/wezwanie/${token}`;
      const reference = dunningReference(id, String(inv.created_at));
      const stawkaOdsetek = ustawienia?.stawka_odsetek_ustawowych != null ? Number(ustawienia.stawka_odsetek_ustawowych) : null;
      const odsetki = lateInterestAmount(brutto, stawkaOdsetek, dni ?? 0);
      const { subject, text } = dunningEmailText({ numer, brutto, waluta, terminPlatnosci, dni: dni ?? 0, odsetki, url, reference, wyslanoWczesniej, koperta });
      await sendEmail({ to: String(inv.klient_email), subject, text });
      await sql`UPDATE invoices SET wezwanie_wystawiono_at = now() WHERE id = ${id};`;
      await logClientEvent(sql, clientId, "invoice_dunning_sent", `Wysłano wezwanie do zapłaty — faktura ${numer} (${reference})`, null, id);
    } else {
      const token = await ensureInvoiceShareToken(sql, id, typeof inv.share_token === "string" ? inv.share_token : null);
      const url = `${req.nextUrl.origin}/pl/faktura/${token}`;
      const { subject, text } = reminderEmailText(level, { numer, brutto, waluta, terminPlatnosci, url, wyslanoWczesniej, koperta });
      await sendEmail({ to: String(inv.klient_email), subject, text });
      await logClientEvent(sql, clientId, "invoice_reminder", `Wysłano przypomnienie o płatności (poziom ${level}) — faktura ${numer}`, null, id);
    }

    // reminder_level nigdy nie cofa się w dół (ręczne wysłanie niższego
    // poziomu niż już osiągnięty nie powinno "zapomnieć" wcześniejszej eskalacji).
    const newReminderLevel = Math.max(level, Number(inv.reminder_level) || 0);
    await sql`UPDATE invoices SET last_reminder_at = now(), reminder_level = ${newReminderLevel} WHERE id = ${id};`;
    await sql`
      INSERT INTO invoice_reminders (id, invoice_id, level, kind)
      VALUES (${randomUUID()}, ${id}, ${level}, ${level === 3 ? "wezwanie" : "reminder"});
    `;

    return NextResponse.json({ ok: true, level });
  } catch (err) {
    console.error("[POST /api/invoices/:id/remind] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd wysyłki przypomnienia: ${message}` }, { status: 500 });
  }
}
