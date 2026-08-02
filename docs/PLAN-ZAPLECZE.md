# Plan: zaplecze ma działać w całości

**Powstał:** 2026-08-02, po pierwszym przejściu „na sucho"
(`docs/PIERWSZE-PRZEJSCIE-NA-SUCHO.md`). **Punkt startu:** `635f737`.

Kolejność zatwierdzona przez właściciela. Zasada dla Fazy 3 zatwierdzona:
**panel proponuje, właściciel zatwierdza.**

---

## Dlaczego nie zaczynamy od listy poprawek

Przejście dało trzydzieści kilka znalezisk. To **nie jest** trzydzieści kilka
usterek — to **cztery brakujące mechanizmy**, każdy objawiający się w kilku
modułach naraz. Łatane pojedynczo wrócą, dokładnie tak jak rozjazd koloru
wracał dwa razy (`docs/plany-modulow/59-spojnosc-ui.md`).

| brakujący mechanizm | ile znalezisk zamyka |
|---|---|
| jedno przepisanie danych klienta na dokument | 6 |
| jedna bramka „czy to wolno wysłać" | 5 |
| komplet skutków zdarzenia | 5 |
| lista działań nieodwracalnych | 3 |

## Dwie rzeczy, które ustawiają cały plan

### 1. Nic się nie wysypało

Żadne znalezisko nie rzuciło wyjątku. `error_log` jest pusty, ekran *Zdrowie*
pokazałby zieleń. Mail z `[Twoje imię]` wyszedł z kodem 200. Oferta bez
wystawcy — 200. Klient został „Prospektem" po opłaconej fakturze — 200.

Czyli **„wyłapywać błędy na bieżąco" nie może znaczyć „logować wyjątki"**,
bo wyjątków nie ma. Musi znaczyć **kontrolę spójności**: zestaw twardych zdań
o zapleczu, które da się sprawdzić i które muszą być prawdziwe.

### 2. Obecne testy nie mogły tego złapać

`npm test` to **34 pliki, wszystkie nad czystymi funkcjami z `lib/`** —
arytmetyka faktur, daty, walidacja, TOTP. Ani jeden nie dotyka trasy API ani
bazy. 209 przechodzących testów, zero pokrycia tego, gdzie realnie siedzą
błędy: w trasach, w przekazywaniu danych między modułami i w tym, co trasa
zapisuje.

To nie zarzut do tych testów — one pilnują pieniędzy i robią to dobrze.
To wskazanie, czego brakuje obok.

---

## Faza 0 — siatka bezpieczeństwa

**Zanim ruszymy cokolwiek innego.** Dziś jedynym sposobem sprawdzenia, czy
zaplecze działa, jest przeklikanie całej drogi ręcznie. Zajęło to kilka godzin
i trzy razy pomyliłem artefakt narzędzia z błędem panelu.

### 0a. Przejście całej drogi jako test — ✅ ZROBIONE 2026-08-02

`npm run przejscie` (`scripts/przejscie/`, README obok). Pierwszy wynik:
**21 działa · 12 znanych luk · 0 regresji · 1 obejście · 2 pominięte.**

Rozstrzygnięta decyzja techniczna: **`fetch` do działającego `npm run dev`**,
nie PGlite w procesie. Powód: trasy wołają `isAuthed()` przez `next/headers`,
więc poza kontekstem żądania się nie uruchomią — a połowa znalezisk siedzi
właśnie w trasach.

Trzy rzeczy, których nie było widać przed napisaniem:

- **Sprawdzać trzeba powód, nie kod.** Pierwsza wersja uznała lukę A2 za
  naprawioną, bo `/send` zwróciło 400 — ale z powodu pustego e-maila klienta,
  nie braku wystawcy. Rozstrzyga to dopiero sterowana sonda, zmieniająca jedną
  rzecz naraz. Ta sama pułapka czeka w każdej kolejnej fazie.
- **Hamulec publicznych dokumentów (5/60 min) czyni drogę KLIENTA
  niepowtarzalną** — po kilku przebiegach akceptacja i opinia przez publiczny
  link zwracają 429. To dobra decyzja z audytu Modułu 57 i nie osłabiamy jej;
  skrypt dopina te kroki od strony panelu i wypisuje, czego nie sprawdził.
- **Akceptacja od strony panelu nie zapisuje, kto zaakceptował.** Nie nazywam
  tego luką — właściciel odnotowuje wtedy cudzą zgodę, a nie ją składa — ale
  warto to rozstrzygnąć w Fazie 4 przy okazji listy działań nieodwracalnych.

Skrypt mierzy dwie rzeczy, których nie planowałem: **liczbę obejść** (ile razy
trzeba załatać przepływ palcami, żeby dojść do końca — dziś 1, po Fazie 1 ma
być 0) i **liczbę pominięć** (czego przebieg nie sprawdził).

### 0a-bis. Pierwotny opis zakresu

Jedno polecenie przechodzi: lead → wpis w historii → oferta → wysyłka →
akceptacja przez klienta → umowa → podpis → projekt → faktura → wystawienie →
zapłata → opinia. Po **każdym** kroku sprawdza dane, nie kod odpowiedzi.

