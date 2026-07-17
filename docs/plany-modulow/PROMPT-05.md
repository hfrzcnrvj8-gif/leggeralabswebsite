# Prompt do nowego czatu — Moduł 5 (aplikacja mobilna PWA: iPhone + iPad)

> Skopiuj wszystko poniżej linii i wklej jako pierwszą wiadomość w **nowym
> czacie Claude Code** w tym repo. Nic więcej nie trzeba dopisywać.
>
> (Ten plik to tylko „schowek" na prompt — sam brief żyje w
> `05-mobilna-aplikacja.md`.)

---

Zrób moduł opisany w `docs/plany-modulow/05-mobilna-aplikacja.md`. Najpierw
przeczytaj ten plik i `CLAUDE.md` (sekcje „Design system", „Lokalne środowisko
dev", „Znane pułapki tego środowiska" i „Świadome decyzje produktowe"), potem
zaproponuj plan i zapytaj o **otwarte decyzje** (są w briefie, sekcja „Otwarte
decyzje" — trzy, wszystkie z moją rekomendacją), dopiero potem działaj.

To **moduł domykający** — ostatnia duża funkcja. Cały panel (moduły 1–36) jest
gotowy; teraz ma zadziałać wygodnie **na telefonie i tablecie**.

Uwagi, które oszczędzą Ci czasu:

* **Forma apki jest ROZSTRZYGNIĘTA: PWA, nie natywna z App Store.** Właściciel
  potwierdził 2026-07-17 po przedstawieniu obu dróg. „Pełnoprawna aplikacja na
  iPhonie i iPadzie" = wygodna PWA instalowana przez „Dodaj do ekranu głównego",
  **nie** apka ze sklepu. Nie proponuj Capacitora/React Native/App Store. Nie
  pytaj o to drugi raz.
* **iPhone I iPad to DWA różne ekrany, nie jeden „mobilny".** Weryfikuj oba:
  `resize_window preset:"mobile"` (375×812, iPhone) **i** `preset:"tablet"`
  (768×1024, iPad), a na iPadzie także **poziom** (landscape 1024×768). Widok,
  który jest zły na iPhonie (np. oś czasu projektów), na iPadzie w poziomie bywa
  używalny — nie wrzucaj obu do jednego worka.
* **Zakres jest PEŁNY** — właściciel chce wszystkich modułów responsywnych, nie
  tylko rdzenia. Otwarta decyzja to **kolejność dostarczania** (rdzeń najpierw w
  paczkach vs wszystko naraz), nie „czy". Rekomenduj rdzeń najpierw — to duży
  moduł, dowożenie w paczkach jest bezpieczniejsze.
* **PWA to DWIE osobne prace, nie myl ich** (brief, sekcja „Uczciwie"): (1)
  skorupa PWA — manifest + service worker + ikony, ~1 dzień; (2) responsywność
  widok po widoku — to 80% wysiłku. Nie obiecuj „mobilnie" po samym dodaniu
  manifestu.
* **NIE cache'uj odpowiedzi API z danymi klientów** w service workerze bez
  przemyślenia świeżości/RODO — panel jest za auth i online-first. Skorupę tak,
  dane klientów nie.
* **Powiadomienia push na iOS są ograniczone** — działają tylko dla PWA dodanej
  do ekranu głównego (iOS 16.4+), osobna zgoda. Rekomendacja w briefie: **na
  start bez web-push**, rolę pełni dzienny mail (już działa) + Pulpit „co dziś".
  Nie obiecuj „natywnych pushy jak z App Store".
* Zanim zgłosisz coś jako lukę, sprawdź `CLAUDE.md` → „Świadome decyzje
  produktowe" i `HUB_SETUP.md`. Panel jednoosobowy, jeden motyw w panelu (ciemny),
  brak AI w logice — to wybory, nie błędy.

**Praca wizualna — używaj podglądu lokalnego (to jedyny sensowny sposób):**

* Panel oglądasz na żywo bez deploya i bez hasła: `preview_start name:"dev"` +
  `resize_window` + screenshot. Dev-login i dev-baza (PGlite) działają lokalnie —
  szczegóły w `CLAUDE.md` → „Lokalne środowisko dev".
* **Pułapka podglądu:** karta bywa `hidden` → `requestAnimationFrame` = 0 kl./s →
  animacje framer-motion nie ruszają, widok wygląda na zepsuty. To **artefakt
  narzędzia, nie bug** (pamięć `podglad-rAF-zamrozony`). Zaczynaj od `tabs_create`
  (świeża karta bywa `visible`); gdy i tak zamarznie — pompuj klatki zrzutami
  ekranu.
* `read_page` potrafi zwracać „(empty page)" mimo poprawnego renderu — czytaj
  treść przez `javascript_tool` (`innerText`).
* Jeśli inny czat trzyma serwer, **nie zabijaj go** — otwórz
  `preview_start url:"http://localhost:3000/pl/admin"`, to ten sam kod.

**Weryfikacja:** `npx tsc --noEmit -p tsconfig.json` po każdej paczce (pełny
`next build` failuje w sandboxie — EPERM; skorupa PWA/service worker realnie
zweryfikuje się dopiero na Vercelu). Właściwy dowód responsywności to
**screenshoty KAŻDEGO widoku na iPhonie (375) I iPadzie (768 pion + poziom)** —
pokaż je właścicielowi. Test „zainstaluj na ekranie głównym" na realnym iPhonie
i iPadzie właściciela dopiero po deployu.

**Nie jestem programistą i nie czytam kodu** — jeśli coś wymaga mojej decyzji,
zapytaj wprost, po polsku, bez żargonu. To duży moduł, więc dopytuj o kolejność i
priorytety zamiast zgadywać. Na koniec (albo po każdej większej paczce)
zaktualizuj `HUB_SETUP.md`, odhacz w `docs/plany-modulow/README.md` i podaj mi
komendę do commita.
