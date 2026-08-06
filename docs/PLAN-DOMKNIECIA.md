# Plan domknięcia — od „kompletne" do „gotowe dla klienta"

**Powstał:** 2026-08-05, po zamknięciu trzeciego przejścia.
**Po co:** panel i apka są funkcjonalnie kompletne i przeaudytowane, ale trzy
rzeczy zostały nietknięte: **wygląd oglądany prawdziwymi oczami**, **przyrost
tras od ostatniego audytu bezpieczeństwa** i **przewodnik dla właściciela**.
Ten plan je domyka, w kolejności.

**Zasada:** każdy etap ma jasne kryterium ukończenia i wiadomo, KTO go wykonuje.
Część da się zrobić wyłącznie po Twojej stronie — to środowisko nie ma
prawdziwej przeglądarki i nigdy nie będzie miało.

---

## Etap 1 — Przewodnik: co to potrafi i jak z tego korzystać ✅

**Kto:** ja. **Czas:** jedna sesja. **Dlaczego pierwszy:** bez tego etap 4
(Twój przegląd) byłby błądzeniem po ekranach.
**Brief: `docs/ETAP-1-PRZEWODNIK-BRIEF.md`. ZROBIONE 2026-08-05.**

> **✅ ZAMKNIĘTY. Wynik: `docs/ETAP-1-WYNIK.md` + `docs/CO-MAM.md`.**
>
> Weryfikacja instrukcji dała **12 zdań nieprawdziwych** i **9 mechanizmów,
> o których instrukcja nie wiedziała** — wszystkie poprawione w
> `lib/instrukcje.ts`. Przyczyna jest jedna i warto ją zapamiętać: plik nie
> był ruszany od `e441246` (2026-08-02), a od tamtej pory weszło **51
> commitów**, w tym pięć faz zaplecza i dwa przejścia „na sucho".
>
> **Trzy rzeczy czekają na Twoją decyzję** (opisane w `ETAP-1-WYNIK.md`, sekcja C):
> (C1) windykacja wysyła maile do klienta BEZ Twojego kliknięcia, w tym
> formalne wezwanie po 21 dniach — zostaje czy nie; (C2) godziny automatów
> („6:00") mogą być w UTC, czyli 7:00/8:00 u Ciebie — potwierdź obserwacją,
> o której naprawdę przychodzi poranny mail; (C3) dokumentacja mówiła
> „14 reguł spójności", jest 13 (poprawione w dokumentach, kodu nie ruszano).
>
> Zachowania panelu nie zmieniono ani w jednym miejscu. `tsc` czysto,
> `npm test` 349/349, `npm run przejscie` 111 działa · 0 regresji.

> **Zakres zawężony po rekonesansie (2026-08-05).** Sprawdzenie przed
> napisaniem briefu pokazało, że przegląd z góry **już istnieje** — w panelu,
> na ekranie *Instrukcje* (`WSTEP` w `lib/instrukcje.ts`): jedna historia
> lead → klient → projekt → faktura, zasada „panel nigdy nie kontaktuje się
> za Ciebie" i „nic nie znika po cichu", plus ścieżki krok po kroku dla
> Pulpitu i Leadów. **Pisanie drugiego podręcznika byłoby duplikatem, który
> rozjedzie się w tydzień.** Etap 1 to więc: (1) WERYFIKACJA, czy te 272 wpisy
> nadal mówią prawdę — najważniejsza część, (2) krótkie `docs/CO-MAM.md`
> z tym, czego nigdzie nie ma, (3) ścieżki między modułami tylko, jeśli po
> punkcie 1 widać, że ich brakuje.

Czego dziś faktycznie nie ma: **jednej odpowiedzi na pytanie „co ja właściwie
mam i skąd wiadomo, że to działa"** oraz **jednego miejsca z listą tego, co
dzieje się samo** (dziś rozproszone po 14 modułach).

Powstało (zamiast `PRZEWODNIK.md` — patrz ramka wyżej: przewodnik już istnieje
w panelu, więc etap był WERYFIKACJĄ, nie pisaniem drugiego):

- **`docs/ETAP-1-WYNIK.md`** — lista znalezisk z weryfikacji.
- **`docs/CO-MAM.md`** — dwie strony dla właściciela: co mam, co dzieje się
  samo i o której, czego panel świadomie nie robi, skąd wiadomo, że działa,
  i czego te liczby NIE obejmują.
- **poprawki w `lib/instrukcje.ts`** — 276 wpisów, 14 modułów, wspólne dla
  panelu i apki.

Pierwotny zamysł etapu (nieaktualny, zostawiony dla historii):

1. ~~**`docs/PRZEWODNIK.md`** — jeden dokument, po ludzku:~~
   - co panel potrafi, modułami, w jednym zdaniu na moduł;
   - **trzy ścieżki dnia**: „przyszedł nowy lead", „klient chce ofertę",
     „faktura nie została zapłacona" — krok po kroku, z nazwami przycisków;
   - co robi sam z siebie, bez Ciebie (cron o 6:00, przypomnienia, retencja,
     dokumenty cykliczne, propozycje) — **to jest najmniej oczywista część
     i najczęściej zaskakuje**;
   - czego panel świadomie NIE robi i dlaczego (żadnego modelu AI w decyzjach,
     brak automatycznego wysyłania czegokolwiek do klienta bez kliknięcia);
   - co jest na telefonie, a co zostaje przy biurku (poziom 3).
2. **Podsumowanie stanu** — co zbudowano, co przetestowano i czym (liczby:
   testy, przejścia, audyty), i co świadomie zostało otwarte.

**Skończone, gdy:** przeczytasz i powiesz, czego w tym brakuje albo co jest
niezrozumiałe.

---

## Etap 2 — Bezpieczeństwo: sprawdzenie PRZYROSTU ✅

**Kto:** ja. **Czas:** jedna sesja.
**Brief: `docs/ETAP-2-BEZPIECZENSTWO-BRIEF.md` (2026-08-06).**

> **✅ ZAMKNIĘTY 2026-08-06. Wynik: `docs/AUDYT-1B-PRZYROST.md`.**
>
> **Zero dziur, zero zmian w zachowaniu panelu.** Wszystkie **266 uchwytów**
> mają rozstrzygnięcie: **252 chronione** (sonda bez ciastka → 401),
> **14 publicznych świadomie**, każdy z nazwanym mechanizmem. Wzorzec
> `if (!(await isAuthed()))` utrzymał się przez 39 nowych plików tras.
>
> **Trzy rzeczy poza listą tras — też czysto.** Biała lista `publicFields`
> wytrzymała 52 nowe kolumny (weszła 21, same treści dokumentu; zmierzone
> end-to-end: klient widzi 21 z 43 pól oferty, `powod_odrzucenia` NIE wychodzi).
> Wszystkie 5 publicznych tras zapisujących jest pod hamulcem, próg 5/60 min
> nietknięty. Nowe trasy nie logują danych osobowych; `error_log` czyści oba
> pola.
>
> **Trzecia metoda upadła:** brief pisał „8 × `public/[token]`" — uchwytów
> jest **10**. Ta sama pomyłka „plik ≠ uchwyt" co w Audycie 1, popełniona
> przy pisaniu ostrzeżenia przed nią. Rekonesansowa lista 21 uchwytów też
> była niepełna (brakowało crona `mail/outbox/run`).
>
> Narzędzie zostaje: **`scripts/sonda-401.ts`**, z samosprawdzeniem, które
> **odmawia biegu przy włączonym dev-bypassie**.
>
> `tsc` czysto, `npm test` 352/352, `npm run przejscie` 116 działa · 0 regresji.

> **Rekonesans przed briefem (2026-08-06).** Policzone: **188 plików tras,
> 266 uchwytów HTTP, 39 plików DODANYCH i 83 zmienione po Audycie 1**
> (`a485b00`). Sprawdzenie per uchwyt dało 21 uchwytów bez `isAuthed()`
> w ciele — przejrzane pojedynczo, **żaden nie okazał się dziurą**.
>
> **Przy okazji upadła druga metoda.** Audyt 1 nauczył, że grep po PLIKU
> kłamie; teraz wyszło, że grep po UCHWYCIE kłamie tak samo — ochrona bywa
> o jedno wywołanie dalej (`POST /api/invoices/[id]/ksef/send` deleguje do
> `runSend()`, i to tam stoi `isAuthed()`). **Rozstrzyga wyłącznie sonda 401
> przy wyłączonym dev-bypassie.** Szczegóły i lista 21 uchwytów — w briefie.

Audyt 1 (2026-07-22, `docs/AUDYT-1-WYNIKI.md`) sprawdził 195 wywołań
`isAuthed()` w 149 plikach i zamknął temat. **Od tamtej pory repozytorium
urosło do 188 plików tras i 266 uchwytów HTTP.** Przybyło około czterdziestu
plików — Łowca leadów, Klienci (Moduł 54), Oferty (57), Aneks (58),
propozycje, potwierdzenia, obserwowalność.

`CLAUDE.md` ostrzega wprost: **każda nowa trasa w `app/api` jest domyślnie
OTWARTA**, bo `proxy.ts` wyłącza `/api` ze swojego zakresu. Zapomniana linijka
nie daje żadnego objawu — build przechodzi, panel działa.

Zakres:

1. **Sprawdzenie per uchwyt HTTP, nie per plik** (lekcja Audytu 1: grep po
   pliku kłamał — 9 kontra 16 tras). Różnica 266 − 257 to punkt wyjścia, nie
   wynik: część tras jest publiczna świadomie (formularz kontaktowy, publiczne
   dokumenty klienta, cron z własnym sekretem).
2. **Sonda 401 na każdej trasie oznaczonej jako chroniona** — z wyłączonym
   dev-bypassem, bo inaczej sonda kłamie (to też lekcja z audytu Projektów).
3. **Trzy rzeczy poza listą tras:** czy publiczne strony dokumentów nie
   wypuszczają pól, których klient widzieć nie powinien (`lib/publicFields.ts`
   istnieje — sprawdzić, czy obejmuje nowe kolumny); czy hamulce nadal działają
   po zmianach z Kroku 5; czy nowe trasy nie logują danych osobowych.

**Skończone, gdy:** każdy uchwyt HTTP ma rozstrzygnięcie „chroniony" albo
„publiczny świadomie, bo…", a sonda to potwierdza. Wynik do
`docs/AUDYT-1B-PRZYROST.md`.

---

## Etap 3 — Sytuacje krytyczne, których jeszcze nie przechodziliśmy ✅

**Kto:** ja. **Czas:** jedna sesja.
**Brief: `docs/ETAP-3-BRZEGI-BRIEF.md` (2026-08-06), z rekonesansem.**

> **✅ ZAMKNIĘTY 2026-08-06. Wynik: `docs/ETAP-3-WYNIK.md`.**
>
> **Trzy scenariusze przebiegnięte, czwarty niewykonalny stąd i wiadomo
> dlaczego.** Dwie rzeczy kłamały, obie naprawione.
>
> **(1) Dwie karty.** Różne pola tego samego dokumentu nie depczą się —
> granularność PATCH-a potwierdzona pomiarem. Groźne okazało się co innego niż
> wyścig: **usunięcie**. Karta A kasuje rekord, karta B dalej go edytuje —
> i **9 z 16 rodzajów rekordów odpowiadało `{"ok":true}` na zapis, który nie
> zmienił ani jednego wiersza** (klient, projekt, lead, pozycja i treść oferty,
> zadanie, kamień, punkt startowy, osoba kontaktowa). Naprawione jedną funkcją
> `lib/brakRekordu.ts`; sonda po naprawie: **0 z 16**. Bliźniaki się rozjechały
> — pozycja FAKTURY sprawdzała to od początku, pozycja OFERTY nie.
>
> **(2) Wygasła sesja.** Zmierzone na żywym edytorze: przy tytule oferty toast
> „Nie udało się zapisać." na 3,4 s, przy **treści oferty — ZERO znaków**,
> a ekran w obu przypadkach dalej pokazywał niezapisany tekst. **243 miejsca
> zapisu, w żadnym nie pada 401.** Powstała **straż sesji** (`strazSesji.ts`)
> — jedno opakowanie `window.fetch`, które obejmuje wszystkie 243 i każde
> przyszłe — plus pasek z logowaniem NA MIEJSCU, bez przeładowania. Osiem
> samoczynnych `window.location.reload()` przy 401 usuniętych: kasowały
> niezapisany formularz bez ostrzeżenia.
>
> **(3) Zerwana wysyłka maila** — pierwszy raz uruchomiona, na atrapie SMTP.
> Bezpiecznik odcisku **działa**: zerwanie żądania dało **1 mail u klienta**,
> ponowienie w locie „poprzednia próba trwa", po zakończeniu „już wysłana"
> + wskazanie tamtej wiadomości. Nieudana wysyłka NIE blokuje ponowienia.
>
> **(4) Odtworzenie kopii** — niewykonalne stąd z trzech niezależnych powodów
> (kopie nie są uruchomione, brak `psql`/`pg_dump` i Dockera, brak dostępu do
> Neona). Sprawdzona za to **czujka**: `brak → ok → blad` na Pulpicie działa
> end-to-end. Odtworzenie jednej kopii do pustej bazy — po rejestracji.
>
> **Otwarte świadomie:** wykrywanie „ktoś zmienił ten rekord, odkąd go
> otworzyłeś" (decyzja właściciela: „wykryj i powiedz, nie blokuj" — materiał
> jest, `updated_at` wraca w każdym `GET`, mechanizmu nie ma). **Do etapu 5.**
>
> `tsc` czysto, `npm test` **357/357**, `npm run przejscie` **120 działa ·
> 0 regresji** (nowe zdania sprawdzone kontrolnie przez tymczasowe cofnięcie
> poprawki).

