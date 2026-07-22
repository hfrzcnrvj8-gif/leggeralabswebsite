# Brief: dalsze użyteczności Kalendarza (powtarzanie, zaproszenia, przeciąganie)

> Spisany 2026-07-22 po pytaniu właściciela „czy mogę przeciągać wydarzenia
> i czy są jeszcze jakieś użyteczności warte dodania". Stan wyjściowy:
> apka wydanie 71, panel po module Przypomnień (baza + API).
> **Każda z trzech pozycji to osobny czat.**

## Zanim cokolwiek zaczniesz: dwie rzeczy, które JUŻ SĄ

Sprawdzone gretem 2026-07-22, nie z pamięci:

- **Subskrypcja ICS działa i jest wpięta**: `lib/events.ts` → `buildICS()`,
  `GET /api/calendar/ics?token=…`, `GET /api/calendar/ics-info`, przycisk
  w `CalendarView.tsx:641`. Warunek działania: `CALENDAR_ICS_SECRET` w env
  Vercela — bez tego route zwraca błąd i przycisk się nie pokazuje. **Nie
  buduj tego drugi raz**; jeśli właściciel mówi „nie mam subskrypcji", zacznij
  od sprawdzenia env, nie od kodu.
- **Wyszukiwarka obejmuje wydarzenia** (`app/api/search/route.ts:64`).

## 1. Powtarzanie (cykliczne wydarzenia) — największa luka, największy zakres

Potwierdzone: w schemacie `events` (`lib/db.ts`) NIE MA żadnej kolumny
cykliczności. Kolumny to `id, tytul, opis, data, godzina, lead_id, project_id,
client_id, data_koniec, czas_trwania_min, lokalizacja, alert_minut_przed`.

Dlaczego to boli akurat tu: stałe punkty jednoosobowej firmy (miesięczne
rozliczenie z księgową, cotygodniowy przegląd, roczne odnowienie domeny) trzeba
dziś wpisywać ręcznie za każdym razem. To jedyna pozycja z tej listy, która
DOKŁADA pracy w każdym tygodniu, zamiast oszczędzać kliknięcia.

Do rozstrzygnięcia z właścicielem NA STARCIE (to jest właściwy zakres briefu,
nie szczegół wdrożenia):

- **Model**: własne pola (`powtarzanie TEXT`, `powtarzanie_do DATE`) czy pełna
  reguła RRULE z RFC 5545? RRULE jest droższe, ale `buildICS()` już istnieje
  i feed do Apple Kalendarza umiałby wtedy przenieść serię jako serię, a nie
  jako setkę osobnych wydarzeń.
- **Wyjątki**: czy „przełóż ten jeden raz" i „usuń ten jeden raz" mają być
  w wersji pierwszej? Bez nich seria jest sztywna i szybko zaczyna kłamać.
  Z nimi dochodzi tabela wyjątków i pytanie „ta okazja czy cała seria?" przy
  KAŻDEJ edycji i kasowaniu — także w apce.
- **Rozwijanie**: seria w bazie jako jeden wiersz + rozwijanie w locie przy
  czytaniu miesiąca, czy materializacja N wystąpień? Rozwijanie w locie jest
  czystsze, ale dotyka WSZYSTKIEGO, co dziś czyta `events` (kalendarz panelu,
  apka, `hub/today`, ICS, wyszukiwarka, alerty).

Pułapka: `WydarzenieAlerty.swift` w apce planuje lokalne powiadomienia per
wydarzenie. Seria bez ograniczenia horyzontu potrafi wysypać limit 64
oczekujących powiadomień iOS-a.

## 2. Zaproszenie dla klienta mailem — najlepszy stosunek wartości do pracy

Dziś `.ics` służy WYŁĄCZNIE właścicielowi (subskrypcja własnego kalendarza).
Nie da się wysłać klientowi maila, po którym spotkanie wskoczy do JEGO
kalendarza — a to jest ta rzecz, którą klient odbiera jako „ta firma ma
poukładane".

Wszystko potrzebne stoi: `buildICS()` (umie już DATE-TIME z czasem trwania),
maszyneria maili (`lib/mail.ts`, Resend), powiązanie wydarzenia z klientem
(`events.client_id`, Moduł 30) i lokalizacja (`events.lokalizacja`).

Zakres do ustalenia: sam załącznik `.ics` (proste, działa wszędzie) czy pełne
`METHOD:REQUEST` z uczestnikami i odpowiedziami „przyjmuję/odrzucam"? To drugie
wymaga adresu, który odbiera odpowiedzi — czyli realnie skrzynki i parsowania,
a apka ma już IMAP (`lib/mailSync.ts`), więc jest to wykonalne, ale to inny
rozmiar. **Zacznij od pytania, nie od kodu.**

## 3. Przeciąganie wydarzeń — ale w PANELU, nie na telefonie

Ocena podana właścicielowi 2026-07-22: na telefonie to wygoda, nie przełom —
przełożenie spotkania i tak zwykle wymaga powiadomienia klienta, więc i tak
wchodzi się w profil. Wyraźnie więcej daje przy biurku, gdzie widać cały
miesiąc i planuje się tydzień. Właściciel tego nie zakwestionował, ale też nie
potwierdził wprost — **upewnij się przed pisaniem kodu**.

Gdyby jednak miało wejść do apki: rozpiska dnia (`RozpiskaDnia`
w `KalendarzView.swift`) ma już wszystko, czego trzeba do przeciągania po
godzinach — bloki są pozycjonowane `offset`-em z minut, więc odwrotny rachunek
(pozycja → minuty) jest trywialny. Siatka miesiąca jest trudniejsza: to gęsty
`HStack` komórek, a ten układ ma w tym pliku UDOKUMENTOWANĄ historię gestów,
które łapią nie tę komórkę, co trzeba (patrz komentarz przy
`KomorkaDniaPrzycisk` i `25-wynik-faza14…md`). Dowód działania NA EKRANIE,
nie sam build.

## Czego świadomie NIE polecono

- **Siatka tygodniowa z godzinami na telefonie** — siedem kolumn godzin na tej
  szerokości to dokładnie ten rodzaj gęstości desktopu, przez który poległa
  PWA (lekcja nr 2 z `00-plan.md`). Rozpiska JEDNEGO dnia to co innego: jedna
  kolumna mieści się bez ściskania i dlatego weszła (wydanie 70).
- **Pełny system rezerwacji w stylu Calendly** — to nie brak w kalendarzu,
  tylko osobny produkt (strona publiczna, dostępność, potwierdzenia, odwołania).
  Jeśli właściciel o to poprosi, traktuj jak nowy moduł, nie jak dokładkę.
