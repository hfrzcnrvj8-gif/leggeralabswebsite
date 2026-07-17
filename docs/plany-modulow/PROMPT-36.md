# Prompt do nowego czatu — Moduł 36 (animacje i lekkość)

> Skopiuj wszystko poniżej linii i wklej jako pierwszą wiadomość w **nowym
> czacie Claude Code** w tym repo. Nic więcej nie trzeba dopisywać.
>
> (Ten plik jest tylko „schowkiem" na prompt — sam brief żyje w
> `36-animacje-i-lekkosc.md`.)

---

Zrób moduł opisany w `docs/plany-modulow/36-animacje-i-lekkosc.md`. Najpierw
przeczytaj ten plik i `CLAUDE.md` (sekcje „Design system", „Świadome decyzje
produktowe" i „Znane pułapki tego środowiska"), potem zaproponuj plan i zapytaj
o **jedyną otwartą decyzję** (patrz niżej), dopiero potem działaj.

To **druga rata** rundy „lekkości" z 2026-07-16 — nie nowy problem. Runda 1
naprawiła to, co propaguje się globalnie przez wspólne klasy (`.btn-primary`,
jedna krzywa, drobiazgi w Poczcie) i świadomie zostawiła przegląd reszty
modułów na później. Właściciel wrócił z tą samą uwagą — to kontynuacja.

Uwagi, które oszczędzą Ci czasu:

* **Jedno pytanie do właściciela, nie więcej.** Brief ma tylko JEDNĄ decyzję
  architektoniczną: czy stałe animacji (krzywa + sprężystość) wyciągnąć do
  jednego miejsca — `lib/motion.ts` albo klasy w `globals.css` — żeby „ta sama
  krzywa" była importem, a nie regułą do zapamiętania. Reszta zakresu jest
  przesądzona. **Zaproponuj rekomendację**, nie survey.
* **„Liquid glass" NIE dosłownie — już rozstrzygnięte, nie pytaj drugi raz.**
  Właściciel potwierdził przy starcie: chodzi o **wrażenie lekkości i płynności**,
  nie szkło na kartach. `.glass` zostaje **tylko na chrome** (nagłówek, overlay,
  Popover, dymki); karty zostają `.card-paper`. Nie rozszerzaj glass na karty.
* **`prefers-reduced-motion` jest już obsłużone** (`globals.css:359`) — czysto,
  **nie ruszaj**.
* **Liczby są zmierzone, nie zgadnięte** (2026-07-17): jedna krzywa
  `cubic-bezier(0.16, 1, 0.3, 1)` ma **tylko 3 wystąpienia**, a obok **7×
  `easeOut`**, **11× `linear`**, 2× `ease-out`; `stiffness: 420` w **12**
  miejscach (standard), ale są odstępstwa **500 / 400 / 120**. To sedno modułu:
  `easeOut` to domyślna wartość framer-motion, którą dostajesz, gdy nic nie
  napiszesz — kolejne moduły ją „dziedziczyły" przez przeoczenie.
* **Nie każdy `linear` to błąd.** Część z 11 to obroty spinnerów (`animate-spin`,
  `IconLoader2`) — tam `linear` jest POPRAWNY. Sprawdź każde wystąpienie, zanim
  zamienisz; wyjątki zostawiaj z komentarzem uzasadniającym.
* **Poza zakresem — nie mieszaj bez pytania** (brief, sekcja „Odnotowane
  osobno"): znaki typograficzne `✕`/`✓`/`★` (osobna, węższa runda), nagłówek
  `<h1>` Poczty i trzecia implementacja menu w `MailDashboard.tsx`, struktura
  pasków narzędzi. To świadome długi z Modułów 21/25/33, nie braki do naprawy tu.
* Zanim zgłosisz coś jako lukę, sprawdź `CLAUDE.md` → „Świadome decyzje
  produktowe" i `HUB_SETUP.md`. Panel jednoosobowy, brak AI w logice, „cykle" w
  Osi czasu wizualne, „zdrowie" projektu ręczne — to wybory, nie błędy.

**Pułapki podglądu — KRYTYCZNE właśnie dla tego modułu (jest o animacjach):**

* Karta podglądu bywa `hidden` → **`requestAnimationFrame` = 0 klatek/s** →
  `framer-motion` w ogóle nie rusza: treść stoi na `opacity: 0`, przełączniki
  widoku i zakładki wyglądają na **kompletnie zepsute** (klik zmienia stan, ale
  widok się nie podmienia — bo `AnimatePresence mode="wait"` czeka na animację
  wyjścia, która nigdy nie kończy się przy 0 kl./s). To **artefakt narzędzia,
  nie bug**. Test rozstrzygający: policz klatki `rAF` przez sekundę; `0` +
  `visibilityState: "hidden"` = artefakt (patrz pamięć `podglad-rAF-zamrozony`).
* **Obejście sprawdzone w Module 35A (2026-07-17):** akcja `computer` z
  `action:"screenshot"` **wymusza serię klatek rAF** — więc po kliknięciu robisz
  zrzut, animacja/swap dochodzi do końca, i dopiero wtedy odczytujesz stan.
  Czasem trzeba 2 zrzutów pod rząd (jeden dopycha wyjście starego widoku, drugi
  wejście nowego). Zaczynaj od `tabs_create` (świeża karta bywa `visible`), ale
  gdy i tak zamarznie — pompuj klatki zrzutami.
* `read_page` potrafi zwracać „(empty page)" mimo poprawnie renderującego się
  panelu — czytaj treść przez `javascript_tool` (`innerText`).
* Panel `/admin` jest **jednomotywowy — ciemny** (`.admin-linear`,
  `globals.css:303`, nigdy nie dostaje `.dark`). Nie szukaj jasnego wariantu i
  nie proponuj „sprawdźmy w obu motywach".
* Jeśli inny czat trzyma serwer, **nie zabijaj go** — otwórz
  `preview_start url:"http://localhost:3000/pl/admin"`, to ten sam kod.

**Weryfikacja:** `tsc` NIC tu nie sprawdzi — to runda w **100 % wizualna**.
Musisz obejrzeć animacje na świeżej karcie i porównać „ciężar" przejść między
modułami (Leady/Klienci/Faktury/Koszty/Oferty/Umowy/Projekty/Kalendarz/
Notatnik/Statystyki). `npx tsc --noEmit -p tsconfig.json` uruchom mimo to po
każdej paczce, żeby nie wprowadzić regresji typów (pełny `next build` failuje w
sandboxie).

**Nie jestem programistą i nie czytam kodu** — jeśli coś wymaga mojej decyzji,
zapytaj wprost, po polsku, bez żargonu. Na koniec zaktualizuj `HUB_SETUP.md`,
odhacz w `docs/plany-modulow/README.md` i podaj mi komendę do commita.
