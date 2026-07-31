# Prompt do wklejenia w nowym czacie — moduł PROJEKTY

> Powstał 2026-07-31, po domknięciu Modułu 59 (przegląd spójności).
> Poprzedni w kolejce: Umowy (`PROMPT-58-UMOWY.md`).

Kontynuujemy audyt UI/UX i kompletności panelu (leggeralabs.pl/admin, repo
bieżące) oraz apki natywnej iPhone/iPad (`leggera-hub-ios`, osobne repo:
`/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`), moduł po module,
w kolejności lejka sprzedaży. **Pulpit, Leady, Klienci, Oferty i Umowy są
zrobione.**

**Teraz bierzemy moduł: Projekty** — etapy 8–10 lejka (Onboarding →
Kickoff/kamienie → Realizacja), czyli wszystko, co dzieje się PO podpisaniu
umowy i PRZED wystawieniem faktury.

**ZANIM ZACZNIESZ — przeczytaj:**
- `CLAUDE.md` — zasady projektu.
- `docs/plany-modulow/51-audyt-uiux-panel-i-apka.md` — kontekst inicjatywy
  i sekcje „Stan po module…" (Pulpit, Leady, Klienci, Oferty, Umowy).
- `docs/plany-modulow/59-spojnosc-ui.md` — **lista kontrolna z 10 kategorii,
  którą masz POWIELIĆ na Projektach.** To jest narzędzie tego audytu, nie
  zamknięte zadanie. Przeczytaj też „Paczkę G", bo tam są dwa wzorce z 31.07.
- `HUB_SETUP.md` → wszystko o Projektach, plus wzorce z Modułu 59
  („trzy warstwy powierzchni", „wiersz profilu", „klawiatura listy",
  „gest w bok", „dwa kafle na jednej krawędzi").
- `docs/plany-modulow/00-mapa-drogi-klienta.md` — Projekty to Krok 3–4.
  Patrz też Moduł 14 (onboarding), 15 (zamknięcie i opinie), 19 (czas),
  31 (bramka umowy).
- `docs/plany-modulow/KANDYDACI-FUTURE-PROOF.md` — zanim zaproponujesz
  cokolwiek „bo tak robi konkurencja".

---

## ⚠️ Czego NIE rób drugi raz — Moduł 59 objął Projekty globalnie

Przegląd spójności (28–31.07) przeszedł przez WSZYSTKIE moduły naraz. Projekty
dostały z niego, **bez osobnego audytu**:

