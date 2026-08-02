import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureContractsSchema, logClientEvent } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { blokadaStatusuUmowy, blokadaUmowy, POLA_MIMO_BLOKADY_UMOWY, ruszaTresc } from "@/lib/blokadaDokumentu";
import { naKolumnyDokumentu, odswiezDaneKlientaWSzkicu } from "@/lib/przepisanie";
import { isPlausibleDateString } from "@/lib/projects";
import { DOC_LANGS } from "@/lib/documents";
import {
  CONTRACT_STATUSES,
  CONTRACT_SZABLONY,
  CONTRACT_TYP_LABEL,
  clausesDokumentu,
  isContractRejectReason,
  type ContractTyp,
} from "@/lib/contracts";
import { rejectReasonLabel } from "@/lib/offers";
import { INVOICE_CURRENCIES, zeSlownika } from "@/lib/invoices";

export const runtime = "nodejs";

/** GET /api/contracts/:id — dokument. Admin-only.
 *
 * `clauses` dokłada się tu (nie tylko w `ContractPrint.tsx`) od 2026-07-21 —
 * apka woła WYŁĄCZNIE ten endpoint (nie ma dostępu do publicznego podglądu
 * dla szkiców, ten świadomie odrzuca `status = 'Szkic'`, patrz
 * `app/api/contracts/public/[token]/route.ts`), więc bez tego pola profil
 * umowy w telefonie pokazywał tylko przycisk „Wyślij", bez żadnej treści do
 * przejrzenia przed wysyłką. Stałe klauzule płyną z jednego miejsca
 * (`lib/contracts.ts`) — apka ich nie duplikuje ani nie liczy sama. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureContractsSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM contracts WHERE id = ${id};`;
  const contract = rows[0];
  if (!contract) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Dociągnięcie poprawek z karty klienta, dopóki dokument nie poszedł do
  // drugiej strony i nie jest podpisany (Faza 1, decyzja właściciela
  // 2026-08-02). O „poszło" rozstrzyga `sent_at`, o podpisie `accepted_at` —
  // status jest polem wolnym mimo blokady, więc nie może o tym decydować
  // (ta sama lekcja, co przy blokadzie umowy w audycie Modułu 11).
  const swiezeDane = await odswiezDaneKlientaWSzkicu(sql, "umowa", contract, {
    szkic: !contract.sent_at && !contract.accepted_at,
  });
  if (swiezeDane) Object.assign(contract, naKolumnyDokumentu(swiezeDane));

  // Aneks NIE dostaje przedruku klauzul (audyt Modułu 11). Na wydruku ich nie
  // ma świadomie — obowiązują dalej z umowy-matki, a przedruk sugerowałby, że
  // aneks je zastępuje. Trasa jednak oddawała pełne `CONTRACT_CLAUSES` także
  // aneksowi, więc profil w apce (jedyny czytelnik tego pola) pokazywał pod
  // aneksem 16 klauzul umowy, czyli dokładnie to, czego wydruk unika.
  // Klauzule wg RODZAJU umowy (2026-07-27): szablon wybiera zestaw z jednego,
  // istniejącego katalogu — nie dopisuje nowej treści prawnej. Aneks nie
  // dostaje żadnych (obowiązują z umowy-matki).
  const clauses = clausesDokumentu(String(contract.typ ?? "umowa"), String(contract.szablon ?? ""));

  // Rodzina dokumentu: aneksy tej umowy / umowa-matka tego aneksu. Do audytu
  // Modułu 11 obie strony tego powiązania były niewidoczne poza listą —
  // z umowy nie dało się zobaczyć, że ma aneks (czyli że jej warunki już nie
  // obowiązują w całości), a z aneksu nie było przejścia do umowy.
  const aneksy =
    contract.typ === "aneks"
      ? []
      : await sql`
          SELECT id, aneks_nr, status, cena, waluta, created_at
          FROM contracts WHERE parent_contract_id = ${id} ORDER BY aneks_nr ASC;
        `;
  const matka = contract.parent_contract_id
    ? (
        await sql`SELECT id, typ, status, klient_nazwa, created_at FROM contracts WHERE id = ${contract.parent_contract_id};`
      )[0] ?? null
    : null;

  return NextResponse.json({
    contract: { ...contract, cena: Number(contract.cena) },
    clauses,
    aneksy,
    matka,
  });
}

/** PATCH /api/contracts/:id — aktualizacja pól. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  try {
    await ensureContractsSchema();
    const sql = getSql();

  // Podpisanej umowy nie edytujemy — obie strony mają kopię (decyzja
  // właściciela 2026-07-27, patrz lib/blokadaDokumentu.ts). Zmiana wymaga
  // aneksu, czyli nowego dokumentu.
  const stanUmowy = (await sql`SELECT status, typ, accepted_at, client_id FROM contracts WHERE id = ${id};`)[0];
  if (!stanUmowy) return NextResponse.json({ error: "not found" }, { status: 404 });
  const podpisany = String(stanUmowy.status ?? "") === "Podpisana" || !!stanUmowy.accepted_at;
  const blokada = blokadaUmowy(
    String(stanUmowy.status ?? ""),
    String(stanUmowy.typ ?? ""),
    stanUmowy.accepted_at ? String(stanUmowy.accepted_at) : null
  );
  if (blokada.zablokowane && ruszaTresc(body ?? {}, POLA_MIMO_BLOKADY_UMOWY)) {
    return NextResponse.json({ error: blokada.komunikat }, { status: 409 });
  }

  // Status: zamknięta lista wartości + dwie reguły przejścia
  // (blokadaStatusuUmowy). Do audytu Modułu 11 trasa brała TU dowolny string
  // do 40 znaków — sonda zapisała „ZUPELNIE-DOWOLNY-STRING", co wypada naraz
  // z filtra listy, z koloru pigułki i z każdego licznika po statusie.
  if ("status" in body) {
    const nowy = typeof body.status === "string" ? body.status : "";
    if (!(CONTRACT_STATUSES as string[]).includes(nowy)) {
      return NextResponse.json({ error: `Nieznany status: „${nowy}”.` }, { status: 400 });
    }
    const przejscie = blokadaStatusuUmowy(nowy, podpisany);
    if (przejscie.zablokowane) return NextResponse.json({ error: przejscie.komunikat }, { status: 409 });
  }
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
    const dateOrNull = (v: unknown): string | null | undefined => {
      if (typeof v !== "string") return undefined;
      const t = v.trim();
      if (!t) return null;
      return isPlausibleDateString(t) ? t : undefined;
    };

    // Moduł 22 — powiązania z CRM. Umowa miała cztery kolumny (`lead_id`,
    // `client_id`, `project_id`, `offer_id`) wypełniane WYŁĄCZNIE przy
    // tworzeniu (api/contracts/route.ts), a UI pokazywało je jako chip tylko
    // do odczytu — raz źle przypiętej umowy nie dało się naprawić z panelu.
    // Pusty string / brak wartości = odepnij.
    const linkOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);
    if ("client_id" in body) await sql`UPDATE contracts SET client_id = ${linkOrNull(body.client_id)}, updated_at = now() WHERE id = ${id};`;
    if ("lead_id" in body) await sql`UPDATE contracts SET lead_id = ${linkOrNull(body.lead_id)}, updated_at = now() WHERE id = ${id};`;
    if ("project_id" in body) await sql`UPDATE contracts SET project_id = ${linkOrNull(body.project_id)}, updated_at = now() WHERE id = ${id};`;
    if ("offer_id" in body) await sql`UPDATE contracts SET offer_id = ${linkOrNull(body.offer_id)}, updated_at = now() WHERE id = ${id};`;

    if ("klient_nazwa" in body) await sql`UPDATE contracts SET klient_nazwa = ${str(body.klient_nazwa, 300)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_nip" in body) await sql`UPDATE contracts SET klient_nip = ${str(body.klient_nip, 30)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_ulica" in body) await sql`UPDATE contracts SET klient_ulica = ${str(body.klient_ulica, 300)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_kod" in body) await sql`UPDATE contracts SET klient_kod = ${str(body.klient_kod, 20)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_miasto" in body) await sql`UPDATE contracts SET klient_miasto = ${str(body.klient_miasto, 200)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_kraj" in body) await sql`UPDATE contracts SET klient_kraj = ${str(body.klient_kraj, 100)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_email" in body) await sql`UPDATE contracts SET klient_email = ${str(body.klient_email, 200)}, updated_at = now() WHERE id = ${id};`;
    if ("zakres_prac" in body) await sql`UPDATE contracts SET zakres_prac = ${str(body.zakres_prac, 4000)}, updated_at = now() WHERE id = ${id};`;
    if ("uwagi" in body) await sql`UPDATE contracts SET uwagi = ${str(body.uwagi, 2000)}, updated_at = now() WHERE id = ${id};`;
    if ("waluta" in body) {
      // Bramka dołożona przy audycie FAKTUR (2026-07-31), nie Umów: `waluta`
      // z tej trasy trafia do tego samego `formatMoney`, więc zły kod wywracał
      // listę umów i kartę klienta tak samo jak listę faktur. Oferty miały
      // `isOfferCurrency` od swojego audytu — poprawka nie poszła wtedy przez
      // pozostałe moduły (lekcja Modułu 59: poprawka idzie przez wszystkie
      // moduły naraz).
      const v = zeSlownika(INVOICE_CURRENCIES, body.waluta);
      if (!v) return NextResponse.json({ error: "invalid waluta" }, { status: 400 });
      await sql`UPDATE contracts SET waluta = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    if ("cena" in body) {
      const n = typeof body.cena === "number" && Number.isFinite(body.cena) ? body.cena : 0;
      await sql`UPDATE contracts SET cena = ${n}, updated_at = now() WHERE id = ${id};`;
    }
    if ("status" in body) {
      const nowy = String(body.status);
      const poprzedni = String(stanUmowy.status ?? "");
      const label = CONTRACT_TYP_LABEL[String(stanUmowy.typ ?? "umowa") as ContractTyp] ?? "Umowa";
      if (nowy === "Odrzucona") {
        // Powód pytamy RAZ, w chwili odrzucenia — jak przy ofercie (Moduł 57).
        // Bez tego oś czasu klienta kończyła się na „wysłano umowę", a przy
        // NDA nie było gdzie zapisać, dlaczego kontrahent nie podpisał.
        const powod = isContractRejectReason(body.powod_odrzucenia) ? body.powod_odrzucenia : "";
        const komentarz = str(body.komentarz_odrzucenia, 500);
        await sql`
          UPDATE contracts SET status = ${nowy}, powod_odrzucenia = ${powod},
            komentarz_odrzucenia = ${komentarz}, odrzucona_at = now(), updated_at = now()
          WHERE id = ${id};
        `;
        if (poprzedni !== nowy) {
          const dlaczego = rejectReasonLabel(powod, komentarz);
          const clientId = typeof stanUmowy.client_id === "string" ? stanUmowy.client_id : null;
          await logClientEvent(
            sql,
            clientId,
            "contract_rejected",
            `Druga strona nie podpisała — ${label.toLowerCase()}${dlaczego ? ` (${dlaczego})` : ""}`,
            null,
            id
          );
        }
      } else {
        // Wyjście z „Odrzucona" sprząta powód — inaczej dokumentowi wróconemu
        // do gry zostawałby w profilu nieaktualny napis „Zapisy nie do
        // przyjęcia" (ta sama reguła co w ofertach).
        await sql`
          UPDATE contracts SET status = ${nowy}, updated_at = now(),
            powod_odrzucenia = '', komentarz_odrzucenia = '', odrzucona_at = NULL
          WHERE id = ${id};
        `;
      }
    }
    if ("jezyk" in body) {
      const v = typeof body.jezyk === "string" && (DOC_LANGS as string[]).includes(body.jezyk) ? body.jezyk : "pl";
      await sql`UPDATE contracts SET jezyk = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    // Okres obowiązywania umowy — co innego niż termin realizacji.
    for (const pole of ["obowiazuje_od", "obowiazuje_do"] as const) {
      if (pole in body) {
        const v = dateOrNull(body[pole]);
        if (v === undefined) return NextResponse.json({ error: `invalid ${pole}` }, { status: 400 });
        if (pole === "obowiazuje_od") await sql`UPDATE contracts SET obowiazuje_od = ${v}, updated_at = now() WHERE id = ${id};`;
        else await sql`UPDATE contracts SET obowiazuje_do = ${v}, updated_at = now() WHERE id = ${id};`;
      }
    }
    if ("wypowiedzenie_dni" in body) {
      const n = Math.max(0, Math.min(365, Math.round(Number(body.wypowiedzenie_dni) || 0)));
      await sql`UPDATE contracts SET wypowiedzenie_dni = ${n}, updated_at = now() WHERE id = ${id};`;
    }
    if ("odnawialna" in body) {
      await sql`UPDATE contracts SET odnawialna = ${!!body.odnawialna}, updated_at = now() WHERE id = ${id};`;
    }
    // Pola powierzenia danych (art. 28 RODO) i płatności etapami.
    for (const pole of ["dpa_kategorie_danych", "dpa_kategorie_osob", "dpa_podprocesorzy", "platnosci_opis"] as const) {
      if (pole in body) {
        const v = str(body[pole], 2000);
        if (pole === "dpa_kategorie_danych") await sql`UPDATE contracts SET dpa_kategorie_danych = ${v}, updated_at = now() WHERE id = ${id};`;
        else if (pole === "dpa_kategorie_osob") await sql`UPDATE contracts SET dpa_kategorie_osob = ${v}, updated_at = now() WHERE id = ${id};`;
        else if (pole === "dpa_podprocesorzy") await sql`UPDATE contracts SET dpa_podprocesorzy = ${v}, updated_at = now() WHERE id = ${id};`;
        else await sql`UPDATE contracts SET platnosci_opis = ${v}, updated_at = now() WHERE id = ${id};`;
      }
    }
    if ("zaliczka_procent" in body) {
      // 0–100: „zaliczka 150%" nie jest zaliczką, tylko literówką, która
      // wyszłaby dopiero na dokumencie u klienta.
      const n = Math.max(0, Math.min(100, Math.round(Number(body.zaliczka_procent) || 0)));
      await sql`UPDATE contracts SET zaliczka_procent = ${n}, updated_at = now() WHERE id = ${id};`;
    }
    if ("szablon" in body) {
      // Nieznany szablon zmieniłby zestaw klauzul na pusty — czyli po cichu
      // wystawił dokument bez warunków. Zamknięta lista, jak przy statusie.
      const v = typeof body.szablon === "string" && (CONTRACT_SZABLONY as string[]).includes(body.szablon) ? body.szablon : null;
      if (!v) return NextResponse.json({ error: "Nieznany rodzaj umowy." }, { status: 400 });
      await sql`UPDATE contracts SET szablon = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    if ("termin_realizacji" in body) {
      const v = dateOrNull(body.termin_realizacji);
      if (v === undefined) return NextResponse.json({ error: "invalid termin_realizacji" }, { status: 400 });
      await sql`UPDATE contracts SET termin_realizacji = ${v}, updated_at = now() WHERE id = ${id};`;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/contracts/:id] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd zapisu: ${message}` }, { status: 500 });
  }
}

/** DELETE /api/contracts/:id — tylko dokument, którego nikt jeszcze nie
 * podpisał i do którego nic nie wskazuje.
 *
 * Do audytu Modułu 11 ta trasa kasowała wszystko bez pytania, łącznie
 * z podpisaną umową — czyli dokładnie ten dokument, którego treści `PATCH`
 * broni jako nienaruszalnej. Sonda skasowała podpisaną umowę, do której
 * istniał podpisany aneks: aneks został na liście jako „Aneks nr 2", bez
 * matki i bez śladu, czego dotyczy. Faktura z numerem miała ten zakaz od
 * dawna (`api/invoices/[id]` — „dziura w numeracji"); umowa nie miała żadnego.
 *
 * Pomyłkę w podpisanym dokumencie zamyka się statusem albo aneksem — nie
 * usunięciem, bo drugą kopię ma druga strona. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureContractsSchema();
  const sql = getSql();

  const stan = (await sql`SELECT typ, status, accepted_at FROM contracts WHERE id = ${id};`)[0];
  if (!stan) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (String(stan.status ?? "") === "Podpisana" || stan.accepted_at) {
    const typ = String(stan.typ ?? "");
    const zdanie =
      typ === "nda" ? "NDA jest podpisane" : typ === "aneks" ? "Ten aneks jest podpisany" : "Umowa jest podpisana";
    return NextResponse.json(
      { error: `${zdanie} — drugą kopię ma druga strona, więc dokumentu nie usuwamy. Zmianę warunków wprowadza aneks.` },
      { status: 409 }
    );
  }

  // Umowa z aneksami zostaje nawet jako szkic: `poprzednie` aneksu przeżyje
  // (migawka), ale sam aneks straciłby jedyne powiązanie z dokumentem,
  // do którego się odnosi.
  const dzieci = await sql`SELECT COUNT(*)::int AS n FROM contracts WHERE parent_contract_id = ${id};`;
  const ile = Number(dzieci[0]?.n ?? 0);
  if (ile > 0) {
    return NextResponse.json(
      { error: `Do tej umowy sporządzono ${ile === 1 ? "aneks" : `${ile} aneksy`} — usuń najpierw aneks(y) albo zostaw umowę.` },
      { status: 409 }
    );
  }

  await sql`DELETE FROM contracts WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
