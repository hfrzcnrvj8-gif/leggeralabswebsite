# Moduł 48 — AI: propozycja kategorii kosztu (rozszerzenie OCR z Modułu 8)

> Przeczytaj najpierw `docs/plany-modulow/README.md`, `CLAUDE.md`,
> `docs/AUDYT-7-WYNIKI.md` (punkt „c" — decyzja właściciela rozszerzająca AI
> o trzy nowe punkty) oraz **`docs/plany-modulow/08-ai-ocr-koszty.md`**
> (fundament — ten moduł to dopisanie JEDNEGO pola do już zbudowanego i
> działającego OCR-u paragonów, nie nowy przepływ).

To pierwszy z trzech briefów zapowiedzianych w Audycie 7 (kolejność
c → a → b, wg ryzyka i re-użytku istniejącego kodu — patrz
`docs/plany-modulow/49-ai-podsumowanie-watku.md` i
`docs/plany-modulow/50-ai-szkic-notatki.md`). Ten jest najmniejszy: nie
dokłada nowego endpointu ani nowego przycisku — rozszerza JSON, o który już
dziś pyta model przy odczycie paragonu.

## Problem (nietechnicznie)

Moduł 8 (OCR paragonu) dziś proponuje dostawcę, kwoty, VAT i datę z
załączonego zdjęcia/skanu — ale **kategorię kosztu trzeba wybrać ręcznie z
listy**. Model widzi paragon i często „wie" z czego jest koszt (np. paliwo,
materiały biurowe, oprogramowanie) — to naturalne rozszerzenie tego samego
kliknięcia „📷 Odczytaj z załącznika", nie osobna funkcja.

**Ważne rozróżnienie od tego, co już istnieje (deterministyczna podpowiedź):**
`GET /api/costs/hints` (`app/api/costs/hints/route.ts`) już dziś podpowiada
kategorię — ale **wyłącznie na podstawie historii tego samego NIP-u
dostawcy** (ostatni inny koszt z tym NIP-em), wyświetlaną w `CostEditor.tsx`
tylko gdy `kategoria === "Inne"`. To zero-AI, zero ryzyka, i zostaje bez
zmian. Propozycja modelu ma sens tam, gdzie ta podpowiedź milczy: **nowy
dostawca bez historii**, albo gdy paragon sugeruje inną kategorię niż
zwykle u tego dostawcy. Te dwie podpowiedzi nie mogą się wizualnie gryźć w
UI — patrz „Otwarte decyzje" #1.

## DECYZJA: model dopisuje `kategoria` do istniejącego JSON-u OCR, walidacja jak reszta pól

