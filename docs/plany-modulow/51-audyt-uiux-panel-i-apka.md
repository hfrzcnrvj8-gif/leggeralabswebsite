# Moduł 51 — Audyt UI/UX i kompletności, moduł po module (panel + obie apki)

> Przeczytaj najpierw `docs/plany-modulow/README.md` (zasady wspólne),
> `CLAUDE.md` i `docs/plany-modulow/00-mapa-drogi-klienta.md` (mapa etapów —
> ten audyt sprawdza, czy każdy etap jest kompletny i spójny NA KAŻDEJ
> PLATFORMIE, nie tylko czy w ogóle istnieje).

## Skąd to się wzięło

Właściciel chce przejść przez panel webowy, apkę iPhone i apkę iPad **moduł
po module** (w kolejności lejka sprzedaży: Pulpit → Leady → Klienci → Oferty
→ Umowy → Projekty → Faktury → Katalog → Kalkulator → Koszty → Poczta →
Kalendarz → Notatnik → Przypomnienia → Statystyki) i dla każdego sprawdzić:
1. **Czy kolejność/nawigacja jest spójna między platformami.**
2. **Czy moduł ma wszystko, co powinien mieć** — czy czegoś nie brakuje
   względem reszty mapy drogi klienta (`00-mapa-drogi-klienta.md`).
3. **Czy jest "na poziomie premium"** wzorem Linear/Things — skróty, swipe,
   long-press, klikalność każdego wiersza, spójność akcji.
4. **Czy moduł jest funkcjonalnie kompletny na KAŻDEJ platformie** (panel,
   iPhone, iPad) — nie tylko czy technicznie istnieje na wszystkich trzech.

Każdy moduł to swój własny czat (jak przy Modułach 11-20).

## Stan po Module "Pulpit" (ten czat, 2026-07-24/25)

**Zrobione i scommitowane (obie repo, wgrane na fizyczne iPhone+iPad):**

1. **Kolejność menu ujednolicona na wszystkich platformach** — panel ma
   już ustaloną kolejność (`AppShell.tsx` NAV, komentarz odsyła do
   `lib/process.ts`). Apka (iPad `PanelBoczny.swift`, iPhone
   `WiecejView.swift`) była poukładana inaczej — poprawione, żeby szła 1:1
   z panelem. Belka iPhone (5 zakładek: Pulpit/Poczta/Leady/Projekty/Więcej)
   **świadomie zostawiona bez zmian** — to inna, wcześniejsza decyzja
   (częstość użycia, nie etap lejka).
2. **Panel: naprawiona sekcja "Wygasłe oferty" na Pulpicie** —
   `expiredOffers` były liczone do licznika "N spraw wymaga działania", ale
   nigdzie się nie renderowały. Dodana sekcja z akcją "Oznacz jako wygasłą".
3. **Apka: swipe-to-resolve + long-press na WSZYSTKICH listach Pulpitu**
   (wzorem Linear/Things), nie tylko na kontaktach nurture jak wcześniej:
   Leady/Klienci/Poczta ("Obsłużone"), Projekty ("Wdrożone"), Faktury/Umowy
   ("Przypomnij"), Wydarzenia ("Usuń" — parytet z ✕ na webie). Naprawiony
   martwy wiersz w "Poczcie do obsługi" (brakowało `NavigationLink`).
4. **Dwie luki z mapy drogi klienta domknięte** (Etap 1 i Etap 10):
   - Statystyki (panel + apka): nowa sekcja "Konwersja per źródło" — które
     źródło leada faktycznie zamienia się w klienta, nie tylko generuje
     leady (`app/api/stats/route.ts` → `conversion.bySource`).
   - Pulpit (panel + apka): kafel "Leady z polecenia" — czy pętla retencji
     faktycznie się kręci (`app/api/hub/today/route.ts` →
     `kpi.referralSharePct`).
5. **Brief Modułu 16 (Wsparcie posprzedażowe) odświeżony i potwierdzony
   jako wciąż aktualny** — to JEDYNY niezbudowany etap całej mapy drogi
   klienta. Świadomie odłożony do pierwszego realnego klienta z potrzebą
   wsparcia — NIE budować na zapas. Przeciek opisany w briefie (zadanie z
   maila do zamkniętego projektu znika bez śladu,
   `app/api/mail/[id]/to-task/route.ts` wciąż nie filtruje po statusie
   projektu) **wciąż istnieje w kodzie**, sprawdzone ponownie 2026-07-24.

**Commity:**
- Panel: `f289bf1` (Wygasłe oferty), `5ccb562` (konwersja per źródło +
  referral na Pulpicie + brief Modułu 16).
- Apka (`leggera-hub-ios`): `e5b8aad` (kolejność + swipe/long-press),
  `f99f9a7` (konwersja per źródło + referral na Pulpicie).

**Wniosek z audytu mapy drogi klienta:** cała droga (Leady → Klienci →
Oferty → Umowy → Onboarding → Realizacja → Faktury → Windykacja →
Zamknięcie/opinia → Retencja) jest **zbudowana i spójna między panelem a
obiema apkami**. Jedyna świadoma, zaakceptowana luka to Moduł 16.

## Stan po module „Leady" (2026-07-25)

