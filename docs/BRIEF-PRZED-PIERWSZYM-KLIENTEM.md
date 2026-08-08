# Brief: ciężka praca przed pierwszym klientem

**Do wykonania w OSOBNYM, czystym czacie.** Powstał 2026-08-08 na koniec sesji,
w której zbudowano podgląd wezwania (panel + apka), kartkę przeglądu i plan
sprzedażowy. Powód wydzielenia: to trzy duże, równoległe roboty, które zjadają
kontekst — a ta sesja miała go już mało.

---

## Punkt startu

- Panel: `9ac39ff` (+ ten brief). Apka `../leggera-hub-ios`: `e116be5`.
  Oba drzewa czyste, wszystko wypchnięte.
- `tsc` czysto · `npm test` **371/371** · `npm run przejscie` **126 działa ·
  0 regresji** · `swift test` **16/16**.
- **Najpierw przeczytaj `HANDOFF.md` w całości, potem `CLAUDE.md`.**

## Twarde fakty, od których zależy ocena każdego zdania

Bez nich cała ta robota nie ma sensu — połowa zadania to sprawdzenie, czy
teksty mówią prawdę **na dziś**:

- Firma **nie jest zarejestrowana** (brak NIP).
- **Zero klientów. Zero wdrożeń. Zero referencji. Zero case studies.**
- Właściciel dopiero zaczyna zdobywać pierwszych klientów
  (`docs/PLAN-PIERWSI-KLIENCI.md`).
- Kierunek: prywatne, **lokalne** modele LLM i automatyzacja dla MŚP w Polsce.
- Panel `/admin` jest zbudowany, przeaudytowany i **nigdy nie był użyty
  produkcyjnie**.
- Strona publiczna istnieje w trzech językach (`i18n/dictionaries/{pl,en,de}.json`,
  ~20 KB każdy) i mówi to samo co plan: „Prywatne, lokalne AI i automatyzacja
  dla MŚP".

## Dlaczego nie kolejny audyt kodu

Panel przeszedł 7 audytów końcowych, 12 audytów modułów, przegląd spójności,
przegląd szwów i 3 przejścia „na sucho". Ostatnie kończyły się wynikiem **zero
zmian**. Za to dziura znaleziona 2026-08-08 — wezwanie do zapłaty, którego nie
dało się przeczytać przed wysłaniem — **nie została znaleziona przez żaden
z nich**. Wyszła z próby UŻYCIA panelu.

**Wniosek, który wyznacza zakres tej roboty: kod jest sprawdzony, TREŚĆ nie.**
Nikt nigdy nie przejrzał w całości tego, co ta firma pokazuje człowiekowi
z zewnątrz.

---

## Zadanie A+B — wszystko, co widzi klient

**Gotowy skrypt: `scripts/workflows/co-widzi-klient.js`.** Uruchom przez
`Workflow({scriptPath: "scripts/workflows/co-widzi-klient.js"})`. Napisany
i sprawdzony składniowo, ale **nie przebiegnięty do końca** — sesja skończyła
się wcześniej. Można go poprawiać.

Dwanaście obszarów równolegle, każde znalezisko potem weryfikowane
adwersaryjnie (agent ma je OBALIĆ, domyślnie odrzuca przy wątpliwości):

| obszar | co |
|---|---|
| strona-pl | `i18n/dictionaries/pl.json` klucz po kluczu + Hero/ProblemVision/Services |
| strona-sekcje | Approach, Founder, FoundingOffer, CTA, Faq, Footer, Header |
| **dowody** | `CostProof.tsx`, `Reliability.tsx`, `content/cost-proof.json`, `content/reliability-proof.json` |
| kalkulator | `SavingsCalculator.tsx`, `app/[lang]/calculator/**`, `lib/dobor.ts` |
| jezyki | spójność PL / EN / DE, klucz po kluczu |
| formularz-cta | `ContactForm.tsx`, CTA, trasa przyjmująca formularz, zgoda RODO |
| maile-szablony | `lib/mail.ts`, `lib/mailSignature.ts`, `lib/kopertaMaila.ts` |
| maile-windykacja | `reminderEmailText`, `dunningEmailText` w `lib/invoices.ts` |
| wydruk-oferta | `app/[lang]/admin/offers/[id]/print/**` |
| wydruk-umowa | `contracts/[id]/print/**` + klauzule w `lib/contracts.ts` |
| wydruk-faktura-wezwanie | `invoices/[id]/print/**` i `.../wezwanie/print/**` |
| publiczne-dokumenty | `app/[lang]/{oferta,faktura,umowa,nda,wezwanie,opinia}/[token]/**` |

**Najważniejszy obszar to `dowody`.** Strona twierdzi m.in. *„To nie case study.
To licznik z produkcji."* oraz ma sekcję o niezawodności. Przy zerowej liczbie
klientów trzeba sprawdzić, skąd te liczby pochodzą i czy zdania wokół nich są
prawdziwe. To jest kategoria, która może najbardziej zaszkodzić: pierwszy
człowiek, który dostanie maila, wejdzie na stronę i zapyta o referencje.

