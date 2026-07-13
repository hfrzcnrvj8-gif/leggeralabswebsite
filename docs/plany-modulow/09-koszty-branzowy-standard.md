# Moduł 9 — Koszty jako branżowy standard (metoda płatności + inspiracje z liderów)

> Przeczytaj najpierw `docs/plany-modulow/README.md` (zasady wspólne) i `CLAUDE.md`.
> To NIE jest domknięcie luki z audytu 2026-07-13 — to nowa ambicja właściciela,
> zgłoszona przy okazji Modułu 8 (OCR): zrobić z modułu Koszty coś na poziomie
> najlepszych dostępnych narzędzi (Ramp, Expensify, QuickBooks, wFirma/ifirma),
> nie tylko "wystarczające". Zacznij od PRZECZYTANIA tego pliku w całości, potem
> zaproponuj plan i zapytaj o otwarte decyzje — jest ich więcej niż zwykle, bo
> zakres jest świadomie otwarty, nie z góry rozstrzygnięty.

## Stan faktyczny (moduł Koszty dziś — nie buduj od zera)

Moduł jest już dojrzały, zbudowany w kilku fazach:
- **Dane**: `lib/costs.ts` (`Cost` type), `lib/db.ts` (`ensureCostsSchema`) —
  dostawca+NIP, kategoria (`COST_CATEGORIES`), opis, data wydatku/płatności,
  netto/VAT/brutto (PLN, jedna stawka VAT na wpis — świadomy limit), status
  Nieopłacony/Opłacony, powiązanie z projektem, załącznik (skan/PDF, base64
  w wierszu, max 8MB), pochodzenie z KSeF (`ksef_numer`/`ksef_tryb`).
- **UI**: `CostsDashboard.tsx` (Kanban/tabela, filtry status/kategoria, statystyki
  miesiąca), `CostEditor.tsx` (modal edycji, wszystkie pola edytowalne inline).
- **Import z KSeF**: `app/api/costs/import-ksef` — automatyczny odczyt faktur
  zakupowych z trybu testowego (Faza 2/3, zob. `HUB_SETUP.md`).
- **Eksport**: `app/api/costs/export` — "Rejestr zakupów dla księgowej" (CSV).
- **OCR (Moduł 8, świeżo zbudowany i naprawiony 2026-07-14)**: `lib/costs-ocr.ts`
  + `app/api/costs/[id]/ocr` — jedno kliknięcie odczytuje ze zdjęcia/PDF-a:
  dostawcę, NIP, kwotę netto, stawkę VAT (dopasowaną MATEMATYCZNIE do kwoty
  brutto z dokumentu, nie zgadywaniem — `bestFitVatRate()`), datę wydatku,
  **termin płatności**, opis. Wszystko edytowalne przed zapisem, kontrolowany
  fallback gdy model niedostępny.
- **Czego NIE ma dziś**: metody płatności (jak zapłacono), żadnego "szybkiego
  przelewu"/linku do płatności, żadnej analityki wydatków (wykresy/trendy),
  wykrywania duplikatów, obsługi kosztów cyklicznych/subskrypcji (tabela
  `recurring_invoices` istnieje, ale WYŁĄCZNIE dla faktur sprzedażowych
  cyklicznych — nic analogicznego nie ma po stronie kosztów).

## Iskra pomysłu (dosłowny cytat właściciela, 2026-07-14)

> "chciałbym aby w module kosztów był jakiś odnośnik który by przenosił do
> płatności z wypełnionymi już wszystkimi danymi potrzebnymi do przelewu albo
> też żeby były plakietki jak ja to zapłaciłem, czyli przelew, PayPal, Apple
> Pay, gotówka, karta itp." + prośba o porównanie z najlepszymi aplikacjami.

## Co już sprawdzone (research z poprzedniego czatu — nie powtarzaj od zera)

- **wFirma/ifirma/Fakturownia** (polski rynek, najbliższy odpowiednik): mają
  przycisk "Zapłać" przy nieopłaconym wydatku, który generuje REALNĄ płatność
  przez zewnętrznego operatora (AutoPay/Blue Media) — pełna integracja z
  bramką płatności, wymaga umowy z operatorem, przenosi prawdziwe pieniądze.
  **To świadomie POZA zakresem** — Claude nie wykonuje operacji finansowych
  (patrz zasady bezpieczeństwa), a budowa takiej integracji to osobna, duża
  decyzja biznesowa (umowa z operatorem płatności), nie "dobudowanie funkcji".
- **Ramp / Expensify / QuickBooks** (rynek zachodni): NIE robią "kliknij i
  zapłać" dla zwykłych kosztów operacyjnych. Metoda płatności to prosta
  **etykieta/tag** na wydatku (karta firmowa / przelew / gotówka / inne) — do
  raportowania i uzgadniania z wyciągiem bankowym, nie do inicjowania
  płatności z poziomu appki.
