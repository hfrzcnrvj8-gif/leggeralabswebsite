import { NextRequest, NextResponse } from "next/server";
import { notify } from "@/lib/notificationLog";
import { czyLiczycJakoOtwarcie } from "@/lib/publicVisit";
import { logClientEvent } from "@/lib/db";
import { getSql, ensureContractsSchema } from "@/lib/db";
import { pickFields, CONTRACT_PUBLIC_FIELDS, COMPANY_SETTINGS_PUBLIC_FIELDS } from "@/lib/publicFields";
import { SHARE_LINK_REVOKED_MESSAGE } from "@/lib/shareLinks";
import { CONTRACT_ZAWSZE_ZYWE } from "@/lib/contracts";

export const runtime = "nodejs";

/** GET /api/contracts/public/:token — podgląd dokumentu dla drugiej strony,
 * bez logowania (link wysyłany mailem). Token pełni rolę hasła-w-linku —
 * wzorem app/api/offers/public/[token]. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await ensureContractsSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM contracts WHERE share_token = ${token} AND status != 'Szkic';`;
  const contract = rows[0];
  if (!contract) return NextResponse.json({ error: "not found" }, { status: 404 });
  // 410 Gone, nie 404 (Moduł 40) — dokument istnieje, dostęp odebrany.
  if (contract.share_revoked_at) return NextResponse.json({ error: SHARE_LINK_REVOKED_MESSAGE }, { status: 410 });
  // Ślad otwarcia — 1:1 z ofertami (Moduł 57 + jego audyt). Po wysyłce umowy
  // zapadała cisza absolutna: właściciel nie wiedział, czy druga strona w ogóle
  // otworzyła link, więc „cisza od 12 dni" znaczyła naraz „nie przeczytał"
  // i „czyta i się zastanawia". Automaty (skanery bramek pocztowych, podglądy
  // linków) NIE liczą się jako otwarcie — patrz lib/publicVisit.ts. Zapis nie
  // blokuje odpowiedzi: gdyby padł, dokument i tak się pokaże.
  const pierwszeOtwarcie = !contract.otwarta_at;
  const zamkniety = contract.status === "Podpisana" || contract.status === "Odrzucona";
  if (czyLiczycJakoOtwarcie(req.headers)) {
    try {
      await sql`
        UPDATE contracts SET
          otwarta_at = COALESCE(otwarta_at, now()),
          ostatnio_otwarta_at = now(),
          liczba_otwarc = liczba_otwarc + 1
        WHERE id = ${contract.id};
      `;
      if (pierwszeOtwarcie && !zamkniety) {
        const label = contract.typ === "nda" ? "NDA" : contract.typ === "aneks" ? "aneks" : "umowę";
        await notify({
          kind: "contract_signed",
          title: `Druga strona otworzyła ${label}`,
          body: `${contract.klient_nazwa || "Kontrahent"} właśnie zajrzał do dokumentu — jeśli coś w zapisach budzi wątpliwości, to jest moment na telefon.`,
          entity: "contract",
          entityId: String(contract.id),
          dedupeKey: `contract_opened:${contract.id}`,
        });
        await logClientEvent(
          sql,
          typeof contract.client_id === "string" ? contract.client_id : null,
          "contract_sent",
          `Druga strona otworzyła dokument do podpisu`,
          null,
          String(contract.id)
        );
      }
    } catch (err) {
      console.error("[GET /api/contracts/public/:token] nie udało się zapisać otwarcia", err);
    }
  }

  const settings = await sql`SELECT * FROM company_settings WHERE id = 'default';`;

  // Druga strona widzi MIGAWKĘ z chwili wysyłki, nie dane żywe (audyt
  // Modułu 11). Umowa jest edytowalna aż do podpisu, więc bez tego dokument
  // pod linkiem zmieniał się razem z bazą — a przy sporze nie było czego
  // pokazać. Fallback na dane żywe dotyczy umów wysłanych przed tą zmianą.
  //
  // KOLEJNOŚĆ SCALANIA: migawka jest podstawą, z wiersza dokładamy wyłącznie
  // `CONTRACT_ZAWSZE_ZYWE`. Odwrotna kolejność unieważnia migawkę po cichu —
  // na tym poległa pierwsza wersja tej funkcji w ofertach.
  const migawka = (contract.migawka ?? null) as Record<string, unknown> | null;
  const widok = migawka
    ? {
        ...migawka,
        ...Object.fromEntries(
          CONTRACT_ZAWSZE_ZYWE.map((k) => [k, (contract as Record<string, unknown>)[k]])
        ),
      }
    : contract;

  // Biała lista pól (lib/publicFields.ts) — bez accepted_ip i
  // accepted_user_agent osoby podpisującej (Audyt 1, ustalenie 5).
  return NextResponse.json({
    contract: { ...pickFields(widok, CONTRACT_PUBLIC_FIELDS), cena: Number(widok.cena) },
    settings: settings[0] ? pickFields(settings[0], COMPANY_SETTINGS_PUBLIC_FIELDS) : null,
  });
}
