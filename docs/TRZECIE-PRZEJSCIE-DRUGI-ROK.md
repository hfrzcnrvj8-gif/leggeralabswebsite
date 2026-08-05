# Wynik: trzecie przejście — drugi rok obrotowy

**Wykonane:** 2026-08-05, wg `TRZECIE-PRZEJSCIE-DRUGI-ROK-PLAN.md`.
**Zakres:** panel. Apki nie ruszano.
**A1 (numeracja faktur) świadomie ODŁOŻONE** — decyzja właściciela: sprawy
księgowe idą na sam koniec, po rejestracji działalności.

Z czterech podejrzeń briefu: **dwa potwierdzone i naprawione**, **jedno
sprawdzone i czyste**, **jedno odłożone**.

---

## Co było nie tak — i jak to wygląda w pieniądzach

### A2 + A3. Faktura cykliczna „co miesiąc 31." uciekała z dnia umowy

Dwie usterki w jednym mechanizmie, obie ciche i obie jednokierunkowe: raz
przesunięta seria nigdy nie wracała na swój dzień.

**A2 — przelew krótkiego miesiąca.** `nextRunAfter()` liczyło termin przez
`Date.setMonth()`, a ten nie obcina, tylko **przelewa**: 31 stycznia + 1 miesiąc
= **3 marca**. Zmierzone łańcuchem, tak jak liczył to cron:

```
31 sty → 3 mar → 3 kwi → 3 maj → 3 cze → 3 lip → 3 sie
```

Po pół roku abonament „co miesiąc 31." wystawiał się 3. dnia miesiąca.
Kwartalny od 30 listopada trafiał na 2 marca zamiast 28 lutego.

**A3 — dryf od dnia nadrobienia.** Cron liczył następny termin od `today`, a nie
od rytmu serii. Każde spóźnienie (awaria, brak `CRON_SECRET`, limity Vercela)
przesuwało serię **na stałe**: faktura „co miesiąc 1." nadrobiona 5. wystawiała
się już zawsze 5.

**Dlaczego to nie wyszło wcześniej:** oba komentarze w kodzie twierdziły, że
ochrona jest.

- `lib/recurring.ts` obiecywał „naturalne obcięcie w krótszych miesiącach przez
  `Date`" — czegoś, czego `Date` nie robi.
- `lib/recurrence.ts` (wydarzenia i przypomnienia, gdzie tę samą pułapkę
  naprawiono 2026-07-22) wskazywał `nextRunAfter()` **jako wzór do
  naśladowania** — czyli jako wzór posłużyła funkcja, która ochrony nie miała.

To jest ta sama rodzina, co „uzasadnienie pominięcia przeterminowuje się
w ciszy" z wczorajszego audytu, tylko ostrzejsza: **komentarz nie przeterminował
się, on nigdy nie był prawdziwy.**

#### Jak naprawione

Poprawka jest bliźniakiem tego, co od 2026-07-22 działa w Kalendarzu — te same
dwa mechanizmy, bo to ten sam problem:

1. **Przycięcie do ostatniego dnia miesiąca docelowego** (`Math.min(dzień,
   ostatni)`) — 31 stycznia + 1 miesiąc daje 28 lutego, nie 3 marca.
2. **Liczenie od KOTWICY, nigdy krok po kroku.** Samo przycięcie nie
   wystarcza: iteracja przytnie do 28 lutego, a potem policzy dalej OD 28.
   i reszta roku wypadnie 28. Dlatego obie tabele dostały kolumnę `kotwica`
   (`recurring_invoices`, `recurring_costs`) — odpowiednik
   `reminders.powtarzanie_od`. Istniejące szablony mają ją uzupełnioną
   z `next_run` w migracji.

