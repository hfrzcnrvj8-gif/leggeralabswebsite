# Moduł 35 — Projekty: zakładki zamiast ściany + layout tablicy

> Przeczytaj `docs/plany-modulow/README.md` (zasady wspólne) i `CLAUDE.md`.
> Brief powstał z uwag właściciela 2026-07-17, po Module 34.

## Skąd to się wzięło (cytat właściciela)

> „PROJEKTY potrzebują coś na wzór zakładek jak KLIENT, bo tak to jest ściana,
> wszystkie informacje na raz, a powinien być podgląd projektu czyli
> najważniejsze informacje i dodatkowe zakładki gdzie by można było edytować
> właśnie sekcja ONBOARDING, sekcja CZAS PRACY itd. Swoją drogą sam layout tej
> tablicy jest do poprawy w PROJEKTach, bo nie wygląda dobrze, że jest tak dużo
> wolnej przestrzeni pod tym przesuwanym paskiem."

## Zweryfikowane w kodzie (2026-07-17) — liczby, nie wrażenia

| Teza | Stan |
|---|---|
| profil projektu to „ściana" | ✅ **`ProjectDetailPanel.tsx` ma 1779 linii** wobec **791** w `ClientDetailPanel.tsx` — ponad dwa razy tyle |
| wzorzec zakładek już istnieje | ✅ Klient ma `ViewTabs` (Wizytówka / Historia kontaktu / Logi zmian), Moduł 23 |
| zakładki działają i w modalu, i na podstronie | ✅ bo stan `tab` siedzi w `*DetailPanel.tsx`, nie w wrapperze — **powtórz ten wzorzec, nie wymyślaj** |

## Część A — zakładki w profilu projektu

Wzorzec do skopiowania: `ClientDetailPanel.tsx` (Moduł 23). `ViewTabs` +
`ViewSwitch` z `app/[lang]/admin/ViewTabs.tsx`, `layoutId` osobny niż u klienta
(inaczej podkreślenie „przeskoczy" między dwoma otwartymi profilami).

**Do rozstrzygnięcia z właścicielem — jaki podział zakładek.** Propozycja
wyjściowa (do zakwestionowania, nie do wdrożenia w ciemno):
- **Podgląd** — tożsamość (ikona/kolor/tytuł), status, zdrowie, klient, termin,
  kamienie milowe, opis. To, co widać w 3 sekundy.
- **Onboarding** — Moduł 14.
- **Czas pracy** — Moduł 19.
- **Logi zmian** — jak u klienta (`FieldChangesTab`), o ile projekty mają audyt
  (**sprawdź**: Moduł 23 zostawił audyt faktur/ofert/projektów jako „jedna linia
  w ich PATCH-cie" — może go nie być).

Pytania, które trzeba zadać PRZED kodowaniem:
1. Czy „Podgląd" ma być tylko do odczytu, czy edytowalny w miejscu (jak dziś)?
2. Gdzie trafiają: powiązane faktury/oferty/umowy, notatki, koszty projektu —
   osobna zakładka „Powiązania" czy zostają w Podglądzie?
3. Czy kamienie milowe to Podgląd, czy własna zakładka (mają swój edytor)?

## Część B — martwa przestrzeń na dole (POTWIERDZONA, szersza niż Projekty)

**Właściciel potwierdził zrzutami (2026-07-17):** *„góra jest zagospodarowana,
a dół jest wolny, bezużyteczny"* — i dotyczy to **OBU widoków Projektów**
(Tablica i Oś czasu) **oraz podglądu wiadomości w Poczcie** (*„tam też jest za
mały podgląd i jest niewykorzystana przestrzeń"*). To nie jest problem jednego
ekranu — to jeden łańcuch wysokości.

### Diagnoza (zrobiona 2026-07-17, nie zaczynaj od zera)

Panel **nigdzie nie przekazuje wysokości ekranu w dół**. Łańcuch:
- `AppShell.tsx:322` — root ma `flex min-h-screen flex-col md:flex-row`, więc
  na `md+` kolumna treści (`AppShell.tsx:450`, `min-w-0 flex-1`) **jest**
  rozciągnięta (`align-items: stretch`). Do tego miejsca jest dobrze.
- `AppShell.tsx:459` — `<div className="mx-auto px-4 py-5 …">` ma **wysokość
  treści**. Tu łańcuch się urywa.
- Dalej: root dashboardu (`ProjectsDashboard.tsx:265`, `-mx-4 sm:-mx-6`) i
  kontener kolumn (`ProjectKanban.tsx:126`, `flex gap-4 overflow-x-auto pb-4`)
  też mają wysokość treści → kolumny kończą się na najwyższej karcie, a poziomy
  scrollbar ląduje w połowie ekranu (dokładnie to widać na zrzucie).

**Kierunek naprawy:** przeciągnąć `flex flex-col` + `flex-1 min-h-0` od
kontenera treści w `AppShell` aż do kontenera widoku. `min-h-0` jest kluczowe —
bez niego element flex nie skurczy się poniżej treści i scroll wyjdzie na
`<body>` zamiast zostać w kolumnie.

**Uwaga na `AnimatePresence mode="wait"`** w `AppShell` (przejścia stron) —
opakowuje treść, więc dodanie tam `flex` trzeba sprawdzić wzrokowo, a nie
zakładać.

**Zakres do potwierdzenia z właścicielem:** ruszamy tylko Projekty + Pocztę
(zgłoszone), czy od razu wszystkie moduły (Leady/Klienci/Faktury… mają ten sam
łańcuch)? Zrobienie tego wyrywkowo zostawi panel w połowie drogi — ale zrobienie
wszystkiego naraz to duża paczka do obejrzenia. **To jest główna decyzja tego
modułu.**

### Poczta — osobny kształt, ta sama przyczyna

`AppShell.tsx:459` daje Poczcie `max-w-none` (świadomie, Moduł 4e), ale
wysokości i tak nie przekazuje. Podgląd wiadomości ma własną kartę o wysokości
treści — stąd „za mały podgląd" przy pustym dole. Jeśli ruszasz Pocztę, cel:
lista i podgląd wypełniają wysokość okna, a scroll żyje **wewnątrz** nich.

## ⚠️ Pułapka podglądu — przeczytaj, zanim zdiagnozujesz „błąd"

Karta podglądu bywa `hidden` → **`requestAnimationFrame` = 0 klatek/s** →
animacje `framer-motion` nie startują. Objawy: treść stoi na `opacity: 0`, a
**przełącznik Tablica/Oś czasu wygląda na kompletnie zepsuty** (klik zmienia
`localStorage`, widok nie). To ARTEFAKT NARZĘDZIA, nie bug — 2026-07-17
kosztowało to pół godziny fałszywej diagnozy.

Test rozstrzygający i obejście: patrz pamięć `podglad-rAF-zamrozony` oraz
`HUB_SETUP.md` → „Moduł 34". W skrócie: **`tabs_create` daje świeżą, widoczną
kartę** (`visibilityState: "visible"`, ~50 kl./s) — na niej wszystko działa.
Widok przełączaj przez `localStorage.setItem('leggera_projects_view', 'kanban')`
+ reload, nie klikiem.

## Weryfikacja

`npx tsc --noEmit -p tsconfig.json` + podgląd na ŚWIEŻEJ karcie. Panel `/admin`
jest jednomotywowy (ciemny) — nie szukaj jasnego wariantu.
