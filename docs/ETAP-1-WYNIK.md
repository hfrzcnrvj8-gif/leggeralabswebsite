# Etap 1 — wynik: czy instrukcje nadal mówią prawdę

**Wykonano:** 2026-08-05. **Zakres:** panel, wyłącznie dokumentacja i teksty
w `lib/instrukcje.ts`. **Zachowania panelu nie zmieniono ani w jednym miejscu.**
Brief: `docs/ETAP-1-PRZEWODNIK-BRIEF.md`.

**Metoda:** brałem zdanie z instrukcji, szukałem miejsca w kodzie, które ma je
czynić prawdziwym, i sprawdzałem. Nazwy przycisków — gretem po `app/[lang]/admin`.
Liczby i progi — po stałych w `lib/`. Pulpit i ekran *Instrukcje* — dodatkowo
obejrzane na żywo na `npm run dev` (przez `innerText`, bo podgląd renderuje
w ukrytej karcie).

**Wynik jednym zdaniem: instrukcje nie były aktualne od 2026-08-02.**
`lib/instrukcje.ts` ostatni raz zmieniono commitem `e441246`; od tamtej pory do
`main` weszło **51 commitów**, w tym pięć faz zaplecza i dwa przejścia „na
sucho". Znalazłem **12 zdań nieprawdziwych** i **9 mechanizmów, o których
instrukcja w ogóle nie wiedziała**. Wszystkie poprawione.

---

## A. Zdania nieprawdziwe (12) — poprawione

