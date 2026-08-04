# Plan: droga, która się nie udaje, też ma działać

**Powstał:** 2026-08-04, po drugim przejściu „na sucho"
(`docs/DRUGIE-PRZEJSCIE-NA-SUCHO.md`). **Punkt startu:** `73a56fb`.

Poprzednik: `docs/PLAN-ZAPLECZE.md` (zamknięty 2026-08-02) — ten plan jest
zbudowany tak samo i celowo nie powtarza jego zasad.

| krok | co dowozi | zamyka | stan |
|---|---|---|---|
| 1 | publiczny dokument zna swój stan | A1, A2 | ✅ `5f4e81c` |
| 2 | szablon mówi tylko to, co potwierdzają dane | A4, A5, C2, C4, D3, D4 | ✅ `4eb8667` |
| 3 | „warunki obowiązujące" jako jedno miejsce | A6, A7, A8 | ✅ `KROK3` |
| 4 | porażka jest zdarzeniem jak każde inne | B1, B2, B3, B4 | ⬜ |
| 5 | drobiazgi + harness na drogę porażki | A3, C1, D1, D2, D5, D6 | ⬜ |

---

## Dlaczego znowu nie zaczynamy od listy poprawek

Drugie przejście dało 22 znaleziska. To **nie są 22 usterki** — to **cztery
brakujące mechanizmy**, każdy objawiający się w kilku miejscach naraz. Dokładnie
ta sama sytuacja co po pierwszym przejściu i ta sama diagnoza: łatane pojedynczo
wrócą.

| brakujący mechanizm | ile znalezisk zamyka |
|---|---|
| publiczny dokument zna swój stan | 4 |
| szablon mówi tylko to, co potwierdzają dane | 6 |
| „warunki obowiązujące" jako jedno miejsce | 4 |
| porażka jest zdarzeniem jak każde inne | 4 |

## Trzy rzeczy, które ustawiają cały plan

### 1. Bramka akceptacji istnieje — po prostu nie zna połowy stanów

To nie jest „brak zabezpieczenia", tylko **niekompletna lista**. Trasa
`POST /api/offers/public/<token>/accept` sprawdza dwa stany i przepuszcza dwa:

| stan oferty | dziś |
|---|---|
| `Zaakceptowana` | 400 — odmowa |
| po `wazna_do` | 409 — odmowa |
| `Odrzucona` | **200 — przyjęta** |
| `superseded_at` ustawione | **200 — przyjęta** |

Wniosek dla wszystkich kroków tego planu: szukamy **list, które ktoś dopisał
w połowie**, nie brakujących warstw. To samo dotyczy reguł w *Zdrowiu*
(dziewięć zdań, żadne nie sprawdza zgodności kwot i terminów między
dokumentami) i szablonów windykacji.

### 2. Znowu nic się nie wysypało

`error_log` po całym przejściu ma jeden wpis — i to o zadziałaniu hamulca, czyli
o czymś, co poszło dobrze. Oferta odrzucona i zaakceptowana tym samym linkiem:
200. Wezwanie twierdzące „pomimo wcześniejszych przypomnień", gdy nic nie
wysłano: 200. Projekt z terminem sprzecznym z umową: reguła „Projekt z podpisaną
umową ma termin" **przechodzi**, bo sprawdza obecność daty, nie jej zgodność.

Czyli: kontrola spójności z Fazy 0b jest właściwym narzędziem, ale jej zdania
są za słabe. Krok 3 dopisuje mocniejsze.

### 3. Panel umie tylko wygraną

Akceptacja oferty przestawia lead na „Zamknięte - sukces" sama. Odrzucenie nie
robi nic — lead zostaje w „Do kontaktu" z podpowiedzią „Zrób pierwszy ruch".
Silnik propozycji (`lib/propozycje.ts`, Faza 3) zna komplet skutków drogi, która
się udaje, i ani jednego skutku drogi, która się nie udaje. Krok 4 to wyrównuje.

---

## Decyzje właściciela (zapadły 2026-08-04)

1. **Stary link zostaje do wglądu, akceptacja jest zablokowana.** Nie
   unieważniamy linku przy odrzuceniu ani przy nowej wersji — klient ma dalej
   widzieć, co dostał. Zmienia się to, że strona mówi wprost, że jest
   nieaktualna, i nie da się jej zaakceptować.
