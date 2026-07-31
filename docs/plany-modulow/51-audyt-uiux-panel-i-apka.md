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

## Następny moduł w kolejce: PROJEKTY (2026-07-31)

Po Umowach (etap 7 lejka) idą etapy 8–10: Onboarding → Kickoff/kamienie →
Realizacja, czyli moduł **Projekty**. Gotowy brief do wklejenia w nowym
czacie: **`PROMPT-60-PROJEKTY.md`**.

Między Umowami a Projektami wszedł **Moduł 59 — przegląd spójności**, który
objął wszystkie moduły naraz (klawiatura, puste stany, wiersze profilu,
miejsce „+", kierunek gestu, słownik koloru). Projekty dostały z niego sporo
bez osobnego audytu — prompt wymienia co dokładnie, żeby nie robić tego
drugi raz. Inwentarz Modułu 59 zostawił Projektom trzy pola ⚠️: **kolor,
nawigacja, treść**.

Konkret znaleziony przy pisaniu promptu, do naprawienia w tym module:
`PATCH /api/projects/:id` zapisuje `status`, `priorytet` i `zdrowie` **bez
walidacji słownikiem** — `PROJECT_STATUSES` istnieje w `lib/projects.ts`,
ale żadna trasa go nie importuje. Ta sama dziura, którą paczka A zamknęła
w Leadach i Fakturach.

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