> **Rekonesans przed briefem (2026-08-06), czytany z kodu — NIE zmierzony.**
> Kontroli współbieżności nie ma żadnej (zero `If-Match`/`ETag`, zero
> `UPDATE … AND updated_at = …`) — ostatni zapis wygrywa po cichu. Łagodzi to
> granularność PATCH-a: trasy piszą pole po polu, więc dwie karty w RÓŻNE pola
> prawdopodobnie się nie zadepczą; groźne są pozycje faktury/oferty i edytory,
> które wysyłają cały obiekt. Osobno: **190 wywołań `POST`/`PATCH` w UI panelu
> i ANI JEDNO nie idzie przez wspólne gardło `pobierzJSON`**, więc nie wiadomo,
> co widzi właściciel, gdy sesja wygaśnie w połowie formularza.
>
> **Scenariusz „dwie karty" wymaga decyzji nietechnicznej** (blokada rekordu /
> ostrzeżenie o zmianie / „ostatni wygrywa, ale powiedz") — nie naprawiać bez
> pytania.

Trzecie przejście zamknęło podwójne kliknięcia. Zostały cztery scenariusze
i **jeden z nich jest niesprawdzony i prawdopodobny**:

1. **Dwie karty edytujące TEN SAM rekord** (nie: to samo działanie — tę samą
   *treść*). Otwierasz ofertę na laptopie i na iPadzie, zmieniasz cenę w jednym
   i opis w drugim, zapisujesz oba. **Dziś prawdopodobnie wygrywa ostatni zapis
   i nikt się nie dowiaduje, że pierwszy przepadł.** To inna rodzina niż
   wszystko, co dotąd sprawdzaliśmy.
