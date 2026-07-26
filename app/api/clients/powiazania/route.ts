import { NextResponse } from "next/server";
import {
  getSql,
  ensureClientsSchema,
  ensureHubSchema,
  ensureOffersSchema,
  ensureInvoicesSchema,
  ensureContractsSchema,
} from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/clients/powiazania — co jest przypięte do klientów, w jednym
 * żądaniu (Moduł 54, krok 3c).
 *
 * Powstało dla apki: menu przytrzymania klienta („Otwórz powiązane") składa
 * listę lokalnie, więc do 2026-07-26 apka przy każdym uruchomieniu dociągała
 * CZTERY pełne listy dokumentów (`dociagnijDokumentyDoPowiazan`), żeby menu nie
 * pokazywało pół prawdy.
 *
 * Te cztery listy robiły jednak DWIE rzeczy — zasilały też liczniki przy
 * Ofertach/Umowach/Fakturach w pasku bocznym iPada i w „Więcej". Dlatego ta
 * trasa zwraca jedno i drugie: powiązania per klient **oraz** liczby wszystkich
 * dokumentów. Bez tych liczb podmiana zgasiłaby liczniki do zera aż do wejścia
 * w moduł — czyli naprawiłaby jedno milczenie, robiąc drugie.
 *
 * `liczby` celowo liczą CAŁE tabele, nie tylko dokumenty z klientem: liczniki
 * w apce pokazują długość pełnej listy, a oferta czy faktura bez przypisanego
 * klienta jest normalna (szkic, sprzedaż jednorazowa).
 *
 * Dla umów `tytul` to surowe `typ` ("umowa"/"nda") — etykietę robi apka
 * (`Umowa.etykietaTypu`), żeby reguła nazewnicza została w JEDNYM miejscu.
 */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureClientsSchema();
  await ensureHubSchema();
  await ensureOffersSchema();
  await ensureInvoicesSchema();
  await ensureContractsSchema();
  const sql = getSql();

  const [powiazania, liczbyRows] = await Promise.all([
    // Jedno zapytanie na cztery tabele. `COALESCE` zamiast NULL-a, żeby model
    // po drugiej stronie nie musiał rozstrzygać braku tytułu — pusty tytuł jest
    // podmieniany na etykietę zastępczą dopiero w widoku.
    sql`
      SELECT client_id, 'oferta' AS rodzaj, id, COALESCE(tytul, '') AS tytul, COALESCE(status, '') AS status, created_at
      FROM offers WHERE client_id IS NOT NULL
      UNION ALL
      SELECT client_id, 'faktura' AS rodzaj, id, COALESCE(numer, '') AS tytul, COALESCE(status, '') AS status, created_at
      FROM invoices WHERE client_id IS NOT NULL
      UNION ALL
      SELECT client_id, 'umowa' AS rodzaj, id, COALESCE(typ, '') AS tytul, COALESCE(status, '') AS status, created_at
      FROM contracts WHERE client_id IS NOT NULL
      UNION ALL
      SELECT client_id, 'projekt' AS rodzaj, id, COALESCE(tytul, '') AS tytul, COALESCE(status, '') AS status, created_at
      FROM projects WHERE client_id IS NOT NULL
      ORDER BY created_at DESC;
    `,
    sql`
      SELECT
        (SELECT COUNT(*) FROM offers)::int AS oferty,
        (SELECT COUNT(*) FROM invoices)::int AS faktury,
        (SELECT COUNT(*) FROM contracts)::int AS umowy,
        (SELECT COUNT(*) FROM projects)::int AS projekty;
    `,
  ]);

  const l = (liczbyRows[0] ?? {}) as Record<string, unknown>;
  return NextResponse.json({
    powiazania,
    liczby: {
      oferty: Number(l.oferty ?? 0),
      faktury: Number(l.faktury ?? 0),
      umowy: Number(l.umowy ?? 0),
      projekty: Number(l.projekty ?? 0),
    },
  });
}
