# Plan: droga, która się nie udaje, też ma działać

**Powstał:** 2026-08-04, po drugim przejściu „na sucho"
(`docs/DRUGIE-PRZEJSCIE-NA-SUCHO.md`). **Punkt startu:** `73a56fb`.

Poprzednik: `docs/PLAN-ZAPLECZE.md` (zamknięty 2026-08-02) — ten plan jest
zbudowany tak samo i celowo nie powtarza jego zasad.

| krok | co dowozi | zamyka | stan |
|---|---|---|---|
| 1 | publiczny dokument zna swój stan | A1, A2 | ✅ `5f4e81c` |
| 2 | szablon mówi tylko to, co potwierdzają dane | A4, A5, C2, C4, D3, D4 | ✅ `4eb8667` |
| 3 | „warunki obowiązujące" jako jedno miejsce | A6, A7, A8 | ✅ `4ec5dbf` |
| 4 | porażka jest zdarzeniem jak każde inne | B1, B2, B3, B4 | ✅ `41ae95c` |
| 5 | drobiazgi + harness na drogę porażki | A3, C1, D1, D2, D5, D6 | ✅ `3a42f75` |

**Plan zamknięty 2026-08-05.** Podsumowanie całości — na końcu dokumentu.

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

### Decyzje właściciela (zapadły 2026-08-05, na starcie kroku)

1. **Kontaktem jest WYSŁANA WIADOMOŚĆ, nie czynność własna.** `ostatni_kontakt`
   przestawia się automatycznie przy każdej wysyłce maila do klienta (oferta,
   przypomnienie o ofercie, umowa/aneks, przypomnienie o podpisie, faktura,
   przypomnienie i wezwanie do zapłaty, prośba o opinię, kontakt kontrolny) —
   także wtedy, gdy wysłał ją cron windykacyjny. Wystawienie faktury,
   odnotowanie podpisu i utworzenie dokumentu daty NIE ruszają: to czynność
   właściciela w panelu, a nie rozmowa z klientem.
2. **Odrzucona oferta daje propozycję z DWIEMA drogami wyjścia** („Zamknij
   lead" / „Kontakt za 3 mies."), bo powód odmowy sam podpowiada właściwą —
   „za drogo" bywa warte powrotu za kwartał, „wybrali kogoś innego" nie.
   To jedyna taka reguła; przy trzech przyciskach pytanie przestałoby być
   pytaniem, a stałoby się formularzem.
3. **Zerwany projekt domyka się PROPOZYCJĄ, nie automatem** — to jedyny skutek
   tego kroku, który zamyka rekord.

### Co się okazało przy robocie (2026-08-05)

- **Brief miał rację co do B1 i B4, a dwie inne rzeczy okazały się większe, niż
  wyglądały.** Zgodnie z zapowiedzią: trasa odrzucenia **wołała**
  `logClientEvent` — brakowało ADRESATA, nie wywołania; a „niepodpisany aneks"
  z B4 już dziś się pokazuje (`staleContracts` nie filtruje po `typ`), więc
  prawdziwą luką jest **szkic**, nie wysyłka.
- **Log leada musiał dostać rozróżnienie, którego brief nie przewidywał.**
  `GET /api/clients/:id` dociąga `lead_activity` leada, z którego powstał
  klient — więc samo dopisanie zdarzeń dokumentowych do tej tabeli pokazywałoby
  KAŻDE z nich na osi klienta **dwa razy**. Stąd kolumna `kind` (te same klucze
  co `client_events.kind`, więc ta sama mapa ikon) i warunek `kind IS NULL`
  w scalaniu osi klienta. Przy okazji `kind` odpowiada na dwa inne pytania:
  którą ikonę narysować i czy wolno wpis skasować (nie wolno — pilnuje tego
  TRASA, 409, nie brak kosza w interfejsie).
