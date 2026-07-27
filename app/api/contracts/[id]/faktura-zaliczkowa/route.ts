import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureContractsSchema, ensureInvoicesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { contractReference, type Contract } from "@/lib/contracts";
import { domyslnaStawkaVat } from "@/lib/offerAccept";

export const runtime = "nodejs";

/** POST /api/contracts/:id/faktura-zaliczkowa — szkic faktury zaliczkowej
 * wprost z podpisanej umowy.
 *
 * **Po co.** Pola „zaliczka %" i „harmonogram płatności" pojawiły się w umowie
 * 2026-07-27, ale nic ich nie łączyło z modułem Faktury: kwotę zaliczki trzeba
 * było przepisać ręcznie z umowy do nowej faktury — czyli dokładnie ta sytuacja,
 * w której literówka wychodzi dopiero u klienta. Teraz faktura rodzi się
 * z dokumentu, który obie strony podpisały.
 *
 * **Szkic, nie faktura wystawiona.** Trasa nie nadaje numeru — numer nadaje
 * moduł Faktury przy wystawieniu, bo to on pilnuje ciągłości numeracji.
 * Właściciel ma jeszcze zajrzeć w termin płatności i stawkę.
 *
 * **Kwota brutto.** Zaliczka to tyle, ile klient realnie przelewa, więc
 * faktura startuje w trybie `ceny_brutto` (tak samo jak każda zaliczkowa
 * zakładana z modułu Faktury). Stawka VAT wywiedziona z kraju klienta —
 * odwrotne obciążenie dla zagranicy, jak przy szkicu z oferty.
 *
 * **Dedupe po `contract_id`.** Drugie kliknięcie zwraca istniejącą zaliczkę
 * zamiast wystawiać drugą na tę samą kwotę — ta sama zasada co przy umowie
 * z oferty i przy NDA z leada. Bez tego dwa kliknięcia dzień po dniu dawały
 * dwie faktury nie do odróżnienia. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await ensureContractsSchema();
    await ensureInvoicesSchema();
    const sql = getSql();

    const contract = (await sql`SELECT * FROM contracts WHERE id = ${id};`)[0] as Contract | undefined;
    if (!contract) return NextResponse.json({ error: "not found" }, { status: 404 });

    if (contract.typ !== "umowa") {
      return NextResponse.json(
        { error: "Zaliczkę wystawia się do umowy — NDA i powierzenie danych nie mają wynagrodzenia." },
        { status: 409 }
      );
    }
    // Zaliczka przed podpisem to prośba o przelew pod dokument, którego druga
    // strona jeszcze nie zaakceptowała. Świadomie odmawiamy — od tego jest
    // proforma, wystawiana wprost w module Faktury.
    if (contract.status !== "Podpisana") {
      return NextResponse.json(
        { error: "Umowa nie jest jeszcze podpisana. Zaliczkę wystawiamy po podpisie — wcześniej użyj proformy." },
        { status: 409 }
      );
    }
    const procent = Number(contract.zaliczka_procent) || 0;
    if (procent <= 0) {
      return NextResponse.json(
        { error: "Ta umowa nie przewiduje zaliczki — ustaw ją w sekcji „Płatność”, zanim wystawisz fakturę." },
        { status: 409 }
      );
    }
    const cena = Number(contract.cena) || 0;
    if (cena <= 0) {
      return NextResponse.json({ error: "Umowa nie ma kwoty wynagrodzenia — nie ma od czego liczyć zaliczki." }, { status: 409 });
    }

    const istniejaca = await sql`
      SELECT id FROM invoices WHERE contract_id = ${id} AND typ_dokumentu = 'zaliczkowa' LIMIT 1;
    `;
    if (istniejaca.length > 0) {
      return NextResponse.json({ ok: true, id: istniejaca[0].id, existing: true });
    }

    const kwota = Math.round(((cena * procent) / 100) * 100) / 100;
    const referencja = contractReference(contract);

    const settings = (await sql`SELECT domyslne_uwagi FROM company_settings WHERE id = 'default';`)[0];
    const domyslneUwagi = typeof settings?.domyslne_uwagi === "string" ? settings.domyslne_uwagi : "";

    const invoiceId = randomUUID();
    const shareToken = randomUUID().replace(/-/g, "");
    await sql`
      INSERT INTO invoices (
        id, lead_id, project_id, client_id, offer_id, contract_id,
        klient_nazwa, klient_nip, klient_ulica, klient_kod, klient_miasto, klient_kraj,
        share_token, typ_dokumentu, uwagi, ceny_brutto, waluta
      ) VALUES (
        ${invoiceId}, ${contract.lead_id}, ${contract.project_id}, ${contract.client_id}, ${contract.offer_id}, ${id},
        ${contract.klient_nazwa}, ${contract.klient_nip}, ${contract.klient_ulica}, ${contract.klient_kod},
        ${contract.klient_miasto}, ${contract.klient_kraj},
        ${shareToken}, 'zaliczkowa', ${domyslneUwagi}, true, ${contract.waluta || "PLN"}
      );
    `;

    // Jedna pozycja, nazwana tak, żeby przelew dało się dopasować do umowy bez
    // otwierania panelu — numer umowy jest w treści pozycji, nie tylko
    // w powiązaniu w bazie.
    await sql`
      INSERT INTO invoice_items (id, invoice_id, nazwa, ilosc, jednostka, cena_netto, vat_stawka, position)
      VALUES (
        ${randomUUID()}, ${invoiceId},
        ${`Zaliczka ${procent}% do umowy ${referencja}`},
        1, 'usł.', ${kwota}, ${domyslnaStawkaVat(contract.klient_kraj)}, 0
      );
    `;

    return NextResponse.json({ ok: true, id: invoiceId, kwota, referencja });
  } catch (err) {
    console.error("[POST /api/contracts/:id/faktura-zaliczkowa] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd tworzenia faktury: ${message}` }, { status: 500 });
  }
}
