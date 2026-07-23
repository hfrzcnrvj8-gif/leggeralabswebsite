# Brief: Audyt 2 — Dane osobowe i RODO

> Brief wdrożeniowy pod **jeden osobny czat**. To nie jest nowy plan — to
> **wykonanie Audytu 2** z `docs/AUDYTY-KONCOWE.md`. Tamten dokument jest
> zakresem, ten mówi, jak go przejechać i co już wiadomo.
>
> Powstał 2026-07-23, po domknięciu Audytu 3 (niezawodność, kopie, powrót po
> awarii).

## Dlaczego ten audyt jest teraz

Kolejność w `AUDYTY-KONCOWE.md` jest **wg ryzyka, nie wg numeracji**:
**4 → 1 → 3 → 2 → 6 → 5 → 7**. Trzy domknięte (obserwowalność, bezpieczeństwo,
niezawodność). Audyt 2 jest następny, bo trzy poprzednie zabezpieczyły
**dostęp, wykrywanie i powrót** — a teraz pytanie brzmi: **czy w ogóle wolno
nam trzymać to, co trzymamy, i czy umiemy to usunąć na żądanie.**

To jest **ostatni audyt techniczny przed rejestracją firmy**, który ma wprost
prawną wagę: od dnia rejestracji w bazie siedzą prawdziwe dane prawdziwych
klientów, a RODO przestaje być teorią i staje się obowiązkiem z sankcją.

**Pytanie audytu, słowami z `AUDYTY-KONCOWE.md`:** jakie dane trzymamy, jak
długo, gdzie się kopiują i czy umiemy je usunąć na żądanie.

## Stan zastany — co już wiadomo (zweryfikuj gretem, nie zakładaj)

| Co | Stan na 2026-07-23 |
|---|---|
| Liczba tabel w bazie | **~49** (zmierz ponownie — schemat rósł; policz `CREATE TABLE` w `lib/db.ts`) |
| Retencja poczty | 24 miesiące (istnieje) |
| Retencja kopii bazy | 7 dni (dzienne) + 4 tygodnie (tygodniowe) — `scripts/kopia-zapasowa/` |
| Retencja logu błędów | `error_log` — sprawdź, czy jest w ogóle (Audyt 4 go dodał) |
| Retencja powiadomień | Kronika `notifications` — 30 dni (Moduł 24) |
| Retencja leadów / klientów / logów kontaktu | **Brak reguły** — leżą bezterminowo (do potwierdzenia) |
| Czyszczenie danych osobowych z logów | `oczyscTekst()` w `lib/observability.ts` — usuwa e-mail/NIP/telefon/konto PRZED zapisem do `error_log` (Audyt 4). **To dotyczy tylko error_log — sprawdź, czy inne logi też** |
| Prawo do usunięcia (jednej osoby) | **Brak procedury** — dziś nie da się jednym ruchem usunąć wszystkich danych osoby |
| Off-site kopii | Drugi dysk ręcznie (Audyt 3) — **nowe miejsce z danymi osobowymi**, trzeba je ująć w mapie |
| Lokalne AI (Ollama) | Chodzi na Macu właściciela — dane **nie opuszczają jego sprzętu**. To MOCNA strona do udokumentowania, nie luka |
| Dokument prawny | `docs/DO-PRAWNIKA-I-TLUMACZA.md` **istnieje** (Moduł 29) — ustalenia RODO dopisujesz TAM, nie zakładasz nowej listy |

**Materiał przekazany przez poprzednie audyty (nie szukaj drugi raz):**

- **Audyt 1, ustalenia 5–6:** publiczne trasy `*/public/[token]` wydawały dane
  osobowe (adres IP podpisującego umowę). **Naprawione w Module 40** (białe
  listy pól w `lib/publicFields.ts`), ale Audyt 2 ma to **ująć w mapie** jako
  miejsce, gdzie dane osobowe wychodzą na zewnątrz.
- **Audyt 1:** nowa tabela `rate_limit_hits` świadomie trzyma **odciski
  SHA-256 zamiast adresów IP** — bo adres IP jest daną osobową. To wzorzec do
  pochwalenia i do zapisania w mapie.
