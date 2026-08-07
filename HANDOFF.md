# Handoff — stan na 2026-08-07, po windykacji i decyzjach wizualnych

> **PLAN NA NASTĘPNY CZAT — czytaj to najpierw.**
>
> Panel na `594329c`, apka na `f4def06`. Oba drzewa czyste, wszystko
> wypchnięte. `tsc` czysto · `npm test` **371/371** · `npm run przejscie`
> **125 działa · 0 regresji** · `swift test` **16/16**.
>
> **W tym czacie zamknięto DWIE rzeczy, obie decyzją właściciela:**
> windykację (wariant 2) oraz trzy pytania wizualne z etapu 4 (warianty „1 i 1",
> plus czwarte pytanie, które wyszło po drodze). Wszystko zmierzone, wdrożone
> i wypchnięte — **nie ma tu niedokończonej roboty do przejęcia.**
> Materiał i dowody: `docs/DECYZJE-WIZUALNE.md` (cztery punkty, stan przed/po).
>
> **WINDYKACJA ROZSTRZYGNIĘTA 2026-08-07 — wariant 2, decyzja właściciela.**
> Formalne wezwanie do zapłaty z odsetkami **przestało wychodzić automatem**;
> poziomy 1–2 (+3, +10 dni) zostają. Po 21 dniach faktura staje na Pulpicie
> w sekcji „Wezwanie czeka na Twoją decyzję". Pełny opis, dowody i reguła:
> `docs/ETAP-1-WYNIK.md` → C1 oraz `CLAUDE.md` → „Świadome decyzje produktowe".
> **Panel nie ma już ANI JEDNEGO miejsca, w którym wiadomość wychodzi do
> prawdziwej osoby bez kliknięcia właściciela.**
>
> **Pulpit: właściciel jeszcze z nim nie pracował** (zapytany 2026-08-07). Trzy
> decyzje o hierarchii (Pulpit, Faktury, Oferty) dalej stoją na kodzie, nie na
> jego praktyce — **zapytaj go ponownie**, cofnięcie wciąż jest tanie. Nie
> powtarzaj przeglądu hierarchii i **nie „naprawiaj" Statystyk** (patrz niżej).
>
> **Apka jest równo z panelem** — sekcja „Wezwanie czeka na Twoją decyzję"
> weszła na telefon tego samego dnia (`d2e98ee`, drugi przycisk `880307e`, iPhone `f4def06`),
> obejrzana w symulatorze przeciwko lokalnemu panelowi. Nic z tej decyzji nie
> zostało otwarte.
>
> **REKOMENDOWANY PIERWSZY RUCH: zapytaj właściciela o Pulpit** (patrz wyżej)
> i o zgłoszenia z `docs/PRZEGLAD-UI-LISTA.md`. Obie rzeczy blokują robotę,
> której nie da się zrobić bez niego, a reszta DROGI B to decyzje, nie kod.
>
> **DROGA A — etap 5 (poprawki ze zgłoszeń).** Wymaga, żeby właściciel
> najpierw przeszedł to, co mu zostało w `docs/PRZEGLAD-UI-LISTA.md`:
> B1 (drugi i trzeci punkt), B2 na wdrożonym panelu, B3 na PAPIERZE, B4 palcem
> na telefonie i iPadzie, oraz **jedno pytanie z B6** (czy dokument
> pomniejszony na telefonie do 49% przeszkadza). Bez tych zgłoszeń etap 5 nie
> ma wsadu. **Zapytaj o nie na starcie czatu.**
>
> **DROGA B — decyzje, które czekają i nie zależą od etapu 5:**
> 1. **Kwadraciki na kartach Tablicy** — jedyna niedomknięta z czterech decyzji
>    wizualnych. **Nie ma dla niej rekomendacji świadomie**: test kliknięcia
>    w podglądzie przestał być rozstrzygający, więc rozstrzyga palec właściciela
>    przy etapie 5 (B4). Trafi obok choć raz → poprawka to rozsunięcie kart
>    o 4 px. Szczegóły: `docs/DECYZJE-WIZUALNE.md`, punkt 2.
>    **Punkty 1, 3 i 4 tego dokumentu są WDROŻONE i zmierzone** (2026-08-07) —
>    nie zaczynaj ich od nowa i nie mierz tego jeszcze raz.
> 2. **Godziny automatów mogą być w UTC** — do potwierdzenia obserwacją
>    właściciela, nie da się stąd. Po decyzji o windykacji waży mniej: o tej
>    godzinie nie wychodzi już żadne pismo formalne, tylko przypomnienia.
> 3. **Czy apka ma wysyłać `x-znany-stan`** — dziś nie wysyła, więc wykrywanie
>    rozjazdu dwóch kart na telefonie milczy. Robota w `../leggera-hub-ios`.
>
> **Czego NIE robić:** wszystkiego z sekcji „Czego NIE zaczynać bez wyraźnej
> prośby" na końcu tego pliku, i nie przechodzić ręcznie tego, co robi
> `npm run przejscie`.

---

## Decyzje wizualne — ZAMKNIĘTE 2026-08-07 (`e0b7b4e` … `594329c`)

Trzy pytania z etapu 4 czekały na właściciela opisane jednym zdaniem każde.
Zmierzone i przedstawione z wariantami (`docs/DECYZJE-WIZUALNE.md`), właściciel
wybrał, wdrożone tego samego dnia. **Czwarte pytanie wyszło po drodze.**

| punkt | rozstrzygnięcie |
|---|---|
| 1. kontrolki na kartach Projektów | rozsunięte, pudełka 24×24, **środki dokładnie 24 px, 0 kolizji** (było 17) |
| 2. kwadraciki na Tablicy | **OTWARTE** — rozstrzyga palec właściciela przy etapie 5 |
| 3. cele w listach kompaktowych | podniesione do 24 px, **odstępy wierszy nietknięte** |
| 4. usuwanie w wierszu tabeli | ✕ **wyszedł z wiersza do menu „…"**, wzorzec Lineara |

**Trzy rzeczy warte pamięci — każda kosztowała rundę:**

1. **Notatka z etapu 4 zawyżała cenę punktu 3.** Pisała, że podniesienie celów
   „zmieniłoby gęstość wszystkich list". Zmierzone: cel miał 20–22 px,
   a sąsiednie wiersze dzieli 31–34 px, więc 24 px zmieściło się w istniejącym
   odstępie. **Zdanie w dokumencie nie jest pomiarem.**
2. **Desktop nie wystarcza — i to trzeci raz w tym tygodniu.** Telefon dołożył
   dwa cele niewidoczne na szerokim ekranie (nagłówek listy, znak w pasku),
   a iPad odsłonił CAŁY widok, którego sonda nie objęła (`Leady → Tabela`:
   na telefonie zamienia się w karty, na desktopie miałem włączoną Tablicę).
   **Sonda mierzy to, co widoczne — „0" znaczy „0 w tym widoku".**
3. **Punkt 4 nie był pytaniem o piksele.** „Usuń" stał 22,5 px od „Otwórz
   profil", więc pudełka 24×24 by się zderzyły. Okazało się, że panel MIAŁ już
   menu pod prawym przyciskiem z „Usuń" w środku — goły ✕ był **duplikatem
   akcji, która ma bezpieczniejszą drogę**. Rozwiązanie topowych produktów
   (Linear, GitHub, Notion, Airtable, Attio): nie powiększaj celu obok akcji
   niszczącej, tylko **zabierz akcję niszczącą z wiersza**.

**Pułapka pomiarowa, która wróci:** podgląd ma `document.hidden = true`, więc
przejścia CSS nie ruszają z miejsca — `getComputedStyle` przy aktywnym `:hover`
zwracał `opacity: 0` i działająca reguła wyglądała na martwą. **Mierząc cokolwiek
z `transition`: najpierw `transition: none`, potem czytaj.**

---

## Windykacja — decyzja i co po niej zostało (2026-08-07)

