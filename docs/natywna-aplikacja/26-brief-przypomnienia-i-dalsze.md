# Brief: moduł Przypomnień (Apple Reminders-style) + reszta Kalendarza

> Spisany 2026-07-22, po sesji `25-wynik-faza14-gesty-i-kalendarz.md`.
> **Osobny czat.** Repo apki: `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`.
> Panel: ten katalog. Stan wyjściowy: apka `14c9d5c`, panel `3d0e6be`.

## Skąd to się wzięło

Właściciel, testując przebudowany Kalendarz (Apple Kalendarz jako wzorzec,
zrzut ekranu): *„czy to zadania na nowy czat czy kontynuujemy tutaj?”* —
sam trafnie ocenił, że reszta drogi do pełnej zgodności z Apple Kalendarz to
kilka NIEZALEŻNYCH kawałków pracy, nie jedna dokładka. Trzy mniejsze
(autouzupełnianie lokalizacji, wielodniowe+godziny w formularzu, prosty
alert) zostały zrobione od razu w tamtej sesji. Cztery większe zostają na
osobne wątki — ten brief jest dla PIERWSZEGO z nich (Przypomnienia) i
zbiera resztę jako lista do rozstrzygnięcia na starcie.

## Pierwsze zadanie tego czatu: przejść model danych z właścicielem

Poniższy model to **propozycja z poprzedniej sesji**, jeszcze
NIEPOTWIERDZONA — właściciel przeszedł od razu do kolejnych próśb (gesty
w Kalendarzu), zanim zdążył ją zaakceptować. Zacznij od tego pytania, zanim
napiszesz migrację bazy (nieodwracalne w produkcji — patrz `CLAUDE.md`,
sekcja „Autoryzacja i baza”).

### Proponowany model (Reminders, wersja 1 — bez list/folderów)

Nowa tabela `reminders` w `lib/db.ts` (wzorem `ensureHubSchema()` —
`CREATE TABLE IF NOT EXISTS` + bramka `schemaUpToDate`/`markSchemaApplied`,
**NIE** ręczna migracja):

| Kolumna | Typ | Uwaga |
|---|---|---|
| `id` | `TEXT PRIMARY KEY` | |
| `tytul` | `TEXT NOT NULL` | |
| `notatka` | `TEXT NOT NULL DEFAULT ''` | odpowiednik `opis` z innych modułów |
| `termin` | `DATE` | opcjonalny — przypomnienie bez terminu istnieje (jak Apple Reminders) |
| `godzina` | `TEXT` | `"HH:MM"` albo `NULL`, ten sam wzorzec co `events.godzina` |
| `priorytet` | `INTEGER NOT NULL DEFAULT 0` | 0–3, jak wykrzykniki Apple’a — pokazywane na złoto (konwencja „złoto = wymaga ruchu”) |
| `ukonczone` | `BOOLEAN NOT NULL DEFAULT false` | |
| `ukonczone_at` | `TIMESTAMPTZ` | kiedy odhaczone |
| `lead_id` / `client_id` / `project_id` | `TEXT REFERENCES ... ON DELETE SET NULL` | opcjonalne powiązanie, jak `events` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |

API: `app/api/reminders/route.ts` (GET listy + POST) i
`app/api/reminders/[id]/route.ts` (PATCH pole-po-polu + DELETE) — 1:1 wzorem
`app/api/events/*`.

iOS: nowy moduł w rdzeniu (`LeggeraHubCore/Sources/LeggeraHubCore/Models/Przypomnienia.swift`
+ `AppStore` metody + `APIClient` wołania), nowy ekran listy w „Więcej”
(checkbox/swipe „ukończone” jak Apple Reminders, dodawanie/edycja,
priorytet), długie przytrzymanie pustego dnia w Kalendarzu dostaje DRUGĄ
opcję obok „Dodaj wydarzenie”: „Dodaj przypomnienie”.

**Świadomie BEZ list/folderów** w wersji pierwszej (Apple ma „Praca”,
„Zakupy” itd.) — jedna wspólna lista, żeby nie rozjeżdżać zakresu jeszcze
bardziej. Da się dodać później jako kolumnę `lista TEXT` bez migracji
danych (NULL = domyślna lista).

### Pytania do zadania właścicielowi na starcie

1. Pasuje ten model, czy coś zmienić (np. listy/foldery od razu, inne
   priorytety, inny zestaw powiązań)?
