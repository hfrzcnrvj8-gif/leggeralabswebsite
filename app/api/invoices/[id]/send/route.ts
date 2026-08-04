import { NextRequest, NextResponse } from "next/server";
import { celDokumentu, getSql, ensureInvoicesSchema, ensureInvoiceShareToken, logZdarzenieDokumentu, odnotujWyslanaWiadomosc, kopertaDokumentu } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { zlozMail } from "@/lib/kopertaMaila";
import { formatPlDate } from "@/lib/dates";
import { INVOICE_TYPE_LABEL, type InvoiceDocType } from "@/lib/invoices";
import { sprawdzDokumentPrzedWysylka, odmowaBramki, mimoOstrzezen } from "@/lib/bramkaWysylki";
import { odczytajPotwierdzenie, odmowaPotwierdzenia } from "@/lib/nieodwracalne";

export const runtime = "nodejs";

/** POST /api/invoices/:id/send — wysyła klientowi mailem link do publicznego
 * podglądu faktury (musi być już wystawiona i mieć e-mail nabywcy). Admin-only. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await ensureInvoicesSchema();
    const sql = getSql();
    const rows = await sql`SELECT * FROM invoices WHERE id = ${id};`;
    const inv = rows[0];
    if (!inv) return NextResponse.json({ error: "not found" }, { status: 404 });
    // Moduł 40 — wysyłka nie może iść unieważnionym linkiem. Świadomie NIE
    // regenerujemy tokenu po cichu: nowy link to osobna, jawna decyzja.
    if (inv.share_revoked_at) return NextResponse.json({ error: "Link do tej faktury jest unieważniony — wygeneruj nowy przed wysyłką." }, { status: 409 });
    // BRAMKA WYSYŁKI (Faza 2) — ta sama funkcja, co przy ofercie i umowie.
    // Zastąpiła dwa własne `if` (numer, e-mail nabywcy); doszło do nich to,
    // czego ta trasa nie sprawdzała: kompletność wystawcy i adres nabywcy.
    //
    // Wystawcę bierzemy z MIGAWKI faktury (zamrożonej przy wystawieniu), a nie
    // z żywych ustawień — bramka ma odpowiedzieć na pytanie „co zobaczy
    // klient pod tym linkiem", a klient widzi migawkę.
    const wystawcaZMigawki = ((inv.migawka ?? null) as { wystawca?: Record<string, unknown> } | null)?.wystawca ?? null;
    const wystawca = wystawcaZMigawki ?? (await sql`SELECT * FROM company_settings WHERE id = 'default';`)[0] ?? null;
    const bramka = sprawdzDokumentPrzedWysylka({ rodzaj: "faktura", dokument: inv, wystawca });
    const odmowa = odmowaBramki(bramka, mimoOstrzezen(await req.json().catch(() => null)));
    if (odmowa) return NextResponse.json({ error: odmowa.error, bramka: odmowa.bramka }, { status: odmowa.status });

    // POTWIERDZENIE (Faza 4) — PO bramce: najpierw „czy to wolno wysłać”,
    // dopiero potem „czy na pewno teraz”. Odwrotna kolejność kazałaby
    // potwierdzać wysyłkę dokumentu, który i tak nie ma prawa wyjść.
    const odmowaPotw = odmowaPotwierdzenia("faktura-wyslij", odczytajPotwierdzenie(req.headers));
    if (odmowaPotw) {
      return NextResponse.json({ error: odmowaPotw.error, potwierdzenie: odmowaPotw.potwierdzenie }, { status: odmowaPotw.status });
    }

    const token = await ensureInvoiceShareToken(sql, id, typeof inv.share_token === "string" ? inv.share_token : null);
    const url = `${req.nextUrl.origin}/pl/faktura/${token}`;
    const typLabel = INVOICE_TYPE_LABEL[(inv.typ_dokumentu as InvoiceDocType) ?? "faktura"];

    // Termin płatności w mailu (krok 2, znalezisko A5/D3) — dotąd klient
    // musiał otworzyć link, żeby się dowiedzieć, do kiedy ma zapłacić.
    // Zawsze przez `formatPlDate()`: to jest dokładnie to miejsce, w którym
    // szablony wysyłały klientowi `2026-07-21` z bazy.
    const termin = typeof inv.termin_platnosci === "string" ? inv.termin_platnosci : null;
    await sendEmail({
      to: String(inv.klient_email),
      subject: `${typLabel} ${inv.numer}`,
      text: zlozMail(await kopertaDokumentu(sql, inv, wystawca), "zwykly", [
        `w załączeniu link do dokumentu: ${typLabel} nr ${inv.numer}.`,
        ``,
        url,
        ``,
        ...(termin ? [`Termin płatności: ${formatPlDate(termin)}.`, ``] : []),
        `Dokument można podejrzeć i zapisać jako PDF pod powyższym adresem.`,
      ]),
    });

    const cel = celDokumentu(inv);
    await logZdarzenieDokumentu(sql, cel, "invoice_sent", `Wysłano mailem: ${typLabel} nr ${inv.numer}`, null, id);
    // B3 — dokument poszedł mailem do klienta, więc to kontakt.
    await odnotujWyslanaWiadomosc(sql, cel);

    // Patrz analogiczna adnotacja w app/api/offers/[id]/send.
    return NextResponse.json({ ok: true, shareToken: token });
  } catch (err) {
    console.error("[POST /api/invoices/:id/send] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd wysyłki: ${message}` }, { status: 500 });
  }
}