| # | gdzie | co mówiła instrukcja | jak jest naprawdę |
|---|---|---|---|
| **A1** | Wstęp | „panel **nigdy** nie kontaktuje się z nikim za Ciebie" | **Nieprawda i to ta najważniejsza.** Windykacja wysyła maile do klienta SAMA, z porannego przebiegu: +3 dni uprzejmie, +10 stanowczo, **+21 formalne wezwanie do zapłaty z odsetkami**. Komentarz w kodzie nazywa to wprost „najpoważniejszy krok, jaki panel wykonuje bez pytania" (`app/api/leads/notify/route.ts`) |
| **A2** | Pulpit, krok 2 | „Przeczytaj sekcję **Nadzór**" | W panelu **nie ma sekcji o tej nazwie** — są dwa złote pasy nad wskaźnikami („Kopie zapasowe bazy nie są uruchomione", „…automat przestał chodzić"). Nazwa „Nadzór" istnieje wyłącznie w apce na iPhonie |
| **A3** | Pulpit, krok 6 | „Menu **…** — Łowca: poluj teraz, Wyślij dzienny raport" | Pulpit w panelu **nie ma menu „…"**. Obie akcje są w palecie ⌘K i na pasku ekranu *Leady*. Menu „…" z tymi pozycjami jest w apce |
| **A4** | Pulpit, krok 4 | „przycisk **+** — nowy lead, skan wizytówki, koszt z paragonu" | Na Pulpicie w panelu **nie ma przycisku „+"**. To opis ekranu z apki |
| **A5** | Pulpit, krok 1 | „duża liczba i podpis **wymaga dziś Twojego ruchu**" | Podpis brzmi „**Wymaga działania dziś**" (kafel wśród ośmiu wskaźników), a w pasku nad nim: „Pulpit — N spraw wymaga dziś działania" |
| **A6** | Faktury, krok 2 | przycisk „**Utwórz korektę**" | Przycisk nazywa się „**Wystaw korektę**" |
| **A7** | Faktury, krok 6 | „ton rośnie z liczbą dni po terminie" | **Od 2026-08-04 poziom wybiera właściciel** (trzy przyciski: 1/2/3). Dni tylko podpowiadają, a nie da się zejść poniżej poziomu już wysłanego |
| **A8** | Faktury, „gdzie" | „pozycja w menu **pod Umowami**" | W menu Faktury stoją **pod Projektami** (Umowy → Projekty → Faktury) |
| **A9** | Wstęp, „stan" | „poza spisem zostaje **Zdrowie systemu**" | Poza spisem są **dwa** ekrany: także **Statystyki** — pełny moduł z własną pozycją w menu |
| **A10** | Leady, krok 2 | „**Pięć** dróg, którymi biorą się leady" | Jest **sześć** — doszło „Utwórz leada" z maila w module Poczta (kategoria źródła „Zapytanie mailem") |
| **A11** | Poczta | „rodzaj: Zapytanie, Rachunek, Rozmowa, Reklama" | Rodzajów jest **pięć** — brakowało „**Urzędowe**" |
| **A12** | Leady, sito Łowcy | pięć dyskwalifikatorów | Jest **sześć** (doszła upadłość/zakaz działalności); brakowało też ujemnego punktu −10 za „sam formularz zamiast adresu" |

Punkty **A2–A5** mają wspólną przyczynę: cały rozdział o Pulpicie napisano
patrząc na **apkę**, a czyta się go głównie w panelu. Wszystkie cztery
poprawki polegają na powiedzeniu wprost, które zdanie dotyczy którego
urządzenia — tak jak robią to pozostałe moduły.

---

## B. Mechanizmy, o których instrukcja nie wiedziała (9) — dopisane

Wszystkie powstały **po 2026-08-02**, czyli po ostatniej aktualizacji instrukcji.

| # | czego brakowało | gdzie dopisane |
|---|---|---|
| **B1** | **Propozycje na Pulpicie** (Faza 3) — sześć reguł, „zrób to" / „nie teraz" | Pulpit, nowy krok 3 |
| **B2** | **Potwierdzenia** (Faza 4) — 22 działania pytają „Na pewno?", cztery każą PRZEPISAĆ nazwę rekordu | Wstęp, zasada trzecia + Faktury krok 1 |
| **B3** | **Bramka wysyłki** (Faza 2) — dokument bez wystawcy albo z „[uzupełnij]" nie wyjdzie; „Wyślij mimo to" przepuszcza ostrzeżenia | Wstęp, zasada czwarta + Oferty krok 7 + Umowy krok 3 |
| **B4** | **Klient może sam odrzucić ofertę** ze swojej strony („Dziękuję, rezygnujemy") | Oferty, krok 10 |
| **B5** | **Podpis umowy albo aneksu przestawia termin projektu** — także wtedy, gdy projekt miał już własny termin | Umowy (automaty) + Projekty (automaty) |
| **B6** | **Kotwica serii cyklicznej** — „co miesiąc 31." nie zsuwa się na 28. i nie przesuwa się na stałe po nadrobieniu | Faktury, krok 9 |
| **B7** | **Reguła nadpłaty** — dwie wpłaty na tę samą fakturę nie są blokowane, ale łapie je *Zdrowie* | Faktury (automaty) |
| **B8** | **Dwa pozostałe automaty**: 4:00 (Łowca) i 8:00 (kolejka poczty odłożonej), plus dopalanie Łowcy z raportu o 6:00 | Pulpit (automaty) |
| **B9** | **Trzy ścieżki dnia** przechodzące MIĘDZY modułami (punkt 3 briefu) — nie było ich | Wstęp, ostatni akapit — same odsyłacze „moduł + numer kroku", bez powtarzania treści |

**B9 świadomie jest listą odsyłaczy, nie nowym tekstem.** Kroki są opisane przy
modułach; przepisanie ich w drugie miejsce rozjechałoby się z oryginałem
dokładnie tak, jak rozjechał się cały ten rozdział.

---

## C. Do Twojej decyzji — NIE tknąłem

### C1. Windykacja wysyła do klienta bez Twojego kliknięcia (patrz A1) — ✅ ROZSTRZYGNIĘTE 2026-08-07

**Decyzja właściciela: wariant 2.** Poziomy 1–2 (+3 i +10 dni) zostają
automatem, **poziom 3 — formalne wezwanie do zapłaty z odsetkami — przestał
wychodzić sam**. Po 21 dniach faktura staje na Pulpicie w sekcji
„Wezwanie czeka na Twoją decyzję" i czeka na kliknięcie.

Co się zmieniło w kodzie:

- `lib/invoices.ts` — `MAKS_POZIOM_AUTOMATU = 2`, `poziomAutomatuDlaDni()`
  (sufit przez `Math.min`, nie „pomiń fakturę"), `czekaNaDecyzjeOWezwaniu()`.
- `app/api/leads/notify/route.ts` — gałąź wysyłki wezwania **usunięta**, nie
  wyłączona `if`-em. Jedynym nadawcą wezwania jest dziś
  `POST /api/invoices/[id]/remind`; druga kopia (token, odsetki, sygnatura)
  rozjechałaby się z tamtą przy pierwszej zmianie.
- `app/api/hub/today/route.ts` + `DashboardHome.tsx` — nowa sekcja z
  przyciskiem „Wyślij wezwanie". Okno „Wysłać wezwanie do zapłaty?" stawia
  TRASA (Faza 4, 428), nie przycisk.
- Instrukcje w panelu (`lib/instrukcje.ts`, 3 zdania) i `docs/CO-MAM.md`
  przepisane — bez tego przewodnik zacząłby kłamać tego samego dnia.

Dowód: `npm test` 371/371 (6 nowych zdań w `test/windykacja.test.ts`,
sprawdzonych kontrolnie przez tymczasowe podniesienie sufitu z powrotem do 3 —
padły 2), `npm run przejscie` 125 działa · 0 regresji (2 nowe zdania).
Zmierzone w przeglądarce: przycisk 108×24 px, kontrast 5,76:1 w spoczynku
i 5,25:1 na hover, na 390 px nic nie wychodzi poza ekran.

**Uwaga na apkę:** `../leggera-hub-ios` nie zna klucza `wezwaniaDoDecyzji`,
więc na telefonie ta sekcja się nie pokazuje. Wezwanie nadal da się wysłać
z profilu faktury (wybór poziomu jest w apce od paczki 3), ale **panel upomni
się o decyzję, a telefon nie**. Do dołożenia, gdy przyjdzie kolej na apkę.

#### Treść pytania sprzed decyzji (zostawiona dla kontekstu)

To jedyne miejsce w całym panelu, gdzie wiadomość wychodzi do prawdziwej osoby
bez kliknięcia. Dziś zapisałem to w instrukcji tak, jak jest — razem z drogami
wyjścia (usuń adres e-mail z faktury, ustaw „Anulowana", unieważnij link).

**Pytanie do Ciebie:** czy tak ma zostać? Trzy możliwości:

1. **Zostaje** — wygoda jest realna, a pierwsze dwa poziomy są uprzejme.
2. **Zostają poziomy 1–2, a wezwanie (poziom 3) czeka na kliknięcie** — formalne
   wezwanie do zapłaty z odsetkami to dokument, który psuje relację; dziś idzie
   sam, 21. dnia, także do klienta, z którym rozmawiałeś wczoraj przez telefon.
3. **Wszystko czeka na kliknięcie**, a Pulpit tylko przypomina.

Nie zmieniam tego sam — to decyzja handlowa, nie techniczna. Jeśli wybierzesz 2
albo 3, poprawka idzie etapem 5.

### C2. Godzina automatów: „6:00" może nie znaczyć 6:00 u Ciebie

`vercel.json` planuje raport na `0 6 * * *`. Vercel odpala crony **w czasie
UTC**, więc w Polsce byłoby to **7:00 zimą i 8:00 latem**. Nie mam jak tego
sprawdzić stąd — Ty masz: **o której naprawdę przychodzi poranny mail?**
Jeśli o 8:00, to trzy zdania w instrukcji („o 6:00", „o 4:00", „o 8:00") trzeba
przesunąć, a nie kod. Zostawiłem godziny takie, jakie są w konfiguracji.

### C3. Dokumentacja projektu mówi „14 reguł kontroli spójności" — jest 13

`HANDOFF.md` i brief tego etapu piszą o czternastej regule dołożonej 2026-08-05.
Policzone w kodzie: `lib/spojnosc.ts` ma **13** reguł (reguła nadpłaty jest
trzynasta, nie czternasta). Poprawiłem liczbę w `docs/CO-MAM.md` i `HANDOFF.md`.
Kodu nie ruszałem — nie brakuje reguły, myli się licznik w dokumencie.

---

## D. Sprawdzone i CZYSTE — żeby nikt nie liczył tego drugi raz

Te zdania z instrukcji przyłożyłem do kodu i **zgadzają się co do liczby**:

- **Retencja:** kandydat 30 dni (`KANDYDACI_RETENCJA_DNI`), lead 24 miesiące
  (`LEADS_RETENTION_MONTHS`), poczta 24 miesiące, oferta przegrana 24 miesiące,
  dowód e-podpisu 6 lat (`ESIGN_PROOF_RETENTION_MONTHS = 72`), klienci nigdy.
- **Sito Łowcy:** wagi 30/15/15/10/10/10/10/10/5/5, martwa strona −15, progi
  A ≥ 70, B ≥ 45, minimalny wiek 18 miesięcy — wszystko zgodne.
- **Kiedy lead sam się upomni:** zawsze przy „Nowe zgłoszenie ze strony",
  w dniu ustawionego przypomnienia, po 4 dniach przy „Napisano", po 14 dniach
  w każdym innym otwartym statusie, licząc od utworzenia, gdy kontaktu nie było.
- **Kontakty kontrolne po wdrożeniu:** +14 i +90 dni (`NURTURE_OFFSETS`), szkic
  wiadomości przygotowany, wysyłkę klika właściciel.
- **Cisza:** oferta 5 dni (`OFFER_STALE_DAYS`), umowa 7 dni
  (`CONTRACT_STALE_DAYS`), umowa dobiegająca końca 60 dni przed.
- **Faktury:** ponowne kliknięcie „Wystaw" **nie** nadaje drugiego numeru (trasa
  jest idempotentna i wtedy nawet nie pyta o potwierdzenie); wpłata na całość
  zamyka fakturę, usunięcie wpłaty cofa status; waluty PLN/EUR/USD/GBP;
  rabat na pozycji, przed VAT-em.
- **Blokada wysłanego dokumentu:** wolne zostają dokładnie status, powód
  odrzucenia, ważność i powiązania (`POLA_MIMO_BLOKADY_OFERTY`) — zgodnie z opisem.
- **Aneks:** „było" liczy się od ostatniego **podpisanego** aneksu
  (`lib/warunkiObowiazujace.ts`), aneks bez zmian nie da się wysłać.
- **Przypomnienia:** sygnał „leży od N miesięcy" po 90 dniach (`PROG_LEZY_DNI`).
- **Poczta:** 10 sekund na „Cofnij" (`UNDO_SEND_DELAY_MS`), zamknięcie karty
  w trakcie odliczania przerywa wysyłkę i panel to mówi.
- **Koszty:** załącznik do 8 MB, odliczenie VAT 100/50/0, próg amortyzacji
  10 000 zł netto.
- **Kalkulator:** VRAM ×1,15, RAM ≥ 2× VRAM, UPS ≥ 1,4× poboru.
- **Skróty klawiszowe:** wszystkie sprawdzone wyrywkowo zgadzają się —
  `t`/`x` u kandydatów, `1–4` statusy klienta, `1–6` statusy projektu,
  `r`/`a`/`f`/`e` w Poczcie, `g` + `c`/`d` jako skoki do modułów.
- **Proces sprzedaży:** 15 kroków (`PROCESS_STEPS`), przycisk „wszystkie kroki".
- **Katalog na telefonie:** przesunięcie w lewo pyta o potwierdzenie (własne
  okno apki — pozycja katalogu świadomie NIE jest na liście nieodwracalnych).

---

## Sprawdzenie

- `npx tsc --noEmit -p tsconfig.json` — czysto.
- `npm test` — **349/349**.
- `npm run przejscie` — wynik na końcu sesji, w `HANDOFF.md`.
- Ekran *Instrukcje* i Pulpit obejrzane na `npm run dev` przez `innerText`:
  nowe akapity wstępu i przepisane kroki Pulpitu renderują się, a opis
  („złote pasy nad wskaźnikami", kafel „Wymaga działania dziś", sekcja
  „Propozycje" pod wskaźnikami) zgadza się z tym, co ekran naprawdę pokazuje.

## Lekcja, która przeżyje ten etap

**Instrukcja starzeje się bez żadnego objawu.** `tsc` przechodzi, build
przechodzi, ekran się renderuje — a tekst opisuje panel sprzed pięciu faz.
Jedyne, co to złapało, to policzenie commitów od ostatniej zmiany pliku
(`git log -1 -- lib/instrukcje.ts`, potem `git rev-list --count …..HEAD`).
**To jest tanie sprawdzenie i warto je robić przy każdym większym module:**
jeśli licznik pokazuje kilkadziesiąt, instrukcja już kłamie — pytanie tylko
gdzie.

Drugi wniosek: **rozdział o module pisany „z jednego urządzenia" kłamie na
drugim.** Cztery z dwunastu nieprawd to jeden rozdział opisany z ekranu apki.
Pozostałe moduły robią to dobrze — mają osobne zdanie „Telefon i iPad: …".
