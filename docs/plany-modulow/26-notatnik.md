# Moduł 26 — Notatnik: powiązania z CRM, naprawa duplikatów, przypięcie, → kalendarz

> Przeczytaj `docs/plany-modulow/README.md` i `CLAUDE.md`. Stan zbadany
> 2026-07-16 — nie badaj od nowa.

## Skąd to się wzięło

Właściciel (2026-07-16): *„poki co w ogóle nie zajmowaliśmy się sekcją
notatnika, czekam na propozycje co można by tam poprawić"*. Propozycje
przedstawione i **zatwierdzone w całości** (wszystkie cztery punkty niżej).

## Stan faktyczny

Tabela `notes` (`lib/db.ts:450-458`) ma dokładnie **6 kolumn**: `id`, `tytul`,
`tresc`, `tagi` (CSV), `created_at`, `updated_at`. **Zero `ALTER TABLE notes
ADD COLUMN` w całym pliku — nigdy nie była rozszerzana.** Do tego
`notes_activity` (`db.ts:460`) z logiem wpisów.

Co moduł umie: dodawanie (pierwsza linia textarea → tytuł, `.slice(0,120)`;
Cmd+Enter zapisuje — `NotesDashboard.tsx:43-48`), edycja inline
(`EditableText`/`EditableTextarea`, :177-179), tagi jako `<input onBlur>`
(:182-188), filtr tagów (`FilterPills`, :162-167, zapis w
`localStorage["leggera_notes_tag_filter"]`), wyszukiwarka klientowa po
`tytul`+`tresc` (:104-107), log aktywności zwijany w karcie (:220-330), grid
`sm:grid-cols-2 lg:grid-cols-3` (:174), sort zawsze `updated_at DESC`.

## Zakres — cztery zatwierdzone punkty

### 1. Naprawa: „Przekuj w projekt" tworzy duplikaty (BŁĄD, nie brak funkcji)

`promoteToProject` (`NotesDashboard.tsx:79-93`) robi POST `/api/projects` i
`router.push`. **Nie zapisuje żadnego śladu** — notatka nie wie, że projekt
powstał, projekt nie wskazuje notatki, notatka nie jest oznaczana. Kliknięcie
N razy tworzy **N projektów**. Naprawa: `notes.project_id` (patrz punkt 2) →
idempotencja + link „otwórz projekt" zamiast tworzenia kolejnego.

### 2. Powiązanie z klientem/leadem/projektem

Notatnik jest **jedynym modułem panelu bez żadnej kolumny powiązania** (typ
`Note` w `lib/notes.ts:1-9` to dokładnie 6 pól; API POST/PATCH whitelistuje
`tytul`/`tresc`/`tagi`). Kontrast z `events`, gdzie `lead_id`/`project_id`/
`client_id` istnieją od dawna.

**Kolumny `notes.client_id`/`lead_id`/`project_id` dokłada Moduł 22**
(„Powiązania wszędzie") wraz ze wspólnym `LinkPicker`. Ten moduł buduje na
nich UI: picker w karcie/profilu + filtry po kliencie/leadzie (wzorem
kalendarza, `CalendarView.tsx:577-609`). **Jeśli robisz 26 przed 22 — dodaj
kolumny tutaj**, ale wtedy uzgodnij z 22, żeby nie zrobić tego dwa razy.

### 3. Przypięcie + archiwum

Dziś wszystkie notatki są równorzędne, sort zawsze po `updated_at DESC`, brak
kolumny statusu. Dodaj `pinned` (na górze) i archiwum (zamiast usuwania).
Zakładki/pigułki Wszystkie/Przypięte/Archiwum — użyj `FilterPills`
(`app/[lang]/admin/FilterPills.tsx`, Moduł 21), już jest wspólny i ma akcent
marki. Dziś `FilterPills` służy tam tylko do tagów.

### 4. Notatka → wydarzenie w kalendarzu

`events` ma pełną infrastrukturę (`godzina`, `czas_trwania_min`, `data_koniec`,
powiązania `client_id`/`lead_id`/`project_id`). Notatka „zadzwonić do X we
wtorek" powinna jednym kliknięciem trafić do kalendarza — z przeniesieniem
powiązania (punkt 2), analogicznie do tego, jak `offerAccept.ts` przenosi
powiązania z oferty na projekt/fakturę.

## Warto rozważyć przy okazji (nie zatwierdzone — zapytaj)

- **Podstrona `[id]`** — katalog ma tylko `page.tsx` i `NotesDashboard.tsx`.
  Komentarz w kodzie sam to przyznaje (:217-219: „Notatki nie mają osobnej
  podstrony/peek panelu, więc log żyje bezpośrednio w karcie"). Reszta panelu
  ma `[id]/page.tsx` — to niespójność z konwencją z CLAUDE.md.
- Wyszukiwarka nie widzi tagów ani treści logu (tylko `tytul`+`tresc`).
- Karta nie pokazuje daty — `updated_at`/`created_at` istnieją w bazie.

## Czego NIE robić bez pytania

- Nie dokładaj edytora rich-text/markdown/załączników — właściciel o to nie
  prosił, a to duży zakres.
- Nie ruszaj palety/emoji/układu (Moduł 21).
- Zero AI (CLAUDE.md).

## Weryfikacja

1. `npx tsc --noEmit -p tsconfig.json`.
2. Scenariusz w dev: „Przekuj w projekt" **dwa razy** na tej samej notatce →
   drugi raz otwiera istniejący projekt, nie tworzy drugiego.
3. Zrzuty przed/po. Zaktualizuj `HUB_SETUP.md` i odhacz w `README.md`.
