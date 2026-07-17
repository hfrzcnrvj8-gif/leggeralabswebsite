# Prompt do nowego czatu — Moduł 34b

> Skopiuj wszystko poniżej linii i wklej jako pierwszą wiadomość w **nowym
> czacie Claude Code** w tym repo. Nic więcej nie trzeba dopisywać.
>
> (Ten plik jest tylko „schowkiem" na prompt — sam brief żyje w
> `34b-pigulki-wszedzie.md`.)

---

Zrób moduł opisany w `docs/plany-modulow/34b-pigulki-wszedzie.md`. Najpierw
przeczytaj ten plik i `CLAUDE.md` (sekcje „Design system", „Architektura modułów
panelu" i „Znane pułapki tego środowiska"), potem zaproponuj plan i zapytaj o
dwie otwarte decyzje z briefu, dopiero potem działaj.

To runda **mechaniczna i wizualna**: dokończenie Modułu 34, nie nowy kierunek.
Zero nowych decyzji produktowych.

Kontekst, żebyś wiedział, po co to robimy: Moduł 34 dał panelowi rozsuwaną
pigułkę (`ExpandingIconButton.tsx` — ikona po najechaniu rozsuwa się w podpisaną
pigułkę, wzorem Centrum powiadomień macOS), ale podpiął ją **tylko pod pasek
Leadów**. Teraz najedziesz na ikonę w Leadach i dostajesz ładną pigułkę, a na tę
samą ikonę w Fakturach — stary systemowy prostokąt po sekundzie. Powiedziałem
wprost: **wygląd ma być spójny**.

Uwagi, które oszczędzą Ci czasu:

* **NIE zamieniaj wszystkich 154 natywnych `title=`.** To jest najważniejsze
  zdanie tego promptu. Te `title` to **cztery różne rzeczy** i brief rozpisuje
  je na konkretnych przykładach z numerami linii:
  1. ikona bez podpisu **w pasku narzędzi** → pigułka;
  2. przycisk, który **ma już widoczny podpis** (np. „Filtry" renderujące
     `<IconFilter /> Filtry`) → po prostu **usuń `title`**, to duplikat;
  3. **objaśnienie-zdanie** (np. 2 zdania o progach windykacji na całej karcie
     KPI) → **dymek `Tooltip`**, nie pigułka;
  4. **akcja w wierszu tabeli** („Podgląd / wydruk", „Usuń") → **dymek**, bo
     pigułka rozsuwa się w lewo i zasłoniłaby dane wiersza.
* **`Truncate` (`components.tsx:307`) — natywny `title` ZOSTAJE.** Tam dymek
  niesie pełną, uciętą treść komórki, a nie etykietę kontrolki. To jedno z
  niewielu miejsc, gdzie natywny dymek jest poprawny. Nie ruszaj.
* Zasada w jednym zdaniu: **pigułka podpisuje ikonę, dymek tłumaczy stan albo
  znaczenie.**
* Wzorzec do skopiowania jest gotowy w `leads/LeadsDashboard.tsx` — z `href` dla
  linków (eksport CSV), `disabled`, `ariaLabel`. Podpis trafia do `aria-label`,
  więc **usuwaj stary `title`**, inaczej wyskoczą dwa dymki naraz.
* Ikona z dodatkowym menu pod prawym przyciskiem (jak eksport w Leadach) jest
  owinięta w `<span className="relative block h-6 w-6 shrink-0" onContextMenu>` —
  powiel ten wzorzec, jeśli gdzieś dokładasz menu.
* **Nie „popraw" animacji szerokości na sztuczkę z gridem** (`grid-cols-[0fr]`
  → `[1fr]`). Sprawdzone na żywo 2026-07-17: tu NIE działa, bo pigułka jest
  `absolute` i nie ma „wolnej przestrzeni", którą `fr` wypełnia — track wychodzi
  0 px nawet przy ręcznie wymuszonym `1fr`. Dlatego jest `max-width`.
* Zanim zgłosisz coś jako lukę, sprawdź `CLAUDE.md` → „Świadome decyzje
  produktowe" i `HUB_SETUP.md`. Brak AI w logice, panel jednoosobowy, emoji w
  mailach (ale ikony w panelu), „zdrowie" projektu ręczne — to wybory, nie błędy.

**Pułapki podglądu — przeczytaj, zanim zdiagnozujesz „błąd":**

* Karta podglądu bywa `hidden` → **`requestAnimationFrame` = 0 klatek/s** →
  animacje `framer-motion` nie startują: treść stoi na `opacity: 0`, a
  przełączniki widoku (Tablica/Tabela) wyglądają na **kompletnie zepsute**. To
  **artefakt narzędzia, nie bug** — kosztował pół godziny fałszywej diagnozy.
  **Zawsze zaczynaj od `tabs_create`** — świeża karta jest `visible` i ma ~50
  kl./s. Test: policz klatki `rAF` przez sekundę; `0` + `visibilityState:
  "hidden"` = artefakt.
* **Ale sama pigułka nie zależy od `framer-motion`** — animuje ją czysty CSS
  (`max-width` + `opacity`). Jeśli się nie rozsuwa, to prawdziwy błąd.
* `read_page` potrafi zwracać „(empty page)" mimo poprawnego renderu — czytaj
  przez `javascript_tool` (`innerText`), a **klikaj przez `ref`**, nie po
  współrzędnych ze zrzutu (zrzut 800×450 vs okno 1600×900).
* Panel `/admin` jest **jednomotywowy — ciemny** (`.admin-linear`,
  `globals.css:303`, nigdy nie dostaje `.dark`). Nie proponuj „sprawdźmy w obu
  motywach".
* Jeśli inny czat trzyma serwer, **nie zabijaj go** — otwórz
  `preview_start url:"http://localhost:3000/pl/admin"`, to ten sam kod.

**Weryfikacja:** `npx tsc --noEmit -p tsconfig.json` po każdej paczce (pełny
`next build` failuje w sandboxie) **plus obowiązkowy przegląd wizualny na
świeżej karcie** — `tsc` nie zobaczy, czy pigułka się rozsuwa. Najedź na ikony
w Klientach, Fakturach, Kosztach, Ofertach, Umowach, Projektach i Notatniku:
pigułka ma wychodzić w lewo, **ikona nie może drgnąć**, sąsiednie ikony nie mogą
się przesunąć. Sprawdź też, że nigdzie nie wyskakuje stary natywny dymek obok
nowego (znaczyłoby, że został `title`).

**Nie jestem programistą i nie czytam kodu** — jeśli coś wymaga mojej decyzji,
zapytaj wprost, po polsku, bez żargonu. Na koniec zaktualizuj `HUB_SETUP.md`,
odhacz w `docs/plany-modulow/README.md` i podaj mi komendę do commita.
