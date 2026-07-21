# Brief: audyt końcowy aplikacji (Faza 13.4)

> Repo apki: `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`.
> Spisany 2026-07-21, po domknięciu Fazy 13.3 #2 (Wyspa kolejki wysyłki).
> **Osobny czat.** To audyt APKI — nie mylić z `docs/AUDYTY-KONCOWE.md`,
> który obejmuje całość (bezpieczeństwo, RODO, obserwowalność) i stoi
> osobno.
>
> Poprzednik: `07-brief-audyt-apki.md` → wynik w `08-wynik-audytu-apki.md`
> (Faza 11½, 2026-07-20). **Zacznij od przeczytania tamtego wyniku** — trzy
> ustalenia z niego są nadal otwarte i nie ma sensu odkrywać ich drugi raz.

## Stan wyjściowy (fakty, nie wrażenia)

Zmierzone 2026-07-21:

| Rzecz | Wartość |
|---|---|
| Pliki Swift / linie | 84 / ~22 500 (przy audycie 11½ było ~15 350 — **+47 %** w dziewięć dni) |
| Największe pliki | `AppStore.swift` 2165, `APIClient.swift` 1887, `ProjektDetailView.swift` 930 |
| Testy automatyczne | **zero** |
| `TODO`/`FIXME` w kodzie | 0 |
| Furtki `LEGGERA_DEV_*` | 21 |
| `try!` / `as!` / `fatalError` | 1 (`Pulpit.swift:373`, na stałym literale — bezpieczne) |
| Typy Live Activity | 4 (stoper, odczyt zdjęcia, kolejka wysyłki + widżet ekranu) |

## Co z poprzedniego audytu domknięte, a co nie

Sprawdzone w kodzie, nie w notatkach:

- **A2 (zatruty bufor kalendarza) — NAPRAWIONE.** `AppStore.swift:1888` ma
  teraz oba przypisania po obu `await`.
- **A3 (zaokrąglanie czasu ≠ panel) — NAPRAWIONE.** `Czas.swift:146`
  zaokrągla minuty jak `Math.round`, z komentarzem, skąd to się wzięło.
- **A1 (cicha utrata błędów) — OTWARTE i URÓSŁO.** Jedno pole
  `AppStore.bladLeadow` przyjmuje komunikat z **65 miejsc** (było 59), a czyta
  je **trzy** widoki: `LeadsListView.swift:25`, `PulpitView.swift:156`
  (tylko gdy `pulpit == nil`) i `EdytorWiadomosciView.swift:401`.

  To jest **największy dług tej apki** i pierwszy punkt audytu. Skutki są dwa
  i oba paskudne: nieudany zapis kosztu / statystyk / kalendarza kończy się
  komunikatem „nic się nie stało", a błąd z jednego modułu potrafi wyskoczyć
  na ekranie zupełnie innego. Uboczne `bladAkcji` (Faza 13.1) załatwiło
  wyłącznie arkusze akcji — to był wąski krok, nie domknięcie.

## Zakres audytu

Kolejność jest rekomendacją, nie dogmatem. Każdy punkt ma powiedzieć
**co sprawdzono, czym to udowodniono i co z tym zrobić** — ustalenie bez
dowodu w kodzie albo na zrzucie nie liczy się w tym projekcie.

### 1. A1 — cicha utrata błędów (WYSOKI, wymaga decyzji właściciela)

Nie zaczynaj od pisania kodu. Najpierw rozstrzygnij kształt: **pole błędu per
moduł** (12 pól, każdy widok czyta swoje) czy **jedna kolejka komunikatów
w chrome** (wzorzec `odmowaBramki` w `GlownaBelka.swift:79` już to robi
dobrze i jest sprawdzony). Drugie jest mniejsze i spójniejsze, ale zmienia
wygląd — to pytanie do właściciela, nie do Claude'a.

### 2. Martwy kod — czy coś WOŁA to, co napisaliśmy

Powtarzalny błąd tego projektu (Moduły 30/31, potem Faza 13.1): pole istnieje,
kod wygląda poprawnie, nikt tego nie wysyła. Audyt 11½ nie znalazł ani jednej
martwej metody `AppStore` — ale wtedy apka miała 15 tys. linii, a od tamtej
pory doszło 7 tys. Metoda ta sama: każda publiczna metoda `AppStore`
i `APIClient` → grep, czy jakikolwiek widok ją woła.

### 3. Rozjazdy reguł panel ↔ apka