Wariant 2 z trzech przedstawionych: **sufit automatu na poziomie 2**. Granica
mieszka w `lib/invoices.ts` (`MAKS_POZIOM_AUTOMATU`, `poziomAutomatuDlaDni()`,
`czekaNaDecyzjeOWezwaniu()`), nie w `if`-ie w trasie — bo zna ją też Pulpit.

Gałąź wysyłki wezwania w cronie została **usunięta, nie wyłączona warunkiem**.
Jedynym nadawcą jest `POST /api/invoices/[id]/remind`; druga kopia (token,
odsetki, sygnatura, `wezwanie_wystawiono_at`) rozjechałaby się z tamtą przy
pierwszej zmianie — dokładnie tak, jak rozjechały się bliźniacze sprawdzenia
pozycji faktury i oferty w etapie 3.

**Znalezisko po drodze, warte więcej niż sama poprawka:** trasa pozycji
FAKTURY czyta `cena_netto`/`vat_stawka`, a bliźniacza trasa pozycji OFERTY —
`cena`. Nieznanych pól żadna nie odrzuca (`Number(undefined)` → NaN → 0), więc
linia 1855 `przejscie.ts` od zawsze zakładała pozycję za **0 zł** i cały blok
windykacji jechał na fakturze wartej **0,00 zł**. Nic tego nie zgłaszało: żadne
zdanie nie patrzyło na kwotę, a `tsc` o nazwach pól w JSON-ie nie wie. Wyszło
dopiero wtedy, gdy nowa sekcja Pulpitu zaczęła tę kwotę **pokazywać**.
**Tanie sprawdzenie na przyszłość:** przy bliźniaczych trasach porównaj nazwy
pól w `body`, zanim skopiujesz wywołanie z sąsiedniego bloku.

Zmierzone w przeglądarce (nie „na oko"): przycisk **108×24 px**, kontrast
**5,76:1** w spoczynku i **5,25:1** na hover (liczony po złożeniu z tłem),
przy 390 px `scrollWidth` = `innerWidth` = 390, kliknięcie stawia okno
`wezwanie-wyslij`, a „Anuluj" **nie** zdejmuje wiersza z listy.

**Apka dogoniła tego samego dnia** (`d2e98ee` + `880307e`, `swift test` 16/16).
Wiersz ma dwie pastylki — „Wyślij wezwanie" i ciszej „Otwórz fakturę" (drugą
dołożono na prośbę właściciela: przed pismem o takim ciężarze ma gdzie sprawdzić,
do kogo idzie). Przy okazji domknęła się starsza luka: `PulpitFaktura` ignorowała
`zaplacono` i `waluta`, choć trasa oddawała je od zawsze — przy fakturze
opłaconej CZĘŚCIOWO panel pokazywał, ile zostało, a telefon całą kwotę brutto.

**Lekcja z apki, która się powtórzy — `NavigationLink` w wierszu `List` psuje
przyciski na DWA różne sposoby.** Rozciągnięty na wiersz **przechwytuje tapy
całej komórki**: „Wyślij wezwanie" otwierało fakturę zamiast wysyłać,
a `.buttonStyle(.borderless)` na rzędzie tego nie ratowało. Zamknięty w pastylce
OBOK przycisku tapów już nie kradnie, ale **ignoruje `ButtonStyle`** (pastylka
się nie rysuje) i dokłada systemową strzałkę na prawej krawędzi wiersza — wiersz
wygląda, jakby cały prowadził do rekordu. Działa dopiero zwykły `Button`
dokładający cel do `NavigationPath`. Wszystkie trzy stany widać WYŁĄCZNIE
przebiegiem na symulatorze: kompiluje się, wygląda poprawnie, `swift test`
przechodzi.

**Trzecia rzecz z tej rundy, najtańsza do powtórzenia: sekcję trzeba obejrzeć
na WĄSKIM ekranie osobno.** Wiersz wezwania wyglądał poprawnie na iPadzie
i dopiero iPhone (402 pt) pokazał, że podpis — kwota, dni, klient — ucina
OSTATNI człon, czyli nazwę klienta. To ta sama rodzina co dwie usterki etapu 4
widoczne wyłącznie przy 390 px w panelu. **Jeden zrzut na telefonie po każdej
nowej sekcji.**

**Druga pułapka tej samej rundy: tapy idą w PUNKTACH, a zrzut ma piksele**
(834×1210 wobec ~1378×2048). Kilka „nieudanych" tapów było błędem przelicznika,
nie kodu — a pastylka ma 24 pt wysokości, więc pomyłka o 4 pt już chybia.
**Nieudany tap sprawdzaj powtórzeniem, zanim uznasz przycisk za martwy.**

**Po tej decyzji nie zostało nic otwartego.**

---

## Hierarchia wizualna — ZROBIONA 2026-08-06 (`c0ef83d`, `5d029ca`)

Zlecone zgłoszeniem właściciela: „Pulpit jest przeładowany i przez to
nieczytelny". Miał rację i **da się to zmierzyć**: osiem kafli, KAŻDY 154 px
szeroki, KAŻDA liczba 18 px. Przy jednej wadze wizualnej nic nie jest
ważniejsze od niczego.

**Przyczyna warta zapamiętania:** `DashboardHome.tsx` przeszedł audyt UI/UX
(Moduł 51) przy **940 liniach**; dziś ma **1279** (+36%) po **12 commitach**,
z których każdy DOKŁADAŁ sekcję. Audyty modułów i Moduł 59 sprawdzały
**SPÓJNOŚĆ** — czy ekran wygląda jak reszta panelu. **Nigdy nie pytały
o PRIORYTET.** To ten sam wzorzec, co `lib/instrukcje.ts` w etapie 1: tanie
sprawdzenie to `git log -1 -- <plik ekranu>` od ostatniego audytu wizualnego
plus `git rev-list --count`.

**Reguła, która z tego wyszła — używaj jej, dokładając cokolwiek do pasa KPI:**
*liczba do DZIAŁANIA dominuje, wskaźnik do OBSERWOWANIA cichnie.* Wskaźniki
mają swój ekran (Statystyki).

| ekran | było | jest |
|---|---|---|
| Pulpit | 8 kafli, 1 poziom | **4 kafle, 3 poziomy** (36/24/18), pas 362 → 216 px, sekcji pracy nad zagięciem 3 → **9** |
| Faktury | 5 kafli, 1 poziom | **3 poziomy** — „Po terminie" dominuje (30 px, dwie kolumny) |
| Oferty | 6 kafli, 1 poziom | **3 poziomy** — „Wygasają w 7 dni" dominuje |

Z Pulpitu zdjęto cztery kafle, ale **żaden wskaźnik nie zniknął**:
„Wymaga działania dziś" to była ta sama zmienna `totalActionable`, co
w nagłówku strony; „Opinie klientów" i „Leady z polecenia" były już
w Statystykach pod identycznymi nazwami; „Papier przed pracą" **dołożono** do
Statystyk (`paperFirst` w `/api/stats` — `projects` dostało `id`/`client_id`,
doszło zapytanie o `contracts`).

**STATYSTYKI ZOSTAJĄ PŁASKIE — to rozstrzygnięcie, nie przeoczenie.**
Dziesięć kafli, jeden poziom wagi — dokładnie ta sama liczba, która na
Pulpicie była usterką. Tam jest poprawna: ten ekran MA być ścianą wskaźników,
przychodzi się na niego z konkretnym pytaniem, a wyróżnienie jednej metryki
narzucałoby, co jest ważne. **Sama liczba „jeden poziom wagi" nie jest
diagnozą** — rozstrzyga pytanie, czy ekran odpowiada „co zrobić", czy „jak nam
idzie". Dziesięć pozostałych ekranów (Leady, Klienci, Umowy, Projekty,
Katalog, Poczta, Kalendarz, Notatnik, Przypomnienia, Zdrowie) nie ma pasa KPI
w ogóle.

**Trzy pułapki złapane wyłącznie pomiarem — powtórzą się:**

