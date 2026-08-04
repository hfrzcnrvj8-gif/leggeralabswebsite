# Prompt do wklejenia w nowym czacie — drugie przejście „na sucho"

**Plik tymczasowy.** Wklej treść poniżej (od linii `---` w dół) jako pierwszą
wiadomość w nowym czacie, po czym skasuj ten plik przy najbliższym commicie.

**Czat otwierasz w repo PANELU** (`poltechnickx-website`).

---

Robimy **drugie przejście „na sucho"** przez panel — ścieżką, na której
wszystko idzie nie tak.

Plan jest gotowy: **`docs/DRUGIE-PRZEJSCIE-PLAN.md`**. Przeczytaj go w całości,
zanim cokolwiek klikniesz — jest krótki, a sekcja „Metoda" jest w nim
ważniejsza niż lista kroków.

Poza tym przeczytaj:
- `CLAUDE.md` — zasady pracy i pułapki środowiska
- `docs/PIERWSZE-PRZEJSCIE-NA-SUCHO.md` — jak wyglądał wynik poprzednim razem
  (to jest wzór formy, nie lista do sprawdzenia; pozycje z niego są zamknięte)

**Nie czytaj kodu modułów, zanim ich nie wyklikasz.** To nie jest kaprys:
wartość przejścia bierze się z tego, co Cię zaskoczy, a kto przed chwilą był
w środku pliku, nie da się już zaskoczyć. Kod czytaj dopiero wtedy, gdy coś
zobaczysz i chcesz ustalić przyczynę.

## Punkt startu

Panel: ostatni commit `7b56eb7` „Sekcja F: sześć drobiazgów naprawionych…".
Repo czyste i wypchnięte, `tsc` czysto, `npm test` 281/281,
`npm run przejscie` **68 działa · 0 regresji**.
Jeśli `git log` pokazuje co innego — sprawdź, kto pracował po drodze, ZANIM
cokolwiek dodasz do indeksu (równoległa sesja już raz wchłonęła cudze zmiany).

Środowisko: `npm run dev`, dev-baza PGlite (restart serwera = czysta baza),
dev-login bez hasła. Wszystko lokalne — nic nie idzie do prawdziwego klienta.

## Co robimy

Jedna historia wymyślonego klienta, przechodzona palcem od początku do końca:

lead → oferta → **klient odrzuca** → nowa wersja oferty → akceptacja → umowa →
**aneks** → projekt **zagrożony**, potem **zerwany** → faktura → **brak
zapłaty** → przypomnienie → **wezwanie**.

Droga, która się UDAJE, jest już pilnowana automatem (`npm run przejscie`) —
nie powtarzaj jej. Chodzi wyłącznie o to, czego nikt nigdy nie przeszedł.

## Trzy rzeczy, o których łatwo zapomnieć

1. **Niczego nie naprawiaj po drodze.** To jest lista, nie zestaw poprawek.
   Poprawka w trakcie psuje resztę obserwacji.
2. **Otwieraj to, co dostaje klient** — maile i dokumenty odrzucenia, nowej
   wersji, aneksu i wezwania. Najpoważniejsze znalezisko pierwszego przejścia
   wyszło tylko dlatego, że ktoś przeczytał wysłaną wiadomość.
3. **Zapisuj osobno: zepsute / tarcie / brak.** W sekcji F „brak funkcji" przez
   tydzień udawał drobiazg.

## Na koniec

Zapisz wynik jako **`docs/DRUGIE-PRZEJSCIE-NA-SUCHO.md`** w formie pierwszego
przejścia: co przeszło, co nie, każde znalezisko z dowodem (co zobaczyłeś, co
jest w bazie), pogrupowane. **Nie proponuj planu naprawczego w tym samym
czacie** — najpierw chcę zobaczyć samą listę.

Podaj mi też polecenia do commita i pusha oraz skasuj ten plik promptu
(`PROMPT-DRUGIE-PRZEJSCIE.md`), tak jak robiliśmy z poprzednimi.

## Jak pracujemy

Nie jestem programistą — jeśli coś wymaga decyzji nietechnicznej, pytaj wprost.
