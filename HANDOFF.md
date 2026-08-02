# Handoff — stan na 2026-08-02, po domknięciu tabeli Modułu 59

Plik tymczasowy: wklej jako pierwszą wiadomość w nowym czacie. Pamięć Claude ma
to samo zapisane na trwałe. Pełny opis funkcjonalności: `HUB_SETUP.md` /
`LEADS_SETUP.md`; zasady pracy: `CLAUDE.md`; pułapki środowiska: `CLAUDE.md` →
„Znane pułapki tego środowiska".

## Punkt startu

- Panel: `e441246` „Audyt Kalkulatora i Kalendarza…"
- Apka: `c48ee6b` „Kalendarz: haptyka przy gardłach…" (wydanie 181)
- Oba repozytoria czyste i wypchnięte. `tsc` czysto, `npm test` **209/209**.

Jeśli `git log` pokazuje co innego — ktoś pracował po drodze, sprawdź co
(`git log` PRZED `git add`; równoległa sesja już raz wchłonęła cudze zmiany).

## Co się właśnie zamknęło — i to jest większe niż jeden moduł

**Cała lista kontrolna Modułu 59 jest wypełniona**: piętnaście modułów, dziesięć
kategorii, trzynaście rund audytu od 25 lipca do 2 sierpnia. Wcześniej zamknęły
się audyty końcowe 1–7 (`docs/AUDYTY-KONCOWE.md`) i wszystkie moduły panelu poza
jednym świadomie odłożonym. **Nie ma dziś otwartej listy audytowej.**

