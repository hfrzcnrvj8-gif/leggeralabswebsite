# Brief: Audyt 6 — Poprawność kodu i dług techniczny

> Brief wdrożeniowy pod **jeden osobny czat**. To nie jest nowy plan — to
> **wykonanie Audytu 6** z `docs/AUDYTY-KONCOWE.md`. Tamten dokument jest
> zakresem, ten mówi, jak go przejechać i co już wiadomo (zmierzone gretem
> 2026-07-23, nie przepisane z pamięci).
>
> Powstał 2026-07-23, po domknięciu Audytu 2 (dane osobowe i RODO).

## Dlaczego ten audyt jest teraz

Kolejność w `AUDYTY-KONCOWE.md` jest **wg ryzyka**: **4 → 1 → 3 → 2 → 6 →
5 → 7**. Cztery domknięte (obserwowalność, bezpieczeństwo, niezawodność, RODO).
Audyt 6 jest następny, bo cztery poprzednie zabezpieczyły **dostęp, wykrywanie,
powrót i zgodność** — a teraz pytanie brzmi: **czy sam kod jest poprawny i da
się go utrzymać przez lata bez regresji.**

**Pytanie audytu, słowami z `AUDYTY-KONCOWE.md`:** czy to, co jest, działa i da
się utrzymać — nie „czego brakuje".

## Stan zastany — zmierzony gretem 2026-07-23 (zweryfikuj ponownie, nie ufaj tym liczbom na słowo)

| Co | Stan na 2026-07-23 |
|---|---|
| Pliki źródłowe (`.ts`/`.tsx` w `app`+`lib`+`components`+`i18n`) | **390** |
| Trasy API (`route.ts`) / uchwyty HTTP | **155 plików / 217 uchwytów** (75 GET, 84 POST, 33 DELETE, 25 PATCH) |
| **Testy automatyczne** | **ZERO** — `package.json` nie ma nawet skryptu `test` |
| Zależności produkcyjne / deweloperskie | **18 / 13** |
| Największy plik | `lib/db.ts` — **2597 linii**; dalej `mailSync.ts` 1072, `dev-db.ts` 939, `mailbox.ts` 801, `mail.ts` 728, `invoices.ts` 650, `ksef.ts` 631 |
| Apka natywna (Swift) | **W OSOBNYM REPO** — tu **0 plików `.swift`**. Parytet panel↔apka to porównanie **cross-repo** — patrz „Co rozstrzygnąć" pkt 2 |

**To największa pojedyncza słabość projektu:** cała weryfikacja jest ręczna
(`curl`, zrzuty ekranu, oglądanie). Działa **zaskakująco dobrze** — wyłapała
wszystkie poważne błędy (wyścig kasujący przypomnienia, martwe `.sheet`,
niedziałające odtwarzanie kopii, cichy `odtworz.sh`). Ale ma jedną wadę nie do
obejścia: **nie chroni przed regresją.** Nikt nie zauważy, że poprawka z lipca
zepsuła coś z marca, dopóki się na to nie natknie.

## Zakres — co ma powstać

