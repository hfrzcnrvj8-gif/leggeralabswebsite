# Prompt do wklejenia w nowym czacie — PROJEKTY, sesja 1/2: fundament

> Powstał 2026-07-31. Moduł Projekty rozbity na dwie sesje decyzją właściciela
> — ma 28 uchwytów HTTP w 21 plikach, najwięcej ze wszystkich audytowanych
> dotąd modułów. **Ta sesja: integralność, parytet i dane. Wygląd i gesty
> idą w sesji 2** (`PROMPT-60B-PROJEKTY-WYGLAD.md`) — nie wchodź w nie tutaj,
> nawet jeśli coś rzuci się w oczy; zapisz i zostaw.

Kontynuujemy audyt UI/UX i kompletności panelu (leggeralabs.pl/admin, repo
bieżące) oraz apki natywnej iPhone/iPad (`leggera-hub-ios`, osobne repo:
`/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`), moduł po module,
w kolejności lejka sprzedaży. **Pulpit, Leady, Klienci, Oferty i Umowy są
zrobione.** Teraz **Projekty** — etapy 8–10 lejka (Onboarding →
Kickoff/kamienie → Realizacja), czyli wszystko między podpisaniem umowy
a wystawieniem faktury.

**ZANIM ZACZNIESZ — przeczytaj:**
- `CLAUDE.md` — zasady projektu.
- `docs/plany-modulow/51-audyt-uiux-panel-i-apka.md` — kontekst inicjatywy
  i sekcje „Stan po module…".
- `HUB_SETUP.md` → wszystko o Projektach, o Module 31 (bramka umowy),
  40 (unieważnianie linków) i o audycie Ofert (metoda sondy).
- `docs/plany-modulow/00-mapa-drogi-klienta.md` — Projekty to Krok 3–4.
  Patrz też Moduł 14 (onboarding), 15 (zamknięcie i opinie), 19 (czas).

---

## Dwa konkrety znalezione przy pisaniu tego briefu

Oba są sprawdzone w kodzie 2026-07-31, nie są hipotezami. Zacznij od nich.

### 1. `PATCH /api/projects/:id` nie waliduje słownika

Trasa zapisuje `status`, `priorytet` i `zdrowie` przez `str(body.…)` prosto do
bazy. `PROJECT_STATUSES` istnieje w `lib/projects.ts:260`, ale **żadna trasa
w `app/api` go nie importuje** — jedyny import to `CLOSED_PROJECT_STATUSES`,
i to do czegoś innego (wyzwalacz prośby o opinię).

