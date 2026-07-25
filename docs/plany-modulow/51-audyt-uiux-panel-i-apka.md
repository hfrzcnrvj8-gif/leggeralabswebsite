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

## Następny moduł w kolejce: Leady

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
