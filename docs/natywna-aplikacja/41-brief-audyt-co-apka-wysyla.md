# Brief: audyt „apka wysyła, trasa nie czyta"

**Powstał:** 2026-08-05, zaraz po audycie `40-wynik-audyt-co-apka-wyrzuca.md`.
**Dotyczy repozytorium apki** (`../leggera-hub-ios`), commit bazowy `d5c40c6`.
**Panelu NIE ruszamy** — jeśli okaże się, że trzeba, powiedz właścicielowi
wprost, zanim cokolwiek zmienisz.

---

## Po co to

Poprzedni audyt sprawdził **odczyt**: co trasa oddaje, a apka wyrzuca do kosza.
Znalazł sześć luk. To jest **druga strona tej samej monety**: apka wysyła
w `POST`/`PATCH` pole, którego trasa nie czyta.

Objaw identyczny — **cisza**. Skutek gorszy: przy odczycie znika informacja,
tutaj znika **zapis**. Właściciel klika „Zapisz", dostaje `{"ok":true}`, wraca
na ekran i widzi swoją zmianę (bo apka zaktualizowała stan lokalnie), a w bazie
nie zmieniło się nic. Zobaczy to dopiero po odświeżeniu — albo, w gorszym
wariancie, dopiero u klienta.

---

## UWAGA: to prawdopodobnie będzie KRÓTKIE

**Nie zaczynaj od zera.** Przy pisaniu tego briefu sprawdziłem cztery
najbardziej ryzykowne miejsca — te, w których klucze idą **słownikiem**, więc
kompilator ich nie pilnuje. **Wszystkie cztery czyste:**

| co sprawdzone | wynik |
|---|---|
| `PATCH /api/clients/:id` (13 kluczy z `EdycjaKlientaView`) | wszystkie czytane |
| `PATCH /api/costs/:id` (8 kluczy + 3 powiązania) | wszystkie czytane (idą przez `czytajPolaKosztu`) |
| `PATCH /api/projects/:id` (`status`, `zdrowie`) | oba czytane |
| `PATCH /api/events/:id` (14 kluczy) | wszystkie czytane |

To nie znaczy „nie ma czego szukać" — znaczy, że **ta strona jest w lepszym
stanie niż strona odczytu** i cztery próby to za mało, żeby zamknąć temat, ale
dość, żeby nie planować na to całej sesji.

**Zacznij od tego, czego NIE sprawdziłem** (niżej), a gdy dwie–trzy rundy wyjdą
puste — **przestań i tak napisz**. Pusty wynik jest wynikiem; grzebanie na siłę
kończy się dokładaniem pól „bo pasują", a to dokładnie ten dług, który ten
projekt łapie regularnie.

---

## Zmierzony zakres

- **54** wywołania `POST`, **21** `PATCH` (`DELETE` nie ma ciała — poza zakresem)
- **43** inline `struct Body: Encodable` + **16** ładunków słownikowych
- Ryzyko jest **niesymetryczne**: `struct Body` ma nazwy pól wpisane raz i widać
  je w jednym miejscu; słownik (`["cos": …]`) nie jest przez nic sprawdzany
  i literówka w kluczu nie daje żadnego objawu. **Słowniki najpierw.**

---

## Metoda (trzy kroki na trasę)

1. **Co apka WYSYŁA.** Klucze z `struct Body`/słownika **plus miejsce
   wywołania** — słowniki bywają budowane w widoku, nie w `APIClient.swift`
   (tak jest przy koszcie i kliencie).
2. **Co trasa CZYTA.** Nie `grep` po nazwie pola w pliku — plik potrafi
   wspominać kolumnę w komentarzu albo w `SELECT`. Szukaj **odczytu z ciała
   żądania**: `"pole" in body`, `body.pole`, albo funkcji-bramki
   (`czytajPolaKosztu`, `czytajPolaKatalogu`), do której ciało wpada w całości.
3. **Różnicę oceń, nie zgłoś.** Klucz nieczytany przez trasę **nie zawsze jest
   usterką**: bywa, że apka wysyła komplet pól, z których część jest po prostu
   niezmieniona. Pytanie brzmi: **czy istnieje ekran, na którym właściciel może
   to pole zmienić i zobaczyć „zapisano"**. Jeśli tak — luka. Jeśli nie — wpis
   do wyniku z jednym zdaniem, żeby następny audyt nie liczył tego drugi raz.

### Czego szukać poza samymi kluczami

- **Klucz czytany, ale wartość cicho podmieniana.** To rodzina znalezisk
  z audytów Katalogu i Kosztów (`PATCH` był `PUT`-em i kasował nieprzysłane
  pola; śmieć w `vat_odliczenie_procent` wracał na wartość domyślną
  i odpowiadał `{"ok":true}`). Sprawdź, czy trasa odpowiada **400 z powodem**,
  a nie 200 z podmianą.
