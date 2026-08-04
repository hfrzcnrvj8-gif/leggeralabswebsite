import { NextRequest, NextResponse } from "next/server";
import { celDokumentu, getSql, ensureContractsSchema, ensureContractShareToken, logZdarzenieDokumentu, odnotujWyslanaWiadomosc, kopertaDokumentu } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { zlozMail } from "@/lib/kopertaMaila";
import { formatPlDate } from "@/lib/dates";
import {
  CONTRACT_MIGAWKA_POLA,
  CONTRACT_TYP_LABEL,
  roznicaAneksu,
  type Contract,
  type ContractTyp,
  type PoprzednieWarunki,
} from "@/lib/contracts";
import { sprawdzDokumentPrzedWysylka, odmowaBramki, mimoOstrzezen } from "@/lib/bramkaWysylki";
import { odczytajPotwierdzenie, odmowaPotwierdzenia } from "@/lib/nieodwracalne";
import { wystawcaDoMigawki } from "@/lib/publicFields";

export const runtime = "nodejs";

/** POST /api/contracts/:id/send — wysyła klientowi/leadowi mailem link do
 * publicznego podpisu. Admin-only. Wzorem app/api/offers/[id]/send. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await ensureContractsSchema();
    const sql = getSql();
    const rows = await sql`SELECT * FROM contracts WHERE id = ${id};`;
    const contract = rows[0];
    if (!contract) return NextResponse.json({ error: "not found" }, { status: 404 });
    // Moduł 40 — wysyłka nie może iść unieważnionym linkiem. Świadomie NIE
    // regenerujemy tokenu po cichu: nowy link to osobna, jawna decyzja.
    if (contract.share_revoked_at) return NextResponse.json({ error: "Link do tego dokumentu jest unieważniony — wygeneruj nowy przed wysyłką." }, { status: 409 });

    const typ = contract.typ as ContractTyp;
    const label0 = CONTRACT_TYP_LABEL[typ] ?? "Umowa";

    // Sprawa zamknięta nie idzie „do podpisu" (audyt Modułu 11). Trasa
    // przyjmowała to bez mrugnięcia: klient dostawał mail „dokument można
    // podpisać elektronicznie" pod dokumentem, który już podpisał, `sent_at`
    // wracało na zero (czyli licznik ciszy na Pulpicie startował od nowa), a na
    // osi czasu klienta lądowało „Wysłano umowę" PO „Umowa podpisana". Apka
    // chowała ten przycisk od dawna — ale blokada w interfejsie nie jest
    // blokadą (patrz lib/blokadaDokumentu.ts).
    if (contract.status === "Podpisana" || contract.accepted_at) {
      return NextResponse.json(
        { error: `${label0} jest już podpisan${typ === "umowa" ? "a" : "y"} — nie ma po co prosić o podpis drugi raz. Zmianę warunków wprowadza aneks.` },
        { status: 409 }
      );
    }
    if (contract.status === "Odrzucona") {
      return NextResponse.json(
        { error: `${label0} została odrzucona — zanim wyślesz ją ponownie, przestaw status na „Szkic”.` },
        { status: 409 }
      );
    }

    // Aneks bez ani jednej zmiany to kartka ze zdaniem „pozostałe postanowienia
    // pozostają bez zmian" i niczym więcej — wysłanie go klientowi do podpisu
    // byłoby proszeniem o podpis pod pustką. Reguła stoi TUTAJ, w trasie, a nie
    // tylko w przycisku: to jest wprost wniosek z audytu Modułu 57 (blokada
    // w interfejsie nie jest blokadą).
    if (typ === "aneks") {
      const poprzednie = contract.poprzednie as PoprzednieWarunki | null;
      const zmiany = poprzednie
        ? roznicaAneksu(poprzednie, contract as unknown as Contract)
        : [];
      if (zmiany.length === 0) {
        return NextResponse.json(
          {
            error:
              "Ten aneks nie zmienia jeszcze żadnego warunku umowy — nie ma czego wysyłać. Zmień zakres, wynagrodzenie, walutę albo termin.",
          },
          { status: 409 }
        );
      }
    }

    // BRAMKA WYSYŁKI (Faza 2) — ta sama funkcja, co przy ofercie i fakturze.
    // Zastąpiła własne `if (!klient_email)`: trasa pilnowała adresu odbiorcy,
    // ale przepuszczała umowę bez wystawcy i bez adresu drugiej strony —
    // a to dokument, który IDENTYFIKUJE strony (znaleziska A2 i A3).
    const wystawca = wystawcaDoMigawki((await sql`SELECT * FROM company_settings WHERE id = 'default';`)[0]);
    const bramka = sprawdzDokumentPrzedWysylka({ rodzaj: "umowa", dokument: contract, wystawca });
    const odmowa = odmowaBramki(bramka, mimoOstrzezen(await req.json().catch(() => null)));
    if (odmowa) return NextResponse.json({ error: odmowa.error, bramka: odmowa.bramka }, { status: odmowa.status });

    // POTWIERDZENIE (Faza 4) — PO bramce: najpierw „czy to wolno wysłać”,
    // dopiero potem „czy na pewno teraz”. Odwrotna kolejność kazałaby
    // potwierdzać wysyłkę dokumentu, który i tak nie ma prawa wyjść.
    const odmowaPotw = odmowaPotwierdzenia("umowa-wyslij", odczytajPotwierdzenie(req.headers));
    if (odmowaPotw) {
      return NextResponse.json({ error: odmowaPotw.error, potwierdzenie: odmowaPotw.potwierdzenie }, { status: odmowaPotw.status });
    }

    const token = await ensureContractShareToken(sql, id, typeof contract.share_token === "string" ? contract.share_token : null);
    const segment = typ === "nda" ? "nda" : "umowa";
    const url = `${req.nextUrl.origin}/pl/${segment}/${token}`;
    const label = label0;
    const nazwa = typeof contract.klient_nazwa === "string" && contract.klient_nazwa ? contract.klient_nazwa : "";

    // Termin realizacji w mailu (krok 2, A5/D3) — przez `formatPlDate()`,
    // nigdy surowym ISO z bazy.
    const terminRealizacji = typeof contract.termin_realizacji === "string" ? contract.termin_realizacji : null;
    await sendEmail({
      to: String(contract.klient_email),
      subject: `${label}${nazwa ? ` — ${nazwa}` : ""}`,
      text: zlozMail(await kopertaDokumentu(sql, contract, wystawca), "zwykly", [
        `w załączeniu link do dokumentu: ${label}.`,
        ``,
        url,
        ``,
        ...(terminRealizacji ? [`Termin realizacji wg dokumentu: ${formatPlDate(terminRealizacji)}.`, ``] : []),
        `Dokument można podejrzeć i podpisać elektronicznie pod powyższym adresem.`,
      ]),
    });

    // Migawka treści (audyt Modułu 11) — dokładnie w tym momencie druga strona
    // dostaje link, więc to jest treść, którą przeczytała. Robimy ją przy
    // KAŻDEJ wysyłce: ponowne wysłanie po poprawce ma pokazywać poprawioną
    // wersję, a nie pierwszą. Umowa (inaczej niż oferta) jest edytowalna aż do
    // podpisu, więc bez tego dokument „u drugiej strony" zmieniałby się razem
    // z bazą.
    //
    // `wystawca` dołączył w Fazie 2 (znalezisko A2): bez niego publiczna
    // strona umowy czytała dane firmy NA ŻYWO, więc zmiana nazwy albo adresu
    // zmieniała wstecz dokument, który druga strona ma podpisać.
    const migawka = {
      ...Object.fromEntries(CONTRACT_MIGAWKA_POLA.map((k) => [k, (contract as Record<string, unknown>)[k]])),
      wystawca,
    };
    await sql`UPDATE contracts SET migawka = ${JSON.stringify(migawka)}, migawka_at = now() WHERE id = ${id};`;

    let status = String(contract.status);
    if (status === "Szkic") {
      await sql`UPDATE contracts SET status = 'Wysłana', updated_at = now() WHERE id = ${id};`;
      status = "Wysłana";
    }
    // Moduł 31 — licznik dni ciszy na Pulpicie. Ustawiany przy KAŻDEJ wysyłce,
    // nie tylko pierwszej: ponowne wysłanie to świeży szturchaniec, więc zegar
    // rusza od nowa (inaczej umowa wysłana drugi raz krzyczałaby dalej "cisza
    // od 20 dni", mimo że przypomniałeś wczoraj).
    await sql`UPDATE contracts SET sent_at = now() WHERE id = ${id};`;
    const cel = celDokumentu(contract);
    await logZdarzenieDokumentu(sql, cel, "contract_sent", `Wysłano ${label.toLowerCase()} mailem`, null, id);
    // B3 — dokument do podpisu poszedł mailem, więc to kontakt.
    await odnotujWyslanaWiadomosc(sql, cel);

    // Patrz analogiczna adnotacja w app/api/offers/[id]/send.
    return NextResponse.json({ ok: true, status, shareToken: token });
  } catch (err) {
    console.error("[POST /api/contracts/:id/send] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd wysyłki: ${message}` }, { status: 500 });
  }
}
