# iPad — Faza 9 (hybryda + adaptacyjny układ). Stan i przekazanie

> Sesja 2026-07-23 (bardzo długa). Ten dokument + pamięć projektu
> (`apka-ipad-pelny-desktop-hybryda`, `apka-ipad-szkielet-adaptacyjny`) to
> punkt startowy dla nowego czatu. Repo apki:
> `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`.

## Decyzje właściciela (nie zmieniaj bez pytania)

| Temat | Decyzja |
|---|---|
| iPad = ? | **Pełna funkcjonalność panelu desktopowego + iOS.** Powód: komputer w terenie, z klawiaturą jak PC. |
| Jak dowieźć poziom 3 (faktury/KSeF/statystyki/konfiguracja) | **HYBRYDA** — wbudowany prawdziwy panel w `WKWebView`, NIE przepisywanie natywne |
| Kolejność platform | iPad → potem macOS (osobna apka, ten sam rdzeń) |
| Rozmieszczenie kontrolek | „+" pływający (dolny prawy róg) wszędzie; konto/„…" na dół panelu bocznego; szukanie natywne (góra) |
| FAB „+" | gradient fioletowo-złoty jako **KONTUR** (szklane wnętrze), NIE wypełnienie; sprężynuje + haptyka + obrót „+"; **bez efektu „genie"** (iOS go nie ma — udawanie wyglądało tanio) |
| Podgląd dokumentu | **strona wydruku panelu w webview** (nie generujemy pliku PDF — to osobny większy projekt) |
| Apple Pencil | właściciel chce KOMPLET: Scribble wszędzie → kanwa PencilKit w notatkach → adnotacje na dokumentach |
| Bez skrótów na iPadzie | rozwijać skróty (np. „tydz."→„tydzień") wszędzie, gdzie się mieszczą |

## Co zbudowane i wgrane na iPada (Release, działa na iPad Pro 11")

