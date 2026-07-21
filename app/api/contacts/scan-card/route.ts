import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { ollamaGenerateWithImage } from "@/lib/ollama";
import { CARD_MODEL, CARD_SYSTEM, CARD_PROMPT, parseCardResponse } from "@/lib/card-ocr";
import { ATTACHMENT_MAX_BYTES } from "@/lib/costs";

export const runtime = "nodejs";
// Jak przy OCR kosztów: własny limit czasu funkcji dłuższy niż nasz timeout na
// model, żeby to NASZ komunikat błędu zdążył zadziałać, a nie Vercel ucinający
// funkcję (patrz app/api/costs/[id]/ocr/route.ts).
export const maxDuration = 120;

const OCR_TIMEOUT_MS = 100_000;
const OCR_NUM_CTX = 8192;
const OCR_KEEP_ALIVE = "30s";

const OBRAZY = ["image/jpeg", "image/png", "image/webp"] as const;

/** POST /api/contacts/scan-card — odczytuje wizytówkę modelem wizyjnym przez
 * Ollamę i zwraca PROPOZYCJĘ pól nowego leada (firma, osoba, telefon, e-mail…).
 *
 * W odróżnieniu od OCR kosztów obraz NIE jest zapisywany do bazy: wizytówka
 * jest jednorazowa, z niej wyciągamy dane i tyle — żadnej encji do
 * przechowania (decyzja spójna z „nie trzymaj tego, czego nie potrzebujesz",
 * jak przy załącznikach maila). Trasa nigdy nie zapisuje leada — właściciel
 * widzi sugestie w formularzu apki, poprawia i zapisuje ręcznie. */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Brak zdjęcia." }, { status: 400 });
  if (!(OBRAZY as readonly string[]).includes(file.type)) {
    return NextResponse.json({ error: "Dozwolone zdjęcia: JPG, PNG, WEBP." }, { status: 400 });
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return NextResponse.json({ error: `Zdjęcie za duże (max ${Math.round(ATTACHMENT_MAX_BYTES / 1024 / 1024)} MB).` }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const imageBase64 = buf.toString("base64");

  const raw = await ollamaGenerateWithImage({
    model: CARD_MODEL,
    prompt: CARD_PROMPT,
    system: CARD_SYSTEM,
    imageBase64,
    timeoutMs: OCR_TIMEOUT_MS,
    numCtx: OCR_NUM_CTX,
    keepAlive: OCR_KEEP_ALIVE,
  });

  if (raw == null) {
    return NextResponse.json({ error: "Model AI niedostępny. Wpisz dane ręcznie." }, { status: 503 });
  }

  const suggestion = parseCardResponse(raw);
  return NextResponse.json({ suggestion });
}
