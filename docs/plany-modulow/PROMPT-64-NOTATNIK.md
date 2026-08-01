# Prompt do wklejenia w nowym czacie — NOTATNIK

> Powstał 2026-08-01, po domknięciu Kosztów (Moduł 63).

---

## ZACZNIJ OD TEGO — inwentarz mylił się CZTERY razy z rzędu

Wiersz „Notatnik" w `59-spojnosc-ui.md` pokazuje 2 ❌ (Klawiatura, Stany)
i 3 ⚠️ (Nawigacja, Treść, Integralność). **Ta liczba nic nie znaczy, dopóki
jej nie zmierzysz.**

Przy Projektach, Fakturach, Katalogu i Kosztach powtórzyło się dokładnie to
samo, za każdym razem: większość ❌ była nieaktualna (sprzątnęły je paczki
A–G, których nikt do tabeli nie wpisał), a realną pracą okazywało się coś,
czego w tabeli nie było wcale. Przy Kosztach było to **4 z 4 pozycji
nieaktualne** — a prawdziwą robotą brak waluty, brak terminu płatności
i sześć cichych podmian w trasach.

**Wniosek: sondę puść nawet tam, gdzie tabela pokazuje ✅.**

### Jedno ❌ jest prawdopodobnie NIEAKTUALNE

**Klawiatura** ❌: `app/[lang]/admin/notes/` ma 4 trafienia
`useSkrotyListy` / `PoleSzukania` / `useContextMenu`. Zweryfikuj pomiarem
w przeglądarce i popraw wiersz.

### Trzy konkrety z rekonesansu, sprawdzone gretem przy pisaniu tego promptu

**1. Notatnik nie ma ANI JEDNEGO `zeSlownika`** — 0 trafień w 7 plikach tras
(13 uchwytów HTTP). To ta sama rodzina, którą zamknęły Faktury, Katalog
i Koszty. Sprawdź, co Notatnik trzyma w polach słownikowych (rodzaj notatki,
status przekucia, powiązanie) i czy śmieć nie zamienia się tam po cichu
w wartość domyślną. **Zacznij od testu różnicowego**: wyślij śmieć,
przeczytaj, porównaj. Wzorzec poprawki gotowy — `czytajPolaKosztu()`
w `lib/costs.ts` (najświeższy) albo `czytajPolaKatalogu()` w `lib/catalog.ts`.

**2. `DELETE` nie sprawdza, czy rekord istnieje** — `app/api/notes/[id]`
i `app/api/notes/[id]/activity/[activityId]` kasują na ślepo i oddają
`{"ok":true}`. Katalog i Koszty zamknęły to 404-ką: kasowanie czegoś, czego
nie ma, wygląda w UI identycznie jak kasowanie udane, więc zdublowana
zakładka albo stary link nie mają jak się pokazać.

**3. Integralność ⚠️ przy module, który jest WEJŚCIEM danych.** Notatnik
przekuwa notatkę w lead/projekt/zadanie — czyli jest źródłem rekordów w innych
modułach. Sprawdź, czy idempotencja przekuwania siedzi NA SERWERZE (pamięć
`modul-26-notatnik`), a nie w blokadzie przycisku: dwa kliknięcia z dwóch
kart to dwa leady.

---

## Co zastajesz po Kosztach (Moduł 63)

- **`czytajPolaKosztu()` / `czytajPolaCyklu()`** (`lib/costs.ts`) — najnowszy
  wzorzec bramki zapisu: jedna funkcja dla `POST` i `PATCH`, 400 z powodem,
  `PATCH` naprawdę częściowy, wyjątek dla stanu „przyszło niekompletne
  z importu".
- **`normalizeCostRow()`** — odporność po stronie ODCZYTU, osobno od bramki.
- **`maPrzelicznik()`** — wzorzec „danej, której NIE DA SIĘ policzyć": jest
  z sum wyłączona, ale wyłączenie jest WIDOCZNE. Ciche pominięcie kłamie
  gorzej niż zła liczba.
- **`stopienPilnosci` na DACIE, nie w statusie** — czerwień po terminie idzie
  rampą pilności; pigułka statusu zostaje przy skali stanu.
- **Bramka zapisu wymaga cofania optymistycznego `setState` w UI** — inaczej
  ekran pokazuje wartość, której nie ma w bazie. I dosłownego powodu z bramki
  zamiast „Nie udało się zapisać".
- **`lib/instrukcje.ts` ma dziewiąty moduł (Koszty).** Zmiana gestu, skrótu
  albo miejsca kontrolki = poprawka tam, w tym samym commicie.

**Punkt startu:** sprawdź `git log` w obu repozytoriach i upewnij się, że
wierzchołkiem jest commit Modułu 63 — jeśli nie, ktoś pracował po drodze.

