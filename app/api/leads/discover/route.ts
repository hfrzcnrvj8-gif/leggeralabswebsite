import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureLeadsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 30;

// Mapuje branże z panelu na tagi OpenStreetMap (klucz=wartość). Rozszerz
// tę listę, jeśli w DiscoverPanel.tsx dopiszesz kolejną branżę.
const BRANZA_TAGS: Record<string, { key: string; value: string }> = {
  "Kancelaria prawna": { key: "office", value: "lawyer" },
  "Biuro rachunkowe": { key: "office", value: "accountant" },
  "Kancelaria notarialna": { key: "office", value: "notary" },
  "Klinika stomatologiczna / prywatna": { key: "amenity", value: "dentist" },
  "Biuro nieruchomości": { key: "office", value: "estate_agent" },
  "Firma doradcza / consulting": { key: "office", value: "consulting" },
};

type OverpassElement = {
  type: string;
  tags?: Record<string, string>;
};

async function geocode(lokalizacja: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=pl&q=${encodeURIComponent(
    lokalizacja
  )}`;
  const res = await fetch(url, {
    // Nominatim's usage policy requires a descriptive User-Agent.
    headers: { "User-Agent": "LeggeraLabsLeadsApp/1.0 (kontakt: patryk@leggeralabs.pl)" },
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => [])) as Array<{ lat: string; lon: string }>;
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

/**
 * POST /api/leads/discover — admin-only. Looks up real companies matching a
 * branża/lokalizacja via free OpenStreetMap data (Nominatim for geocoding,
 * Overpass API for the business lookup) — no API key, no billing, no LLM.
 * Data completeness varies (crowdsourced), unlike a paid places API, but it
 * needs zero setup.
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { branza?: string; lokalizacja?: string; ile?: number }
    | null;
  const branza = (body?.branza ?? "").trim();
  const lokalizacja = (body?.lokalizacja ?? "").trim();
  const ile = Math.max(1, Math.min(15, Number(body?.ile) || 8));

  if (!branza || !lokalizacja) {
    return NextResponse.json({ error: "Podaj branżę i lokalizację." }, { status: 400 });
  }

  const tag = BRANZA_TAGS[branza];
  if (!tag) {
    return NextResponse.json(
      { error: `Nieobsługiwana branża dla auto-wyszukiwania: "${branza}".` },
      { status: 400 }
    );
  }

  const point = await geocode(lokalizacja);
  if (!point) {
    return NextResponse.json(
      {
        error: `Nie udało się zlokalizować "${lokalizacja}" na mapie. Spróbuj dokładniejszej nazwy, np. "Warszawa, Wilanów".`,
      },
      { status: 400 }
    );
  }

  const query = `[out:json][timeout:25];
(
  node["${tag.key}"="${tag.value}"](around:6000,${point.lat},${point.lon});
  way["${tag.key}"="${tag.value}"](around:6000,${point.lat},${point.lon});
);
out center ${ile * 3};`;

  const overpassRes = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      // Overpass API's public instance returns 406 for requests without a
      // descriptive User-Agent (it's used to keep out generic bot traffic).
      "User-Agent": "LeggeraLabsLeadsApp/1.0 (kontakt: patryk@leggeralabs.pl)",
      Accept: "application/json",
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!overpassRes.ok) {
    const errText = await overpassRes.text().catch(() => "");
    return NextResponse.json(
      { error: `Błąd wyszukiwania (OpenStreetMap Overpass ${overpassRes.status}): ${errText.slice(0, 300)}` },
      { status: 502 }
    );
  }

  const data = (await overpassRes.json().catch(() => null)) as { elements?: OverpassElement[] } | null;
  const elements = (data?.elements ?? []).filter((e) => e.tags?.name);

  await ensureLeadsSchema();
  const sql = getSql();

  const existingRows = await sql`SELECT firma FROM leads;`;
  const existingNames = new Set(
    (existingRows as { firma: string }[]).map((r) => r.firma.toLowerCase().trim())
  );

  let added = 0;
  let skipped = 0;
  const insertedLeads: { firma: string }[] = [];

  for (const el of elements) {
    if (added >= ile) break;
    const t = el.tags ?? {};
    const firma = (t.name ?? "").trim();
    if (!firma) continue;
    if (existingNames.has(firma.toLowerCase())) {
      skipped++;
      continue;
    }
    existingNames.add(firma.toLowerCase());

    const phone = t.phone || t["contact:phone"] || "";
    const website = t.website || t["contact:website"] || "";
    const kontakt = [phone, website].filter(Boolean).join(" / ").slice(0, 300);
    const addrParts = [t["addr:street"], t["addr:housenumber"], t["addr:city"]].filter(Boolean);
    const notatki = addrParts.join(" ").slice(0, 1000);
    const zrodlo = `Auto-wyszukane (OSM): ${lokalizacja}`;
    const id = randomUUID();

    await sql`
      INSERT INTO leads (id, firma, branza, kontakt, zrodlo, status, notatki)
      VALUES (${id}, ${firma.slice(0, 300)}, ${branza}, ${kontakt}, ${zrodlo}, 'Do kontaktu', ${notatki});
    `;
    added++;
    insertedLeads.push({ firma });
  }

  return NextResponse.json({ ok: true, added, skipped, leads: insertedLeads });
}