Zgodnie z kształtem całego audytu („model proponuje → właściciel
zatwierdza"): **żadnego nowego endpointu.** `POST /api/costs/[id]/ocr`
(Moduł 8) już dziś zwraca `OcrSuggestion` (`lib/costs-ocr.ts`) z polami
`dostawca`, `kwota_netto`, `vat_stawka`, `data`, `opis` itd. Kategoria
dochodzi jako kolejne pole tego samego obiektu, wypełniane w tym samym
wywołaniu modelu (jeden odczyt zdjęcia = wszystkie propozycje naraz, nie
drugie zapytanie do Ollamy).

## Plan techniczny

### Krok 1 — `lib/costs-ocr.ts`
- `OCR_SYSTEM` (dziś linie ~15-30): dopisz `"kategoria"` do schematu JSON w
  instrukcji systemowej, z **jawnie wypisaną listą dozwolonych wartości** —
  `COST_CATEGORIES.join(", ")` z `lib/costs.ts` (`["Usługi","Sprzęt",
  "Subskrypcje","Biuro","Marketing","Podatki i ZUS","Inne"]`). Model MUSI
  wybrać jedną z tych etykiet, nie wymyślać własną — inaczej serwer i tak
  po cichu zamieni ją na `"Inne"` przy zapisie
  (`app/api/costs/[id]/route.ts:55-57`), co byłoby mylące bez wyjaśnienia.
- `OcrSuggestion` (typ, dziś linie ~34-44): dodaj `kategoria: CostCategory | null`.
- `parseOcrResponse()` (dziś linie ~75-132): waliduj `kategoria` przez
  `COST_CATEGORIES.includes(...)` dokładnie tak, jak już waliduje się
  `vat_stawka` (linie ~117-121) — spoza listy albo brak → `null`, NIGDY
  zgadywana wartość.

### Krok 2 — `app/api/costs/[id]/ocr/route.ts`
- Bez zmian logiki — endpoint już dziś przekazuje cały `suggestion` do
  klienta; nowe pole „przejeżdża" automatycznie.

### Krok 3 — `CostEditor.tsx`
- Typ lokalny w `readWithOcr()` (dziś linie ~210-220): dopisz `kategoria`.
- `patchBody` w tej samej funkcji (dziś linie ~228-239): dopisz
  `if (s.kategoria) patchBody.kategoria = s.kategoria;`.
- **Rozstrzygnij UX razem z właścicielem** (patrz „Otwarte decyzje" #1):
  czy OCR nadpisuje kategorię zawsze (jak dziś robią to inne pola OCR —
  bezwarunkowo, poza `dostawca_konto`), czy tylko gdy pole jest puste/
  `"Inne"` (spójne z logiką istniejącej podpowiedzi po NIP-ie).

### Krok 4 — weryfikacja
- `npx tsc --noEmit -p tsconfig.json`.
- Dev: zdjęcie/skan paragonu z jasno rozpoznawalną kategorią (np. faktura za
  hosting → „Subskrypcje") → „Odczytaj z załącznika" → kategoria w
  formularzu ustawiona sensownie i **edytowalna** jak reszta pól. Paragon z
  niejednoznaczną kategorią → sprawdź, że model nie forsuje błędnej wartości
  (a jeśli forsuje — czy `COST_CATEGORIES`-owa lista w promptcie jest
  wystarczająco jasna, czy trzeba dopisać przykłady per kategoria).

## Otwarte decyzje (zapytaj właściciela)

1. **Nadpisywanie vs uzupełnianie** — czy propozycja kategorii z OCR
   nadpisuje pole bezwarunkowo (jak reszta pól OCR dziś), czy tylko gdy
   dzisiejsza wartość jest pusta/„Inne"? Rekomendacja: tylko gdy puste/
   „Inne" — żeby nie nadpisywać świadomego wyboru właściciela z
   poprzedniego zapisu, i żeby nie kolidować wizualnie z istniejącą
   podpowiedzią z `hints.suggestion` (ta sama zasada widoczności).
2. **Czy pokazywać różnicę**, gdy propozycja modelu i podpowiedź z historii
   NIP-u się nie zgadzają (rzadki przypadek — nowy paragon od znanego
   dostawcy, ale inna kategoria niż zwykle)? Prosta droga: model wygrywa
   tylko gdy podpowiedź z historii akurat nie istnieje (nowy dostawca);
   gdy obie istnieją, priorytet ma podpowiedź z historii (mniej ryzykowna,
   zero-AI) — do potwierdzenia.

## Definicja ukończenia

- „Odczytaj z załącznika" w edytorze kosztu proponuje też kategorię, z
  zamkniętej listy `COST_CATEGORIES`, dalej w pełni edytowalną przed
  zapisem.
- Niedostępność modelu / niejednoznaczny paragon nie blokuje ręcznego
  wyboru kategorii jak dziś.
- `tsc` czysty, zweryfikowane na dev na realnym paragonie, `HUB_SETUP.md`
  zaktualizowany (dopisek do sekcji Modułu 8). `CLAUDE.md` → „Świadome
  decyzje produktowe" już wymienia ten punkt jako zdecydowany-lecz-
  niezbudowany (zaktualizowane 2026-07-23, gdy powstały wszystkie trzy
  briefy naraz) — po zbudowaniu zmień tam status z „decyzja" na
  „zbudowane", link do tego pliku zostaje.