2. Czy Przypomnienia mają być WIDOCZNE w Kalendarzu (np. jako trzeci
   „strumień” obok Wydarzeń/Terminów, na dzień z terminem) — czy wyłącznie
   osobny ekran listy w „Więcej”? **Uwaga**: plik `Kalendarz.swift` ma
   świadomą zasadę „DWA STRUMIENIE, nie jeden” (Wydarzenie edytowalne,
   Termin tylko-do-odczytu) — dodanie trzeciego strumienia to decyzja, nie
   coś do zrobienia po cichu przy okazji.
3. Czy panel (desktop) ma dostać widok Przypomnień, czy to funkcja
   wyłącznie na telefon (jak np. skaner wizytówek)?

## Reszta rzeczy z prośby o Apple Kalendarz — do rozstrzygnięcia z właścicielem, nie robić po cichu

| Temat | Rozmiar | Uwaga |
|---|---|---|
| **Czas podróży („time to leave”)** | Średni-duży | Integracja z Mapami (liczenie ETA do `wydarzenie.lokalizacja`) + reguła: kiedy zaplanować alert na tej podstawie zamiast stałej liczby minut przed. Wymaga zgody na `CLLocationManager` (nowy wpis w Info.plist — **inaczej niż autouzupełnianie lokalizacji**, które go NIE wymagało). |
| **Załączniki do wydarzenia** | Duży | Nowa infrastruktura plików — apka ma już wzorzec (Koszty: paragon-ze-zdjęcia; Poczta: załączniki NA ŻĄDANIE z IMAP, `zalaczniki-na-zadanie-imap.md`), ale to nowa tabela + trasy upload/download, nie kolumna. |
| **Przełącznik widoku rok/lista** | Średni | Apple Kalendarz ma trzy widoki (miesiąc/rok/lista). Ten Kalendarz ma świadomie tylko miesiąc+dzień — czy rozszerzać, czy zostawić węższy zakres (uzasadnienie w nagłówku `KalendarzView.swift`: „Zakres na telefon jest świadomie węższy niż w panelu”)? |
| **Gesty w kolejkach Poczty poza główną listą** | Mały | Screener i „Bez odpowiedzi” (`PocztaListView.swift`) nie dostały menu przytrzymania w Fazie 14 — tylko główny folder. Wzorzec już jest napisany, to powielenie, nie projektowanie od nowa. |
| **Lokalizacja/alert w panelu (desktop)** | Mały-średni | Dane już płyną przez API (`events.lokalizacja`, `events.alert_minut_przed`), ale `CalendarView.tsx` w panelu ich nie pokazuje/nie edytuje. Alert i tak jest LOKALNY (per telefon) — z panelu nie dałoby się go zaplanować bez architektury push, więc to raczej tylko WYŚWIETLENIE lokalizacji, nie duplikat pola alertu. |

## Pułapki tej sesji, warte przeczytania przed pisaniem kodu

- **`.contextMenu` w gęstej siatce (wiele komórek w jednym `HStack`) jest
  niewiarygodne** — patrz `25-wynik...md`, sekcja o długim przytrzymaniu
  dnia. Jeśli Przypomnienia dostaną WŁASNĄ siatkę/listę gęstych komórek
  (a nie zwykłe wiersze `List`, gdzie `.contextMenu` działa bez zarzutu
  w całej reszcie apki), sprawdź TO SAMO zanim uznasz gest za gotowy —
  dowód na ekranie (wartość wprost w etykiecie), nie sam build.
- **Nowe pliki wymagają `xcodegen generate`** przed budowaniem — inaczej
  „cannot find X in scope” mimo poprawnego kodu na dysku.
- **`Form`/`Section` z wieloma gałęziami w JEDNYM domknięciu `@ViewBuilder`
  potrafi dać kompilatorowi „unable to type-check in reasonable time”** —
  wydzielaj do osobnych `@ViewBuilder` computed properties zawczasu przy
  bardziej rozbudowanych formularzach (Przypomnienia będą miały: tytuł,
  notatka, termin, godzina, priorytet, powiązanie — to już blisko progu,
  który złapał `NoweWydarzenieView` w tej sesji).
- **Migracja bazy nieodwracalna w produkcji** — przed napisaniem `CREATE
  TABLE reminders` upewnij się, że model jest zaakceptowany (patrz pytania
  wyżej).
