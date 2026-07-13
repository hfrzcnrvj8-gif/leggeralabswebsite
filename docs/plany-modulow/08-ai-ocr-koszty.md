# Moduł 8 — AI: odczyt paragonów/faktur zakupowych (OCR w Kosztach)

> Przeczytaj najpierw `docs/plany-modulow/README.md`, `CLAUDE.md` i
> **`docs/plany-modulow/06-ai-infrastruktura-ollama.md`** (fundament — musi być
> zbudowany i działać PRZED tym modułem). Niezależny od Modułu 7 — można go
> zrobić przed, po, albo zamiast niego.

## Problem (nietechnicznie)

Dodawanie kosztu dziś: właściciel ręcznie przepisuje z paragonu/faktury
dostawcy nazwę, kwotę netto, stawkę VAT, datę — do formularza w module
Koszty. To czysto mechaniczna robota, podatna na literówki, i dokładnie tam,
gdzie skanowanie/zdjęcie + model wizyjny realnie oszczędza czas.

**Ważny fundament, który już istnieje:** moduł Koszty ma już pole załącznika
(`zalacznik_dane`/`zalacznik_nazwa`/`zalacznik_typ`, `lib/costs.ts`,
`ATTACHMENT_MIME_TYPES` = PDF/JPEG/PNG/WEBP, limit 8MB) — właściciel już
dziś może dołączyć skan faktury do kosztu. To gotowy punkt zaczepienia: OCR
nie wymaga nowego mechanizmu uploadu, tylko odczytania danych z pliku, który
i tak tam ląduje.

## DECYZJA: model wizyjny czyta załącznik → wypełnia formularz, właściciel zatwierdza

Przy dodawaniu nowego kosztu: właściciel dołącza zdjęcie/skan paragonu jak
dziś, klika **"📷 Odczytaj z załącznika"** — model wizyjny (przez Ollamę,
np. rodzina `llava`/`qwen2-vl`/inny multimodalny dostępny na Macu) analizuje
obraz i **proponuje** wartości pól (dostawca, kwota netto, VAT, data, opis) —
**wszystkie pola zostają edytowalne**, właściciel poprawia co model się
pomylił i dopiero wtedy zapisuje. Model nigdy nie zapisuje kosztu sam.

**Format PDF:** modele wizyjne w Ollamie zwykle oczekują obrazu (JPEG/PNG),
nie PDF bezpośrednio — dla załączników PDF pierwsza strona renderowana do
obrazu przed wysłaniem do modelu (biblioteka do PDF→PNG po stronie serwera,
do ustalenia w Kroku 1). Dla JPEG/PNG/WEBP — bez zmian, prosto do modelu.

## Plan techniczny

### Krok 1 — biblioteki i konwersja PDF→obraz
- Sprawdź dostępność lekkiej biblioteki node do renderowania pierwszej
  strony PDF do PNG (do ustalenia — `pdf-to-img`/podobne; unikać ciężkich
  zależności systemowych typu poppler, jeśli się da, bo środowisko Vercela
  ma ograniczenia na binaria).
- Jeśli konwersja PDF okaże się zbyt kłopotliwa na Vercelu: v1 obsługuje
  tylko JPEG/PNG/WEBP (paragon ze zdjęcia telefonem — najczęstszy case), PDF
  zostaje "bez OCR, wpisz ręcznie jak dziś" — jasno komunikowane w UI, nie
  cichy błąd.

### Krok 2 — endpoint OCR
- `POST /api/costs/[id]/ocr` (admin-only, `runtime = "nodejs"`): pobiera
  `zalacznik_dane` kosztu (albo przyjmuje plik bezpośrednio, jeśli koszt
  jeszcze nie ma `id` — do ustalenia, patrz "Otwarte decyzje" #1), woła
  model wizyjny przez `lib/ollama.ts` (Moduł 6 — może potrzebować rozszerzyć
  o wariant z obrazem w promptcie, Ollama API przyjmuje obraz jako base64 w
  polu `images`), parsuje odpowiedź modelu (**instrukcja systemowa każe
  modelowi zwrócić czysty JSON** o ustalonym kształcie
  `{dostawca, kwota_netto, vat_stawka, data, opis}` — łatwiej sparsować niż
  wolny tekst; jeśli model zwróci coś niepełnego/błędnego, brakujące pola
  zostają puste, nie zgadywane).
- Walidacja odpowiedzi modelu przed zwróceniem do UI: kwota musi być liczbą,
  data musi przejść `isPlausibleDateString()`, VAT musi być z `VAT_RATES` —
  inaczej pole zostaje puste zamiast śmieciowej wartości w formularzu.

### Krok 3 — UI
- W `CostsDashboard.tsx`/edytorze kosztu: po dodaniu załącznika (przed
  zapisaniem albo zaraz po) pojawia się przycisk "📷 Odczytaj z załącznika".
  Klik → `POST .../ocr` → wypełnia puste/wskazane pola formularza
  proponowanymi wartościami (jak `EditableText` — normalnie edytowalne,
  właściciel poprawia czego trzeba).
- Stan ładowania (analiza obrazu chwilę trwa) + czytelny komunikat przy
  niedostępności modelu lub nierozpoznanym pliku ("Nie udało się odczytać —
  wpisz ręcznie").

### Krok 4 — weryfikacja
- `npx tsc --noEmit -p tsconfig.json`.
- Dev: przykładowe zdjęcie paragonu → "Odczytaj z załącznika" → sensowne
  wartości w formularzu, wszystkie edytowalne. Podetknij nieczytelny/pusty
  plik → kontrolowany komunikat błędu, formularz dalej używalny ręcznie.
  Wyłącz Ollamę → to samo (kontrolowany fallback, nie crash).

## Otwarte decyzje (zapytaj właściciela)
1. **Moment wywołania OCR** — po zapisaniu kosztu z załącznikiem (endpoint
   działa na istniejącym `id`), czy już przy wyborze pliku PRZED zapisaniem
   (trzeba przesłać plik bezpośrednio do endpointu, bez `id` kosztu)?
   Rekomendacja: przed zapisaniem — mniej kroków dla właściciela (dodaj
   zdjęcie → od razu widzi wypełniony formularz → poprawia → zapisuje raz).
2. **Obsługa PDF** — czy warto inwestować w konwersję PDF→obraz w v1, czy
   zacząć tylko od zdjęć (JPEG/PNG), skoro to najczęstszy realny case
   (paragon z telefonu)?
3. **Który model wizyjny** ma być pobrany/gotowy na Macu i jak radzi sobie z
   polskimi paragonami (warto przetestować na 2-3 prawdziwych przykładach
   przed budową UI, żeby nie budować pod model, który słabo czyta polski).

## Definicja ukończenia
- Załączone zdjęcie/skan paragonu można "odczytać" jednym kliknięciem —
  formularz kosztu wypełnia się proponowanymi wartościami, wszystkie
  edytowalne przed zapisem.
- Błędny/nierozpoznany plik i niedostępność modelu nie blokują ręcznego
  wpisania kosztu jak dziś.
- `tsc` czysty, zweryfikowane na dev (realne przykładowe paragony),
  `HUB_SETUP.md` zaktualizowany.
