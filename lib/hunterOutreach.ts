/**
 * Pierwszy kontakt z firmą znalezioną przez „Łowcę leadów" (Moduł 52).
 *
 * **Dlaczego to jest osobny plik, a nie zwykły szablon do napisania ręcznie.**
 * Dane firm jednoosobowych pochodzą z CEIDG, czyli **nie od osoby, której
 * dotyczą** — a to uruchamia obowiązek informacyjny z art. 14 RODO: przy
 * PIERWSZYM kontakcie trzeba powiedzieć, skąd się je ma i jak wnieść sprzeciw.
 * Gdyby ta klauzula żyła wyłącznie jako „szablon, który właściciel sobie
 * kiedyś doda", pierwsze dwadzieścia maili wyszłoby bez niej — bo od „Weź" do
 * wysłanego maila nic o niej nie przypominało.
 *
 * Dlatego trzyma ją kod, w jednym miejscu, i wstawia w dwóch: do notatki leada
 * przy przyjęciu kandydata (widać ją na karcie, gotową do skopiowania) oraz do
 * szablonu wiadomości zasianego przy migracji.
 *
 * ⚠️ **TREŚĆ JEST ROBOCZA — do potwierdzenia z prawnikiem** razem z resztą
 * zapisów z `docs/DO-PRAWNIKA-I-TLUMACZA.md` → 2.1b. Świadomie stoi tu już
 * teraz, mimo braku akceptacji: brak zdania jest gorszy niż zdanie do
 * poprawienia, a firma nie jest jeszcze zarejestrowana, więc i tak wraca to na
 * biurko prawnika przed pierwszą wysyłką na skalę.
 */

/** Skąd mamy dane i co można z tym zrobić. Jedno miejsce — zmieniasz tu,
 * zmienia się wszędzie. */
export const KLAUZULA_ZRODLA =
  "Pana/Pani dane kontaktowe pozyskaliśmy z publicznego rejestru CEIDG. " +
  "Piszemy w celu przedstawienia oferty współpracy (prawnie uzasadniony interes, art. 6 ust. 1 lit. f RODO). " +
  "Jeśli nie życzy sobie Pan/Pani dalszego kontaktu, wystarczy odpowiedzieć jednym słowem — " +
  "usuniemy dane natychmiast i więcej się nie odezwiemy.";

/** Stały identyfikator zasianego szablonu — dzięki niemu migracja jest
 * idempotentna (każdy deploy nie tworzy dwudziestej kopii), a właściciel może
 * treść swobodnie przepisać: `ON CONFLICT DO NOTHING` nie nadpisze jego wersji. */
export const SZABLON_PIERWSZY_KONTAKT_ID = "lowca-pierwszy-kontakt";

export const SZABLON_PIERWSZY_KONTAKT_NAZWA = "Pierwszy kontakt — kandydat Łowcy";

export const SZABLON_PIERWSZY_KONTAKT_TEMAT = "Krótkie pytanie o powtarzalną robotę w Państwa biurze";

/** Treść szablonu. Krótka i konkretna — pierwszy mail ma zadać JEDNO pytanie,
 * a nie sprzedać wdrożenie. Miejsce na zaczepkę z lokalnego modelu jest
 * oznaczone nawiasem, żeby było widać, że to trzeba uzupełnić. */
export const SZABLON_PIERWSZY_KONTAKT_TRESC = [
  "Dzień dobry,",
  "",
  "nazywam się Patryk Piecyk i pomagam małym firmom automatyzować powtarzalną robotę biurową — bez wysyłania danych do chmury.",
  "",
  "[tu wklej zaczepkę: co konkretnie u nich widzisz do zautomatyzowania]",
  "",
  "Jeśli to brzmi jak coś, co u Państwa zajmuje czas — chętnie pokażę na 15-minutowej rozmowie, jak to wygląda w praktyce. Bez zobowiązań.",
  "",
  "Pozdrawiam",
  "Patryk Piecyk",
  "Leggera Labs",
  "",
  "---",
  KLAUZULA_ZRODLA,
].join("\n");

/** Blok dopisywany do notatki leada przy przyjęciu kandydata. Widać go na
 * karcie leada, więc klauzula jest pod ręką niezależnie od tego, czy właściciel
 * pisze z panelu, z telefonu, czy z własnego klienta poczty. */
export function blokPierwszegoKontaktu(): string {
  return ["⚠️ Pierwszy kontakt MUSI zawierać informację o źródle danych:", "", KLAUZULA_ZRODLA].join("\n");
}
