# Prompt — dwa ostatnie wiersze listy kontrolnej (Kalkulator, Kalendarz)

## ZACZNIJ OD TEGO — to jest domknięcie, nie kolejny pełny audyt

Po Notatniku w tabeli Modułu 59 zostały **dwa wiersze**. Oba są małe, ale
z zupełnie różnych powodów, i **jeden z nich prawdopodobnie nie wymaga pracy,
tylko poprawienia tabeli**. Nie planuj tej sesji jak siedmiu poprzednich.

Osiem audytów pod rząd ustawiło rytm, którego trzymaj się dalej:

- **Sonda 401 nigdy nic nie znajduje** (8/8 modułów czysto, ostatnio 13/13
  uchwytów Notatnika). Puszczaj ją mimo to — kwadrans i masz dowód zamiast
  założenia — ale nie planuj wokół niej dnia.
- **Realne znaleziska to trzy rodziny.** (1) Cicha PODMIANA: trasa bierze
  śmieć, podstawia wartość domyślną, odpowiada `{"ok":true}`. (2) Cicha
  ODMOWA: warunek siedzi w `WHERE`, `UPDATE` nie zmienia nic, trasa mówi
  „zapisano". (3) Brak wzorca w ogóle — moduł czysty, a robotą jest coś,
  czego w tabeli nie było.
- **Inwentarz mylił się SIEDEM razy z rzędu, w obie strony.** Przy Notatniku
  najmocniej: dwa wpisy nieaktualne, pięć realnych, w tym **dwa spoza tabeli**
  (Klikalność i Gesty stały na ✅, a były 6×17 px i zero menu). Żaden kierunek
  nie jest domyślny — mierz każdą pozycję osobno.

## Punkt startu — zmierzone 2026-08-02, po audycie Notatnika

