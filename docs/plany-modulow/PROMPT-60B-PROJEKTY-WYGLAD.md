# Prompt do wklejenia w nowym czacie — PROJEKTY, sesja 2/2: wygląd i dotyk

> Powstał 2026-07-31. Moduł Projekty rozbity na dwie sesje decyzją właściciela.
> **Sesja 1 (`PROMPT-60A-PROJEKTY-FUNDAMENT.md`) robi integralność, parytet
> i dane. Ta sesja robi wygląd, nawigację i dotyk.**
>
> ⚠️ **Zacznij od przeczytania wyniku sesji 1** — sekcja „Stan po module
> Projekty — sesja 1 (fundament)" w `51-audyt-uiux-panel-i-apka.md`. Sesja 1
> miała zaktualizować ten plik o to, co zastała; jeśli tego nie zrobiła,
> i tak przeczytaj jej wynik, zanim cokolwiek ruszysz.

Kontynuujemy audyt UI/UX i kompletności panelu (leggeralabs.pl/admin, repo
bieżące) oraz apki natywnej iPhone/iPad (`leggera-hub-ios`, osobne repo:
`/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`). **Pulpit, Leady, Klienci,
Oferty i Umowy są zrobione.** Projekty to etapy 8–10 lejka.

**ZANIM ZACZNIESZ — przeczytaj:**
- `CLAUDE.md` — zasady projektu, w tym design system.
- `docs/plany-modulow/59-spojnosc-ui.md` — **lista kontrolna z 10 kategorii,
  którą masz POWIELIĆ na Projektach.** To jest narzędzie tego audytu, nie
  zamknięte zadanie. Przeczytaj też paczki C, E, F i G — opisują wzorce,
  do których Projekty mają się dociągnąć.
- `HUB_SETUP.md` → „Moduł 59" (pięć wpisów: warstwy powierzchni, wiersz
  profilu, puste stany, klawiatura, gest w bok + dwa kafle) i wszystko
  o Projektach.
- `51-audyt-uiux-panel-i-apka.md` — sekcje „Stan po module…", z sesją 1
  Projektów włącznie.

---

## Zakres tej sesji

### A. Trzy pola ⚠️ z inwentarza Modułu 59

Inwentarz z 28.07 dał Projektom trzy ostrzeżenia, których **żadna paczka
A–G nie tknęła**. To jest rdzeń tej sesji:

| kategoria | co znaczy ⚠️ |
|---|---|
| **Kolor** | czy status, zdrowie i priorytet nie używają tej samej barwy do różnych rzeczy; czy pasek Osi czasu i pigułka mówią to samo |
| **Nawigacja** | zakładki profilu (Moduł 35 dał ich pięć), kolejność i nazwy 1:1 z apką; powrót zachowujący pozycję listy i filtr |
| **Treść** | etykieta po lewej — wartość po prawej, `—` zamiast znikającego pola, daty przez `formatPlDate`, kwoty z walutą |

Rozstrzygnij pomiarem, nie okiem. Kontrast: `getComputedStyle` + wzór WCAG.
Progi i wartości: `HUB_SETUP.md` → „trzy warstwy powierzchni".

### B. Cała lista kontrolna, wszystkie 10 kategorii

Przejdź `59-spojnosc-ui.md` punkt po punkcie **na trzech platformach naraz**
(panel, iPhone, iPad). Wypełnij wiersz „Projekty" w tabeli wyniku na dole
tamtego dokumentu.

Szczególnie warte uwagi w tym module:
- **Klikalność**: czy kamień milowy, zadanie i zasób prowadzą do rekordu;
  czy nazwa klienta i numer umowy w profilu projektu są klikalne.
- **Gesty**: swipe na kamieniach i zadaniach, menu przytrzymania = to samo
  co prawy przycisk w panelu.
- **Drag & drop** już jest (kamienie, zadania) — sprawdź, czy działa na
  wszystkich trzech platformach i czy kolejność się zapisuje.
