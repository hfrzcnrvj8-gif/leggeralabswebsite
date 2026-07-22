# Brief: powtarzanie wydarzeń i przypomnień

> Rozwinięcie punktu 1 z `27-brief-kalendarz-dalsze-uzytecznosci.md`.
> Spisany 2026-07-22, po domknięciu zaproszeń na spotkania (punkt 2).
> Stan wyjściowy: panel po module Przypomnień i po zaproszeniach `.ics`,
> apka wydanie 75.
>
> **To jest brief na osobny czat.** Zaczyna się od trzech pytań do
> właściciela, nie od kodu.

## Po co to w ogóle

To jedyna pozycja z listy 27, która **dokłada pracy w każdym tygodniu**,
zamiast oszczędzać kliknięcia. Stałe punkty jednoosobowej firmy — miesięczne
rozliczenie z księgową, cotygodniowy przegląd, roczne odnowienie domeny —
dziś wpisuje się ręcznie za każdym razem.

**Decyzja właściciela z 2026-07-22: JEDEN mechanizm dla wydarzeń I przypomnień.**
Nie buduj powtarzania tylko dla jednego modułu, nawet gdy prośba dotyczy
jednego. Powód: to ta sama reguła, a dwie implementacje rozjechałyby się tak,
jak rozjechały się mapy kolorów statusu (`slownik-koloru-audyt`).

Zakres obejmuje: `events` ORAZ `reminders`, panel ORAZ apkę.

## Stan faktyczny — sprawdzony gretem 2026-07-22, nie z pamięci

- **Ani `events`, ani `reminders` nie mają żadnej kolumny cykliczności.**
  `events`: `id, tytul, opis, data, godzina, lead_id, project_id, client_id,
  data_koniec, czas_trwania_min, lokalizacja, alert_minut_przed, ics_sequence`.
  `reminders`: `id, tytul, notatka, termin, godzina, priorytet, ukonczone,
  ukonczone_at, lista_id, lead_id, client_id, project_id, flaga, parent_id,
  lokalizacja*, przy_wyjsciu`.
- **`events` czyta OSIEM miejsc** — i każde z nich zobaczy serię:
  `app/api/events` (kalendarz panelu i apki), `app/api/events/[id]`,
  `app/api/calendar/ics` (feed subskrypcji), `app/api/hub/today` (Pulpit),
  `app/api/leads/notify` (dzienny mail + cron), `app/api/search`,
  `lib/eventInviteSend.ts` (zaproszenia), `lib/mailSync.ts` (odpowiedzi
  na zaproszenia).