2. **Rozjazd faktury z aneksem to PROPOZYCJA, nie automat.** Kwoty nie zmieniają
   się bez kliknięcia właściciela — zgodnie z granicą z `CLAUDE.md`.
3. **Klient może odrzucić ofertę ze swojej strony, z listą powodów** — tą samą,
   co w panelu. Powód wpada do bazy sam, zamiast zależeć od tego, czy właściciel
   pamięta go wklepać po mailu.
4. **Poziom windykacji jest podpowiadany, nie narzucony.** Panel dalej proponuje
   poziom z dni zwłoki, ale da się go zmienić w dół względem podpowiedzi.
   Eskalacja nadal **nie cofa się poniżej już wysłanego** poziomu.

---

## Krok 1 — publiczny dokument zna swój stan

**Zamyka:** A1, A2, C1, część D1. **Dlaczego pierwszy:** to jedyne znalezisko,
które kosztuje pieniądze u prawdziwego klienta — z martwej oferty powstaje
projekt i faktura po nieaktualnej cenie, i nic tego nie sygnalizuje. Jest też
najtańszy: jedna lista w trasie plus pasek na stronie.

Do zrobienia:

- **Domknąć listę stanów w trasie akceptacji.** `Odrzucona`, `Wygasła` oraz
  `superseded_at != null` mają dostawać odmowę z własnym komunikatem („Ta oferta
  została zastąpiona nowszą wersją", „Ta oferta została zamknięta"). Nie
  dopisywać warunków w miejscu — **wyciągnąć jedną funkcję**
  `czyMoznaZaakceptowac(dokument)` i wołać ją zarówno z trasy, jak i z widoku,
  żeby strona i serwer nie mogły się rozjechać. To ten sam kształt co
  `lib/bramkaWysylki.ts`.
- **Ten sam zestaw stanów dla umowy.** Trasa podpisu umowy przez link klienta ma
  identyczny kształt i nie była w tym przejściu sprawdzana — przyłożyć do niej tę
  samą listę, zanim znajdzie się to samo drugi raz.
- **Pasek stanu na stronie klienta.** Zamiast przycisku akceptacji: jedno zdanie
  o tym, co się stało, i — przy nowej wersji — odsyłacz do aktualnej oferty.
  Przy okazji przestać pokazywać „Wygasa za 21 dni" na dokumencie, który już
  nie żyje.
- **„Rezygnujemy" po stronie klienta** (decyzja 3): przycisk plus lista powodów
  z `lib/offers.ts` i pole na komentarz, zapis w te same kolumny
  (`powod_odrzucenia`, `komentarz_odrzucenia`, `odrzucona_at`) i to samo
  zdarzenie na osi czasu klienta co przy odrzuceniu z panelu.

**Sprawdzenie:** dowodem nie jest wygląd strony, tylko odpowiedź trasy. Dla
każdego z czterech stanów — kod HTTP i brak `project_id`/`invoice_id` po próbie.

### Co się okazało przy robocie (2026-08-04, `5f4e81c`)

- **Umowa miała tę samą dziurę i cięższy skutek.** Sprawdzenie „przyłóż tę samą
  listę do umowy" nie było ostrożnością — trasa podpisu przez link pilnowała
  wyłącznie stanu `Podpisana`, więc umowę **odrzuconą** dało się podpisać:
  zmierzone `Odrzucona → Podpisana`, 200, z zapisanym `accepted_by_name`.
  Z martwego dokumentu robił się wiążący. Przyczyna do zapamiętania: claim był
  napisany przez **wykluczanie** zakazanych stanów (`status != 'Podpisana'`)
  zamiast **wyliczenie** jedynego dozwolonego (`status = 'Wysłana'`). Pierwsza
  forma przepuszcza każdy stan, który ktoś doda później.
