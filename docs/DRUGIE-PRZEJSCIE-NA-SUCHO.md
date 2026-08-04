# Drugie przejście „na sucho" — droga, na której wszystko idzie nie tak

**Data:** 2026-08-04. **Środowisko:** lokalne (`npm run dev`, dev-baza PGlite,
dev-login). **Punkt startu:** `e4f40b2`. **Nic nie zostało naprawione** — to
jest lista, nie zestaw poprawek.

Plan: `docs/DRUGIE-PRZEJSCIE-PLAN.md`. Forma wzorowana na
`docs/PIERWSZE-PRZEJSCIE-NA-SUCHO.md`.

> **Ten dokument jest MIGAWKĄ z 2026-08-04 i celowo się go nie aktualizuje.**
> Znaleziska są ponumerowane w grupach, żeby dało się je zaadresować pojedynczo.
> Każde ma dowód: co widziałem na ekranie albo co siedzi w bazie.

---

## Co zostało przeprowadzone

Wymyślony klient: **Chłodnie Wisła sp. z o.o.** (Toruń, transport chłodniczy),
osoba kontaktowa Karolina Bąk. Sześciu kierowców, ok. 60 dokumentów CMR dziennie
przepisywanych ręcznie do TMS; skany nie mogą opuszczać firmy (klauzula w umowach
z sieciami handlowymi) → lokalny model.

