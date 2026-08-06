# Etap 4 — przegląd wyglądu. Lista kontrolna dla właściciela

**Powstała:** 2026-08-06, po etapie 3. Etap 4 z `docs/PLAN-DOMKNIECIA.md`.

---

## Najpierw: zakres się ZMNIEJSZYŁ i to jest dobra wiadomość

Plan domknięcia zakładał, że cały etap 4 jest po Twojej stronie, bo „to
środowisko nie ma prawdziwej przeglądarki i nigdy nie będzie miało". **To
przestało być prawdą 2026-08-06**: podgląd renderuje panel, okno ma
1264×1243 px, animacje chodzą (zmierzone 64 klatki na sekundę), zrzuty ekranu
pokazują to, co widać.

Więc **część mierzalną zrobiłem sam** — jest niżej, razem z tym, co znalazła.
Tobie zostaje to, czego naprawdę nie da się zmierzyć: **wrażenie, papier
i prawdziwe urządzenia**.

---

## CZĘŚĆ A — co już zmierzyłem (nie sprawdzaj tego ponownie)

Ekrany: Pulpit, Leady, Klienci, Faktury, edytor Oferty. Okna: 1264 px
(desktop) i 390 px (szerokość iPhone'a).

| co sprawdzone | wynik |
|---|---|
| czy cokolwiek wychodzi poza ekran w poziomie (desktop) | **nic** — 0 elementów, brak poziomego paska przewijania |
| to samo przy oknie 390 px | **nic** — treść ma dokładnie 390 px, nic nie ucieka |
| czy główne CTA („Wyślij mailem") mieści się na wąskim oknie | **tak** — 316×36 px, nie zasłonięte |
| czy animacje w ogóle startują | **tak** (to było wcześniej niemierzalne) |
| czy panel się nie sypie w konsoli | bez błędów po ostatnich zmianach |

### Jedno znalezisko, i wymaga Twojej decyzji

**Kwadraciki zaznaczania wierszy mają 14×14 px, a reguła panelu mówi 24×24.**
Zmierzone: Klienci **37 sztuk**, Faktury **27**, Leady podobnie — plus dwa inne
rozmiary poniżej progu (`✕` 12×24 i ikonki filtrów 16×16).

Reguła „cel dotykowy 24×24" jest zapisana w `CLAUDE.md` i została w Fazie 5
ogłoszona jako domknięta — ale **zmierzono wtedy Katalog**, a Katalog nie ma
kwadracików zaznaczania. Klasyczne „poprawka wzorca stanęła tam, gdzie
przestano mierzyć".

W praktyce: myszą trafisz bez problemu, **palcem na iPadzie — nie zawsze**.
Nie ruszam tego bez Twojego słowa, bo to 100+ miejsc w panelu. **Decyzja: czy
poprawiam w etapie 5.**

---

## CZĘŚĆ B — co możesz sprawdzić tylko Ty

**Gdzie:** panel na `leggeralabs.pl/pl/admin` (świeżo wdrożony) — czyli
prawdziwa przeglądarka, prawdziwe dane, prawdziwy telefon i iPad.

**Jak zgłaszać:** jedno zdanie na sztukę, **z nazwą ekranu**. Nie musisz
diagnozować ani proponować rozwiązania — „na Fakturach przycisk Wystaw ucieka
w prawo, jak zawężę okno" wystarczy w zupełności. Zgłoszenia z etapu 4 wchodzą
partiami w etapie 5.

### B1. Pierwsze wrażenie (5 minut, nie analizuj)

Wejdź na Pulpit i przeklikaj po kolei: Leady → Klienci → Oferty → Faktury →
Projekty → Kalendarz.

- [ ] Czy coś **drga, przeskakuje albo doskakuje** przy wejściu na ekran?
      (Najczęstsza rzecz, która odbiera wrażenie „to jest dopieszczone".)
- [ ] Czy któryś ekran wygląda jak **z innej aplikacji** niż reszta?
- [ ] Czy gdziekolwiek **oczy nie wiedzą, gdzie patrzeć najpierw**?

### B2. Czy wiadomo, że coś się dzieje

- [ ] Po kliknięciu „Zapisz"/„Wyślij" — **po ilu sekundach** widać, że coś się
      stało? Czy w międzyczasie ekran wygląda jak zawieszony?
- [ ] Przy wolnym łączu (wyłącz Wi-Fi na telefonie i wejdź przez LTE) — czy
      widać **stan ładowania**, czy pustkę udającą „nic nie ma"?
- [ ] Czy komunikaty znikają **zanim zdążysz przeczytać**?

### B3. Wydruki — na PAPIERZE, nie tylko na ekranie

To jest część, której nie zmierzę nigdy, a jest najbardziej „na zewnątrz":
klient dostaje te dokumenty.

Wydrukuj **naprawdę** (albo zapisz do PDF i otwórz w czytniku):

- [ ] **Oferta** — czy pasek marki u góry i kwota są widoczne? Czy logo jest?
- [ ] **Faktura** — to samo, plus: czy tabela pozycji nie łamie się głupio
      między stronami?
- [ ] **Umowa** — czy rubryka podpisów wygląda poważnie? *(Wiadomo już o jednej
      rzeczy: „ZLECENIODAWCA / WYKONAWCA" stoi w jednej rubryce, a role są dwie
      — pozycja A5, czeka na Ciebie od pierwszego przejścia.)*
- [ ] **Wezwanie do zapłaty** — czy wygląda formalnie, czy jak notatka?
- [ ] Wydrukuj jedną rzecz **czarno-białą** — czy wszystko dalej czytelne?

### B4. Telefon i iPad (palcem, nie myszą)

- [ ] Czy da się **trafić palcem** w kwadraciki zaznaczania i małe ikonki?
      (Patrz znalezisko z części A — potwierdź albo zaprzecz z ręką na sprzęcie.)
- [ ] Czy coś **zasłania przycisk**, gdy klawiatura wyjedzie na ekran?
- [ ] Czy na iPadzie w pionie panel wygląda sensownie, czy tylko w poziomie?

### B5. Trzy konkretne rzeczy wiszące od pierwszego przejścia

Te trzy zostały opisane, ale **żadnej nie dało się rozstrzygnąć bez prawdziwego
okna**. Każda ma dokładny przepis:

1. **Escape przy otwartym kole daty.** Otwórz profil leada → kliknij pole daty
   („Przypomnij mi") tak, żeby otworzył się kalendarzyk → naciśnij Escape.
   **Pytanie: czy zamknął się TYLKO kalendarzyk, czy cały profil?**
   *(Poprawka weszła, ale nigdy nie została zobaczona.)*
2. **Menu „Wstaw z szablonu".** Otwórz ofertę → Pozycje → „Wstaw z szablonu" →
   wybierz szablon. **Pytanie: czy menu zamknęło się po wstawieniu, czy zasłania
   wiersze, które właśnie dodało?** *(Nie udało się tego powtórzyć — możliwe, że
   zgłoszenie dotyczyło innej kontrolki.)*
3. **Lista kanałów na checkboksie.** Profil leada → formularz „Nowy wpis" →
   rozwiń „Kanał". **Pytanie: czy lista zasłania wiersz „Oznacz jako dzisiejszy
   kontakt" i czy to naprawdę przeszkadza?** *(Zwykła lista rozwijana zasłania
   treść pod sobą — pytanie brzmi, czy w tym miejscu to boli.)*

### B6. Oczami klienta (najważniejsze, bo to widzi ktoś obcy)

Wyślij sobie ofertę na własny adres i otwórz link **na telefonie**:

- [ ] Czy strona oferty wygląda jak dokument od firmy, czy jak panel
      administracyjny?
- [ ] Czy przyciski „Akceptuję" / „Odrzucam" są **oczywiste**?
- [ ] To samo dla faktury i umowy (link do podpisu).

---

## Czego ta lista świadomie NIE obejmuje

- **Działania.** Trzy przejścia „na sucho" i siedem audytów sprawdzały, czy
  panel robi to, co ma robić. Tutaj chodzi wyłącznie o to, jak wygląda i jak się
  z tego korzysta.
- **Rzeczy zależnych od rejestracji firmy** (`PO_REJESTRACJI.md`) — nota prawna
  z prawdziwymi danymi, KSeF na produkcji. To nie są usterki wyglądu.
- **Apki iOS.** Ma własną historię przeglądów; ten etap dotyczy panelu.