1. **`xl:` nie działa w oknie podglądu.** Pierwsza wersja poprawki Faktur
   i Ofert używała progu `xl`, a okno ma **1264 px**, podczas gdy `xl` zaczyna
   się od **1280**. Zmiana nie działała i wyglądała na wdrożoną. Przy okazji:
   na typowym laptopie hierarchii też by nie było — próg zszedł na `md`.
2. **Waga wizualna musi być responsywna.** Kwota w 36 px zajmuje 189 px,
   a kafel na telefonie ma 141 px na treść — przycinało bez śladu w kodzie.
   Duża waga wchodzi od `lg`/`md`, na telefonie zostaje cicha (20 wobec 18 px).
3. **Rozmiar nie może zależeć od danych.** Kusi, żeby „Wygasają w 7 dni"
   rosło tylko przy wartości > 0 — ale to przesuwałoby układ przy każdym
   odświeżeniu, a przesunięcia (`layout-shift`) trzymamy na zerze. Kolor niesie
   stan, rozmiar niesie rangę pytania. To dwie różne rzeczy.

**Odnotowane, nie ruszone:** na Kosztach kafle „Koszty w tym miesiącu"
i „Nieopłacone" pokazują dziś TĘ SAMĄ kwotę (wszystkie koszty są nieopłacone).
To prawda o danych, nie usterka — ale gdy właściciel zacznie płacić, warto
sprawdzić, czy te dwa kafle nie mówią zbyt często tego samego.

---

## Co doszło 2026-08-06 wieczorem (`ac541b8`)

**Etap 4, część B — zdjęte z listy właściciela: całe B5, całe B6 poza jednym
pytaniem, mierzalna połowa B3, obiektywne połowy B1 i B2.** Wszystko
w `docs/PRZEGLAD-UI-LISTA.md` (części A2 i B).

- **B5 rozstrzygnięte:** Escape zamyka tylko kalendarzyk (drugi zamyka
  profil); „Wstaw z szablonu" nie potwierdza się; lista kanałów **naprawiona**.
- **Jedyna zmiana w kodzie:** `kierunek="gora"` w `PropertyMenu`/`PillPicker`,
  użyty w dwóch miejscach (wybór kanału u leada i u klienta). Plus domiar
  realnej wysokości menu po zamontowaniu — `PropertyMenu` go nie miał, więc
  **każde** menu odwracane w górę przy dolnej krawędzi okna nachodziło 9 px na
  własny wyzwalacz.
- **Lekcja warta więcej niż poprawka:** sonda po całym panelu pokazała, że
  menu zasłaniające kontrolki pod sobą to **norma** — każde menu statusu na
  Tablicy leadów przechwytuje kliknięcia 4–8 kontrolkom sąsiednich kart.
  Miara „ile kontrolek zakrywa" nic nie dowodzi sama z siebie; liczy się
  dopiero z pytaniem, **czy ktoś tam naprawdę celuje**. Dlatego zachowanie
  domyślne zostało nietknięte, a opcja jest opt-in.
- **Przesunięcia układu na 9 ekranach: 0–0,0059** przy progu 0,1. Pulpit maluje
  treść w 152 ms. Obie liczby lokalne — na produkcji będą inne.
- **Wydruki:** pasek marki, kwota i logo są SVG na wszystkich czterech
  dokumentach, zero `background-clip: text`, zero treści na gradiencie.
- **Publiczne dokumenty na telefonie:** nic poza ekranem, przyciski decyzji
  pełnowymiarowe, ale sam dokument idzie skalą **0,491** — tekst umowy ma
  efektywnie **5,2–6,4 px**. Świadoma decyzja z 2026-07-20, ale jej cena nie
  była nigdzie zapisana. **To jedyne pytanie z B6 dla właściciela.**

`tsc` czysto · `npm test` **365/365** · `npm run przejscie` **123 działa,
0 regresji**.

---

# Poprzedni handoff — stan po etapie 3 (brzegi)

Plik tymczasowy: wklej jako pierwszą wiadomość w nowym czacie. Pamięć Claude ma
to samo zapisane na trwałe. Pełny opis funkcjonalności: `HUB_SETUP.md` /
`LEADS_SETUP.md`; zasady pracy: `CLAUDE.md`; pułapki środowiska: `CLAUDE.md` →
„Znane pułapki tego środowiska".

## Punkt startu

- **Panel:** na wierzchu **etapu 3 planu domknięcia (sytuacje krytyczne)**;
  pod spodem etap 2 (audyt 1B), przegląd szwów i etap 1. `tsc` czysto,
  `npm test` **365/365**, `npm run przejscie` **123 działa · 0 regresji**.
  Etap 3 ZMIENIŁ zachowanie panelu w trzech rodzinach miejsc (dziewięć tras
  odmawia zapisu do usuniętego rekordu, straż sesji zamiast ośmiu
  przeładowań, czternaście zapisów przestało milczeć przy odmowie) — patrz
  niżej.