| krok | wynik |
|---|---|
| lead z targów (Networking) | `Chłodnie Wisła sp. z o.o.`, rozmowa telefoniczna w logu |
| oferta v1 | `OF-2026-4EC0A2`, 18 000 zł, 3 pozycje, 2 sekcje, blok ROI |
| wysyłka | mail + link klienta, migawka, „Otworzył ofertę 1×" |
| **klient ODRZUCA** | powód „Za drogo" + komentarz, zapisane na osi czasu klienta |
| **nowa wersja** | `v2`, 11 000 zł (bez wdrożenia do TMS), wysłana |
| akceptacja | projekt + szkic faktury, lead → „Zamknięte - sukces" |
| umowa | `UM-2026-F3DD15`, 11 000 zł, zaliczka 40%, podpisana obustronnie |
| **aneks nr 1** | +wdrożenie do TMS, 15 000 zł, termin 15.09 — podpisany |
| **aneks nr 2** | przesunięcie terminu na 15.10 — **zostawiony jako szkic** |
| **projekt** | zdrowie: Na dobrej drodze → **Zagrożony** → **Zerwany** |
| faktura | `FV 93/2026`, 13 530 zł brutto, wystawiona, 14 dni po terminie |
| **brak zapłaty → przypomnienie** | poziom 2 („stanowcze"), mail wyszedł |
| **wezwanie** | `FV 94/2026` (48 dni po terminie) → `WZ-2026-B53FDF`, mail + dokument |

**Łańcuch dokumentów trzyma się w całości.** Oferta → umowa → aneksy → projekt →
faktura są ze sobą powiązane i widoczne w grafie „SKĄD I DOKĄD" w każdym module.
Oś czasu klienta zapisała **wszystkie 18 zdarzeń** tej drogi, z powodem
odrzucenia włącznie.

To, co niżej, to miejsca, w których panel robi coś nieprawdziwego, milczy,
albo nie daje żadnej drogi.

---

## Co zadziałało (żeby lista awarii nie przesłoniła reszty)

- **Bramka przedwysyłkowa (Faza 2) zarabia na siebie.** Zatrzymała wysyłkę oferty
  bez adresu odbiorcy, ostrzegła przed ofertą bez sekcji, a przy wersji 2 złapała
  dokładnie problem **A4 z pierwszego przejścia**: „Dokument podaje dwa różne
  czasy realizacji: »3 tyg. (pole Czas realizacji)« i »4 tygodnie«. Klient
  przeczyta oba." Sekcja „Terminy" była odziedziczona po v1 i faktycznie kłamała.
- **Adres klienta dociąga się do dokumentu-szkicu sam** — bramka to obiecuje
  i dotrzymuje (sprawdzone: PATCH karty klienta → pola `klient_ulica/kod/miasto/nip`
  na ofercie wypełnione bez dotykania oferty).
- **Potwierdzenia (Faza 4) stoją tam, gdzie trzeba.** Wystawienie faktury wymaga
  **przepisania nazwy nabywcy** — to zamyka **D1** z pierwszego przejścia.
  Wysyłka oferty, wysyłka umowy, nowa wersja, oznaczenie podpisu i wezwanie —
  każde pyta, każde mówi, co się stanie i czego nie da się cofnąć.
- **„Było/jest" w aneksie bierze warunki OBOWIĄZUJĄCE.** Hipoteza z planu
  („przy drugim aneksie to się rozjeżdża najłatwiej") **jest nieprawdziwa**:
  `poprzednie` aneksu nr 2 to `{cena: 15000, termin: 2026-09-15}` — czyli
  z aneksu nr 1, nie z pierwotnej umowy (11 000 / 25.08). Wydruk pokazuje też
  **tylko pola zmienione** (§1 Termin), a nie wszystkie.
- **Eskalacja windykacji nie cofa się w dół** i widać poziom **przed** kliknięciem:
  przycisk nazywa się „Wyślij przypomnienie **(stanowcze przypomnienie)**", a po
  wezwaniu zostaje już tylko „Wyślij wezwanie **ponownie**".
- **Oś czasu klienta jest kompletna** — łącznie z „Klient otworzył ofertę"
  i pełnym powodem odrzucenia.
- **Bariery na dokumentach zamkniętych działają:** PATCH treści zaakceptowanej
  oferty → **409** z wyjaśnieniem, wystawiona faktura zablokowana do edycji.
- Z pierwszego przejścia potwierdzone jako **zamknięte**: **A2, A3** (wystawca
  z adresem na ofercie i wydruku), **B1** (oferta z leada bierze komplet danych),
  **B2** (e-mail nabywcy na fakturze), **B3** (faktura zna umowę), **B4**
  (formularz leada ma 7 pól), **B5** (termin z oferty idzie do umowy), **D1**, **D4**.
- **A5 jest nadal otwarte** i widać je na wydruku aneksu: nasza strona podpisana
  `ZLECENIODAWCA / WYKONAWCA`, druga `DRUGA STRONA`, a klauzule i rubryki podpisu
  mówią `WYKONAWCA` / `ZAMAWIAJĄCY`. To znane, nie nowe.

---

## A. ZEPSUTE — panel robi coś nieprawdziwego

### A1. Odrzuconą ofertę klient może zaakceptować starym linkiem
**Najpoważniejsze znalezisko całego przejścia.**

Po oznaczeniu oferty jako **Odrzucona** (z powodem „Za drogo") strona pod linkiem
klienta wygląda dokładnie tak samo jak przed odrzuceniem: pełna treść, „WAŻNA DO
25.08.2026", działający przycisk **„Akceptuję ofertę"**. Ani słowa o tym, że
oferta jest martwa.

Serwer też jej nie broni. Sprawdzone na osobnej ofercie-atrapie (wysłana →
oznaczona `Odrzucona` → akceptacja publiczną trasą):

```
POST /api/offers/public/<token>/accept   →  HTTP 200
{"ok":true,"acceptedByName":"Ktoś Z Linkiem"}
```

Po tym w bazie:

```
status: 'Zaakceptowana'      accepted_by_name: 'Ktoś Z Linkiem'
project_id: d164310a-…       invoice_id: 59d5c1ed-… (Szkic, 100 zł)
powod_odrzucenia: 'Za drogo'  odrzucona_at: 2026-08-04 13:56:46
```

Czyli: **powstał projekt i szkic faktury**, a rekord twierdzi jednocześnie, że
oferta została odrzucona „bo za drogo" i zaakceptowana.

Bramka akceptacji **istnieje** i sprawdza dwie rzeczy — po prostu nie tę:

| stan oferty | odpowiedź trasy |
|---|---|
| `Zaakceptowana` | 400 „Oferta jest już zaakceptowana." |
| po `wazna_do` | 409 „Oferta jest przeterminowana (minęła data ważności)." |
| **`Odrzucona`** | **200 — przyjęta** |
| **zastąpiona nową wersją** | **200 — przyjęta** (patrz A2) |

### A2. Nowa wersja oferty nie unieważnia linku do poprzedniej
Okno potwierdzenia obiecuje: „Obecna zostanie oznaczona jako zastąpiona". Jest to
prawda **wyłącznie wewnątrz panelu**. Po zrobieniu wersji 2:

- stary link `…/pl/oferta/b31fa69dc7ed…` **nadal otwiera pełną ofertę v1**
  (18 000 zł, „WAŻNA DO 25.08.2026") z działającym „Akceptuję ofertę",
- w bazie `share_revoked_at = None` przy `superseded_at` ustawionym,
- klient ma teraz **dwa żywe linki** i drugiego maila, który nie mówi ani słowa
  o tym, że unieważnia pierwszą ofertę (patrz D3).

Sprawdzone na atrapie, że to nie jest kosmetyka — akceptacja **zastąpionej**
oferty starym linkiem: `HTTP 200`, `status: Zaakceptowana`, `projekt: True`,
`faktura: True`. Czyli **projekt i faktura po nieaktualnej, wyższej cenie**.

Panel ma przycisk „Unieważnij link" — przepływ nowej wersji po prostu z niego
nie korzysta.

### A3. Nowa wersja kasuje fakt, że poprzednia została odrzucona
Zrobienie wersji 2 zmienia poprzedniej ofercie status **`Odrzucona` → `Wygasła`**.

```
przed:  status 'Odrzucona'  powod_odrzucenia 'Za drogo'  odrzucona_at 13:52
po:     status 'Wygasła'    powod_odrzucenia 'Za drogo'  superseded_at 13:59
```

Powód i komentarz zostają w bazie, ale **status kłamie**. Okno powodu odrzucenia
mówi: „Po kilkunastu ofertach to jedyne miejsce, z którego da się odczytać, na
czym realnie przegrywasz" — a najzwyklejsza reakcja na odrzucenie (nowa wersja)
tę informację ze statusu wymazuje. W rejestrze zostały dwa rekordy
z `powod_odrzucenia = 'Za drogo'` i statusami `Wygasła` oraz `Zaakceptowana`.

### A4. Windykacja twierdzi, że pisała wcześniej — a nie pisała
Faktura `FV 93/2026`, `reminder_level = 0`, panel wyświetla „**Jeszcze nic nie
wysłano.**". Kliknąłem jedyne dostępne „Wyślij przypomnienie". Do klienta poszło:

```
Temat: Druga prośba o płatność — faktura FV 93/2026 po terminie

nadal nie odnotowaliśmy płatności za fakturę nr FV 93/2026 …
— to już druga wiadomość w tej sprawie.
```

To była **pierwsza** wiadomość. To samo, mocniej, przy wezwaniu (`FV 94/2026`,
też `reminder_level = 0`, też „Jeszcze nic nie wysłano"):

```
pomimo wcześniejszych przypomnień nie odnotowaliśmy płatności …
```

— i identyczne zdanie trafia na **formalny dokument** `WZ-2026-B53FDF`:
„Pomimo wcześniejszych przypomnień, do dnia dzisiejszego nie odnotowaliśmy
zapłaty…". Poziom eskalacji liczy się z dni zwłoki, a treść szablonu opisuje
historię korespondencji, której nie było.

### A5. Data w mailach windykacyjnych w formacie bazy
Oba maile podają termin jako **`2026-07-21`** i **`2026-06-17`**. Dokument
wezwania robi to poprawnie (`17.06.2026`), więc to defekt szablonów mailowych,
nie globalny. `CLAUDE.md` mówi wprost: nigdy surowego ISO z bazy, zawsze
`formatPlDate()`.

### A6. Projekt nie bierze terminu z umowy — mimo że panel to obiecuje
Edytor oferty pisze pod polem „Czas realizacji": *„Umowa policzy z tego konkretną
datę, **a projekt weźmie ją przy podpisie**."*

Nie bierze. Trzy dokumenty, trzy daty:

| dokument | termin |
|---|---|
| oferta v2 (3 tyg. od akceptacji) | 25.08.2026 |
| umowa `UM-2026-F3DD15` | 25.08.2026 |
| **projekt** | **22.09.2026** |
| aneks nr 1 (podpisany) | 15.09.2026 |

Podpisanie umowy **dotknęło** projektu (`updated_at` się zmienił, status skoczył
„Planowanie" → „W trakcie"), ale terminu nie ruszyło. 22.09 pochodzi z szablonu
projektu („Automatyzacja / integracja"), który wstawił własne 4 kamienie milowe —
w tym „Wdrożenie" i „Uruchomienie", czyli prace **usunięte z oferty** w wersji 2.
Podpisanie aneksu (15.09) też nic nie zmieniło.

Reguła w *Zdrowiu* „Projekt z podpisaną umową ma termin" tego nie łapie —
sprawdza obecność daty, nie jej zgodność.

### A7. Aneks nr 2 powołuje się na dokument, w którym tej treści nie ma
Wydruk aneksu nr 2:

```
ANEKS NR 2  do umowy UM-2026-F3DD15  zawartej dnia 04.08.2026
§ 1 TERMIN REALIZACJI
DOTYCHCZASOWE BRZMIENIE   15.09.2026
NOWE BRZMIENIE            15.10.2026
```

W umowie `UM-2026-F3DD15` termin to **25.08.2026**. Data 15.09 pochodzi z aneksu
nr 1 (`UM-2026-F65269`), którego dokument nie wymienia ani razu. Wartości są więc
policzone **dobrze** (patrz „Co zadziałało"), ale `poprzednie.reference` wskazuje
pierwotną umowę. Ktokolwiek zweryfikuje aneks nr 2 przeciwko umowie, którą on sam
wskazuje, znajdzie rozbieżność.

### A8. Szkic faktury nie idzie za podpisanym aneksem
Aneks nr 1 podniósł wynagrodzenie 11 000 → 15 000 zł i został **podpisany**.
Szkic faktury dalej ma dwie pozycje i 11 000 zł netto. Graf „SKĄD I DOKĄD"
pokazuje to obok siebie — `ANEKS nr 1 · Podpisana · 15 000,00 zł` i
`FAKTURA · Szkic · 11 000,00 zł` — i nic tego nie oznacza jako problemu.
Na fakturze rubryka „WYNIKA Z" wymienia ofertę i umowę, **aneksu nie wymienia**.

---

## B. PANEL MILCZY — porażka nie wywołuje żadnego sygnału

### B1. Odrzucona oferta nie zostawia śladu poza samą ofertą
Po odrzuceniu (z powodem i komentarzem „chcą sam PoC na dwóch trasach") panel nie
odezwał się **nigdzie**:

- Pulpit: brak jakiejkolwiek wzmianki o Chłodniach; „Propozycje" pokazują
  wyłącznie zaszłość z danych próbnych; „Oferty bez decyzji" → *„Nic — żadna
  wysłana oferta nie czeka za długo."*
- lead: status **`Do kontaktu`**, `next_action` puste, `next_followup` puste,
- mapa procesu leada: **2/15 „Pierwszy kontakt"**, a podpowiedź brzmi
  *„Zrób pierwszy ruch: telefon lub krótki, spersonalizowany mail"* — po tym,
  jak oferta wyszła, została otwarta i odrzucona,
- log aktywności leada: tylko mój ręczny wpis. Ani utworzenia oferty, ani wysyłki,
  ani otwarcia przez klienta, ani odrzucenia.

Dla porównania **wygrana jest automatem**: akceptacja v2 sama przestawiła lead na
`Zamknięte - sukces`. Porażka nie robi nic.

### B2. Projekt „Zagrożony" i „Zerwany" nie istnieje poza własną kartą
Przestawiłem zdrowie na `Zagrożony`, potem `Zerwany`. Obie zmiany trafiły do
dziennika projektu — i na tym koniec:

- Pulpit: zero wzmianek (`Chłodnie`, `Zerwan` — brak trafień). Nie ma sekcji
  „projekty zagrożone"; są tylko „Projekty z minionym terminem" i „Kamienie po
  terminie", a nasz termin to 22.09, więc nie łapie się do żadnej.
- `status` projektu został **`W trakcie`**, więc wszędzie liczy się jako praca
  w toku,
- karta projektu przy `Zerwany` pokazuje: *„Zdrowie: Zerwany · Status: W trakcie ·
  Daty 04.08.2026 → 22.09.2026 · **za 49 dni**"* i nie proponuje niczego.

Oś, która istnieje wyłącznie po to, żeby powiedzieć „to idzie źle", nie jest
widoczna w żadnym miejscu, do którego zagląda się codziennie.

### B3. Karta klienta nie wie o niczym, co się wydarzyło
Po rozmowie telefonicznej, dwóch ofertach, podpisanej umowie, podpisanym aneksie,
dwóch wystawionych fakturach, przypomnieniu i **wezwaniu do zapłaty**:

```
status:          Prospekt
ostatni_kontakt: —
Odzywaj się:     Bez pilnowania
PROCES SPRZEDAŻY: 3/15 „Rozmowa kwalifikująca"
```

Oś czasu obok ma komplet 18 zdarzeń. Czyli panel **zapisuje wszystko i nie
wyciąga z tego nic**: pola stanu klienta zostały tam, gdzie były w pierwszej
minucie.

### B4. Nic nie przypomina o niepodpisanym aneksie
Aneks nr 2 wisi jako `Szkic` przy projekcie, który w międzyczasie został zerwany.
Nie pojawia się w „Umowy czekające na podpis" (tam jest tylko zaszłość z danych
próbnych), nie ma go w propozycjach, nie ma nigdzie.

---

## C. BRAK — nie ma jak czegoś zrobić

### C1. Klient nie ma jak odrzucić oferty
Strona klienta daje dwie drogi: **„Akceptuję ofertę"** i **„Wyślij prośbę
o zmianę"** („To nie jest akceptacja oferty"). Nie ma „Dziękuję, rezygnujemy".
Odrzucenie da się zapisać wyłącznie ręcznie w panelu, po tym jak klient napisze
o tym mailem — a więc dokładnie ta informacja, którą panel nazywa „jedynym
miejscem, z którego da się odczytać, na czym realnie przegrywasz", zależy od tego,
czy właściciel pamięta, żeby ją wklepać.

### C2. Nie da się wysłać łagodnego przypomnienia
Poziom eskalacji jest funkcją **wyłącznie dni zwłoki**; nie da się go wybrać.
Skutki widziałem oba:

- `FV 93/2026`, 14 dni po terminie, nic nigdy nie wysłane → jedyny przycisk to
  „Wyślij przypomnienie **(stanowcze przypomnienie)**", czyli od razu poziom 2,
- `FV 94/2026`, 48 dni po terminie, nic nigdy nie wysłane → jedyny przycisk to
  „**Wyślij wezwanie do zapłaty**". Pierwszym kontaktem w sprawie długu jest
  formalne wezwanie.

Pytanie z planu („czy da się wysłać wezwanie przez pomyłkę?") ma odpowiedź
gorszą niż „da się": **nie ma czego wybrać**. Faktura, o której zapomniało się na
dwa miesiące, nie da się już potraktować miękko.

### C3. Drugi aneks można zrobić tylko z pierwotnej umowy
Na podpisanym **aneksie** nie ma przycisku „Sporządź aneks" — jest tylko na
umowie bazowej. Działa (patrz „Co zadziałało"), ale to jedyna droga i to ona
powoduje A7: dokument dziedziczy referencję po umowie, z której go zaczęto.

### C4. Wezwanie do zapłaty nie ma podpisu ani kontaktu do wierzyciela
Dokument `WZ-2026-B53FDF` kończy się kwotą i numerem rachunku. Nie ma rubryki
podpisu, nie ma imienia i nazwiska (panel zna: *Podpisuje umowy: Patryk Piecyk*),
a blok `WIERZYCIEL` zawiera nazwę, adres i NIP — **bez e-maila i telefonu**.
Dłużnik, który chciałby się dogadać, nie ma z dokumentu do kogo napisać.

---

## D. TARCIE — działa, ale trzeba zgadywać albo się cofać

### D1. Na szkicu i na odrzuconej ofercie głównym przyciskiem jest „Akceptuj ofertę"
Jedyne wyróżnione CTA w kolumnie akcji to `✓ Akceptuj ofertę` — także wtedy, gdy
oferta jest dopiero **szkicem** (klient jej nie widział) i wtedy, gdy jest
**odrzucona**. „Wyślij mailem" leży niżej, wśród przycisków drugorzędnych.
Kolejność ekranu jest odwrotna do kolejności życia.

Przy okazji: na odrzuconej ofercie karta „WAŻNOŚĆ" dalej odlicza — *„Wygasa za
21 dni."*

Sam przycisk jest w istocie rozwijaczem: kliknięcie w jego środek nie akceptuje
niczego, tylko otwiera listę szablonów projektu. Zgadłem to dopiero po tym, jak
kliknięcie „nic nie zrobiło".

### D2. Nowa wersja oferty zeruje trzy pola i nie przypomina, po co powstaje
`v2` odziedziczyła pozycje, sekcje i dane klienta, ale wyzerowała:
`wazna_do` (`null`), `czas_realizacji_tygodnie` (`4 → 0`) i **cały blok ROI**
(`roi_godziny 80 → 0`, `roi_stawka 45 → 0`). ROI to argument sprzedażowy, który
po prostu znika z dokumentu. Pola mają podpowiedzi („Puste — blok zwrotu nie
pojawi się na ofercie"), więc nie jest to całkiem po cichu — ale nic nie mówi,
że **w poprzedniej wersji było to wypełnione**.

Drugie: edytor v2 pokazuje w nagłówku `wersja 2`, ale **nie linkuje do v1 i nie
powtarza powodu odrzucenia**. Powód („Za drogo — zarząd uciął budżet, chcą sam
PoC") widać wyłącznie na starej ofercie. Ekran, na którym piszesz odpowiedź na
odrzucenie, nie pokazuje odrzucenia.

### D3. Maile do klienta nie znają ani jego, ani nas
Wszystkie cztery maile z tej drogi zaczynają się „**Dzień dobry,**" (panel zna
`osoba_kontaktowa = Karolina Bąk`) i kończą „**Pozdrawiamy, Leggera Labs**"
(panel zna `osoba_podpisujaca = Patryk Piecyk`). Jednoosobowa firma pisze
w liczbie mnogiej i bez nazwiska — także pod wezwaniem do zapłaty.

Mail z ofertą nie podaje też **daty ważności**, choć panel ją zna i po niej
oznacza ofertę jako wygasłą.

### D4. Mail z nową wersją nie mówi, że coś zastępuje
Mail o wersji 2 jest co do formy identyczny z mailem o wersji 1 — „w załączeniu
link do oferty: …". Że to poprawiona wersja, wynika **tylko** z tytułu, który
sam wpisałem. Nie ma zdania „poprzednia oferta przestaje obowiązywać", a stary
link dalej działa (A2).

### D5. Hamulec publicznych dokumentów liczy też próby odrzucone walidacją
Po pięciu żądaniach do publicznych tras dokumentów w ciągu godziny (część z nich
to były próby odrzucone walidacją, np. puste imię) dostałem:

```
HTTP 429  {"error":"Zbyt wiele prób. Spróbuj ponownie za 60 min."}
```

W *Zdrowiu*: „[hamulec] Zablokowano po 5 nieudanych próbach (dokument-publiczny)
w 60 min z jednego adresu." Limit jest wspólny dla wszystkich dokumentów z jednego
adresu IP. Klient, który pomyli się kilka razy przy wpisywaniu nazwiska, zostaje
odcięty na godzinę komunikatem, który nie mówi, co robić dalej.

### D6. Chipy powodu odrzucenia nie mają stanu dostępnościowego
Przyciski „Za drogo / Nie ten termin / …" w oknie odrzucenia niosą zaznaczenie
wyłącznie kolorem — brak `aria-pressed`, brak `role="radio"`. Zmierzone:
wszystkie mają `aria-pressed === null`, wybrany różni się tylko klasą.

---

## Uwagi metodyczne

- **Dane sprzedawcy uzupełniłem na starcie** (`Leggera Labs Patryk Piecyk`, NIP,
  adres, konto — z palca), żeby dokumenty odrzucenia, aneksu i wezwania oceniać na
  komplecie danych, a nie powtarzać zamkniętego już A2. Wartości siedzą wyłącznie
  w dev-bazie PGlite.
- **Podział pracy narzędziami.** Decyzje (odrzucenie, nowa wersja, akceptacja,
  podpisy, wystawienie faktury, przypomnienie, wezwanie) klikałem w panelu.
  Wypełnianie treści (pozycje i sekcje ofert, warunki aneksów, daty faktur)
  robiłem trasami API, bo wpisywanie z klawiatury w tym podglądzie regularnie
  gubiło fokus i sklejało tekst między polami. Wszystkie znaleziska sprawdzone
  drugim kanałem — odczytem bazy przez API albo logiem serwera z treścią maila.
- **Trzy artefakty środowiska**, które trzeba znać przy powtarzaniu:
  `requestAnimationFrame` daje **0 klatek** (karta jest `hidden`), więc animacje
  wejścia i wyjścia nigdy się nie kończą: modale bywają **niewidoczne na zrzucie,
  choć są otwarte i klikalne**, a zamknięte menu **zostają w DOM** jako
  osierocone węzły. Viewport potrafi sam zapaść się do `0×0` — wymusiłem
  `resize_window` na 1440×900 i dopiero wtedy panel renderował wariant desktopowy.
  Dwa razy uznałem coś za zepsute, zanim się okazało, że po prostu nie widzę
  otwartego okna.
- **Co zostało w dev-bazie po testach** (do wyczyszczenia restartem serwera):
  leady `TEST ŹRÓDŁA`, oferty `ATRAPA — test bramki akceptacji` i `ATRAPA 2 —
  wygasła` wraz z projektami i szkicami faktur, które powstały z ich akceptacji.
  Powstały wyłącznie po to, żeby rozstrzygnąć A1 i A2 bez psucia głównej historii.
- **Dwie rzeczy, które podejrzewałem, a które się nie potwierdziły** i dlatego ich
  wyżej nie ma:
  - „formularz *Nowy lead* gubi wybrane źródło" — przy czystej reprodukcji
    wybrane `Polecenie` zapisało się poprawnie; za pierwszym razem po prostu nie
    trafiłem w pozycję menu,
  - „kliknięcie w tło kasuje wypełniony formularz bez pytania" — zdarzyło mi się
    raz naprawdę (straciłem komplet danych leada), ale **nie udało się tego
    powtórzyć**: przy powtórce kliknięcie w tło modalu w ogóle go nie zamknęło.
    Zostawiam jako sygnał, nie jako znalezisko.
- **Nie sprawdzałem wyglądu.** Zgodnie z zastrzeżeniem z planu: przy martwym
  `requestAnimationFrame` i niestabilnym viewporcie pomiary wizualne byłyby
  zgadywaniem. Wszystko powyżej to przepływ, dane i treść wychodząca do klienta.
