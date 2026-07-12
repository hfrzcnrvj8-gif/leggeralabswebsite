import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureInvoicesSchema, logClientEvent, type Sql } from "@/lib/db";
import { INVOICE_TYPE_LABEL, type InvoiceDocType } from "@/lib/invoices";
import { isAuthed } from "@/lib/auth";
import { formatInvoiceNumber } from "@/lib/invoices";
import { fetchNbpRateBeforeDate } from "@/lib/nbp";

export const runtime = "nodejs";

function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Data z bazy potrafi wrócić jako JS Date (część sterowników pg) albo jako
// string "YYYY-MM-DD" — obsłuż oba warianty zamiast zakładać jeden z nich
// (String(new Date(...)).slice(0,10) dawałoby np. "Fri Jul 11", co Postgres
// odrzuci jako niepoprawną datę).
function normalizeDbDate(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return toLocalISO(v);
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

// Kolejny wolny numer w obrębie roku, w osobnej sekwencji dla korekt/proform.
// Wywoływane wewnątrz pętli z retry (patrz POST) — samo w sobie NIE jest
// atomowe (dwa równoczesne wywołania mogą policzyć ten sam numer), ale
// końcowy UPDATE ma unikalny indeks na `numer` (lib/db.ts), więc kolizja
// kończy się błędem 23505, a nie cichym duplikatem — POST wtedy ponawia
// próbę z przeliczonym numerem.
async function computeNextNumer(sql: Sql, inv: Record<string, unknown>, year: number): Promise<string> {
  // Każdy typ dokumentu ma własną serię z prefiksem: zwykła/zaliczkowa faktura
  // → "FV ", korekta → "KOR ", proforma → "PF ". Numeracja ciągła w obrębie
  // roku, liczona tylko w ramach danej serii (prefiksu).
  const prefix = inv.koryguje_id ? "KOR " : inv.typ_dokumentu === "proforma" ? "PF " : "FV ";
  const numbered = await sql`SELECT numer FROM invoices WHERE numer IS NOT NULL AND numer LIKE ${prefix + "%/" + year};`;
  let maxSeq = 0;
  for (const r of numbered) {
    const raw = String(r.numer);
    if (!raw.startsWith(prefix)) continue;
    const m = /^(\d+)\//.exec(raw.slice(prefix.length));
    if (m) maxSeq = Math.max(maxSeq, Number(m[1]));
  }
  return prefix + formatInvoiceNumber(maxSeq + 1, year);
}

/** POST /api/invoices/:id/issue — "wystaw fakturę": nadaje numer, ustawia
 * daty (jeśli puste), status "Wystawiona" i (dla faktur w walucie obcej)
 * kurs NBP do VAT. Numer nadawany dopiero tu, żeby szkice nie zużywały
 * numeracji — każdy typ ma własną serię z prefiksem: faktura/zaliczkowa
 * ("FV n/rok"), korekta ("KOR n/rok"), proforma ("PF n/rok"). Admin-only. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await ensureInvoicesSchema();
    const sql = getSql();

    const rows = await sql`SELECT * FROM invoices WHERE id = ${id};`;
    const inv = rows[0];
    if (!inv) return NextResponse.json({ error: "not found" }, { status: 404 });

    const itemCount = await sql`SELECT COUNT(*)::int AS n FROM invoice_items WHERE invoice_id = ${id};`;
    if (Number(itemCount[0]?.n ?? 0) === 0) {
      return NextResponse.json({ error: "Faktura bez pozycji — dodaj co najmniej jedną pozycję." }, { status: 400 });
    }

    // Korekta bez przyczyny jest bezużyteczna — KSeF (FA(3)) wymaga
    // PrzyczynaKorekty, więc blokujemy już na wystawieniu, żeby nie powstała
    // korekta, której potem nie da się wysłać. Guard po stronie serwera jest
    // autorytatywny (UI też wyłącza przycisk, ale to tylko wygoda).
    if (inv.koryguje_id && !String(inv.przyczyna_korekty ?? "").trim()) {
      return NextResponse.json(
        { error: "Podaj przyczynę korekty — jest wymagana do wystawienia i wysyłki do KSeF." },
        { status: 400 }
      );
    }

    // Pozycja z ilością 0/ujemną jest niepoprawna w FA(3) (P_8B > 0) i zostałaby
    // odrzucona przez KSeF. W korekcie usunięcie usługi robi się przez skasowanie
    // pozycji (🗑), nie przez wyzerowanie ilości — blokujemy, żeby nie powstała
    // wystawiona (i już niezmienna) korekta, której nie da się wysłać.
    const badQty = await sql`SELECT nazwa FROM invoice_items WHERE invoice_id = ${id} AND ilosc <= 0 LIMIT 1;`;
    if (badQty[0]) {
      const nazwa = String(badQty[0].nazwa || "?");
      return NextResponse.json(
        {
          error: inv.koryguje_id
            ? `Pozycja „${nazwa}" ma ilość 0 — w korekcie usuń taką pozycję (🗑) zamiast zerować ilość.`
            : `Pozycja „${nazwa}" ma ilość 0 — ustaw ilość większą od zera.`,
        },
        { status: 400 }
      );
    }

    const today = new Date();
    const year = today.getFullYear();

    const settingsRows = await sql`SELECT domyslny_termin_dni, vat_payer FROM company_settings WHERE id = 'default';`;
    const terminDni = Number(settingsRows[0]?.domyslny_termin_dni ?? 14);
    const vatPayer = Boolean(settingsRows[0]?.vat_payer);

    const dataWyst = normalizeDbDate(inv.data_wystawienia) ?? toLocalISO(today);
    const dataSprz = normalizeDbDate(inv.data_sprzedazy) ?? dataWyst;
    const termin = normalizeDbDate(inv.termin_platnosci) ?? toLocalISO(new Date(today.getTime() + terminDni * 86400000));

    // Kurs NBP dla VAT na fakturze w walucie obcej (wymóg ustawy o VAT) —
    // liczony raz, przy wystawieniu; jeśli już zapisany (np. ponowne
    // wystawienie), nie nadpisuj. Nieudany fetch nie blokuje wystawienia.
    // Kurs bierzemy sprzed daty SPRZEDAŻY (obowiązek podatkowy powstaje wg
    // niej, art. 31a ustawy o VAT), nie sprzed daty wystawienia — te dwie
    // daty często się różnią (np. usługa wykonana pod koniec miesiąca,
    // faktura wystawiona kilka dni później).
    let kursNbp = inv.kurs_nbp != null ? Number(inv.kurs_nbp) : null;
    let kursNbpData = normalizeDbDate(inv.kurs_nbp_data);
    let kursNbpTabela = typeof inv.kurs_nbp_tabela === "string" ? inv.kurs_nbp_tabela : null;
    if (kursNbp == null && vatPayer && inv.waluta && inv.waluta !== "PLN") {
      const rate = await fetchNbpRateBeforeDate(String(inv.waluta), dataSprz);
      if (rate) {
        kursNbp = rate.kurs;
        kursNbpData = rate.data;
        kursNbpTabela = rate.tabela;
      }
    }

    // Numer: zachowaj istniejący, jeśli już nadany (ponowne wystawienie).
    // W przeciwnym razie policz i spróbuj zapisać — z retry na wypadek, gdy
    // dwie równoczesne prośby "Wystaw fakturę" policzą ten sam numer
    // (chroni przed tym unikalny indeks na `numer`, patrz computeNextNumer).
    let numer = typeof inv.numer === "string" && inv.numer ? inv.numer : null;
    const MAX_ATTEMPTS = 5;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const candidate = numer ?? (await computeNextNumer(sql, inv, year));
      try {
        await sql`
          UPDATE invoices
          SET numer = ${candidate}, status = 'Wystawiona',
              data_wystawienia = ${dataWyst}, data_sprzedazy = ${dataSprz}, termin_platnosci = ${termin},
              kurs_nbp = ${kursNbp}, kurs_nbp_data = ${kursNbpData}, kurs_nbp_tabela = ${kursNbpTabela},
              updated_at = now()
          WHERE id = ${id};
        `;
        numer = candidate;
        break;
      } catch (err) {
        const code = (err as { code?: string } | null)?.code;
        if (numer === null && code === "23505" && attempt < MAX_ATTEMPTS) continue; // kolizja numeru — przelicz i ponów
        throw err;
      }
    }
    const clientId = typeof inv.client_id === "string" ? inv.client_id : null;
    const typLabel = INVOICE_TYPE_LABEL[(inv.typ_dokumentu as InvoiceDocType) ?? "faktura"];
    await logClientEvent(sql, clientId, "invoice_issued", `Wystawiono: ${typLabel} nr ${numer}`);

    return NextResponse.json({ ok: true, numer });
  } catch (err) {
    // Nie połykaj błędu w generyczny 500 — pokaż realny powód w toaście, żeby
    // dało się to zdiagnozować bez dostępu do logów produkcyjnych.
    console.error("[POST /api/invoices/:id/issue] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd wystawiania faktury: ${message}` }, { status: 500 });
  }
}
