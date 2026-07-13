// Renderowanie 1. strony PDF do PNG w Node — dla OCR załączników kosztów
// (Moduł 8). pdfjs-dist (używane wewnątrz pdf-to-img) w środowisku Node
// domyślnie próbuje SAM dociągnąć `@napi-rs/canvas` przez wewnętrzny,
// dynamiczny `require()` — bundler (Next.js/Turbopack) tego nie widzi przy
// statycznej analizie zależności, więc na Vercelu binarka nie trafiała do
// paczki funkcji serverless (`Cannot find module '@napi-rs/canvas'`).
//
// Naprawa: importujemy `@napi-rs/canvas` JAWNIE i STATYCZNIE tutaj (bundler
// to widzi i dołącza), sami uzupełniamy globalne polyfille (DOMMatrix/
// ImageData/Path2D — pdfjs sprawdza `if (!globalThis.X)` i pomija swój
// wewnętrzny require, jeśli już je znajdzie) i podajemy pdfjs własną
// fabrykę canvasa zamiast pozwalać mu szukać jej samemu.
import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";

if (!globalThis.DOMMatrix) globalThis.DOMMatrix = DOMMatrix as unknown as typeof globalThis.DOMMatrix;
if (!globalThis.ImageData) globalThis.ImageData = ImageData as unknown as typeof globalThis.ImageData;
if (!globalThis.Path2D) globalThis.Path2D = Path2D as unknown as typeof globalThis.Path2D;

type CanvasAndContext = { canvas: unknown; context: unknown };

/** Fabryka canvasa dla pdfjs-dist oparta na @napi-rs/canvas, podawana jawnie
 * przez `docInitParams.CanvasFactory` — omija wewnętrzny require pdfjs. */
class NapiCanvasFactory {
  create(width: number, height: number): CanvasAndContext {
    if (width <= 0 || height <= 0) throw new Error("Invalid canvas size");
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext("2d") };
  }
  reset(canvasAndContext: CanvasAndContext, width: number, height: number) {
    const canvas = canvasAndContext.canvas as { width: number; height: number } | null;
    if (!canvas) throw new Error("Canvas is not specified");
    canvas.width = width;
    canvas.height = height;
  }
  destroy(canvasAndContext: CanvasAndContext) {
    const canvas = canvasAndContext.canvas as { width: number; height: number } | null;
    if (!canvas) throw new Error("Canvas is not specified");
    canvas.width = 0;
    canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

// pdfjs-dist czasem musi doczytać dane cMap/czcionek standardowych spoza
// osadzonych w PDF-ie (rzadkie kodowania, niewbudowane fonty) — normalnie z
// katalogów `cmaps`/`standard_fonts` swojej własnej paczki na dysku. Next.js
// buduje ścieżkę do nich w runtime (require.resolve + string doklejany do
// nazwy pliku), więc jego statyczne śledzenie zależności (file tracing) nie
// widzi tych plików i nie dołącza ich do paczki funkcji serverless na
// Vercelu — próba odczytu kończyłaby się ENOENT. Zamiast pliku z dysku,
// dociągamy je przez HTTPS z jsdelivr (ta sama wersja pdfjs-dist co w
// package-lock — podbij ten numer razem z wersją `pdfjs-dist`, jeśli
// kiedyś ją zmienimy). Funkcja i tak ma dostęp do internetu (woła Ollamę
// przez Tailscale Funnel), więc to nie nowa zależność sieciowa.
const PDFJS_VERSION = "5.6.205";
const PDFJS_CDN_BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}`;

type BinaryDataKind = "cMapUrl" | "standardFontDataUrl" | "wasmUrl";

/** Fabryka danych cMap/czcionek dla pdfjs-dist, pobierająca je przez HTTPS
 * zamiast czytać z dysku (patrz komentarz wyżej). */
class HttpBinaryDataFactory {
  private readonly urls: Partial<Record<BinaryDataKind, string>>;
  constructor(opts: { cMapUrl?: string; standardFontDataUrl?: string; wasmUrl?: string }) {
    this.urls = opts;
  }
  async fetch({ kind, filename }: { kind: BinaryDataKind; filename: string }): Promise<Uint8Array> {
    const baseUrl = this.urls[kind];
    if (!baseUrl) throw new Error(`Ensure that the \`${kind}\` API parameter is provided.`);
    const url = `${baseUrl}${filename}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Unable to load ${kind} data at: ${url}`);
    return new Uint8Array(await res.arrayBuffer());
  }
}

/** Renderuje pierwszą stronę PDF-a (Buffer) do PNG (Buffer). */
export async function renderFirstPdfPageToPng(pdfBuf: Buffer, scale = 2): Promise<Buffer> {
  const { pdf } = await import("pdf-to-img");
  const doc = await pdf(pdfBuf, {
    scale,
    docInitParams: {
      CanvasFactory: NapiCanvasFactory,
      BinaryDataFactory: HttpBinaryDataFactory,
      cMapUrl: `${PDFJS_CDN_BASE}/cmaps/`,
      standardFontDataUrl: `${PDFJS_CDN_BASE}/standard_fonts/`,
      cMapPacked: true,
    },
  });
  return doc.getPage(1);
}