**Zrobione i scommitowane** (szczegóły techniczne: `HUB_SETUP.md` → „Moduł 51
(audyt UI/UX) — Leady"):

1. **Kategoria źródła leada przy dodawaniu — panel + apka.** Największa
   znaleziona luka i jedyna, która realnie kłamała w danych: wszystkie cztery
   ścieżki tworzenia leada wpisywały `zrodlo_kategoria` na sztywno („Ręcznie
   dodane"), więc „% leadów z polecenia" i „konwersja per źródło" — dodane
   dzień wcześniej — nie mogły zobaczyć ani jednego polecenia. Panel dostał
   okno „Nowy lead" zamiast prompta o samą nazwę; apka wiersz „Kategoria" w
   formularzu, skanerze wizytówek i w edycji (apka nie umiała jej poprawić
   wcale).
2. **Podpowiedzi statusu (Moduł 1) w apce** — `LeadStatus.podpowiedz` w
   rdzeniu, treść 1:1 z `LEAD_STATUS_HINT`, widoczna nad zakładkami profilu.
3. **NDA (Moduł 11): dedupe po leadzie + widoczny ślad.** Drugie kliknięcie
   tworzyło drugie NDA, a profil leada nie wiedział o dokumencie nic. Teraz
   serwer zwraca istniejące (poza „Odrzucona"), profil pokazuje pigułkę
   „NDA: szkic" z linkiem, przycisk nazywa się „Przygotuj NDA". Apka umie to
   samo i otwiera profil dokumentu w arkuszu.
4. **Parytet premium na apce:** swipe „Obsłużone" + ta sama akcja w menu
   przytrzymania (iPhone i iPad), „Podepnij istniejącego klienta", usuwanie
   leada i wpisu z logu, filtr statusu w pasku, LinkedIn w edycji.

**Świadomie odłożone / nie w zakresie:** import CSV (nie ma go nigdzie —
wejście leadów pokrywają auto-wyszukiwanie OSM, skaner wizytówek, formularz
publiczny i ręczne dodanie; właściciel powiedział, że dziś ma kilka leadów
testowych), pełna edycja adresu z telefonu, kanban na apce.

**Osobny wątek, który wyszedł przy okazji — generator leadów.** Właściciel
zapytał, czy warto go ulepszać. Ocena: `POST /api/leads/discover` stoi na
darmowym OSM (Nominatim + Overpass), więc daje nazwę firmy prawie zawsze, ale
telefon/mail tylko gdy ktoś je ręcznie wpisał na mapę; brak NIP-u, wielkości
firmy, decydenta i jakiegokolwiek sygnału potrzeby. Obsługuje 6 branż i jeden
promień 6 km. To najzimniejszy rodzaj listy. Tanie usprawnienia, gdyby
właściciel chciał: więcej branż, regulowany promień, filtr „tylko wpisy z
telefonem albo mailem" (dziś dokłada leady bez żadnej drogi kontaktu). Poważna
alternatywa to rejestry publiczne (CEIDG/KRS + REGON: NIP i kod PKD, czyli
celowanie w branżę i wielkość zamiast w promień) — to osobny, większy moduł.
Nic z tego NIE zostało zbudowane; brief nie istnieje. Nie zaczynaj bez prośby.

## Stan po module „Klienci" (2026-07-26)

**Zrobione i scommitowane** (szczegóły techniczne: `HUB_SETUP.md` → „Moduł 51
(audyt UI/UX) — Klienci").

1. **Osoba kontaktowa przestała znikać.** Formularz „Nowy klient" w apce
   pokazywał to pole i po cichu je WYRZUCAŁ (serwer go nie przyjmował), a
   poprawić go nie dało się nigdzie: `PATCH /api/clients/[id]` go nie znał, a
   karta klienta w panelu w ogóle go nie wyświetlała. Pole realnie pracuje —
   wita adresata w mailu retencyjnym (`buildNurtureMessage`). Teraz przyjmowane
   przy tworzeniu, edytowalne w obu miejscach.
2. **`POST /api/clients` przestała gubić dane leada i milczeć na osi.**
   Przepisywała tylko firmę/branżę/telefon/mail/www — osoba, LinkedIn, adres,
   źródło i notatki ginęły (Moduł 12 naprawił ten przeciek w `api/offers` i
   `promote`, tę trasę pomijając). Nie logowała też `client_created`, więc
   klient dodany ręcznie miał pustą historię.
3. **Okno „Nowy klient" w panelu zamiast prompta o samą nazwę** — z osobą,
   telefonem, mailem i **kategorią źródła** (domyślnie „Polecenie"). Ten sam
   zabieg, co w Leadach przy Module 51. Apka dostała ten sam wybór kategorii.
4. **`'Inbound'` zniknęło.** Obie trasy „zrób leada/klienta z maila" wpisywały
   wartość SPOZA `SOURCE_CATEGORIES` — nie do odfiltrowania, nie do poprawienia
   pickerem, a w „konwersji per źródło" osobny widmowy kubełek. Jest kategoria
   **„Zapytanie mailem"** (panel + apka).
5. **Karta klienta pokazuje wreszcie to, co moduły 15 i 17 zbierają:**
   kontakty kontrolne (z „Obsłużone" i wyróżnieniem zaległych), zebrane opinie
   z komentarzem i zgodą na referencję, oraz „Skąd przyszedł".
6. **Apka: klient stał się edytowalny.** Nowy `EdycjaKlientaView` (pełna
   wizytówka + adres + **przypomnienie**), sekcja „Powiązane"
   (umowy/projekty/oferty/faktury), podpowiedź statusu, usuwanie klienta i
   wpisu z historii, swipe „Obsłużone" i filtr statusu w pasku (iPhone i iPad).
   Do tego dnia `next_followup` — JEDYNA rzecz zapalająca klientowi „wymaga
   działania dziś" — dała się z telefonu tylko skasować, nigdy ustawić.
7. **Kolory statusu wyrównane** (decyzja właściciela): wygrała paleta apki
   (fiolet = relacja żyje, złoto = prospekt), panel się do niej dostosował.

**Znalezione przy okazji, większe niż moduł: `tailwind.config.ts` nie skanował
`lib/`.** Mapy „status → klasy" (`CLIENT_STATUS_CLASS`, `LEAD_STATUS_CLASS`,
statusy projektów/faktur/umów) mieszkają właśnie tam, czyli poza zasięgiem
Tailwinda — klasa stamtąd działała TYLKO wtedy, gdy przypadkiem pojawiała się
też gdzieś w `app/`. Nowa nie działała wcale i nie dawała żadnego objawu poza
pigułką bez tła. Złapane pomiarem `getComputedStyle` (zrzut wyglądał
wiarygodnie), naprawione jedną linią w `content`.

**Moduł NIE jest zamknięty — trwa rozbudowa poza audyt.** Po pytaniu „czy da
się to jeszcze ulepszyć" powstał program pięciu rzeczy wykraczających poza
parytet (`54-klienci-rozbudowa.md`). Dwie zrobione (rytm kontaktu per klient,
szukanie po treści historii), trzy przed nami: sufity techniczne, wiele osób
kontaktowych, pliki na NAS-ie, plus układ boczny profilu na końcu. **Audyt UI/UX
Klientów jako taki jest domknięty** — kolejne moduły audytu (Oferty, Umowy…)
mogą ruszyć niezależnie, jeśli właściciel tak zdecyduje.

**Runda domykająca (ten sam dzień, po pytaniu „czy to już maksimum")** —
szczegóły w `HUB_SETUP.md` → „Moduł 51 — Klienci, runda domykająca": opinie
i korespondencja w apce (pierwsza runda dała je tylko panelowi), źródło klienta
edytowalne wraz z auto-kategoryzacją dla rekordów sprzed zmiany, oraz „+ Nowa
oferta / + Nowa faktura" wprost z karty klienta.

**Świadomie nie ruszone:** retencja/RODO klientów (brak auto-usuwania jest
decyzją z Audytu 2), rzeczy z `PO_REJESTRACJI.md`, Moduł 16 (wsparcie
posprzedażowe — jedyny niezbudowany etap mapy, czeka na pierwszego klienta
z realną potrzebą), tablica kanban i eksport CSV w apce (to samo zawężenie
„pełna kartoteka to praca przy biurku", co przy Leadach).

### Domknięcie: profil rekordu przebudowany (Leady + Klienci, 2026-07-26)

Ostatni krok Modułu 54 („układ boczny profilu") urósł w **pięć rund**
prowadzonych zgłoszeniami właściciela — od „wszystko się zlewa" po „karta
zajmuje za mało miejsca". Objął OBA profile: klienta i leada. Pełny zapis
z powodami i pomiarami: `HUB_SETUP.md` → „Moduł 54 — Klienci, krok 6".

Skrót tego, co obowiązuje od teraz i czego **nie należy cofać bez pytania**:

- Profil = **kolumna atrybutów po lewej + treść po prawej**, bez zakładki
  „Wizytówka". Od `2xl` dochodzi trzecia kolumna: formularz nowego wpisu.
- Karta ma **stałą wysokość `85vh`** od `lg`, kolumny przewijają się osobno.
- Atrybuty stoją w **nazwanych sekcjach na płytach** (`SekcjaProfilu`,
  `WierszPola`, klasa `.card-inset`) — zwijanych i zapamiętywanych.
- **Wiersz atrybutu ma stały rytm 38 px**, etykieta stałą szerokość
  w pikselach i ikonę; puste pole pokazuje `—`.
- Oś czasu to **jeden ciąg na pionowej linii**, nie stos kart.

**Metodyczna lekcja z tych rund, warta przeniesienia na Oferty:** trzy
kolejne zgłoszenia właściciela („zlewa się", „koślawo", „za mało miejsca")
rozstrzygnął dopiero POMIAR w przeglądarce (wysokości wierszy, pozycje
krawędzi), nie oglądanie zrzutu. Zrzut wyglądał za każdym razem wiarygodnie.

## Stan po module „Oferty" (2026-07-26)

**Zastane dobrze** (i dlatego nieruszone): Moduł 20 (szablony ofert) —
najwyżej oceniona pozycja backlogu — **był już zbudowany**: panel szablonów,
„Wstaw z szablonu", `POST /api/offers/[id]/apply-template`, plus dołożony
później katalog komponentów (Moduł 47). Akceptacja oferty jest atomowa
(jedna transakcja, „claim" chroniący przed podwójnym kliknięciem), umowa
z oferty ma dedupe po stronie serwera, publiczny e-podpis i unieważnianie
linków (Moduł 40) działają po obu drogach wejścia.

**Zrobione w tym module** (szczegóły techniczne: `HUB_SETUP.md` → „Moduł 57
(audyt UI/UX) — Oferty"):

1. **Profil oferty przestał ukrywać jej stan.** Lista malowała przeterminowaną
   ofertę na czerwono, a profil pokazywał tę samą datę na biało i świecił
   przyciskiem „Akceptuj ofertę". Teraz w nagłówku stoi pigułka statusu
   (klikalna — status zmienia się z profilu, nie tylko z listy) i odznaka „po
   terminie ważności", a przy dacie ostrzeżenie tłumaczące, co to zmienia.
2. **Odrzucenie zostawia ślad i powód.** Oś czasu klienta znała tylko sukces
   (`offer_created`/`offer_sent`/`offer_accepted`) — klient, który powiedział
   „nie", kończył się wpisem „wysłano ofertę". Doszły `offer_rejected`
   i `offer_expired` oraz zamknięta lista pięciu powodów (+ własny komentarz),
   pytana JEDNYM oknem wspólnym dla listy i profilu. Zdarzenie powstaje tylko
   przy realnej zmianie statusu — drugie kliknięcie nie dopisuje drugiego.
3. **Karta oferty wie, że umowa już istnieje.** Serwer dedupował od dawna, ale
   przycisk zawsze mówił „Wygeneruj umowę", a komunikat „Wygenerowano" — także
   wtedy, gdy umowa leżała podpisana. Teraz `GET /api/offers/:id` dokłada
   umowę, a karta pokazuje jej status i „Otwórz umowę".
4. **Status walidowany.** `PATCH` przyjmował dowolny string do 40 znaków, więc
   literówka wypadała naraz z filtra, z koloru pigułki i z ważonego pipeline'u
   (fallback wagi = 1 zawyżał prognozę). Teraz 400 dla nieznanej wartości.
5. **Sufit i praca wsadowa.** `GET /api/offers` oddaje najwyżej 1000 ofert
   z `total` i GŁOŚNYM ostrzeżeniem nad listą (wzorzec z Modułu 54, krok 3a);
   pasek zaznaczenia woła nowe `/api/offers/bulk` zamiast N żądań w pętli.
6. **Lista: szukanie (`/`), kursor `j/k` + Enter, filtr „po terminie".**
   Wskaźnik „W toku" mówi teraz wprost, ile z tej kwoty jest po terminie
   (świadomie NIE zmieniamy samej liczby — to byłaby druga definicja tego
   samego wskaźnika). Pusty stan tłumaczy, co oferta zmienia, zamiast „brak".
7. **Waluta dokumentu** (decyzja właściciela). Oferta była trójjęzyczna, ale
   wydruk liczył zawsze w złotówkach — po niemiecku pokazywał „6.000,00 zł".
   Waluta przenosi się na fakturę przy akceptacji. Wskaźniki NIE przeliczają
   walut (zero kursów w panelu) i mówią o tym pod spodem.
8. **VAT szkicu faktury wywiedziony z kraju klienta** (decyzja właściciela):
   pusty/Polska → 23%, inny kraj → „np" (odwrotne obciążenie). Wcześniej `'23'`
   było wpisane na sztywno dla każdej pozycji, także zagranicznej.
9. **Profil na etykietowanych wierszach** (`SekcjaProfilu`/`WierszPola`,
   wzorzec z Modułu 54): siedem pól danych klienta rozpoznawalnych wyłącznie
   po placeholderze — a placeholder znika, gdy pole ma treść. Zmierzone po
   zmianie: rytm wierszy 38–39 px, kolumna treści 603 px (było 438),
   karta `max-w-5xl` zamiast `3xl`. **Szerokości NIE zrównywano z Leadami/
   Klientami** (te są pełnoekranowe) — tabela pozycji tego nie potrzebuje.
10. **Apka: ofertę da się zamknąć z telefonu.** „Klient odrzucił" (z powodem)
    i „Wygasła" — gestem na liście, z menu przytrzymania i z profilu; powód
    widoczny w sekcji „Dlaczego odpadła". Kwoty w walucie oferty. Tworzenie,
    edycja pozycji i akceptacja dalej zostają przy biurku (poziom 2 bez zmian)
    — akceptacja zakłada projekt i fakturę, to praca na desktop.

**Znalezione przy okazji, poza modułem: numer dokumentu mógł wyjść klientowi
jako `OF-NaN-964BE4`.** `offerReference()` liczył rok przez `new Date(created_at)`,
a baza oddaje `„2026-07-26 19:12:44.487+01"` (zmierzone) — spacja zamiast „T",
strefa bez dwukropka, czyli format, którego nie parsuje silnik dat Safari.
Chrome wybaczał, iPhone klienta nie musi. Naprawione wspólną funkcją
`documentYear()` w `lib/documents.ts`, użytą też przez `contractReference`
(Umowy miały tę samą linijkę).

**Sprawdzone i ŚWIADOMIE nieruszone:**

- **Kolor „Wysłana": cyjan w panelu, fiolet w apce.** Pierwsza ocena brzmiała
  „rozjazd do naprawy" — pomiar pokazał co innego: cyjan jest w panelu
  KONSEKWENTNY dla „dokument w obiegu" w TRZECH modułach naraz (Oferty, Umowy,
  Faktury), a fiolet jest równie konsekwentny w apce. To dwie spójne palety,
  nie błąd w Ofertach. Zmiana w jednym module zrobiłaby świeżą niespójność
  wewnątrz panelu. **Do rozstrzygnięcia raz, dla wszystkich dokumentów** —
  naturalne miejsce: moduł Umowy. (Czerwona „Odrzucona" w panelu vs szara
  w apce to nie rozjazd, tylko udokumentowana reguła „w apce bez czerwieni".)
- Poziom 2 apki (brak tworzenia i edycji pozycji oferty na telefonie).
- iPad pokazuje Oferty jako listę z telefonu, bez układu trójkolumnowego —
  przy dokumencie poziomu 2 to nie boli tak, jak bolało przy Leadach.
- Rzeczy z `PO_REJESTRACJI.md` (dane sprzedawcy na wydruku, KSeF).

**Dług zauważony, NIE naprawiony w tym module** (ta sama pułapka co punkt
z `OF-NaN`, ale w innych modułach): `ClientDetailPanel.tsx:425` sortuje oś
czasu przez `new Date(created_at)` w przeglądarce, a `NoteActivityLog.tsx:120`
tak samo renderuje datę — na Safari dadzą złą kolejność i „Invalid Date".
Do zrobienia przy najbliższym dotknięciu tych plików.

### Runda 6 — AUDYT modułu Oferty (2026-07-27)

Osobny czat, zadanie: sprawdzić, co powstało w rundach 1–5, bez dokładania
funkcji. Pełny raport i wnioski otwarte: `HUB_SETUP.md` → „Audyt Modułu 57".

**Cztery poprawki, każda z dowodem z sondy po realnych trasach:**

1. Trzy trasy oferty (`DELETE` pozycji, `DELETE` sekcji, `apply-template`)
   nie miały blokady — wysłaną ofertę dało się przebudować innym czasownikiem
   HTTP niż zablokowany `PATCH`.
2. Trzy trasy pozycji faktury nie miały blokady. Na wystawionej `FV 5/2026`
   sonda skasowała pozycję za 1 000 zł i wstawiła 9 999 zł.
3. `wybrana` (wybór pozycji opcjonalnych) było zamrożone w migawce — klient
   po akceptacji widział kwotę 1 000 zł przy fakturze na 1 500 zł.
4. `wazna_do` też było zamrożone, mimo że blokada jawnie pozwala je zmieniać.

**Metoda, która to znalazła — i tylko ona:** sonda `curl` po każdym UCHWYCIE
HTTP osobno, na lokalnym dev-panelu (PGlite), z odczytem stanu bazy ORAZ
strony klienta po każdej próbie. Przegląd kodu przepuścił wszystkie cztery:
pliki *importują* blokadę i wołają ją w pierwszym uchwycie, więc grep po
pliku daje trafienie, a drugi uchwyt jest otwarty. Dokumentacja rundy 5
twierdziła, że blokady są kompletne.

**Zasada z migawki, warta zapamiętania:** do migawki należy to, co NAPISAŁ
właściciel; żywe zostaje to, co ZROBIŁ klient (wybór, podpis) albo co jest
sterowaniem dokumentem (status, ważność, unieważnienie linku).

### Runda 7 — wnioski audytu wykonane + ANEKS (2026-07-27)

Właściciel poprosił o wdrożenie wszystkich wniosków z audytu. Wykonane:
licznik otwarć nie liczy skanerów poczty ani prefetchu, hamulec na trzech
publicznych trasach dokumentów, retencja dowodu e-podpisu (6 lat, czyści
metryczkę techniczną a nie podpis), ilość i jednostka w pozycjach oferty,
„Odrzucona" na neutralnym kolorze w Ofertach i Umowach. Świadomie pominięte:
pozycje oferty na telefonie (wycena zostaje przy biurku).

**ANEKS zbudowany** (Moduł 58) — łańcuch dokumentów jest domknięty: faktura
ma korektę, oferta nową wersję, umowa aneks. Kształt „było → jest", wiersz
w `contracts` z `typ='aneks'`, bez osobnej tabeli. Szczegóły i cztery
pułapki: `HUB_SETUP.md` → „Moduł 58".

**Wniosek metodyczny z całej tej sesji:** trzy z czterech dziur w blokadach
i obie w migawce znalazła **sonda po realnych trasach**, nie przegląd kodu —
a wszystkie były w miejscach, o których dokumentacja twierdziła, że są
domknięte. Przy Umowach zaczynaj od sondy.

### Runda 5 — dokument i jego nienaruszalność (2026-07-27)

- **Kalendarz zamiast koła dat** we WSZYSTKICH polach daty panelu: tydzień od
  poniedziałku, „dziś" na złoto, pod siatką „za N dni". Koło zostaje pod
  `wariant="kolo"`.
- **Kwoty netto na dokumencie** (PL/EN/DE) + zdanie o odwrotnym obciążeniu dla
  klienta spoza Polski. Brzmienie do weryfikacji: `docs/DO-PRAWNIKA-I-TLUMACZA.md`.
- **Bloki treści przepisane** — koniec z didaskaliami w nawiasach, które
  poszłyby do klienta; wskazówka dla właściciela żyje w panelu (`podpowiedz`).
- **Blokada dokumentów po wysłaniu** (faktura / umowa / oferta) egzekwowana
  w TRASACH, nie w edytorze, plus **migawka oferty** przy wysyłce. Szczegóły
  i pułapki: `HUB_SETUP.md` → „Blokada dokumentów po wysłaniu".
- **Kolor „Wysłana"** ujednolicony na fiolet marki (panel dołączył do apki).
- Podgląd dokumentu w apce chowa pasek strony wydruku REGUŁĄ CSS (skrypt po
  załadowaniu trafiał w moment, w którym React jeszcze nie narysował paska).

### Runda 4 — apka (2026-07-27)

Oferty przeszły na iPhone'a i iPada w zakresie „wszystko oprócz cennika"
(decyzja właściciela), razem z akceptacją oferty z telefonu. Szczegóły
i pułapki: `HUB_SETUP.md` → „Moduł 57, runda 4".

**Zostaje otwarte:** kolor „Wysłana" (cyjan panel / fiolet apka) do
rozstrzygnięcia raz dla wszystkich dokumentów przy module Umowy, podręcznik
obsługi dla części mobilnej, oraz szablony ofert na telefonie (świadomie nie —
to praca przy biurku).

## Stan po module „Umowy i NDA" (2026-07-27)

Audyt + wdrożenie wniosków w jednym podejściu (prośba właściciela). Pełny
zapis techniczny: `HUB_SETUP.md` → „Audyt Modułu 11 — Umowy i NDA".

**Cztery dziury w nienaruszalności dokumentu, każda z dowodem z sondy:**

1. **Blokadę podpisanej umowy zdejmowało jedno żądanie.** `PATCH
   {"status":"Szkic"}` → 200, potem `PATCH {"cena":1}` → 200: dokument
   zostawał z podpisem i datą podpisu, ale z inną treścią. Blokada chodzi
   teraz po `accepted_at`, nie po statusie — bo status jest polem WOLNYM mimo
   blokady (żeby dało się dokument zamknąć), więc oparcie na nim było drzwiami
   na oścież.
2. **`DELETE` kasował podpisaną umowę** (200). Faktura z numerem miała ten
   zakaz od dawna; umowa nie miała żadnego. Sonda skasowała podpisaną umowę,
   do której istniał podpisany aneks — aneks został na liście jako sierota.
3. **`status` przyjmował dowolny string** (zapisane: `ZUPELNIE-DOWOLNY-STRING`).
   Ta sama dziura, którą Oferty załatały w Module 57.
4. **`send` działał na dokumencie już podpisanym**: druga strona dostawała mail
   „można podpisać elektronicznie", `sent_at` wracało na zero (licznik ciszy),
   a na osi klienta lądowało „Wysłano" PO „Podpisana".

**Migawka umowy** (nowe) — powód INNY niż przy ofercie: oferta jest
zablokowana od wysyłki, umowa dopiero od podpisu, więc w całym oknie negocjacji
publiczny link renderował dane żywe. Sprawdzone end-to-end: zmiana w bazie nie
zmienia tego, co widzi druga strona, dopóki nie wyślesz ponownie.

**Aneks podpisywał się jako „Umowa" w czterech miejscach panelu** (Pulpit,
wyszukiwarka, dwa wpisy na osi klienta + powiadomienie) — dokładnie ten sam
błąd, który Moduł 58 naprawił po stronie apki. Dzienny mail używał słownika od
początku, więc panel i mail mówiły o tym samym dokumencie dwa różne słowa.

**Waluta umowy nie istniała**: `POST /api/contracts` nie kopiował jej z oferty
(EUR → PLN), edytor nie miał ani pickera waluty, ani pola Kraj, a podgląd kwoty
formatował zawsze w złotówkach. To ta sama klasa co „VAT 23% na sztywno"
z Ofert: liczba wyglądała poprawnie i była nieprawdziwa.

**Odrzucenie zostawia ślad** — `contract_rejected` na osi czasu klienta plus
osobna lista powodów (`CONTRACT_REJECT_REASONS`, świadomie inna niż ofertowa:
ofertę przegrywa się na cenie, umowę na zapisach). Przy NDA to jedyne miejsce,
gdzie w ogóle da się zapisać, dlaczego kontrahent nie podpisał.

**Profil i lista** dostały wzorzec z Modułu 57: pigułka statusu i cisza
w nagłówku, „Sporządź aneks" w profilu (bo to tam pada komunikat blokady),
aneksy widoczne z umowy i umowa z aneksu, etykietowane wiersze (38 px),
`max-w-5xl`, sufit z `total`, szukanie `/`, kursor `j/k`, sensowny pusty stan.

**Apka**: aneks pokazuje „było → jest" zamiast udawać umowę (serwer przestał
oddawać mu klauzule), doszły „Oznacz jako podpisaną" i „Nie podpisali"
z powodem (gest, menu, profil), cisza od N dni i filtr statusu; zniknęła pusta
sekcja „Zakres prac" na szkicu — zgłoszenie właściciela z 26.07.

**Świadomie nie ruszone:** poziom 2/3 apki (tworzenie umowy, klauzule i
sporządzanie aneksu zostają przy biurku), trójkolumnowy iPad dla Umów, treść
klauzul (czeka na prawnika — `docs/DO-PRAWNIKA-I-TLUMACZA.md`).

**Lekcja metodyczna, trzeci raz z rzędu:** wszystkie cztery dziury znalazła
sonda po realnych trasach, nie przegląd kodu — i wszystkie były w module, który
audyt Ofert opisał zdaniem „Umowy: bez zarzutu". Tamto sprawdzenie objęło
`PATCH` i ponowny e-podpis, a nie `DELETE`, `send` ani przejścia statusu.


### Runda 2 — sześć dodatków z rynku (2026-07-27)

Po audycie właściciel zapytał, do jakiego rozwiązania rynkowego można się
porównać. Punkt odniesienia: **DocuSign / Dropbox Sign** po stronie podpisu
i **Juro / Concord** po stronie cyklu życia umowy (CLM); PandaDoc jako
najbliższy kształtem all-in-one. Wniosek: pod względem obiegu panel był już
blisko Dropbox Sign, brakowało sześciu rzeczy — wszystkie zbudowane
(szczegóły: `HUB_SETUP.md` → „Umowy — paczka «koniec czarnej skrzynki»"):

1. **Przypomnienie o podpisie** (`/remind`) — Pulpit mówił „cisza od 12 dni"
   i zostawiał właściciela z pustą skrzynką. Przy okazji: „Przypomnij" na
   Pulpicie APKI wołało `send`, czyli wysyłało dokument ponownie.
2. **Ślad otwarcia** — po wysyłce umowy zapadała cisza absolutna; „nie
   przeczytał" i „czyta trzeci raz" wyglądały tak samo.
3. **Okres obowiązywania + alert odnowienia** — rdzeń CLM. Alert liczy się do
   terminu WYPOWIEDZENIA, nie do daty końca: po nim umowa odnawialna przedłuża
   się sama i ostrzeżenie jest bezużyteczne.
4. **Rodzaje umowy** (wdrożeniowa / utrzymaniowa / PoC) — szablon wybiera
   PODZBIÓR istniejących klauzul i nie dopisuje ani jednego nowego zdania
   prawnego. Brakujące klauzule (SLA, prawa do materiałów PoC) wypisane
   w `docs/DO-PRAWNIKA-I-TLUMACZA.md`.
5. **Stanowisko podpisującego** — opcjonalne, wpisuje je sama osoba podpisująca.
6. **Podpis po naszej stronie** — dokument ma wreszcie dwie rubryki.

**Świadomie NIE kopiowane** (funkcje dla zespołu, nie dla jednej osoby):
negocjacje z komentarzami i wersjonowaniem w dokumencie, obiegi zatwierdzeń,
integracje z CRM-ami korporacyjnymi, „AI review klauzul".

## Stan po module „Projekty" — sesja 1, fundament (2026-07-31)

Audyt + wdrożenie w jednym podejściu. Pełny zapis techniczny: `HUB_SETUP.md`
→ „Audyt Modułu 60 — Projekty, sesja 1". Sesja 2 (wygląd) dostała odświeżony
brief: `PROMPT-60B-PROJEKTY-WYGLAD.md`.

**Integralność: 28/28 uchwytów zdrowych — pierwszy taki wynik w tej serii.**
Sonda po każdym uchwycie osobno, z wyłączonym dev-bypassem (bez tego `curl`
lokalnie zwraca 200 wszędzie i nie dowodzi niczego): 26 tras prywatnych oddaje
401 bez ciasteczka, 2 publiczne — 404 na nieznanym tokenie. Unieważnianie
linków (Moduł 40) trzyma w obu publicznych. Po Ofertach (7 otwartych tras)
i Umowach (4 dziury) to jest zaskoczenie warte odnotowania: **tu dokumentacja
nie kłamała**.

**Za to bramka umowy — jedyna twarda bramka w panelu — przepuszczała jedną
spacją.** To znalezisko wyszło dopiero z sondy, nie z przeglądu kodu i nie
z briefu. Brak walidacji słownika był w briefie opisany jako usterka
kosmetyczna („pigułka bez tła"); w rzeczywistości bramka Modułu 31 porównuje
status przez `=== "W trakcie"`, więc:

| wsad | przed | po |
|---|---|---|
| `{"status":"W trakcie"}` | 409 „brak podpisanej umowy" | 409 |
| `{"status":"W trakcie "}` | **200 — projekt z klientem startował bez umowy** | 409 |
| `{"status":"BZDURA"}` | 200 | 400 |
| `POST` projektu ze statusem `CAŁKOWITA_BZDURA` | 200 | 400 |

Trasy **przycinają wsad przed sprawdzeniem słownika** — sam strażnik bez
`trim()` zamknąłby połowę dziury. Słownik wszedł też do `POST` (brief mówił
tylko o `PATCH`), a przy okazji `POST` dostał `isPlausibleDateString()` na
`termin`: zakładanie projektu było ostatnią drogą, którą `<input type="date">`
mógł wpuścić rok „0202".

**Hamulec na publicznej trasie opinii** — 12 prób pod rząd przechodziło pełną
rundę do bazy. Teraz `HAMULEC_DOKUMENT_PUBLICZNY` (5/60 min) jak w ofertach
i umowach: sonda dostaje 429 z `Retry-After` od szóstej próby.

**Rabat nie wchodził do rentowności projektu.** Znalezione poza briefem, ta
sama klasa co „VAT 23 % na sztywno" z Ofert: `SUM(ilosc * cena_netto)` bez
`(1 - rabat_procent / 100)`, podczas gdy lista faktur, eksport dla księgowej,
wezwanie do zapłaty i rejestr wpłat rabat stosowały. Jedna literówka zawyżała
**trzy** wskaźniki naraz (przychód → zysk → efektywna stawka godzinowa) i żaden
nie wyglądał na zepsuty. Ta sama literówka była w profilu klienta — poprawiona
przy okazji, bo to jedna linia i ten sam defekt.
Dowód: pozycja 1000 zł z rabatem 50 % → przychód 2600, nie 3100.

**Znaczniki czasu.** Licznik działającego stopera i daty w logu aktywności
parsowały TIMESTAMPTZ gołym `new Date()` — na Safari `Invalid Date`, czyli
`NaN` zamiast czasu sesji i „Invalid Date" wprost na osi historii. Oba przez
`parsePgTimestamp`. Apka była czysta (`Daty.zZnacznika`).

**Sufity.** `GET /api/projects` oddawało wszystko bez limitu i bez `total` —
teraz wzorzec z Ofert (1000 + `total` + głośne ostrzeżenie). Oś czasu dostała
**własny, niższy sufit** (500), bo każdy jej wiersz ciągnie tablicę kamieni
milowych; ma więc własne ostrzeżenie, mówiące inną liczbą niż lista.
**Eksport CSV świadomie BEZ sufitu** — obcięty plik kłamie gorzej niż wolny,
a żaden z sześciu eksportów panelu limitu nie ma. Ostrzeżenie trafiło też do
apki (`PasekSufituProjektow`, bliźniak klienckiego), bo apka filtruje i sortuje
lokalnie: bez tego telefon odpowiadałby „nic nie pasuje" na projekt, który
istnieje.

**Domknięcie lejka — dwie luki, obie zamknięte:**

- **Z projektu nie było widać ŻADNEGO dokumentu.** Powiązania istniały w bazie
  w obie strony, ale profil projektu nie pokazywał ani umowy, ani faktur. Efekt
  absurdalny: bramka odmawiała startu „bo brak podpisanej umowy", a właściciel
  nie miał stąd jak sprawdzić, czy umowa istnieje. Nowa sekcja „Dokumenty".
- **Z zakończonego projektu nie było drogi do faktury.** `POST /api/invoices`
  przyjmował `project_id` od zawsze, ale nic go stąd nie wołało. Przycisk
  „Wystaw fakturę" + trasa kopiuje teraz **migawkę nabywcy** z karty klienta
  (wcześniej podnosiła samo `client_id`, więc faktura z projektu rodziła się
  z pustym nabywcą — „jeden ruch" byłby fikcją). Faktura powstaje jako szkic
  z pustymi pozycjami: zgadywanie kwoty z kamieni milowych byłoby wpisaniem
  liczby, której nikt nie zatwierdził.

**W porządku bez zmian** (sprawdzone, nie założone): onboarding startuje sam
obiema drogami zakładania projektu (ręczną i przez akceptację oferty), prośba
o opinię ma widoczny ślad i idempotencję claim-style, daty `start`/`termin`
i kamieni milowych szły przez `isPlausibleDateString()` po stronie serwera,
format czasu panel ↔ apka zgadza się **co do arytmetyki** (`round` w tych
samych trzech miejscach), a stoper liczy się na serwerze z `started_at`, więc
ubicie apki go nie gubi.

**Parytet.** Apka wołała wszystko poza `timeline` i `export`. **Oś czasu weszła
na iPada natywnie** (decyzja właściciela): `OsCzasuProjektow.swift` — pasma
kolorowane statusem, kamienie jako punkty, kreska „dziś", trzy skale, tryb na
całą szerokość modułu z przełącznikiem w nagłówku. Świadomie bez cykli (w
panelu to sama dekoracja), bez krzywych zależności i bez przeciągania pasm.
Na iPhonie i wąsko na iPadzie osi NIE ma — z tego samego powodu.
`export` zostaje przy biurku (Moduł 38).

**Zostawione dla sesji 2** (świadomie, nie z braku czasu): trzy pola ⚠️
z inwentarza Modułu 59 — kolor, nawigacja, treść — oraz cała lista kontrolna
wyglądu na trzech platformach.

**Pułapka warta zapamiętania:** komentarz SQL-owy `--` wewnątrz tagowanego
szablonu `sql\`…\`` **wycina resztę zapytania** — nowe linie w tych szablonach
się gubią. Złapane sondą przy tej właśnie poprawce rabatu; `tsc` tego nie widzi,
a trasa zwraca pustą odpowiedź bez błędu w UI. Wewnątrz zapytań tylko komentarze
blokowe, uzasadnienia nad zapytaniem.

## Stan po module „Projekty" — sesja 2, wygląd (2026-07-31)

Trzy pola ⚠️ z inwentarza Modułu 59 (kolor, nawigacja, treść) plus cała lista
kontrolna na trzech platformach. Pełny zapis wzorców: `HUB_SETUP.md` → „Moduł 60,
sesja 2". Wiersz „Projekty" w tabeli `59-spojnosc-ui.md` wypełniony, z dwoma
przypisami, żeby ✅ nie znaczyło więcej, niż znaczy.

**Ten sam rozjazd koloru wrócił po raz DRUGI — i to jest najważniejsze
znalezisko tej sesji.** Audyt z 2026-07-20 zastał status „W trakcie" w trzech
barwach naraz (pigułka, oś czasu, kanban), właściciel wybrał pigułki jako
obowiązujące, a pozostałe mapy **przepisano ręcznie** do tej samej wartości.
Osiem dni później Moduł 59 (D+) przeniósł pigułki na wspólną skalę `Stan`
i zabrał „Testy / review" pomarańcz — a mapa hex, mapa ikon kanbanu i apka
zostały z pomarańczem, bo nic ich do pigułek nie WIĄZAŁO poza komentarzem
„kolory zgodne z pigułkami". Komentarz przetrwał, zgodność nie.

| „Testy / review" | przed | po |
|---|---|---|
| pigułka panelu | fiolet (`uNich`) | fiolet |
| pasek osi czasu (`PROJECT_STATUS_HEX`) | **pomarańcz `#f97316`** | fiolet |
| ikona kanbanu (`STATUS_ICON`) | **pomarańcz `orange-400`** | fiolet |
| apka (`ProjektStatus.kolor`) | **`.markaPomarancz`** | fiolet |

Stawka nie była estetyczna: **pomarańcz znaczy od Modułu 59 „po terminie"**,
więc projekt w testach u klienta wyglądał jak projekt spóźniony. Wszystkie
cztery formy wyliczają się teraz z jednego słownika (`PROJECT_STAN` →
`mapaStanow`/`mapaKropek`/`mapaTekstow`/`mapaHexow`, w apce `ProjektStatus.stan`).
**Ręczne przepisanie map do jednej wartości nie naprawia rozjazdu — odracza go
do najbliższej zmiany.**

**Trzy osie na jednej karcie używały dwóch barw.** Zdrowie „Na dobrej drodze"
brało tę samą zieleń, co status „Wdrożone", a priorytet „Krytyczny" tę samą
czerwień, co zdrowie „Zerwany" — wszystko widoczne jednocześnie na jednym
wierszu kanbanu. Decyzje właściciela: zdrowie odzywa się kolorem **tylko gdy
jest źle** (zieleń zostaje wyłącznie dla domknięcia sukcesem), priorytet idzie
**bez barwy** — niosą go kształt (słupki → trójkąt) i jasność. Kanban zresztą
już tak działał: kropka zdrowia gasła do 40 %, dopóki projekt nie był zagrożony,
czyli sam kod uznawał zieleń za szum — tylko pigułka o tym nie wiedziała.

**Siedem map na trzy właściwości.** Poza czterema mapami statusu były jeszcze
trzy mapy zdrowia (`lib/projects.ts` + dwie lokalne kopie z wpisanymi hexami
spoza palety marki) i **dwie kopie priorytetu** — oś czasu miała własnego
„Krytycznego" jako pomarańczowy kwadrat z „!", kanban jako czerwony trójkąt.
Ten sam projekt wyglądał inaczej w dwóch widokach tego samego modułu.

**Kafel gestu w apce brał kolor MARKI zamiast koloru znaczenia** — 6 miejsc
w 4 modułach (`Wyślij` w Ofertach i Umowach, `Archiwum` w Notatniku, `Stoper`
w Projektach ×2). W Projektach to była już realna kolizja: fioletowy kafel
stopera stał na tej samej liście, co fioletowa kropka „Testy / review".
Poprawione razem (zasada 1 dokumentu 59): stoper = `wToku`, wysyłka = `uNich`,
archiwum = `zamkniete`. Przy okazji ten sam stoper był **cyanowy na liście
i zielony w profilu** — zieleń znaczy „domknięte sukcesem", a uruchomienie
pomiaru niczego nie domyka.

**Instrukcje w panelu uczyły odwrotnego gestu niż apka.** Paczka G (31.07)
odwróciła kierunki w kodzie i nie tknęła `lib/instrukcje.ts`: cztery moduły
dalej pisały „w lewo — Obsłużone / Wyślij". To ten sam rozjazd, który Moduł 59
sprzątał, tylko w tekście zamiast w kodzie — i groźniejszy, bo instrukcja uczy
odruchu. Poprawione we wszystkich czterech. **Projekty dopisane do instrukcji**
(szósty moduł).

**Oś czasu na iPadzie — dwie usterki układu, obie widoczne dopiero na ekranie:**

| co | dlaczego |
|---|---|
| oś wisiała w POŁOWIE ekranu, ~500 pt pustki nad nagłówkiem | `ScrollView([.horizontal, .vertical])` **centruje** treść mniejszą od okna, inaczej niż zwykły, jednokierunkowy ScrollView. Przy ośmiu projektach czyta się to jak niezaładowany ekran. `.defaultScrollAnchor(.topLeading)` |
| odstępy pasm szły na przemian 58 i 34 pt zamiast równych 46 | pas rytmu był DZIECKIEM ZStacka, więc `Rectangle()` bez rozmiaru brał udział w mierzeniu wiersza. Poszedł na `.background` |

Drugie czyta się jak przypadkowe grupowanie projektów w pary — czyli rozmiar
i odstęp niosły znaczenie, którego nie ma (ta sama klasa co `items-start`
z paczki Pulpit).

**Sekcja „Dokumenty" z sesji 1 przeszła listę kontrolną i miała trzy braki:**
przycisk „Wystaw fakturę" stał także pod komunikatem „projekt bez klienta
dokumentów nie potrzebuje" (ekran przeczył sam sobie, a kliknięcie zakładało
fakturę z pustym nabywcą — migawkę trasa kopiuje z karty klienta); faktury nie
pokazywały KWOTY, choć „kwoty zawsze z walutą" jest punktem listy, a to jedyne
pytanie, po które się tu zagląda po zamknięciu projektu; pusty stan nie mówił,
co zrobić. Kwota liczy się tą samą formułą co lista Faktur — **z rabatem**
(sprawdzone: 1000 zł netto, rabat 50 %, VAT 23 % → 615 zł).

**Zakładki profilu** wzięły słownictwo apki (paczka E): „Onboarding" →
**„Wdrożenie"**, „Zamknięcie i opinia" → **„Opinia klienta"**, „Log aktywności"
→ **„Dziennik"**. Kolejność zgadzała się już wcześniej. Dwa wyjątki świadome:
„Podgląd" nie ma odpowiednika w apce (tam te sekcje leżą po prostu na górze
przewijania), a „Czas pracy i rentowność" mieści DWIE sekcje apki — skrócenie
do jednego słowa schowałoby drugą.

**Dwa złote paski sufitu nad sobą** (sufity są różne: 1000 i 500) nie wyglądały
jak awaria — złoto, nie czerwień — ale **oba kończyły się tym samym wezwaniem**
„czas na stronicowanie" i zabierały 130 px nad wykresem. Drugi mówi teraz tylko
to, czego nie mówi pierwszy: że oś czasu jest ucięta mocniej, i o ile.

**Puste stany** „Zależy od" i „Zasoby" pokazywały sam przycisk „+ Dodaj…",
czyli nie odróżniały „nic tu nie wpisano" od „ta rzecz nie dotyczy tego
projektu" (ustalenie A1). Oba dostały zdanie mówiące, CO TO ZMIENIA — w panelu
i w apce, tym samym tekstem. Klikalność: tytuł projektu-poprzednika w „Zależy
od" był jedynym widocznym powiązaniem w profilu, którego nie dało się otworzyć.

**Sprawdzone i zdrowe bez zmian:** gest w prawo na projekcie = Stoper (poprawny
kierunek), brak gestu w lewo (projekt nie ma akcji „od siebie" — brak gestu
jest tu właściwą odpowiedzią, nie luką), ruch wyłącznie przez `SPRING`
(zero liczb z palca, zero `transition` bez `ease`), filtry i wybrany widok
przeżywają powrót (`localStorage`), klient i faktura w profilu prowadzą do
rekordu, kolory osi czasu panel ↔ iPad zgodne co do wartości.

**Świadomie zostawione, z powodem:** czerwień na przycisku „stop" stopera —
to ikonografia sterowania nagrywaniem (ten sam znak, co w każdym dyktafonie),
a nie stan rekordu, i dopóki stoi na przycisku, a nie na pigułce, nie miesza
się ze skalą. Do rozstrzygnięcia, jeśli właściciel uzna inaczej.

**Poza zakresem sesji, naprawione na wyraźną prośbę właściciela: rabat nie
wchodził do sum w PIĘCIU dalszych miejscach.** Sesja 1 naprawiła tę literówkę
w rentowności projektu i w profilu klienta; przy pisaniu promptu do Faktur
okazało się, że `SUM(ilosc * cena_netto)` bez `(1 - rabat_procent / 100)`
siedzi jeszcze w **Pulpicie** (netto, VAT i brutto naraz), **Statystykach**,
**porannym mailu** i **ścieżce dokumentów** (trzy zapytania). Po poprawce zero
wystąpień w repo. Dowody na żywo, każdy inną drogą:

| trasa | pomiar | wynik |
|---|---|---|
| `hub/today` | `revenueThisMonth`, rabat 50 % vs 0 % | 19 065 vs 19 680 — różnica dokładnie 615 zł |
| `sciezka` ×3 | kwota węzła faktury | 500 vs 1000 |
| `leads/notify` | treść wezwania w logu serwera | 1230,00 zł (2 × 615), bez rabatu 2460 |
| `stats` | brak różnicy | kolumna `brutto` jest **martwa** — liczona i nieużywana |

Metoda warta zapamiętania: **test różnicowy na całej odpowiedzi JSON** —
ustaw rabat, zmierz, wyzeruj, zmierz, porównaj rekurencyjnie. Zero różnic
znaczy albo „rabat nie wchodzi", albo „to pole nikogo nie obchodzi"; jedno
i drugie warto wiedzieć, a bez tego testu drugie przeszłoby niezauważone.

**Nie dołożone bez pytania:** sekcja „Dokumenty" w apce (panel ma ją od sesji 1;
podgląd umowy i faktur mieści się w poziomie 1, ale to nowa sekcja — pytanie
do właściciela), cykle i przeciąganie pasm na iPadzie.

## Poprzedni stan: PROJEKTY — sesja 2 jako następna w kolejce (2026-07-31)

> Sesja 1 (fundament) jest **WYKONANA** — patrz sekcja wyżej. Zostaje sesja 2.

Po Umowach (etap 7 lejka) idą etapy 8–10: Onboarding → Kickoff/kamienie →
Realizacja, czyli moduł **Projekty**.

**Rozbity na DWIE sesje, każda w osobnym czacie** (decyzja właściciela
2026-07-31) — moduł ma 28 uchwytów HTTP w 21 plikach, najwięcej ze wszystkich
audytowanych dotąd, i nie mieści się w jednym czacie bez utraty jakości:

| sesja | plik | zakres |
|---|---|---|
| 1/2 | `PROMPT-60A-PROJEKTY-FUNDAMENT.md` | integralność (sonda po 28 uchwytach), sufity, parytet panel ↔ apka, domknięcie lejka, poprawność danych i czasu |
| 2/2 | `PROMPT-60B-PROJEKTY-WYGLAD.md` | trzy pola ⚠️ z inwentarza Modułu 59, cała lista kontrolna na trzech platformach, widoki, gesty, ruch |

Kolejność ma znaczenie: sesja 2 zaczyna od wyniku sesji 1, a sesja 1 kończy
aktualizacją briefu sesji 2. Drogowskaz: `PROMPT-60-PROJEKTY.md`.

Między Umowami a Projektami wszedł **Moduł 59 — przegląd spójności**, który
objął wszystkie moduły naraz (klawiatura, puste stany, wiersze profilu,
miejsce „+", kierunek gestu, słownik koloru). Projekty dostały z niego sporo
bez osobnego audytu — prompt wymienia co dokładnie, żeby nie robić tego
drugi raz. Inwentarz Modułu 59 zostawił Projektom trzy pola ⚠️: **kolor,
nawigacja, treść**.

Dwa konkrety znalezione przy pisaniu promptów — **oba naprawione w sesji 1**,
oba okazały się większe, niż wyglądały:

1. ~~`PATCH /api/projects/:id` bez walidacji słownikiem~~ → dotyczyło też
   `POST`, a przez brak `trim()` **omijało twardą bramkę umowy jedną spacją**.
2. ~~`POST /api/projects/review/public/:token/submit` bez hamulca~~ →
   `HAMULEC_DOKUMENT_PUBLICZNY`. Unieważnianie linków (Moduł 40) było w
   porządku — potwierdzone sondą, nie na słowo.

## Poprzedni stan: następny moduł w kolejce (Leady — WYKONANE)

Sprawdzić dla modułu Leady (panel `/admin/leads`, apka `LeadsListView.swift`
+ `LeadDetailView.swift`, iPad `LeadyPanelIpad.swift`):
1. Czy widoki (Kanban/Tablica na webie, lista+profil na apce, trójkolumnowy
   split na iPadzie) mają te same statusy/akcje/pola co panel.
2. Czy skróty klawiszowe (webowa paleta poleceń, `g l` chord) i
   swipe/long-press na apce (wzorem tego, co zrobiliśmy dziś na Pulpicie)
   są tam, gdzie powinny być — sprawdzić, czy `LeadsListView`/`LeadRow` już
   ma swipe "Obsłużone"/zmiana statusu, czy tylko tap-to-open.
3. Czy podpowiedzi statusu (`docs/plany-modulow/01-podpowiedzi-leadow.md`),
   nurture (`02-nurture-automatyczny.md`), kanały kontaktu
   (`03-kanaly-kontaktu.md`) są w pełni widoczne i spójne na wszystkich
   trzech platformach.
4. Czy import/duplikat-detekcja, NDA (Moduł 11), skaner wizytówek (apka,
   `apka-aparat-symulator-zwija-arkusz` w pamięci) są kompletne i dostępne
   tam, gdzie mają sens (skaner wizytówek to naturalnie funkcja TYLKO
   telefonu, nie oczekuj jej na webie/iPadzie).

## Metoda pracy (sprawdzona w tym czacie, kontynuuj)

1. Zbadaj kod (Explore/grep) obu repo dla danego modułu, PRZED oceną — nie
   zgaduj z pamięci, kod się zmienia między sesjami.
2. Zaproponuj właścicielowi konkretne spostrzeżenia (nie pytania otwarte
   "co chcesz zmienić") — właściciel decyduje, które wdrożyć.
3. Wprowadź zmiany → `npx tsc --noEmit -p tsconfig.json` (panel) /
   `xcodebuild` (apka) → weryfikacja wizualna:
   - Panel: `preview_start name:"dev"` + przeglądarka.
   - Apka: symulator (`LEGGERA_DEV_BACKEND=lokalny` + lokalny panel dev) do
     szybkiej iteracji, fizyczne urządzenie do finalnej oceny właściciela.
4. Commit + push obu repo, build + wgranie na fizyczne urządzenia, dopiero
   potem przejście dalej.

## Pułapki z tej sesji, warte pamiętania

- **Symulator: kalibracja współrzędnych dotyku jest zawodna.** `swipe`
  działał poprawnie w przestrzeni punktów urządzenia (z `attach`), ale
  precyzyjny `tap` na odsłonięty przycisk swipe nie dał się wiarygodnie
  skalibrować w tej sesji (niespójne skalowanie między zrzutem a
  współrzędnymi). Nie trać na to czasu — zweryfikuj **pełnym swipe** (który
  od razu wykonuje akcję) i logami serwera dev (`preview_logs`, szukaj
  PATCH/POST), zamiast precyzyjnego tapa. Ostateczna ocena i tak należy do
  właściciela na fizycznym urządzeniu.
- **Stempel wersji starzeje się między buildami tej samej sesji**, jeśli po
  drodze poszedł commit — `Skrypty/stempel-wersji.sh` w
  `leggera-hub-ios`, uruchom ponownie przy błędzie "Stempel wskazuje
  rewizję X, a repozytorium stoi na Y".
- **Świeży install na fizycznym urządzeniu czasem wymaga ponownego zaufania
  profilowi** (Ustawienia → Ogólne → VPN i zarządzanie urządzeniem →
  Zaufaj) — ale NIE zawsze; w tej sesji drugi install z rzędu wystartował
  bez pytania. Nie zakładaj z góry, po prostu spróbuj `devicectl` i poproś
  o zaufanie tylko jeśli faktycznie odmówi.
- Urządzenia fizyczne (`devicectl list devices`): iPad (Patryk)
  `3CCA9321-4215-5229-A506-C204CB802F37`, iPhone 15 Pro Max (Patryk)
  `1F379FD8-EFA4-55F7-BDB6-7E9CC8B5BEBD`.
- Panel dev lokalny: `preview_start name:"dev"` (PGlite + dane testowe),
  apka łączy się z nim przez `LEGGERA_DEV_BACKEND=lokalny` +
  `LEGGERA_DEV_TOKEN=dev` (zmienne `SIMCTL_CHILD_*` przy `simctl launch`).

---

## Stan po module „Faktury" (2026-07-31)

Moduł 61, etapy 11–12 lejka. Brief: `PROMPT-61-FAKTURY.md`.

### Czego NIE trzeba było robić

Inwentarz z 28.07 dawał Fakturom trzy ❌ i cztery ⚠️. **Dwa z trzech ❌ były
nieaktualne, zanim ktokolwiek je tknął** — paczki A–G objęły wszystkie moduły
naraz i nikt tabeli nie zaktualizował:

- **Kolor**: statusy stały już na wspólnej skali (`INVOICE_STAN` + `mapaStanow`).
  Szukałem drugiej formy tego samego statusu — tak wróciły Projekty, dwa razy.
  `grep` po `"Opłacona"` dał 16 trafień i **żadne nie niosło koloru**.
- **Integralność (status)**: `isInvoiceStatus` stał w `PATCH` i odrzucał 400.

Lekcja bez zmian: **inwentarz jest hipotezą, nie wynikiem.** Ale ta hipoteza
myliła się w OBIE strony — realną pracą okazało się coś, czego w tabeli nie
było wcale.

### Znalezisko główne: jeden `PATCH` unieruchamiał cały moduł

Nie było go w żadnej kategorii inwentarza, bo nie jest usterką UI.

`PATCH /api/invoices/:id {"waluta":"BITCOIN-I-DUZO"}` odpowiadał `{"ok":true}`
i zapisywał obcięte `"BITCOIN-I-"`. `Intl.NumberFormat` rzuca `RangeError` na
każdym kodzie spoza ISO 4217, a `formatMoney` jest **jedynym** formaterem kwot
w panelu. Zmierzone na żywo, nie wywnioskowane:

> `RangeError: Invalid currency code : BITCOIN-I-` → `InvoicesDashboard`
> w `ErrorBoundaryHandler`. **Nie jeden wiersz — cała lista faktur.**

Jedna faktura z jedną złą literą kasowała dostęp do rejestru sprzedaży, a droga
zapisu przyjmowała to z potwierdzeniem sukcesu.

Naprawione w dwóch warstwach, bo jedna nie wystarcza:
1. **Bramka zapisu** — `isInvoiceCurrency` / `zeSlownika` na czterech trasach.
   Zamyka drogę na przyszłość.
2. **`formatMoney` odporny na zły kod** — pokazuje liczbę i kod DOSŁOWNIE
   zamiast wysadzić widok. Bramka nie naprawi wierszy, które już siedzą
   w produkcyjnej bazie, a do tej bazy nie ma dostępu z panelu.

**Zasięg był szerszy niż moduł.** Oferty miały `isOfferCurrency` od swojego
audytu; Faktury, Umowy i faktury cykliczne — nie. Jedna linijka, cztery trasy,
trzy moduły. To lekcja Modułu 59 dosłownie: *poprawka idzie przez wszystkie
moduły naraz*, inaczej audyt jednego modułu zostawia bliźniaczą dziurę obok.

### Cztery ciche podmiany — `{"ok":true"}` i wartość domyślna

`status` był w `PATCH` Faktur WYJĄTKIEM, nie regułą. Cztery sąsiednie pola
(`typ_dokumentu`, `typ_korekty`, `sposob_platnosci`, `jezyk`) przyjmowały
dowolny śmieć i zapisywały wartość domyślną. Najgorszy przypadek jest księgowy:

> `PATCH {"typ_dokumentu":" proforma "}` → zapisane `"faktura"`.

Jedna spacja — z apki, z kopiuj-wklej — zamieniała **niefiskalną proformę
w dokument fiskalny**, który wchodził do przychodu na Pulpicie. Właściciel
widział „zapisano".

Nowy wspólny strażnik `zeSlownika()` **przycina wsad, potem sprawdza słownik**,
a `null` kończy się 400. To odwrotna strona lekcji z Projektów: tam spacja
OMIJAŁA twardą bramkę i trzeba było przyciąć, żeby bramka łapała; tu — żeby
odpowiedź nie kłamała.

### Trzecia oś koloru: KSeF

`KSEF_STATUS_CLASS` był wpisany z palca poza skalą i kolidował wprost:
`przyjeto` brało `emerald` — tę samą zieleń, co status **„Opłacona"** — a obie
pigułki stoją w jednym wierszu listy. Faktura „Wystawiona" + KSeF „Przyjęto"
świeciła na zielono, co czyta się jako „zapłacona". Nikt nie zapłacił.

Decyzja właściciela: **KSeF traci kolor, zostaje czerwień odrzucenia.** Pigułka
jest neutralna i mówi słowem (`KSeF ✓ / ✕ / …`), a `odrzucono` bierze BRANDOWĄ
czerwień w roli awarii — jedynej roli, jaką słownik czerwieni zostawia poza
skalą stanu. Zmierzone po poprawce (`getComputedStyle` na klonie):

| pigułka | kolor | kontrast |
|---|---|---|
| KSeF ✓ | `rgb(107,102,95)` neutralny | 6,46 |
| Opłacona | `rgb(52,211,153)` zieleń | 10,92 |
| Po terminie | `rgb(224,169,59)` złoto | 9,91 |
| Wystawiona | `rgb(196,165,255)` fiolet | 10,17 |

**Ta sama kolizja siedziała w apce** (`kolorKsef` w `FakturyView.swift`) i
została zamknięta tym samym ruchem — inaczej poprawka rozjechałaby platformy.

Przy okazji: w tym samym wierszu listy stały jeszcze DWIE kolorowe pigułki
niosące RODZAJ, nie stan — „Proforma" na złocie (`mojRuch`) i „Rozliczenie
zaliczki" na fiolecie (`uNich`). Cztery kolory o czterech różnych rzeczach
w jednym wierszu. Obie zneutralizowane.

### Druga forma statusu — wróciła, tak jak w Projektach

Brief kazał szukać i było czego. Edytor faktury malował **własną** plakietkę
„po terminie" na generycznej `red-500` — czyli drugą formę statusu, który
skala świadomie odczerwieniła. Faktura spóźniona o dzień wyglądała jak
spóźniona o pół roku.

Przyczyna była strukturalna: słownik miał dla pilności formę TEKSTU, WIERSZA
i HEX-a, ale **nie miał pigułki**, więc kto potrzebował pigułki, pisał ją
z palca. Dołożone `PILNOSC_CLASS` w `lib/kolorStanu.ts`. Plakietka mówi teraz
„po terminie o 25 dni" i niesie zdanie ze słownika.

**To jest ta lekcja w czystej postaci:** brakująca forma w słowniku nie jest
brakiem wygody — jest zaproszeniem do rozjazdu.

### Sonda integralności

`DEV_ADMIN_BYPASS=0` na osobnym porcie, potem `curl` **per uchwyt HTTP**:

- **23/23 uchwytów** modułu oddaje 401 bez sesji. Trzy trasy publiczne
  (`public`, `wezwanie/public`) świadomie na tokenie — oddają 404 na zły token.
- Uwaga metodyczna: dwa uchwyty (`ksef/send` POST, `ksef/auth/test`) nie mają
  `isAuthed()` we własnej linii — delegują do funkcji, która sprawdza pierwszą
  instrukcją. **Grep po pliku pokazałby dziurę, której nie ma; sonda rozstrzyga.**
- Blokada wystawionej faktury: treść 409, status 200 (poprawnie — status nie
  jest treścią), korekta jako droga wyjścia działa, `DELETE` wystawionej 400.
- `issue` jest idempotentne — drugie wywołanie oddaje ten sam numer.
- **Wszystkie 22 sumy SQL mają `(1 - rabat_procent / 100)`** — poprawka z 31.07
  się trzyma.

`POST /api/invoices/:id/items` **ignorował `rabat_procent`** (zapisywał 0
i odpowiadał `{"ok":true"}`). Brief traktował to jako pułapkę dla sondującego;
to ta sama rodzina błędu co reszta — wołający, który podał rabat, cicho
wystawiał fakturę na pełną kwotę. Naprawione.

### Apka: sekcja „Dokumenty" w profilu projektu

Decyzja właściciela — dołożona teraz, bo trasa i tak już oddawała `documents`,
a apka ich po prostu nie czytała. Podgląd, bez zakładania i edycji (poziom
apki bez zmian).

Trzy rzeczy złapane przy okazji, każda „wyglądałaby poprawnie i nic nie robiła":

1. **`brutto` wracało jako STRING**, nie liczba — panel łyka to przez
   `Number(...)`, dekoder Swifta wywaliłby CAŁY profil projektu. Dodane
   `::float8`, a dekoder i tak przyjmuje oba warianty.
2. **Numer umowy liczy panel**, nie apka (`contractReference`) — bez tego trzy
   umowy jednego projektu byłyby trzema nierozróżnialnymi wierszami „Umowa".
   Ta sama zasada, co w `GET /api/clients/:id`.
3. **`wczytajFakture` zapełniało tylko `szczegolyFaktury`**, a widok czyta sam
   rekord z `faktury`. Dopóki jedyną drogą do faktury była zakładka Faktur,
   lista zawsze już stała w pamięci i nikt tego nie zauważył — wejście
   z profilu PROJEKTU omija zakładkę i dawało **wieczny spinner**. Nowa droga
   nawigacji obnażyła zastaną dziurę; `wczytajUmowe` obok robiło to poprawnie
   od zawsze.

Sprawdzone palcem w symulatorze na lokalnym panelu, nie tylko w kodzie.

### Zostawione świadomie

- ~~`brutto` i `zaplacono` w `/api/stats` są martwe~~ — **domknięte w tej samej
  sesji, na prośbę właściciela.** Blok `dso` raportował `overdueCount` (ile
  faktur) i `oldestOverdueDays` (jak stara jest najstarsza), ale nigdy **ile
  pieniędzy** wisi — choć `brutto` i `zaplacono` liczył od zawsze i wyrzucał.
  Jeden blok niżej ten sam plik pisze w komentarzu „kwota obok liczby, bo pięć
  małych ofert przegranych na cenie znaczy co innego niż jedna duża" i łamał tę
  zasadę wyżej. Nowy kafel „Zaległości (kwota)" — patrz sekcja niżej.
- **22 sumy SQL z rabatem to 22 kopie tej samej formuły.** Wszystkie dziś
  poprawne, ale `tsc` ich nie sprawdza, a 23. napisze ktoś bez rabatu. Wspólny
  fragment SQL w `neon()` jest ryzykowny (pułapka: komentarz `--` w `sql\`…\``
  tnie zapytanie), więc zostaje reguła + testy.
- **Czerwień „stop" stopera** — decyzja właściciela: zostaje jako ikonografia
  nagrywania, nie stan rekordu. Świadomy wyjątek, nie dług.

### Testy

`test/faktury.test.ts` +3 przypadki (`zeSlownika`, `isInvoiceCurrency`,
`formatMoney` na złym kodzie). **144/144 przechodzi.**

### Kafel „Zaległości (kwota)" — domknięcie martwych kolumn

Dołożony po audycie, decyzją właściciela. Trzy rzeczy warte zapamiętania:

- **Liczy RESZTĘ DO ZAPŁATY** (`brutto − zaplacono`), nie pełne brutto: faktura
  zapłacona w połowie wisi połową. Ujemne odcinane — nadpłata na jednej
  fakturze nie jest zaległością ujemną, którą wolno odjąć od cudzego długu.
- **Kolor z rampy pilności, nie z palca.** `StatCard` dostał opcjonalny
  `valueClass`; bez niego zostaje `text-liquid`, czyli gradient marki = sama
  tożsamość, bez znaczenia — i tak zostaje na wszystkich pozostałych kaflach.
  Wyjątek dostaje tylko ten, na którym „jak bardzo" jest osobnym pytaniem.
  Sprawdzone: 8610 zł przy najstarszej zaległości 25 dni → `brand-red-soft`
  (`zaniedbane`, próg 14 dni). Kwota zgadza się co do grosza z KPI „Po
  terminie" na liście Faktur — dwie niezależne drogi, ta sama liczba.
- **Odmiana polska ma TRZY formy.** Kafel pisał „3 faktur", bo warunek
  rozróżniał tylko 1 od reszty. Nowy `odmienPl()` w `lib/dates.ts` (z wyjątkiem
  12–14, przez który naiwne `n % 10` pisze „12 faktury"), użyty też w sąsiednim
  kaflu DSO, który miał ten sam błąd. Test w `test/daty.test.ts`.

## Stan po module „Katalog" (2026-08-01)

Moduł 62, pełna lista kontrolna na trzech platformach. Panel `22d251a`, apka
wydanie 176. Brief: `docs/plany-modulow/PROMPT-62-KATALOG.md`.

### Czego NIE trzeba było robić

Z czterech ❌ w inwentarzu **trzy były nieaktualne**, zanim ktokolwiek je tknął
— i to jest już REGUŁA, nie zbieg okoliczności (trzeci moduł z rzędu):

- **Klawiatura** — `useSkrotyListy` (`/`, `j`/`k`, Enter) i `PoleSzukania`
  siedzą w `CatalogDashboard.tsx` od paczki C.
- **Stany** — „Wczytuję…" bez końca zniknęło w paczce E; jest `StanListy`
  z `blad`/`onPonow` i trzema wariantami pustego stanu.
- **Klikalność** — podstrona `/admin/catalog/<id>` istnieje od paczki E, wiersz
  ma ikonę „otwórz" honorującą ⌘-klik.

Obowiązywało **jedno: Gesty/menu** — Katalog był jedynym modułem listowym
panelu bez menu pod prawym przyciskiem myszy (Oferty, Faktury, Koszty i Klienci
mają je od dawna).

**Przed Katalogiem zmierzono ponownie wiersze Leadów i Klientów** (siedem ❌/⚠️,
wszystkie nieaktualne) — szczegóły i liczby w `59-spojnosc-ui.md`, przypis ³.

### Znalezisko główne: katalog nie miał waluty

Oferty i faktury mają cztery waluty (PLN/EUR/USD/GBP) i strażnika zapisu.
Katalog nie miał kolumny `waluta` w ogóle, a UI wołało `formatMoney(cena)` bez
drugiego argumentu, czyli twardo w złotówkach. Pozycja wyceniona u dostawcy
w euro wchodziła do dokumentu jako ta sama liczba złotych — **bez żadnego
objawu**, bo obie kwoty wyglądają poprawnie.

Decyzja właściciela: **kolumna `waluta` w katalogu**, nie „ustalmy, że zawsze
PLN". Panel świadomie NIE przelicza kursów, więc:

- pozycja w innej walucie niż dokument jest oznaczona **w pickerze**
  (`brand-orange`, przy cenie), a jej wstawienie wymaga **potwierdzenia**
  z podaną kwotą — zamiast cichego przepisania liczby;
- „zapisz pozycję faktury do katalogu" niesie walutę faktury;
- odczyt jest odporny: nieznany kod waluty z bazy czyta się jako PLN, bo
  `formatMoney` na złym kodzie RZUCA, a rzucający formater wywala CAŁY ekran
  (lekcja z audytu Faktur).

Przy okazji: `INVOICE_CURRENCIES` i `OFFER_CURRENCIES` były dwiema kopiami tej
samej listy z dwoma bliźniaczymi strażnikami. Katalog byłby TRZECIĄ — powstał
`lib/waluty.ts` (jeden słownik + `isWaluta`), a nazwy modułowe zostały jako
re-eksporty, więc nic w kodzie nie musiało się przenosić.

### Cztery ciche podmiany — znowu `{"ok":true}`

Sonda różnicowa (wyślij śmieć → przeczytaj → porównaj) na `POST /api/catalog`:

| wysłane | zapisane | odpowiedź |
|---|---|---|
| `kategoria: "hopla"` | `"inne"` | 200 |
| `vat_stawka: "999"` | `"23"` | 200 |
| `koszt_zakupu: -99` | `-99` | 200 |
| `cena_min: 9000, cena_max: 100` | zapisane odwrotnie | 200 |
| `cena_netto: 1e30` | `1e30` | 200 |

Trzy z nich są **niewidoczne w interfejsie**: zła kategoria i zły VAT wyglądają
na wybrane świadomie, a odwrotne widełki UI po prostu UKRYWA (`hasPriceRange`
zwraca `false`), więc zła dana siedzi w bazie bez objawu. `1e30` malowało
w wierszu listy 31-cyfrową liczbę.

Teraz obie trasy idą przez jeden `czytajPolaKatalogu()` (`lib/catalog.ts`):
słowniki przez `zeSlownika` → 400 z powodem, liczby z sufitem 100 mln, widełki
min ≤ max. **Cena ujemna jest dozwolona świadomie** (decyzja właściciela): rabat
wystawia się jako osobną pozycję dokumentu z kwotą na minusie, więc pozycja
„Rabat za referencję" musi dać się trzymać w katalogu. Ujemny KOSZT — 400.

### `PATCH` zachowywał się jak `PUT`

Zmierzone przy okazji: `PATCH {"nazwa":"…","cena_netto":…}` **kasował** jednostkę,
widełki i koszt zakupu, bo trasa przepisywała wszystkie pola z ciała żądania,
a brakujące brały wartość domyślną. Panel i apka wysyłają komplet, więc objawu
nie było — ale przy dokładaniu kolumny `waluta` przestawało to być teoretyczne:
starsza wersja apki cofałaby każdą pozycję do PLN przy każdej edycji.
`czytajPolaKatalogu` przyjmuje teraz stan istniejący: **klucza nie ma w ciele →
pole zostaje takie, jakie było.**

### Marża ujemna: trzecia rola czerwieni

`getComputedStyle`: marża −3000 zł pisała się `rgb(138,143,152)` — tą samą
szarością, co +3000 zł, na obu platformach (apka miała nawet komentarz „kolor
niesie status, nie liczbę"). Decyzja właściciela: **strata dostaje czerwień**.

Do słownika dołożona FORMA, nie kolor na miejscu — `STRATA_TEXT` i
`klasaStraty()` w `lib/kolorStanu.ts`, `Znaczenie.strata` w `Theme.swift`
(#CE6A70 po obu stronach). Zakres jest wąski celowo: to nie jest kolor dla
„każdej liczby ujemnej", tylko dla liczby, która oznacza stratę. Zmierzone po
zmianie: `rgb(206,106,112)`, kontrast **5,62** na karcie (AA). Marża dodatnia
zostaje neutralna — kolor, który świeci zawsze, przestaje znaczyć.

### Sonda integralności

`DEV_ADMIN_BYPASS=0`, per UCHWYT HTTP: **5/5 uchwytów katalogu** oddaje 401 bez
sesji (GET/POST listy, GET/PATCH/DELETE pozycji).

**Migawka potwierdzona pomiarem**, nie kodem: pozycja wstawiona do oferty za
1000 zł została przy 1000 zł po zmianie ceny komponentu na 7777 i po usunięciu
komponentu z katalogu. Kaskady nie ma i nie powinno jej być.

`DELETE` nieistniejącej pozycji oddawał `{"ok":true}` — teraz 404, bo w UI
kasowanie czegoś, czego nie ma, wygląda identycznie jak kasowanie udane.

### Drobne, które wyszły przy okazji

- **`{item.vat_stawka}%`** na profilu komponentu pisało **„zw.%"** i „np.%" —
  jedyne miejsce w panelu, które nie znało tego wyjątku. Powstał wspólny
  `etykietaVat()` (warunek był rozpisany z palca w trzech miejscach).
- **Usuwanie z listy nie czytało odpowiedzi** — wiersz znikał z ekranu przed
  potwierdzeniem z serwera, więc nieudane usunięcie wyglądało jak udane aż do
  przeładowania. To samo w pickerze katalogu w edytorze faktury.
- **Ładowanie**: napis „Wczytuję…" na środku → szkielet w kształcie treści.
- **Apka: „Usuń" na swipie było BIAŁE.** Neutralny (biały) tint chrome spływa
  środowiskiem z `GlownaBelka` i wygrywa z samą rolą `.destructive` —
  Przypomnienia, Subskrypcje i reszta mają jawny `.tint(.ciemnaCzerwien)` od
  dawna, Katalog jako jedyny go nie miał. Złapane ZRZUTEM z symulatora.
- **Apka kasowała bez pytania** — panel pyta od zawsze. Jest alert
  z nazwą komponentu i zdaniem, że dokumenty zostają nietknięte.
- **Apka nie rozróżniała „nic nie pasuje" od „katalog pusty"** — przy frazie bez
  wyników ekran po prostu pustoszał, co wygląda jak awaria wczytywania.

### Testy

Nowy `test/katalog.test.ts` — 11 przypadków bramki zapisu, częściowego
`PATCH`-a i odporności odczytu. **155/155 przechodzi.**

### Zostawione świadomie

- **Kurs walutowy.** Panel nie przelicza i mówi o tym wprost. Dołożenie kursów
  to nowy zakres (źródło kursów NBP, data kursu, przeliczenie na dokumencie).
- **Koszt zakupu dalej TYLKO w katalogu** — nie kopiuje się na pozycję
  dokumentu (Moduł 47, reguła bez zmian).
- **Apka nie ma pickera „Z katalogu"** — pozycje oferty składa się przy biurku
  (decyzja z Modułu 47). Katalog ma za to pełny CRUD na telefonie.

---

## Stan po module „Koszty" (2026-08-01)

Moduł 63. Punkt startu: panel `86fb2ab`, apka `f48f474` (wydanie 176).

### Inwentarz pomylił się PO RAZ CZWARTY — i po raz czwarty w obie strony

Wiersz „Koszty" w `59-spojnosc-ui.md` pokazywał 1 ❌ (Klawiatura) i 3 ⚠️
(Klikalność, Gesty/menu, Nawigacja). **Zmierzone: nieaktualne były wszystkie
cztery.** Sprzątnęły je paczki C, E i G, których nikt do tabeli nie wpisał.

To ten sam wynik, co przy Projektach, Fakturach i Katalogu. Wniosek już nie
jest hipotezą: **tabela inwentarza opisuje stan z dnia jej spisania i nie
nadąża za paczkami przekrojowymi**. Puszczaj sondę nawet tam, gdzie stoi ✅ —
realna praca cztery razy z rzędu leżała poza tabelą.

### Co było realną pracą

**1. Sześć cichych podmian, jedna z nich PODATKOWA.** Sonda `curl` na żywym
serwerze, przed poprawką:

```
POST  {"kategoria":"CO-TO-JEST","vat_stawka":"999","kwota_netto":-5000}
      → 200; zapisane: „Inne", „23", brutto −6150
PATCH {"vat_odliczenie_procent":999}  na koszcie z ustawionym 0%
      → 200; zapisane: 100
POST  {"kwota_netto":9e15}            → 200; analityka pokazała potem 1,1e16
POST  /api/recurring-costs {"next_run":"0202-01-01"}
      → 200; zapisane DOSŁOWNIE
DELETE nieistniejącego kosztu         → 200 {"ok":true}
```

Najgroźniejsza jest druga. `vat_odliczenie_procent` ma skutek podatkowy:
właściciel oznacza koszt reprezentacyjny jako „0% — nie odliczam VAT-u", a
śmieciowy zapis po cichu przestawia go na **najkorzystniejszą i najtrudniejszą
do obrony** wartość „100%" — i odpowiada `{"ok":true}`. W interfejsie wygląda
to na świadomy wybór. To jest dokładnie ten kształt ryzyka, o którym mówi
brief: zła liczba w koszcie nie wygląda na złą.

Piąta pozycja to pułapka `<input type="date">` z `CLAUDE.md` („0202" zamiast
„2026") — tyle że w polu, które steruje **automatem** generującym koszty.
Szablon z rokiem 0202 nie odpala się nigdy i nikt się o tym nie dowiaduje.

**Naprawa:** `czytajPolaKosztu()` i `czytajPolaCyklu()` w `lib/costs.ts`,
wzorem `czytajPolaKatalogu()` — jedna bramka dla `POST` i `PATCH`, słowniki
przez `zeSlownika` → 400 z powodem, liczby z sufitem, daty przez
`isPlausibleDateString`. Plus `normalizeCostRow()` po stronie ODCZYTU, bo
bramka nie naprawia tego, co już siedzi w bazie. `DELETE` nieistniejącego
oddaje 404. Test: `test/koszty.test.ts` (czysta funkcja, bez bazy).

**PATCH był NAPRAWDĘ częściowy** i taki został — w odróżnieniu od Katalogu,
który cicho kasował nieprzysłane pola. Sonda to potwierdziła, a test pilnuje,
żeby przepisanie trasy tego nie zepsuło.

**2. Waluta i kurs** (decyzja właściciela, wariant pełny). Koszty były
milcząco złotówkowe, a faktura od zagranicznego dostawcy to najbardziej
naturalny koszt tej firmy. Doszły `waluta` + `kurs_pln`, przez jeden słownik
`lib/waluty.ts`.

Kurs jest **NULLOWALNY świadomie**: `null` znaczy „koszt w PLN, nie dotyczy",
a zapisane `1` przy EUR znaczyłoby „1 EUR = 1 zł", czyli cichy błąd o rząd
wielkości. Dlatego bramka wymaga kursu wprost dla każdej waluty innej niż PLN.

**Poprawka poszła przez wszystkie sumy naraz** (lekcja 4 briefu): KPI, wykres
trendu (`SUM(kwota_brutto * COALESCE(kurs_pln, 1))`) i rejestr zakupów. CSV ma
teraz kolumny PARAMI — kwota z dokumentu w jego walucie (musi zgadzać się
z papierem) i ta sama kwota w złotych (wchodzi do rejestru); wiersz RAZEM
sumuje wyłącznie kolumny PLN.

**3. Termin płatności** (decyzja właściciela). Koszt miał `data_platnosci` =
„kiedy zapłacono", ale **nie miał pola „do kiedy zapłacić"** — więc żaden
koszt nie mógł być spóźniony i nic o nim nie przypominało. Przegapiony przelew
do dostawcy był niewidzialny.

Czerwień po terminie idzie **rampą pilności** (`stopienPilnosci`,
`PILNOSC_TEXT`), nie jako trzeci kolor statusu: pigułka dalej mówi
złoto/zieleń (STAN), a data mówi JAK PILNIE. Dwie osie na wiersz, zgodnie
z regułą Modułu 59.

**4. Import z KSeF gubił walutę.** `queryPurchaseInvoices` czytało `currency`
od początku — import ją **wyrzucał**. Faktura w euro lądowała jako gołe liczby.
Naprawione; KSeF nie podaje jednak kursu, więc może powstać koszt „100 EUR,
kurs nieznany". Taki koszt:
- **nie wchodzi do żadnej sumy** (`maPrzelicznik`) — kurs 1 zaniżyłby go
  o rząd wielkości bez objawu;
- **jest o tym głośno powiedziane** („N kosztów bez kursu — nie wliczone" przy
  KPI, „brak kursu" w wierszu apki, puste kolumny PLN w CSV). Ciche pominięcie
  byłoby gorsze od złej liczby: wykres kłamałby przez przemilczenie;
- **da się mimo to edytować** — bramka nie wymaga kursu, dopóki żądanie nie
  dotyka waluty ani kursu. Inaczej rekordu nie dałoby się w ogóle ruszyć.

### Znalezione przy okazji, poza zakresem briefu

- **KPI „Nieopłacone" świeciło `text-red-400` ZAWSZE**, gdy tylko istniał
  jakikolwiek niezapłacony rachunek — wpisane z palca, poza paletą marki
  i **wbrew regule zapisanej piętro wyżej w tym samym pliku** (komentarz przy
  `COST_STATUS_CLASS`: „świadomie NIE czerwień — nieopłacony koszt to zdrowy,
  normalny stan"). Kolor, który świeci zawsze, przestaje cokolwiek znaczyć.
  Teraz idzie rampą: czerwień dopiero po realnym terminie.
- **Edytor nie cofał optymistycznej podmiany po odrzuceniu zapisu.** Do tej
  pory nie miało jak wyjść, bo trasa przyjmowała wszystko. Po wprowadzeniu
  bramki właściciel widziałby na ekranie wartość, której nie ma w bazie.
  Doszło cofnięcie i **dosłowny powód z bramki** zamiast „Nie udało się
  zapisać".
- **Lista kosztów w apce miała własny formater z zaszytym `"PLN"`** — ten sam
  błąd, który Katalog naprawiał u siebie w Module 62. Kwota w euro rysowała
  się ze złotówkowym symbolem.

### Pomiary

- **Sonda 401: 17/17 uchwytów** w `app/api/costs` + `app/api/recurring-costs`
  (liczone per `export async function`, nie per plik). Bez wyjątków.
- **Kontrast (klon + kompozycja rgba na tle panelu `rgb(8,9,10)`):**
  termin w terminie `6,13` · po terminie (pomarańcz) `7,11` · zaniedbane
  (czerwień) `5,62`. Wszystkie ponad próg WCAG AA 4,5. Klasy realnie się
  generują — to nie był przypadek martwej klasy.
- **`npm test`: 170/170.**

**Pułapka pomiarowa, na której straciłem czas:** pierwszy pomiar terminu dał
niemal biel (`rgb(247,248,248)`) tam, gdzie zrzut pokazywał czerwień. Powód:
`termin.querySelector('span')` trafia w opakowanie `Tooltipa`
(`display: contents`), które koloru nie niesie i dziedziczy `--fg`. Mierz
NAJGŁĘBSZY węzeł z tekstem, nie pierwszy `<span>`.

### Świadome decyzje

- **Kwota ujemna PRZECHODZI.** Faktura korygująca od dostawcy („korekta
  w minus", zwrot, rabat potransakcyjny) to realny dokument zakupowy i musi
  dać się zapisać. Zatruta analityka z sondy brała się z RZĘDU WIELKOŚCI
  (9e15), nie ze znaku — i to odcina sufit 100 mln.
- **Szablon cykliczny ma walutę, ale NIE ma kursu.** Kurs jest z konkretnego
  dnia, a szablon nie zna dnia, w którym wygeneruje kolejny koszt.
- **Kurs wpisywany ręcznie, bez pobierania z NBP.** Automatyczne źródło kursów
  to osobny zakres (który dokument, z którego dnia, co przy weekendzie) —
  ta sama granica, którą Katalog postawił przy swojej walucie.