- **Apka** (`../leggera-hub-ios`, osobne repo i osobny `origin`): na wierzchu
  **`674c216`** — dogoniła panel 2026-08-06. Buduje się, `swift test`
  w `LeggeraHubCore` daje **9/9**. Zamknięte trzy luki, wszystkie obejrzane
  w symulatorze przeciwko LOKALNEMU panelowi: Pulpit → sekcja „Do zapłaty po
  terminie" (`overdueCosts`), Statystyki → kafle zysku i kosztów (`koszty`),
  Kalendarz → rodzaje `cost`, `contract` i **`reminder`** (ten ostatni był
  luką starszą niż szwy: trasa oddaje go od Modułu 66, a apka rysowała każde
  przypomnienie jako „Inne" z szarym kółkiem, bez żadnego objawu).
  **Rekonesans zrobiony pomiarem, nie gretem** — „koszty" trafiało w Swifcie
  w zwykłe polskie słowo, a struktura `Statystyki` tego pola nie miała.
  Bez pracy okazały się: nowe 404 (docierają jako `APIError.serwer` z polskim
  zdaniem) i straż sesji (apka ma własny mechanizm A1). **Otwarte:** apka nie
  wysyła `x-znany-stan`, więc wykrywanie rozjazdu dwóch kart na telefonie
  nie działa — trasa świadomie wtedy milczy. To osobna decyzja.
- `npm run przejscie`: **123 działa · 0 znanych luk · 0 regresji · 0 obejść ·
  0 pominiętych**, powtarzalne (trzy biegi pod rząd dają to samo). Sufit:
  łączny limit hamulca (60/60 min) ogranicza to do ~5 przebiegów na godzinę;
  po `npm run dev` od nowa wraca komplet.

Jeśli `git log` pokazuje co innego — ktoś pracował po drodze, sprawdź co
(`git log` PRZED `git add`; równoległa sesja już raz wchłonęła cudze zmiany).

**Obie listy znanych luk są puste** (pierwsze i drugie przejście). Każde nowe
`⚠ ZNANA LUKA` w przejściu jest czymś, co dopiero co dołożyliśmy — a każda
`✗ REGRESJA` psuje build.

## Oba plany są ZAMKNIĘTE

| plan | powstał po | fazy / kroki | stan |
|---|---|---|---|
| `docs/PLAN-ZAPLECZE.md` | pierwsze przejście „na sucho" (droga, która się UDAJE) | 0a–5 | ✅ 2026-08-02 |
| `docs/PLAN-PO-DRUGIM-PRZEJSCIU.md` | drugie przejście (droga, która się NIE udaje) | 1–5 | ✅ 2026-08-05 |

Każdy z nich ma na końcu pliku **podsumowanie całości** — lekcje, które przeżyją
plan, i pełną listę tego, czego świadomie nie zrobił. Drugi plan ma tam też
propozycję, czym powinno być **trzecie przejście**.

W skrócie: 22 znaleziska drugiego przejścia to były **cztery brakujące
mechanizmy** — publiczny dokument zna swój stan, szablon mówi tylko to, co
potwierdzają dane, „warunki obowiązujące" jako jedno miejsce, porażka jest
zdarzeniem jak każde inne. Plus sześć drobiazgów kroku 5, nowa powierzchnia dla
klienta (odrzucenie oferty ze swojej strony) i jedna zmiana w hamulcu.

## Co jest następnym krokiem

**PLAN DOMKNIĘCIA (`docs/PLAN-DOMKNIECIA.md`) — pięć etapów, idziemy po kolei.**
Etapy 1, 2 i 3 ✅ zamknięte. **NASTĘPNY: etap 4 — przegląd wyglądu.**
Jego **część mierzalna jest już ZROBIONA** (patrz niżej), a właścicielowi
została lista `docs/PRZEGLAD-UI-LISTA.md`, część B: wrażenie, wydruki na
PAPIERZE, telefon i iPad palcem, oczami klienta. Po niej etap 5 — poprawki
z jego zgłoszeń.

⚠️ **PODGLĄD W TYM ŚRODOWISKU DZIAŁA — od 2026-08-06.** Wszystkie starsze
notatki („karta ukryta 0×0", „rAF daje zero klatek", „`read_page` zwraca
pustkę") są NIEAKTUALNE. Zmierzone: okno **1264×1243**, `document.hidden`
= `false`, **64 klatki na sekundę**, zrzuty ekranu renderują panel poprawnie.
**Sprawdź to w pierwszej minucie sesji** (`innerWidth`, `document.hidden`,
licznik `requestAnimationFrame`) — jedno wywołanie, a decyduje o tym, ile
roboty można zrobić samemu zamiast oddawać właścicielowi.

**Wykrywanie rozjazdu dwóch kart jest ZBUDOWANE** (2026-08-06, wariant
właściciela „wykryj i powiedz, nie blokuj"). Karta dokleja `x-znany-stan`,
trasa porównuje, przy różnicy **zapisuje mimo to** i dokłada zdanie do
odpowiedzi; panel pokazuje je w toaście. Zasięg: oferta (nagłówek, pozycje,
bloki), faktura (nagłówek, pozycje), klient, projekt, lead, notatka, koszt.
Poza zasięgiem świadomie: umowa i przypomnienie — nie mają `updated_at`.
Reguła w `CLAUDE.md`, szczegóły w `ETAP-3-WYNIK.md`.

**Część mierzalna etapu 4 — ZROBIONA 2026-08-06.** Trzynaście ekranów przy
1264 px, najbardziej złożone także przy 390 px. Wynik i to, co zostało dla
właściciela: `docs/PRZEGLAD-UI-LISTA.md`, część A.

- **Dwie usterki widoczne WYŁĄCZNIE na szerokości telefonu**, obie naprawione:
  przycisk „Nowa wiadomość" w Poczcie stał 97 px poza ekranem (rząd bez
  własnego `flex-wrap`, a paska przewijania nie ma — jedynym objawem był brak
  przycisku), a filtry `<select>` w Kalendarzu rozpychały ekran do 546 px
  (natywny select bierze szerokość od najdłuższej opcji; `flex-wrap` nie
  ratuje pojedynczego elementu za szerokiego → `max-w-full`).
- **Cele dotykowe 24×24** poprawione tam, gdzie było miejsce: kwadraciki
  zaznaczania (jedna reguła CSS `::before`, nie opakowywanie 19 miejsc
  w `<label>`), „✕" (8 miejsc), kółka kanału (4), ikonka „otwórz" (4),
  gwiazdka flagi w Poczcie. Koszty 18 → 2 celów poniżej progu, Poczta 14 → 8.
- **Jedna poprawka WYCOFANA i to jest lekcja:** kontrolek na kartach Projektów
  (status 15×15, priorytet **11×9**, zdrowie 12×12) nie da się naprawić
  rozmiarem trafienia — sąsiadów dzieli **19 px**, więc każde powiększenie
  sprawia, że jedna przechwytuje kliknięcia drugiej (17 kolizji przy 24 px,
  2 przy 18, 6 przy 16). Zamiana chybienia na otwarcie CUDZEGO menu jest
  gorsza od chybienia. **Przed dołożeniem klasy `cel-dotykowy` zmierz odstęp
  do sąsiada.**

**ROZSTRZYGNIĘTE 2026-08-07 — właściciel wybrał wariant 1 przy obu punktach.**
Kontrolki na kartach Projektów są rozsunięte i mają pudełka 24×24 (**środki
dokładnie 24 px, 0 kolizji, 81/81 wyzwalaczy w normie**); cele w listach
kompaktowych podniesione do 24 px bez ruszania odstępów. Otwarte zostały tylko
kwadraciki na Tablicy — patrz DROGA B punkt 1. Pełny opis, liczby przed/po
i dowody: **`docs/DECYZJE-WIZUALNE.md`**.

Uwaga na przyszłość: to zdanie mówiło wcześniej, że podniesienie celów w listach
„zmieniłoby gęstość wszystkich list". **Domierzone i nieprawdziwe** — cel miał
20–22 px, a sąsiednie wiersze dzieli 31–34 px, więc 24 px zmieściło się
w istniejącym odstępie i żadna lista nie zmieniła gęstości.

**0. Etap 3 planu domknięcia — SYTUACJE KRYTYCZNE — ZROBIONY 2026-08-06.**
Wynik: **`docs/ETAP-3-WYNIK.md`**. Brief: `docs/ETAP-3-BRZEGI-BRIEF.md`.

Cztery scenariusze, których nigdy nie przechodziliśmy: **trzy przebiegnięte,
czwarty niewykonalny stąd i wiadomo dlaczego.**

**Dwie rzeczy kłamały. Obie naprawione, obie w przejściu.**

1. **„Zapisano" bez zapisu.** Karta A kasuje rekord, karta B dalej go edytuje —
   `UPDATE … WHERE id = …` na nieistniejący wiersz zmienia zero wierszy i nie
   zgłasza błędu, więc trasa odpowiadała `{"ok":true}`. Sonda przeszła **16
   rodzajów rekordów, kłamało 9** (klient, projekt, lead, pozycja i TREŚĆ
   oferty, zadanie, kamień, punkt startowy, osoba kontaktowa). Naprawa: jedna
   funkcja `lib/brakRekordu.ts` + `if` w dziewięciu trasach; po naprawie
   **0 z 16**. Dwa szczegóły warte pamięci: **bliźniaki się rozjechały**
   (pozycja FAKTURY sprawdzała to od początku, pozycja OFERTY nie), a w
   `api/clients/[id]/route.ts` stał komentarz *„brak wiersza = klient
   skasowany w międzyczasie; UPDATE-y i tak nic nie trafią"* — kod WIEDZIAŁ
   i wzruszał ramionami.
2. **Wygasła sesja w ciszy.** Zmierzone na żywym edytorze (podmieniony
   `window.fetch`, prawdziwe kliknięcia): przy tytule oferty toast „Nie udało
   się zapisać." na 3,4 s, przy **treści oferty ZERO znaków** — a ekran w obu
   przypadkach dalej pokazywał niezapisany tekst. **243 miejsca zapisu, w żadnym
   nie pada 401.** Powstała **straż sesji** (`app/[lang]/admin/strazSesji.ts`):
   jedno opakowanie `window.fetch` obejmujące wszystkie 243 i każde przyszłe,
   plus pasek, który **nie znika sam** i pozwala zalogować się NA MIEJSCU, bez
   przeładowania. Osiem samoczynnych `window.location.reload()` przy 401
   usuniętych — kasowały niezapisany formularz. Czternaście zapisów przestało
   milczeć przy odmowie.

**Bezpiecznik wysyłki maila (`lib/mailGuard.ts`) uruchomiony PIERWSZY RAZ** —
na atrapie SMTP (~80 linii na `node:net`, w `.env.local` `MAIL_*` na
`127.0.0.1`). Zerwanie żądania w połowie wysyłki dało **1 mail u klienta**;
ponowienie w locie usłyszało „poprzednia próba trwa", po zakończeniu „już
wysłana" ze wskazaniem tamtej wiadomości; nieudana wysyłka NIE blokuje
ponowienia. Atrapa nie została w repo (wymaga podmiany env i restartu).

**Odtworzenie kopii — niewykonalne stąd**, z trzech niezależnych powodów:
kopie na NAS nie są uruchomione, ten Mac nie ma `psql`/`pg_dump` ani
działającego Dockera, do Neona nie ma stąd dostępu. Sprawdzona za to CZUJKA:
`brak → ok → blad` na Pulpicie działa end-to-end przez `POST /api/backup/ping`.
Odtworzenie jednej kopii do pustej bazy testowej — **po rejestracji**.

**Wykrywanie rozjazdu dwóch kart dołożone po decyzji właściciela** (ten sam
dzień): `lib/rozjazd.ts` + `app/[lang]/admin/rozjazdKart.ts`, nagłówek
`x-znany-stan`, dziesięć tras. Zapis NIE jest blokowany — wraca jedno zdanie.
Po drodze **dwa błędy złapane wyłącznie przebiegiem w przeglądarce**:
(1) strażnik `window.fetch` zakładany w `useEffect` providera SPÓŹNIAŁ SIĘ —
efekty Reacta lecą od dzieci do rodzica, więc pierwszy odczyt edytora
przechodził obok niego i karta nigdy nie znała znacznika (instalacja
przeniesiona na import modułu); (2) **fałszywy alarm** — drugi zapis z rzędu
w JEDNEJ karcie krzyczał „ktoś zmienił to w innym oknie", bo karta trzymała
znacznik sprzed własnej zmiany (trasy oddają teraz nowy `updated_at`).
W przejściu stoją przez to TRZY zdania, nie jedno: wykrywa · nie krzyczy bez
powodu · milczy bez nagłówka.

**Trzy lekcje z tego etapu:**

- **Rekonesans pomylił się w obie strony po raz TRZECI z rzędu.** Pisał „190
  zapisów" (jest 243), „401 przeładowuje stronę" (nie przeładowuje — to gardło
  odczytu), „pozycje bywają kasowane i wstawiane od nowa" (nie są). Liczba
  z greta jest hipotezą, nie wynikiem — trzeci dowód, chyba ostatni potrzebny.
- **Poprawkę widoczną na ekranie trzeba obejrzeć na ekranie.** Pierwsza wersja
  straży cofała podgląd przy KAŻDEJ odmowie, w tym przy 401 — więc pasek mówił
  „to, co masz na ekranie, zostaje", a pole obok już pokazywało starą treść
  z bazy. `tsc` przechodził, testy przechodziły, poprawka robiła coś
  przeciwnego do zamiaru. Złapane dopiero przebiegiem w przeglądarce.
- **Wyjątek bez testu to wyjątek, który zniknie bez objawu.** Straż ma cztery
  (GET, `/api/admin/*`, obce domeny, `Request` zamiast stringa) i każdy ma
  własne zdanie w `test/strazSesji.test.ts` — bez nich strażnik zacząłby
  krzyczeć „sesja wygasła" przy BŁĘDNYM HAŚLE na ekranie logowania.

**0. Etap 2 planu domknięcia — AUDYT 1B (przyrost tras) — ZROBIONY 2026-08-06.**
Wynik: **`docs/AUDYT-1B-PRZYROST.md`**. Brief: `docs/ETAP-2-BEZPIECZENSTWO-BRIEF.md`.

**Zero dziur, zero zmian w zachowaniu panelu.** Wszystkie **266 uchwytów HTTP**
(188 plików) mają rozstrzygnięcie: **252 chronione** — sonda bez ciastka dostaje
401 — i **14 publicznych świadomie**, każdy z nazwanym mechanizmem zamiast
`isAuthed()` (token w linku, sekret crona, hamulec formularza). Wzorzec
`if (!(await isAuthed()))` utrzymał się przez **39 nowych plików tras**
i 83 zmienione. Trzy rzeczy poza listą tras też czysto: biała lista
`lib/publicFields.ts` wytrzymała 52 nowe kolumny, wszystkie 5 publicznych tras
zapisujących jest pod hamulcem (próg 5/60 min nietknięty), nowe trasy nie
logują danych osobowych.

**Trzecia metoda upadła — i to jest lekcja tego etapu.** Audyt 1 nauczył, że
grep po PLIKU kłamie; rekonesans, że grep po UCHWYCIE kłamie tak samo. Teraz
wyszło, że **ten sam błąd „plik ≠ uchwyt" popełnił brief ostrzegający przed
nim**: pisał „8 × `public/[token]`", a uchwytów jest **10**. Lista 21 uchwytów
z rekonesansu też była niepełna — brakowało crona `mail/outbox/run`.
**Rozstrzyga wyłącznie pomiar na żywej trasie.**

**Druga lekcja, warta więcej niż wynik:** przy trasach chronionych SEKRETEM
(`calendar/ics`, `backup/ping`, trzy crony) **401 z powodu źle zadanego pytania
jest nie do odróżnienia od 401 z powodu ochrony**. Pierwsze podejście strzelało
do `ics` parametrem `?secret=` zamiast `?token=` i do `backup/ping` sekretem
w ciele zamiast w nagłówku — obie oddały 401 i wyglądało to na poprawną
ochronę. **Trasa chroniona sekretem wymaga dowodu DWUSTRONNEGO:** że bez
sekretu odmawia i że z poprawnym wpuszcza. Wszystkie pięć sprawdzono tak.

**Narzędzie zostaje w repo: `scripts/sonda-401.ts`.** Zaczyna od
samosprawdzenia i **odmawia biegu przy włączonym `DEV_ADMIN_BYPASS`** (kod
wyjścia 2) — bez tego pokazałoby komplet zieleni i fałszywie uspokoiło.
Uruchamiając je: wyłącz bypass w `.env.local`, **zrestartuj `npm run dev`**,
a po skończeniu **przywróć `=1`** (wymaga go `npm run przejscie`).

**0a. Przegląd SZWÓW między modułami — ZROBIONY 2026-08-06.**
Wynik: **`docs/SZWY-MIEDZY-MODULAMI.md`**. Zlecony pytaniem właściciela („czy
to naprawdę jeden system?"), poza planem domknięcia.

**Inna rodzina pytań niż wszystkie audyty przed nim:** tamte patrzyły W GŁĄB
modułu, ten na STYKI. Kręgosłup (lead → oferta → umowa → projekt → faktura →
zapłata → opinia) okazał się spięty i przechodzi go harness. **Wszystkie pięć
dziur leżało po jednej stronie — przy PIENIĄDZACH WYCHODZĄCYCH**, i wszystkie
są naprawione:

1. **rentowność projektu liczyła koszty w obcej walucie po nominale** (1000 EUR
   wchodziło jako 1000 zł, zysk zawyżony o 3300) — BŁĄD, nie brak; ta sama
   rodzina co rabat z audytu Projektów;
2. **faktura od dostawcy po terminie nie odzywała się nigdzie** poza własnym
   modułem — dziś Pulpit („Do zapłaty po terminie"), licznik, poranny mail
   i Kalendarz;
3. **Statystyki nie znały kosztów** (`grep -c costs` = 0) — dziś koszty, zysk
   i dwa trendy;
4. **Kalkulator był wyspą** (`lib/dobor.ts` importował jeden plik — własny
   ekran) — dziś „Przenieś do oferty" zakłada szkic z rekomendacją jako blokiem
   treści; pozycji cennika świadomie NIE wstawia (widełki to nie jedna cena);
5. koniec okresu umowy nie stał w Kalendarzu — dziś stoi.

**Lekcja:** audyt modułu nie znajdzie dziury na szwie, bo każdy moduł z osobna
robił swoje poprawnie. Tanie sprawdzenie: weź pole, które jeden moduł zapisuje,
i policz `grep -rl`, ile plików je CZYTA. Jeden = wyspa. Ta komenda znalazła
trzy z pięciu dziur.

**Apki nie dotykano.** Nowe rodzaje wpisów w Kalendarzu (`cost`, `contract`)
apka pokaże neutralnie (`RodzajTerminu(rawValue:) ?? .nieznany`), a sekcji
kosztów na Pulpicie i kafli w Statystykach po prostu nie ma — do dołożenia,
gdy przyjdzie kolej na apkę.

**0. Etap 1 planu domknięcia — ZROBIONY 2026-08-05.**
Wynik: **`docs/ETAP-1-WYNIK.md`**, dokument dla właściciela:
**`docs/CO-MAM.md`**. Brief: `docs/ETAP-1-PRZEWODNIK-BRIEF.md`.

Etap NIE polegał na pisaniu przewodnika — przewodnik już istniał w panelu
(ekran *Instrukcje*, `lib/instrukcje.ts`, dziś 276 wpisów, 14 modułów). Polegał
na sprawdzeniu, czy **nadal mówi prawdę**. Nie mówił: **12 zdań nieprawdziwych
i 9 mechanizmów, o których nie wiedział.** Wszystko poprawione, zachowania
panelu nie ruszono.

**Przyczyna warta zapamiętania:** `lib/instrukcje.ts` nie był zmieniany od
`e441246` (2026-08-02), a weszło po nim **51 commitów** — pięć faz zaplecza
i dwa przejścia „na sucho". **Tanie sprawdzenie na przyszłość:**
`git log -1 -- lib/instrukcje.ts`, potem `git rev-list --count <ten>..HEAD`.
Kilkadziesiąt commitów = instrukcja już kłamie, pytanie tylko gdzie.

**Druga lekcja:** cały rozdział o Pulpicie był napisany z ekranu **apki**
(sekcja „Nadzór", przycisk „+", menu „…"), a czyta się go głównie w panelu —
i żadnej z tych trzech rzeczy w panelu nie ma. Rozdział pisany „z jednego
urządzenia" kłamie na drugim.

**TRZY RZECZY CZEKAJĄ NA DECYZJĘ WŁAŚCICIELA** (`ETAP-1-WYNIK.md`, sekcja C):

1. **Windykacja wysyła maile do klienta BEZ kliknięcia** — +3 dni uprzejmie,
   +10 stanowczo, **+21 formalne wezwanie do zapłaty z odsetkami**. To jedyne
   takie miejsce w panelu i stoi w sprzeczności z obietnicą „nic nie wychodzi
   bez Twojego kliknięcia". Trzy warianty do wyboru w wyniku; poprawka (jeśli
   będzie) idzie etapem 5. **Nie zmieniaj tego sam.**
2. **Godziny automatów mogą być w UTC** — Vercel odpala crony w UTC, więc
   `0 6 * * *` to 7:00 zimą / 8:00 latem w Polsce. Nie da się tego sprawdzić
   z tego środowiska; właściciel ma potwierdzić obserwacją.
3. **„14 reguł kontroli spójności" to nieprawda — jest 13.** Poprawione
   w dokumentach (ten plik i `CO-MAM.md`); `lib/spojnosc.ts` nietknięty,
   reguły nie brakuje.

**1. Trzecie przejście: DRUGI ROK OBROTOWY — ZROBIONE 2026-08-05.**
Wynik: **`docs/TRZECIE-PRZEJSCIE-DRUGI-ROK.md`**. Brief:
`docs/TRZECIE-PRZEJSCIE-DRUGI-ROK-PLAN.md`.

Z czterech podejrzeń briefu: **dwa potwierdzone i naprawione** (faktura
cykliczna „co miesiąc 31." uciekała na 3. dzień miesiąca, a każde spóźnienie
crona przesuwało serię na stałe), **jedno sprawdzone i czyste** (retencja —
po raz pierwszy przeszła przez rzeczywisty upływ okna), **jedno odłożone**
(numeracja faktur, patrz niżej). Obie tabele cykliczne mają teraz `kotwica`,
a arytmetyka jest bliźniakiem tej z Kalendarza. `npm test` **349/349**,
`npm run przejscie` **109 działa · 0 regresji** — nowe zdania sprawdzone
kontrolnie przez tymczasowe cofnięcie poprawki.

**OTWARTE — wymaga decyzji księgowej, nie kodu:** rok w numerze faktury bierze
się z zegara serwera, nie z `data_wystawienia`, więc szkic z datą 31.12
wystawiony 2 stycznia dostaje numer z nowego roku. Świadomie nietknięte
(sprawy księgowe idą na sam koniec, po rejestracji).

**Pułapka środowiska złapana przy okazji:** trasy `/api/*` potrafią zacząć
oddawać **404** po restarcie `next dev` — także nietykane, przy czystym `tsc`,
działającej stronie głównej i pliku obecnym w gicie (raz wszystkie naraz, raz
pojedyncza trasa `…/issue` przy działającym rodzeństwie). To uszkodzony cache
Turbopacka; `rm -rf .next` i start od nowa. **Zdarzyło się dwa razy jednego
dnia** — nie szukaj wtedy usterki w swoim kodzie.

**1b. Trzecie przejście: AWARIE I BRZEGI — ZROBIONE 2026-08-05.**
Wynik: **`docs/TRZECIE-PRZEJSCIE-AWARIE-I-BRZEGI.md`**.

Jedno znalezisko: **dwa kliknięcia „Zarejestruj wpłatę" dawały dwie wpłaty**
(zmierzone: 2460 zł na fakturze wartej 1230 zł) i **nic tego nie zgłaszało** —
faktura pokazuje „Opłacona", co jest prawdą, więc nikt do niej nie wraca,
a nadpłata zawyża przychód w Statystykach. Naprawa **nie jest barierą przy
zapisie** (wpłata jest odwracalna, a reguła Fazy 4 mówi „co odwracalne, nie
pyta"), tylko **kolejną regułą kontroli spójności** — zapis zostaje wolny,
skutek przestaje być niewidoczny. (Reguł jest po niej **13**, nie 14 — ten
plik pisał wcześniej „czternastą"; policzone w kodzie w etapie 1.)

Czyste: akceptacja oferty, oba podpisy umowy, wystawienie faktury (wyścig nie
dał dziury w numeracji), brak `RESEND_API_KEY` (rzuca, nie udaje sukcesu).
**Niesprawdzone:** zerwane żądanie w połowie wysyłki maila — dev nie ma
skrzynki, więc bezpiecznik odcisku jest przeczytany, ale nie przebiegnięty.

`npm run przejscie` **111 działa · 0 regresji**, trzy przebiegi pod rząd.

Panel powstał w lipcu 2026 i **nigdy nie przeżył 31 grudnia**. Przez tę datę
przechodzą: numeracja faktur (reset z rokiem), retencja (24 mies. / 6 lat),
faktury i koszty cykliczne. Oba przejścia „na sucho" trwały po dziesięć minut
zegarowych, więc żadne nie mogło tego zobaczyć. Punkt (b) z końca
`docs/PLAN-PO-DRUGIM-PRZEJSCIU.md`; punkty (a) i (c) wymagają prawdziwej
przeglądarki i tu ich nie zrobimy.

**Wykonalność sprawdzona przed napisaniem briefu:** w kodzie NIE MA
wstrzykiwania daty, zegara nie da się przesunąć — ale retencja liczy się
SQL-em (`now() - interval`), a cykliczne wyzwala `next_run <= today`, więc
**postarzenie DANYCH** działa tak samo jak upływ czasu. To jest metoda tej roboty.

Cztery podejrzenia z dowodem w kodzie (żadne nie potwierdzone przebiegiem):
rok numeru z zegara zamiast z daty wystawienia (**A1 — wymaga Twojej decyzji,
numer faktury to dokument fiskalny**), `nextRunAfter` przelewa 31. dzień
miesiąca na następny (ta sama rodzina, którą Kalendarz już raz naprawiał),
`next_run` liczony od dnia nadrobienia crona zamiast od kotwicy, retencja nigdy
nieprzeszła przez rzeczywisty upływ okna.

**2. Audyt „apka wysyła, trasa nie czyta" — ZROBIONY 2026-08-05. PUSTO.**
Wynik: **`docs/natywna-aplikacja/42-wynik-audyt-co-apka-wysyla.md`**.
Brief: `41-brief-audyt-co-apka-wysyla.md`.

Przejrzane **wszystkie 75 wywołań `POST`/`PATCH`** apki (16 ładunków
słownikowych, 43 `struct Body`, 6 multipart) przeciwko 63 trasom panelu.
**Zero pól wysyłanych, a nieczytanych. Zero zmian w kodzie — w obu repo.**

Sprawdzone nie tylko lekturą: sondy różnicowe `PATCH`-em z ciałem skopiowanym
z apki (przypomnienie — komplet 16 pól, katalog — 11 pól) zmieniły w bazie
**wyłącznie to, co miały**, plus jeden przebieg przez apkę na symulatorze
(„+tydzień" na leadzie → `next_followup` w bazie).

Trzy fałszywe alarmy po drodze (pole czytane pętlą, pole zagnieżdżone w warunku
innego pola, trasa parametryczna `[kind]`) są opisane w wyniku — powtórzą się.

**Dlaczego pusto, skoro odczyt miał sześć luk:** brak skutku przy ZAPISIE boli
od razu (właściciel widzi po odświeżeniu, że nie weszło), brak informacji przy
ODCZYCIE nie boli nigdy. Plus zapis ma jedno gardło (`APIClient.swift`), a
odczyt rozłazi się po dwudziestu ekranach. **Następnym razem szukaj tam, gdzie
brak skutku jest niewidoczny.**

Jedna obserwacja poboczna do zapamiętania: `reminders.lokalizacja_promien` to
**kolumna bez pisarza** — nikt jej nie ustawia, a edycja przypomnienia z apki
nadpisuje ją `NULL`-em. Dziś bez skutku (zawsze jest `NULL`); gdyby powstała
kontrolka promienia, zaczęłaby ją kasować w ciszy.

**Apka jest domknięta wobec panelu.** Obie strony monety sprawdzone (punkty 2
i 3), a **paczka brakujących ekranów z drugiego przejścia jest ZROBIONA** —
wszystkie siedem pozycji (poziom windykacji, „WYNIKA Z" z aneksem, `akcjaAlt`,
dwie sekcje Pulpitu, odrzucenie oferty przez klienta, „Odpowiedź na wersję N",
propozycja o rozjeździe). Lista w `PLAN-PO-DRUGIM-PRZEJSCIU.md` mówiła co
innego do 2026-08-05 wieczorem, kiedy sprawdzono ją pozycja po pozycji
i skreślono. **Nie planuj tej paczki drugi raz.**

**3. Audyt „serwer oddaje, apka wyrzuca do kosza" — ZROBIONY 2026-08-05.**
Wynik i dowody: **`docs/natywna-aplikacja/40-wynik-audyt-co-apka-wyrzuca.md`**.
Brief, wg którego szedł: `39-brief-audyt-co-apka-wyrzuca.md`.

Przejrzane **wszystkie 48 wywołań `GET`** apki przeciwko temu, co naprawdę
zwracają ich trasy. **Sześć luk, wszystkie naprawione i sprawdzone na
symulatorze**; dziesięć pominięć ocenionych jako świadome i spisanych, żeby
następny audyt nie liczył ich drugi raz. Panelu nie ruszano.

| # | luka | co przez to nie działało |
|---|---|---|
| 1 | `expiredOffers` (`hub/today`) | oferty po terminie ważności — licznik je liczył, sekcji nie było |
| 2 | `bramka` (4 trasy `/send`) | **z telefonu nie dało się wysłać dokumentu z ostrzeżeniem** |
| 3 | `aneksy` / `matka` (`contracts/:id`) | z umowy nie było widać, że ma aneks; z aneksu — do której umowy |
| 4 | `sourceOffer` (`projects/:id`) | z czego powstał projekt |
| 5 | `offers`/`invoices`/`contracts`/`tresc` (`search`) | szukanie po dokumentach i **po treści rozmów/maili** |
| 6 | `offerLosses`, `hunter` (`stats`) | „na czym przegrywamy" i skuteczność sita Łowcy |

**Najpoważniejsza (#2) nie była brakującą sekcją, tylko brakującą DROGĄ DALEJ.**
Trasa odmawiała wysyłki dokumentu z samymi ostrzeżeniami kodem 409 i czekała na
powtórkę z `mimo_ostrzezen: true`; apka tego nie umiała, więc pokazywała powód
i kończyła. Ślepy zaułek, bez awarii i bez objawu. Sprawdzone w dzienniku:
`409 → 428 → 200` na jedno kliknięcie. Opis w README apki („Bramka wysyłki").

**Odnotowane, świadomie nie naprawione:** ostrzeżenie o sufitcie listy działa
w apce dla Klientów i Projektów, a `/api/contracts` i `/api/offers` też oddają
`total` — apka je ignoruje. Nie naprawione, bo nie da się tego dowieść: sufity
to 1000 i 500 rekordów, a dev-baza tyle nie zniesie. Trzy linijki na listę,
do zrobienia, gdy będzie czym pokazać.

**Naturalny następny krok:** druga strona tej samej monety — `POST`/`PATCH`,
w których apka wysyła pole, którego trasa nie czyta. Objaw identyczny (cisza),
skutek gorszy: zapis, który wygląda na udany i nic nie zmienia. Ten audyt tego
nie objął — czas poszedł na bramkę wysyłki, która okazała się większa, niż
brief zakładał.

**3. Apka — paczka ZROBIONA 2026-08-05** (kontekst, nie robota).
Wszystkie pięć pozycji z briefu
`37-brief-dogonic-panel.md` jest w apce i sprawdzone na symulatorze przeciwko
`npm run dev` + `npm run przejscie`. Wynik i dowody:
**`docs/natywna-aplikacja/38-wynik-apka-dogania-panel.md`**.

| # | co | stan |
|---|---|---|
| 1 | ekran „Propozycje" (6 reguł, jedna z `akcjaAlt`) | ✅ tylko Pulpit — decyzja właściciela; zero nowych żądań |
| 2 | dwie sekcje Pulpitu (`projektyZagrozone`, `zapomnianeSzkiceUmow`) | ✅ (szkice umów bez dowodu z danych — patrz niżej) |
| 3 | wybór poziomu windykacji | ✅ + pierwszy cel testowy w repo apki (9 testów) |
| 4 | karta „Odpowiedź na wersję N" na ofercie | ✅ |
| 5 | rubryka „Wynika z" na fakturze | ✅ z aneksem i kwotą obowiązującą |

Po drodze wyszły **trzy usterki, których brief nie znał**, wszystkie naprawione:
`?odrzucone=1` doklejone do ścieżki dawało 404 (martwy przycisk „przywróć");
poziom windykacji kłamał zaraz po wysyłce (nagłówek faktury się nie odświeżał);
**bloki treści oferty nie pokazywały się w apce NIGDY** — `pobierzOferte` nie
dekodowało `sections`, choć widok je rysował.

Jedyna rzecz z tej paczki **bez dowodu z danych**: sekcja „Zapomniane szkice
umów". Reguła panelu wymaga `created_at < dziś`, a dev-baza PGlite żyje
w pamięci procesu `next dev`, więc lokalnie nie da się takiego szkicu zrobić
(brief mylnie twierdził, że zostawia go `npm run przejscie`). Pierwszy dowód
przyjdzie z produkcji.

**Odłożone świadomie:** propozycje w listach modułów (dziś tylko Pulpit).
`SekcjaPropozycji` przyjmuje stan z zewnątrz, więc to dołożenie żądania
`?modul=`, a nie przebudowa.

**4. Trzecie przejście „na sucho"** — jeśli wolisz iść dalej sprawdzaniem niż
budowaniem. Propozycja zakresu stoi na końcu `docs/PLAN-PO-DRUGIM-PRZEJSCIU.md`:
(a) oczami klienta w PRAWDZIWEJ przeglądarce, na telefonie i desktopie, po
polsku i po niemiecku; (b) drugi rok obrotowy (numeracja, retencja, faktury
cykliczne przez zmianę roku); (c) awarie i brzegi. **Czego robić NIE musi:
przechodzić ręcznie tego, co robi `npm run przejscie`.**

**5. Rejestracja firmy** — odłożona decyzją właściciela do odwołania. To jest
jedyny krok, który realnie zmienia stan projektu, i jest nietechniczny.

## Jak pracować w tym repo (skrót, reszta w CLAUDE.md)

- `npm run dev` w jednym oknie, `npm run przejscie` w drugim. Dev-baza to
  PGlite w pamięci procesu — **restart serwera = czysta baza** (i nowe id
  rekordów, więc stare linki przestają działać).
- `npx tsc --noEmit -p tsconfig.json` po każdej paczce zmian (pełny
  `next build` failuje w sandboxie z EPERM). **`tsc` nie wie nic o więzach
  bazy** ani o SQL-u w szablonach.
- `npm test` — 365 testów nad czystymi funkcjami z `lib/` (i jeden nad strażą sesji).
- **Każda nowa trasa w `app/api` jest domyślnie OTWARTA** —
  `if (!(await isAuthed()))` sprawdzaj per uchwyt HTTP, nie per plik.
- **Podgląd DZIAŁA od 2026-08-06** (wcześniej była to karta ukryta 0×0:
  zero klatek `rAF`, pusta strona z `read_page`, `opacity: 0` na otwartych
  modalach). Zmierzone: 1264×1243, 64 kl./s, zrzuty renderują. **Sprawdź to
  na starcie sesji, nie zakładaj** — w jedną i w drugą stronę. Nawet gdy
  działa, rozstrzygaj liczbą (`getBoundingClientRect`, `getComputedStyle`,
  `elementFromPoint`), a nie okiem; a `elementFromPoint` działa TYLKO
  w widocznym oknie, więc elementy przewinięte poza ekran zawsze wyglądają
  na wadliwe.
- Kończąc: `rm -f .git/index.lock && git add -A && git commit && git push`.

---

## Co jest otwarte (nie ruszać przy okazji)

- **Rejestracja firmy** — `PO_REJESTRACJI.md`, osiemnaście punktów. Blokuje KSeF
  test → produkcja, prawdziwe dane w nocie prawnej, plan Vercel Pro (Hobby
  zabrania użytku komercyjnego), przeprowadzkę na NAS. **To nie są braki do
  naprawienia przed rejestracją.**
- **Warstwa wizualna obu przejść** — żadne z nich jej nie sprawdzało, bo w tym
  środowisku pomiary byłyby zgadywaniem. Wymaga prawdziwej przeglądarki.
  Konkretnie zostały z tego trzy rzeczy z sekcji F pierwszego przejścia:
  (1) czy Escape przy otwartym kole daty zostawia profil otwarty; (2) czy menu
  „Wstaw z szablonu" naprawdę zostaje otwarte; (3) czy lista kanałów
  zasłaniająca checkbox faktycznie przeszkadza.
- **A5 z pierwszego przejścia** — „ZLECENIODAWCA / WYKONAWCA" w jednej rubryce
  na wydruku umowy, a role są dwie. Treść dokumentu prawnego, nie reguła
  wysyłki.
- **Kafel „Przychód (ten miesiąc)"** pokazuje brutto. Decyzja produktowa do
  rozstrzygnięcia, nie usterka.
- **Czy porzucenie świeżo zeskanowanego paragonu ma pytać** — `koszt-usun` jest
  na liście nieodwracalnych, więc „Anuluj" w skanerze prosi o potwierdzenie
  usunięcia szkicu. Trasa nie odróżnia szkicu sprzed minuty od kosztu sprzed
  miesiąca. Decyzja po stronie panelu, do rozstrzygnięcia.
- **Jeden przebieg kontrolny potwierdzeń na PRODUKCJI** (atrapa klienta →
  usunięcie tą samą drogą) — nie da się go wykonać stąd, bo apka w DEBUG celuje
  w produkcję, a wejście wymaga hasła wpisanego na urządzeniu. Ruch właściciela.
- **Moduł 54, ostatni krok** (pliki klienta na NAS) — czeka na Moduł 55, ten na
  rejestrację.
- **`CEIDG_TOKEN` w Vercelu** — bez niego Łowca leadów nie ma skąd brać
  kandydatów. Ruch właściciela.
- **Włączenie 2FA na produkcji** — silnik gotowy od Modułu 41. Drogi powrotu:
  papierowe kody zapasowe + ten sam sekret na drugim urządzeniu (NIE
  „wyłącznik w Vercelu").
- ~~Osierocony katalog `.claude/worktrees/fervent-ishizaka-7aec37/`~~ —
  **usunięty 2026-08-05** (`git worktree remove` + `prune`, 7,4 MB). Sprawdzone
  przed skasowaniem: drzewo czyste, a jego ostatni commit `ca48013` jest
  w historii `main`, więc nic nie zginęło. `git worktree list` pokazuje już
  tylko katalog główny.

## Czego NIE zaczynać bez wyraźnej prośby

- **Orchestrator propozycji AI** („Skrzynka propozycji AI") — odłożony na
  koniec. Propozycje z Fazy 3 to co innego: deterministyczne reguły, bez modelu.
- **Nowy punkt użycia lokalnego LLM** poza pięcioma zbudowanymi.
- **Zamiana istniejących automatów na propozycje** — granica jest ustalona
  i zapisana w `CLAUDE.md`.
- **Dokładanie potwierdzeń do działań odwracalnych** — reguła Fazy 4 działa
  w obie strony i jest zapisana w `CLAUDE.md`.
- **Rozpychanie `OFFER_STATUSES`** (np. o „Zastąpiona") — rozstrzygnięte
  2026-08-05 na „nie": fakt zastąpienia niesie `superseded_at`, a nowa wartość
  dotknęłaby mapy koloru, filtra, wagi w pipelinie i bliźniaczej mapy w apce.
- **Rozluźnianie hamulca publicznych dokumentów „bo przeszkadza w sondzie"** —
  próg 5/60 min jest decyzją z Audytu 1. Krok 5 zmienił WYŁĄCZNIE to, co się
  liczy (pomyłki zamiast wszystkiego) i że sukces zeruje licznik.
- **Zmiana sortowania list, żeby nowe rekordy szły na górę** — rozstrzygnięte
  w Fazie 5 na „nie" (przewijamy i podświetlamy).
- **Moduł 16 — wsparcie posprzedażowe.** Do pierwszego klienta.
- **Przeprowadzka na NAS** poza etapem 1.
- Wszystko z sekcji „Świadome decyzje produktowe" w `CLAUDE.md`.

## Uczciwa etykieta stanu

**Kompletny funkcjonalnie, przeaudytowany, nieużywany produkcyjnie.** Trzy
narzędzia, które sprawdzają DANE, a nie kod — przejście „na sucho" (116 zdań,
obie drogi), kontrola spójności na ekranie *Zdrowie* (13 reguł) i `error_log` —
pokazują zero. Zaplecze domknięte na obu drogach, wygląd zrobiony na desktopie.
Wersja tego akapitu dla właściciela, po ludzku i z listą „czego te liczby NIE
obejmują": **`docs/CO-MAM.md`**.

Czego dalej nie ma: ani jednego prawdziwego klienta, ani jednej faktury
wystawionej naprawdę, ani jednego sprawdzenia wyglądu w prawdziwej przeglądarce.
Następny krok, który zmienia stan projektu, jest nietechniczny: rejestracja
działalności.
