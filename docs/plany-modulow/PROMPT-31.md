# Prompt do nowego czatu — Moduł 31

> Skopiuj wszystko poniżej linii i wklej jako pierwszą wiadomość w **nowym
> czacie Claude Code** w tym repo. Nic więcej nie trzeba dopisywać.
>
> (Ten plik jest tylko „schowkiem" na prompt — sam brief żyje w
> `31-umowy-widoczne.md`.)

---

Zrób moduł opisany w `docs/plany-modulow/31-umowy-widoczne.md`. Najpierw
przeczytaj ten plik, `CLAUDE.md`, `docs/plany-modulow/00-mapa-drogi-klienta.md`
(Krok 3) i `docs/plany-modulow/11-umowy-i-nda.md` (moduł źródłowy), potem
zaproponuj plan i zapytaj o otwarte decyzje (brief ma sekcję „Do rozstrzygnięcia
z właścicielem" — pięć pytań, nie zgaduj za mnie), dopiero potem działaj.

Ten brief powstał z audytu Modułu 29 (2026-07-17) i jest OSTATNIM z trzech
(32 → 30 → 31). Moduły 32 i 30 są zamknięte.

Uwagi, które oszczędzą Ci czasu:

* Brief ma na górze sekcję **„PRZECZYTAJ NAJPIERW — weryfikacja briefu w
  kodzie"** z tabelką potwierdzeń i **Sprostowaniem A**. Wszystkie znaleziska
  briefu zweryfikowałem gretem 2026-07-17 i potwierdziły się co do linii — nie
  trać czasu na ponowne sprawdzanie tabelki. **Ale sprawdzaj wszystko inne
  sam:** lekcja z Modułów 29/30 jest taka, że dokumentacja tego projektu bywa
  nieaktualna — `HUB_SETUP.md` twierdził „brak KSeF", gdy KSeF działał od
  miesiąca, a brief 30 mylił się **nawet we własnych sprostowaniach**.
* **Najważniejsze: rekomendacja „naprawa jednej linii" z Części A jest
  pułapką** (Sprostowanie A). Dodanie `"project"` do `kinds` LinkPickera w
  `ContractEditor.tsx` **wyzeruje `client_id` umowy** przy wyborze projektu, bo
  `linkValueFor()` jest wyłączne w obrębie `kinds` — a `client_id` jest dokładnie
  tym, czego potrzebuje Część B (umowy na karcie klienta). Jedna linia
  naprawiłaby A i cicho rozwaliła B. Projekt to **osobna oś** („czego dotyczy")
  niż klient/lead („czyj to rekord") → osobne pole, nie dopisanie do kinds.
* **Lekcja z Modułu 30, zastosuj ją tutaj:** sprawdzaj nie tylko „czy kod
  istnieje", ale **czy cokolwiek go woła**. W Module 30 trasa „lead → oferta"
  była poprawna w API i całkowicie martwa z poziomu panelu — żaden `.tsx` jej
  nie wywoływał, więc *każda* oferta rodziła się bez klienta. Brief tego nie
  widział. Przy umowach to samo pytanie jest na miejscu: `contracts/[id]` przyjmuje
  `project_id`, ale **kto go wysyła?**
* Część B jest **węższa, niż brzmi**: `CLIENT_EVENT_KINDS` już zna
  `contract_created`/`contract_sent`/`contract_signed`, a routes umów **realnie
  je logują** (sprawdzone) — oś czasu klienta umowy widzi. Niewidoczne są w
  Pulpicie, dziennym mailu, wyszukiwarce, dzwonku i sekcji „Powiązane" na karcie
  klienta. Nie buduj czegoś, co już jest.
* Pytanie 1 (czy bramka ma obejmować ręczne projekty) to **decyzja produktowa,
  nie techniczna** — bramka umowy jest jedynym twardym wyjątkiem od zasady
  „miękkie podpowiedzi, nigdy twarde bramki" i była **świadomie zatwierdzona**
  (komentarz w `projects/[id]/route.ts:135-140` opisuje dlaczego). Nie znoś jej
  z własnej inicjatywy — zapytaj.
* Pytanie 4 (nowe rodzaje powiadomień) koliduje ze **świadomą decyzją Modułu
  24**: dzwonek to *kronika zdarzeń*, celowo NIE druga lista „do zrobienia"
  (Pulpit liczy stan na żywo). Zapytaj, zamiast zakładać.
* Zanim zgłosisz coś jako lukę, sprawdź `CLAUDE.md` → „Świadome decyzje
  produktowe" i `HUB_SETUP.md`. Brak AI w logice, panel jednoosobowy, miękkie
  podpowiedzi zamiast bramek — to wybory, nie błędy.
* Sprawy ikon NIE ruszaj przy okazji: panel ma dziś i `@tabler/icons-react`, i
  emoji. Kierunek jest **rozstrzygnięty** (w panelu ikony, w mailach emoji), ale
  wdrożenie ma własny **Moduł 33, PO Tobie** — patrz `CLAUDE.md` → „Emoji vs
  ikony". Dopasuj się do otoczenia edytowanego pliku i nie ujednolicaj hurtem.
* Migracje: każda `create*Schema()` musi mieć `schemaUpToDate()` +
  `markSchemaApplied()`, a każde zapytanie nie-DDL w migracji (np. INSERT
  backfillu) MUSI iść przez `inMigration()` z `lib/migration-ctx.ts` — inaczej
  w dev zakleszcza seeder i wszystkie `/api/*` wiszą kilkadziesiąt sekund.
* Nie mam dostępu do produkcyjnej bazy z poziomu Claude — jeśli cokolwiek
  wymaga poprawy istniejących danych, zaprojektuj to jako ekran/akcję w panelu
  do mojego ręcznego zatwierdzenia, nie jako jednorazowy skrypt SQL. Wzorzec:
  ekran „Powiąż wstecz" z Modułu 30 (`OrphanLinksPanel.tsx` + `api/links/orphans`).
* Podgląd lokalny: `preview_start name:"dev"` (PGlite + dev-login, bez hasła).
  Jeśli inny czat trzyma już serwer na tym katalogu, nie zabijaj go — otwórz
  `preview_start url:"http://localhost:3000/pl/admin"`, to ten sam kod.
  **Używaj refów z `read_page`, nie współrzędnych ze zrzutu** — okno ma 1280×720,
  zrzut 800×450, to dwie różne skale (kliknięcia po współrzędnych trafiają w
  próżnię).
* Czysta logika jest tańsza i pewniejsza do sprawdzenia **sondą w tsx** niż
  klikaniem — patrz jak zweryfikowano `clientLinkStatus()`/`matchClientForOrphan()`
  w Module 30 i `isOverdue()` w Module 32 (`HUB_SETUP.md` → Weryfikacja).

Weryfikacja: `npx tsc --noEmit -p tsconfig.json` po każdej paczce zmian (pełny
`next build` failuje w sandboxie). Ścieżka na żywo: „+ Dodaj projekt" (ręcznie,
NIE z oferty) → spróbuj przestawić na „W trakcie" → powinno dać się przypiąć
podpisaną umowę bez przechodzenia całej ścieżki oferta→akceptacja od nowa. Po
przypięciu projektu do umowy **sprawdź, czy umowa nadal jest na karcie klienta**
(to jest ta pułapka ze Sprostowania A). Na koniec zapisz wynik w `HUB_SETUP.md`
i odhacz w `README.md`.