**Czego szukamy** (kolejność = ważność): zdania nieprawdziwe dziś (sugerujące
klientów, wdrożenia, zespół) · obietnice bez pokrycia (liczby, terminy, SLA) ·
placeholdery i fikcyjne dane · niespójność PL/EN/DE i mail↔dokument · ton
(przechwałki u firmy bez referencji brzmią gorzej niż skromny konkret).

**Czego NIE zgłaszać:** miejsc świadomie uczciwych (np. „zanim przyjmiemy
pierwszych partnerów" — to jest dobre), rzeczy widocznych tylko w kodzie,
oraz `ZLECENIODAWCA / WYKONAWCA` na umowie (znane jako A5) i podglądu wezwania
(dodany 2026-08-08, poprawny).

**Wynik:** lista poprawek z cytatem i propozycją nowego brzmienia. **Poprawki
bezsporne** (literówki, placeholdery, martwe linki) wykonaj od razu.
**Zmiany w treści marketingowej pokaż właścicielowi do decyzji** — to jego głos,
nie Twój.

## Zadanie C — materiały sprzedażowe, których nie ma

Wynika wprost z `docs/PLAN-PIERWSI-KLIENCI.md`. Właściciel zaczyna rozmowy
w tym tygodniu i potrzebuje:

1. **Wzór mapy procesu** — jedna strona A4, oddawana bezpłatnie po rozmowie
   diagnostycznej. To jego główny dowód kompetencji przed pierwszym klientem.
   Do rozstrzygnięcia: czy robić z tego dokument w panelu (jak oferta), czy
   zwykły szablon do wypełnienia.
2. **Szablon oferty pod biuro rachunkowe** i **pod małą produkcję** — dziś jest
   siedem szablonów ogólnych. Ceny i zasady bez zmian:
   audyt/PoC **8 000**, jeden proces **4 900**, wdrożenie **16 000**, lokalny
   model **14 000** + sprzęt z katalogu, opieka **1 500/mies**, rabat na start
   **−20 % jako osobna pozycja** („w zamian za referencję"), nigdy jako obniżka
   cennika.
3. **Opisy usług w katalogu językiem klienta**, nie technicznym.

Szablony ofert to **dane w bazie**, nie kod — wchodzą przez
`dosiewJuzByl()`/`oznaczDosiew()` w `lib/db.ts`, nie przez migrację schematu
(patrz `HUB_SETUP.md` → „Szablony ofert").

## Zadanie D — decyzja bez podglądu

Uogólnienie dzisiejszego znaleziska: **każde miejsce, w którym panel prosi
właściciela o decyzję, powinno pokazywać przedmiot tej decyzji.** Kandydaci do
sprawdzenia: propozycje z Fazy 3 (`lib/propozycje.ts`), bramka wysyłki
z ostrzeżeniami, potwierdzenia nieodwracalne (`lib/nieodwracalne.ts`), sekcje
Pulpitu, ekran Zdrowie.

Pytanie kontrolne przy każdym: *czy z tego ekranu da się zobaczyć to, o czym
mam zdecydować, zanim zdecyduję?* Skrypt do napisania — wzoruj się na
`co-widzi-klient.js`.

---

## Kolejność i sposób

1. **A+B** (`scripts/workflows/co-widzi-klient.js`) — najpilniejsze, bo
   właściciel wysyła pierwsze wiadomości w tym tygodniu i ludzie wejdą na stronę.
2. **D** — niezależne od A+B, można puścić równolegle.
3. **C** — po A+B, żeby materiały mówiły tym samym językiem co poprawiona strona.

Właściciel wyraził zgodę na **zrównoleglenie wieloma agentami naraz**
(2026-08-08) — nie pytaj o to drugi raz, ale trzymaj rozsądną skalę na fazę.

## Czego nie robić

- **Nie dobudowuj funkcji w panelu.** Narzędzie jest gotowe; każda godzina
  w kodzie to godzina niewłożona w rozmowę z klientem.
- Nie ruszaj niczego z sekcji „Czego NIE zaczynać bez wyraźnej prośby"
  w `HANDOFF.md`.
- Nie powtarzaj audytów kodu ani przeglądu hierarchii Pulpitu.
- Nie zmieniaj treści marketingowej bez pokazania właścicielowi — poza
  literówkami i placeholderami.
- Nie przechodź ręcznie tego, co robi `npm run przejscie`.

## Co czeka na właściciela (nie na kod)

Kartka `docs/PRZEGLAD-KARTKA.md` (wydruki na papierze, telefon i iPad palcem),
Pulpit po przebudowie, kwadraciki na Tablicy, godziny automatów w UTC,
`x-znany-stan` w apce, `CEIDG_TOKEN` w Vercelu. Szczegóły: `HANDOFF.md`.