- **Dotyk**: cel ≥ 44 pt, odstęp ≥ 8 pt. Oś czasu i siatka kamieni to
  najgęstsze miejsca w panelu.

### C. Widoki: Tablica, Oś czasu, profil

- **Oś czasu** (`ProjectTimeline.tsx`) istnieje **tylko w panelu** — apka jej
  nie woła. Zapytaj właściciela, czy iPad ma ją dostać (na iPhonie prawie
  na pewno nie — poziom 3).
- **Profil projektu na pięciu zakładkach** (Moduł 35). Sprawdź nazwy
  i kolejność wobec apki — paczka E ujednoliciła je w Leadach i Klientach
  („Historia" / „Logi" / „Dokumenty"), Projekty mogły zostać z tyłu.
- **Szerokość**: moduł z gęstą tabelą idzie na pełną szerokość.

### D. Ruch i haptyka

- Panel: `lib/motion.ts` (`SPRING`, `EASE_LIQUID`). Żadnych liczb z palca
  i **żadnego `transition` bez `ease`**.
- Apka: `Ruch.swift`. Haptyka przy GARDŁACH (zapis, wysyłka, start stopera),
  nie przy każdym dotknięciu.

---

## ⚠️ Czego NIE rób drugi raz

Moduł 59 dał Projektom **bez osobnego audytu**: klawiaturę listy (`/`, `j`/`k`,
`Enter`, `Esc` przez `useSkrotyListy` + `PoleSzukania`), trzy warianty pustego
stanu (`StanListy`/`StanBledu`), wiersze profilu przez `SekcjaProfilu`/
`WierszPola` (`MetaRow` **usunięty**, podpowiedź terminu przeniesiona na
`sufiks`), słownik koloru i kierunek gestu. **Zweryfikuj, że działa, i idź
dalej.**

Dwa wzorce z paczki G, w które masz trafić, a nie wymyślać własne:

1. **Gest w prawo** = ruch do przodu albo pomyślne domknięcie. **Gest w lewo**
   = wyłącznie to, co idzie „od siebie" (odrzuć, archiwum, usuń). W Projektach
   „Stoper" jest już po prawej i to jest poprawne.
2. **Dwa kafle na jednej krawędzi**: pierwszy plan wypełniony, drugi
   przygaszony (`Znaczenie.drugiPlan`) i z ikoną konturową. Pierwszy plan stoi
   PIERWSZY w kodzie, bo pełne przeciągnięcie odpala pierwszy przycisk.
   Wyjątek: czerwień akcji niszczącej nie przygasa.

---

## Świadome decyzje — NIE cofaj bez pytania

- **„Cykle" w Osi czasu to WYŁĄCZNIE rytm wizualny** (naprzemienne pasy co
  14 dni), bez przypisywania zadań i bez tabeli w bazie. Pełne cykle
  z przypisywaniem = nowy, większy zakres — dopytaj.
- **„Zdrowie" projektu jest ręczne i niezależne od statusu** — dwie osobne
  osie, jak w Linear. Nie wyliczaj go z terminów.
- **Kolor paska Osi czasu idzie WG STATUSU** (obrys + gradient), nie wg
  ikony wybranej przez właściciela.
- **Ikona projektu zostaje EMOJI** (`PROJECT_ICONS` w `lib/projects.ts`) —
  to treść wybierana przez właściciela, jeden z dwóch świadomych wyjątków
  od reguły „w panelu ikony Tablera" (Moduł 33). Nie migruj.
- **Gradient aktywnej pozycji w sidebarze ZOSTAJE** (`.admin-nav-active`) —
  jedyny świadomy wyjątek od „gradient nie niesie znaczenia".
- **Poziom apki**: podgląd, stoper i odhaczanie tak; zakładanie projektu
  i planowanie kamieni to biurko. Zapytaj, zanim dołożysz.

## Czego NIE ruszać