- **Audyt 4:** `error_log` jest **zbiorem danych osobowych** — dlatego
  `oczyscTekst()` czyści go przed zapisem. Log ma `przebieg_id`/`waga`/`klucz`,
  ale ma NIE mieć e-maili/NIP-ów.
- **Audyt 3:** kopie mają retencję (7 dni + 4 tygodnie) **celowo ograniczoną
  właśnie z powodu RODO** — dane osobowe nie mogą leżeć bezterminowo. Off-site
  (drugi dysk) to nowe miejsce z tymi danymi.

## Zakres — co ma powstać

To **audyt**, nie moduł: większość wyniku to **mapa, decyzje i procedury**,
minimum kodu. Konkretnie:

1. **Mapa danych osobowych.** Które z ~49 tabel zawierają dane osób (imię,
   e-mail, telefon, NIP, adres, treść korespondencji)? Dla każdej: jakie dane,
   po co, jak długo. **Dokąd te dane wyciekają dalej:** kopie na NAS-ie +
   off-site, logi Vercela, `error_log`, maile (az.pl), KSeF, lokalny model AI
   (Ollama). To jest rdzeń audytu — bez tej mapy reszta wisi w powietrzu.
2. **Retencja — każdy zbiór z odpowiedzią „jak długo i dlaczego".** Poczta
   (24 mies.), kopie (7 dni + 4 tyg.), powiadomienia (30 dni) **już mają**.
   Brakuje: leady, klienci, logi kontaktu, kronika zmian (`field_changes`),
   `error_log`, `rate_limit_hits`. Gdzie reguły nie ma — to decyzja właściciela
   (patrz „Co rozstrzygnąć”).
3. **Prawo do usunięcia — procedura, nie kod na zapas.** Czy da się usunąć
   wszystkie dane jednej osoby (klient/lead) — łącznie z kopiami i archiwum
   poczty? **Sprawdź w kodzie, co się dzieje przy usunięciu klienta/leada dziś**
   (kaskady? osierocone wiersze w fakturach/mailach/notatkach?). Kopie
   rozwiązują się częściowo same (retencja 7 dni + 4 tyg. → usunięta osoba
   wypada z kopii w ≤4 tygodnie) — **to jest czysta odpowiedź, ale trzeba ją
   nazwać wprost**, nie zakładać.
4. **Logi — czy lądują w nich dane osobowe.** `error_log` ma `oczyscTekst()`
   (Audyt 4). Sprawdź **pozostałe** drogi logowania: `console.error` (94 na
   serwerze → logi Vercela), logi kontenera kopii, meldunki `/api/backup/ping`.
   Zasada z Audytu 4: log to zbiór danych osobowych.
5. **Zgodność z polityką prywatności.** Ustalenia (kategorie danych, retencja,
   podmioty przetwarzające: Neon, Vercel, az.pl, Resend, MF/KSeF) dopisz do
   **`docs/DO-PRAWNIKA-I-TLUMACZA.md`** — to jest miejsce na treść prawną,
   nie kod i nie nowy plik.
6. **Lokalne AI jako mocna strona.** Ollama na Macu właściciela — dane nie idą
   do chmury żadnego dostawcy LLM. Udokumentuj to jako **przewagę prywatności**
   (do polityki i do materiałów sprzedażowych integratora lokalnych LLM), nie
   tylko „sprawdzone".
7. **`docs/AUDYT-2-WYNIKI.md`** — główny produkt, wzorem `AUDYT-1-WYNIKI.md` /
   `AUDYT-3-WYNIKI.md` / `AUDYT-4-WYNIKI.md`: ustalenia wg ryzyka, mapa danych,
   tabela retencji, procedura usunięcia, decyzje właściciela, co otwarte.
8. **Minimalny kod — tylko to, co właściciel zatwierdzi.** Np. jeśli wybierze
   automatyczne czyszczenie starych leadów — dołóż najprościej (bramka migracji
   `schemaUpToDate()`/`markSchemaApplied()`, nie-DDL w `inMigration()`, nadzór
   przez mechanizm z Audytu 4, `useUI()` zamiast `window.*`). **Nie buduj nic
   „na zapas".**

## Co ROZSTRZYGNĄĆ z właścicielem (nie decyduj sam)

Właściciel nie programuje — pytaj wprost, po polsku, bez żargonu. Kandydaci
(dopracuj po zrobieniu mapy — mapa może dorzucić kolejne):