**ZANIM ZACZNIESZ — przeczytaj:**
- `CLAUDE.md` — zasady projektu, w tym design system.
- `docs/plany-modulow/59-spojnosc-ui.md` — lista kontrolna z 10 kategorii.
  Wypełnij wiersz „Notatnik".
- `HUB_SETUP.md` → „Audyt Katalogu (Moduł 62)" i **„Audyt Kosztów (Moduł 63)"**.
- `docs/plany-modulow/51-audyt-uiux-panel-i-apka.md` → „Stan po module Koszty".

---

## Dlaczego ten moduł jest inny niż poprzednie

Notatnik to **jedyny moduł bez własnego kształtu danych**: nie ma kwot, dat
wymagalności ani statusu dokumentu. Ma za to trzy rzeczy, których nie ma
nigdzie indziej:

- **treść dowolną** — czyli jedyne miejsce, gdzie liczy się typografia
  i długi tekst, a nie tabela;
- **przekuwanie** — notatka staje się leadem/projektem/zadaniem, więc błąd
  tutaj rodzi rekord w INNYM module;
- **szkic notatki z maila** (Moduł 50, lokalny model) — punkt AI, w którym
  „model proponuje, właściciel zatwierdza" musi być widoczne.

Ryzyko jest więc inne niż przy Kosztach: nie zła liczba, tylko **zgubiona
treść** i **rekord-duch** powstały z podwójnego przekucia.

## Zakres

### A. Integralność — sonda `curl` PER UCHWYT HTTP

```bash
DEV_ADMIN_BYPASS=0 npx next dev -p 3111   # sonda 401
npx next dev -p 3111                       # sonda biznesowa
```

**Licz UCHWYTY, nie pliki.** W `app/api/notes` jest **13 uchwytów w 7 plikach**
(policzone gretem po `export async function`). Sprawdź każdy osobno; dorzuć
`app/api/reminders` (9 uchwytów), jeśli przekuwanie tam sięga.

Poza `isAuthed()`: podmiany z rekonesansu #1, `DELETE` nieistniejącego,
`PATCH` częściowy czy zastępujący, **idempotencja przekuwania**, limit
długości treści (co się dzieje przy notatce na 5 MB?) oraz co zostaje po
usunięciu notatki, z której powstał lead.

### B. Dwa ❌ i trzy ⚠️ z inwentarza

| kategoria | co znaczy ❌/⚠️ |
|---|---|
| **Klawiatura** ❌ | **prawdopodobnie nieaktualne** — patrz wyżej, zmierz i popraw wiersz |
| **Stany** ❌ | czy pusty Notatnik, błąd wczytania i „brak wyników szukania" to TRZY różne ekrany? (paczka E dała ten wzorzec innym) |
| **Nawigacja** ⚠️ | czy notatka ma adres rekordu `/admin/notes/<id>`? czy da się do niej odesłać linkiem? |
| **Treść** ⚠️ | długi tekst, zawijanie, typografia — jedyny moduł, gdzie to jest sedno, nie ozdoba |
| **Integralność** ⚠️ | patrz sonda i rekonesans #3 |

Rozstrzygaj **pomiarem**: `getComputedStyle` na klonie + wzór WCAG.

### C. Cała lista kontrolna, trzy platformy

