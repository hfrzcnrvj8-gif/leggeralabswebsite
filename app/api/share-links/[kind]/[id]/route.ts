import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { getSql, ensureOffersSchema, ensureContractsSchema, ensureInvoicesSchema, ensureHubSchema } from "@/lib/db";
import { isShareLinkKind, revokeShareLink, regenerateShareLink, type ShareLinkKind } from "@/lib/shareLinks";

export const runtime = "nodejs";

/** POST /api/share-links/:kind/:id — unieważnia publiczny link do dokumentu
 * albo generuje nowy w jego miejsce (Moduł 40). Admin-only.
 *
 * JEDNA trasa na pięć rodzajów tokenów zamiast dziesięciu bliźniaczych: cała
 * ochrona tego panelu to powtórzone `isAuthed()` w każdym uchwycie (patrz
 * CLAUDE.md — nowa trasa w `app/api` jest domyślnie OTWARTA), więc im mniej
 * miejsc, w których można o nie zapomnieć, tym lepiej. Rodzaj jest sprawdzany
 * białą listą (`isShareLinkKind`) i nigdy nie trafia do SQL-a jako tekst —
 * zapytania są rozpisane rodzaj po rodzaju w lib/shareLinks.ts.
 *
 * Ciało: `{ action: "revoke" | "regenerate" }`. Odpowiedź przy "regenerate"
 * zawiera gotowy, NOWY adres — stary od tej chwili zwraca 410. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { kind, id } = await params;
  if (!isShareLinkKind(kind)) return NextResponse.json({ error: "Nieznany rodzaj linku." }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = body.action;
  if (action !== "revoke" && action !== "regenerate") {
    return NextResponse.json({ error: "Nieznana operacja." }, { status: 400 });
  }

  await ensureSchemaFor(kind);
  const sql = getSql();

  if (action === "revoke") {
    const res = await revokeShareLink(sql, kind, id);
    if (!res) return NextResponse.json({ error: "Ten dokument nie ma jeszcze publicznego linku." }, { status: 404 });
    return NextResponse.json({ ok: true, revokedAt: res.revokedAt });
  }

  const res = await regenerateShareLink(sql, kind, id);
  if (!res) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, token: res.token, url: `${req.nextUrl.origin}${await publicPath(kind, res.token, id)}` });
}

async function ensureSchemaFor(kind: ShareLinkKind): Promise<void> {
  if (kind === "offer") return ensureOffersSchema();
  if (kind === "contract") return ensureContractsSchema();
  if (kind === "project") return ensureHubSchema();
  return ensureInvoicesSchema();
}

/** Ścieżka publicznego podglądu. Umowa i NDA to ta sama tabela i ten sam
 * komponent wydruku, ale osobny segment URL (czytelność linku w mailu), więc
 * typ trzeba dociągnąć z bazy. */
async function publicPath(kind: ShareLinkKind, token: string, id: string): Promise<string> {
  switch (kind) {
    case "offer":
      return `/pl/oferta/${token}`;
    case "invoice":
      return `/pl/faktura/${token}`;
    case "wezwanie":
      return `/pl/wezwanie/${token}`;
    case "project":
      return `/pl/opinia/${token}`;
    case "contract": {
      const rows = await getSql()`SELECT typ FROM contracts WHERE id = ${id};`;
      return rows[0]?.typ === "nda" ? `/pl/nda/${token}` : `/pl/umowa/${token}`;
    }
  }
}