`git log` ma pokazać **`c9d0344`** (panel — „Audyt Notatnika…") i **`8105a57`**
(apka — „Notatnik: haptyka przy gardłach…"). Jeśli nie — ktoś pracował po
drodze, sprawdź co (`git log` PRZED `git add`; równoległa sesja już raz
wchłonęła cudze zmiany).

### Wiersz „Kalendarz" — NAJPIERW ROZSTRZYGNIJ, CZY TO W OGÓLE PRACA

Tabela mówi `Klawiatura ❌`, a lista „gdzie mieszka wzorzec" pisze przy
Kalendarzu **„nic (świadomie zostaje bez `/` i `j/k`)"**.

**Słowo „nic" jest NIEPRAWDZIWE — zmierzone gretem 2026-08-02.**
`CalendarView.tsx:814-819` ma własny słownik klawiszy: `←`/`→` (poprzedni
i następny okres), `t` (dziś), `1`/`2`/`3` (miesiąc/tydzień/dzień). To jest
**słownik modułowy**, dokładnie ta kategoria, którą `klawiatura.ts` świadomie
zostawia modułom („cyfry statusu w Leadach, `r`/`f`/`e` w Poczcie").

Czyli sprawa wygląda tak: brak `/` i `j/k` jest uzasadniony (siatka dni nie ma
liniowej listy wierszy, po której miałby chodzić kursor, a `/` bez pola
szukania byłoby martwym skrótem — reguła z paczki C: „martwy skrót jest tym
samym, co martwy przycisk"). **Zweryfikuj to dyspozycją zdarzeń** (`←`, `→`,
`t`, `1`/`2`/`3` — sprawdzaj `defaultPrevented`, nie wygląd) i jeśli się
potwierdzi, **wiersz wymaga zmiany ❌ na „—" z przypisem**, a nie dokładania
skrótów. Zmiana „nic" na „własny słownik: ←/→, t, 1/2/3" należy się też
tabeli na linii 786 `59-spojnosc-ui.md` — dziś kłamie.

### Wiersz „Kalendarz" — co ZOSTAŁO NAPRAWDĘ, znalezione przy Notatniku

**`PATCH /api/events/:id` zapisuje pole po polu.** Sprawdzenie daty siedzi
w środku ciągu `UPDATE`-ów, więc żądanie z poprawnym tytułem i błędną datą
**zapisuje tytuł i oddaje 400** — komunikat „nie udało się zapisać" jest wtedy
nieprawdą. To dokładnie ten dług, który Moduł 66 wyciął w Przypomnieniach
dwufazowym PATCH-em (komplet sprawdzeń → dopiero zapisy), a Notatnik dostał
przy swoim audycie. Kalendarz jest **ostatnią trasą PATCH w panelu bez tego
podziału**.

Przy audycie Notatnika wstawiono tam JEDNĄ bramkę (`godzina`) i postawiono ją
świadomie **przed** pierwszym zapisem, żeby nie dokładać kolejnego wyjścia
w środku — ale samego rozjazdu nie przepisywano, bo to zakres Kalendarza.
**To jest główna robota tej sesji.**

Przy okazji zmierz resztę uchwytów Kalendarza tą samą sondą, co Notatnik:
śmieć w każde pole słownikowe (`powtarzanie`, `alert_minut_przed`,
`czas_trwania_min`), `DELETE` nieistniejącego (czy oddaje 404, czy `{"ok":true}`
— Notatnik miał trzy takie miejsca), klucz obcy (`lead_id`/`project_id`/
`client_id` — nieistniejące id dawało w Notatniku gołe 500), oraz pola
wskazujące na inny rekord przy wystąpieniach serii (`<id>~<data>`).

### Wiersz „Kalkulator" — `Klawiatura ❌`, `Stany ⚠️`

Klikalność i Gesty mają „—", bo to ankieta, nie lista — i to jest słuszne,
nie przeocz tego jak przy Notatniku (tam „—" nie było, a ✅ było fałszywe).

- **Klawiatura ❌** — sprawdź, czy to nie ten sam przypadek, co Kalendarz:
  ankieta nie ma listy do chodzenia `j/k` ani pola szukania. Jeśli tak,
  wiersz idzie na „—" z przypisem. Jeśli natomiast da się przejść ankietę
  Enterem/strzałkami i tego nie ma — to jest realna praca.
- **Stany ⚠️** — przejdź KAŻDĄ drogę do pustego/nietypowego ekranu osobno.
  Po Poczcie, Przypomnieniach i Notatniku **trzy razy z rzędu** okazało się,
  że jeden zestaw słów obsługiwał dwie różne przyczyny. Przy Notatniku
  `StanListy` i `StanBledu` BYŁY zaimportowane i to właśnie usypiało czujność.
  Pytania: co widzi ktoś, kto nie odpowiedział na żadne pytanie; co widzi przy
  zerwanym połączeniu; czy rekomendacja bez wyniku ma własny ekran.

### Dwie kategorie, które przy Notatniku i Przypomnieniach były FAŁSZYWIE ZIELONE

Sprawdź je w obu modułach, mimo ✅ w tabeli:

- **Klikalność** — `getBoundingClientRect` na ikonach. Próg 24×24 (WCAG 2.5.8).
  Przypomnienia miały 15×15 i 18×18, Notatnik 14×14 i **6×17**. Wzorzec
  naprawy: rośnie TRAFIENIE, nie rysunek (`-m-1.5 p-1.5`); znak typograficzny
  bywa za wąski na sam padding i potrzebuje jawnego `h-6 w-6`.
- **Gesty/menu** — `useContextMenu`. **Po Notatniku Kalendarz jest OSTATNIM
  modułem bez menu pod prawym przyciskiem** (zmierzone). Rozstrzygnij, czy
  siatka dni to sensowne miejsce na menu (dzień? wydarzenie?), czy świadomy
  wyjątek — i zapisz decyzję, nie zostawiaj pustego pola.

## Co zastajesz po audycie Notatnika

- **`odczytajTekst()` / `odczytajFlage()`** (`lib/notes.ts`) — trzy przypadki
  zamiast dwóch: brak pola ≠ pole puste ≠ śmieć. `null` czyści, tekst ustawia,
  cokolwiek innego to 400 z nazwą pola. Rodzina `odczytajOpcjonalna()` z M66.
- **`NOTE_LIMITS`** — jedna definicja sufitu dla POST i PATCH, a przekroczenie
  to **400 z liczbą znaków, nie `slice()`**. Powód: POST tnął treść na 8000 po
  cichu, PATCH nie tnął wcale; ucięty tekst kłamie gorzej niż odmowa.
- **`DELETE … RETURNING id` → 404** w trzech miejscach Notatnika.
- **`isPlausibleTimeString` przeniesiony do `lib/dates.ts`** (re-eksport
  w `reminders.ts` zostaje) i wpięty w `notes/schedule`, `events` POST
  i `events` PATCH. Powstał w M66 i był wołany WYŁĄCZNIE przez Przypomnienia,
  więc `{"godzina":"trzynasta"}` wchodziło do wydarzenia kalendarza.
- **`EditableTextarea maxWysokosc`** — opcjonalny sufit wysokości, domyślnie
  BRAK. Sufit należy się karcie w siatce, nie profilowi.
- **Pusty stan dobiera słowa PRZYCZYNĄ**, a nie zakładką (`powodPustki`
  w `NotesDashboard.tsx` jako wzór).
- **`StanBledu` w profilu, nie tylko na liście** — `NoteDetailPanel` wisiał na
  wiecznym szkielecie przy awarii trasy, bo paczka E poprawiła tylko listę.
  **Moduł ma zwykle DWA miejsca pokazujące rekord — sprawdź oba.**
- **`npm test`: 197 przypadków**; `test/notatnik.test.ts` jako najświeższy wzór.
- **Apka**: haptyka Notatnika w `AppStore` (nie w widoku — reguła Fazy 15),
  sygnał PO odpowiedzi serwera. Sprawdź, czy Kalendarz i Kalkulator się
  odzywają — Notatnik miał zero przy 51 sygnałach w reszcie sklepu i nikt tego
  nie zauważył przez dwa tygodnie.
- **`lib/instrukcje.ts` ma dwunasty moduł** (Notatnik). Zmiana gestu, skrótu
  albo miejsca kontrolki = poprawka tam, w tym samym commicie.

## ZANIM ZACZNIESZ — przeczytaj

- `CLAUDE.md`,
- `docs/plany-modulow/59-spojnosc-ui.md` — wiersze „Kalkulator" i „Kalendarz",
  tabela „gdzie mieszka wzorzec" (linia ~786) i przypis ⁸,
- `docs/plany-modulow/51-audyt-uiux-panel-i-apka.md` → „Stan po module Notatnik",
- `HUB_SETUP.md` → „Audyt Notatnika" i „Moduł 10" (Kalendarz).

## Świadome decyzje — NIE cofaj bez pytania

- **„Cykle" w Osi czasu to wyłącznie rytm wizualny** — bez przypisywania zadań.
- **Kalendarz bez `/` i `j/k`** — patrz wyżej: prawdopodobnie uzasadnione,
  ale ZWERYFIKUJ, zamiast przepisywać z tabeli.
- **Edycja wystąpienia serii dotyczy CAŁEJ serii** (decyzja właściciela
  2026-07-22; wyjątki tylko przy kasowaniu).
- Eksporty świadomie BEZ sufitu.
- Wszystko z sekcji „Świadome decyzje produktowe" w `CLAUDE.md`.

## Czego NIE ruszać

- `PO_REJESTRACJI.md` — firma nie jest zarejestrowana.
- Przeprowadzka na NAS (Moduł 55) — czeka na rejestrację.
- Nowy punkt użycia lokalnego LLM wymaga wyraźnej prośby właściciela.
- **Ikony 15×15 w Katalogu** (`CatalogDashboard.tsx`) — zmierzone w Module 66,
  zapisane, **wciąż nietknięte**. Do rozstrzygnięcia, czy przejść tym przez
  cały panel; nie rób tego przy okazji.
- **`existing` vs `reused`** — dwa nazewnictwa tej samej idempotencji
  (Notatnik vs Poczta). Zmiana ruszyłaby kontrakt apki bez zysku.
- **Dziennik notatki w apce** — usunięty świadomie w audycie Fazy 13.4 jako
  martwy kod, wraca razem z UI albo wcale.

## Weryfikacja — pułapki, na których traci się czas

- **Pomiar klawiatury dał trzy fałszywe alarmy pod rząd przy Notatniku**, nim
  dał prawdę: odczyt przed renderem, odczyt WARTOŚCI `data-kursor` zamiast
  pozycji karty, odczyt DOM przed przerysowaniem Reacta. Mierz `defaultPrevented`
  na zdarzeniu ORAZ indeks elementu z `[data-kursor="1"]`, z `await` na klatkę
  między naciśnięciami. **Narzędzie pomiaru myli się w stronę paniki.**
- **`requestAnimationFrame` w podglądzie stoi** (karta „hidden", zmierzone
  0 klatek), więc `AnimatePresence` nie kończy przenikania i modal nie pojawia
  się na zrzucie mimo poprawnego kodu. Rozstrzyga odczyt DOM z overlaya.
- **Konsola ma bufor SKUMULOWANY** — błąd składni wisiał tam długo po
  naprawie. Rozstrzyga: brak wzorca w pliku + `tsc` czysto + strona 200
  + nowe zachowanie widoczne na ekranie.
- **Polski cudzysłów zamykający w literale TypeScriptu kończy string.**
  Wewnątrz `"…"` używaj słów zamiast `„…"`.
- **`querySelectorAll` łapie najpierw link paska bocznego** i przenosi na inny
  ekran — zdarzyło się przy Module 66 i znowu przy Notatniku, mimo ostrzeżenia.
  Wykluczaj `nav`/`aside` i sprawdzaj `location.pathname` po kliknięciu.
- **Menu kontekstowe nie zamyka się od SYNTETYCZNYCH zdarzeń** — sprawdzone
  kontrolnie: w Przypomnieniach zachowuje się identycznie. Właściwość
  wspólnego `Popover`. Bez porównania z modułem odniesienia wygląda to na
  świeżo wprowadzoną usterkę.
- **Współrzędne symulatora to PUNKTY, nie piksele zrzutu** (1378 px → 834 pkt,
  przelicznik ≈0,605). Dwa taps trafiły w pustkę, zanim to policzyłem.
- **PGlite kasuje się przy przeładowaniu modułów serwera** — twórz dane
  testowe i mierz je w jednym ciągu albo dołóż do seeda.
- **`tsc` nie sprawdza SQL-a ani JSX-a, który odrzuci Turbopack** — po każdej
  paczce załaduj dotknięty ekran.
- **Next 16 nie uruchomi drugiego serwera dev dla tego samego katalogu** —
  `lsof -iTCP -sTCP:LISTEN -P | grep 3000` przed startem. Sonda 401 wymaga
  osobnego procesu z `DEV_ADMIN_BYPASS=0`, więc działający serwer trzeba ubić.
- **Apka w symulatorze na LOKALNYM panelu**: `Skrypty/stempel-wersji.sh` PRZED
  `xcodebuild`, potem KONIECZNIE `xcrun simctl terminate` przed `launch` —
  `launch` na działającej apce nie poda zmiennych środowiskowych i apka dalej
  będzie gadać z produkcją.

## Na koniec modułu

- Dopisz „Stan po module Kalkulator i Kalendarz" do
  `51-audyt-uiux-panel-i-apka.md` — łącznie z tym, czego NIE zmieniłeś i dlaczego.
- **Wypełnij oba wiersze w `59-spojnosc-ui.md` i popraw tabelę „gdzie mieszka
  wzorzec"** (linia ~786 kłamie o Kalendarzu).
- **To domyka całą tabelę Modułu 59** — piętnaście modułów, dziesięć kategorii.
  Napisz w `59-spojnosc-ui.md` jedno podsumowanie: ile pozycji w inwentarzu
  z 28.07 okazało się nieaktualnych, ile realnych i ile znalezisk przyszło
  SPOZA tabeli. To jest odpowiedź na pytanie, czy ta lista jako narzędzie
  się sprawdziła — i wskazówka, czy powielać ją w tej postaci przy nowych
  funkcjach.
- Uzupełnij `HUB_SETUP.md` — każdy nowy wzorzec z jednym zdaniem UZASADNIENIA.
- Dopisz moduły do `lib/instrukcje.ts` (będą trzynasty i czternasty) —
  dopiero gdy są sprawdzone.
- `rm -f .git/index.lock && git add -A && git commit && git push`.