To ta sama dziura, którą paczka A Modułu 59 zamknęła w Leadach i Fakturach.
Objaw jest cichy: dowolny string przechodzi, a potem `PROJECT_STATUS_CLASS`
nie ma dla niego koloru i pigułka wychodzi bez tła — ta usterka wyszła już
raz w tym projekcie („Tailwind nie skanował lib/").

Sprawdź, czy `priorytet` i `zdrowie` mają własne słowniki, i czy apka
(`APIClient.swift`) też wysyła wyłącznie wartości ze słownika.

### 2. Publiczna trasa opinii nie ma hamulca

`POST /api/projects/review/public/:token/submit` **nie woła `lib/rateLimit.ts`**,
podczas gdy publiczne trasy ofert (`accept`, `comment`) i umów (`accept`) już
go mają. Token jest hasłem-w-linku, więc brak hamulca to jedyna trasa
dokumentowa, którą da się dobijać bez ograniczeń.

**Unieważnianie linków akurat jest w porządku** — `project` jest jednym
z pięciu `ShareLinkKind`, a trasa importuje `SHARE_LINK_REVOKED_MESSAGE`.
Sprawdź to sondą, nie na słowo.

---

## Zakres tej sesji

### A. Integralność — sonda, nie grep

**28 uchwytów HTTP w 21 plikach.** Sprawdzaj **per `export async function`,
nie per plik.** Audyt Ofert znalazł tak siedem otwartych tras w module, który
dokumentacja opisywała jako domknięty — bo plik importował blokadę i wołał ją
w `PATCH`, a `DELETE` tuż niżej był otwarty. Grep po pliku daje wtedy
trafienie i kłamie.

Metoda: `curl` na lokalnym dev-panelu, po każdym uchwycie osobno, z odczytem
stanu bazy po każdej próbie. Gotowa sonda do przerobienia: `HUB_SETUP.md` →
„Audyt Modułu 57".

Lista plików:

```
app/api/projects/route.ts                                (2)
app/api/projects/[id]/route.ts                           (3)
app/api/projects/[id]/activity|milestones|tasks|resources|onboarding|dependencies/…
app/api/projects/[id]/request-review|review-link|review/route.ts
app/api/projects/timeline/route.ts
app/api/projects/export/route.ts
app/api/projects/review/public/[token]/route.ts          ← publiczna, świadomie
app/api/projects/review/public/[token]/submit/route.ts   ← publiczna, świadomie
```

### B. Sufity i wsad

`GET /api/projects` oddaje **wszystko, bez limitu i bez `total`**. Wzorzec
„sufit z ostrzeżeniem" jest gotowy w `app/api/offers` i `app/api/clients`
(Moduł 54, krok 3a) — przenieś, nie wymyślaj trzeciego. Apka filtruje
i sortuje LOKALNIE, więc niepełna lista kłamie też w szukaniu.

To samo pytanie zadaj tabelom podrzędnym: kamienie, zadania, zasoby, log
aktywności. Która z nich potrafi urosnąć i co się wtedy stanie.

### C. Parytet panel ↔ apka

Panel: `app/[lang]/admin/projects/`, `lib/projects.ts`.
Apka: `ProjektyListView.swift`, `ProjektDetailView.swift`,
`ProjektyPanelIpad.swift`, `APIClient.swift`.

**Dowód luki w apce to trasa panelu, której `APIClient.swift` nie woła** —
grep po `/api/projects`. Odwrotnie NIE działa („trasa niewołana" ≠ „funkcja
niewidoczna": może być zrobiona inną drogą).

Stan na 31.07: apka woła prawie wszystko (kamienie, zadania, zależności,
onboarding, zasoby, opinie, oba `reorder`). **Nie woła dwóch:**

- `GET /api/projects/timeline` — Oś czasu istnieje tylko w panelu. Zapytaj
  właściciela, czy iPad ma ją dostać. Na iPhonie prawie na pewno nie.
- `GET /api/projects/export` — świadomie, eksport to zadanie biurkowe
  (Moduł 38).

### D. Domknięcie lejka w obie strony

- **Umowa → projekt.** Bramka Modułu 31 jest TWARDA, ale tylko dla projektów
  z `client_id` (robota wewnętrzna wolna). Czy odmowa mówi, CO zrobić, i czy
  z projektu widać umowę, a z umowy projekt?
- **Projekt → faktura.** Czy z zakończonego projektu da się wystawić fakturę
  jednym ruchem, czy trzeba przepisywać ręcznie?
- **Projekt → opinia** (Moduł 15). `request-review` i `review-link` istnieją.
  Czy prośba o opinię ma **widoczny ślad**, czy da się ją wysłać dwa razy
  i czy panel to pokazuje (idempotencja z widocznym śladem — lekcja z Ofert).
- **Onboarding** (Moduł 14) — czy checklista startuje sama po podpisaniu
  umowy, czy trzeba o niej pamiętać.

### E. Poprawność danych

- **Daty.** Projekty mają ich najwięcej (start, termin, kamienie). Każde pole
  przez `isPlausibleDateString()` (klient **i** serwer) i `formatPlDate()` —
  `<input type="date">` potrafi zapisać rok „0202", jeśli pole straci fokus
  w trakcie pisania.
- **Znaczniki z Postgresa** — `parsePgTimestamp`, nigdy `new Date()` na
  surowym stringu (spacja zamiast `T`, strefa bez dwukropka → `Invalid Date`).
- **Liczenie postępu, czasu i budżetu.** Szukaj wartości „na sztywno
  w kodzie" — w Ofertach taka wpadka (VAT 23 % dla każdej pozycji, także
  zagranicznej) cicho psuła dwa wskaźniki.
- **Stoper** (Moduł 19) — czy zapis czasu przeżywa ubicie apki i czy panel
  liczy to samo, co telefon. Porównuj **arytmetykę**, nie komentarze:
  „1:1 z panelem" w komentarzu nie jest dowodem (`round` vs `floor`, strefa).

---

## ⚠️ Czego NIE rób — Moduł 59 objął Projekty globalnie

Przegląd spójności (28–31.07) przeszedł przez wszystkie moduły naraz. Projekty
dostały z niego **bez osobnego audytu**: klawiaturę listy (`/`, `j`/`k`,
`Enter`, `Esc`), trzy warianty pustego stanu, wiersze profilu przez
`SekcjaProfilu`/`WierszPola` (`MetaRow` usunięty), słownik koloru i kierunek
gestu. **Nie przepisuj tego od nowa** — zweryfikuj i idź dalej.

Inwentarz Modułu 59 zostawił Projektom trzy pola ⚠️: **kolor, nawigacja,
treść**. To jest materiał **sesji 2**, nie tej.

---

## Świadome decyzje — NIE cofaj bez pytania

- **„Cykle" w Osi czasu to WYŁĄCZNIE rytm wizualny** (pasy co 14 dni), bez
  przypisywania zadań i bez tabeli. Pełne cykle = nowy, większy zakres.
- **„Zdrowie" projektu jest ręczne i niezależne od statusu** — dwie osie,
  jak w Linear.
- **Bramka umowy zostaje twarda** dla projektów z klientem (decyzja 07-17).
- **Ikona projektu zostaje EMOJI** (`PROJECT_ICONS`) — jeden z dwóch
  świadomych wyjątków od „w panelu ikony Tablera" (Moduł 33).
- **Drag & drop kamieni i zadań już istnieje** (commit `e7d2800`) — grepuj
  `.onMove` BEZ nawiasu, trailing-closure łapie się inaczej.
- **Poziom apki**: podgląd, stoper i odhaczanie tak; zakładanie projektu
  i planowanie kamieni to biurko. Zapytaj, zanim dołożysz.

## Czego NIE ruszać

- **`PO_REJESTRACJI.md`** — firma nie jest zarejestrowana.
- **Przeprowadzka na NAS** (Moduł 55) — czeka na rejestrację.
- **Reguła „model tylko proponuje"** — nowy punkt użycia lokalnego LLM wymaga
  wyraźnej prośby właściciela.

---

## Weryfikacja

- **Panel**: `npm run dev` + narzędzia przeglądarki. `.env.local` nie wymaga
  hasła (dev-bypass), baza to PGlite z danymi testowymi.
- **`npx tsc --noEmit` i `npm test`** po każdej paczce. `tsc` **nie widzi
  SQL-a ani CSS-a** i przepuszcza składnię, którą Turbopack odrzuca — po
  każdej paczce **załaduj dotknięty ekran** w podglądzie.
- **Trasy**: `curl` po każdym uchwycie osobno, z odczytem bazy.
- **Apka**: `xcodebuild`. Gesty i ekrany sprawdzisz w sesji 2 — tutaj wystarczy
  kompilacja i grep po `APIClient.swift`.

---

## Na koniec tej sesji

- Dopisz do `51-audyt-uiux-panel-i-apka.md` sekcję **„Stan po module Projekty
  — sesja 1 (fundament)"**: co naprawione, co znalezione i **świadomie
  zostawione dla sesji 2**.
- Uzupełnij `HUB_SETUP.md` — każdy nowy wzorzec z jednym zdaniem UZASADNIENIA.
- **Zaktualizuj `PROMPT-60B-PROJEKTY-WYGLAD.md`** o to, co wyszło: sesja 2
  ma zacząć od świeżego stanu, nie od tego briefu sprzed Twojej pracy.
- `rm -f .git/index.lock && git add -A && git commit && git push`.
