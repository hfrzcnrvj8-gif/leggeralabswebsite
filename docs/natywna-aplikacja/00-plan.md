# Leggera Hub — aplikacja natywna (iOS → iPadOS → macOS)

> Dokument nadrzędny. Każdy nowy czat pracujący nad aplikacją natywną zaczyna
> **stąd**, nie od `docs/plany-modulow/`. Tamten folder opisuje panel webowy.

## Decyzja i kontekst

**2026-07-18/19: właściciel zdecydował o budowie aplikacji natywnej** po
przetestowaniu PWA (Moduł 5) na realnym iPhonie. Ocena: „totalnie mierny UX, źle
się skaluje… wolałbym jednak zrobić to natywnie w Xcode".

Decyzja jest **odwróceniem** wcześniejszego ustalenia z briefu Modułu 5 („PWA,
nie pytaj drugi raz"). Odwrócił ją właściciel na podstawie testu na własnym
sprzęcie — to jest legalna zmiana, nie pomyłka. Nie wracaj do PWA.

### Dlaczego PWA nie wyszła — trzy lekcje, które przenosimy dalej

1. **Byłem ślepy na realny render.** Podgląd to przeglądarka desktopowa o
   zadanej szerokości: `env(safe-area-inset-*)` = 0, inne metryki czcionek, brak
   trybu standalone, brak dotyku (`pointer: fine`, `maxTouchPoints: 0`). Trzy
   rundy „zweryfikowane na mobile" były w dobrej wierze i **nieprawdziwe**.
2. **Gęstość to nie kosmetyka.** Panel jest zaprojektowany jak Linear — pod mysz
   i duży monitor (10–14 px). Przelany na wąski ekran daje wrażenie „desktop
   wciśnięty w telefon" nawet wtedy, gdy nic nie jest zepsute.
3. **Wzorzec > opis.** Trzy rundy zgadywania dały mniej niż jeden zrzut z apki
   UniFi, który właściciel podesłał jako referencję. **Przy sporach o wygląd
   proś o wzorzec.**

### Co to zmienia: pętla iteracji jest zamknięta

**Zweryfikowane 2026-07-19 na maszynie właściciela:** Xcode 26.6, Swift 6.3.3,
symulatory iPhone 17 / iPad Pro 13" dostępne. `xcrun simctl boot` +
`xcrun simctl io <dev> screenshot` **działa i zrzut jest czytelny dla Claude**.

Znaczy to, że przy natywnej apce widzę **prawdziwy render iOS** — prawdziwe
czcionki, marginesy pod notch, materiały, Dynamic Type — bez udziału właściciela.
Zrzuty z fizycznego telefonu zostają ostatecznym testem, ale przestają być
jedynym. **To jest główny powód, dla którego droga natywna ma szansę tam, gdzie
PWA poległa.** Uwaga: po `boot` odczekaj na `simctl bootstatus`, bo pierwszy
zrzut bywa czarny (SpringBoard jeszcze się nie wyrenderował).

## Decyzje właściciela (nie zmieniaj bez pytania)

| Temat | Decyzja | Data |
|---|---|---|
| Forma | Natywna apka (SwiftUI), nie PWA, nie Capacitor | 2026-07-18 |
| Kolejność platform | iOS → iPadOS → **docelowo także macOS** | 2026-07-19 |
| Zakres „pełnej funkcji" | Poziom 1 + **Poczta w pełni** (foldery, wątki, załączniki, szablony) | 2026-07-19 |
| Dane offline | **Online z lekkim buforem** — świeże z serwera, ostatnie listy w pamięci, żeby apka nie migała pustym ekranem. Bez pełnej kopii danych klientów na urządzeniu (prostsze, bezpieczniejsze pod RODO) | 2026-07-19 |
| Panel webowy | Zostaje; docelowo obok niego apka na Maca z tego samego kodu | 2026-07-19 |
| Konto Apple Developer | Potrzebne dopiero do instalacji na fizycznym urządzeniu. **W symulatorze pracujemy bez niego** — nie jest blokerem startu | 2026-07-19 |

## Architektura — wspólny rdzeń od pierwszego dnia

Decyzja o macOS ma konsekwencję, którą **trzeba wdrożyć od razu**, bo doklejanie
jej później jest bolesne:

```
LeggeraHubCore/          ← pakiet współdzielony, ZERO kodu UI
  Models/                ← struktury Codable 1:1 z API
  Networking/            ← klient HTTP, uwierzytelnianie, obsługa błędów
  Store/                 ← logika i stan (obserwowalne), bufor w pamięci
LeggeraHub-iOS/          ← widoki iPhone/iPad (SwiftUI)
LeggeraHub-macOS/        ← widoki Maca (później, ten sam rdzeń)
```

- **Rdzeń nie może importować SwiftUI ani UIKit.** To jedyna reguła, która
  decyduje o tym, czy wersja na Maca będzie tania, czy będzie przepisywaniem.
- iPhone vs iPad: **jeden kod**, `NavigationStack` + `TabView` na telefonie,
  `NavigationSplitView` na iPadzie. SwiftUI przełącza to po klasie rozmiaru —
  iPad przychodzi prawie za darmo, jeśli widoki nie zakładają wąskiego ekranu.

### Język wizualny — skąd czerpiemy

- **Struktura i komponenty: Apple.** Natywne `List`, `NavigationStack`,
  `.searchable`, swipe actions, context menu, arkusze z „detentami". **Nie
  odtwarzamy Linear 1:1 w Swifcie** — próba malowania własnego interfejsu na iOS
  daje dokładnie ten efekt „to nie jest natywne", od którego uciekamy.
- **Gęstość informacji i szybkość: Linear.** Skróty, szybkie akcje, brak
  zbędnych potwierdzeń, stan widoczny rzutem oka.
- **Elastyczność treści: Notion.** Ale świadomie okrojona — patrz poziomy niżej.
- **Marka**: kolory `brand.purple/pink/gold/cyan` jako **akcent**, nie jako
  przemalowanie systemowych kontrolek. Ciemny motyw jak w panelu.

## Zakres — trzy poziomy

**Zasada: 1:1 z desktopem to pułapka, która zabija przepisywania na natywne.**
Linear na iOS nie ma wszystkiego, co desktop. Notion na telefonie to głównie
czytanie i szybkie dopiski. Apple okraja Numbers i Pages. Pytanie nie brzmi „ile
funkcji przeniesiemy", tylko „co robisz z telefonem w ręku, a co przy biurku".

### Poziom 1 — pełna funkcja natywnie
Pulpit „co dziś" · Leady · Klienci · szybkie kontakty (`tel:`/WhatsApp/mail) +
logowanie rozmowy · powiadomienia **push** · szybka notatka ·
**koszt ze zdjęcia paragonu** (aparat + OCR — na telefonie *lepszy* niż na
desktopie) · **Poczta w pełni** (decyzja właściciela 2026-07-19: foldery, wątki,
załączniki, szablony — traktować jak osobny duży moduł, nie dodatek).

### Poziom 2 — podgląd i lekkie akcje
Projekty (w tym **stoper** — bardzo dobry mobilnie) · Faktury (podgląd, „opłacona”,
przypomnienie) · Oferty/Umowy (podgląd, wysyłka).

### Poziom 3 — świadomie tylko desktop
Wystawianie faktur i KSeF (pozycje, VAT, korekty, waluty) · Statystyki ·
szablony i konfiguracja. To praca przy biurku; wciskanie jej w telefon było
błędem Modułu 5.

### Co zyskujemy natywnie (niedostępne w PWA)
Prawdziwe powiadomienia push · aparat do paragonów · Face ID · widżet „co dziś" ·
skrót do Siri („zaloguj rozmowę") · dostęp do Kontaktów · Share Extension
(udostępnij stronę → nowy lead).

## Stan zastany — z czym pracujemy

**Zaplecze zostaje w całości i to jest dobra wiadomość** — baza Postgres, KSeF,
synchronizacja IMAP, Ollama, cron dzienny. Wymianie podlega wyłącznie warstwa
widoku.

Zmierzone 2026-07-19: **129 tras API, 183 uchwyty** (62 GET, 71 POST, 27 DELETE,
23 PATCH). Największe moduły: `projects` (20), `invoices` (16), `mail` (11),
`offers` (10), `leads` (9).

### Warunek wstępny: uwierzytelnianie dla klienta natywnego

**✅ WYKONANE w Fazie 1 (2026-07-19).** Rozstrzygnięcie właściciela: **tokeny
per-urządzenie z możliwością odebrania dostępu** (zgubiony telefon odcina się
z panelu jednym kliknięciem, bez zmiany hasła). Wdrożone:
1. `POST /api/admin/login` z polem `device` w body zwraca losowy token
   per-urządzenie w JSON (w bazie tylko SHA-256, tabela `device_tokens`).
2. `isAuthed()` akceptuje nagłówek `Authorization: Bearer <token>` (sprawdzany
   przed ciasteczkiem). Panel webowy działa dalej bez zmian.
3. Lista urządzeń + „Odbierz dostęp" w panelu (przycisk „Urządzenia" w stopce
   sidebara); `POST /api/admin/logout` z Bearerem unieważnia token urządzenia.
4. Token w **Keychain** po stronie apki, nie w `UserDefaults` (do zrobienia
   w Fazie 2, po stronie Swifta).

Pełna specyfikacja: `inwentarz/00-uwierzytelnianie.md`.

## Fazy

| Faza | Co | Gdzie |
|---|---|---|
| **1** ✅ | Uwierzytelnianie tokenem + **inwentarz API i modelu danych** (staje się specyfikacją apki) — wykonane 2026-07-19, patrz `01-inwentarz.md` | istniejące repo |
| **2** ✅ | **Pionowy plaster + BRAMKA**: logowanie + Leady — bramka PRZESZŁA 2026-07-19 (właściciel obejrzał, zgłosił uwagi, wdrożone) | `leggera-hub-ios` |
| **3** ✅ | Reszta poziomu 1 (bez Poczty) — wykonane 2026-07-19 | `leggera-hub-ios` |
| **4** ✅ | Poczta w pełni — wykonane 2026-07-19, patrz „Faza 4" niżej | `leggera-hub-ios` |
| **5** ✅ | Domknięcie poziomu 1 (Pulpit na agregacie, Notatnik, powiadomienia, szukanie) + **Projekty ze stoperem** — wykonane 2026-07-19, patrz „Faza 5" niżej | `leggera-hub-ios` |
| **6** | **Rejestr wiadomości i rozmów** + Kalendarz — patrz `03-brief-rejestr-kalendarz.md` | |
| **7** | iPad (`NavigationSplitView` z tego samego kodu) | |
| **8** | Reszta poziomu 2 (faktury, oferty) + natywne bajery (widżet, Siri, Share Extension) | |
| **9** | macOS z tego samego rdzenia | |

### Faza 2 jest bramką, nie etapem

Budujemy **tylko jeden moduł** i dopiero wtedy właściciel decyduje, czy idziemy
dalej. Powód jest wprost z historii Modułu 5: **nie wolno zainwestować miesięcy,
zanim właściciel zobaczy efekt.** Jeśli po jednym module usłyszymy „nie ten
klimat", tracimy dni, nie kwartał.

## Jak pracujemy

- Claude pisze kod i **sam ogląda efekt w symulatorze** (`xcodebuild` →
  `simctl install/launch` → `simctl io screenshot`).
- Właściciel otwiera Xcode, gdy trzeba wgrać apkę na fizyczne urządzenie.
  Docelowo TestFlight → aktualizacje przychodzą same, bez kabla.
- **Zrzut z fizycznego iPhone'a właściciela pozostaje ostatecznym dowodem.**
  Symulator nie oddaje wszystkiego (haptyka, realna wydajność, prawdziwe push).

## Ryzyka — nazwane wprost

1. **Dwa front-endy do utrzymania.** Każda nowa funkcja biznesowa = decyzja, czy
   robimy ją w panelu, w apce, czy w obu. To trwały koszt, nie jednorazowy.
2. **Poczta w pełni to duży moduł.** Klient pocztowy z folderami, wątkami i
   załącznikami bywa większy niż reszta poziomu 1 razem wzięta.
3. **Właściciel nie jest programistą** — każda decyzja nietechniczna idzie do
   niego wprost, po polsku, bez żargonu (zasada z `CLAUDE.md`, obowiązuje dalej).
4. **Nie przenoś reguł biznesowych „na oko".** W panelu siedzi rok decyzji
   (nurture, windykacja, mapa procesu 15 kroków, bramka umowy). Inwentarz z Fazy
   1 istnieje po to, żeby ich nie odkrywać ponownie przez błędy w Swifcie.

## Poza zakresem (świadomie)

- Publikacja w App Store (apka jest wewnętrznym narzędziem; TestFlight wystarcza).
- Android.
- Przepisywanie zaplecza — zostaje Next.js na Vercelu.

## Faza 2 — stan na 2026-07-19 (BRAMKA: czeka na decyzję właściciela)

Repozytorium apki: **`/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`**
(osobne repo, decyzja właściciela 2026-07-19). Projekt Xcode jest generowany
z `project.yml` przez `xcodegen generate` — w repo trzyma się źródło, nie
wygenerowany `.xcodeproj`.

Zbudowane i obejrzane w symulatorze iPhone 17 (Xcode 26.6, Swift 6.3.3):
- logowanie hasłem → token per-urządzenie → Keychain,
- lista leadów: szukanie, odświeżanie ściągnięciem, filtr „wymaga działania
  dziś" (reguła przeniesiona 1:1 z `lib/leads.ts` do `LeadRules.swift`),
- profil leada: szybkie kontakty `tel:`/`mailto:`, dane, historia kontaktu,
  zmiana statusu,
- arkusz „Zaloguj rozmowę" (kanał, kierunek, wynik) z detentami.

Podczas budowy podczas oglądania realnego renderu wyszły dwa błędy, których
opis by nie wyłapał: surowa data ISO zamiast polskiej (`Daty.swift`) i główna
akcja zwinięta przez iOS 26 do nieopisanej ikony w dolnym pasku (przeniesiona
do treści). To dokładnie ta pętla, której zabrakło przy PWA.

**Czego jeszcze NIE zweryfikowano dotykiem:** zapis rozmowy i zmiana statusu
z poziomu UI — Claude nie może sterować klawiaturą/dotykiem symulatora bez
zgody na kontrolę aplikacji. Same trasy zapisu sprawdzone curlem w dokładnie
tym kształcie, którego używa apka (przyjęte, odczyt zwrotny się zgadza).

Faza 2 jest bramką: **następny krok to obejrzenie apki przez właściciela**
(na symulatorze przez Xcode albo na własnym iPhonie) i decyzja, czy idziemy
w Fazę 3. Nie dokładać modułów przed tą decyzją.

## Stan na koniec sesji 2026-07-19 (przekazanie do nowego czatu)

**Bramka Fazy 2 przeszła** — właściciel obejrzał apkę, zgłosił uwagi
(wygląd + braki funkcji), zostały wdrożone, i sam powiedział „przechodzimy
do kompletowania użyteczności". Faza 3 jest więc w toku.

### Co apka już umie (zweryfikowane w symulatorze i curlem)

- **Logowanie** tokenem per-urządzenie, token w Keychain, 401 = powrót na
  ekran logowania.
- **Dziś** — licznik i lista tego, co wymaga ruchu (leady + klienci).
- **Leady** — lista z filtrem/szukaniem, profil na 4 zakładkach
  (Wizytówka/Historia/Logi/Akcje), edycja pól, przypomnienie z kalendarza,
  logowanie rozmowy, zmiana statusu, dodawanie nowego leada.
- **Klienci** — lista, profil ze scalonym feedem (wpisy „z leada" oznaczone),
  logowanie rozmowy, zmiana statusu relacji, dodawanie klienta.
- **Koszty** — pełna ścieżka „paragon ze zdjęcia": aparat → upload →
  odczyt lokalnym modelem → poprawki właściciela → zapis.
- **Poczta (pierwsza tura)** — lista folderu z filtrem statusu i szukaniem,
  gesty (obsłużone / archiwum), podgląd wiadomości z odkażonym HTML-em
  i blokadą zdalnych obrazków, wątek, odpowiedź, ręczna synchronizacja.

### Co zostało — kolejny czat zaczyna STĄD

Pełny brief: **`02-brief-projekty-stoper.md`** (decyzja właściciela
2026-07-19: po Poczcie idziemy w Projekty + stoper, przed iPadem).

1. **Luki poziomu 1** znalezione po fakcie: Notatnik, `GET /api/hub/today`
   na ekranie „Dziś", kronika powiadomień, globalne szukanie.
2. **Projekty + stoper** (poziom 2) — patrz brief.
3. **Powiadomienia push** — ODŁOŻONE świadomie: właściciel zakłada konto
   Apple Developer **na sam koniec**. Bez niego push realnie nie zadziała.
   **Nie myl tego z powiadomieniami LOKALNYMI** (`UNUserNotificationCenter`):
   apka planuje je sama, bez serwera i bez żadnego konta, działają też
   w symulatorze. Przypominanie o chodzącym stoperze (decyzja właściciela
   2026-07-19) opiera się właśnie na nich i NIE jest zablokowane.
4. Faktury/oferty (podgląd), iPad, macOS — wg tabeli faz.

## Faza 4 — Poczta DOMKNIĘTA (2026-07-19, druga tura)

> **Sprostowanie do wcześniejszego zdania „poziom 1 kompletny".** Nie jest.
> Sprawdzone gretem po fakcie (2026-07-19): apka **nie ma** Notatnika
> („szybka notatka" jest wprost wymieniona w poziomie 1 wyżej), nie ma
> kroniki powiadomień w apce ani globalnego szukania, a ekran „Dziś"
> **nie woła `GET /api/hub/today`** — liczy się sam z leadów i klientów,
> więc nie widzi projektów po terminie, faktur ani wydarzeń. To są luki
> poziomu 1, nie poziomu 2. Patrz brief `02-brief-projekty-stoper.md`,
> który zaczyna się od ich domknięcia.

Moduł Poczty jest kompletny wobec `inwentarz/04-poczta-ai.md`. Dołożone
w tej turze (wszystkie trasy zweryfikowane curlem, ekrany obejrzane w
symulatorze iPhone 17):

- **Nowa wiadomość od zera** (`POST /api/mail/compose`) i **przekazanie dalej**
  (`POST /api/mail/[id]/forward`) — obie multipartowe, z **załącznikami**
  (zdjęcie z galerii albo plik; walidacja MIME/3 MB/4 MB po stronie apki,
  zanim właściciel napisze całą wiadomość).
- **Szablony** — pełny CRUD (`/api/mail-templates`) + wstawianie w treść
  podczas pisania.
- **Screener nadawców** — osobna kolejka „Nowi nadawcy" + pasek decyzji
  („Wpuść"/„Zablokuj") na profilu wiadomości.
- **Odkładanie (snooze)** — cztery nazwane terminy, **logika `snoozeOptions()`
  odtworzona lokalnie w `Snooze.opcje()`**, bo endpointu na listę opcji nie ma.
  Godziny liczone w strefie Europa/Warszawa przez `Calendar`, nie z palca.
- **„Bez odpowiedzi" (nudge)** — `GET /api/mail/nudge` + wyciszanie gestem.
- **Szkic odpowiedzi od AI** — przycisk widoczny TYLKO gdy `GET /api/ai/health`
  mówi `available: true`; 503 z Ollamy nie blokuje ręcznego pisania.
- **Z maila → lead / klient / zadanie w projekcie** (trasy `create-lead`,
  `create-client`, `to-task`).
- Flaga „ważne", „Zignoruj", „Przenieś do Kosza", DW/UDW, wybór języka podpisu.

### Trzy rzeczy, które wyszły dopiero przy pisaniu kodu

1. **Sync raportował zawsze „brak nowych".** Apka dekodowała pole `nowe`,
   którego trasa `/api/mail/sync` nigdy nie zwracała (zwraca `fetched`/`saved`).
   Poprawione na `saved` — `fetched` liczy też wiadomości odrzucone dedupem,
   więc pokazywałoby ruch tam, gdzie go nie ma.
2. **`ISO8601DateFormatter` nie jest `Sendable`** — nie da się go trzymać
   w statycznej stałej w Swifcie 6. `Daty.isoUTC` używa `DateFormatter`
   z jawnym formatem.
3. **Ostrzeżenia wysyłki to nie błąd.** Serwer wysyła SMTP-em NAJPIERW, a
   wszystko po tym (kopia w Sent, wpis na oś kontaktu) degraduje do
   `warnings`. Apka zamyka arkusz i pokazuje uwagi osobnym komunikatem —
   pod żadnym pozorem nie ponawia wysyłki.

### Świadome decyzje tej tury

- **Bez auto-syncu przy wejściu w Pocztę.** Inwentarz sugeruje sync przy
  otwarciu widoku, ale to żądanie do 90 s — na telefonie oznaczałoby spinner
  przy każdym wejściu. Sync jest w menu, ręczny. Do zmiany, jeśli właściciel
  powie, że woli czekać.
- **Kolejki („Nowi nadawcy", „Bez odpowiedzi") mieszkają w tym samym menu
  co foldery** — na telefonie to po prostu „inne listy do przejrzenia",
  a nie osobny wymiar wymagający własnej belki.
- **Kolejka screenera filtrowana po stronie apki** — serwer nie ma na nią
  parametru, a lista folderu i tak przychodzi w komplecie (max 200).
- **Załączniki tylko w compose/forward.** Odpowiedź jest trasą JSON-ową
  i nie ma gdzie ich zmieścić — apka chowa wtedy całą sekcję zamiast
  udawać, że się da.

### Czego NIE dało się zweryfikować

Dotyk i klawiatura symulatora (bez zgody na kontrolę aplikacji) — ekrany
oglądane przez furtki DEBUG, zapisy sprawdzane curlem w kształcie używanym
przez apkę. **Realna wysyłka maila niemożliwa lokalnie**: `MAIL_*` żyje tylko
w env Vercela, więc compose/forward/reply zwracają lokalnie 400 „Skrzynka
pocztowa nie jest skonfigurowana" — apka ten komunikat pokazuje poprawnie,
ale sama wysyłka wymaga testu na produkcji. Wybór pliku/zdjęcia wymaga
dotyku — nie sprawdzony.

Nowe furtki DEBUG (README apki): `LEGGERA_DEV_TAB`, `LEGGERA_DEV_MAIL_VIEW`
(`screener`/`nudge`), `LEGGERA_DEV_MAIL_SHEET` (`nowa`/`szablony`),
`LEGGERA_DEV_OPEN_MAIL=<id wiadomości>`.

### Czego NIE dało się zweryfikować w tej sesji

Dotyk i klawiatura symulatora (brak zgody na kontrolę aplikacji) — zapisy
sprawdzane curlem w kształcie używanym przez apkę, a ekrany oglądane przez
furtki DEBUG (`LEGGERA_DEV_TOKEN`, `LEGGERA_DEV_OPEN_LEAD`, `LEGGERA_DEV_TAB`).
Aparat nie istnieje w symulatorze — realny test paragonu wymaga iPhone'a.

### Reguły wyglądu ustalone przez właściciela (nie zmieniaj bez pytania)

Zapisane w pamięci projektu (`apka-jezyk-wizualny`): jeden akcent na ekran,
prawdziwy Liquid Glass (`glassEffect`), **gradient wyłącznie na ikonach,
tekst biały**, znak LL w proporcjach ZMIERZONYCH z glifu Inter, bez systemowej
czerwieni (wylogowanie w ciemnej czerwieni #8B272F).

## Faza 5 — poziom 1 domknięty + Projekty ze stoperem (2026-07-19)

Wykonane wg `02-brief-projekty-stoper.md`, w całości. Zmiana układu belki
i rozszerzenie Pulpitu doszły w trakcie, na wyraźną prośbę właściciela.

### Część A — trzy luki poziomu 1 (zamknięte)

- **Pulpit na `GET /api/hub/today`.** Ekran nazywa się teraz **Pulpit** (nie
  „Dziś") i pokazuje to, co panel: leady, klienci, projekty po terminie,
  kamienie milowe, faktury po terminie i szkice, uśpione umowy, kontakty
  nurture, pocztę do obsługi, wydarzenia dnia, ostatnie notatki i wskaźniki.
  Lokalne liczenie **zostało jako zapas** przy padniętej trasie i ekran mówi
  o tym wprost („liczba obejmuje tylko leady i klientów z pamięci apki") —
  cicha niedokładność była pierwotną przyczyną tej luki.
- **Notatnik** — zakładki Wszystkie/Przypięte/Archiwum, dopisywanie, edycja
  treści, przypinanie i archiwizacja gestem, trwałe usuwanie tylko z Archiwum,
  „przekuj w projekt" (idempotentne po stronie serwera — dwuklik nie robi
  duplikatu, tylko mówi, że projekt już jest).
- **Kronika powiadomień** i **globalne szukanie**. Szukanie świadomie pomija
  dokumenty (oferty/faktury/umowy), które serwer zwraca: to poziom 3, apka nie
  ma ekranu, na który mogłaby z nich przejść, a wynik prowadzący donikąd jest
  gorszy niż jego brak.

### Część B — Projekty (poziom 2)

Lista z paskiem postępu i sortowaniem „po terminie na górę", profil z
zadaniami pogrupowanymi pod kamienie, dziennikiem (wpisy „system" renderowane
dyskretnie), zasobami i czasem. Obie reguły biznesowe przeniesione świadomie:

- **Bramka umowy** — apka NIE przewiduje jej po swojej stronie (nie zna umów).
  Wysyła zmianę, a 409 pokazuje jako **odmowę z powodem** w osobnym alercie
  („Nie można zmienić statusu"), nie jako awarię, i wraca do stanu z serwera.
  Osobny przypadek `APIError.odmowa` istnieje wyłącznie po to, żeby nie dało
  się tego pomylić z błędem sieci. Na profilu projektu z klientem jest miękkie
  uprzedzenie — informacja, nigdy blokada.
- **Zdrowie** to osobny `Picker` obok statusu, nigdy wspólny przełącznik.

### Część C — Stoper

Start/stop gestem na liście i przyciskiem w profilu. Wskaźnik z licznikiem na
żywo w chrome apki, **na każdym ekranie**. `stopped_previous` pokazywane
alertem z nazwą projektu i czasem. Suma czasu pomija działający stoper
(widać to na profilu: „Razem 0 s" przy jednym chodzącym wpisie oznaczonym
„chodzi"). Minuty traktowane jako ułamkowe.

**Przypominanie powiadomieniami lokalnymi** wg zatwierdzonego rytmu: 4 h →
co 2 h → 18:00 czasu lokalnego. Rytm liczy czysta funkcja `RytmPrzypomnien`
w rdzeniu (bez `UserNotifications`), maszyneria iOS-a siedzi w warstwie
widoku — dzięki temu rytm da się sprawdzić bez symulatora i pojedzie na macOS.

### Cztery rzeczy, które wyszły dopiero przy oglądaniu, nie przy pisaniu

1. **Kasowanie przypomnień wyścigiem zjadało nowe.** `skasuj()` pytał
   `getPendingNotificationRequests` i kasował w domknięciu; domknięcie jest
   asynchroniczne, a `zaplanuj()` dodaje zaraz potem — więc kasowanie
   dostawało migawkę kolejki JUŻ z nowymi wpisami i wycierało wszystko.
   Efekt: **zero zaplanowanych przypomnień przy zerowej liczbie błędów.**
   W kodzie wyglądało poprawnie. Wyszło dopiero po odczytaniu prawdziwej
   kolejki iOS-a w symulatorze. Naprawione deterministyczną listą
   identyfikatorów (`stoper-0`…), bez odpytywania systemu.
2. **Pasek stopera nachodził na podpisy zakładek.** Pierwsza wersja używała
   `safeAreaInset(edge: .bottom)` na `TabView`. iOS 26 ma na to własną półkę —
   `tabViewBottomAccessory`, tę samą, na której Muzyka trzyma mini-odtwarzacz.
3. **Pusta półka rysowała się bez stopera** — goła kapsuła nad belką. Półkę
   trzeba podpinać warunkowo; `StoperPasek` poprawnie nie zwracał nic, ale
   kontener i tak się renderował.
4. **`started_at` przychodzi w formacie Postgresa** (`2026-07-19 13:17:09.43+01`
   — spacja zamiast `T`, ułamek sekundy, strefa bez dwukropka), a nie jako ISO
   z `Z`. Bez parsera znoszącego oba warianty licznik startowałby od północy.
   `Daty.zZnacznika` obsługuje oba; sprawdzone testem na pięciu wariantach.

### Co zweryfikowano, a czego nie

**Curlem, w kształcie używanym przez apkę:** bramka umowy (409 z projektem
mającym klienta, 200 bez klienta), `stopped_previous` przy starcie drugiego
stopera, `stop` bez stopera (`{stopped: null}`, HTTP 200), odhaczanie zadania,
wpis do dziennika, CRUD notatek, idempotencja `promote`, PATCH powiadomień,
szukanie.

**W symulatorze, na zrzutach:** Pulpit z agregatem, lista i profil projektu
(z zadaniami i bez), Notatnik, Powiadomienia, „Więcej", regresja Poczty
i Leadów po zmianie belki.

**Realnym odczytem kolejki iOS-a:** pełny cykl przypomnień — stoper chodzi →
16 zaplanowanych (pierwsze o 18:00 lokalnego, bo stoper ruszył po południu),
stoper zatrzymany → 0.

**NIE zweryfikowano dotykiem** (Claude nie może sterować klawiaturą ani
dotykiem symulatora): faktycznego stuknięcia w „Zatrzymaj" w powiadomieniu,
przejścia przez alert zgody na powiadomienia (do testu użyto trybu
`provisional`, który iOS przyznaje bez pytania) oraz **dostarczenia**
powiadomienia o zaplanowanej godzinie — zaplanowanie jest potwierdzone,
samo dostarczenie to już zachowanie systemu.
### Poprawka po pierwszym dniu na prawdziwym telefonie (2026-07-19)

Właściciel wgrał apkę na iPhone'a i zgłosił jedną wadę, tę samą co w panelu:
**„podgląd maila kompletnie się nie skaluje i nie dopasowuje do ekranu"**.
Przyczyny okazały się dwie i żadna nie leżała w apce.

1. **Odkażanie wycinało `display`.** `allowedStyles` w `lib/mailHtml.ts` nie
   miało go na liście, więc `display:none` znikało — a newslettery chowają tak
   **preheader**, czyli tekst podglądu dla skrzynki odbiorczej. Po wycięciu
   reguły ukryty tekst robił się widoczny i to on był tymi „duchami liter"
   obok treści na zrzucie z telefonu. Dopuszczone zostały wyłącznie style
   ukrywania (`display`, `visibility`, `opacity`, `overflow`, `max-height`,
   `line-height`); `position` świadomie ZOSTAJE poza listą, bo mail nie ma
   prawa nakładać się na panel.
2. **`max-width:100%` nie pokonuje sztywnych szerokości.** Newslettery
   opakowują treść w `<div style="width:600px">` i tabele z `width="600"`.
   Stary CSS apki obejmował tylko `img, table` — `div` nie był objęty niczym.
   Zmierzone w przeglądarce: taki mail wystawał o **234 px** na ekranie 390 px
   i był ucinany. Teraz szerokości zerujemy u źródła
   (`table[width],td[width],th[width],col[width]{width:auto}`), a `overflow-x`
   zostaje jako ostatnia deska ratunku — przewinąć można zawsze, odzyskać
   uciętego fragmentu nie.

**Regresja złapana po drodze:** pierwsza wersja poprawki zerowała też
`img[width]`. Zablokowany obrazek podmieniamy na przezroczysty piksel 1×1, więc
zwijał się do 1 px i psuł układ, zamiast go zachować. Zmierzone i cofnięte —
obrazkom wystarcza `max-width`.

Przy okazji: podgląd w apce dostał **prawdziwą wysokość**. Sztywne 260 punktów
ucinało każdy dłuższy mail. Mierzymy `contentSize` własnego `UIScrollView`
przez KVO — czyli **bez JavaScriptu**, żeby nie zdejmować drugiej warstwy
obrony w widoku cudzej treści.

Próbka regresyjna siedzi w ziarnie deweloperskim (`ensureSeeded()` w
`lib/dev-db.ts`): mail „Alerty o ofertach pracy" ma teraz ukryty preheader
i opakowanie 600 px obok wcześniejszych pułapek bezpieczeństwa. Jeśli
kiedykolwiek zobaczysz w nim tekst zaczynający się od „Preheader:" albo treść
uciętą z prawej — to regresja dokładnie tych dwóch reguł.

**Nowa furtka DEBUG:** `LEGGERA_DEV_BACKEND=lokalny` przełącza apkę na panel
na Macu. Domyślnie apka celuje w produkcję (właściciel używa jej na telefonie),
a bez tej furtki weryfikacja w symulatorze wymagałaby edytowania kodu tam
i z powrotem — prosta droga do wypchnięcia apki celującej w localhost.

### Podgląd maila: model Apple Mail zamiast przebudowy układu (2026-07-19)

**Zmiana podejścia po trzeciej rundzie uwag właściciela.** Pytanie, które ją
wywołało: „dlaczego kiedy uruchamiam Apple Mail, to zawsze wszystko wczyta się
tak, że się odpowiednio pomniejszy i wyskaluje do ekranu?".

Odpowiedź: bo Apple Mail **nie przelewa treści** — renderuje maila w jego
naturalnej szerokości i **pomniejsza całość**. Nasza apka robiła odwrotnie:
zerowała sztywne szerokości i zmuszała newsletter do przebudowy. Stąd trzy
rundy „lepiej, ale nadal nie to" — bo każda kolejna reguła CSS naprawiała jeden
przypadek i rozbijała projekt nadawcy w innym. **To była zła droga i została
porzucona.**

Jak jest teraz (`WidokHTML` w `WiadomoscView.swift`):

1. Mail renderuje się w naturalnej szerokości. CSS jest minimalny — kolory pod
   ciemną apkę i `img{max-width:100%}`, żeby jeden gigantyczny obrazek nie
   zepchnął skali do minimum. **Żadnego zerowania szerokości tabel.**
2. Widok mierzy naturalną szerokość treści (`scrollView.contentSize.width`)
   i ustawia `zoomScale = szerokość ramki / szerokość treści`.
3. Dopasowanie powtarza się przy **każdej** zmianie układu, nie tylko po
   `didFinish`: najszerszy element bywa policzony później i jednorazowe
   dopasowanie zostawiało kilka procent poza ekranem (widoczne jako ucięte
   końcówki wyrazów). Pętli nie ma — naturalną szerokość odtwarzamy dzieląc
   przez aktualne powiększenie, więc kolejne wyliczenie daje tę samą skalę.
4. Dolny limit skali to **0,4**. Niżej mail robi się nieczytelnym znaczkiem,
   więc zamiast dalej pomniejszać pozwalamy przewinąć w bok.
5. Wszystko **bez JavaScriptu** — pomiar idzie z natywnego `UIScrollView`.
   Włączenie skryptów zdjęłoby jedną z dwóch warstw obrony przed cudzym HTML-em.

Panel webowy dostał ten sam minimalny CSS. Nie ma tam skalowania i nie jest
potrzebne: na treść przypada ~865 px, więc typowy mail (600 px) mieści się bez
sztuczek, a szerszy dostaje poziomy pasek przewijania w ramce zamiast
rozjechanego układu. Skalowania w ramce i tak nie da się tam zrobić uczciwie —
`iframe` jest w piaskownicy bez `allow-same-origin`, więc jego zawartości nie
zmierzymy, a rezygnacja z tej izolacji byłaby złym interesem.

**iPadOS dostaje to za darmo** — ta sama apka, ten sam kod widoku.
**macOS będzie wymagał bliźniaka**: `WidokHTML` jest `UIViewRepresentable`
(UIKit), więc na Maca trzeba go przepisać na `NSViewRepresentable`. Sama logika
przenosi się 1:1 (`WKWebView` jest na obu platformach), ale to nie jest zerowy
koszt i nie należy zakładać, że „samo pojedzie".