- **„Wołaj z tych samych miejsc" to było 40 miejsc, nie cztery.** Zrobiony
  pełny sweep tras dokumentowych (oferty, umowy, faktury, projekty, powiązania
  wsteczne, cron windykacyjny) przez jeden pomocnik `logZdarzenieDokumentu`
  z celem `{clientId, leadId}`. To ta sama lekcja co z Fazy 2 („wysyłek okazało
  się siedem"): gdyby każde miejsce dopisywało drugą linijkę osobno, część by
  jej nie dostała i nikt by tego nie zauważył.
- **„Zerwany projekt zamknąć" nie miało dokąd zamknąć.** `PROJECT_STATUSES` nie
  ma statusu „przerwane", a „Wdrożone" znaczy ODEBRANE — zerwanego projektu tak
  oznaczyć nie wolno. Odpowiedź leżała w instrukcji panelu, którą kod ignorował:
  `lib/instrukcje.ts` od dawna mówi „projekt, którego nie chcesz widzieć, lepiej
  oznaczyć »Wstrzymane«". Dlatego propozycja ustawia „Wstrzymane", a nie nowy
  status — i dlatego doszło `NIEPRACUJACE_PROJECT_STATUSES` (szersze niż
  `CLOSED_PROJECT_STATUSES`): wstrzymany projekt przestaje nagabywać o termin,
  ale NIE planuje kontaktów kontrolnych. Rozbicie tych dwóch znaczeń było
  konieczne — gdyby „Wstrzymane" wpadło do `CLOSED_PROJECT_STATUSES`, panel
  zaplanowałby klientowi „jak leci?" po zerwanym projekcie.
- **Sonda znalazła DWA błędy dat, oba spoza tego kroku i oba niewidoczne przez
  większość doby.** Pierwszy: termin realizacji na UMOWIE liczony z
  `accepted_at.slice(0, 10)`, czyli z dnia **UTC**, podczas gdy cały panel
  liczy dni kalendarzowo wg strefy warszawskiej — oferta przyjęta między
  północą a drugą w nocy dawała termin o dzień za wczesny (stąd `dzienZnacznika`
  w `lib/dates.ts`). Drugi: `addDaysISO` dodawał milisekundy do lokalnej daty,
  więc **gubił dzień na każdym przedziale przechodzącym przez zmianę czasu** —
  90 dni od 05.08 dawało 02.11 zamiast 03.11. Ten drugi dotykał też terminu
  płatności faktury cyklicznej i kontaktu kontrolnego po projekcie; siedział
  tam od dawna. Oba złapane o 00:40 — gdyby sonda poszła o dziesiątej rano,
  przeszłaby na zielono.
- **Sonda skłamała dwa razy, znowu.** Raz wysyłając `powod_odrzucenia:
  "za-drogo"` — `OFFER_REJECT_REASONS` to ETYKIETY („Za drogo"), nie slugi,
  więc panel **słusznie** odrzucił wartość i zapisał sam komentarz. Drugi raz
  żądając `related_id` od wpisu `client_created`, który żadnego dokumentu nie
  dotyczy. Trzeci raz z rzędu połowa czerwieni w sondzie to nie usterka panelu.
- **Mapa procesu naprawiła się sama, dokładnie jak zapowiadał brief.**
  Po zatwierdzeniu propozycji „2/15 Pierwszy kontakt" zmieniło się w „15/15
  Nurture" — bez dotykania `lib/process.ts` ani map `*_STATUS_STEP`. Zmierzone
  w panelu, nie wywnioskowane z kodu.
- **Nie zrobione świadomie:** apka iOS nie pokazuje drugiej akcji propozycji
  ani dwóch nowych sekcji Pulpitu — to osobna robota po jej stronie, tak samo
  jak rozwijacz windykacji z kroku 2 i propozycja z kroku 3. Trasy oddają
  komplet (`akcjaAlt`, `decyzja: "zrob-alt"`, `projektyZagrozone`,
  `zapomnianeSzkiceUmow`), więc na serwerze nie ma czego zmieniać. Drogi
  porażki NIE ma w `scripts/przejscie/przejscie.ts` — to jawnie krok 5;
  sprawdzona osobną sondą, która nie została w repo.

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

### Decyzje właściciela (zapadły 2026-08-05, na starcie kroku)

1. **Klient, który sam odrzuci ofertę, dostaje jedno zdanie mailem** —
   potwierdzenie odbioru decyzji, bez próby ratowania sprzedaży. Powód: bez tego
   kliknięcie „rezygnujemy" kończyło się ciszą i klient nie miał pewności, że
   cokolwiek do nas dotarło.
2. **A3 — zawężamy `UPDATE`, NIE dokładamy statusu „Zastąpiona".** Fakt
   zastąpienia niesie już `superseded_at`, a nowa wartość w `OFFER_STATUSES`
   dotknęłaby mapy koloru, filtra, wagi w pipelinie, kilku list stanów ORAZ
   bliźniaczej mapy w apce iOS, która żyje w osobnym repozytorium.
3. **D5 — hamulec liczy POMYŁKI i zeruje się po udanym wejściu**, jak przy
   logowaniu. Próg 5/60 min bez zmian: to nie jest rozluźnienie ochrony, tylko
   przestawienie jej na właściwy licznik.

### Co się okazało przy robocie (2026-08-05)

- **Brief przejrzał te sześć znalezisk po kodzie i to się opłaciło — ale
  największa robota była tam, gdzie zapowiadał ją najkrócej.** A3 wyszedł na
  jedną linijkę plus czysta funkcja (`statusPoZastapieniu`), a C1 — „nowa
  powierzchnia dla klienta" — na jedną trasę wzorowaną co do kształtu na
  `comment/route.ts`. Najwięcej czasu zjadł harness i to on znalazł wszystko,
  czego nie widać z kodu.
- **A3 miał drugą połowę, o której brief nie wiedział.** Po zawężeniu `UPDATE`
  status wreszcie mówi prawdę — ale statystyka „dlaczego przegrywamy oferty"
  (`/api/stats`) miała własny warunek `superseded_at IS NULL` z uzasadnieniem
  „zastąpione nie są przegrane, tylko nieaktualne". Ono było słuszne, DOPÓKI
  status „Odrzucona" mogła nosić oferta, której nikt nie odrzucił. Po poprawce
  ten warunek robił dokładnie jedną rzecz: ukrywał powód odmowy, gdy właściciel
  zareagował na nią nową wersją — czyli najczęstszą reakcję na „za drogo".
  Zdjęty. Skuteczność liczy się dalej bez zastąpionych
  (`offerLiczySieDoStatystyk`) — to osobne pytanie: tam „ile wygrywam", tu „na
  czym się potykam".
- **D5 miał wyjątek, którego decyzja właściciela nie mogła przewidzieć.**
  „Liczyć tylko nieudane" jest słuszne dla akcji JEDNORAZOWYCH (podpis,
  odrzucenie, opinia) — tam po sukcesie dokument zmienia stan i druga próba i
  tak odbija się od claimu. Ale „poproszę o zmianę" wolno wywołać wiele razy
  z powodzeniem i to właśnie powtarzany SUKCES jest tam nadużyciem, dla którego
  ten hamulec powstał (każda prośba dzwoni i wysyła maila). Stąd
  `strazDokumentuPublicznego(…, { sukcesLiczySie: true })` — jedna trasa,
  z wypisanym powodem. Reszta decyzji bez zmian.
- **D2 gubił cztery pola, a piąte trzeba było świadomie NIE przenieść.**
  `wazna_do` wędruje na nową wersję tylko wtedy, gdy jeszcze nie minęła:
  poprzedniczkę odrzuca się czasem po terminie, a odziedziczona wsteczna data
  urodziłaby szkic od razu przeterminowany i nikt by tego nie zgłosił. Reguła
  siedzi w `waznoscDlaNowejWersji()` z testami na DOSŁOWNYCH datach wokół 25.10
  — porównanie napisów, bez arytmetyki na `Date`, bo to na niej krok 4 gubił
  dobę na zmianie czasu.
- **Sonda skłamała CZTERY razy, czwarty przebieg z rzędu.** Trzy razy zwyczajnie
  (log leada pod `GET /api/leads/:id`, nie `/activity`; statystyka pod
  `offerLosses.reasons`, nie `powodyOdrzucenia`; windykacja to działanie
  NIEODWRACALNE, więc bez nagłówka potwierdzenia oddaje 428). Czwarty raz
  ciekawiej: sprawdzenie „odrzucenie stoi na osi klienta DOKŁADNIE raz"
  wypadało na czerwono, bo **sama sonda odrzucała ofertę dwa razy** — raz
  slugiem przez publiczny link, raz etykietą z panelu. Asercja o krotności jest
  bezwartościowa, jeśli wołający klika dwa razy. Rozdzielone: droga porażki
  odrzuca raz, a pułapka „etykieta kontra slug" dostała własną sondę z własnym
  leadem.
- **Sonda hamulca psuła NASTĘPNY przebieg, i to był najlepszy znaleziony
  błąd.** Pierwsza wersja zostawiała pięć pomyłek na wspólnym odcisku, więc
  bieg numer jeden był zielony, a każdy kolejny miał sześć pominięć i wyglądał
  na regresję. Ten sam kształt pułapki co „dev-baza żyje między przebiegami"
  (krok 3), tylko przez stan hamulca. Sonda udaje teraz ruch z innego miejsca
  (`x-forwarded-for` ze znacznikiem przebiegu) — mechanizm mierzony ten sam
  i w pełni, zmienia się wyłącznie odcisk. **Limit ŁĄCZNY (60/60 min) zostaje
  nietknięty i jest realnym sufitem: powyżej ~5 przebiegów w godzinę zacznie
  blokować globalnie. To poprawne zachowanie zabezpieczenia, nie usterka.**
- **Przy okazji D5 naprawił powtarzalność całego przejścia.** Do tej pory drugi
  bieg pod rząd tracił drogę KLIENTA (akceptacja, opinia) na godzinę, bo udane
  żądania też zjadały limit. Teraz sukces zeruje licznik, więc dwa biegi z rzędu
  dają ten sam wynik: **101 działa · 0 regresji · 0 pominiętych**. Zmierzone
  trzy razy pod rząd, nie wywnioskowane.
- **Warstwa wizualna sprawdzona przez DOM, nie przez zrzut** — w tym podglądzie
  karta jest `hidden`, `requestAnimationFrame` daje zero klatek i `read_page`
  zwraca pustą stronę (viewport 0×0). Przy D6 to akurat wygodne: `aria-pressed`
  mierzy się wprost. Potwierdzone w panelu: na ofercie odrzuconej jedynym
  `.btn-primary` jest „Nowa wersja oferty", na szkicu „Wyślij mailem", a karta
  „WAŻNOŚĆ" zamiast odliczania pisze „Data ważności nie ma już znaczenia".
- **Nie zrobione świadomie:** apka iOS nie zna trasy odrzucenia przez klienta
  ani karty „Odpowiedź na wersję N" — to ta sama paczka roboty po jej stronie,
  co rozwijacz windykacji (krok 2), propozycja z aneksem (krok 3) i druga akcja
  propozycji (krok 4). Serwer oddaje komplet.

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

---

## Podsumowanie planu (2026-08-05)

### Co zamknęły cztery brakujące mechanizmy

Drugie przejście dało 22 znaleziska. Nie było ich 22 do naprawienia — były
cztery rzeczy, których panel nie umiał, każda widoczna w kilku miejscach naraz.

| mechanizm | co znaczy, że jest | najcięższy skutek jego braku |
|---|---|---|
| publiczny dokument zna swój stan | jedna funkcja (`ocenAkceptacje`) odpowiada trasie i stronie | z martwej oferty powstawał projekt i faktura po nieaktualnej cenie; **umowę ODRZUCONĄ dało się podpisać** starym linkiem |
| szablon mówi tylko to, co potwierdzają dane | zdania liczone z `invoice_reminders`, nie z dni zwłoki | pierwsza wiadomość o długu twierdziła, że jest druga — także na formalnym wezwaniu |
| „warunki obowiązujące” jako jedno miejsce | `lib/warunkiObowiazujace.ts` + numer dokumentu, z którego pochodzą | trzy dokumenty z trzema terminami, faktura na 11 000 przy aneksie na 15 000 |
| porażka jest zdarzeniem jak każde inne | `logZdarzenieDokumentu` na obie osie + reguły porażki w `lib/propozycje.ts` | odrzucona oferta nie robiła NIC: lead zostawał w „Do kontaktu” z podpowiedzią „Zrób pierwszy ruch” |

Do tego, poza czwórką, cztery drobiazgi kroku 5 (A3, D1, D2, D6), jedna nowa
powierzchnia dla klienta (C1 — odrzucenie oferty ze swojej strony) i jedna
zmiana w zabezpieczeniu (D5).

**Powtarzalna, mierzalna wersja tego wszystkiego:** `npm run przejscie` sprawdza
dziś **101 zdań** o zapleczu — 68 na drodze, która się udaje, i 33 na drodze,
która się nie udaje. Przed tym planem drugiej drogi harness nie znał w ogóle.

### Co zostaje otwarte (świadomie)

- **A5 z PIERWSZEGO przejścia** — na wydruku umowy rubryka
  „ZLECENIODAWCA / WYKONAWCA” jest jedna, a role są dwie. Znana pozycja
  z `PIERWSZE-PRZEJSCIE-NA-SUCHO.md`, nie nowa.
- **Warstwa wizualna** — żadne z dwóch przejść jej nie sprawdzało. W tym
  środowisku `requestAnimationFrame` daje zero klatek (karta `hidden`), więc
  pomiary byłyby zgadywaniem. Wymaga prawdziwej przeglądarki i osobnej rundy.
- ~~**Apka iOS — jedna spójna paczka roboty.**~~ **NIEAKTUALNE — ZROBIONE
  2026-08-05**, jeszcze tego samego dnia, dwiema sesjami apki (`8870614`
  i `d5c40c6`). Sprawdzone pozycja po pozycji: rozwijacz poziomu windykacji
  (`PoziomWindykacji`, 7 plików), rubryka „WYNIKA Z” z aneksem
  (`FakturyView.wynikaZ`, gałąź `warunki.zAneksu`), druga akcja propozycji
  (`akcjaAlt`/`zrob-alt`), obie sekcje Pulpitu (`projektyZagrozone`,
  `zapomnianeSzkiceUmow`), odrzucenie oferty przez klienta (sekcja „Dlaczego
  odpadła”), karta „Odpowiedź na wersję N” (`odpowiedzNaWersje`).
  Propozycja o rozjeździe z aneksem działa **automatycznie**: apka renderuje
  treść propozycji z serwera i świadomie nie ma u siebie żadnej reguły, więc
  każda nowa pojawia się na telefonie bez zmian w Swifcie.
- **Łączny limit hamulca** (60 żądań/60 min ze wszystkich miejsc) ogranicza
  przejście do ~5 przebiegów na godzinę. Zachowanie poprawne; gdyby kiedyś
  przeszkadzało, decyzją jest podniesienie progu, nie omijanie go w sondzie.

### Co powinno być TRZECIM przejściem na sucho

Dwa pierwsze szły drogą sprzedaży: pierwsze tą, która się udaje, drugie tą,
która się nie udaje. Obie są dziś obstawione harnessem, więc trzecie ma sens
tylko wtedy, gdy pójdzie tam, gdzie harness nie sięga:

1. **Oczami klienta, w prawdziwej przeglądarce.** Wszystko, co klient dostaje —
   trzy maile, strona oferty, strona umowy, wydruk PDF, formularz opinii — na
   telefonie i na desktopie, po polsku i po niemiecku. To jedyna warstwa
   nietknięta przez oba przejścia i jedyna, którą widzi ktoś z zewnątrz.
2. **Drugi rok obrotowy.** Numeracja dokumentów, wygasające terminy, retencja
   leadów (24 mies.), faktury cykliczne przez zmianę roku. Nic z tego nie
   pojawia się w przejściu, które trwa dziesięć minut.
3. **Awarie i brzegi.** Zerwane żądanie w połowie wysyłki, dwie karty otwarte
   na tym samym dokumencie, klient klikający dwa razy, `RESEND_API_KEY`
   nieustawiony. Kilka z nich już raz coś kosztowało (idempotencja wysyłki,
   Audyt Poczty), ale nigdy nie były przechodzone razem.

Czego trzecie przejście robić NIE musi: sprawdzać ręcznie tego, co robi
`npm run przejscie`. Od tego jest jedno polecenie i 101 zdań.