- **`PO_REJESTRACJI.md`** — firma nie jest zarejestrowana.
- **Przeprowadzka na NAS** (Moduł 55) — czeka na rejestrację.
- **Reguła „model tylko proponuje"** — nowy punkt użycia lokalnego LLM wymaga
  wyraźnej prośby właściciela.

---

## Weryfikacja — co się zmieniło 31.07

**Gesty i dotyk w apce sprawdzasz SAM, nie prosisz właściciela.** Paczka C
zapisała „apka bez zrzutu, bo Debug gada z produkcją i wchodzi przez ekran
logowania" — to już nieaktualne:

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

Narzędzia symulatora wykonują **prawdziwy swipe**, więc gest sprawdzasz sam.
Przydatne furtki: `LEGGERA_DEV_OPEN_PROJECT=<id>`, `LEGGERA_DEV_STOPER=<id>`
(README apki). Uwaga: pełne przeciągnięcie odpala akcję od razu — na krótkim
geście zobaczysz kafle, na długim zmienisz dane.

**Fizyczne urządzenie** zostaje do rzeczy, których symulator nie odda: Face ID,
**Wyspa/Live Activity stopera**, aparat, prawdziwa skrzynka. Wgranie kablem
i podgląd przez lustro QuickTime opisuje `README.md` apki — **lustro jest
jednokierunkowe**, gest musi tam wykonać właściciel.

**Panel — dwie pułapki podglądu, na które już straciliśmy czas:**
- karta jest `document.hidden`, więc `requestAnimationFrame` **nie tyka**
  (zmierzone: 0 klatek w 600 ms). `AnimatePresence mode="wait"` nigdy nie
  kończy wyjścia, a `getComputedStyle` na elemencie z `transition` zwraca
  wartość POCZĄTKOWĄ. Rozstrzyga klon elementu (`cloneNode`).
- `npx tsc --noEmit` **nie widzi CSS-a ani SQL-a** i przepuszcza składnię,
  którą Turbopack odrzuca. Po każdej paczce **załaduj dotknięty ekran**.

---

## Lekcje warte sprawdzenia akurat u Projektów

1. **Sąsiedztwo tworzy usterki, których nie widać w kodzie** (paczka G: dwa
   kafle gestu o tym samym kolorze). Jeśli dołożysz akcję do listy, obejrzyj
   ją obok sąsiadów, nie samą.
2. **Klasa w kodzie nie jest dowodem na regułę w arkuszu** — `bg-[var(--x)]/40`
   nie generuje NICZEGO. Token z kryciem musi istnieć w `tailwind.config.ts`
   z `<alpha-value>`.
3. **Lista, która kłamie pustką** (ustalenie A1) — także przy zerowej liczbie
   kamieni i zadań: pusty stan ma mówić, czego brakuje i CO TO ZMIENIA.
4. **„Doskakuje etapami" = próg `if let` w widoku**, a `NavigationLink(value:)`
   bez `destination` nie robi NIC.
5. **`*PanelIpad` we wspólnej mapie ekranów** daje pusty ekran z żółtym
   trójkątem na iPhonie, bez crasha.
6. **Skalowanie czcionki nie może zmniejszać pisma tylko w części elementów** —
   to była przyczyna „źle sformatowanej pastylki" przy pięciu zakładkach.

---

## Na koniec modułu

- Dopisz „Stan po module Projekty — sesja 2 (wygląd)" do
  `51-audyt-uiux-panel-i-apka.md`.
- **Wypełnij wiersz „Projekty"** w tabeli wyniku w `59-spojnosc-ui.md`.
- Uzupełnij `HUB_SETUP.md` — każdy nowy wzorzec z jednym zdaniem UZASADNIENIA.
- Dopisz moduł do `lib/instrukcje.ts` — dopiero gdy jest sprawdzony.
- Przygotuj prompt do następnego modułu w kolejce: **Faktury** (etapy 11–12).
- `rm -f .git/index.lock && git add -A && git commit && git push`.