Szczególnie: **przekuwanie** (czy widać, co powstanie, ZANIM klikniesz?),
szkic z maila (czy „to propozycja" jest widoczne?), oraz parytet z apką —
Notatnik na iPadzie bez `NavigationStack` miał martwą nawigację (pamięć
`apka-ipad-skroty-i-pencil-naprawy`), sprawdź, czy to nadal zamknięte.

### D. Ruch i haptyka

Panel: `lib/motion.ts` (`SPRING`, `EASE_LIQUID`), żadnych liczb z palca.
Apka: `Ruch.swift`, haptyka przy GARDŁACH.

---

## Świadome decyzje — NIE cofaj bez pytania

- **Szkic notatki z maila zawężony do źródła „mail"** (Moduł 50) — rozmowa
  telefoniczna została poza zakresem świadomie, quick-log bez zmian.
- **Model tylko PROPONUJE** — nie skracaj drogi zatwierdzania.
- **Eksporty świadomie BEZ sufitu** — obcięty plik kłamie gorzej niż wolny.

## Czego NIE ruszać

- `PO_REJESTRACJI.md` — firma nie jest zarejestrowana.
- Przeprowadzka na NAS (Moduł 55) — czeka na rejestrację.
- Nowy punkt użycia lokalnego LLM wymaga wyraźnej prośby właściciela.

---

## Weryfikacja — działające procedury

**Panel lokalnie** (PGlite + dev-login): `npm run dev`, potem narzędzia
przeglądarki. Pułapki, na których traci się czas:

- **Next 16 nie uruchomi drugiego serwera dev dla tego samego katalogu** —
  i potrafi zostawić OSIEROCONY proces z poprzedniej sesji na porcie 3000.
  Sprawdź `lsof -iTCP -sTCP:LISTEN | grep 3000` i ubij go, zanim zaczniesz;
  inaczej sonda dostaje `000` i wygląda jak awaria tras.
- **Baza PGlite kasuje się przy KAŻDYM przeładowaniu modułów serwera** — nie
  tylko przy restarcie. Twórz dane testowe i mierz je w jednym ciągu.
- **Konsola przeglądarki oddaje HISTORIĘ, nie stan bieżący.** Rozstrzyga
  `get_page_text` albo `read_page`.
- `getComputedStyle` na elemencie z `transition` zwraca wartość POCZĄTKOWĄ —
  rozstrzyga klon (`cloneNode`). Kontrast licz po KOMPOZYCJI rgba na
  nieprzezroczystym tle przodka. **I mierz NAJGŁĘBSZY węzeł z tekstem** —
  opakowanie `Tooltipa` ma `display: contents`, nie niesie koloru i zwróci
  odziedziczone `--fg` (przy Kosztach dało to niemal biel tam, gdzie ekran
  był czerwony).
- **Klikając w treść strony z poziomu JS, wyklucz pasek boczny** — `[...
  document.querySelectorAll('button')].find(b => b.textContent === 'X')`
  trafia najpierw w link nawigacji i przenosi Cię na inny ekran.
- `npx tsc --noEmit` **nie widzi CSS-a, SQL-a ani JSX-a, który odrzuci
  Turbopack**. Po każdej paczce **załaduj dotknięty ekran**.
- `npm test` — 170 przypadków; `test/koszty.test.ts` i `test/katalog.test.ts`
  jako wzór testu bramki zapisu (czysta funkcja, bez bazy).

**Apka w symulatorze na LOKALNYM panelu:**

```bash
curl -s -X POST http://localhost:3000/api/admin/login \
  -H 'content-type: application/json' \
  -d '{"password":"<z .env.local>","device":"Symulator"}'   # ciało MUSI mieć `device`

SIMCTL_CHILD_LEGGERA_DEV_BACKEND=lokalny \
SIMCTL_CHILD_LEGGERA_DEV_TOKEN=<token> \
SIMCTL_CHILD_LEGGERA_DEV_ZGODA_CICHA=1 \
  xcrun simctl launch <udid> pl.leggeralabs.hub
```

`Skrypty/stempel-wersji.sh` **przed** `xcodebuild` — inaczej build zatrzyma
się błędem „Stempel wskazuje rewizję X, a repozytorium stoi na Y".
**`simctl install` kasuje zapisany token** — po każdej reinstalacji weź NOWY.
Przestrzeń dotyku symulatora ≠ piksele zrzutu. Notatnik siedzi pod „Więcej"
na iPhonie, a w pasku bocznym na iPadzie.

---

## Lekcje warte sprawdzenia akurat u Notatnika

1. **`{"ok":true}` bywa kłamstwem** — zero `zeSlownika` w 13 uchwytach.
2. **`PATCH` bywa `PUT`-em w przebraniu.** Test: wyślij `PATCH` z JEDNYM
   polem i przeczytaj resztę.
3. **Bramka zapisu nie naprawia bazy** — dokładając walidację, dołóż
   odporność po stronie odczytu.
4. **Bramka zapisu psuje optymistyczny UI** — gdy trasa zacznie odmawiać,
   każdy edytor musi cofać podmianę i pokazywać powód.
5. **Idempotencja należy do SERWERA.** Blokada przycisku nie chroni przed
   drugą kartą.
6. **Komentarz SQL `--` wewnątrz `sql\`…\`` wycina resztę zapytania.**
7. **Nowe pole w Swifcie to TRZY miejsca** — właściwość, `CodingKeys`
   i `init(from:)`. Pominięcie trzeciego kompiluje się i po cichu nie działa.

---

## Na koniec modułu

- Dopisz „Stan po module Notatnik" do `51-audyt-uiux-panel-i-apka.md`.
- **Wypełnij wiersz „Notatnik"** w tabeli wyniku w `59-spojnosc-ui.md`.
- Uzupełnij `HUB_SETUP.md` — każdy nowy wzorzec z jednym zdaniem UZASADNIENIA.
- Dopisz moduł do `lib/instrukcje.ts` — dopiero gdy jest sprawdzony.
- Przygotuj prompt do następnego modułu: **Przypomnienia** (2 ❌, 4 ⚠️)
  albo **Kalkulator** (2 ❌).
- `rm -f .git/index.lock && git add -A && git commit && git push`.
