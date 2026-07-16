# Moduł 21 — Audyt wizualny: panel na poziomie Apple/Linear (przejścia, animacje, szkło, gradient)

> Przeczytaj najpierw `docs/plany-modulow/README.md` i `CLAUDE.md` (sekcja
> „Design system"). Zakres CELOWO otwarty — to audyt, nie gotowa lista
> zmian. Wymaga ciągłego oglądania efektu w przeglądarce (`preview_start
> name:"dev"`), nie tylko czytania kodu — właściciel wielokrotnie zgłaszał,
> że coś, co w kodzie wygląda poprawnie, w przeglądarce „kłuje w oczy"
> (patrz `04c-podpis-mailowy.md`, `04e-poczta-apple-mail-ux.md` — oba
> wymagały bezpośredniego porównania ze zrzutem/realnym wzorcem, nie
> intuicji). **Rób to samo tutaj: zrzut ekranu → porównanie → poprawka →
> zrzut ponownie, nie zgadywanie z samego kodu.**

## Skąd to się wzięło

Właściciel, po serii funkcjonalnych rund w Poczcie (2026-07-16), zgłosił
ogólne niezadowolenie z warstwy wizualnej całego panelu: „wygląda jakby
poskładane z klocków, a nie spójne, premium jak Apple czy Linear". Punktowy
przykład (zrzut ekranu): menu rozwijane zmiany statusu renderowało się jako
płaski, nieprzezroczysty czarny prostokąt zamiast „liquid glass", a
natywny scrollbar przeglądarki wyglądał jak „doklejone okno".

**To zostało już naprawione** (2026-07-16, patrz `HUB_SETUP.md` → „Menu
rozwijane w całym panelu — liquid glass zamiast płaskiego czarnego") —
`PropertyMenu`/`Popover` (`app/[lang]/admin/Menu.tsx`, współdzielone przez
CAŁY panel: Leady/Klienci/Faktury/Oferty/Koszty/Kalendarz/Umowy/Projekty/
Poczta) dostały klasę `.glass` zamiast płaskiego tła, `.admin-linear`
dostał własne zmienne `--glass-*` (bez nich `.glass` dziedziczyłby jasne
wartości z `:root` — panel `/admin` nie ma klasy `.dark`, ma własną,
neutralną paletę Linear), a globalnie dodano stonowany, półprzezroczysty
scrollbar (`color-mix()` na `--fg-muted`) zamiast natywnego. Przy okazji
znaleziono i naprawiono TRZECIĄ, zduplikowaną, ręcznie pisaną
implementację tego samego wzorca menu w `MailDashboard.tsx` (nieużywającą
`Menu.tsx` w ogóle) — dokładnie ten przykład „różnych kawałków kodu dla
jednego wzorca UI", o którym mówił właściciel.

**To NIE jest cała odpowiedź.** Naprawiono jedną, dużą, dźwigniową rzecz
(jeden współdzielony komponent + jedna reguła CSS). Właściciel pozostaje
„cały czas bardzo zawiedziony" ogólnym poziomem wizualnym — jest bardzo
prawdopodobne, że jest więcej pojedynczych miejsc, animacji, przejść i
niespójności, które nie zostały jeszcze zidentyfikowane, bo nie były
źródłem TEGO konkretnego zrzutu ekranu. Ten moduł ma je znaleźć i naprawić
systematycznie, nie punktowo.

## Trzy osie zgłoszone wprost przez właściciela — trzymaj się ich

1. **Przejścia i animacje** — otwieranie/zamykanie okien, wyskakujące
   okienka (modale, popovery, menu), przechodzenie między opcjami
   (zakładki, filtry, foldery). Mają być płynne, „premium", nie
   błyskawiczne pojawianie/znikanie bez animacji.
2. **Spójność wizualna „liquid glass"** — jeden język wizualny wszędzie
   tam, gdzie sensowne (chrome: nagłówki, menu, modale, paski akcji), nie
   mieszanka płaskich, nieprzezroczystych elementów i szklanych obok
   siebie.
3. **Gradient purpurowo-złoty (marka)** — `brand.purple #7C3AED` →
   `brand.gold #E0A93B` (kanon: `.text-liquid` w `app/globals.css`,
   `linear-gradient(120deg, #a78bfa 0%, #e0a93b 60%, #fff7e8 100%)`) jako
   spójny akcent marki, nie punktowo w jednym miejscu a płasko gdzie
   indziej.

## Metoda pracy (rekomendowana, nie jedyna słuszna)

Właściciel nie czyta kodu i ocenia wyłącznie „na oko" — dlatego ten moduł
MUSI iść przez cykl: zrzut ekranu bieżącego stanu → analiza względem trzech
osi wyżej → poprawka → zrzut ponownie → (jeśli możliwe) pokazanie
właścicielowi przed przejściem dalej. Sugerowany porządek:

1. **Zrób systematyczny przegląd — jeden zrzut na każdy główny ekran**
   panelu (lista niżej), zamiast naprawiać na wyczucie bez pełnego obrazu.
   Skataloguj konkretne znaleziska względem trzech osi (nie ogólnikowo
   „wygląda słabo" — konkretnie: „ten modal otwiera się bez animacji",
   „ten pasek akcji ma płaskie tło zamiast glass", „ten hover nie ma
   żadnego stanu").
2. **Grupuj poprawki po WZORCU, nie po ekranie** — tak jak przy menu
   rozwijanych: jeśli 15 modułów używa tego samego wzorca overlayu
   (`bg-black/50 backdrop-blur-[2px]`, potwierdzone dziś w
   `MailDashboard.tsx`, `ClientsDashboard.tsx`, `OffersDashboard.tsx`,
   `CostsDashboard.tsx`, `InvoicesDashboard.tsx`, `LeadsDashboard.tsx`,
   `ProjectsDashboard.tsx`, `ContractsDashboard.tsx` i inne), sprawdź czy
   WSZYSTKIE mają płynną animację KARTY modala (nie tylko przyciemnienia
   tła) — jeśli nie, to JEDNA poprawka wzorca (podobna do tego, co zrobiono
   dziś w `MailComposeForm.tsx`: `motion.div` z `initial`/`animate`/`exit`,
   ten sam spring co w `ui.tsx` — `{ type: "spring", stiffness: 420, damping:
   32 }`) naprawia wiele ekranów naraz, zamiast 15 osobnych poprawek.
3. **Nie zgaduj wartości blur/opacity/spring — sprawdzaj wzrokowo.**
   `.glass` (`globals.css`) ma już udokumentowaną, dopracowaną wcześniej
   definicję (`blur(16px) saturate(200%)`, komentarz w kodzie tłumaczy,
   czemu te konkretne wartości, nie inne) — reużywaj ją, nie wymyślaj
   nowej za każdym razem, chyba że wizualnie coś nie pasuje w konkretnym
   kontekście.

## Konkretne, znane punkty startowe (nie wyczerpująca lista — audyt ma znaleźć resztę)

- **Karty modali vs tło modali** — overlay (`bg-black/50 backdrop-blur-
  [2px]`) jest ujednolicony w całym panelu, ale sama KARTA modala zwykle
  używa `.card-paper` (płaska, nieprzezroczysta — zgodnie z CLAUDE.md:
  „`.glass` — zarezerwowane dla chrome... NIE nadużywać na zwykłych
  kartach"). Zdecyduj (i zapytaj właściciela, jeśli niejednoznaczne): czy
  modal to „chrome" (więc `.glass` pasuje) czy „zwykła karta z treścią"
  (więc `.card-paper` zostaje) — `MailComposeForm.tsx` po dzisiejszej
  rundzie używa `.card-paper`, NIE `.glass`, co może być niespójne z
  duchem trzeciej osi wyżej.
- **Animacje wejścia/wyjścia modali panelu-wide** — sprawdź czy KAŻDY
  modal (nie tylko Poczta) ma `motion.div`+`AnimatePresence` z
  `initial`/`animate`/`exit`, czy część wciąż pojawia/znika się
  natychmiastowo (`{cond && (...)}` bez animacji — dokładnie ten wzorzec
  naprawiono dziś w `MailDashboard.tsx`/`MailComposeForm.tsx`, ale inne
  moduły nie były sprawdzane w tej sesji).
- **`MenuRow`/`MenuDivider`/`MenuLabel`/opcje w `PropertyMenu`** — po
  dzisiejszej zmianie tła na `.glass`, te elementy WEWNĄTRZ menu nadal mają
  hardkodowane hexy (`text-[#e9e9ea]`, `hover:bg-[#232327]`,
  `border-[#2a2b2f]`, `text-[#62666d]`) zamiast tokenów motywu
  (`var(--fg)`/`var(--hairline)` itp.) — sprawdź wzrokowo, czy to
  faktycznie przeszkadza na nowym szklanym tle, czy jest OK.
- **Trzecia, zduplikowana implementacja menu w `MailDashboard.tsx`**
  (naprawiona wizualnie dziś, ale WCIĄŻ nie przechodzi przez współdzielony
  `Menu.tsx`) — rozważ scalenie na dobre (usunięcie duplikacji kodu, nie
  tylko wizualne dopasowanie) — większa zmiana zachowania
  (pozycjonowanie/nawigacja klawiaturą), świadomie odłożona w dzisiejszej
  rundzie, dobry kandydat na tę rundę.
- **Przejścia między zakładkami/filtrami** (np. „Do odpowiedzi" ↔ „VIP" w
  Poczcie, zakładki w innych modułach, przełączanie widoku
  Kanban/Tabela/Oś czasu) — dziś prawdopodobnie natychmiastowe przełączenie
  listy bez żadnej animacji (nie sprawdzone w tej sesji) — porównaj z tym,
  jak Linear/Apple Mail animują zmianę zawartości listy.
- **Hover/focus states** — spójność stanu najechania/aktywnego fokusu na
  przyciskach, wierszach list, kartach — czy każdy interaktywny element ma
  wyraźny, spójny feedback, czy część jest „martwa" wizualnie do kliknięcia.
- **`AppShell.tsx`** ma już `AnimatePresence mode="wait"` dla przejść
  między stronami (potwierdzone w kodzie) — sprawdź wzrokowo, czy w
  praktyce faktycznie czuje się płynnie, czy tylko technicznie istnieje.

## Czego NIE robić bez pytania

- Nie zmieniaj palety kolorów/`tailwind.config.ts` bez zgody — `brand.*`
  są już ustalone i zatwierdzone.
- Nie zamieniaj emoji na bibliotekę ikon (`@tabler/icons-react` jest w
  zależnościach i używana w kilku miejscach — Koszty/Faktury/Oferty/
  Projekty/Umowy — ale Poczta i reszta panelu są świadomie emoji-only,
  CLAUDE.md: „świadoma decyzja, zostaw jak jest, chyba że właściciel
  wprost poprosi o zmianę"). Jeśli audyt znajdzie realną niespójność
  emoji/ikony między modułami, ZGŁOŚ jako pytanie, nie zmieniaj sam.
- Nie przepisuj układu/struktury ekranów (to inny zakres — wizualne
  dopracowanie ISTNIEJĄCEGO układu, nie redesign informacji) — jeśli w
  trakcie audytu okaże się, że układ też wymaga zmian, zapytaj, czy to
  wchodzi w zakres tej rundy, czy osobna.

## Weryfikacja

1. `npx tsc --noEmit -p tsconfig.json` po każdej paczce zmian.
2. Każda poprawka wzorca (nie punktowa) zweryfikowana na WIĘCEJ NIŻ jednym
   ekranie, który go używa — żeby potwierdzić, że fix faktycznie jest
   dźwigniowy, a nie przypadkowo naprawia jeden ekran i psuje inny.
3. Zrzuty przed/po dla każdej znaczącej zmiany — właściciel ocenia
   wizualnie, nie z opisu.
4. Zaktualizuj `HUB_SETUP.md` (nowa sekcja, wzorem dzisiejszej „Menu
   rozwijane w całym panelu") i odhacz w `docs/plany-modulow/README.md`.