Przykłady zdań do sprawdzenia (wprost z przejścia):

- po założeniu oferty z leada: `oferta.klient_email == klient.email`
- po wysyłce: `migawka` zawiera blok wystawcy
- po akceptacji: powstał projekt **i** faktura, oba wskazują na tego klienta
- po wygenerowaniu umowy: `umowa.termin_realizacji` nie jest `null`
- po zapłacie: `klient.status != "Prospekt"`

**Do ustalenia w pierwszym kroku:** czy uruchamiamy to na PGlite w procesie
(szybko, bez serwera), czy przez `fetch` do `npm run dev` (wierniej, bo idzie
przez trasy). Skłaniam się do drugiego — bo połowa znalezisk siedzi właśnie
w trasach — ale to decyzja techniczna, nie produktowa, i podejmę ją po
obejrzeniu, jak `lib/dev-db.ts` zachowuje się poza Next.

### 0b. Kontrola spójności jako ekran

Te same zdania, ale uruchamiane na **żywych** danych, nie na testowych.
Wchodzą na istniejący ekran *Zdrowie* (`/pl/admin/zdrowie`) — nowego modułu
nie robimy. Ekran przestaje mówić tylko „czy coś się wywaliło" i zaczyna mówić
„czy zaplecze mówi prawdę".

Reguły z przejścia, na start:

- faktura opłacona ⇒ klient nie jest „Prospektem"
- dokument wysłany ⇒ ma wystawcę w migawce
- projekt z podpisaną umową ⇒ ma termin
- lead „Zamknięte - sukces" ⇒ nie ma żywego `next_followup`
- faktura z projektu, który ma umowę ⇒ `contract_id` nie jest `null`

**Sprawdzenie fazy:** test przechodzi całą drogę i **oblewa** na tych
regułach, które opisuje `PIERWSZE-PRZEJSCIE-NA-SUCHO.md`. Czerwone na starcie
jest wynikiem poprawnym — to znaczy, że siatka łapie.

---

## Faza 1 — jedno przepisanie danych klienta na dokument

**Zamyka:** B1 (oferta bierze tylko nazwę), B2 (pusty e-mail na fakturze),
B4 (formularz leada), B5 (terminy oferty → umowa), B6 (projekt bez dat),
B3 (faktura nie wie o umowie).

Dziś każde przejście przepisuje dane po swojemu i każde gubi co innego.
Lead → oferta gubi adres i mail. Oferta → faktura gubi mail. Oferta → umowa
gubi termin. Umowa → projekt gubi daty.

Powstaje **jedno miejsce**, przez które przechodzi każde „załóż dokument
z czegoś", z jawną mapą pól. Kto dokłada nowy rodzaj dokumentu, dokłada wpis
do mapy — nie pisze przepisywania od nowa.

Dwie decyzje do podjęcia w fazie:

1. Czy dane klienta na dokumencie to **kopia** (dziś), czy **odczyt z karty
   klienta do momentu wysłania**. Kopia jest bezpieczniejsza prawnie, odczyt
   wygodniejszy. Skłaniam się do: odczyt do wysyłki, kopia od wysyłki — to
   naturalnie łączy się z Fazą 2.