To **audyt**, nie moduł: większość wyniku to **ustalenia, lista i decyzje**,
minimum kodu. Konkretnie (za `AUDYTY-KONCOWE.md` → „Audyt 6"):

1. **Rozstrzygnąć, czy wprowadzamy testy — i jeśli tak, to WYŁĄCZNIE dla reguł
   biznesowych**, które dublują się między panelem a apką i już raz się
   rozjechały. Kandydaci z zakresu: `parseQuickAdd`, terminy snooze i wysyłki,
   normalizacja numerów telefonu, reguła „wymaga działania dziś", ocena stanu
   kopii. **Nie testy interfejsu** — tam ręczne oglądanie zrzutów jest
   skuteczniejsze. Uwaga: to **pierwsza** zależność testowa w projekcie i zmiana
   filozofii („cała weryfikacja ręczna") — decyzja właściciela PRZED pisaniem
   (pkt „Co rozstrzygnąć" 1).
2. **Parytet panel ↔ apka.** Każda reguła istniejąca w dwóch miejscach jest
   kandydatem na rozjazd — zrób ich listę. **Pamięć projektu zna już rozjazdy**
   (`format-czasu-rozjazd`, `slownik-koloru-audyt`, Live Activity setne sekund)
   — nie odkrywaj ich drugi raz, sprawdź, czy są domknięte. **Apka to osobne
   repo** — patrz pkt „Co rozstrzygnąć" 2.
3. **Martwy kod.** Cztery udokumentowane przypadki „pole jest, nikt go nie woła"
   (Moduł 30, 31, WhatsApp w apce, `list_unsubscribe_url`) sugerują, że jest ich
   więcej. **Grep po UŻYCIU, nie po definicji** — to metoda, która je wykrywała.
4. **`lib/db.ts` (2597 linii).** Rozważ podział — **ale tylko jeśli utrudnia
   pracę, nie dla samej liczby.** To świadomie jeden plik (idempotentne
   migracje z bramką). Podział bez powodu to dług, nie spłata.
5. **Zależności (18 produkcyjnych).** Sprawdź nieaktualne i ze znanymi
   podatnościami (`npm outdated`, `npm audit`). Uwaga: `next` i `react` to
   wersje `^16`/`^19` — aktualizacja majora to osobny, większy ruch, nie „drobna
   łatka".
6. **Znane, świadomie odłożone niespójności** (NIE traktować jako nowe błędy):
   znaki typograficzne (`✕`, `★`, `●`) obok ikon Tablera; emoji ⏰ w Poczcie
   mimo reguły z Modułu 33. Wypisać jako „znane i odłożone", nie „do naprawy".
7. **`docs/AUDYT-6-WYNIKI.md`** — główny produkt, wzorem `AUDYT-1/2/3/4-WYNIKI.md`:
   ustalenia wg ryzyka, „sprawdzone i jest dobrze", „jak zweryfikowano",
   co otwarte, czego audyt NIE obejmował.
8. **Minimalny kod — tylko to, co właściciel zatwierdzi.** Jeśli testy: dołóż
   framework najprościej (wyłącznie reguły z pkt 1, nie „na zapas"). Jeśli
   martwy kod: usuń **dopiero po potwierdzeniu gretem, że NIKT nie woła**
   (pamiętaj o pułapce sandboxa — `rm` bywa `Operation not permitted`, wtedy
   nadpisz `export {};` + komentarz i poproś właściciela o ręczne usunięcie).

## Co ROZSTRZYGNĄĆ z właścicielem (nie decyduj sam)

Właściciel nie programuje — pytaj wprost, po polsku, bez żargonu.

1. **Czy w ogóle wprowadzamy testy automatyczne.** To zmiana filozofii projektu
   (dotąd świadomie zero testów, cała weryfikacja ręczna) i pierwsza zależność
   testowa. Zaleta: chronią przed cichą regresją reguł, które już raz się
   rozjechały. Koszt: nowe narzędzie do utrzymania. Jeśli tak — **tylko czyste
   reguły biznesowe** (funkcje w `lib/` bez UI i bez bazy), nie interfejs.
2. **Zakres parytetu apka↔panel.** Apka natywna to osobne repo, poza tym.
   Czy audyt ma sięgnąć do jej kodu (wymaga wskazania/otwarcia tego repo), czy
   ograniczyć się do wypisania reguł panelu, które MAJĄ bliźniaka w apce, jako
   listy „do pilnowania"? Pierwsze jest dokładniejsze, drugie mieści się w tym
   czacie.
3. **Czy dzielić `lib/db.ts`.** 2597 linii w jednym pliku. Dzielić dla higieny,
   czy zostawić, skoro działa i ma świadomy powód (jedno miejsce migracji
   z bramką)? Domyślna rekomendacja: **nie ruszać bez konkretnego bólu.**

## Weryfikacja — `tsc` tu nic nie udowodni

„Zielony build nie jest dowodem" (zasada z czterech poprzednich audytów).
Wszystkie najpoważniejsze błędy tego projektu **kompilowały się bez zarzutu**.

1. **Martwy kod potwierdzony gretem po UŻYCIU** — nie „funkcja istnieje", tylko
   „nikt jej nie woła" (grep po nazwie w całym repo, wynik = tylko definicja).
2. **Rozjazdy panel↔apka sprawdzone ARYTMETYKĄ, nie nazwą** — komentarz „1:1
   z panelem" nie jest dowodem (`format-czasu-rozjazd`); porównaj `round` vs
   `floor`, strefy, kolejność operacji.
3. **Jeśli testy — muszą realnie ZŁAPAĆ rozjazd**, nie tylko przejść na zielono.
   Napisz test, który **czerwieni się** na znanym rozjeździe, zanim uznasz go za
   wartościowy.
4. `npx tsc --noEmit -p tsconfig.json` po każdej paczce kodu. Pełny `next build`
   failuje w sandboxie z EPERM. Jeśli dojdzie framework testowy — uruchom go
   naprawdę, nie zakładaj, że działa.

## Zasady prowadzenia (nie powtarzaj cudzej roboty)

- **Przeczytaj najpierw ustalenia poprzednich audytów** (`AUDYT-1/2/3/4-WYNIKI.md`)
  i pamięć projektu (rozjazdy panel↔apka są tam opisane). **Nie diagnozuj
  drugi raz** tego, co już rozstrzygnięto.
- **Weryfikuj gretem po użyciu / uruchomieniem, nie pamięcią.** Dokumentacja
  w tym projekcie już nie raz kłamała (`CLAUDE.md` twierdził, że migracja
  emoji→ikony skończona; nie była).
- **Nie dobudowuj funkcji i nie przepisuj działającego kodu, bo dałoby się
  ładniej.** Pytanie brzmi „czy działa i da się utrzymać", nie „czy ładne".
- **Nie odkrywaj na nowo świadomych decyzji.** Zanim uznasz coś za błąd, sprawdź
  `CLAUDE.md` → „Świadome decyzje produktowe" i sekcje „świadomie odłożone".
  Spory kawałek tego, co wygląda na dług, jest wyborem (jeden plik `db.ts`, brak
  testów UI, znaki typograficzne).
- **Produkcyjna baza i NAS poza zasięgiem Claude** — jak w poprzednich audytach.
- **Jeden audyt = jeden czat.** Nie wchodź w Audyt 5/7.

## Środowisko

`npm run dev`, logowanie pominięte (`DEV_ADMIN_BYPASS` w `.env.local`), dane
z PGlite (`lib/dev-db.ts`). Jeśli inny czat trzyma serwer, nie zabijaj go —
otwórz `preview_start url:"http://localhost:3000/pl/admin"`. Panel `/admin` jest
jednomotywowy — ciemny.

## Po zakończeniu

Zaktualizuj `docs/AUDYTY-KONCOWE.md` (odhacz Audyt 6, wskaż następny — **Audyt 5
wydajność i koszty**), odhacz w `docs/plany-modulow/README.md`, zapisz istotne
decyzje w pamięci i podaj właścicielowi komendę do commita. Jeśli coś wyjdzie na
„po rejestracji" (mało prawdopodobne w tym audycie) — do `PO_REJESTRACJI.md`.