- Źródła: [wfirma.pl — szybkie płatności za wydatki](https://pomoc.wfirma.pl/-szybkie-platnosci-za-wydatki),
  [Ramp — expense tracker for business](https://ramp.com/blog/expense-tracker-for-business),
  [FreshBooks — best expense trackers](https://www.freshbooks.com/hub/expenses/best-expense-trackers-for-small-business).

### Rekomendacja z poprzedniej rozmowy (do potwierdzenia/przedyskutowania na nowo, nie zakładaj z góry)
1. **Plakietki metody płatności** (przelew/karta/gotówka/BLIK/PayPal/Apple Pay)
   — nowe pole na koszcie + kolorowa etykieta wzorem istniejącego `StatusTag`.
2. **"Kopiuj dane do przelewu"** zamiast prawdziwego "kliknij i zapłać" —
   przycisk kopiujący numer konta/kwotę/tytuł do schowka (dane, które OCR już
   wyciąga albo można dodać do schematu), żeby nie przepisywać ręcznie do
   swojego banku. Zero integracji z bramką płatności, zero przenoszenia
   pieniędzy przez system — czysta wygoda kopiuj-wklej.

## Dodatkowe pomysły z rynku, nieprzedyskutowane jeszcze z właścicielem

Do zaproponowania i priorytetyzacji w nowym czacie — NIE zakładaj, że wszystkie
wchodzą w zakres, to surowy materiał do rozmowy, nie zatwierdzony plan:
- **Wykrywanie duplikatów** — teraz gdy OCR ułatwia szybkie dodawanie kosztów,
  rośnie ryzyko wpisania tej samej faktury dwa razy (np. przez pomyłkę albo
  bo i ręcznie, i przez KSeF). Prosta heurystyka: ten sam NIP + kwota + data
  w krótkim oknie → miękkie ostrzeżenie (zgodnie z zasadą "miękkie podpowiedzi,
  nigdy twarde bramki").
- **Koszty cykliczne/subskrypcje** — wiele kosztów to regularne abonamenty
  (dokładnie jak w przykładowej fakturze testowej modułu 8: TV+internet
  miesięcznie). Czy warto oznaczać koszt jako "cykliczny" i przypominać o nim
  w kolejnym miesiącu (analogicznie do `recurring_invoices`, ale dla kosztów)?
- **Analityka/trendy wydatków** — prosty wykres miesięczny per kategoria
  (Pulpit ma już zbiorcze liczby miesiąca, ale nie trend w czasie ani rozbicie
  na kategorie).
- **Szybsze dodawanie z telefonu** — zdjęcie paragonu bezpośrednio z aparatu
  (nie tylko wybór pliku) jako pierwszy krok, zanim OCR w ogóle wystartuje —
  ważne w kontekście Modułu 5 (mobilna aplikacja), ale można zrobić wcześniej
  bo koszty to jeden z najbardziej "mobile-first" przypadków użycia panelu.
- **Rozpoznawanie powtarzającego się dostawcy** — po NIP-ie z OCR, czy panel
  może podpowiedzieć kategorię/projekt na podstawie poprzednich kosztów tego
  samego dostawcy (deterministyczna reguła, zero AI — zgodnie z zasadami).

## Świadomie POZA zakresem (nie buduj bez wyraźnej, osobnej prośby)
- Prawdziwa integracja z bramką płatności ("kliknij i zapłać" jak wFirma) —
  operacja finansowa, osobna decyzja biznesowa.
- Wielowalutowość — koszty są świadomie tylko PLN (`lib/costs.ts`, komentarz
  na górze pliku).
- Cokolwiek wymagające zewnętrznego API/subskrypcji poza tym, co już jest
  (Ollama lokalnie, KSeF, VIES/MF).

## Jak podejść do tego czatu

1. Przeczytaj ten plik, `README.md`, `CLAUDE.md` — potem `HUB_SETUP.md` sekcje
   o Module 8 (OCR) i Fazie 2/3 (KSeF), żeby znać pełny aktualny stan kosztów.
2. Zaproponuj właścicielowi WŁASNY, przemyślany plan (nie musisz trzymać się
   dokładnie rekomendacji z poprzedniej rozmowy powyżej — to punkt wyjścia,
   nie ustalenie) — z podziałem na mniejsze kroki, bo "branżowy standard" to
   duży, wieloetapowy cel, nie jedna zmiana.
3. Zapytaj wprost o priorytety: co z listy "dodatkowych pomysłów" faktycznie
   go interesuje, zanim zaczniesz kodować — właściciel nie czyta kodu, każda
   decyzja produktowa wymaga pytania wprost (patrz `CLAUDE.md`).
4. Buduj przyrostowo, jedna spójna funkcja na raz, z weryfikacją (`tsc` +
   podgląd na dev) po każdej paczce zmian — nie jedna gigantyczna zmiana.

## Definicja ukończenia (tej PIERWSZEJ sesji w nowym czacie — nie całego modułu)
- Właściciel ma jasny, spisany (w rozmowie, ew. zaktualizowany ten plik) plan
  wieloetapowy dla "Koszty jako branżowy standard", z jego priorytetami.
- Przynajmniej pierwszy, uzgodniony krok (prawdopodobnie plakietki metody
  płatności i/lub kopiowanie danych do przelewu) zaimplementowany, `tsc`
  czysty, zweryfikowany na dev, `HUB_SETUP.md` zaktualizowany.

## Stan po pierwszej sesji (2026-07-14)

**Krok 1 zbudowany i zweryfikowany**: plakietki metody płatności
(przelew/karta/gotówka/BLIK/PayPal/Apple Pay) na koszcie + pole "Numer konta
dostawcy" + przycisk "Kopiuj dane do przelewu" (numer konta, kwota brutto,
tytuł → schowek). Zero integracji z bramką płatności. Szczegóły
implementacji: `HUB_SETUP.md` → sekcja "Moduł 9 — Koszty jako branżowy
standard".

## Stan po drugiej sesji (2026-07-14) — audyt zgodności prawnej

Właściciel poprosił o przegląd "co trzeba dodać, żeby moduł był zgodny z
przepisami i miał integrację z przyszłą księgowością" — patrz research w
`HUB_SETUP.md` → sekcja "Moduł 9", "Krok 2". Zbudowane i zweryfikowane:

- 🔴 Numer faktury dostawcy + data wpływu faktury (osobna od daty
  wystawienia) — brakujące pola do rejestru zakupów VAT/JPK.
- 🔴 Autouzupełnianie dostawcy po NIP z Białej Listy MF/VIES (jak w
  Fakturach) + weryfikacja numeru konta dostawcy przeciw Białej Liście.
- 🔴 % odliczenia VAT (100/50/0) + pole "VAT do odliczenia" — dla
  samochodów mieszanego użytku i reprezentacji.
- 🔴 Miękkie ostrzeżenie o progu amortyzacji (10 000 zł netto, kategoria
  Sprzęt).
- 🟢 Wykrywanie duplikatów (ten sam NIP+kwota+data, ±3 dni) — miękki baner
  z opcją wyciszenia.
- 🟢 Podpowiedź kategorii/projektu na podstawie historii tego samego
  dostawcy.
- 🟢 "Zrób zdjęcie" — drugi przycisk otwierający aparat wprost na telefonie.

**Świadomie NIE zrobione, bo firma jeszcze nie jest zarejestrowana i realne
generowanie/wysyłka JPK_VAT i tak zostaje po stronie księgowej (patrz
`PO_REJESTRACJI.md`)** — CSV do księgowej ma teraz komplet pól, których
potrzebuje jej oprogramowanie.

## Stan po trzeciej sesji (2026-07-14) — pełne domknięcie

Właściciel poprosił o realizację wszystkich czterech pomysłów z poprzedniej
rozmowy naraz ("wszystkie jeżeli dadzą realną wartość"). Zbudowane i
zweryfikowane na żywo na dev — szczegóły implementacji w `HUB_SETUP.md` →
sekcja "Moduł 9", "Krok 3":

1. Ostrzeżenie, gdy "Numer konta dostawcy" wygląda na konto własnej firmy.
2. OCR wyciąga też numer konta dostawcy z faktury (nie tylko dostawcę/NIP/
   kwoty/numer faktury jak dotąd).
3. Koszty cykliczne/subskrypcje — szablon generujący codziennie (przez ten
   sam raport co faktury cykliczne) nowy koszt-szkic, gdy nadejdzie termin.
4. Analityka/trendy wydatków — wykres słupkowy skumulowany, miesięczny per
   kategoria, z przełącznikiem 6/12 miesięcy, zbudowany wg zasad `dataviz`
   skill (zwalidowana paleta, hover-tooltip, legenda z liczbami).

**Moduł 9 (Koszty jako branżowy standard) jest tym samym kompletny** —
wszystkie pomysły z pierwotnego researchu (fundamenty zgodności prawnej,
ostrzeżenia podatkowe, dobre praktyki rynkowe, integracja z Białą Listą/
OCR/ustawieniami firmy) zostały zbudowane. Jedyny niezweryfikowany na żywo
element: rzeczywiste zadziałanie `generateDueRecurringCosts()` przez
codzienny cron (`POST /api/leads/notify`) — blokowane w dev brakiem
`RESEND_API_KEY` (to samo dotyczy już istniejącej generacji faktur
cyklicznych), do potwierdzenia przy najbliższym uruchomieniu na produkcji.

Dalsze pomysły wymagałyby nowego, osobnego researchu/rozmowy z właścicielem
— nic nie zostało świadomie odłożone z bieżącego zakresu.