- **Panel boczny** (`NavigationSplitView`) zamiast belki; moduły z licznikami; konto na dole.
- **Adaptacyjny układ list-detail** (Leady/Projekty/Klienci) — **jak Apple Mail**:
  - szeroko (poziomo, kolumna treści ≥ 760 pt) → **dwa panele obok siebie** (lista stałej szerokości + profil), wybór wiersza **przyciskiem** (nie `List(selection:)` — poza splitem zawodzi);
  - wąsko (pionowo) → **jedna kolumna** (reużyty iPhone'owy widok listy, `LeadsListView`/`ProjektyListView`/`KlienciListaTresc`) z wejściem w profil (push).
  - Przełącznik: `GeometryReader { if geo.size.width >= 760 { dwaPanele } else { <widok listy iPhone> } }`.
- **Pełny panel desktopowy w apce** (sekcja „Pełny panel": Faktury i KSeF, Statystyki, Cały panel) — `WidokWebowy`/`PanelWebowyView`.
- **Podgląd dokumentu** (Oferty/Umowy/Faktury) — przycisk „Podgląd dokumentu" → `PodgladDokumentuView` (strona wydruku w webview).
- **Kalendarz** — komórki miesiąca wyższe (96 pt) na iPadzie, numer u góry; „+" jako FAB.
- **Notatnik** — „+" jako FAB; kalendarz i notatnik: natywny arkusz.
- Kosmetyka: sidebar tytuł inline, pojedyncze logo (env `\.wPaneluBocznym`), konto na dole panelu.

## Sedno techniczne (żeby nie odkrywać ponownie)

- **Rdzeń `LeggeraHubCore` czysty** (zero SwiftUI/UIKit, `.macOS(.v15)`). To fundament pod macOS.
- **Mostek auth webview:** `POST/GET /api/admin/wejscie?cel=<ścieżka>` w PANELU
  (`app/api/admin/wejscie/route.ts`) — przy `Authorization: Bearer <token urządzenia>`
  ustawia session cookie (`sessionCookie()` w `lib/auth.ts`) i 302 na `cel`
  (ograniczony do `/<lang>/admin...` — blokada open-redirect). WKWebView niesie
  Bearer TYLKO na pierwszym żądaniu. **Wdrożone na produkcję.**
- **NIE zagnieżdżaj `NavigationSplitView`** — dwa splity = podwójny pasek, druga
  ikona zwijania, skaczące przeciąganie kolumn (błąd naprawiony). Panel boczny
  modułów jest JEDYNYM splitem; list-detail robi HStack/GeometryReader.
- **Panel boczny wąski** (`.navigationSplitViewColumnWidth(min:280, ideal:320, max:360)`) —
  bez tego kolumna treści była za wąska nawet w poziomie (crash + nieczytelność).
- **CRASH który był:** poziomo + za szeroki sidebar → wariant jednokolumnowy
  z „cofnij" → pop wywracał apkę. Naprawa: wąski sidebar → poziomo dwa panele
  (bez „cofnij"). Pion (push→pop) zweryfikowany że NIE crashuje.
- **Na iPada buduj RELEASE** (`-configuration Release`) — Debug tnie animacje.
  Furtki DEBUG znikają (i tak tylko do symulatora).
- **Wgrywanie na iPada (CLI):** po PIERWSZYM wgraniu przez Xcode (rejestracja
  nowego urządzenia darmowego konta) kolejne robi Claude sam:
  `xcodebuild ... -configuration Release build` →
  `xcrun devicectl device install app --device 3CCA9321-4215-5229-A506-C204CB802F37 <app>` →
  `xcrun devicectl device process launch --terminate-existing --device 3CCA9321-... pl.leggeralabs.hub`.
  Używamy `project-telefon.yml` (jeden target — prostsze podpisywanie na darmowym koncie).
  Stempel wersji re-generuj po KAŻDYM commicie (`Skrypty/stempel-wersji.sh`).
- **Weryfikacja w symulatorze:** lokalny panel bywa flaky (PGlite resetuje token,
  Next dev pada). Jak padnie: `preview_start name:"dev"`, rozgrzej curl-em, przeloguj
  apkę (`LEGGERA_DEV_HASLO=devhaslo` + `LEGGERA_DEV_BACKEND=lokalny`). Dostęp do
  sterowania symulatorem (`mcp__Claude_Code_iOS_Simulator__control`) DZIAŁA (tap/screenshot).

## Roadmap — reszta życzeń właściciela (kolejny czat zaczyna stąd)

1. **Bez skrótów na iPadzie** — globalny sweep etykiet (rozwinięcia gdzie się mieszczą).
2. **Kalendarz — dopieszczenie Apple** (tryb poziomy, wydarzenia jako paski w komórkach).
3. **Poczta jak Apple Mail** (przyciski funkcyjne: odpowiedz/przekaż/flaga/przenieś).
4. **Apple Pencil**: Scribble (weryfikacja) → kanwa PencilKit w notatkach
   (decyzja o przechowywaniu: rysunek jako obrazek albo lokalnie) → adnotacje na dokumentach.
5. **Skróty klawiaturowe** (⌘N/⌘F/⌘1–5).
6. **Siatki wielokolumnowe** (Pulpit/Statystyki — dziś jedna rozciągnięta kolumna).
7. **Drag & drop.**
8. Drobiazgi: pole szukania w liście siedzi trochę za bardzo w prawo; FAB w wąskim
   wariancie jest w pasku (toolbar), nie jako FAB (spójność orientacji do rozważenia).

## Mapa plików apki (iPad)

- `LeggeraHub/Views/PanelBoczny.swift` — sidebar + routing modułów (jeden split).
- `LeggeraHub/Views/LeadyPanelIpad.swift` / `ProjektyPanelIpad.swift` / `KlienciPanelIpad.swift`
  — adaptacyjne dwa panele / jedna kolumna.
- `LeggeraHub/Views/UkladIpad.swift` — env `\.wPaneluBocznym`, `.szerokoscTresci()`.
- `LeggeraHub/Views/PanelWebowyView.swift` — `WidokWebowy`, `PanelWebowyView`, `PodgladDokumentuView`.
- `LeggeraHub/Views/NotatnikView.swift` — `PrzyciskDodawaniaFAB`, `KolkoFAB`, `StylFAB`.
- Panel: `app/api/admin/wejscie/route.ts`, `lib/auth.ts` (`sessionCookie`).
