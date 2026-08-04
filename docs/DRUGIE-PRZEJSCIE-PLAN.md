# Drugie przejście „na sucho" — droga, na której wszystko idzie nie tak

**Plan, nie wynik.** Wynik zapisze sesja, która to przejdzie, jako
`docs/DRUGIE-PRZEJSCIE-NA-SUCHO.md` — wzorem
`docs/PIERWSZE-PRZEJSCIE-NA-SUCHO.md`.

Spisany 2026-08-04, po zamknięciu sekcji F pierwszego przejścia.

---

## Po co drugie przejście

Pierwsze (2026-08-02) przeszło drogę **która się udaje**: lead → oferta →
akceptacja → umowa → projekt → faktura → zapłata → opinia. Dało trzydzieści
kilka znalezisk, z których wyrósł cały plan zaplecza (`docs/PLAN-ZAPLECZE.md`)
i sekcja F.

Ta droga jest dziś **pilnowana automatem** — `npm run przejscie` przechodzi ją
przy każdej zmianie (68 sprawdzeń). Nie ma sensu robić jej drugi raz ręcznie.

Czego nikt nie przeszedł **ani razu, palcem, od początku do końca**: drogi,
na której coś się nie udaje. A to jest ta droga, którą realny klient przejdzie
prędzej czy później — i w niej mieszka cała obsługa wyjątków, której nikt nie
oglądał.

## Ścieżka (jedna narracja, nie lista przypadków)

Wymyśl klienta i **trzymaj się jednej historii** — pierwsze przejście udało się
dlatego, że było opowieścią, a nie odhaczaniem funkcji.

| # | krok | co się psuje |
|---|---|---|
| 1 | lead z jakiegoś źródła, kontakt, rozmowa | — |
| 2 | oferta, wysyłka | — |
| 3 | **klient ODRZUCA** (z powodem z listy) | lejek kończy się porażką |
| 4 | **nowa wersja oferty** (`/version`), wysyłka, akceptacja | poprzednia ma zostać oznaczona jako zastąpiona |
| 5 | umowa z zaakceptowanej oferty, podpis | — |
| 6 | **aneks** do podpisanej umowy (`/aneks`) — zmiana zakresu w trakcie | co się dzieje z „było/jest" |
| 7 | projekt: zdrowie na **Zagrożony**, potem **Zerwany** | dwie osie naraz: status i zdrowie |
| 8 | faktura, wysyłka | — |
| 9 | **termin mija, klient nie płaci** | — |
| 10 | przypomnienie (poziom 1–2), potem **wezwanie** (poziom 3) | eskalacja nie cofa się w dół |

Kroki 3, 4, 6, 7 i 10 to **jedyne** miejsca, których nie dotyka ani
`npm run przejscie`, ani pierwsze przejście.

## Metoda — to jest ważniejsze niż lista kroków

1. **Idź jak użytkownik, nie jak autor.** Nie czytaj kodu modułu, zanim go nie
   wyklikasz. Wartość przejścia bierze się z tego, co Cię ZASKOCZY; kto przed
   chwilą był w środku pliku, nie da się już zaskoczyć. (Dlatego to osobny
   czat — patrz sekcja F, gdzie ten efekt było widać.)
2. **Niczego nie naprawiaj po drodze.** Pierwsze przejście miało w nagłówku
   „nic nie zostało naprawione" i to była dobra decyzja: poprawka w trakcie
   psuje resztę obserwacji i kończy się przejściem w połowie.
3. **Zapisuj trzy różne rzeczy osobno**, bo mieszają się w jedno „nie działa":
   - **zepsute** — panel robi coś nieprawdziwego albo nie robi nic,
   - **tarcie** — działa, ale musiałeś zgadywać, cofać się albo czegoś szukać,
   - **brak** — nie ma jak czegoś zrobić (w sekcji F taki brak przez tydzień
     udawał drobiazg: „rozmowa nie trafia do Kalendarza" to był brak funkcji).
4. **Sprawdzaj, CO ZOBACZY KLIENT.** Najpoważniejsze znalezisko pierwszego
   przejścia (A1 — mail z niewypełnionym `[Twoje imię]`) wyszło tylko dlatego,
   że ktoś otworzył wysłaną wiadomość. Otwieraj każdy dokument i każdy mail
   z tej ścieżki: odrzucenie, nowa wersja, aneks, wezwanie.
5. **Zaglądaj do bazy przy każdym „to chyba się zapisało".** Pierwsze przejście
   znalazło w ten sposób B3 (faktura nie wie o umowie) i A2 (migawka nie
   obejmuje wystawcy) — obu nie widać z ekranu.
6. **Notuj też to, co zadziałało.** Bez tego wynik czyta się jak lista awarii
   systemu, który w większości działa, i przestaje być wiarygodny.

## Na co patrzeć szczególnie (hipotezy, NIE znaleziska)

Zapisane, żeby nie umknęły — ale **nie zakładaj, że są prawdziwe**. W sekcji F
trzy z dziewięciu zgłoszeń myliły się co do miejsca albo nie reprodukowały się
wcale.

- **Odrzucenie i wezwanie to jedyne dwie rzeczy, które klient dostaje w złym
  nastroju.** Jak brzmią te maile? Kto się pod nimi podpisuje?
- **Nowa wersja oferty** — czy stary link klienta faktycznie przestaje
  prowadzić do nieaktualnej treści (Moduł 40 unieważnia linki)? Czy klient
  z zakładką w przeglądarce zobaczy komunikat, czy starą ofertę?
- **Aneks** — czy „było/jest" bierze warunki z umowy OBOWIĄZUJĄCEJ, czy
  z pierwotnej? Przy drugim aneksie to się rozjeżdża najłatwiej.
- **Projekt „Zerwany"** — co się dzieje z wystawioną fakturą, kamieniami,
  kontaktem kontrolnym i propozycjami? Czy panel proponuje cokolwiek, czy
  milczy?
- **Eskalacja faktury** — poziom nie cofa się w dół. Czy widać, na którym się
  jest, ZANIM się kliknie? Czy da się wysłać wezwanie przez pomyłkę?
- **Czy „Zdrowie" i propozycje w ogóle się odzywają** na tej ścieżce. Oba
  narzędzia sprawdzają dane, więc porażka jest dla nich tak samo widoczna jak
  sukces — albo nie jest, i to jest znalezisko.

## Czego NIE robić

- Nie powtarzaj drogi sukcesu — pilnuje jej `npm run przejscie`.
- Nie dopisuj sprawdzeń do `przejscie.ts` w trakcie chodzenia. To robota
  PO przejściu, na podstawie wyniku (tak powstał harness po pierwszym razie).
- Nie zaczynaj od refaktoru „przy okazji".
- Nie traktuj tego planu jako listy do odhaczenia. Jeśli historia poprowadzi
  gdzie indziej — idź za nią i zapisz, dlaczego.

## Zastrzeżenie o środowisku

Podgląd przeglądarki bywa kartą **ukrytą 0×0** — wtedy panel renderuje wariant
mobilny, `window.innerHeight` wynosi 0 i pozycjonowanie menu liczy się źle.
Znaleziska przepływowe i danych łapie się mimo to bez problemu; **wizualne
trzeba wtedy odłożyć**, a nie zgadywać. Sprawdzaj `visibilityState` razem
z `innerWidth` w tym samym odczycie. Szczegóły: `CLAUDE.md` → „Znane pułapki".