2. **Zerwane żądanie w połowie wysyłki maila** — bezpiecznik odcisku istnieje
   i wygląda poprawnie, ale nigdy nie przebiegł, bo dev nie ma skrzynki.
   Wymaga prawdziwej skrzynki albo jej atrapy.
3. **Odtworzenie bazy z kopii zapasowej** — Audyt 3 sprawdzał skrypt, ale kopie
   na NAS nie są jeszcze uruchomione (mówi to Pulpit: „Kopie zapasowe bazy nie
   są jeszcze uruchomione").
4. **Wygaśnięcie sesji w połowie pracy** — czy panel mówi „zaloguj się
   ponownie", czy gubi wpisany formularz.

**Skończone, gdy:** każdy scenariusz ma przebieg albo jawny zapis „nie da się
tu sprawdzić i dlaczego". Nowe zdania w `npm run przejscie`.

---

## Etap 4 — Przegląd UI/UX prawdziwymi oczami (TY)

**Kto:** Ty, w prawdziwej przeglądarce. Ja przygotowuję listę i poprawiam.
**Może iść równolegle z etapami 2–3.**

> **ZAKRES ZMIENIONY 2026-08-06 — na Twoją korzyść.** Ten akapit mówił, że
> środowisko renderuje stronę w ukrytej karcie 0×0 i nigdy nie będzie miało
> prawdziwej przeglądarki. **Przestało to być prawdą**: zmierzone tego dnia —
> okno 1264×1243, `requestAnimationFrame` 64 kl./s, zrzuty ekranu renderują
> panel poprawnie. Część mierzalna (przepełnienia, cele dotykowe, kontrast,
> stany puste) **wróciła do mnie** i jest już zrobiona — patrz część A listy.
> Tobie została część B: wrażenie, papier, prawdziwe urządzenia.
>
> **Lista gotowa: `docs/PRZEGLAD-UI-LISTA.md`.**
>
> Z części A wyszło **jedno znalezisko czekające na Twoją decyzję**:
> kwadraciki zaznaczania wierszy mają **14×14 px** przy regule 24×24
> (Klienci 37 szt., Faktury 27, Leady podobnie). Faza 5 ogłosiła ten próg
> domkniętym, ale mierzyła Katalog — a Katalog nie ma kwadracików. Myszą
> trafisz, palcem na iPadzie nie zawsze. Poprawka to 100+ miejsc, więc czeka
> na Twoje słowo.

To jedyna warstwa, której nie sprawdziło żadne z trzech przejść.

Dostaniesz **`docs/PRZEGLAD-UI-LISTA.md`** — listę kontrolną ekran po ekranie,
z konkretnymi pytaniami zamiast „sprawdź, czy ładnie":

- czy coś **drga albo przeskakuje** przy wejściu (najczęstsza rzecz, która
  odbiera wrażenie premium);
- czy przy wolnym łączu widać **stan ładowania**, czy pustkę udającą „nic nie
  ma";
- czy po każdym kliknięciu **wiadomo, że coś się stało** (i po ilu sekundach);
- czy dwa te same rodzaje danych wyglądają **tak samo w różnych modułach**;
- czy da się dojść **samą klawiaturą** tam, gdzie się pracuje najczęściej;
- czy na wąskim oknie coś **wychodzi poza ekran albo zasłania przycisk**;
- czy **wydruki** (oferta, faktura, umowa) wyglądają dobrze na papierze i w PDF.

Plus trzy konkretne rzeczy wiszące od pierwszego przejścia (Escape przy kole
daty, menu „Wstaw z szablonu", lista kanałów zasłaniająca checkbox).

**Skończone, gdy:** przejdziesz listę i oddasz mi zgłoszenia — choćby jednym
zdaniem na sztukę, byle z nazwą ekranu.

---

## Etap 5 — Poprawki z Twojej listy

**Kto:** ja. **Czas:** zależy od tego, co znajdziesz.

Poprawki wchodzą **partiami po module albo po rodzaju**, nie „wszystko naraz" —
tak jak przy Fazie 5, gdzie wzorzec ustalony raz szedł przez cały panel.
Po każdej partii: `tsc`, `npm test`, `npm run przejscie`, commit.

Do tego trzy decyzje produktowe, które i tak trzeba podjąć (kafel „Przychód"
brutto czy netto; rubryka „Zleceniodawca / Wykonawca" na wydruku umowy;
czy porzucenie świeżo zeskanowanego paragonu ma pytać).

**Skończone, gdy:** Twoja lista jest pusta.

---

## Czego ten plan świadomie NIE obejmuje

- **Rejestracji działalności i wszystkiego za nią** (`PO_REJESTRACJI.md`) —
  decyzja: na sam koniec.
- **Przebudów** — to jest domykanie, nie nowy zakres. Jeśli w etapie 4 wyjdzie
  coś, co wymaga przebudowy modułu, trafia na osobną listę i decydujesz.
- **Nowych funkcji.** Moduł 16 (wsparcie posprzedażowe) dalej czeka na
  pierwszego klienta.