| paczka | co Projekty dostały |
|---|---|
| C | `/`, `j`/`k`, `Enter`, `Esc` przez wspólny `useSkrotyListy` + `PoleSzukania` (wcześniej miały tylko cyfry statusu przy otwartym profilu) |
| E | trzy warianty pustego stanu, `StanBledu` zamiast wiecznego szkieletu |
| F | `MetaRow` **usunięty** — profil idzie przez `SekcjaProfilu`/`WierszPola`; podpowiedź terminu („za 3 dni") przeniesiona na `sufiks` |
| D/D+ | słownik koloru: jedno źródło dla panelu i apki |
| G | gest w prawo (Stoper) potwierdzony jako poprawny; „Wdrożone" na Pulpicie przeniesione na prawo |

**Nie przepisuj tego od nowa.** Zweryfikuj, że działa, i idź dalej.

Co inwentarz Modułu 59 zostawił Projektom jako ⚠️ i czego paczki A–G **nie**
tknęły: **Kolor**, **Nawigacja**, **Treść**. To są trzy pierwsze rzeczy do
sprawdzenia.

---

## Konkret znaleziony przy pisaniu tego promptu (sprawdź i napraw)

**`PATCH /api/projects/:id` nie waliduje słownika.** Trasa zapisuje `status`,
`priorytet` i `zdrowie` przez `str(body.…)` prosto do bazy. `PROJECT_STATUSES`
istnieje w `lib/projects.ts:260`, ale **żadna trasa w `app/api` go nie
importuje** — jedyny import to `CLOSED_PROJECT_STATUSES`, i to do czegoś
innego (wyzwalacz prośby o opinię).

To dokładnie ta sama dziura, którą paczka A Modułu 59 zamknęła w Leadach
i Fakturach. Konsekwencja jest cicha: dowolny string w statusie przechodzi,
a potem mapa `PROJECT_STATUS_CLASS` nie ma dla niego koloru i pigułka wychodzi
bez tła (ta usterka wyszła już raz — patrz „Tailwind nie skanował lib/").

Sprawdź przy okazji `zdrowie` i `priorytet` — mają własne słowniki?

---

## Co sprawdzić

### 1. Parytet między platformami

Panel: `app/[lang]/admin/projects/` (`ProjectsDashboard.tsx`,
`ProjectDetailPanel.tsx`, `ProjectTimeline.tsx`), `lib/projects.ts`.
Apka: `ProjektyListView.swift`, `ProjektDetailView.swift`,
`ProjektyPanelIpad.swift`.

**Dowód luki w apce to trasa panelu, której `APIClient.swift` nie woła** —
grep po `/api/projects`. Odwrotnie NIE działa. Stan na 31.07: apka woła
prawie wszystko (kamienie, zadania, zależności, onboarding, zasoby, opinie,
reorder), **nie woła dwóch**:

- `GET /api/projects/timeline` — Oś czasu istnieje tylko w panelu. Zapytaj,
  czy iPad ma ją dostać; na iPhonie prawie na pewno nie (poziom 3).
- `GET /api/projects/export` — świadomie, eksporty są zadaniem biurkowym
  (Moduł 38).

### 2. Domknięcie lejka w obie strony

- **Umowa → projekt.** Bramka Modułu 31 jest TWARDA, ale tylko dla projektów
  z `client_id` (robota wewnętrzna wolna). Czy odmowa mówi, CO zrobić, i czy
  z projektu widać umowę?
- **Projekt → faktura.** Czy z zakończonego projektu da się wystawić fakturę
  jednym ruchem, czy trzeba przepisywać ręcznie?
- **Projekt → opinia** (Moduł 15). `request-review` i `review-link` istnieją;
  czy prośba o opinię ma widoczny ślad i czy da się ją wysłać dwa razy bez
  śladu (idempotencja z WIDOCZNYM śladem — lekcja z Ofert).
- **Onboarding** (Moduł 14) — czy checklista faktycznie startuje sama po
  podpisaniu umowy, czy trzeba o niej pamiętać.

### 3. Integralność — sonda, nie grep

Moduł ma **28 uchwytów HTTP w 21 plikach** — najwięcej ze wszystkich
audytowanych. Sprawdzaj **per `export async function`, nie per plik** (audyt
Ofert znalazł tak siedem otwartych tras w module opisanym jako domknięty).

Szczególnie: `app/api/projects/review/public/[token]/` — dwie trasy publiczne
z tokenem. Sprawdź, czy podlegają unieważnianiu linków (Moduł 40) i czy mają
hamulec (`lib/rateLimit.ts`), tak jak publiczne trasy ofert i umów.

### 4. Sufity i wsad

`GET /api/projects` oddaje wszystko **bez limitu i bez `total`**. Wzorzec
„sufit z ostrzeżeniem" jest gotowy w `app/api/offers` i `app/api/clients`
(Moduł 54, krok 3a) — przenieś, nie wymyślaj trzeciego.

### 5. Poziom premium i lista kontrolna Modułu 59

Przejdź **wszystkie 10 kategorii** z `59-spojnosc-ui.md` na Projektach,
na trzech platformach naraz. Weryfikuj **pomiarem**: `getComputedStyle`
w panelu, prawdziwy gest w symulatorze (patrz niżej), `curl` po uchwytach.

---

## Świadome decyzje — NIE cofaj bez pytania

- **„Cykle" w Osi czasu są WYŁĄCZNIE wizualnym rytmem** (naprzemienne pasy co
  14 dni). Bez przypisywania zadań i bez tabeli w bazie. Pełne cykle to nowy,
  większy zakres — dopytaj.
- **„Zdrowie" projektu jest ręczne i niezależne od statusu** — dwie osobne
  osie, jak w Linear.
- **Ikona projektu zostaje EMOJI** (`PROJECT_ICONS` w `lib/projects.ts`) —
  to treść wybierana przez właściciela, jeden z dwóch świadomych wyjątków od
  reguły „w panelu ikony Tablera" (Moduł 33).
- **Kolor paska Osi czasu idzie WG STATUSU**, nie wg pickera ikony.
- **Bramka umowy zostaje twarda** dla projektów z klientem (decyzja 2026-07-17).
- **Drag & drop kamieni i zadań już istnieje** (commit `e7d2800`) — grepuj
  `.onMove` BEZ nawiasu, trailing-closure łapie się inaczej.
- **Poziom apki**: podgląd, stoper i odhaczanie tak; zakładanie projektu
  i planowanie kamieni to biurko. Zapytaj, zanim dołożysz.

---

## Czego NIE ruszać

- **`PO_REJESTRACJI.md`** — firma nie jest zarejestrowana.
- **Przeprowadzka na NAS** (Moduł 55) — czeka na rejestrację.
- **Reguła „model tylko proponuje"** — nowy punkt użycia lokalnego LLM wymaga
  wyraźnej prośby właściciela.

---

## Metoda weryfikacji — co się zmieniło 31.07

**Gesty i dotyk w apce sprawdzasz SAM, nie prosisz właściciela.** Paczka C
zapisała „apka bez zrzutu, bo Debug gada z produkcją i wchodzi przez ekran
logowania" — to już nieaktualne. Droga:

```bash
# 1. panel lokalny musi chodzić
npm run dev

# 2. token z lokalnego panelu — ciało MUSI mieć pole `device`,
#    samo `password` loguje przez cookie i tokenu NIE zwraca
curl -s -X POST http://localhost:3000/api/admin/login \
  -H 'content-type: application/json' \
  -d '{"password":"<z .env.local>","device":"Symulator weryfikacyjny"}'

# 3. apka w symulatorze na PGlite z danymi testowymi
SIMCTL_CHILD_LEGGERA_DEV_BACKEND=lokalny \
SIMCTL_CHILD_LEGGERA_DEV_TOKEN=<token> \
SIMCTL_CHILD_LEGGERA_DEV_TAB=projekty \
SIMCTL_CHILD_LEGGERA_DEV_ZGODA_CICHA=1 \
  xcrun simctl launch <udid> pl.leggeralabs.hub
```

Narzędzia symulatora wykonują **prawdziwy swipe**, więc gesty da się sprawdzić
bez palca właściciela. Przydatne furtki dla tego modułu:
`LEGGERA_DEV_OPEN_PROJECT=<id>` i `LEGGERA_DEV_STOPER=<id>` (README apki).

**Fizyczne urządzenie** zostaje do rzeczy, których symulator nie odda: Face ID,
Wyspa/Live Activity **stopera**, aparat, prawdziwa skrzynka. Wgranie kablem
i podgląd ekranu przez lustro QuickTime opisuje `README.md` apki — **lustro
jest jednokierunkowe**, gest musi tam wykonać właściciel.

---

## Lekcje, które warto sprawdzić akurat u Projektów

1. **Sprawdzenie per PLIK kłamie — licz UCHWYTY HTTP.** Przy 28 uchwytach to
   tu boli najbardziej.
2. **„Na sztywno w kodzie" cicho psuje wskaźniki** (w Ofertach: VAT 23% dla
   każdej pozycji). Sprawdź liczenie postępu, czasu i budżetu projektu.