2. Czy `contract_id` na fakturze uzupełniamy wstecz przy generowaniu umowy
   (tak — to jedna linia i usuwa „umowy — brak —").

**Sprawdzenie:** zdania z 0a o przenoszeniu danych przechodzą na zielono.

---

## Faza 2 — jedna bramka „czy to wolno wysłać"

**Zamyka:** A1 (mail z `[Twoje imię]`), A2 (dokument bez wystawcy + migawka),
A3 (adres sprzedawcy), A4 (sprzeczny termin z szablonu).

Dziś każde miejsce sprawdza co innego: oferta blokuje wysyłkę przy braku maila
**klienta**, ale nie przy braku **wystawcy**. Mail zamykający nie sprawdza nic.

Powstaje jedna funkcja odpowiadająca na pytanie „co jest nie tak z tym
dokumentem, zanim wyjdzie" i jedno miejsce w interfejsie, które to pokazuje.
Zwraca listę, nie `true/false` — bo część rzeczy to blokada (brak wystawcy),
a część ostrzeżenie (dwa różne terminy w jednym dokumencie).

Reguły na start:

- **blokada:** brak nazwy/NIP-u wystawcy; nawiasy `[…]` w treści maila; brak
  adresu odbiorcy na umowie
- **ostrzeżenie:** dwa różne terminy w dokumencie; brak sekcji w ofercie
  (panel już to mówi, ale nie przy wysyłce); projekt „W trakcie" w mailu
  mówiącym „zakończony"

Osobno, w tej samej fazie: **migawka obejmuje wystawcę.** Dziś to
`{items, offer, sections}`. Musi być `{…, wystawca}`, inaczej zmiana nazwy
firmy albo numeru konta zmienia wstecz każdy dokument, który klient wciąż może
otworzyć. To jedyne znalezisko z przejścia, które ma skutek prawny.

**Sprawdzenie:** próba wysłania dokumentu bez wystawcy kończy się odmową
**na trasie**, nie tylko w interfejsie (sonda `curl`, wzorem Audytu 1).

---

## Faza 3 — skutki zdarzenia, komplet — jako propozycje

**Zamyka:** C1 (opinia nie zamyka projektu), C2 (mail mówi „zakończony"),
C3 (wygrany lead zostawia przypomnienie), C4 (klient zostaje „Prospektem").

**Zasada, zatwierdzona: panel proponuje, właściciel zatwierdza.**

Dziś panel robi jedno i drugie niekonsekwentnie: lead przestawia się sam przy
akceptacji oferty, klient nie przestawia się nigdy. Ujednolicamy w stronę
propozycji.

### Gdzie mieszkają propozycje

**W istniejącym „Wymaga działania dziś"** — na Pulpicie i w module, którego
dotyczą. Nowego modułu nie robimy.

To świadomie **nie jest** „Skrzynka propozycji AI" z
`ai-propozycje-orchestrator-plan` — tamta jest odłożona na koniec i dotyczy
treści generowanych przez model. Tu nie ma modelu: to deterministyczne reguły,
dokładnie w duchu „Świadome decyzje produktowe" z `CLAUDE.md`. Jeśli kiedyś
powstanie tamta skrzynka, będzie można je połączyć — ale nie odwrotnie.

### Kształt propozycji

Jedno zdanie, jeden przycisk „zrób to", jeden „nie teraz". Przykłady:

| zdarzenie | propozycja |
|---|---|
| faktura opłacona | „Drukarnia Helios zapłaciła — przestawić klienta na Aktywny?" |
| klient przysłał opinię | „Opinia przyszła — zamknąć projekt jako Wdrożone?" |
| lead „Zamknięte - sukces" z żywym przypomnieniem | „Lead wygrany, ale ma zaplanowane demo na 5.08 — zdjąć przypomnienie?" |
| projekt „W trakcie", a mail mówi „zakończony" | blokada z Fazy 2, nie propozycja |

„Nie teraz" musi być trwałe — propozycja odrzucona nie wraca następnego dnia.
To jest różnica między pomocnym panelem a natrętnym.

**Sprawdzenie:** po przejściu testowej drogi na Pulpicie stoją dokładnie te
propozycje, których się spodziewamy — ani jednej więcej.

---

## Faza 4 — nieodwracalność i potwierdzenia

**Zamyka:** D1 (faktura bez potwierdzenia), D3 (modal nie blokuje tła),
D4 (brak „Zapisz" w Danych firmy).

Powstaje **jawna lista działań nieodwracalnych** i reguła: każde z nich pyta,
każde nie-nieodwracalne nie pyta. Dziś jest odwrotnie w najgorszym miejscu —
wystawienie faktury nadaje trwały numer w serii bez pytania, a „oznacz umowę
jako podpisaną" pyta.

Na liście na pewno: wystawienie faktury, wysłanie dokumentu do klienta,
unieważnienie linku, usunięcie czegokolwiek, wysyłka do KSeF.

---

## Faza 5 — wygląd

**Na koniec, zgodnie z ustaleniem.** Zebrane, żeby nie zginęły:

- `.glass` traci `backdrop-filter` w **zbudowanym** CSS (zostaje tylko
  `-webkit-`) → chrome bez rozmycia
- okna `useUI().confirm/prompt` renderują się poza `.admin-linear` i są
  **jasne** w ciemnym panelu
- wiersz „Daty" wychodzi poza kartę projektu (`x` 1030–1113 wobec karty do
  1102)
- nazwa kamienia milowego ucięta w pół słowa, bez wielokropka
- otwarty próg 24×24 w Katalogu (`CatalogDashboard.tsx`) — trzeci moduł
  z rzędu to odnotowuje, patrz `HANDOFF.md`

---

## Czego w tym planie NIE ma

- **Rejestracji firmy** i wszystkiego z `PO_REJESTRACJI.md` — to bramka
  nietechniczna, poza zakresem.
- **Nowych punktów użycia lokalnego LLM** — pięć zbudowanych wystarcza.
- **Skrzynki propozycji AI** — odłożona, patrz Faza 3.
- **Modułu 16** (wsparcie posprzedażowe) — do pierwszego klienta.
- **Przeprowadzki na NAS** poza etapem 1.
- Kafla „Przychód (ten miesiąc)" pokazującego brutto — **to decyzja
  produktowa właściciela, nie usterka.** Do rozstrzygnięcia osobno.

---

## Jak poznamy, że skończone

Jedno polecenie przechodzi całą drogę od leada do opinii, sprawdza dane po
każdym kroku i kończy się na zielono. Ekran *Zdrowie* na żywych danych nie
zgłasza żadnej niespójności. Dokument bez wystawcy nie wychodzi — i odmawia
tego trasa, nie interfejs.

Wtedy, i dopiero wtedy, zabieramy się za wygląd.