1. **Retencja leadów i klientów.** Dziś leżą bezterminowo. Jak długo trzymać
   leada, który nigdy nie stał się klientem (np. 24 miesiące od ostatniego
   kontaktu)? A klienta po zakończeniu współpracy (tu zwykle decyduje prawo —
   faktury 5 lat podatkowo)? To napięcie „RODO każe usuwać / prawo podatkowe
   każe trzymać" jest realne i wymaga świadomej decyzji.
2. **Prawo do usunięcia — jak agresywnie.** Ręczna procedura („usuwam klienta,
   a kopie same wygasają w 4 tygodnie") czy przycisk „Usuń wszystkie dane tej
   osoby" w panelu? Pierwsza jest darmowa i wystarczająca dla jednej osoby;
   druga to nowy kod. **Zapytaj, nie zakładaj.**
3. **Czy budować cokolwiek teraz, czy odłożyć na po rejestracji.** Firma NIE
   jest jeszcze zarejestrowana — część RODO (administrator danych w polityce,
   rejestr czynności przetwarzania) świadomie czeka (`PO_REJESTRACJI.md`).
   Zapytaj, co ma powstać teraz jako kod, a co jako zapis „do zrobienia przy
   rejestracji".

## Weryfikacja — `tsc` tu nic nie udowodni

„Zielony build nie jest dowodem" (zasada z czterech poprzednich audytów).
Dowodem jest odczyt kodu i uruchomienie:

1. **Mapa danych oparta na SCHEMACIE, nie pamięci** — policz i przejrzyj
   `CREATE TABLE` w `lib/db.ts`, nie zgaduj z listy modułów.
2. **Kaskady usunięcia sprawdzone URUCHOMIENIEM** — usuń testowego klienta w
   dev-bazie (PGlite) i zobacz, co zostaje osierocone (faktury? maile?
   notatki?). Nie „ON DELETE wygląda dobrze".
3. **Czyszczenie logów sprawdzone po użyciu** — grep po drogach logowania,
   potwierdź, że `oczyscTekst()` obejmuje to, co ma, a `console.error` nie
   wypuszcza e-maili do logów Vercela.
4. `npx tsc --noEmit -p tsconfig.json` po każdej paczce kodu (jeśli będzie).
   Pełny `next build` failuje w sandboxie z EPERM.

## Zasady prowadzenia (nie powtarzaj cudzej roboty)

- **Przeczytaj najpierw ustalenia poprzednich audytów.** `AUDYT-1-WYNIKI.md`
  (publiczne trasy wydawały IP — naprawione, ale ująć w mapie; `rate_limit_hits`
  = odciski nie IP), `AUDYT-4-WYNIKI.md` (`oczyscTekst()`, log = dane osobowe),
  `AUDYT-3-WYNIKI.md` (retencja kopii, off-site). **Nie buduj tego drugi raz.**
- **Weryfikuj gretem/uruchomieniem, nie pamięcią.** Dokumentacja w tym
  projekcie już nie raz kłamała.
- **Treść prawna idzie do `docs/DO-PRAWNIKA-I-TLUMACZA.md`**, nie do kodu i nie
  do nowego pliku (Moduł 29 to ustalił).
- **Produkcyjna baza i NAS są poza zasięgiem Claude.** Wszystko, co ich dotyka
  (prawdziwe usunięcie z produkcji, przegląd realnych kopii), idzie przez
  właściciela — przygotuj instrukcje bez żargonu.
- **Firma nie jest zarejestrowana** — nie traktuj świadomie odłożonych pozycji
  prawnych (`PO_REJESTRACJI.md`) jako luk do naprawienia teraz.
- **Jeden audyt = jeden czat.** Nie wchodź w Audyt 6/5/7.

## Po zakończeniu

Zaktualizuj `docs/AUDYTY-KONCOWE.md` (odhacz Audyt 2, wskaż następny — **Audyt 6
poprawność kodu / dług techniczny**), dopisz pozycje do `PO_REJESTRACJI.md`
i do `docs/DO-PRAWNIKA-I-TLUMACZA.md` jeśli coś wyjdzie na „po rejestracji",
odhacz w `docs/plany-modulow/README.md`, zapisz istotne decyzje w pamięci
i podaj właścicielowi komendę do commita.