- **Wspólna funkcja to za mało, gdy strony dostają inne dane.** Po wpięciu
  `ocenAkceptacje()` w oba miejsca serwer blokował poprawnie, a strona klienta
  dalej pisała „ta oferta wygasła" zamiast „została zastąpiona nowszą wersją" —
  bo publiczny GET filtruje pola białą listą i `superseded_at` na niej nie było.
  Rozjazd siedział w DANYCH, nie w logice. Dokładając cokolwiek do
  `ocenAkceptacje()`, sprawdź `OFFER_PUBLIC_FIELDS` **i** `ZAWSZE_ZYWE`.
- **Nie zrobione świadomie:** pasek na zastąpionej ofercie **nie linkuje** do
  nowej wersji. Wymagałoby to wystawienia tokenu następnej oferty każdemu, kto
  ma stary link — a stary link bywa przekazany dalej. Zamiast tego pasek mówi
  „aktualne warunki znajdziesz w nowszej wiadomości od nas". Do rozstrzygnięcia,
  jeśli właściciel uzna to za zbyt zachowawcze.
- **C1 (klient odrzuca ofertę sam) przeniesione do osobnego kroku.** To nie jest
  domknięcie listy stanów, tylko nowa powierzchnia dla klienta — inny rodzaj
  roboty i inne ryzyko. Zostaje w planie jako otwarte.

---

## Krok 2 — szablon mówi tylko to, co potwierdzają dane

**Zamyka:** A4, A5, C2, C4, D3, D4. **Dlaczego drugi:** to jedyna grupa, która
odpala się **za każdym razem**, a nie „gdy klient wróci do starego linku".
Pierwsza wysłana wiadomość o długu zawsze twierdzi, że jest druga.

Do zrobienia:

- **Odciąć treść od dni zwłoki.** Zdania „to już druga wiadomość" i „pomimo
  wcześniejszych przypomnień" mają wynikać z `reminder_level` **przed** wysyłką,
  nie z tego, ile dni minęło. Gdy nic nie wysłano — szablon nie może się
  powoływać na korespondencję. Dotyczy też **dokumentu** wezwania, nie tylko
  maila.
- **Wybór poziomu** (decyzja 4): przycisk windykacji staje się rozwijaczem
  z trzema pozycjami; podpowiadany zostaje ten z dni zwłoki, wybrać można niżej,
  ale nie poniżej już wysłanego. To domyka C2 i jest warunkiem sensowności
  poprzedniego punktu.
- **Daty przez `formatPlDate()` we wszystkich szablonach mailowych.** Dziś
  dokument robi to dobrze (`17.06.2026`), a mail wysyła surowe `2026-06-17`.
  Szukać **po wszystkich szablonach naraz**, nie tylko w windykacji — to jest
  dokładnie ten rodzaj rozjazdu, który wraca.
- **Podpis i zwrot grzecznościowy z danych firmy.** „Dzień dobry, Pani Karolino"
  zamiast „Dzień dobry,", „Pozdrawiam, Patryk Piecyk" zamiast „Pozdrawiamy,
  Leggera Labs". Panel zna `osoba_kontaktowa` i `osoba_podpisujaca`. To
  bezpośredni krewny **A1 z pierwszego przejścia** — tam było
  `[Twoje imię]`, tu jest liczba mnoga i brak nazwiska.
- **Mail z nową wersją mówi, że zastępuje poprzednią** (D4) i podaje datę
  ważności, której dziś nie podaje żaden mail z ofertą.
- **Wezwanie dostaje rubrykę podpisu i kontakt do wierzyciela** (C4). Dziś
  formalne wezwanie kończy się kwotą i numerem konta — dłużnik nie ma z dokumentu
  do kogo napisać. Rubryka podpisu przez `PasekMarkiDokumentu`/`KwotaGradientem`
  z `DocGradient.tsx`, żeby nie zniknęła na wydruku.

### Co się okazało przy robocie (2026-08-04)

