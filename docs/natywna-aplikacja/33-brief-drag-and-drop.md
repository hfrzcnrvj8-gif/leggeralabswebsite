# Brief: Drag & drop na iPadzie (partia 3 roadmapy)

> Repo apki: `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`. Spisany
> 2026-07-24, po zamknięciu partii 2 (`32-wynik-siatka-kpi-i-naprawa-crasha-splitu.md`).
> Pozycja 3 z pierwotnej listy życzeń właściciela (`22-ipad-hybryda-i-adaptacyjny.md`
> → „Roadmap"), zapisana wtedy jednym zdaniem: **„Drag & drop."** — bez
> dalszego opisu. To pierwsze zadanie tego czatu: dogadać, co to właściwie
> znaczy, zanim zacznie się kodować.

## Stan zmierzony dziś (2026-07-24, po commicie `567bd86`)

Zero drag & drop w apce iOS. Sprawdzone gretem po całym repo
(`LeggeraHub`, `LeggeraHubCore`) — **żadnego** wystąpienia `.draggable(`,
`.dropDestination(`, `.onDrag(`, `.onDrop(`, `.onMove(`, `onInsert`.
Wszystkie listy w apce (Leady, Projekty, Klienci, Notatnik, Rejestr,
Katalog, Kalendarz, Przypomnienia) są dziś statyczne — jedyna droga do
zmiany kolejności/statusu to wejście w profil i formularz albo (od Fazy
14) `swipeActions`/menu przytrzymania.

**Kontrast z panelem webowym**, który drag & drop już ma — trzy różne
zastosowania, warto je rozróżnić, bo to TRZY różne funkcje, nie jedna:

1. **Kanban → zmiana statusu** (`app/[lang]/admin/leads/KanbanBoard.tsx`,
   `clients/KanbanBoard.tsx`, `projects/ProjectKanban.tsx`) — przeciągnięcie
   karty leada/klienta/projektu między kolumnami tablicy zmienia jego status.
   **Apka iOS nie ma widoku tablicy/kanban w ogóle** — tylko listy. Zrobienie
   tego na iPadzie oznacza zbudowanie NOWEGO widoku (tablica z kolumnami),
   nie dopisanie gestu do istniejącego.
2. **Reorder w profilu projektu** (`app/[lang]/admin/projects/ProjectDetailPanel.tsx`,
   linie ~1345–1420) — przeciąganie kamieni milowych i zadań w obrębie tej
   samej listy, żeby zmienić kolejność. Apka ma `ProjektDetailView` z listą
   kamieni/zadań, ale bez reorderu — to najbliższy, najtańszy odpowiednik w
   SwiftUI (`.onMove` w `List` z `EditMode`, natywne, kilka linii).
3. **Kalendarz → przeciągnięcie wydarzenia** (`app/[lang]/admin/calendar/CalendarView.tsx`,
   trzy miejsca: linie ~867, ~1244, ~1697) — przeciągnięcie karty wydarzenia
   na inny dzień/godzinę zmienia termin. Apka ma już gesty w Kalendarzu
   (patrz `kalendarz-poziomy-i-rozpiska` w pamięci — 4 poziomy, gesty,
   przypięty panel) — dodanie drag-to-reschedule kolidowałoby z istniejącymi
   gestami przesuwania/zoomowania widoku, do przemyślenia osobno.

Poza tym panelem: na iPadzie/iOS istnieje jeszcze **czwarta, zupełnie inna
kategoria** — systemowy drag & drop międzyaplikacyjny (`Transferable`,
przeciąganie pliku/zdjęcia z Zdjęć/Plików DO apki, albo przeciąganie
elementu z apki NA ZEWNĄTRZ, np. do drugiej apki w Split View). To NIE ma
odpowiednika w panelu (przeglądarka na desktopie nie ma tej metafory w tej
formie) — to czysto natywna, „komputer w terenie" cecha iPada, zgodna z
duchem `22-*.md` („pełna funkcjonalność panelu + iOS"), ale bez gotowego
wzorca do skopiowania z panelu.

## Zakres do rozstrzygnięcia W CZACIE (pierwsze zadanie)

Cztery kandydaci wyżej **nie są jednym zadaniem** — różnią się nakładem i
ryzykiem. Zapytaj właściciela, co bierzemy (można więcej niż jedno, ale
osobnymi paczkami: build → weryfikacja → commit, nie jednym wielkim skokiem):

| Kandydat | Nakład | Ryzyko | Odpowiednik w panelu |
|---|---|---|---|
| Reorder kamieni/zadań w projekcie | Mały — `.onMove` w istniejącej `List` | Niskie | `ProjectDetailPanel.tsx` |
| Tablica (kanban) Leady/Projekty/Klienci ze zmianą statusu przeciągnięciem | Duży — nowy widok, nowa nawigacja | Średnie–wysokie (patrz ostrzeżenie niżej) | `KanbanBoard.tsx` ×2, `ProjectKanban.tsx` |
| Drag-to-reschedule w Kalendarzu | Średni — koliduje z istniejącymi gestami | Średnie | `CalendarView.tsx` |
| Systemowy drag & drop międzyaplikacyjny (np. zdjęcie z Zdjęć → załącznik notatki, przeciąganie leada do Maila) | Średni–duży, zależnie od zakresu | Nieznane — nowa kategoria w tej apce | brak (natywna cecha iPada) |

Rekomendacja tego briefu (nie decyzja): **zacznij od reorderu kamieni/zadań**
— najmniejszy, najbezpieczniejszy krok, uczy wzorca `.onMove`/`Transferable`
na niskim ryzyku, zanim ktokolwiek dotknie tablicy kanban czy Kalendarza.

## Ostrzeżenie techniczne — przeczytaj PRZED kodowaniem

Partia 2 (`32-wynik-*.md`, pamięć `ipad-lazygrid-w-liscie-crash-splitu`)
złapała crasha, którego nikt nie planował: `LazyVGrid` wewnątrz wiersza
`List` na iPadzie w `NavigationSplitView` wywalał apkę przy interaktywnym
przeciąganiu paska bocznego, bo zagnieżdżony `UICollectionViewCompositionalLayout`
dostawał `invalidateLayout` w trakcie tranzycji splitu. **Drag & drop to
DOKŁADNIE ta sama rodzina ryzyka** — `.onMove`/`.draggable`/`.dropDestination`
w `List` też są `UICollectionView`-backed i też reagują na gesty w czasie
rzeczywistym. Jeśli po zbudowaniu czegokolwiek z tej listy właściciel
zgłosi crash przy przeciąganiu — **od razu ściągnij crash log**:

```bash
xcrun devicectl device info files --device <UDID> --domain-type systemCrashLogs
xcrun devicectl device copy from --device <UDID> --domain-type systemCrashLogs \
  --source "LeggeraHub-<data>.ips" --destination "./crash.ips"
```

`.ips` to dwa JSON-y w jednym pliku (nagłówek + treść, rozdzielone `\n`) —
`python3 -c "import json; lines=open('crash.ips').read().split(chr(10),1); ..."`
czyta `exception`/`threads[faultingThread].frames` wprost. Nie zgaduj
przyczyny z opisu właściciela — stos rozstrzyga w kilka minut to, co inaczej
zajęłoby godzinę prób i błędów.

## Zasady krytyczne (bez zmian, z poprzednich sesji)

Buduj RELEASE; `NavigationSplitView` bez zagnieżdżania; `devicectl`
(iPad `3CCA9321-4215-5229-A506-C204CB802F37`, iPhone
`1F379FD8-EFA4-55F7-BDB6-7E9CC8B5BEBD`); `project-telefon.yml`; iPhone NIE
regresuj. Nowy plik → `xcodegen generate` PRZED buildem. Stempel wersji →
`Skrypty/stempel-wersji.sh` po każdym commicie. Sprawdź `git status`/`git log`
PRZED rozpoczęciem pracy (pamięć `rownolegle-sesje-git-kolizja` — druga,
niescommitowana sesja nad tym samym tematem już się raz zdarzyła).

## Jak weryfikować

UI na fizycznym iPadzie — mirroring w QuickTime (`Nowe nagranie filmowe` →
źródło „Ekran: iPad (Patryk)") pokazuje ekran, ale NIE przyjmuje dotyku
(tylko podgląd) — nawigację/gesty robi właściciel ręcznie, Ty patrzysz i
komentujesz. Backend (jeśli reorder/status zapisuje się do panelu) zawsze
`curl`. Po każdej zgłoszonej awarii — crash log z `devicectl`, patrz wyżej,
zanim zaczniesz zgadywać.

## Stan wyjściowy

Wersja apki w chwili spisania: **113** (`567bd86`), wgrana na iPada i
zweryfikowana (siatka KPI + naprawiony crash paska bocznego).
