# Wynik: trzecie przejście — awarie i brzegi

**Wykonane:** 2026-08-05, zaraz po „drugim roku obrotowym".
**Zakres:** panel. Apki nie ruszano.
Punkt (c) trzeciego przejścia z `PLAN-PO-DRUGIM-PRZEJSCIU.md`.

**Jedno znalezisko, cztery miejsca czyste, jedno niesprawdzalne w tym
środowisku.**

---

## Po co to było

Oba wcześniejsze przejścia szły ścieżką grzeczną: jedno kliknięcie, jedna
karta, wszystko po kolei. Prawdziwe podwójne kliknięcie rzadko bierze się
z niecierpliwości — bierze się z **zerwanego żądania**: telefon ma krótszy
limit czasu niż trasa, więc pokazuje błąd tam, gdzie serwer widzi sukces,
a właściciel klika drugi raz.

---

## Znalezisko: zdublowana wpłata znikała po cichu

**Dwa równoległe kliknięcia „Zarejestruj wpłatę" zapisują dwie wpłaty.**
Zmierzone: `2460,00 zł wpłat na fakturze wartej 1230,00 zł`.

Dlaczego to groźniejsze, niż wygląda: faktura pokazuje wtedy **„Opłacona"** —
i to jest prawda. Nie ma żadnego powodu, żeby do niej wracać. Nadpłata żyje
dalej wyłącznie w statystykach przychodu, zawyżając je o kwotę, której klient
nigdy nie zapłacił. Kontrola spójności nie znała wpłat w ogóle, więc nie
zgłaszała tego nic.

### Dlaczego naprawa NIE jest barierą przy zapisie

Kuszące byłoby dołożyć bezpiecznik odcisku, taki jak przy poczcie
(`lib/mailGuard.ts`). Byłby to błąd, i to podwójny:

1. **Reguła Fazy 4 mówi wprost: co odwracalne, nie pyta.** Wpłatę da się
   usunąć — także z telefonu (A9). Bariera przy odwracalnym działaniu uczy
   klikać „tak" bez czytania i psuje te bariery, które naprawdę mają znaczenie.
2. **Komentarz w samym `mailGuard.ts` uzasadnia, czemu bezpiecznik jest
   TYLKO przy poczcie:** *„reszta panelu przy podwójnym kliknięciu robi
   zdublowany wiersz — do skasowania. Tu skutkiem jest wiadomość u klienta,
   której nie da się cofnąć."* Rozciągnięcie go na wpłaty przewróciłoby
   rozstrzygnięcie, którego nikt nie cofnął.

Problemem nie było więc to, że dubel POWSTAJE, tylko to, że **nikt się o nim
nie dowiaduje**. Naprawa idzie dokładnie w to miejsce: czternasta reguła
kontroli spójności (`lib/spojnosc.ts`, ekran *Zdrowie systemu*):

> **Suma zarejestrowanych wpłat nie przekracza kwoty faktury**
> → `faktura FV 94/2026 — wpłacono 2460,00 zł przy należności 1230,00 zł`

Zapis zostaje wolny, skutek przestaje być niewidoczny. Reguła pomija faktury
anulowane i rozliczeniowe (te mają własny próg — zaliczka jest płacona osobno),
i toleruje 1 grosz różnicy: brutto liczy się z zaokrągleniem per pozycja, więc
bez tego progu krzyczałaby na poprawnie opłacone faktury.

---

## Cztery miejsca sprawdzone i CZYSTE

| brzeg | wynik |
|---|---|
| dwa równoległe „Akceptuj ofertę" | jedna akceptacja, jeden projekt, jedna faktura |
| dwa równoległe podpisy umowy (panel i link klienta) | jeden podpis, drugi odbija się 409 |
| dwa równoległe „Wystaw fakturę" | jeden numer, numeracja ciągła (93, 94, 95 — bez dziury) |
| brak `RESEND_API_KEY` | rzuca wyjątek z czytelnym komunikatem; w dev wypisuje maila do konsoli — **nie udaje sukcesu** |

Wzorzec, który ratuje trzy pierwsze, jest wszędzie ten sam: **warunkowy
`UPDATE ... WHERE ... AND <stan jeszcze nie zajęty>` plus sprawdzenie, ile
wierszy wróciło.** Przy akceptacji oferty dochodzi do tego `ROLLBACK` całej
transakcji, więc przegrany wyścig nie zostawia sieroty po projekcie.

Przy wystawianiu faktury zapis **nie** jest warunkowy (`WHERE id = ...`), ale
dziury w numeracji **nie udało się wywołać**: oba żądania liczą ten sam kolejny
numer i zapisują tę samą wartość. Świadomie nie „naprawiono tego na wszelki
wypadek" — dowodem usterki jest stan w danych, a tu stan jest poprawny.
Odnotowane, żeby następny audyt nie liczył tego trzeci raz.

---

## Czego NIE dało się sprawdzić

**Zerwane żądanie w połowie wysyłki maila** — czyli dokładnie ten scenariusz,
dla którego powstał bezpiecznik odcisku. Wysyłka wymaga skonfigurowanej
skrzynki IMAP/SMTP, a dev jej nie ma (`isMailboxConfigured()` odmawia, zanim
cokolwiek poleci). Sam bezpiecznik jest przeczytany i wygląda poprawnie —
`INSERT ... ON CONFLICT DO NOTHING` na odcisku treści, ze zwolnieniem bramki po
nieudanej próbie — ale **to jest lektura, nie przebieg**. Do sprawdzenia
wtedy, gdy będzie prawdziwa skrzynka.

---

## Trwały dorobek

- **2 nowe zdania w harnessie** — `npm run przejscie` **111 działa · 0 regresji**
  (było 109), krok „Brzegi: dwa kliknięcia naraz".
- **1 nowa reguła kontroli spójności** (czternasta) — widoczna na ekranie
  *Zdrowie systemu*.
- Zdanie o wpłacie sprawdzone kontrolnie: po podniesieniu progu reguły tak, by
  przestała łapać, przejście pada. **Trzy przebiegi pod rząd dają ten sam
  wynik** — zdania nie migoczą.

---

## Dwie lekcje warsztatowe

**1. Zdanie testowe było za wąskie i migotało.** Pierwsza wersja sprawdzenia
akceptacji wymagała, żeby drugie żądanie wróciło z **409**. Raz przechodziło,
raz nie — bo ochrona ma DWIE drogi i obie są poprawne: gdy drugie żądanie czyta
ofertę już zaakceptowaną, odmawia bramka stanu (400); gdy czyta ją wcześniej,
odmawia warunkowy claim w transakcji (409). Znaczenie ma to, **ile razy się
udało**, nie którą drogą odbiło się to drugie. Zdanie, które przypadkiem opisuje
jedną z dwóch poprawnych ścieżek, wygląda jak wykryta regresja — i kosztuje
czas dokładnie wtedy, gdy nic nie jest zepsute.

**2. Środowisko potrafi zwracać 404 z tras, których nikt nie dotykał** — drugi
raz tego samego dnia. Objaw: `POST /api/invoices/:id/issue` → 404 (strona HTML,
nie JSON), przy działającym `GET /api/invoices/:id`, czystym `tsc` i pliku
obecnym w gicie. To uszkodzony cache Turbopacka; lekarstwo to `rm -rf .next`
i restart. Zanotowane w `HANDOFF.md`, bo za pierwszym razem wygląda dokładnie
jak własny błąd w świeżo zmienionym pliku.
