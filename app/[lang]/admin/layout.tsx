import type { Metadata, Viewport } from "next";
import { RegisterSW } from "./RegisterSW";

// Layout panelu /admin — istnieje po to, by nadać całej sekcji tożsamość
// aplikacji mobilnej (PWA "Leggera Hub"), NIE dotykając strony publicznej
// leggeralabs.pl. Strona publiczna ma własny manifest (app/manifest.ts,
// `display: browser`) — tu podmieniamy `manifest` na osobny plik Huba, więc
// zainstalowana z panelu apka startuje w /pl/admin jako standalone.
//
// Metadane z tego layoutu (manifest, appleWebApp) łączą się z metadanymi
// poszczególnych stron admina (te ustawiają tylko title + robots:noindex),
// więc nic tu nie nadpisujemy w drugą stronę.
export const metadata: Metadata = {
  applicationName: "Leggera Hub",
  manifest: "/hub.webmanifest",
  // iOS: pełny ekran po "Dodaj do ekranu głównego", nazwa i styl paska stanu.
  appleWebApp: {
    capable: true,
    title: "Leggera Hub",
    statusBarStyle: "black-translucent",
  },
  // Next emituje nowy standard `mobile-web-app-capable`, ale pomija starszy
  // `apple-mobile-web-app-capable`. iOS 16.4+ czyta `display:standalone` z
  // manifestu, więc na sprzęcie właściciela nie jest wymagany — dokładamy go
  // ręcznie dla pewności (starsze iOS, koszt zerowy).
  other: { "apple-mobile-web-app-capable": "yes" },
  robots: { index: false, follow: false },
};

// `viewportFit: "cover"` jest WARUNKIEM działania `env(safe-area-inset-*)` —
// bez tego wcięcia (notch/pasek gestów iPhone'a) raportują 0 i dolna belka
// nawigacji wchodziłaby pod krawędź ekranu. themeColor = ciemne tło panelu
// (--bg w .admin-linear), żeby pasek stanu zlał się z apką.
export const viewport: Viewport = {
  themeColor: "#08090a",
  viewportFit: "cover",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <RegisterSW />
    </>
  );
}
