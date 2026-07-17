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

## Część B — layout tablicy (wolna przestrzeń)

**UWAGA — zanim uznasz, że wiesz, o co chodzi.** Właściciel mówi „tablica", ale
w Projektach są dwa widoki (`Tablica` = Kanban, `Oś czasu` = Gantt) i **oba
kończą się kartą wysokości treści, z martwym polem do dołu ekranu**. Poproś o
zrzut albo dopytaj, który widok ma na myśli — „przesuwany pasek" to równie
dobrze poziomy scrollbar Kanbanu, co pasek Gantta.

Kierunek (do potwierdzenia): kolumny Kanbanu powinny sięgać dołu okna, żeby
scrollbar poziomy siedział przy krawędzi, a nie w połowie ekranu. Dziś kolumna
ma `min-h-[8px]` i wysokość treści (`ProjectKanban.tsx:148` — `w-[300px]`).

Porównaj z Leadami/Klientami — mają ten sam problem, więc jeśli ruszasz, ruszaj
wzorzec, nie jeden ekran (`.card-paper`/kolumny są wspólne konceptualnie, choć
nie kodowo).

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
