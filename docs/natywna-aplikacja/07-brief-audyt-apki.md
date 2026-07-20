# Brief: Audyt aplikacji natywnej (Faza 11½)

> Brief wdrożeniowy pod **jeden osobny czat**. Zaczynasz od `00-plan.md`,
> potem ten plik. Repo apki: `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`.

Zlecone przez właściciela 2026-07-20, przy okazji poprawek Fazy 10 (Faktury/
Oferty + kilka realnych błędów złapanych po drodze — Face ID bez furtki
ucieczki, plakietka KSeF ledwo widoczna, Koszty bez klikalnych wierszy,
publiczny podgląd dokumentu wystający poza ekran telefonu). Właściciel wprost:
„skoro jesteśmy już bliżej końca budowania aplikacji na telefon, może warto
przygotować audyt, który sprawdzi poprawność, strukturę, architekturę, wąskie
gardła, miejsca do poprawy albo coś, co można by dodać, żeby podnieść
funkcjonalność".

## To NIE jest to samo, co `docs/AUDYTY-KONCOWE.md`

Panel ma już swój plan audytów końcowych, spisany tego samego dnia przez
równoległą sesję. Dwie różnice, o których trzeba pamiętać, żeby nie zdublować
pracy:

1. **Zakres.** Tamten audyt czeka na domknięcie WSZYSTKIEGO (wszystkie moduły
   panelu + wszystkie fazy apki, łącznie z macOS) i wyraźnie zakazuje sobie
   dobudowywania funkcji („Nie dobudowywać funkcji. Pytanie brzmi »czy to, co
   jest, działa«, nie »czego brakuje«"). **Ten audyt jest węższy (tylko apka)
   i celowo NIE ma tego zakazu** — właściciel wprost poprosił też o pomysły na
   podniesienie funkcjonalności. Można go zrobić już teraz, bez czekania na
   Fazę 11 (macOS).
2. **Punkt 6 tamtego audytu** („Parytet panel ↔ apka — każda reguła
   istniejąca w dwóch miejscach jest kandydatem na rozjazd, zrób ich listę")
   dotyczy też tego repo. Jeśli ten audyt zrobi tę listę pierwszy, podepnij ją
   tam zamiast robić drugi raz.

## Dlaczego akurat teraz warto

Poziom 1 i 2 planu są kompletne (Faza 10 domknęła Faktury/Oferty). Zanim
zacznie się Faza 11 (macOS z tego samego rdzenia) — dobry moment, żeby
sprawdzić, czy fundament, na którym macOS ma stanąć, jest w dobrym stanie, nie
dokładać kolejnej warstwy na czymś, co wymaga naprawy.

Poprawki zrobione tuż przed tym briefem (2026-07-20) są dobrym przykładem
WZORCA błędów, których szukać — żaden nie wyszedł z czytania kodu, każdy z
oglądania:

- **Face ID bez furtki ucieczki** — przełącznik blokady mieszkał w „Więcej",
  a do „Więcej" nie dało się dojść bez pokonania blokady. Zielony build,
  poprawny kod, realna pułapka bez wyjścia.
- **KSeF jako szary podpis** — informacja BYŁA, ale ginęła wizualnie; różnica
  między „kod istnieje" a „ktoś to zobaczy" (ten sam błąd co Moduły 30/31 w
  panelu, inna odmiana).
- **Koszty bez klikalnych wierszy** — funkcja „zobacz i opłać koszt" nie
  istniała w ogóle, mimo że backend (PATCH kosztu) był gotowy od dawna.
- **Publiczny podgląd dokumentu wystający poza ekran** — `window.innerWidth`
  w realnym renderowaniu potrafi zgłosić inną wartość niż faktyczna szerokość
  ekranu; `document.documentElement.clientWidth` mierzy poprawnie. Ten sam
  rodzaj pułapki co przy skalowaniu maila w Fazie 5.

Żaden z tych czterech nie został złapany podczas budowy modułu, w którym
powstał — wyszły dopiero przy osobnym spojrzeniu. To jest dokładnie to, po co
jest ten audyt.

## Zakres — dwie części, obie potrzebne

### Część A — poprawność, struktura, architektura, wąskie gardła

- **Rozmiar i kształt `AppStore.swift`.** Po 10 fazach to jedna duża
  `@Observable`-klasa robiąca za store dla każdego modułu naraz. Sprawdź, czy
  to jeszcze wygodne w pracy, czy już przeszkadza (analogiczne pytanie do
  `lib/db.ts` 2177 linii w panelu — dzielić TYLKO jeśli utrudnia, nie dla
  samej liczby).
- **Lista „czego NIE zweryfikowano dotykiem"** — każda faza w `00-plan.md` ma
  taką sekcję (zapis rozmowy, przejście formularza „nowe wydarzenie",
  faktyczne dostarczenie powiadomienia o stoperze, ścieżka paragonu na
  prawdziwym aparacie, realna wysyłka maila, i więcej). Zbierz je w jedną
  listę. Właściciel używa apki codziennie na prawdziwym telefonie — część z
  nich da się teraz PO PROSTU ZAPYTAĆ, zamiast zgadywać.
- **Parytet reguł biznesowych panel ↔ apka** (patrz wyżej — połącz z Audytem 6
  panelu). Znane bliźniaki: `SzybkiDopisek.rozbierz()`/`parseQuickAdd()`,
  `Kontakty.whatsApp/linkedIn`/`waLink()`/`linkedinLink()`, `Snooze.opcje()`,
  `RytmPrzypomnien`. Dołóż nowe z Fazy 10: reguły gatingu przycisków faktur
  (`isInvoiceOverdue`/`isOfferExpired` z `lib/invoices.ts`/`lib/offers.ts`
  skopiowane 1:1 do Swifta) — sprawdź, czy nadal się zgadzają.
  **Zero testów automatycznych po żadnej stronie** — cała weryfikacja jest
  ręczna (curl + zrzuty), tak jak w panelu. Rozstrzygnięcie „czy testować" z
  Audytu 6 panelu dotyczy też tych bliźniaków.
- **DEBUG furtki** (`LEGGERA_DEV_*`, cała lista w README apki) — czy
  wszystkie nadal działają, czy któraś zgniła po zmianach w nawigacji
  (przykład z tej sesji: `SzczegolyCel` przeniesiony z `WiecejView` na
  poziom pliku, żeby Faktury/Oferty/Koszty mogły go współdzielić — sprawdź,
  czy nie ma więcej takich ukrytych założeń o zasięgu typu).
- **Wydajność i bateria** — ile żądań leci przy typowym użyciu (Pulpit,
  wejście w Pocztę, przełączanie zakładek), czy coś odpytuje częściej niż
  trzeba. „Online z lekkim buforem" to świadoma decyzja (patrz `00-plan.md`),
  ale warto sprawdzić, czy bufor faktycznie działa tam, gdzie powinien.
- **Obsługa błędów sieci** — apka jest używana w realnych warunkach (słaby
  zasięg, przełączanie WiFi/LTE). Sprawdź, czy `APIError` i jego obsługa w
  każdym module dają się przeżyć, nie tylko działają w symulatorze z dobrym
  łączem.
- **Bramka umowy i inne twarde reguły serwera** — apka NIE przewiduje ich po
  swojej stronie (świadomie, patrz Faza 5). Sprawdź, czy każda taka bramka ma
  swój `APIError.odmowa` albo równoważny czytelny komunikat, a nie generyczny
  błąd sieci.

### Część B — pomysły na podniesienie funkcjonalności

**Świadomie NIE lista zleceń — kandydaci do oceny.** Każdy wymaga pytania
właściciela wprost, po polsku, zanim ruszy budowa (żaden też nie jest tak
oczywisty jak wyglądał brief Fazy 10 z „PDF, którego nie było" — sprawdź, czy
backend faktycznie to obsługuje, ZANIM zaproponujesz).

- **Umowy (Contracts) w apce.** Inwentarz (`03-finanse.md`) ma je na
  poziomie 2 („podgląd i wysyłka") od Fazy 1, ale nigdy nie doczekały się
  własnej fazy budowy — apka nie ma dziś żadnego ekranu Umów. Realna luka,
  nie pomysł na później.
- **Usuwanie błędnie zarejestrowanej wpłaty** na fakturze (`DELETE
  /api/invoices/[id]/payments/[paymentId]`, poziom 2 wg inwentarza) — apka
  dziś tylko dodaje wpłatę, nie cofa pomyłki.
- **Podgląd zdjęcia paragonu** na profilu kosztu (`KosztDetailView`, zbudowany
  w Fazie 10) — dziś pokazuje samą nazwę załącznika. Ten sam wzorzec co
  `ZalacznikiSekcja.swift` z Fazy 8 (pobranie na żądanie + QuickLook) już
  istnieje w kodzie, to głównie powtórzenie wzorca.
- **Widżet i Siri** — sprawdź, czy warto rozszerzyć zestaw intencji (dziś:
  „zaloguj rozmowę", „zapisz notatkę") o coś z nowszych faz, np. „oznacz
  fakturę jako opłaconą" głosowo.
- Wszystko inne, co wyjdzie przy czytaniu kodu i rozmowie z właścicielem —
  ta lista jest punktem startu, nie sufitem.

## Jak pracować

Te same zasady, co przy każdym poprzednim module tego projektu (patrz
`00-plan.md` → „Jak pracujemy" i sekcja „Trzy reguły żyją w DWÓCH miejscach"):

- **Zielony build nie jest dowodem.** Uruchom, obejrzyj zrzut, sprawdź curlem.
- **Sprawdzaj, czy coś WOŁA kod, nie czy kod istnieje.** Cztery udokumentowane
  przypadki w tym projekcie (Moduł 30, 31, WhatsApp, `list_unsubscribe_url`)
  — piąty jest bardziej prawdopodobny niż zerowy.
- **Dokumentacja kłamie — weryfikuj gretem.** `00-plan.md` twierdzi rzeczy o
  stanie apki; część z nich sprawdź na nowo, zamiast wierzyć na słowo.
- Ustalenia wymagające decyzji nietechnicznej (każdy kandydat z Części B, ale
  też np. „czy dzielić AppStore") idą do właściciela wprost, po polsku — nie
  są rozstrzygane samodzielnie.

## Wynik

Lista ustaleń z priorytetem (Część A), plus osobna, jawnie oznaczona lista
kandydatów na nowe funkcje z krótką oceną kosztu/ryzyka każdego (Część B).
Jeśli coś sprawdzone wyszło w porządku — wypisz to też wprost, to też jest
wynik (nie tylko błędy).
