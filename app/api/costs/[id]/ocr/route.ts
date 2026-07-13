import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureCostsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { ollamaGenerateWithImage } from "@/lib/ollama";
import { OCR_MODEL, OCR_SYSTEM, OCR_PROMPT, parseOcrResponse } from "@/lib/costs-ocr";
import { renderFirstPdfPageToPng } from "@/lib/pdf-render";

export const runtime = "nodejs";
// Domyślny limit czasu funkcji na Vercelu bez tego byłby krótszy niż nasz
// własny OCR_TIMEOUT_MS poniżej — musi być dłuższy, żeby to NASZ timeout
// (kontrolowany komunikat błędu) zdążył zadziałać pierwszy, a nie Vercel
// samo ucinające funkcję.
export const maxDuration = 120;

const OCR_TIMEOUT_MS = 100_000; // model wizyjny na Macu odpowiada wolniej niż tekstowy — dłuższy timeout niż domyślny w lib/ollama.ts. Podniesione ze 60s po dwóch timeoutach na produkcji nawet z mniejszym num_ctx (patrz HUB_SETUP.md) — daje modelowi więcej czasu, gdyby to była kwestia chwilowego obciążenia, nie twardej blokady.
// Bez jawnego num_ctx Ollama potrafi załadować qwen3-vl z domyślnym, ogromnym
// oknem kontekstu (obserwowane: 262144 → 44 GB samego KV-cache) — długie
// ładowanie/timeout na współdzielonym sprzęcie właściciela. Jeden obraz
// paragonu + krótki prompt/JSON mieszczą się z dużym zapasem w 8192.
const OCR_NUM_CTX = 8192;
// OCR klika się rzadko i pojedynczo — nie warto trzymać modelu "na ciepło"
// (domyślne 5 minut w Ollamie), żeby szybciej oddać RAM innym procesom na
// tym samym Macu (patrz HUB_SETUP.md — inna automatyzacja dzieli ten sprzęt).
const OCR_KEEP_ALIVE = "30s";

/** POST /api/costs/:id/ocr — odczytuje załącznik (skan/PDF) kosztu modelem
 * wizyjnym przez Ollamę i zwraca PROPOZYCJĘ wartości pól formularza. Nigdy
 * nie zapisuje nic do bazy — właściciel widzi sugestie w edytorze, poprawia
 * i zapisuje ręcznie (patrz CLAUDE.md, docs/plany-modulow/08-ai-ocr-koszty.md). */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureCostsSchema();
  const sql = getSql();

  const rows = await sql`SELECT zalacznik_nazwa, zalacznik_typ, zalacznik_dane FROM costs WHERE id = ${id};`;
  const row = rows[0];
  if (!row || !row.zalacznik_dane) {
    return NextResponse.json({ error: "Brak załącznika do odczytania." }, { status: 400 });
  }

  const mime = String(row.zalacznik_typ || "");
  let imageBase64: string;

  if (mime === "application/pdf") {
    try {
      const buf = Buffer.from(String(row.zalacznik_dane), "base64");
      const pageBuf = await renderFirstPdfPageToPng(buf);
      imageBase64 = pageBuf.toString("base64");
    } catch (err) {
      console.error("[costs/ocr] konwersja PDF→PNG nieudana", err);
      return NextResponse.json({ error: "Nie udało się przetworzyć PDF-a. Wpisz dane ręcznie." }, { status: 422 });
    }
  } else if (mime === "image/jpeg" || mime === "image/png" || mime === "image/webp") {
    imageBase64 = String(row.zalacznik_dane);
  } else {
    return NextResponse.json({ error: "Nierozpoznany typ pliku. Wpisz dane ręcznie." }, { status: 422 });
  }

  const raw = await ollamaGenerateWithImage({
    model: OCR_MODEL,
    prompt: OCR_PROMPT,
    system: OCR_SYSTEM,
    imageBase64,
    timeoutMs: OCR_TIMEOUT_MS,
    numCtx: OCR_NUM_CTX,
    keepAlive: OCR_KEEP_ALIVE,
  });

  if (raw == null) {
    return NextResponse.json({ error: "Model AI niedostępny. Wpisz dane ręcznie." }, { status: 503 });
  }

  const suggestion = parseOcrResponse(raw);
  return NextResponse.json({ suggestion });
}
