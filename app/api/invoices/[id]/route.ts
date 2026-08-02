import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureInvoicesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { blokadaFaktury, POLA_MIMO_BLOKADY_FAKTURY, ruszaTresc } from "@/lib/blokadaDokumentu";
import { naKolumnyDokumentu, odswiezDaneKlientaWSzkicu } from "@/lib/przepisanie";
import { sprawdzDokumentPrzedWysylka } from "@/lib/bramkaWysylki";
import { isPlausibleDateString } from "@/lib/projects";
import {
  INVOICE_LANGS,
  INVOICE_CURRENCIES,
  INVOICE_STATUSES,
  INVOICE_TYPES,
  PAYMENT_METHODS,
  invoiceTotals,
  zeSlownika,
  type InvoiceItem,
} from "@/lib/invoices";
import { KOREKTA_TYPY } from "@/lib/ksef";

export const runtime = "nodejs";

type Row = Record<string, unknown>;
function numItems(rows: Row[]): Row[] {
  return rows.map((r) => ({ ...r, ilosc: Number(r.ilosc), cena_netto: Number(r.cena_netto), rabat_procent: Number(r.rabat_procent) }));
}

/** GET /api/invoices/:id — faktura + pozycje + dane firmy (do podglądu). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureInvoicesSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM invoices WHERE id = ${id};`;
  const invoice = rows[0];
  if (!invoice) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Dociągnięcie poprawek z karty klienta, dopóki faktura jest SZKICEM —
  // czyli dopóki nie ma numeru (patrz blokadaFaktury). Faza 1, decyzja
  // właściciela 2026-08-02. Wystawiona faktura jest nienaruszalna.
  const swiezeDane = await odswiezDaneKlientaWSzkicu(sql, "faktura", invoice, {
    szkic: !String(invoice.numer ?? "").trim(),
  });
  if (swiezeDane) Object.assign(invoice, naKolumnyDokumentu(swiezeDane));

  const items = await sql`SELECT * FROM invoice_items WHERE invoice_id = ${id} ORDER BY position ASC;`;
  const settings = await sql`SELECT * FROM company_settings WHERE id = 'default';`;
  const payments = await sql`SELECT * FROM invoice_payments WHERE invoice_id = ${id} ORDER BY data ASC;`;
  // Historia eskalacji windykacji (Moduł 13) — osobno od `last_reminder_at`
  // (jedyny, nadpisywany ślad), żeby edytor mógł pokazać ILE poszło i na
  // jakim poziomie, nie tylko "kiedy ostatnio".
  const reminders = await sql`SELECT * FROM invoice_reminders WHERE invoice_id = ${id} ORDER BY sent_at DESC;`;
  const korekty = await sql`SELECT id, numer, data_wystawienia, status FROM invoices WHERE koryguje_id = ${id} ORDER BY created_at ASC;`;
  // Dla korekty dołączamy brutto faktury pierwotnej — edytor pokazuje na jego
  // podstawie różnicę (stan po korekcie − stan pierwotny), którą wyśle do KSeF.
  let koryguje = null;
  if (invoice.koryguje_id) {
    const kr = (await sql`SELECT id, numer, data_wystawienia, status FROM invoices WHERE id = ${invoice.koryguje_id};`)[0] ?? null;
    if (kr) {
      const kItems = numItems(await sql`SELECT * FROM invoice_items WHERE invoice_id = ${invoice.koryguje_id} ORDER BY position ASC;`);
      koryguje = { ...kr, brutto: invoiceTotals(kItems as unknown as InvoiceItem[]).brutto };
    }
  }
  // Dla faktury ROZLICZENIOWEJ dołączamy dane rozliczanej zaliczki — edytor
  // pokazuje na ich podstawie "kwota pozostała do zapłaty" (pełna wartość
  // minus brutto zaliczki), tak jak liczy to lib/ksef.ts (P_15 dla ROZ).
  let zaliczka = null;
  if (invoice.rozlicza_zaliczke_id) {
    const zr = (await sql`SELECT id, numer, status, ksef_status, ksef_numer FROM invoices WHERE id = ${invoice.rozlicza_zaliczke_id};`)[0] ?? null;
    if (zr) {
      const zItems = numItems(await sql`SELECT * FROM invoice_items WHERE invoice_id = ${invoice.rozlicza_zaliczke_id} ORDER BY position ASC;`);
      zaliczka = { ...zr, brutto: invoiceTotals(zItems as unknown as InvoiceItem[]).brutto };
    }
  }
  // BRAMKA WYSYŁKI (Faza 2) — patrz bliźniacza adnotacja w GET /api/offers/:id.
  // Wystawca z migawki (zamrożonej przy wystawieniu), bo klient widzi migawkę;
  // dla szkicu migawki jeszcze nie ma, więc liczymy z żywych ustawień.
  const wystawcaZMigawki = ((invoice.migawka ?? null) as { wystawca?: Record<string, unknown> } | null)?.wystawca ?? null;
  const bramka = sprawdzDokumentPrzedWysylka({
    rodzaj: "faktura",
    dokument: invoice,
    wystawca: wystawcaZMigawki ?? settings[0] ?? null,
  });

  return NextResponse.json({
    invoice,
    items: numItems(items),
    settings: settings[0] ?? null,
    bramka,
    payments: payments.map((p) => ({ ...p, kwota: Number(p.kwota) })),
    reminders,
    korekty,
    koryguje,
    zaliczka,
  });
}

/** PATCH /api/invoices/:id — aktualizacja pól nagłówka faktury. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  try {
    await ensureInvoicesSchema();
    const sql = getSql();

  // Wystawionej faktury nie wolno zmieniać — poprawka idzie korektą.
  // Ta reguła istniała TYLKO w edytorze (`const locked = !isDraft`), więc
  // ochrona kończyła się na interfejsie: trasa przyjmowała wszystko. Usunięcie
  // numerowanej faktury było blokowane serwerowo od dawna — edycja nie.
  const stanFaktury = (await sql`SELECT numer FROM invoices WHERE id = ${id};`)[0];
  if (!stanFaktury) return NextResponse.json({ error: "not found" }, { status: 404 });
  const blokadaFV = blokadaFaktury(stanFaktury.numer as string | null);
  if (blokadaFV.zablokowane && ruszaTresc(body ?? {}, POLA_MIMO_BLOKADY_FAKTURY)) {
    return NextResponse.json({ error: blokadaFV.komunikat }, { status: 409 });
  }
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
    const dateOrNull = (v: unknown): string | null | undefined => {
      if (typeof v !== "string") return undefined;
      const t = v.trim();
      if (!t) return null;
      return isPlausibleDateString(t) ? t : undefined;
    };

    if ("klient_nazwa" in body) await sql`UPDATE invoices SET klient_nazwa = ${str(body.klient_nazwa, 300)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_nip" in body) await sql`UPDATE invoices SET klient_nip = ${str(body.klient_nip, 30)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_adres" in body) await sql`UPDATE invoices SET klient_adres = ${str(body.klient_adres, 500)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_ulica" in body) await sql`UPDATE invoices SET klient_ulica = ${str(body.klient_ulica, 300)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_kod" in body) await sql`UPDATE invoices SET klient_kod = ${str(body.klient_kod, 20)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_miasto" in body) await sql`UPDATE invoices SET klient_miasto = ${str(body.klient_miasto, 200)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_kraj" in body) await sql`UPDATE invoices SET klient_kraj = ${str(body.klient_kraj, 100)}, updated_at = now() WHERE id = ${id};`;
    if ("odbiorca_nazwa" in body) await sql`UPDATE invoices SET odbiorca_nazwa = ${str(body.odbiorca_nazwa, 300)}, updated_at = now() WHERE id = ${id};`;
    if ("odbiorca_ulica" in body) await sql`UPDATE invoices SET odbiorca_ulica = ${str(body.odbiorca_ulica, 300)}, updated_at = now() WHERE id = ${id};`;
    if ("odbiorca_kod" in body) await sql`UPDATE invoices SET odbiorca_kod = ${str(body.odbiorca_kod, 20)}, updated_at = now() WHERE id = ${id};`;
    if ("odbiorca_miasto" in body) await sql`UPDATE invoices SET odbiorca_miasto = ${str(body.odbiorca_miasto, 200)}, updated_at = now() WHERE id = ${id};`;
    if ("odbiorca_kraj" in body) await sql`UPDATE invoices SET odbiorca_kraj = ${str(body.odbiorca_kraj, 100)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_email" in body) await sql`UPDATE invoices SET klient_email = ${str(body.klient_email, 200)}, updated_at = now() WHERE id = ${id};`;
    if ("client_id" in body) {
      const cid = typeof body.client_id === "string" && body.client_id.trim() ? body.client_id : null;
      await sql`UPDATE invoices SET client_id = ${cid}, updated_at = now() WHERE id = ${id};`;
    }
    if ("przyczyna_korekty" in body) await sql`UPDATE invoices SET przyczyna_korekty = ${str(body.przyczyna_korekty, 500)}, updated_at = now() WHERE id = ${id};`;
    // Faktura ta ROZLICZA wskazaną zaliczkową (FA(3) RodzajFaktury=ROZ) — link
    // był tworzony w edytorze (picker "Rozlicza zaliczkę"), ale PATCH go dotąd
    // po cichu ignorował (pole nigdy nie trafiało do bazy). null = odepnij.
    if ("rozlicza_zaliczke_id" in body) {
      const v = typeof body.rozlicza_zaliczke_id === "string" && body.rozlicza_zaliczke_id.trim() ? body.rozlicza_zaliczke_id : null;
      await sql`UPDATE invoices SET rozlicza_zaliczke_id = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    // Zamówienie/umowa (FA(3) Zamowienie) — tylko dla faktur zaliczkowych.
    if ("zamowienie_wartosc" in body) {
      const n = Number(body.zamowienie_wartosc);
      const v = Number.isFinite(n) && n > 0 ? n : null;
      await sql`UPDATE invoices SET zamowienie_wartosc = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    if ("zamowienie_opis" in body) await sql`UPDATE invoices SET zamowienie_opis = ${str(body.zamowienie_opis, 500)}, updated_at = now() WHERE id = ${id};`;
    // Pięć pól ze SŁOWNIKIEM. Wszystkie odbijają się 400, żadne nie podmienia
    // wsadu na domyślny (audyt Faktur, 2026-07-31 — patrz `zeSlownika`).
    // Do tej pory tylko `status` niżej odpowiadał błędem, a te cztery
    // odpowiadały `{"ok":true}` i cicho zapisywały wartość domyślną: `PATCH
    // {"typ_dokumentu":" proforma "}` robił z proformy dokument FISKALNY,
    // który wchodził do przychodu na Pulpicie.
    if ("typ_korekty" in body) {
      const v = zeSlownika(KOREKTA_TYPY, body.typ_korekty);
      if (!v) return NextResponse.json({ error: "invalid typ_korekty" }, { status: 400 });
      await sql`UPDATE invoices SET typ_korekty = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    if ("typ_dokumentu" in body) {
      const v = zeSlownika(INVOICE_TYPES, body.typ_dokumentu);
      if (!v) return NextResponse.json({ error: "invalid typ_dokumentu" }, { status: 400 });
      await sql`UPDATE invoices SET typ_dokumentu = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    if ("uwagi" in body) await sql`UPDATE invoices SET uwagi = ${str(body.uwagi, 2000)}, updated_at = now() WHERE id = ${id};`;
    if ("ceny_brutto" in body) await sql`UPDATE invoices SET ceny_brutto = ${Boolean(body.ceny_brutto)}, updated_at = now() WHERE id = ${id};`;
    if ("waluta" in body) {
      // Bez tej bramki jeden zły kod waluty wywalał w error boundary CAŁĄ
      // listę faktur — `formatMoney` rzucał `RangeError`. Patrz
      // `isInvoiceCurrency` (lib/invoices.ts).
      const v = zeSlownika(INVOICE_CURRENCIES, body.waluta);
      if (!v) return NextResponse.json({ error: "invalid waluta" }, { status: 400 });
      await sql`UPDATE invoices SET waluta = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    if ("sposob_platnosci" in body) {
      const v = zeSlownika(PAYMENT_METHODS, body.sposob_platnosci);
      if (!v) return NextResponse.json({ error: "invalid sposob_platnosci" }, { status: 400 });
      await sql`UPDATE invoices SET sposob_platnosci = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    if ("jezyk" in body) {
      const v = zeSlownika(INVOICE_LANGS, body.jezyk);
      if (!v) return NextResponse.json({ error: "invalid jezyk" }, { status: 400 });
      await sql`UPDATE invoices SET jezyk = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    if ("status" in body) {
      // Wartość ze SŁOWNIKA, nie dowolny string do 40 znaków (Moduł 59).
      // Na fakturze boli podwójnie: status steruje windykacją (`isOverdue`)
      // i sumami na Pulpicie, więc literówka cicho wypada z obu.
      const v = zeSlownika(INVOICE_STATUSES, body.status);
      if (!v) return NextResponse.json({ error: "invalid status" }, { status: 400 });
      await sql`UPDATE invoices SET status = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    if ("lead_id" in body) {
      const v = typeof body.lead_id === "string" && body.lead_id.trim() ? body.lead_id : null;
      await sql`UPDATE invoices SET lead_id = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    if ("project_id" in body) {
      const v = typeof body.project_id === "string" && body.project_id.trim() ? body.project_id : null;
      await sql`UPDATE invoices SET project_id = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    // Skąd wynika ta faktura (2026-07-27) — ścieżka dokumentów na karcie
    // klienta. ŚWIADOMIE wolne mimo blokady wystawionej faktury: powiązanie
    // nie jest treścią dokumentu (nie widzi go klient, nie zmienia kwoty),
    // tylko porządkiem w rejestrze — a właśnie stare, wystawione faktury
    // najczęściej wymagają dopięcia do umowy wstecz.
    if ("offer_id" in body) {
      const v = typeof body.offer_id === "string" && body.offer_id.trim() ? body.offer_id : null;
      await sql`UPDATE invoices SET offer_id = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    if ("contract_id" in body) {
      const v = typeof body.contract_id === "string" && body.contract_id.trim() ? body.contract_id : null;
      await sql`UPDATE invoices SET contract_id = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    if ("data_wystawienia" in body) {
      const v = dateOrNull(body.data_wystawienia);
      if (v === undefined) return NextResponse.json({ error: "invalid data_wystawienia" }, { status: 400 });
      await sql`UPDATE invoices SET data_wystawienia = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    if ("data_sprzedazy" in body) {
      const v = dateOrNull(body.data_sprzedazy);
      if (v === undefined) return NextResponse.json({ error: "invalid data_sprzedazy" }, { status: 400 });
      await sql`UPDATE invoices SET data_sprzedazy = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    if ("termin_platnosci" in body) {
      const v = dateOrNull(body.termin_platnosci);
      if (v === undefined) return NextResponse.json({ error: "invalid termin_platnosci" }, { status: 400 });
      await sql`UPDATE invoices SET termin_platnosci = ${v}, updated_at = now() WHERE id = ${id};`;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/invoices/:id] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd zapisu faktury: ${message}` }, { status: 500 });
  }
}

/** DELETE /api/invoices/:id — usuwa fakturę (kaskadowo pozycje). Wystawionej
 * faktury (ma nadany `numer`) NIE wolno fizycznie usunąć — zostawiłoby to
 * dziurę w numeracji, niezgodną z wymogiem jej ciągłości (art. 106e ustawy o
 * VAT). Zamiast tego trzeba ustawić status "Anulowana". Tylko szkice (bez
 * numeru) można kasować bez ograniczeń. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureInvoicesSchema();
  const sql = getSql();
  const rows = await sql`SELECT numer FROM invoices WHERE id = ${id};`;
  const invoice = rows[0];
  if (!invoice) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (invoice.numer) {
    return NextResponse.json(
      { error: "Nie można usunąć wystawionej faktury (zostawiłoby to dziurę w numeracji) — ustaw status na „Anulowana”." },
      { status: 400 }
    );
  }
  await sql`DELETE FROM invoices WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