- **Częściowość, która nie jest częściowa.** Trasa, która przy `PATCH` jednego
  pola nadpisuje pozostałe wartościami domyślnymi. `costs` jest tu poprawny
  i ma na to test — sprawdź, czy inne też.
- **Typ.** Apka wysyła liczbę jako string (albo odwrotnie), trasa robi
  `Number(...)`, dostaje `NaN` i zapisuje `0`. Bez błędu.

---

## Kolejność

1. **Ładunki słownikowe, których jeszcze nie sprawdzono** — `zmienNotatke`,
   `zmienWiadomosc`, `zmienPrzypomnienie`, `zmienListePrzypomnien`,
   `zmienLeada`, `zapiszKomponent`/`dodajKomponent` (Katalog),
   `zapiszTrescOferty`, `zmienStatusOferty`/`zmienStatusUmowy`.
2. **`struct Body` przy rzeczach, które WYCHODZĄ DO KLIENTA** — wysyłki maili,
   zaproszenia `.ics`, prośba o opinię, kontakt nurture. Tam cichy zapis boli
   najbardziej, bo drugą stroną jest klient.
3. **Reszta `struct Body`.**

---

## Czego NIE robić

- **Nie „naprawiaj" panelu.** Jeśli trasa czegoś nie czyta, a powinna — to
  osobna decyzja i osobna sesja. Powiedz właścicielowi wprost.
- **Nie usuwaj pól z apki „bo trasa ich nie czyta"**, dopóki nie sprawdzisz
  kroku 3. Pole wysyłane „na zapas" bywa świadome (komplet pól powiązania —
  patrz `zastosujPowiazanie` przy koszcie i `zmienWydarzenie`: nowy wybór
  CZYŚCI pozostałe i to jest cel).
- **Nie przepisuj walidacji do Swifta.** Ostatnie słowo ma serwer.

---

## Sprawdzenie

Dowodem luki jest **stan w danych po zapisie z apki**, nie „klucz się nie
zgadza". Ścieżka: `npm run dev` + `npm run przejscie` w repo panelu, potem
zapis z symulatora i `curl` po rekord.

Gdy nie da się tego zrobić z ekranu (pole bez kontrolki), dowodem może być
`curl` powtarzający DOKŁADNIE to ciało, które wysyła apka — ale wtedy napisz
w wyniku, że to sonda, a nie przebieg przez apkę.

**Pułapki środowiska** (z poprzedniej sesji, oszczędzą godzinę):

- `LEGGERA_DEV_TOKEN=dev` + `LEGGERA_DEV_BACKEND=lokalny`, przez prefiks
  `SIMCTL_CHILD_`. Dev-bypass panelu sprawia, że lokalnie wystarczy dowolny
  token — `curl` na `/api/admin/login` jest potrzebny dopiero przy produkcji.
- **`xcrun simctl install` na działającą apkę wyrzuca ją do ekranu logowania.**
  Po każdej instalacji: `terminate`, chwila, `launch`.
- Nowy plik `.swift` w `LeggeraHub/` wymaga `xcodegen`; w `LeggeraHubCore/`
  **nie** (pakiet SPM zbiera źródła sam). Przed budowaniem
  `Skrypty/stempel-wersji.sh`.
- Dev-baza PGlite żyje w pamięci `next dev` — restart kasuje wszystko.

---

## Jeśli wyjdzie pusto (a może wyjść)

Napisz to wprost i **wykorzystaj resztę sesji na to**:

**Drugi rok obrotowy** — punkt (b) propozycji trzeciego przejścia z końca
`docs/PLAN-PO-DRUGIM-PRZEJSCIU.md`. Numeracja faktur przez zmianę roku,
retencja danych, faktury cykliczne przechodzące przez 31 grudnia. Da się to
zrobić w tym środowisku (harness `npm run przejscie` już umie budować scenariusze
i ma 101 sprawdzeń, do których to dołoży kolejne), w odróżnieniu od punktów (a)
i (c), które wymagają prawdziwej przeglądarki.

To jest robota po stronie **panelu**, nie apki — więc zapytaj właściciela, zanim
przełączysz repozytorium.

---

## Na koniec

Wynik do `docs/natywna-aplikacja/42-wynik-…` w repo panelu (**także gdy jest
pusty** — „sprawdzone, czysto" jest informacją, którą następny audyt musi
dostać), wpis w README apki **tylko jeśli wyjdzie z tego REGUŁA**, aktualizacja
`HANDOFF.md`. Commit i push **osobno dla obu repozytoriów**; sprawdź `git log`
w obu przed `git add`.
