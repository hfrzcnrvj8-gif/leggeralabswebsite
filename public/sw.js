// Service worker Leggera Hub (Moduł 5, PWA).
//
// Zasada bezpieczeństwa (RODO): panel jest za logowaniem i online-first.
// NIGDY nie cache'ujemy odpowiedzi API ani stron z danymi klientów — na
// dysku telefonu nie może zostać kopia leadów/faktur/maili. Cache obejmuje
// WYŁĄCZNIE statyczną skorupę aplikacji (kod JS/CSS Next.js, ikony, czcionki)
// oraz malutką stronę-zastępczą pokazywaną, gdy telefon jest offline.
//
// Uwaga: service worker realnie działa dopiero na HTTPS (produkcja Vercel) —
// w sandboxie/dev przez http://localhost i tak jest pomijany albo ograniczony.

const VERSION = "leggera-hub-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const OFFLINE_URL = "/offline.html";

// Precache samej strony offline. Reszta skorupy (chunki Next.js) wpada do
// cache leniwie, dopiero gdy przeglądarka realnie po nią sięgnie.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.add(OFFLINE_URL))
  );
  // Nowy SW przejmuje kontrolę od razu przy następnym wejściu.
  self.skipWaiting();
});

// Sprzątanie starych wersji cache przy aktywacji nowego SW.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Czy żądanie dotyczy statycznej skorupy, którą wolno cache'ować?
// TYLKO zasoby budowane (kod/CSS/mapy) i ikony — nic z danymi.
function isCacheableShell(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/hub.webmanifest" ||
    url.pathname === "/apple-icon.png" ||
    url.pathname === "/icon.svg"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Tylko GET; POST/PATCH itd. zawsze prosto do sieci.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Inny origin (np. czcionki Google, beacon analityki) — nie dotykamy.
  if (url.origin !== self.location.origin) return;

  // API i wszystko pod /api — NIGDY z cache. Dane klientów muszą być świeże
  // i nie mogą osiąść na dysku. Zwykły network passthrough.
  if (url.pathname.startsWith("/api/")) return;

  // Nawigacje (wejścia na strony) — network-first. Strona admina jest
  // renderowana serwerowo z danymi, więc jej NIE zapisujemy do cache;
  // przy braku sieci pokazujemy stronę-zastępczą offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((res) => res || Response.error())
      )
    );
    return;
  }

  // Statyczna skorupa — stale-while-revalidate: natychmiast z cache (szybko),
  // w tle odświeżamy. Bezpieczne, bo to wyłącznie kod/ikony, nie dane.
  if (isCacheableShell(url)) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
