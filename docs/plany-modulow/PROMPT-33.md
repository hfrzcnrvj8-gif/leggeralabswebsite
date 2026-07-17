# Prompt do nowego czatu — Moduł 33

> Skopiuj wszystko poniżej linii i wklej jako pierwszą wiadomość w **nowym
> czacie Claude Code** w tym repo. Nic więcej nie trzeba dopisywać.
>
> (Ten plik jest tylko „schowkiem" na prompt — sam brief żyje w
> `33-ikony-zamiast-emoji.md`.)

---

Zrób moduł opisany w `docs/plany-modulow/33-ikony-zamiast-emoji.md`. Najpierw
przeczytaj ten plik i `CLAUDE.md` (sekcje „Emoji vs ikony", „Design system"
i „Architektura modułów panelu"), potem zaproponuj plan i zapytaj o otwarte
decyzje (brief ma sekcję „Do rozstrzygnięcia z właścicielem" — **cztery
pytania, żadne nie jest rozstrzygnięte**), dopiero potem działaj.

To runda **wizualna**, nie funkcjonalna — dokończenie migracji rozpoczętej
2026-07-11, nie nowy kierunek. Warunek „po Modułach 30 i 31" jest spełniony:
oba zamknięte 2026-07-17.

Uwagi, które oszczędzą Ci czasu:

* **Kierunek jest rozstrzygnięty i nie podlega dyskusji** (decyzja właściciela
  2026-07-17): **w panelu ikony `@tabler/icons-react`, w mailach emoji zostają**.
  Wyjątek mailowy to NIE zaległość do naprawienia — w HTML-u maila nie
  wyrenderujesz komponentu React, a ikony-obrazki bywają blokowane przez klienty
  pocztowe. **Nie ruszaj**: podpisu mailowego (`lib/mailSignature.ts`), maila
  dziennego (`app/api/leads/notify`), szablonów wychodzących (`lib/mail.ts`,
  `lib/mailSync.ts`).
* Brief ma na górze sekcję **„PRZECZYTAJ NAJPIERW — weryfikacja briefu w
  kodzie"** (2026-07-17) z tabelką, **Sprostowaniem A i B**. Przeliczyłem
  wszystko gretem — nie trać czasu na powtarzanie tabelki. **Ale sprawdzaj
  wszystko inne sam:** lekcja z Modułów 29/30/31 jest taka, że dokumentacja tego
  projektu bywa nieaktualna — `CLAUDE.md` przez sześć dni i osiemnaście modułów
  rozkazywał „nie zamieniaj emoji na ikony", choć decyzja była odwrócona; brief
  30 mylił się nawet we własnych sprostowaniach; brief 31 rekomendował naprawę,
  która cicho psuła inną część modułu.
* **Liczby w oryginalnym briefie były zawyżone — tabelka jest już poprawiona.**
  Realnie: **113 linii** w `app/[lang]/admin` (nie ~128) i **24** wywołania
  `icon="<emoji>"` (nie 33).
* **Najważniejsze — Sprostowanie A: inwentaryzacja briefu pomijała `lib/`.**
  Emoji chrome'u panelu mieszkają też tam (~50 linii): `CLIENT_EVENT_ICON`
  (oś czasu klienta), `KIND_EMOJI`/`notificationEmoji` (**dzwonek**),
  `CONTACT_CHANNEL_ICON`/`CALL_OUTCOME_ICON` (**9 plików panelu**),
  `LINK_KIND_EMOJI`, ikony metod płatności, `emoji:` w szablonach projektów.
  Sprawdziłem: **wszystkie są panel-only**, żadna nie zasila maili, więc nie
  kolidują z wyjątkiem mailowym. Pominięcie ich zostawiłoby panel w połowie
  drogi (menu na ikonach, dzwonek obok na emoji) — dokładnie ten stan, przed
  którym ostrzega `CLAUDE.md`.
* **Sprostowanie B — „bez zmian typów" dotyczy TYLKO `Menu.tsx`.** Tam faktycznie
  jest `icon?: ReactNode`. Ale mapy z `lib/` to `Record<…, string>`, a **`lib/`
  jest w 100 % `.ts` — nie ma tam ani jednego `.tsx`**, więc literału JSX nie
  napiszesz. Do tego `lib/notifications.ts` ma na górze ostrzeżenie, że
  importuje go **kliencki dzwonek** i że zły import wywala build na „chunking
  context does not support external modules", **czego `tsc` NIE łapie**. To
  jedyna decyzja architektoniczna tego modułu (pytanie 4) — architektura z
  `CLAUDE.md` sugeruje przeniesienie map do `shared.tsx` („komponenty
  specyficzne dla UI", wzorzec `StatusTag`), ale **zapytaj, nie wybieraj po
  cichu**.
* **Uwaga na `tsc`:** on nie złapie ani błędu bundlingu opisanego wyżej, ani
  tego, że ikona się nie renderuje. **Ten moduł trzeba obejrzeć oczami** —
  inaczej niż 30/31, gdzie czysta logika broniła się sondą.
* Zanim zgłosisz coś jako lukę, sprawdź `CLAUDE.md` → „Świadome decyzje
  produktowe" i `HUB_SETUP.md`. Brak AI w logice, panel jednoosobowy, miękkie
  podpowiedzi zamiast bramek, „cykle" w Osi czasu bez przypisywania, wykres
  Kosztów świadomie mały — to wybory, nie błędy.
* Design system: `.card-paper` na treść, `.glass` tylko na chrome, `.btn-primary`
  = jedno CTA na widok (i **obwódka, nie gradient** — decyzja z 2026-07-16),
  paleta `brand.purple/pink/gold/cyan` zamiast generycznych kolorów Tailwinda.
  Ikony mają **dziedziczyć `currentColor`** — w tym cały sens tej zmiany.
* Podgląd lokalny: `preview_start name:"dev"` (PGlite + dev-login, bez hasła).
  Jeśli inny czat trzyma już serwer na tym katalogu, nie zabijaj go — otwórz
  `preview_start url:"http://localhost:3000/pl/admin"`, to ten sam kod.
* **Pułapki podglądu (z Modułu 31, oszczędzą Ci frustracji):** `read_page`
  potrafi zwracać „(empty page)" mimo poprawnie renderującego się panelu —
  wtedy czytaj treść przez `javascript_tool` (`innerText` sekcji). Klikanie po
  współrzędnych ze zrzutu trafia w próżnię: zrzut ma **800×450**, okno
  **1600×900** — przelicz ×2 albo klikaj przez `javascript_tool`. Skrót Cmd+K
  nie zawsze dochodzi do strony; paletę otwiera kliknięcie „Szukaj" w sidebarze.
* Dev-seed (`ensureSeeded()` w `lib/dev-db.ts`) ma dane pod większość ekranów,
  w tym od Modułu 31 wiszącą umowę. Jeśli czegoś nie da się zobaczyć lokalnie —
  **dołóż to do seeda**, zamiast zgadywać, jak wygląda.
* Nie mam dostępu do produkcyjnej bazy z poziomu Claude i **nie czytam kodu** —
  jeśli coś wymaga mojej decyzji, zapytaj wprost, po polsku, bez żargonu.

Weryfikacja: `npx tsc --noEmit -p tsconfig.json` po każdej paczce zmian (pełny
`next build` failuje w sandboxie) **plus obowiązkowy przegląd wizualny** —
`tsc` nie widzi ikon. Obejrzyj **w obu motywach** (`resize_window
colorScheme:"dark"` i `"light"`), bo cały sens zmiany to dziedziczenie koloru:

1. **menu kontekstowe** (prawy przycisk) w Leadach / Fakturach / Kosztach —
   główne skupisko `icon="<emoji>"`;
2. **sidebar folderów w Poczcie** (📥/📤/🗑️/🗄️) — 14 linii, najgęstsze miejsce;
3. **dzwonek powiadomień** — 11 rodzajów, w tym trzy dołożone przez Moduł 31;
4. **oś czasu klienta** (`CLIENT_EVENT_ICON`) i **kanały kontaktu** — sprawdź,
   czy ikona siedzi w linii bazowej tekstu, a nie skacze.

Na koniec: zaktualizuj `CLAUDE.md` → „Emoji vs ikony" (po wdrożeniu reguła
przestaje brzmieć „dopasuj się do otoczenia pliku", a zaczyna „w panelu ikony,
w mailach emoji"), zapisz wynik w `HUB_SETUP.md` i odhacz w `README.md`.
