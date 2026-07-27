// Czy wejście na publiczny link dokumentu to CZŁOWIEK, czy automat.
//
// **Po co to jest.** Publiczny podgląd oferty inkrementuje `liczba_otwarc`
// i przy PIERWSZYM otwarciu dzwoni powiadomieniem „klient otworzył ofertę —
// to jest moment, żeby zadzwonić". Audyt Modułu 57 (2026-07-27) pokazał, że
// licznik nie odróżnia klienta od maszyny: link w mailu odwiedza pół drogi
// zanim ktokolwiek go kliknie — skaner antywirusowy bramki pocztowej firmy
// klienta, podgląd linku w komunikatorze, prefetch przeglądarki. Właściciel
// dostawał sygnał „przeczytał", dzwonił, a po drugiej stronie nikt jeszcze
// maila nie otworzył. Sygnał, który myli się w tę stronę, jest gorszy niż
// jego brak, bo kosztuje telefon w złym momencie.
//
// **Zero AI, zero usług zewnętrznych** — dwa deterministyczne testy nagłówków,
// zgodnie z regułą całego projektu. Świadomie NIE zapisujemy niczego o
// odwiedzającym (żadnego IP, żadnego user-agenta) — czytamy nagłówek
// i wyrzucamy. Ślad otwarcia zostaje tym, czym był: czasem i licznikiem.
//
// **Świadomie zachowawczo w drugą stronę.** Gdy nie mamy pewności, liczymy
// jak człowieka: przeoczony robot zawyża licznik o jeden, a przeoczony klient
// gubi jedyne powiadomienie w całym lejku sprzedaży.

/** Nagłówki, którymi przeglądarki i boty SAME mówią „to nie jest wizyta".
 * `Sec-Purpose` to standard (Chrome/Edge), reszta to starsze warianty tego
 * samego, wciąż wysyłane przez Firefoksa i część czytników. */
const NAGLOWKI_ZAPOWIADAJACE: [string, RegExp][] = [
  ["sec-purpose", /prefetch|prerender/i],
  ["purpose", /prefetch|preview/i],
  ["x-purpose", /prefetch|preview/i],
  ["x-moz", /prefetch/i],
];

/** Podpisy w `User-Agent`, po których poznaje się automat.
 *
 * Trzy rodziny, wszystkie realnie widywane na linkach wysyłanych mailem:
 *  - bramki pocztowe skanujące linki (Proofpoint, Mimecast, Barracuda,
 *    Microsoft Defender „Safe Links"),
 *  - podglądy linków w komunikatorach (Slack, Discord, WhatsApp, Telegram,
 *    Signal, iMessage, Facebook, LinkedIn),
 *  - narzędzia i crawlery (curl, wget, biblioteki HTTP, przeglądarki
 *    bezgłowe, indeksery).
 *
 * Lista jest z definicji niepełna i taka zostaje — patrz „zachowawczo
 * w drugą stronę" wyżej. */
const PODPISY_AUTOMATU =
  /bot\b|bot\/|crawler|spider|scanner|preview|fetcher|monitoring|headless|phantomjs|curl\/|wget\/|python-requests|python-urllib|go-http-client|java\/|okhttp|axios\/|node-fetch|libwww|apache-httpclient|proofpoint|mimecast|barracuda|symantec|forcepoint|safelinks|urldefense|slack|discord|whatsapp|telegram|signal-|facebookexternalhit|linkedinbot|twitterbot|skypeuripreview|applebot|googlebot|bingbot|yandex|duckduck|ahrefs|semrush|petalbot|pingdom|uptimerobot/i;

/** Coś, co potrafi czytać nagłówki żądania — `Headers` z `NextRequest`
 * albo zwykły obiekt w teście. */
export type ZrodloNaglowkow = { get(name: string): string | null };

/** Czy to wejście liczyć jako otwarcie dokumentu przez człowieka.
 *
 * `false` = automat: nie ruszamy licznika, nie dzwonimy powiadomieniem, nie
 * dopisujemy nic na oś czasu klienta. Sam dokument oddajemy normalnie —
 * blokowanie automatów nie jest celem, tylko nieliczenie ich. */
export function czyLiczycJakoOtwarcie(naglowki: ZrodloNaglowkow): boolean {
  for (const [nazwa, wzorzec] of NAGLOWKI_ZAPOWIADAJACE) {
    const wartosc = naglowki.get(nazwa);
    if (wartosc && wzorzec.test(wartosc)) return false;
  }

  const ua = naglowki.get("user-agent");
  // Brak `User-Agent` to prawie zawsze skrypt — przeglądarki wysyłają go
  // zawsze. Ale to samo robi część czytników prywatności, więc próg jest
  // niski: pusty UA traktujemy jak automat, byle jaki UA już nie.
  if (!ua || !ua.trim()) return false;
  if (PODPISY_AUTOMATU.test(ua)) return false;

  return true;
}
