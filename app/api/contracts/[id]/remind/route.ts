import { NextRequest, NextResponse } from "next/server";
import { celDokumentu, getSql, ensureContractsSchema, ensureContractShareToken, logZdarzenieDokumentu, odnotujWyslanaWiadomosc, kopertaDokumentu } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { odczytajPotwierdzenie, odmowaPotwierdzenia } from "@/lib/nieodwracalne";
import { sendEmail } from "@/lib/email";
import { zlozMail } from "@/lib/kopertaMaila";
import { odmienPl } from "@/lib/dates";
import { CONTRACT_TYP_LABEL, contractSilenceDays, type ContractTyp } from "@/lib/contracts";

export const runtime = "nodejs";

/** POST /api/contracts/:id/remind — uprzejme przypomnienie o dokumencie, który
 * czeka na podpis.
 *
 * Bliźniak `app/api/offers/[id]/remind`, dołożony 2026-07-27. Do tej pory
 * Pulpit mówił „cisza od 12 dni", ale żeby coś z tym zrobić, trzeba było
 * napisać maila ręcznie — czyli panel wskazywał problem i zostawiał człowieka
 * samego. Oferty miały tę trasę od Modułu 57, Umowy nie.
 *
 * **Ton jest inny niż przy ofercie.** Oferta bez decyzji to sprzedaż („chętnie
 * dopasuję zakres"); umowa bez podpisu to zwykle nie brak chęci, tylko rzecz,
 * która utknęła po drodze — u prawnika, w obiegu, w czyjejś skrzynce. Dlatego
 * mail pyta wprost, czy coś w zapisach wymaga rozmowy, zamiast ponaglać.
 *
 * Wysyłkę zawsze klika właściciel — panel nigdy nie pisze do nikogo sam. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await ensureContractsSchema();
    const sql = getSql();
    const rows = await sql`SELECT * FROM contracts WHERE id = ${id};`;
    const contract = rows[0];
    if (!contract) return NextResponse.json({ error: "not found" }, { status: 404 });

    const typ = contract.typ as ContractTyp;
    const label = CONTRACT_TYP_LABEL[typ] ?? "Umowa";

    if (contract.status === "Podpisana" || contract.accepted_at) {
      return NextResponse.json({ error: `${label} jest już podpisana — nie ma o czym przypominać.` }, { status: 409 });
    }
    if (contract.status === "Odrzucona") {
      return NextResponse.json({ error: `${label} została odrzucona — sprawa jest zamknięta.` }, { status: 409 });
    }
    if (contract.status === "Szkic") {
      return NextResponse.json({ error: `To dopiero szkic — najpierw wyślij dokument do podpisu.` }, { status: 409 });
    }
    if (contract.share_revoked_at) {
      return NextResponse.json({ error: "Link do tego dokumentu jest unieważniony — wygeneruj nowy przed wysyłką." }, { status: 409 });
    }
    if (!contract.klient_email) {
      return NextResponse.json({ error: "Brak adresu e-mail — uzupełnij go w edytorze." }, { status: 400 });
    }

    const token = await ensureContractShareToken(sql, id, typeof contract.share_token === "string" ? contract.share_token : null);
    const segment = typ === "nda" ? "nda" : "umowa";
    const url = `${req.nextUrl.origin}/pl/${segment}/${token}`;
    const dni = contractSilenceDays({ status: contract.status, sent_at: contract.sent_at });

    // POTWIERDZENIE (Faza 4) — po sprawdzeniach, przed mailem.
    const odmowaPotw = odmowaPotwierdzenia("umowa-przypomnij", odczytajPotwierdzenie(req.headers));
    if (odmowaPotw) {
      return NextResponse.json({ error: odmowaPotw.error, potwierdzenie: odmowaPotw.potwierdzenie }, { status: odmowaPotw.status });
    }

    await sendEmail({
      to: String(contract.klient_email),
      subject: `Przypomnienie: ${label.toLowerCase()} do podpisu`,
      // Powitanie i podpis z danych panelu (krok 2, znalezisko D3).
      text: zlozMail(await kopertaDokumentu(sql, contract), "zwykly", [
        `wracam do dokumentu, który przesłałem${dni && dni > 0 ? ` ${dni} ${odmienPl(dni, "dzień", "dni", "dni")} temu` : " wcześniej"} do podpisu:`,
        ``,
        url,
        ``,
        `Dokument można podejrzeć i podpisać elektronicznie pod powyższym adresem.`,
        `Jeśli któryś z zapisów wymaga rozmowy albo zmiany — proszę o wiadomość, ustalimy to przed podpisem.`,
      ]),
    });

    await sql`UPDATE contracts SET przypomniano_at = now(), updated_at = now() WHERE id = ${id};`;
    const cel = celDokumentu(contract);
    await logZdarzenieDokumentu(sql, cel, "contract_sent", `Przypomniano o podpisie — ${label.toLowerCase()}`, null, id);
    // B3 — przypomnienie o podpisie poszło do drugiej strony.
    await odnotujWyslanaWiadomosc(sql, cel);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/contracts/:id/remind] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd wysyłki przypomnienia: ${message}` }, { status: 500 });
  }
}
