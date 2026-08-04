import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { celDokumentu, getSql, ensureContractsSchema, logZdarzenieDokumentu } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { type Contract, type PoprzednieWarunki } from "@/lib/contracts";
import { warunkiZlecenia } from "@/lib/warunkiObowiazujace";

export const runtime = "nodejs";

/** POST /api/contracts/:id/aneks — sporządź aneks do PODPISANEJ umowy.
 *
 * Trzeci brat `POST /api/invoices/:id/correct` (korekta) i
 * `POST /api/offers/:id/version` (nowa wersja): jedyna droga wyjścia
 * z dokumentu zamkniętego blokadą. Do audytu Modułu 57 tej drogi nie było —
 * `lib/blokadaDokumentu.ts` odsyłał po aneks, którego system nie znał.
 *
 * Różnice wobec dwóch pozostałych, wszystkie zamierzone:
 *
 *  - **Oryginał NIE schodzi z afisza.** Nowa wersja oferty oznacza
 *    poprzedniczkę `superseded_at` i wyjmuje ją z liczników. Aneksowana umowa
 *    dalej obowiązuje — obie strony ją podpisały. Zostaje „Podpisana" i liczy
 *    się wszędzie, gdzie się liczyła (np. w `signedContractRate`).
 *  - **Aneks startuje z warunkami umowy-matki, nie z pustymi polami.** Bo
 *    zmienia się zwykle jedna rzecz z czterech, a przepisywanie reszty ręcznie
 *    to proszenie się o literówkę w dokumencie, który idzie do podpisu.
 *  - **NDA nie da się aneksować.** NDA nie ma warunków handlowych
 *    (zakres/cena/termin są puste), więc aneks nie miałby czego zmieniać.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await ensureContractsSchema();
    const sql = getSql();

    const rows = await sql`SELECT * FROM contracts WHERE id = ${id};`;
    const src = rows[0] as Contract | undefined;
    if (!src) return NextResponse.json({ error: "not found" }, { status: 404 });

    if (src.typ === "nda") {
      return NextResponse.json(
        { error: "NDA nie ma warunków handlowych, więc nie ma czego aneksować. Potrzebujesz innych zapisów? Sporządź nowe NDA." },
        { status: 409 }
      );
    }
    // Aneks do aneksu byłby łańcuchem, w którym „było" wskazuje na dokument,
    // którego klient może nie mieć pod ręką. Kolejny aneks robi się zawsze do
    // umowy-matki — a jego „było" bierze warunki OBOWIĄZUJĄCE, czyli te
    // z ostatniego podpisanego aneksu (niżej).
    if (src.typ === "aneks") {
      return NextResponse.json(
        { error: "To już jest aneks. Kolejny aneks sporządza się do samej umowy — otwórz ją i użyj „Sporządź aneks”." },
        { status: 409 }
      );
    }
    if (src.status !== "Podpisana") {
      return NextResponse.json(
        { error: "Aneks dotyczy umowy PODPISANEJ — tę wciąż da się edytować wprost, bez aneksu." },
        { status: 409 }
      );
    }

    // Warunki OBOWIĄZUJĄCE, nie pierwotne. Przy drugim aneksie „było" musi
    // pokazywać to, co zostało ustalone pierwszym — inaczej dokument twierdzi,
    // że zmienia cenę z pierwotnej, choć strony dawno umówiły się na inną.
    //
    // Ta reguła mieszkała TUTAJ, zaszyta w trasie. Od kroku 3 planu po drugim
    // przejściu żyje w `lib/warunkiObowiazujace.ts` i odpowiada też Zdrowiu,
    // propozycjom faktury i terminowi projektu — bo to jedno pytanie, nie cztery.
    const warunki = await warunkiZlecenia(sql, id);
    if (!warunki) return NextResponse.json({ error: "not found" }, { status: 404 });

    // Dedupe szkicu (audyt Modułu 11) — ta sama lekcja co przy NDA na leadzie
    // (Moduł 51): przycisk bez śladu po pierwszym kliknięciu mnoży dokumenty.
    // Dwa kliknięcia „Sporządź aneks" dawały „Aneks nr 1" i „Aneks nr 2",
    // oba puste i nie do odróżnienia na liście. Wysłany albo podpisany aneks
    // NIE blokuje — kolejna zmiana warunków to naprawdę nowy dokument.
    const szkicAneksu = (
      await sql`
        SELECT id, aneks_nr FROM contracts
        WHERE parent_contract_id = ${id} AND typ = 'aneks' AND status = 'Szkic'
        ORDER BY aneks_nr DESC LIMIT 1;
      `
    )[0];
    if (szkicAneksu) {
      return NextResponse.json({
        ok: true,
        id: String(szkicAneksu.id),
        aneks_nr: Number(szkicAneksu.aneks_nr),
        existing: true,
      });
    }

    // Numer rośnie po WSZYSTKICH aneksach tej umowy, także szkicach — dwa
    // dokumenty „Aneks nr 1" do jednej umowy byłyby nie do rozróżnienia
    // w rozmowie, nawet gdyby jeden z nich nigdy nie poszedł.
    const maxNr = (await sql`
      SELECT COALESCE(MAX(aneks_nr), 0) AS nr FROM contracts WHERE parent_contract_id = ${id};
    `)[0];
    const nr = Number(maxNr?.nr ?? 0) + 1;

    // `reference`/`zawarta` to UMOWA-MATKA — tego dotyczy aneks i tak brzmi
    // jego nagłówek. `zrodlo` to dokument, z którego wzięto CZTERY wartości
    // niżej. Do 2026-08-04 była tu tylko pierwsza para, więc aneks nr 2
    // cytował kwotę z aneksu nr 1, powołując się na umowę, w której jej nie
    // ma (A7). Dwa różne pytania, dwie różne odpowiedzi.
    const poprzednie: PoprzednieWarunki = {
      reference: warunki.umowa.reference,
      zawarta: String(src.created_at),
      zakres_prac: warunki.zakres_prac,
      cena: warunki.cena,
      waluta: warunki.waluta,
      termin_realizacji: warunki.termin_realizacji,
      zrodlo:
        warunki.zrodlo.typ === "aneks"
          ? {
              reference: warunki.zrodlo.reference,
              zawarta: warunki.zrodlo.zawarta,
              aneks_nr: warunki.zrodlo.aneksNr ?? 0,
              opis: warunki.zrodlo.opis,
            }
          : null,
    };

    const newId = randomUUID();
    await sql`
      INSERT INTO contracts (
        id, typ, status, lead_id, client_id, project_id, offer_id,
        klient_nazwa, klient_nip, klient_ulica, klient_kod, klient_miasto, klient_kraj, klient_email,
        zakres_prac, cena, waluta, termin_realizacji, jezyk,
        parent_contract_id, aneks_nr, poprzednie
      )
      VALUES (
        ${newId}, 'aneks', 'Szkic', ${src.lead_id}, ${src.client_id}, ${src.project_id}, ${src.offer_id},
        ${src.klient_nazwa}, ${src.klient_nip}, ${src.klient_ulica}, ${src.klient_kod}, ${src.klient_miasto}, ${src.klient_kraj}, ${src.klient_email},
        ${poprzednie.zakres_prac}, ${poprzednie.cena}, ${poprzednie.waluta}, ${poprzednie.termin_realizacji}, ${src.jezyk},
        ${id}, ${nr}, ${JSON.stringify(poprzednie)}
      );
    `;

    await logZdarzenieDokumentu(
      sql,
      celDokumentu(src),
      "contract_created",
      `Sporządzono aneks nr ${nr} do umowy ${poprzednie.reference}`,
      null,
      newId
    );

    return NextResponse.json({ ok: true, id: newId, aneks_nr: nr });
  } catch (err) {
    console.error("[POST /api/contracts/:id/aneks] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd tworzenia aneksu: ${message}` }, { status: 500 });
  }
}
