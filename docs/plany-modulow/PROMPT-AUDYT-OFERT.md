# Prompt do wklejenia w nowym czacie — AUDYT modułu Oferty

> Powstał 2026-07-27, po pięciu rundach pracy nad modułem w jednym czacie
> (panel + apka iOS/iPadOS). Ten czat urósł do granic kontekstu, więc audyt
> robimy świeżą głową i świeżymi oczami.

Moduł **Oferty** został właśnie domknięty w panelu (`leggeralabs.pl/admin`,
repo bieżące) oraz w apce (`leggera-hub-ios`, osobne repo:
`/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`). **Twoje zadanie to audyt
tego, co powstało — nie dokładanie nowych funkcji.**

## Najpierw przeczytaj

- `HUB_SETUP.md` → sekcje: „Moduł 57 — Oferty" (jeśli jest), „Moduł 57,
  runda 2/3/4", „Blokada dokumentów po wysłaniu", „Kolor «dokument wysłany»",
  „Szablony ofert — cennik po badaniu rynku".
- `docs/plany-modulow/51-audyt-uiux-panel-i-apka.md` → „Stan po module Oferty"
  wraz z rundami 2–5.
- `CLAUDE.md` — zasady projektu (szczególnie: każda trasa w `app/api` jest
  domyślnie OTWARTA, migracje idempotentne, `npx tsc --noEmit` + `npm test`).
- `docs/DO-PRAWNIKA-I-TLUMACZA.md` → „Oferta — zapisy podatkowe".

## Co dokładnie sprawdzić

### 1. Czy blokady naprawdę blokują
Reguły żyją w `lib/blokadaDokumentu.ts`, a egzekwują je trasy. Sprawdź
**każdą drogę zapisu**, nie tylko `PATCH /api/offers/[id]`:
pozycje, sekcje, `bulk`, `apply-template`, `duplicate`, `version`, `accept`,
`send`, `remind`, trasy publiczne. Pytanie kontrolne: **czy da się zmienić
treść wysłanej oferty jakąkolwiek trasą?** Grep po plikach kłamie — sprawdzaj
per uchwyt HTTP.

To samo dla faktur (`numer` = wystawiona) i umów (`Podpisana`). Przy fakturach
sprawdź także trasy pozycji i płatności.

### 2. Czy migawka trzyma
`offers.migawka` + publiczna trasa. Sprawdź:
- co widzi klient, gdy treść w bazie zmieni się po wysyłce (powinna zostać
  migawka; kolejność scalania już raz to wywróciła),
- czy status i ślady akceptacji SĄ żywe (inaczej po podpisaniu klient dalej
  widzi przycisk „Akceptuję"),
- czy pozycje opcjonalne wybrane przez klienta trafiają na fakturę zgodnie
  z tym, co widział on, a nie z tym, co jest w bazie,
- oferty sprzed zmiany (bez migawki) — fallback.

### 3. Liczby, które mogą kłamać
Wskaźniki na liście ofert i na Pulpicie: ważony pipeline, skuteczność, średnia,
„po terminie", „bez decyzji". Sprawdź, czy oferty ZASTĄPIONE nową wersją
(`superseded_at`) wypadają wszędzie, gdzie powinny, i czy waluty nie sumują się
po cichu. Statystyka „dlaczego przegrywamy" — czy liczy to, co obiecuje.

### 4. Parytet panel ↔ apka
Trasy, których `APIClient.swift` nie woła (grep po `/api/offers`), oraz
odwrotnie: ekrany apki, które wołają trasy nieistniejące na produkcji.
Sprawdź też, czy apka nie proponuje akcji, które serwer odrzuci (blokady).

### 5. Wydruk i to, co widzi klient
Trzy języki (PL/EN/DE), waluty, kwoty netto, odwrotne obciążenie, certyfikat
akceptacji, pozycje opcjonalne, bloki treści, numer dokumentu. **Otwórz
publiczny link na iPhonie (Safari)** — numer `OF-2026-…` liczy się przez
`documentYear()`, ale sprawdź, czy nigdzie nie został `new Date()` na znaczniku
z Postgresa.

### 6. RODO i dane
Ślad otwarcia (czas + licznik, świadomie BEZ IP), e-podpis (nazwisko, IP, UA),
prośby o zmianę, migawka (kopia danych osobowych klienta!). Czy retencja
z Audytu 2 obejmuje migawki? Czy usunięcie klienta sprząta to, co powinno?

## Lekcje z tych pięciu rund — sprawdź, czy nie powtórzyły się gdzie indziej

1. **Blokada w interfejsie nie jest blokadą** — regułę musi egzekwować trasa.
2. **Kolejność scalania** przy migawce: `{...migawka, ...żywe}` unieważnia całą
   funkcję. Złapane testem end-to-end, nie przeglądem kodu.
3. **Podwójne filtrowanie tej samej reguły** (pozycje opcjonalne) — kwota nie
   przeliczała się, a na ekranie wyglądało to jak „nic się nie stało".
4. **Widok iPada we wspólnej mapie modułów** (`WidokModuluWiecej`) = pusty
   ekran z żółtym trójkątem na iPhonie, BEZ wpisu w raportach awarii.
5. **Dwa `.sheet(isPresented:)` na jednym widoku** wykluczają się nawzajem.
6. **Jednorazowy skrypt po `didFinish`** nie ukryje elementu, który React
   dorysowuje po pobraniu danych — potrzebna reguła CSS przed renderem.
7. **`toISOString()` w teście** vs daty lokalne w bibliotece — test padał co
   noc przez dwie godziny.
8. **Didaskalia w treści** gotowych bloków szły prosto do klienta.

## Czego NIE robić

- Nie dokładaj funkcji. Jeśli coś jest brakiem, **zapisz to jako wniosek**,
  nie buduj.
- Nie ruszaj rzeczy z `PO_REJESTRACJI.md` (firma niezarejestrowana).
- Nie zmieniaj kolorów statusów — to zostało rozstrzygnięte 2026-07-27
  (wygrała paleta apki, faktury świadomie zostały neutralne).
- Nie pisz treści prawnych — idą do `docs/DO-PRAWNIKA-I-TLUMACZA.md`.

## Na koniec audytu

- Raport: co działa, co jest realną dziurą, co jest świadomym kompromisem.
  Każdy wniosek z dowodem (ścieżka pliku, zapytanie, zrzut) — bez „wygląda na".
- Poprawki: TYLKO oczywiste błędy z jednoznacznym rozwiązaniem, każda osobnym
  commitem.
- Zaktualizuj `HUB_SETUP.md` i `docs/plany-modulow/51-audyt-uiux-panel-i-apka.md`.
- Przygotuj prompt do następnego modułu w kolejce: **Umowy**
  (`docs/plany-modulow/PROMPT-58-UMOWY.md` już istnieje — uzupełnij go
  o wnioski z audytu, w tym o brakujący ANEKS jako dokument).
