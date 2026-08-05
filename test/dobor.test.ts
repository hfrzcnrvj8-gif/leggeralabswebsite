import { test } from "node:test";
import assert from "node:assert/strict";
import { dobierz, DOMYSLNE_WEJSCIE, sekcjaOfertyZRekomendacji } from "../lib/dobor.ts";

// Most Kalkulator → Oferta (przegląd szwów, 2026-08-06).
//
// Do tego dnia `lib/dobor.ts` importował dokładnie JEDEN plik — własny ekran.
// Wynik dało się wydrukować i nic poza tym, więc liczby ustalone przy kliencie
// przepisywało się do oferty z kartki. Ten test pilnuje dwóch rzeczy, które
// przy takim moście psują się po cichu: że do dokumentu handlowego trafiają
// LICZBY Z REKOMENDACJI (a nie zera z pustego obiektu) i że nie trafia do
// niego nic, co czyta się jak zastrzeżenie do własnej oferty.

test("sekcja oferty niesie liczby z rekomendacji, nie puste miejsca", () => {
  const rek = dobierz(DOMYSLNE_WEJSCIE);
  const { tytul, tresc } = sekcjaOfertyZRekomendacji(rek);

  assert.match(tytul, /dobór sprzętu/i);
  // Sprzęt: nazwa karty i liczba sztuk muszą być te same, co na ekranie.
  assert.ok(tresc.includes(rek.kartaNazwa), "brakuje nazwy karty");
  assert.ok(tresc.includes(`${rek.liczbaGpu}× ${rek.kartaNazwa}`), "brakuje liczby kart");
  assert.ok(tresc.includes(`${rek.ram} GB`), "brakuje RAM-u");
  assert.ok(tresc.includes(`${rek.ssdTB} TB`), "brakuje dysku");
  // Widełki kosztu w tysiącach — tak, jak pokazuje je ekran i wydruk.
  assert.ok(
    tresc.includes(`${Math.round(rek.kosztMin / 1000)}–${Math.round(rek.kosztMax / 1000)} tys. zł`),
    "brakuje widełek wdrożenia"
  );
  assert.ok(tresc.includes(`${rek.serwisMin}–${rek.serwisMax} zł`), "brakuje widełek opieki");
  // Zdanie o niewiążącym charakterze wyceny MUSI zostać — to ono odróżnia
  // punkt wyjścia od zobowiązania (opis modułu: „nie wiążąca specyfikacja").
  assert.match(tresc, /wymagają potwierdzenia u dostawcy/i);
  assert.match(tresc, /wiążącej wyceny/i);
});

test("sekcja oferty przenosi treść notatek, ale nie ich typ", () => {
  const rek = dobierz({ ...DOMYSLNE_WEJSCIE, uzytkownicy: 60, szczyt: 40, ragGB: 0, zadania: ["rag"] });
  const { tresc } = sekcjaOfertyZRekomendacji(rek);

  assert.ok(rek.notatki.length > 0, "test bez sensu, gdy dobór nie ma notatek");
  for (const n of rek.notatki) assert.ok(tresc.includes(n.tekst), `brakuje notatki: ${n.tekst}`);
  // „ostrzeżenie" jest sygnałem dla WŁAŚCICIELA przy doborze. W dokumencie,
  // który czyta klient, taka etykieta czytałaby się jak zastrzeżenie do
  // własnej oferty — więc do treści idzie samo zdanie, bez typu.
  assert.ok(!/ostrzezenie|ostrzeżenie:/i.test(tresc), "typ notatki wyciekł do oferty");
});

test("dobór przycięty do realnych liczb trafia do oferty w tej samej postaci", () => {
  // „Równocześnie" większe niż „łącznie" jest niemożliwe; moduł przycina to
  // do liczby użytkowników i mówi o tym notatką. Wydruk i oferta muszą dostać
  // TEN SAM przycięty zestaw — dokument nie może przeczyć sam sobie.
  const rek = dobierz({ ...DOMYSLNE_WEJSCIE, uzytkownicy: 10, szczyt: 99 });
  const { tresc } = sekcjaOfertyZRekomendacji(rek);
  assert.ok(tresc.includes(rek.opisWejscia), "opis wejścia rozjechał się z rekomendacją");
  assert.ok(!tresc.includes("99 naraz"), "do oferty trafiła liczba sprzed przycięcia");
});