Rachunek tej listy jako narzędzia (pełny w `docs/plany-modulow/59-spojnosc-ui.md`
→ „Domknięcie tabeli"): **34 pozycje wskazane jako ≠ ✅ → 22 nieaktualne,
12 realnych, co najmniej 13 znalezisk przyszło SPOZA dziesięciu kategorii.**
Autoryzacja przez osiem rund: ~100 uchwytów HTTP, zero znalezisk. Walidacja
wejścia: kilkadziesiąt.

Trzy wnioski, które warto przenieść do każdej nowej pracy:

1. **Nie wypełniaj kolumn oceny z kodu.** Wpis bez pomiaru myli w obie strony,
   a „✅" usypia mocniej niż „❌": trzy z czterech najcięższych znalezisk
   ostatniej rundy siedziały w polach oznaczonych na zielono.
2. **Dołóż kategorię „co trasa robi ze śmieciem".** Trzy rodziny: cicha
   PODMIANA (śmieć → wartość domyślna, `{"ok":true}`), cicha ODMOWA (warunek
   w `WHERE`, `UPDATE` nie zmienia nic, trasa mówi „zapisano"), brak 404 przy
   `DELETE`/`PATCH` nieistniejącego. Kwadrans sondy `curl` per uchwyt HTTP
   znajduje więcej niż cała reszta listy.
3. **Poprawka przekrojem = przejście tabeli tego samego dnia.** Cały dług
   nieaktualnych wskazań wziął się z paczek A–G, które naprawiały piętnaście
   modułów naraz, a wiersze zostały z datą sprzed naprawy.

## Co zostaje otwarte — pięć rzeczy, w kolejności realności

### 1. Rejestracja firmy (nietechniczne, po stronie właściciela) — BRAMKA
`PO_REJESTRACJI.md`, osiemnaście punktów. Blokuje: przełączenie KSeF test →
produkcja, prawdziwe dane w nocie prawnej i umowach, plan Vercel Pro (Hobby
zabrania użytku komercyjnego), przeprowadzkę na NAS. **Nic z tej listy nie jest
brakiem do naprawienia przed rejestracją** — to świadomie odłożone.

### 2. Dwa wiersze tabeli, których nikt nie zmierzył ponownie
Oferty i Umowy noszą ⚠️ przy **Kolorze** i **Gestach** z 28.07, choć oba
przeszły własne audyty 26 i 27 lipca. Cztery pola, prawdopodobnie nieaktualne —
ale to zakład, nie pomiar. **Godzina pracy, zamyka tabelę naprawdę do końca.**

### 3. Ikony 15×15 w Katalogu — trzeci moduł to odnotowuje
`CatalogDashboard.tsx`, zmierzone w Module 66, powtórzone przy Notatniku
i teraz. Nadal nietknięte, bo za każdym razem to zakres poza audytowanym
modułem. **Do rozstrzygnięcia: czy przejść progiem 24×24 (WCAG 2.5.8) przez cały
panel jedną przemyślaną rundą.** Nie rób tego przy okazji czegoś innego.

### 4. Moduł 54 — ostatni krok czeka na NAS
Zostały „pliki klienta na NAS-ie". Reszta programu zrobiona (rytm kontaktu,
szukanie po treści, sufity, osoby kontaktowe, układ boczny profilu).
Zablokowane przez Moduł 55, ten przez rejestrację.

### 5. Rzeczy czekające na ruch właściciela, nie na kod
- **`CEIDG_TOKEN` w Vercelu** — bez niego Łowca leadów (Moduł 52) nie ma skąd
  brać kandydatów. Konto Biznes.gov.pl → `dane.biznes.gov.pl` → klucz mailem.
- **Włączenie 2FA na produkcji** — silnik gotowy od Modułu 41, włączenie to
  ruch właściciela. Drogi powrotu: papierowe kody zapasowe + ten sam sekret na
  drugim urządzeniu (NIE „wyłącznik w Vercelu").
- **Sprawdzenie apki na urządzeniu** — ostatnie wydania weryfikowane
  kompilacją i zgodnością ze wzorcem; haptyki i skrótów ⌘F/⌘N nie da się
  potwierdzić w symulatorze.

## Czego NIE zaczynać bez wyraźnej prośby

- **Orchestrator propozycji AI** („Skrzynka propozycji AI" na Pulpicie) —
  świadomie odłożony na koniec.
- **Nowy punkt użycia lokalnego LLM** poza pięcioma zbudowanymi (szkic maila,
  odczyt paragonu, kategoria kosztu, podsumowanie wątku, szkic notatki).
- **Moduł 16 — wsparcie posprzedażowe.** Odłożony do realnej potrzeby, czyli
  do pierwszego klienta.
- **Przeprowadzka na NAS (Moduł 55)** poza etapem 1.
- Wszystko z sekcji „Świadome decyzje produktowe" w `CLAUDE.md`.

## Uczciwa etykieta stanu

**Kompletny funkcjonalnie, przeaudytowany, nieużywany produkcyjnie.** Panel ma
piętnaście modułów, apka trzynaście ekranów i parytet z panelem na poziomie 1–2,
siedem audytów końcowych i piętnaście audytów modułowych za sobą. Czego nie ma:
ani jednego prawdziwego klienta, ani jednego dnia pracy pod obciążeniem, ani
jednej faktury wystawionej naprawdę. **Następny krok, który realnie zmienia
stan, jest nietechniczny: rejestracja działalności.**

## Propozycja na nowy czat (do wyboru przez właściciela)

| co | rozmiar | dlaczego akurat to |
|---|---|---|
| Zmierzyć cztery pola Ofert i Umów | godzina | zamyka tabelę bez zakładów |
| Próg 24×24 przez cały panel | pół dnia | trzeci moduł z rzędu to odnotowuje |
| Przejść `PO_REJESTRACJI.md` punkt po punkcie i przygotować wszystko, co da się bez wpisu do CEIDG | pół dnia | skraca drogę po rejestracji |
| Pierwsza sesja „na sucho": przeprowadzić wymyślonego klienta od leada do zapłaconej faktury i zapisać, co uwiera | dzień | jedyny brakujący rodzaj dowodu — UŻYCIE, nie pomiar |