W 11½ sprawdzono 22 pary reguł i znaleziono pięć rozjazdów. **Nowe od tamtej
pory, nieporównane z panelem:** kolejka wysyłki (Faza 13.3 #2), `/api/stats`
i Ustawienia (13.1 paczka 3), kształtowanie projektu — kamienie, zasoby,
zależności (13.1 paczka 2), skaner wizytówek, powiązania klient/lead/projekt.

Reguła z lekcji `apka-rejestr-kalendarz`: **port reguły na drugą platformę to
audyt tej reguły** — przy okazji poprzedniego portu wyszły cztery błędy
w panelu, nie w apce.

### 4. Spójność wizualna

Słownik koloru został wdrożony 2026-07-20 (README apki, „Słownik koloru").
Sprawdź, czy trzymają go ekrany zbudowane PO tej dacie — i czy nie wróciły
trzy stare grzechy: kolor pełniący dwie role naraz, gradient marki na tekście,
`role: .destructive` (jaskrawa systemowa czerwień zamiast `.ciemnaCzerwien`).
Osobno: jeden akcent na ekran (`Marka.swift`).

### 5. Niezawodność Live Activity — cztery typy naraz

Nowe od 11½ i nigdy nie sprawdzone razem. Pytania: czy osierocone aktywności
są sprzątane w każdej ścieżce (ubita apka, wylogowanie, zmiana zaplecza)?
Czy dwie–trzy naraz mieszczą się sensownie? Czy `LEGGERA_DEV_*_WYSPA`
zostawiają śmieci na urządzeniu?

Ustalone i **nie do podważania bez nowego dowodu**: sekundy znikają z ekranu
blokady po ~3 min (iOS), aktywność ginie po ~8 h (iOS), `isStale` **nie**
przerysowuje aktywności (zmierzone 2026-07-21 — dlatego Wyspa kolejki pokazuje
godzinę, nie odliczanie).

### 6. Rozmiar plików i wydajność

`AppStore.swift` ma 2165 linii i rośnie liniowo z każdą fazą. Pytanie do
rozstrzygnięcia, nie do automatycznego „posprzątania": dzielić na rozszerzenia
per moduł czy zostawić jedno miejsce prawdy? Argument za zostawieniem jest
realny — jedno okno przeglądania stanu bywa cenniejsze niż estetyka pliku.

### 7. Rzeczy nieobejrzane dotykiem — jedna sesja z telefonem w ręku

Zebrane z całej apki; wszystkie wymagają palca, więc żadna nie zamknie się
w symulatorze:

- rozwinięta Wyspa (długie przytrzymanie) i karta na ekranie blokady — dla
  **wszystkich trzech** typów aktywności,
- realne stuknięcie „Stop" na Wyspie stopera,
- zachowanie Live Activity po ~8 h,
- prawdziwa wysyłka SMTP z kolejki (dev nie ma skrzynki IMAP) — najprościej:
  odłóż z apki maila „za godzinę" na własny adres i wróć po godzinie,
- Siri, Share Extension i widżet na urządzeniu po ostatnich zmianach,
- Face ID: pełny cykl blokada → karencja → powrót (dwa błędy z 2026-07-20
  wyszły dopiero na telefonie).

## Czego NIE ruszać

- **„Poziom 3"** — wystawianie i edycja faktur, korekty, KSeF (apka pokazuje
  status, nigdy go nie zmienia), pozycje i akceptacja ofert, moduł umów.
  To jest udokumentowana decyzja, nie luka (`Finanse.swift:17-18`).
- **Ikona projektu zostaje emoji** — to dana z bazy wybierana przez
  właściciela, nie afordancja systemu.
- **Świadome odrzucenia**: stała Wyspa Pulpitu (audyt 11½), przypomnienia
  oparte o lokalizację, Apple Watch, dzielenie apki na AppStore'owe targety.
- **Nie „naprawiaj" furtek `LEGGERA_DEV_*`** — bez nich Claude nie ma jak
  obejrzeć większości ekranów. Kompilują się tylko w DEBUG.

## Jak weryfikować

Symulator + panel lokalny (`npm run dev`, PGlite, dev-login), furtki
`SIMCTL_CHILD_LEGGERA_DEV_*` — pełna lista w README apki, sekcja z furtkami.
Na fizyczny telefon Claude wgrywa build sam, kablem
(`xcrun devicectl device install app`, przepis w README).

**Dane testowe są częścią funkcji.** Dwa razy w tym projekcie funkcja
wyglądała na zepsutą, bo dev-seed nie miał czego pokazać (kontakty nurture,
kolejka wysyłki). Jeśli audyt znajdzie kolejną taką — poprawka idzie do
`lib/dev-db.ts` w panelu, nie do apki.

## Wynik

Zapisz jako `17-wynik-audytu-koncowego.md`, w układzie poprzednika
(`08-wynik-audytu-apki.md`): streszczenie, ustalenia wg priorytetu z numerami,
osobno lista „świadomie nie naprawione" z powodem. Numery przydają się potem
w rozmowie — do dziś odwołujemy się do „A1".
