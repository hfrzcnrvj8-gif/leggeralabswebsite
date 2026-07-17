# Prompt do nowego czatu — Moduł 35 (część A)

> Skopiuj wszystko poniżej linii i wklej jako pierwszą wiadomość w **nowym
> czacie Claude Code** w tym repo. Nic więcej nie trzeba dopisywać.
>
> (Ten plik jest tylko „schowkiem" na prompt — sam brief żyje w
> `35-projekty-zakladki-i-tablica.md`.)

---

Zrób moduł opisany w `docs/plany-modulow/35-projekty-zakladki-i-tablica.md`.
Najpierw przeczytaj ten plik i `CLAUDE.md` (sekcje „Architektura modułów
panelu", „Design system" i „Znane pułapki tego środowiska"), potem zaproponuj
plan i zapytaj o otwarte decyzje (brief ma sekcję „Do rozstrzygnięcia z
właścicielem" — **cztery pytania, żadne nie jest rozstrzygnięte**), dopiero
potem działaj.

To **część A**. Część B tego samego briefu („góra zagospodarowana, dół wolny")
jest już zrobiona 2026-07-17 — nie szukaj jej, nie powtarzaj. Wyniki:
`HUB_SETUP.md` → „Moduł 35, część B".

Uwagi, które oszczędzą Ci czasu:

* **Wzorzec istnieje — nie wymyślaj własnego.** Klient ma zakładki od Modułu 23
  (`ClientDetailPanel.tsx`: `useState<"card"|"history"|"changes">` + `ViewTabs`
  z `layoutId`). Kluczowe: **stan `tab` siedzi w `*DetailPanel.tsx`, nie w
  wrapperze** — dzięki temu działa i w modalu z listy, i na podstronie `[id]`.
  Zrób tak samo i **daj inny `layoutId`** (np. `project-detail-tab-underline`),
  inaczej podkreślenie przeskakuje między profilami.
* **Liczby są zmierzone, nie zgadnięte** (2026-07-17, na żywo w podglądzie) —
  nie trać czasu na powtarzanie: `ProjectDetailPanel.tsx` ma **1779 linii**
  wobec **791** u klienta, a jego karta w modalu renderuje się na **1566 px**
  wobec **1017 px** u klienta. Brief ma tabelkę sekcji z numerami linii.
* **To są DWA braki, nie jeden.** Poza zakładkami profil projektu **nie ma
  `max-h`**, które klient ma (`max-h-[85vh]` = 1056 px). Dlatego karta projektu
  wystaje poza okno i przewija się cały modal. Zakładki same skrócą kartę, ale
  bez limitu długa zakładka znów wystanie — to pytanie 4 w briefie.
* **Projekty NIE MAJĄ audytu zmian.** Sprawdziłem: `field_changes` /
  `FieldChangesTab` / `/changes` nie istnieją dla projektów (u klienta i leada
  owszem — Moduł 23 zostawił audyt faktur/ofert/projektów jako „jedna linia w
  ich PATCH-cie"). **Nie planuj zakładki „Logi zmian" jako „skopiuj od
  klienta"** — to najpierw osobny zakres. Jeśli uważasz, że warto ją dorobić,
  zapytaj.
* **Nie „naprawiaj" modala projektu.** Karta siedzi w WRAPPERZE
  (`ProjectsDashboard.tsx:519`, `max-w-4xl`), a nie w `*DetailPanel.tsx` jak
  Leady/Klienci. To świadome i opisane w `CLAUDE.md` („Faktury/Oferty/Projekty:
  własne, węższe limity — nie ujednolicaj bez potrzeby"). Jeśli dokładasz
  `max-h`, dołóż je tam, gdzie realnie jest karta.
* `ViewSwitch` ma od Modułu 35B prop **`fill`** (opt-in). W profilu projektu
  **prawdopodobnie go NIE chcesz** — tak jak nie ma go u klienta; `fill` jest
  dla widoków wypełniających okno (Kanban, tabela, Poczta), nie dla treści w
  modalu o własnej wysokości.
* Zanim zgłosisz coś jako lukę, sprawdź `CLAUDE.md` → „Świadome decyzje
  produktowe" i `HUB_SETUP.md`. Brak AI w logice, panel jednoosobowy, „cykle"
  w Osi czasu bez przypisywania, „zdrowie" projektu ręczne i niezależne od
  statusu — to wybory, nie błędy.
* Każde nowe pole daty MUSI iść przez `isPlausibleDateString()` (walidacja
  klient + serwer) i wyświetlać się przez `formatPlDate()` — `<input type=
  "date">` potrafi zapisać „0202" zamiast „2026".

**Pułapki podglądu — przeczytaj, zanim zdiagnozujesz „błąd":**

* Karta podglądu bywa `hidden` → **`requestAnimationFrame` = 0 klatek/s** →
  animacje `framer-motion` nie startują: treść stoi na `opacity: 0`, a
  przełączniki widoku wyglądają na **kompletnie zepsute** (klik zmienia
  `localStorage`, widok nie). To **artefakt narzędzia, nie bug** — 2026-07-17
  kosztowało to pół godziny fałszywej diagnozy „Kanban Projektów nigdy się nie
  renderuje". **Zawsze zaczynaj od `tabs_create`** — świeża karta jest
  `visible` i ma ~50 kl./s. Test rozstrzygający: policz klatki `rAF` przez
  sekundę; `0` + `visibilityState: "hidden"` = artefakt.
* `read_page` potrafi zwracać „(empty page)" mimo poprawnie renderującego się
  panelu — czytaj treść przez `javascript_tool` (`innerText`), a **klikaj przez
  `ref` z `read_page`**, nie po współrzędnych ze zrzutu (zrzut 800×450 vs okno
  1600×900).
* Panel `/admin` jest **jednomotywowy — ciemny** (`.admin-linear`,
  `globals.css:303`, nigdy nie dostaje `.dark`). Nie szukaj jasnego wariantu i
  nie proponuj „sprawdźmy w obu motywach".
* Jeśli inny czat trzyma serwer, **nie zabijaj go** — otwórz
  `preview_start url:"http://localhost:3000/pl/admin"`, to ten sam kod.
* Dev-seed (`ensureSeeded()` w `lib/dev-db.ts`) ma trzy projekty z kamieniami
  milowymi. Jeśli czegoś nie da się zobaczyć lokalnie (np. projekt po
  zamknięciu, z opinią) — **dołóż to do seeda**, zamiast zgadywać, jak wygląda.

**Weryfikacja:** `npx tsc --noEmit -p tsconfig.json` po każdej paczce zmian
(pełny `next build` failuje w sandboxie) **plus obowiązkowy przegląd wizualny** —
`tsc` nie sprawdzi, czy zakładki się przełączają. Sprawdź klikiem **w modalu z
listy ORAZ na podstronie `/pl/admin/projects/[id]`**: to dwie różne ścieżki
renderowania tego samego komponentu i właśnie dlatego stan `tab` ma siedzieć
w `*DetailPanel.tsx`.

**Nie jestem programistą i nie czytam kodu** — jeśli coś wymaga mojej decyzji,
zapytaj wprost, po polsku, bez żargonu. Na koniec zaktualizuj `HUB_SETUP.md`,
odhacz w `docs/plany-modulow/README.md` i podaj mi komendę do commita.