- **`reminders` czytają cztery trasy** — `app/api/reminders/**`.
- **Wzorzec cykliczności JUŻ ISTNIEJE w tym repo i jest INNY niż to, czego
  potrzebujemy**: `recurring_invoices` / `recurring_costs` (`lib/recurring.ts`)
  to SZABLON + cron, który raz dziennie materializuje kolejny dokument.
  Zadziałało tam, bo faktura musi powstać jako osobny, edytowalny byt.
  Wydarzenie w kalendarzu — niekoniecznie. **Nie kopiuj tego wzorca
  bezrefleksyjnie, ale przeczytaj go**: `nextRunAfter()` i słownik
  `RECURRING_CYCLES` („miesiecznie/kwartalnie/rocznie") są gotowe i sprawdzone,
  łącznie z pułapką „co miesiąc od 31.".

## Trzy decyzje do rozstrzygnięcia Z WŁAŚCICIELEM na starcie

To jest właściwy zakres tego czatu — nie szczegół wdrożenia. Zadaj je wprost,
z rekomendacją, zanim napiszesz linijkę kodu.

### 1. Model: własne pola czy RRULE (RFC 5545)?

- **Własne pola** (`powtarzanie TEXT`, `powtarzanie_do DATE`) — prostsze,
  słownik jak w `recurring.ts`.
- **RRULE** — droższe, ale `buildICS()` już istnieje i feed do Apple Kalendarza
  umiałby wtedy przenieść serię JAKO SERIĘ, a nie jako setkę osobnych
  wydarzeń. Doszedł nowy argument, którego nie było w briefie 27: od
  2026-07-22 wysyłamy klientom **zaproszenia `METHOD:REQUEST`**. Zaproszenie
  na spotkanie cykliczne bez `RRULE` to albo osobny mail na każde wystąpienie,
  albo cicha utrata cykliczności po stronie klienta.

### 2. Wyjątki: „przełóż ten jeden raz" i „usuń ten jeden raz" — w wersji pierwszej?

Bez nich seria jest sztywna i szybko zaczyna kłamać. Z nimi dochodzi tabela
wyjątków i pytanie **„ta okazja czy cała seria?" przy KAŻDEJ edycji
i kasowaniu** — w panelu i w apce.

### 3. Rozwijanie: jeden wiersz + rozwijanie w locie czy materializacja N wystąpień?

Rozwijanie w locie jest czystsze, ale dotyka WSZYSTKIEGO z listy ośmiu
czytelników wyżej. Materializacja jest głupsza, ale nie rusza niczego poza
generatorem — kosztem tego, że seria istnieje tylko tak daleko, jak ją
wygenerowano.

## Pułapki, na które trzeba odpowiedzieć w projekcie

- **Limit 64 oczekujących powiadomień iOS.** `WydarzenieAlerty.swift` planuje
  JEDNO lokalne powiadomienie per wydarzenie (`repeats: false`, identyfikator
  `wydarzenie-alert-<id>`). Seria bez ograniczenia horyzontu wysypie ten limit
  i **po cichu** — iOS nie zgłasza błędu, po prostu nie dostarcza nadmiaru.
  Uwaga: `UNCalendarNotificationTrigger` umie `repeats: true` i to może być
  całą odpowiedzią dla prostych cykli, ale nie dla serii z wyjątkami.
- **Przypomnienia mają już `parent_id` (kroki).** Uważaj, żeby seria i kroki
  się nie pogryzły: **krok powtarzalnego zadania to co innego niż powtarzalny
  krok**. Rozstrzygnij to na papierze, zanim dołożysz drugą samo-referencję.
- **Ukończenie powtarzalnego przypomnienia** ma inne znaczenie niż
  jednorazowego: „zrobione na dziś" ≠ „seria skończona". Apple Reminders
  odhacza wystąpienie i przesuwa termin — to jest wzorzec, o który warto
  zapytać właściciela wprost.
- **Zaproszenia i `ics_sequence`.** Przy serii numer wersji dotyczy CAŁEGO
  spotkania. Przeniesienie jednego wystąpienia to `RECURRENCE-ID`, nie nowy
  `SEQUENCE` — inaczej klientowi przesunie się cała seria. Patrz sekcja
  „Zaproszenia na spotkania" w `HUB_SETUP.md`.
- **Bramka migracji.** Każda nowa `create*Schema()` musi mieć
  `schemaUpToDate()` + `markSchemaApplied()`; nie-DDL wewnątrz migracji owijaj
  w `inMigration()`. Bez tego panel mieli po kilka sekund na zimnym starcie.

## Definicja gotowości

1. Cykl da się ustawić i zdjąć w panelu i w apce, dla wydarzenia i dla
   przypomnienia, tym samym słownikiem.
2. Widok miesiąca pokazuje wystąpienia i **nie zwalnia** (kalendarz panelu
   robi dziś jedno zapytanie na miesiąc — ma zostać jedno).
3. Kasowanie i edycja pytają „ta okazja czy cała seria?" — o ile decyzja 2
   wyszła na „tak".
4. Feed `.ics` i zaproszenia niosą serię zgodnie z decyzją 1.
5. Alerty w apce nie przekraczają limitu 64 — z dowodem, nie z założenia.
6. `npx tsc --noEmit` czysty, apka zbudowana, **oba ekrany obejrzane na żywo**
   (panel lokalnie przez PGlite, apka w symulatorze z
   `LEGGERA_DEV_BACKEND=lokalny`).

## Czego świadomie NIE robimy w tym module

- Zaproszeń na serię wysyłanych osobno na każde wystąpienie (patrz decyzja 1).
- Cykli w Osi czasu projektów — to nadal wyłącznie wizualny rytm
  (`ProjectTimeline.tsx`), świadomie bez przypisywania zadań.
- Kalendarza zespołowego, dostępności, rezerwacji — to osobny produkt
  (patrz „Czego świadomie NIE polecono" w briefie 27).
