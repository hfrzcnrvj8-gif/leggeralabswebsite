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
  // pdf-to-img (Moduł 8, OCR PDF→PNG) używa pdfjs-dist, które do renderowania
  // stron w Node ładuje natywny binarny dodatek @napi-rs/canvas przez
  // require() w runtime — Next.js nie widzi tego przy statycznej analizie
  // zależności (file tracing), więc bez jawnego dopisania trace'u binarka i
  // dane pdfjs (cmaps/standard_fonts, potrzebne do renderowania czcionek)
  // nie trafiają do paczki funkcji serverless na Vercelu → PDF nie do odczytania.
  serverExternalPackages: ["@napi-rs/canvas", "pdf-to-img", "pdfjs-dist"],
  outputFileTracingIncludes: {
    "/[lang]/opengraph-image": ["./app/[lang]/opengraph-fonts/*.ttf"],
    "/api/costs/[id]/ocr": [
      "./node_modules/pdfjs-dist/cmaps/**",
      "./node_modules/pdfjs-dist/standard_fonts/**",
      "./node_modules/@napi-rs/canvas-linux-x64-gnu/**",
      "./node_modules/@napi-rs/canvas-linux-arm64-gnu/**",
    ],
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
