import { NextRequest, NextResponse } from "next/server";
import { ensureHubSchema, ensureLeadsSchema, ensureClientsSchema, ensureInvoicesSchema, ensureContractsSchema, ensureOffersSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import {
  isRegulaPropozycji,
  odrzucPropozycje,
  odrzuconePropozycje,
  przywrocPropozycje,
  wykonajPropozycje,
  zbierzPropozycje,
  type ModulPropozycji,
} from "@/lib/propozycje";

export const runtime = "nodejs";

const MODULY: ModulPropozycji[] = ["projects", "leads", "clients", "invoices"];

/** Wszystkie schematy, których dotykają reguły — propozycja o kliencie po
 *  opłaconej fakturze pyta o dwie tabele naraz. */
async function schematy(): Promise<void> {
  await ensureHubSchema();
  await ensureLeadsSchema();
  await ensureClientsSchema();
  await ensureInvoicesSchema();
  // Umowy doszły z regułą A8 („szkic faktury a podpisany aneks") — pyta
  // o `contracts` i `invoice_items` w jednym zapytaniu.
  await ensureContractsSchema();
  // Oferty doszły z regułą B1 („odrzucona oferta domyka leada", krok 4).
  await ensureOffersSchema();
}

/** GET /api/hub/propozycje?modul=projects — komplet skutków zdarzenia, które
 *  panel proponuje właścicielowi (Faza 3). Bez `modul` — wszystkie. Admin-only. */
export async function GET(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await schematy();

  const param = req.nextUrl.searchParams.get("modul");
  const modul = MODULY.find((m) => m === param);
  const stan = await zbierzPropozycje(modul);

  // Lista odrzuconych tylko na jawne żądanie — Pulpit jej nie potrzebuje,
  // a jest to widok „co świadomie odłożyłem", nie „co mam do zrobienia".
  const zOdrzuconymi = req.nextUrl.searchParams.get("odrzucone") === "1";
  return NextResponse.json({
    ...stan,
    odrzucone: zOdrzuconymi ? await odrzuconePropozycje() : undefined,
  });
}

/** POST /api/hub/propozycje — decyzja właściciela o jednej propozycji.
 *
 *  `decyzja: "zrob"` wykonuje skutek, `"odrzuc"` zapisuje trwałe „nie teraz"
 *  (na zawsze dla tej pary — decyzja właściciela), `"przywroc"` je cofa.
 *  Admin-only. */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid payload" }, { status: 400 });

  const regula = body.regula;
  const rekordId = typeof body.rekordId === "string" ? body.rekordId.trim() : "";
  const decyzja = body.decyzja;
  if (!isRegulaPropozycji(regula)) return NextResponse.json({ error: "Nieznana propozycja." }, { status: 400 });
  if (!rekordId) return NextResponse.json({ error: "Brak rekordu, którego dotyczy propozycja." }, { status: 400 });
  // „zrob-alt" — druga droga wyjścia (krok 4, B1: „wróć za 3 miesiące" zamiast
  // „zamknij lead"). Osobna decyzja, a nie pole obok „zrob", żeby lista
  // dopuszczalnych wartości dalej była JEDNYM wyliczeniem — warunek pisany
  // przez wyliczenie dozwolonego, nie wykluczanie zakazanego.
  if (decyzja !== "zrob" && decyzja !== "zrob-alt" && decyzja !== "odrzuc" && decyzja !== "przywroc") {
    return NextResponse.json({ error: "Nieznana decyzja." }, { status: 400 });
  }

  await schematy();

  if (decyzja === "odrzuc") {
    await odrzucPropozycje(regula, rekordId);
    return NextResponse.json({ ok: true, komunikat: "Odłożone — ta propozycja już nie wróci." });
  }
  if (decyzja === "przywroc") {
    await przywrocPropozycje(regula, rekordId);
    return NextResponse.json({ ok: true, komunikat: "Propozycja przywrócona." });
  }

  const wynik = await wykonajPropozycje(regula, rekordId, decyzja === "zrob-alt" ? "alt" : "glowny");
  // 409, nie 400: żądanie było poprawne, tylko stan zdążył się zmienić —
  // panel ma na to odpowiedzieć odświeżeniem listy, a nie komunikatem o błędzie.
  if (!wynik.ok) return NextResponse.json({ error: wynik.komunikat }, { status: 409 });
  return NextResponse.json({ ok: true, komunikat: wynik.komunikat });
}
