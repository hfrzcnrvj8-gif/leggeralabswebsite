/** @type {import('next').NextConfig} */

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig = {
  reactStrictMode: true,
  // pdf-to-img (Moduł 8, OCR PDF→PNG) korzysta z pdfjs-dist, które domyślnie
  // SAMO próbuje w runtime `require("@napi-rs/canvas")` żeby narysować
  // stronę — Next.js/Vercel nie widzi tego dynamicznego require głęboko w
  // zależności przy śledzeniu plików, więc binarka nie trafiała do paczki
  // funkcji serverless (`Cannot find module '@napi-rs/canvas'`). Naprawione
  // w lib/pdf-render.ts: importujemy @napi-rs/canvas JAWNIE (bundler to
  // widzi) i podajemy pdfjs własną fabrykę canvasa, więc nigdy nie wchodzi w
  // swoją wewnętrzną, nietraceable ścieżkę. Z tego samego powodu dane
  // cMap/czcionek standardowych (pdfjs-dist/cmaps, standard_fonts) NIE są
  // czytane z dysku — próba dopisania ich przez `outputFileTracingIncludes`
  // okazała się bez efektu (w tej wersji Next/Turbopacka ta opcja nie
  // działa dla zwykłych route'ów API, tylko literalne ścieżki w fs.readFile
  // są śledzone automatycznie) — zamiast tego lib/pdf-render.ts dociąga je
  // przez HTTPS z jsdelivr.
  serverExternalPackages: ["@napi-rs/canvas", "pdf-to-img", "pdfjs-dist"],
  outputFileTracingIncludes: {
    "/[lang]/opengraph-image": ["./app/[lang]/opengraph-fonts/*.ttf"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