- **Hipoteza z briefu („zobaczysz listę dopisaną w połowie") się NIE
  potwierdziła — problem był głębiej.** W kroku 1 wystarczyło domknąć listę
  stanów, bo `CLOSED_OFFER_STATUSES` leżało obok gotowe. Tu nie było czego
  domykać: `reminder_level` istnieje i jest poprawnie prowadzony, tylko szablon
  **w ogóle o niego nie pytał** — „to już druga wiadomość" stało w kodzie na
  sztywno, tak samo jak „pomimo wcześniejszych przypomnień" na dokumencie `WZ-…`.
  Zdanie nie było źle policzone; nie było liczone wcale.
- **`reminder_level` nie odpowiada na pytanie szablonu.** Poziom mówi „jak
  wysoko", a szablon pyta „ile razy" — a te dwie liczby rozjeżdżają się przy
  KAŻDYM pominiętym progu. Przy 14 dniach zwłoki panel wysyła od razu poziom 2,
  więc pierwsza wiadomość ma `level = 2` i historię pustą. Trzeba było liczyć
  wiersze `invoice_reminders`, nie czytać poziomu. Na dokumencie wezwania jest
  jeszcze gorzej: w chwili oglądania `reminder_level` wynosi już 3 zawsze —
  liczbę wcześniejszych pism trzeba odtworzyć ze znaczników czasu.
- **Lekcja z kroku 1 sprawdziła się drugi raz, w tę samą stronę.** Ta sama
  funkcja licząca po obu stronach to za mało — publiczny link filtruje pola
  białą listą, więc gdyby wydruk liczył sam, u klienta pokazałby zero. Liczbę
  dokłada TRASA, obie, tą samą funkcją, jako gotowe pole. Sprawdzone osobno pod
  panelowym adresem i pod linkiem klienta: te same zdania.
- **Szablonów mailowych jest dziewięć, nie cztery.** Drugie przejście widziało
  cztery, bo tyle poszło tamtą drogą. Sweep objął też potwierdzenie akceptacji
  oferty, przypomnienie o umowie, wysyłkę faktury i dzienny raport — i tam też
  siedziały „Pozdrawiamy" oraz surowe daty.
- **`formatPlDate()` mieszkała w `lib/projects.ts`** i to jest cała przyczyna
  A5: moduły, które nie chciały ciągnąć całych Projektów, formatowały daty po
  swojemu albo wcale. Przeniesiona do `lib/dates.ts`, do reszty rodziny;
  w Projektach został re-eksport, więc żaden z kilkudziesięciu importów nie
  wymagał ruszania. Przy okazji wyszło, że te same surowe daty widać na
  **Pulpicie** („ustawione przypomnienie na 2026-07-21").
- **Wołacz to granica tego, co da się zrobić uczciwie.** Odmieniamy imiona na
  „-a" (Karolina → Karolino) i tylko je; imiona zakończone spółgłoską są
  nieregularne, więc zostają w mianowniku. Formy „Pani/Panie" wymagałyby
  zgadywania płci z imienia — świadomie ich nie ma. Decyzja właściciela.
- **Podpis jąkał się nazwiskiem i wyszło to dopiero na żywo.** Nazwa firmy JDG
  zawiera imię właściciela, więc stopka dawała „Patryk Piecyk / Leggera Labs
  Patryk Piecyk". W testach jednostkowych nie było tego widać, bo fikstura
  miała nazwę firmy bez nazwiska. Zmierzone na sondzie, poprawione, dopisany
  test.
- **Nie zrobione świadomie:** wybór poziomu został w panelu — apka iOS dalej
  wysyła podpowiadany (trasa przyjmuje brak pola `poziom` i zachowuje się jak
  wcześniej). Rozwijacz w apce to osobna robota po jej stronie.
- **Rozwijacz sprawdzony przez DOM, nie przez zrzut.** W tym podglądzie
  `requestAnimationFrame` daje 0 klatek (karta `hidden`), więc menu ma
  `opacity: 0`, choć jest otwarte, kompletne i klikalne — zmierzone, znany
  artefakt środowiska. Sprawdzenie szło przez `innerText` i `aria-checked`.

---

## Krok 3 — „warunki obowiązujące" jako jedno miejsce

**Zamyka:** A6, A7, A8, opcjonalnie C3.

Dziś nic w panelu nie odpowiada na pytanie „co dla tego zlecenia obowiązuje
DZISIAJ". Umowa zna swoje warunki, aneks zna swoje, projekt ma własny termin
z szablonu, faktura ma kwotę z oferty. Stąd trzy dokumenty z trzema różnymi
terminami (25.08 / 15.09 / 22.09) i faktura na 11 000 przy aneksie na 15 000.

Do zrobienia:

- **`lib/warunkiObowiazujace.ts`** — jedna funkcja: dla zlecenia (umowa + jej
  aneksy w kolejności) zwraca aktualną cenę, zakres, termin i **numer dokumentu,
  z którego pochodzą**. Ten ostatni element zamyka A7: aneks nr 2 cytuje wartość
  z aneksu nr 1, a w nagłówku powołuje się na pierwotną umowę.
- **Projekt bierze termin przy podpisie** (A6). Edytor oferty obiecuje to wprost
  („projekt weźmie ją przy podpisie") — albo dotrzymać obietnicy, albo usunąć
  zdanie. Uwaga: szablon projektu wstawia własne kamienie milowe, więc trzeba
  rozstrzygnąć, co ma pierwszeństwo — proponuję **termin z umowy wygrywa,
  kamienie z szablonu skalują się do niego**, a jeśli się nie mieszczą, projekt
  dostaje ostrzeżenie zamiast cichego rozjazdu.
- **Propozycja przy rozjeździe faktury** (decyzja 2, A8): „Aneks nr 1 zmienił
  wynagrodzenie na 15 000 zł — poprawić szkic faktury?" na Pulpicie i przy samej
  fakturze. Dodatkowo rubryka „WYNIKA Z" na fakturze ma wymieniać **aneks**, a nie
  tylko ofertę i umowę.
- **Dwie nowe reguły w *Zdrowiu*:** „termin projektu zgadza się z obowiązującą
  umową" i „kwota szkicu faktury zgadza się z obowiązującymi warunkami". Istniejące
  zdanie „Projekt z podpisaną umową ma termin" przechodzi mimo rozjazdu, bo
  sprawdza obecność, nie zgodność.
- **(Opcjonalnie) C3** — „Sporządź aneks" także na podpisanym aneksie. Po
  poprawieniu referencji nie jest to już konieczne; do rozstrzygnięcia, czy warto.

### Decyzje właściciela (zapadły 2026-08-04, na starcie kroku)

1. **Termin z umowy wygrywa z terminem z szablonu projektu**, a kamienie milowe
   **zostają nietknięte**. Te, które wypadają po terminie, dostają widoczne
   ostrzeżenie na projekcie i regułę w *Zdrowiu*. Odrzucona została propozycja
   z planu (skalowanie kamieni proporcjonalnie): przepisywałaby także daty
   uzgodnione z klientem, i to bez pytania.
2. **Wyrównanie terminu to AUTOMAT, nie propozycja** — ale zostawia wpis w logu
   („Termin projektu wyrównany do obowiązujących warunków (Aneks nr 1
   z 04.08.2026): 22.09.2026 → 25.08.2026"). Powód: edytor oferty już dziś to
   obiecuje, a pytanie, na które odpowiedź brzmi „tak" za każdym razem, uczy
   klikać bez czytania.
3. **C3 — nie robimy.** Po poprawce referencji (A7) obecna droga jest poprawna,
   a trasa jasno odsyła komunikatem „Kolejny aneks sporządza się do samej
   umowy". Drugi przycisk to druga ścieżka do tego samego wyniku.

### Co się okazało przy robocie (2026-08-04)

- **Hipoteza z briefu potwierdziła się w połowie — i to gorszej.** A7 był
  faktycznie jedną linijką (`reference: contractReference(src)`), ale nie dało
  się jej po prostu przestawić: nagłówek aneksu **słusznie** wskazuje
  umowę-matkę, bo to jej dotyczy dokument. Pomylone były nie wartości, tylko
  **dwa różne pytania w jednym polu**: „czego dokument dotyczy" i „skąd
  pochodzą wartości »było«". Rozwiązaniem jest osobne pole `zrodlo`, nie
  podmiana istniejącego. Na wydruku aneksu nr 2 stoi dziś zdanie
  „Dotychczasowe brzmienie — wg aneksu nr 1 z dnia 04.08.2026".
- **A6 był mechanizmem, który nigdy nie zadziałał — ani razu.** `const termin =
  tekst(p.termin) ? null : …` czekał na projekt bez terminu, a szablon wstawiał
  termin sekundy wcześniej, przy zakładaniu projektu. Funkcja była wołana z obu
  tras podpisu, zwracała `{zmienioneDaty: false}` i nikt nigdy tego nie zauważył,
  bo status projektu **zmieniał się** obok (Planowanie → W trakcie). Podpis
  „dotykał" projektu, więc wyglądał na działający.
- **Podpisanie ANEKSU nie dotykało projektu w ogóle.** `projektPoPodpisieUmowy`
  wychodziło na `typ !== "umowa"` w pierwszej linijce. To druga połowa A6 i było
  wprost w znalezisku („Podpisanie aneksu (15.09) też nic nie zmieniło") —
  łatwa do przeoczenia, bo brief mówił o „terminie przy podpisie", a podpis
  kojarzy się z umową.
- **Sonda dwa razy pokazała czerwień, która nie była usterką panelu.** Raz, bo
  `POST /api/contracts` nie zapisuje `project_id` z body (pułapka wypisana
  w briefie — i tak się na nią nabrałem, bo szedłem skrótem zamiast przez
  akceptację oferty). Drugi raz, bo `GET /api/clients/:id` oddaje oś czasu pod
  kluczem `feed`, nie `events`. Oba razy kod był dobry, a **sonda kłamała** —
  i oba razy zajęło to tyle samo czasu, co prawdziwy błąd. Sonda też jest kodem,
  który trzeba sprawdzić.
- **Reguła „milczy" nie znaczy „milczy o tym, co sprawdzam".** Dev-baza żyje
  między przebiegami sondy, więc zaległości z poprzedniego biegu zapalały regułę
  i sprawdzenie „Zdrowie umilkło" wypadało na czerwono. Sprawdzenia globalnej
  ciszy trzeba było zawęzić do rekordów bieżącego przebiegu — inaczej pierwszy
  przebieg jest zielony, a każdy następny czerwony bez powodu.
- **Rozjazd faktury naprawiamy DOPISANIEM pozycji, nie przepisaniem kwot.**
  Aneks podnosi wynagrodzenie, bo urósł zakres — więc na fakturze ma być widać,
  za co. Przepisanie kwot w miejscu skasowałoby rozbicie i zostawiło dokument,
  z którego nie wynika, skąd różnica. Zdanie propozycji mówi to wprost
  („dopisać pozycję wyrównującą (+4 000,00 zł)?"), bo propozycja, po której
  trzeba sprawdzać, co się właściwie stało, jest gorsza od cichej podmiany.
- **Reguła spójności musiała dostać warunek, którego brief nie przewidywał.**
  „Kwota szkicu faktury zgadza się z obowiązującymi warunkami" bez zawężenia do
  zleceń z **podpisanym aneksem** świeciłaby przy normalnej pracy: faktura na
  inną kwotę niż umowa to zaliczka, płatność etapami albo faktura za część
  zakresu. Ekran, który świeci zawsze, uczy tylko go ignorować.
- **Propozycje dostały zawężenie do jednego rekordu.** Przy fakturze pytanie
  o sąsiedni dokument to szum, więc `<Propozycje>` przyjmuje teraz `rekordId`.
  Przy okazji trzeba było zdjąć licznik „Odłożone (3) — przywróć": mówiłby
  o cudzych decyzjach i przywracał je wszystkie jednym kliknięciem.
- **Nie zrobione świadomie:** apka iOS nie pokazuje nowej propozycji ani
  rubryki z aneksem — to osobna robota po jej stronie, tak samo jak rozwijacz
  windykacji z kroku 2. Trasy oddają komplet, więc nie ma czego zmieniać
  na serwerze.

---

## Krok 4 — porażka jest zdarzeniem jak każde inne

**Zamyka:** B1, B2, B3, B4. **Dlaczego przedostatni:** największa robota, a boli
najwolniej — nic się nie psuje, tylko po cichu przepadają okazje.

Do zrobienia — nowe reguły w `lib/propozycje.ts`, w tym samym kształcie
(jedno zdanie, „zrób to", „nie teraz"):

- **odrzucona oferta** → „Oferta dla Chłodni Wisła odrzucona (za drogo) —
  przestawić lead na »Zamknięte - porażka« czy umówić kontakt za 3 miesiące?"
  Dziś lead zostaje w „Do kontaktu" z podpowiedzią „Zrób pierwszy ruch",
  a mapa procesu stoi na 2/15, choć oferta wyszła i wróciła.
- **projekt zerwany** → „Projekt zerwany, a faktura FV 93/2026 czeka
  nieopłacona — co z nią?" oraz „…a aneks nr 2 wisi niepodpisany" (B4).
  Plus: status projektu zostaje „W trakcie" przy zdrowiu „Zerwany" — propozycja
  domknięcia, nie automat.
- **stan karty klienta** (B3) → `ostatni_kontakt` i status mają iść za osią czasu.
  Dziś po rozmowie, dwóch ofertach, umowie, aneksie, dwóch fakturach
  i **wezwaniu do zapłaty** karta pokazuje „Prospekt / Ostatni kontakt — /
  proces 3 z 15 / Odzywaj się: Bez pilnowania". To ten sam kształt co C4
  z pierwszego przejścia, więc też jako propozycja.
- **log leada widzi cykl życia oferty** (B1) → zdarzenia „wysłano ofertę",
  „klient otworzył", „odrzucona" trafiają dziś wyłącznie na oś klienta. Lead ma
  własną kartę, na którą się zagląda, i pusty log.
- **projekt zagrożony/zerwany na Pulpicie** (B2) → dziś nie ma żadnej sekcji,
  która by go pokazała; „Projekty z minionym terminem" go nie łapie, bo termin
  jest w przyszłości.

---

## Krok 5 — drobiazgi i harness

- **A3** — nowa wersja przepisuje poprzedniej status `Odrzucona → Wygasła`.
  Rozważyć osobny stan `Zastąpiona` zamiast pożyczania „Wygasłej": dziś powód
  odrzucenia zostaje w bazie, ale status, po którym liczy się skuteczność
  i filtruje listę, mówi co innego.
- **D2** — nowa wersja zeruje `wazna_do`, `czas_realizacji_tygodnie` i cały blok
  ROI. Przenieść je razem z resztą treści, a w edytorze wersji 2 pokazać powód
  odrzucenia poprzedniej i odsyłacz do niej.
- **D1** — kolejność akcji na ofercie: na szkicu i na ofercie odrzuconej głównym
  przyciskiem jest „Akceptuj ofertę". Wyróżnić to, co jest następnym krokiem
  w danym stanie.
- **D5** — komunikat hamulca („Zbyt wiele prób. Spróbuj ponownie za 60 min.")
  ma mówić klientowi, co zrobić; rozważyć, czy próby odrzucone walidacją mają
  się w ogóle liczyć do limitu.
- **D6** — `aria-pressed` na chipach powodu odrzucenia.
- **Harness.** Dopisać do `scripts/przejscie/przejscie.ts` drogę porażki:
  odrzucenie, nowa wersja, dwa aneksy, zdrowie projektu, eskalacja windykacji.
  Tak samo jak `npm run przejscie` powstał po pierwszym przejściu — po to, żeby
  trzecie nie musiało sprawdzać tego samego ręcznie.

---

## Czego ten plan nie obejmuje

- **A5 z pierwszego przejścia** (`ZLECENIODAWCA / WYKONAWCA` — jedna rubryka,
  dwie role) zostaje otwarte. Widziałem je na wydruku aneksu; to znana pozycja
  z `PIERWSZE-PRZEJSCIE-NA-SUCHO.md`, nie nowa.
- **Wygląd.** Drugie przejście świadomie nie sprawdzało warstwy wizualnej —
  w tym środowisku `requestAnimationFrame` daje zero klatek, więc pomiary byłyby
  zgadywaniem. Jeśli wygląd ma być sprawdzony, to osobno i w prawdziwej
  przeglądarce.
- **Kolejność 1→5 nie jest sztywna między krokami 1 i 2.** Są niezależne. Krok 1
  jest pierwszy, bo kosztuje pieniądze; krok 2 odpala się częściej. Jeśli
  wolisz zacząć od tego, co klient czyta za każdym razem — zamień je miejscami,
  nic się nie zablokuje.