`nextRunFromAnchor(kotwica, cykl, po)` jest tym, czego używa teraz cron.
Ręczna zmiana terminu **przestawia kotwicę** („od teraz 10. dnia") — ta sama
reguła i to samo uzasadnienie, co przy terminie przypomnienia.

Jedna pułapka złapana po drodze: w `PATCH /api/recurring-costs/:id` kotwica
przestawia się **tylko gdy termin naprawdę się zmienił**. Ta trasa przepuszcza
komplet pól, więc bezwarunkowy zapis oznaczałby, że zwykła zmiana kwoty przy
serii „od 31." zapisuje jako kotwicę bieżący, przycięty termin (28 lutego)
i seria zostaje na 28. do końca życia.

### A4. Retencja — sprawdzona, CZYSTA

Nigdy wcześniej nie przeszła przez rzeczywisty upływ okna. Przeszła teraz i zdała:

| rekord | wiek | wynik |
|---|---|---|
| lead bez żadnego powiązania | 24+ mies. bez kontaktu | **usunięty** ✓ |
| lead równie stary, ale z ofertą | 24+ mies. | **zachowany** ✓ |
| lead świeży | — | nietknięty ✓ |

Wykluczenie jest tu ważniejsze od samego kasowania: fałszywe zatrzymanie
kosztuje miejsce, fałszywe usunięcie kosztuje dane, których nie ma skąd odtworzyć.

### A1. Numeracja faktur — ODŁOŻONA, nie naprawiona

Rok w numerze bierze się z **zegara serwera** w chwili kliknięcia „Wystaw"
(`app/api/invoices/[id]/issue/route.ts`), a nie z `data_wystawienia` dokumentu.
Szkic z datą 31.12.2026 wystawiony 2 stycznia dostanie numer `FV 1/2027`.

Numer faktury to dokument fiskalny, a „numer według czego" ma odpowiedź
księgową, nie programistyczną. **Zostaje otwarte do rozmowy z księgową.**

---

## Jak to sprawdzono

**Metoda: postarzamy DANE, nie zegar.** W kodzie nie ma wstrzykiwania daty
i świadomie go nie dodano — retencja liczy się SQL-em (`now() - interval`),
a cykliczne wyzwala `next_run <= today`, więc rekord z datą w przeszłości
zachowuje się dokładnie tak, jakby czas minął.

**Dowód w danych** (dev-baza, przebieg przez trasy):

```
szablon „co miesiąc 31.", termin zaległy o pół roku
PO ZAŁOŻENIU          next_run: 2026-01-31 | kotwica: 2026-01-31
PO PRZEBIEGU CRONA    next_run: 2026-08-31 | kotwica: 2026-01-31   ← wrócił na 31.
```

Przed poprawką ten sam przebieg dawał `2026-09-05` — dzień nadrobienia.

**Trwały dorobek, żeby to nie wróciło:**

- **9 nowych testów** (`test/recurring.test.ts`) — `npm test` **349/349**
  (było 340). Regresja realnego błędu, opisana z datami i skutkiem.
- **8 nowych zdań w harnessie** — `npm run przejscie` **109 działa · 0 regresji**
  (było 101), w dwóch krokach: „Drugi rok: rytm serii cyklicznych" i „Drugi rok:
  retencja po upływie okna".

**Zdania sprawdzone kontrolnie.** Zdanie, które zawsze przechodzi, nic nie
pilnuje — więc poprawka została tymczasowo cofnięta i przejście uruchomione
ponownie. Padło dokładnie tam, gdzie powinno, i pokazało usterkę wprost:

```
✗ cron nadrabiający zaległą serię NIE przesuwa jej na dzień nadrobienia
    → next_run = 2026-09-05 (kotwica 2026-01-31)
```

---

## Pułapka środowiska, warta zapamiętania

W trakcie sesji **wszystkie trasy `/api/*` zaczęły oddawać 404** — także te,
które działały pół godziny wcześniej i których nikt nie dotykał. Strona główna
odpowiadała 200, `tsc` przechodził czysto. To był **uszkodzony cache
Turbopacka** po restarcie serwera, nie błąd w kodzie. Lekarstwo: `rm -rf .next`
i ponowny start. Bez tego łatwo zacząć szukać usterki w świeżo zmienionym
pliku — którego problem nie dotyczył.

---

## Czego to przejście NIE objęło

- **A1** — patrz wyżej, decyzja właściciela.
- **Punkt (a) trzeciego przejścia** — „oczami klienta w prawdziwej
  przeglądarce". Wymaga przeglądarki, której to środowisko nie ma.
- **Punkt (c)** — „awarie i brzegi": zerwane żądanie w połowie wysyłki, dwie
  karty na tym samym dokumencie, klient klikający dwa razy, brakujący
  `RESEND_API_KEY`. Nietknięte, dalej otwarte.
- **Numeracja przez zmianę roku jako taka** — bez rozstrzygnięcia A1 nie ma
  czego sprawdzać, bo nie wiadomo, jaki wynik jest poprawny.
