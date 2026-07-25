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

**Świadomie nie ruszone:** retencja/RODO klientów (brak auto-usuwania jest
decyzją z Audytu 2), rzeczy z `PO_REJESTRACJI.md`, tworzenie oferty/faktury
wprost z karty klienta (nie istnieje w żadnej wersji — osobny zakres, nie
regres), `zrodlo`/`zrodlo_kategoria` jako pola tylko do odczytu po utworzeniu.

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
