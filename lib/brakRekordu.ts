// Jedna odpowiedź na „zapisujesz coś, czego już nie ma" (etap 3, 2026-08-06).
//
// **Skąd to się wzięło.** Sonda etapu 3 przebiegła scenariusz „dwie karty":
// jedna karta usuwa rekord, druga w tym czasie go edytuje. Dziewięć z
// szesnastu rodzajów rekordów odpowiadało wtedy `{"ok":true}` na zapis, który
// nie zmienił ANI JEDNEGO wiersza — bo `UPDATE … WHERE id = …` na nieistniejący
// wiersz to w SQL-u poprawne zapytanie, tyle że bezskuteczne. Panel mówił
// „Zapisano", ekran pokazywał wpisaną treść, a w bazie nie było niczego.
//
// To ta sama rodzina co „cicha odmowa = cicha podmiana" z audytu Przypomnień
// i „nil jako sukces kłamie" z apki: brak skutku, który wygląda jak skutek.
// Siedem pozostałych tras (faktura, jej pozycje, notatka, koszt, umowa, oferta,
// przypomnienie) sprawdzało istnienie od początku — ta funkcja wyrównuje resztę
// do nich, a nie dokłada nowej reguły.
//
// Świadomie NIE dotyczy `DELETE`: usunięcie czegoś, czego już nie ma, jest
// idempotentne i kończy się dokładnie tym, o co prosił wołający. Kłamstwem
// jest wyłącznie „zapisałem" bez zapisu.
import { NextResponse } from "next/server";

/** Nazwa rekordu w mianowniku — wchodzi wprost do zdania pokazywanego
 *  właścicielowi, więc ma być po ludzku („osoba kontaktowa", nie „contact"). */
export type RodzajRekordu =
  | "klient"
  | "projekt"
  | "lead"
  | "pozycja oferty"
  | "blok treści oferty"
  | "zadanie"
  | "kamień milowy"
  | "punkt startowy"
  | "osoba kontaktowa";

/**
 * Odpowiedź 404 na próbę zapisu do nieistniejącego rekordu.
 *
 * Zdanie mówi WPROST, co się stało i skąd to się mogło wziąć — bo najczęstsza
 * przyczyna to drugie okno panelu, a właściciel patrzy wtedy na ekran, który
 * dalej pokazuje usunięty rekord.
 */
export function odpowiedzBrakRekordu(rodzaj: RodzajRekordu): NextResponse {
  return NextResponse.json(
    {
      error: `Nie zapisano — ten rekord (${rodzaj}) już nie istnieje. Mógł zostać usunięty w innym oknie panelu. Odśwież ekran.`,
      brak_rekordu: true,
    },
    { status: 404 }
  );
}
