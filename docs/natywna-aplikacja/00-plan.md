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
| **3** | Reszta poziomu 1 (bez Poczty) | |
| **4** | Poczta w pełni (duży, osobny etap) | |
| **5** | iPad (`NavigationSplitView` z tego samego kodu) | |
| **6** | Poziom 2 + natywne bajery (widżet, Siri, Share Extension) | |
| **7** | macOS z tego samego rdzenia | |

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

1. **Poczta, reszta modułu**: załączniki, nowa wiadomość od zera, przekazanie
   dalej, szablony, screener nadawców, snooze, nudge, szkic odpowiedzi od AI.
   Wszystko opisane w `inwentarz/04-poczta-ai.md`.
2. **Powiadomienia push** — ODŁOŻONE świadomie: właściciel zakłada konto
   Apple Developer **na sam koniec**. Bez niego push realnie nie zadziała.
3. Poziom 2 (projekty + stoper, faktury podgląd), iPad, macOS — wg tabeli faz.

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
