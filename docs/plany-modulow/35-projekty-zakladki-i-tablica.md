# Moduł 35 — Projekty: zakładki zamiast ściany

> Przeczytaj `docs/plany-modulow/README.md` (zasady wspólne) i `CLAUDE.md`
> (sekcje „Architektura modułów panelu" i „Design system").
> Brief powstał z uwag właściciela 2026-07-17.

## Stan: część B ZROBIONA, część A (ten brief) czeka

Ten moduł miał dwie części. **Część B — „góra zagospodarowana, dół wolny" —
została zrobiona 2026-07-17** (panel wypełnia wysokość okna, wszystkie moduły;
szczegóły: `HUB_SETUP.md` → „Moduł 35, część B"). **Zostaje część A: zakładki
w profilu projektu.**

## Skąd to się wzięło (cytat właściciela)

> „PROJEKTY potrzebują coś na wzór zakładek jak KLIENT, bo tak to jest ściana,
> wszystkie informacje na raz, a powinien być podgląd projektu czyli
> najważniejsze informacje i dodatkowe zakładki gdzie by można było edytować
> właśnie sekcja ONBOARDING, sekcja CZAS PRACY itd."

## Zmierzone w kodzie i na żywo (2026-07-17) — liczby, nie wrażenia

| Co | Projekt | Klient (wzorzec) |
|---|---|---|
| plik | `ProjectDetailPanel.tsx` — **1779 linii** | `ClientDetailPanel.tsx` — **791** |
| realna wysokość karty w modalu | **1566 px** | **1017 px** |
| ogranicznik wysokości | **BRAK** → karta wystaje poza okno, przewija się cały modal | `max-h-[85vh]` (**1056 px**) → mieści się, przewija w środku |
| zakładki | brak | ✅ Wizytówka / Historia kontaktu / Logi zmian |

**To są DWA osobne braki, nie jeden.** Nawet gdyby ktoś nie robił zakładek,
profil projektu i tak nie ma `max-h`, który ma klient. Nie pomyl ich.

### Sekcje, które dziś leżą jedna pod drugą (`<h2>` w `ProjectDetailPanel.tsx`)

| Linia | Sekcja |
|---|---|
| 833 | Onboarding |
| 927 | Zamknięcie projektu i opinia |
| 1045 | Rentowność |
| 1074 | Czas pracy |
| 1247 | Kamienie milowe |
| 1359 | Log aktywności |

Plus pola tożsamości u góry (tytuł, status, zdrowie, klient, daty, priorytet,
opis) — to naturalny kandydat na „Podgląd".

### ❗ Projekty NIE MAJĄ audytu zmian — nie planuj zakładki „Logi zmian"

Sprawdzone: `field_changes` / `FieldChangesTab` / `/changes` **nie istnieją dla
projektów** (u klienta i leada owszem). Moduł 23 zostawił audyt faktur/ofert/
projektów jako „jedna linia w ich PATCH-cie" — to znaczy, że zakładka „Logi
zmian" w projekcie wymaga **najpierw zbudowania audytu**, czyli osobnego
zakresu. Nie wpisuj jej do planu jako „skopiuj od klienta".

## Wzorzec do skopiowania (Moduł 23) — nie wymyślaj własnego

`ClientDetailPanel.tsx`:
- `const [tab, setTab] = useState<"card" | "history" | "changes">("card");`
- `<ViewTabs value={tab} onChange={setTab} layoutId="client-detail-tab-underline" …>`
- **stan `tab` siedzi w `*DetailPanel.tsx`, NIE w wrapperze** — dzięki temu
  zakładki działają i w modalu z listy, i na podstronie `[id]`. Zrób tak samo.
- **`layoutId` musi być inny** niż `client-detail-tab-underline`, np.
  `project-detail-tab-underline` — inaczej podkreślenie „przeskoczy" między
  dwoma profilami otwartymi w tej samej sesji.

## Do rozstrzygnięcia z właścicielem — ZAPYTAJ, nie zgaduj

1. **Jaki podział zakładek?** Propozycja wyjściowa (do zakwestionowania):
   **Podgląd** (tożsamość + status + zdrowie + klient + termin) · **Kamienie
   milowe** · **Onboarding** · **Czas pracy i rentowność** (razem — obie mówią
   o koszcie) · **Zamknięcie i opinia** · **Log aktywności**.
   To sześć zakładek — dużo. Może część powinna zostać w Podglądzie?
2. **Gdzie kamienie milowe?** To rdzeń projektu i są na Osi czasu — może
   należą do Podglądu, a nie do osobnej zakładki?
3. **Czy „Podgląd" ma być edytowalny w miejscu** (jak dziś), czy tylko do
   odczytu, a edycja w zakładkach? U klienta Wizytówka jest edytowalna.
4. **Czy dokładamy `max-h-[85vh]`** (jak u klienta), żeby profil mieścił się na
   ekranie? Zakładki same z siebie skrócą kartę, ale bez limitu długa zakładka
   znów wystanie poza okno.

## Czego NIE „naprawiać"

- **Modal projektu ma kartę w WRAPPERZE** (`ProjectsDashboard.tsx:519` —
  `card="card-paper my-auto w-full max-w-4xl …"`), a nie w `*DetailPanel.tsx`
  jak Leady/Klienci. To **świadome, opisane w `CLAUDE.md`** („Faktury/Oferty/
  Projekty: własne, węższe limity — nie ujednolicaj bez potrzeby"). Jeśli
  dokładasz `max-h`, dołóż je tam, gdzie realnie jest karta.
- **`ViewSwitch` ma od Modułu 35B prop `fill`** — opt-in, bo ten sam komponent
  przełącza zakładki w profilach (modal o własnej wysokości). W profilu projektu
  **prawdopodobnie NIE chcesz `fill`** — tak jak nie ma go u klienta.

## ⚠️ Pułapki podglądu

- **Karta podglądu bywa `hidden` → `requestAnimationFrame` = 0 kl./s → animacje
  `framer-motion` nie startują**: treść stoi na `opacity: 0`, a przełączniki
  widoku wyglądają na kompletnie zepsute. To ARTEFAKT, nie bug (kosztowało pół
  godziny fałszywej diagnozy 2026-07-17). **Zawsze zaczynaj od `tabs_create`** —
  świeża karta jest `visible` i ma ~50 kl./s. Test i szczegóły: pamięć
  `podglad-rAF-zamrozony`, `HUB_SETUP.md` → „Moduł 34".
- Zrzut 800×450 vs okno 1600×900 — klikaj przez `ref` z `read_page`, nie po
  współrzędnych.
- Panel `/admin` jest **jednomotywowy (ciemny)** — `.admin-linear`
  (`globals.css:303`) nigdy nie dostaje `.dark`. Nie szukaj jasnego wariantu.
- **Flex-column rozciąga dzieci** (`align-items: stretch`) — jeśli owijasz coś
  w `flex flex-col`, sprawdź bezpośrednie `<button>`/`<a>` bez `w-full`
  (Moduł 35B: przycisk urósł do 1037 px i wyglądał, jakby przeskoczył na środek).

## Weryfikacja

`npx tsc --noEmit -p tsconfig.json` po każdej paczce + podgląd na **świeżej
karcie**. `tsc` nie sprawdzi, czy zakładki się przełączają — sprawdź to klikiem
i **w modalu z listy, ORAZ na podstronie `/pl/admin/projects/[id]`** (to dwie
różne ścieżki renderowania tego samego komponentu — właśnie dlatego stan `tab`
ma siedzieć w `*DetailPanel.tsx`).
