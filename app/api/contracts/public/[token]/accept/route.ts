import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureContractsSchema, logClientEvent } from "@/lib/db";
import { notify } from "@/lib/notificationLog";
import { SHARE_LINK_REVOKED_MESSAGE } from "@/lib/shareLinks";
import { CONTRACT_TYP_LABEL, type ContractTyp } from "@/lib/contracts";
import { HAMULEC_DOKUMENT_PUBLICZNY, odciskZadania, odnotujProbe, sprawdzHamulec, zglosPrzekroczenie } from "@/lib/rateLimit";
import { projektPoPodpisieUmowy } from "@/lib/przepisanie";
import { zdanieWyrownaniaTerminu } from "@/lib/warunkiObowiazujace";
import { todayLocalISO } from "@/lib/dates";

export const runtime = "nodejs";

/** POST /api/contracts/public/:token/accept — e-podpis drugiej strony
 * (klient akceptujący Umowę, albo druga strona podpisująca NDA). Wzorem
 * app/api/offers/public/[token]/accept — zapisuje imię, IP, user-agent jako
 * dowód złożenia oświadczenia woli. Prostszy niż akceptacja oferty: dokument
 * już istnieje (nic nowego nie trzeba tworzyć), więc wystarczy jedno
 * "claim"-style UPDATE bez transakcji na wielu tabelach. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Hamulec (audyt Modułu 57) — ten sam co przy e-podpisie oferty. Tu stawka
  // jest najwyższa z trzech: to jest złożenie podpisu pod umową.
  const odcisk = odciskZadania(req.headers);
  const limit = await sprawdzHamulec(HAMULEC_DOKUMENT_PUBLICZNY, odcisk);
  if (!limit.dozwolone) {
    await zglosPrzekroczenie(HAMULEC_DOKUMENT_PUBLICZNY, limit.globalny);
    return NextResponse.json(
      { error: `Zbyt wiele prób. Spróbuj ponownie za ${limit.zaMinut} min.` },
      { status: 429, headers: { "Retry-After": String(limit.zaMinut * 60) } }
    );
  }
  await odnotujProbe(HAMULEC_DOKUMENT_PUBLICZNY, odcisk);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  if (!name) return NextResponse.json({ error: "Podaj imię i nazwisko." }, { status: 400 });
  // Stanowisko/funkcja osoby podpisującej (2026-07-27). Samo imię nie mówiło,
  // czy podpisała osoba uprawniona do reprezentacji — a to pierwsze pytanie
  // przy sporze. Pole jest OPCJONALNE: wymuszanie go zatrzymałoby podpis
  // kogoś, kto po prostu nie wie, co wpisać.
  const role = typeof body.role === "string" ? body.role.trim().slice(0, 200) : "";

  await ensureContractsSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM contracts WHERE share_token = ${token} AND status != 'Szkic';`;
  const contract = rows[0];
  if (!contract) return NextResponse.json({ error: "not found" }, { status: 404 });
  // Moduł 40: to najważniejsze z sześciu miejsc. Bez tego warunku ktoś ze
  // starym linkiem mógłby PODPISAĆ umowę mimo unieważnienia.
  if (contract.share_revoked_at) return NextResponse.json({ error: SHARE_LINK_REVOKED_MESSAGE }, { status: 410 });
  // Dokument ZAMKNIĘTY — druga połowa znaleziska A1 z drugiego przejścia,
  // znaleziona przy jego naprawianiu po stronie ofert. Trasa pilnowała tylko
  // stanu „Podpisana" (przez claim niżej), więc umowę ODRZUCONĄ dało się
  // starym linkiem podpisać: zmierzone `Odrzucona → Podpisana`, 200, z zapisem
  // `accepted_by_name`. Skutek cięższy niż przy ofercie — z martwego dokumentu
  // robi się dokument wiążący.
  if (contract.status === "Odrzucona") {
    return NextResponse.json(
      { error: "Ten dokument został zamknięty i nie da się go już podpisać.", powod: "odrzucona" },
      { status: 409 }
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;

  // Jedyny stan, z którego wolno przejść w „Podpisana". Sformułowanie przez
  // wyliczenie dozwolonego, nie przez wykluczanie kolejnych zakazanych —
  // wykluczanie było właśnie tym, co przepuściło „Odrzuconą".
  const claimed = await sql`
    UPDATE contracts SET status = 'Podpisana', accepted_at = now(),
      accepted_by_name = ${name}, accepted_by_role = ${role || null},
      accepted_ip = ${ip}, accepted_user_agent = ${userAgent}, updated_at = now()
    WHERE id = ${contract.id} AND status = 'Wysłana'
    RETURNING id;
  `;
  if (claimed.length === 0) return NextResponse.json({ error: "Dokument już podpisany." }, { status: 409 });

  const clientId = typeof contract.client_id === "string" ? contract.client_id : null;
  // Słownik typów — patrz komentarz w contracts/[id]/accept. Bez tego klient
  // podpisujący ANEKS dzwonił powiadomieniem „Umowa podpisana" i taki sam wpis
  // szedł na oś czasu, obok wciąż obowiązującej umowy o tej samej nazwie.
  const label = CONTRACT_TYP_LABEL[contract.typ as ContractTyp] ?? "Umowa";
  await logClientEvent(sql, clientId, "contract_signed", `${label}: podpis złożył(a) ${name}${role ? ` (${role})` : ""}`, null, contract.id);

  // Centrum powiadomień (Moduł 24 + 31) — TYLKO tutaj, na publicznej trasie.
  // Bliźniaczy `contracts/[id]/accept` to ręczne "Oznacz jako podpisaną",
  // czyli ruch właściciela: wie, że kliknął, więc dzwonienie mu o tym byłoby
  // szumem (ta sama zasada co przy invoice_paid — dzwoni to, co panel zrobił
  // sam). Podpis drugiej strony może paść w nocy i bez tego wpisu właściciel
  // dowiadywał się o nim dopiero wchodząc na Umowy.
  // Ten sam skutek co przy podpisie odnotowanym w panelu (luka B6) — projekt
  // dostaje daty z umowy i wychodzi z „Planowania". Patrz lib/przepisanie.ts.
  const skutek = await projektPoPodpisieUmowy(sql, contract, todayLocalISO());
  // Ślad wyrównania terminu (A6). Wyrównanie jest automatem — decyzja
  // właściciela — więc jedyne, co odróżnia je od cichej podmiany, to ten wpis.
  if (skutek.wyrownanieTerminu) {
    await logClientEvent(
      sql,
      clientId,
      "project_deadline_aligned",
      zdanieWyrownaniaTerminu(skutek.wyrownanieTerminu),
      null,
      typeof contract.project_id === "string" ? contract.project_id : null
    );
  }

  const contractId = String(contract.id);
  await notify({
    kind: "contract_signed",
    title: `Podpis pod dokumentem: ${label.toLowerCase()}`,
    body: `${name} złożył(a) podpis pod dokumentem${contract.klient_nazwa ? ` — ${contract.klient_nazwa}` : ""}.${
      skutek.zmienionyStatus ? " Projekt ruszył — jest już „W trakcie”." : ""
    }`,
    entity: "contract",
    entityId: contractId,
    dedupeKey: `contract_signed:${contractId}`,
  });

  return NextResponse.json({ ok: true, acceptedByName: name });
}