3. **Idempotencja MUSI mieć widoczny ślad** („Prośba o opinię już wysłana").
4. **Lista, która kłamie pustką** (ustalenie A1) — także przy zerowej liczbie
   kamieni i zadań.
5. **Sąsiedztwo tworzy usterki, których nie widać w kodzie** (lekcja paczki G:
   dwa kafle gestu o tym samym kolorze). Jeśli dołożysz akcję do listy, obejrzyj
   ją obok sąsiadów, nie samą.
6. **`tsc` nie widzi wszystkiego** — nie widzi CSS-a, nie widzi SQL-a i przepuszcza
   składnię, którą Turbopack odrzuca. Po każdej paczce **załaduj dotknięty ekran**.
7. **Data z `<input type="date">` potrafi zapisać niepełny rok** — każde pole daty
   przez `isPlausibleDateString()` i `formatPlDate()`. Projekty mają ich najwięcej
   (start, termin, kamienie).

---

## Na koniec modułu

- Dopisz „Stan po module Projekty" do `51-audyt-uiux-panel-i-apka.md`.
- Wypełnij wiersz „Projekty" w tabeli wyniku w `59-spojnosc-ui.md`.
- Uzupełnij `HUB_SETUP.md` — każdy nowy wzorzec z jednym zdaniem UZASADNIENIA.
- Dopisz moduł do `lib/instrukcje.ts` — dopiero gdy jest sprawdzony.
- Przygotuj prompt do następnego modułu w kolejce: **Faktury** (etapy 11–12).
