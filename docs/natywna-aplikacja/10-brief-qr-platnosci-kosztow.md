# Brief: Kod QR do zapłaty kosztu z telefonu (Faza 13)

> Brief wdrożeniowy pod **jeden osobny czat**. Zaczynasz od `00-plan.md`,
> potem ten plik. Repo apki: `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`.
> Panel: `/Volumes/OWC_SN850X/projekty_ai/poltechnickx-website`.
> Źródło ustaleń: `08-wynik-audytu-apki.md`, sekcja B3.

## Dlaczego teraz

Właściciel pytał wprost: „czy jest możliwość płacić z telefonu". Dziś profil
kosztu w apce pokazuje kwotę i status, ale zapłata oznacza przepisanie numeru
konta ręcznie do aplikacji bankowej.

Rozwiązanie: **kod QR z danymi przelewu** na profilu kosztu — właściciel
skanuje go własną aplikacją bankową, która sama wypełnia przelew. Zero
integracji, zero nowych uprawnień, zero danych wychodzących gdziekolwiek.

## Decyzje właściciela — ROZSTRZYGNIĘTE, nie otwierać ponownie

1. **Kod QR: TAK, budujemy.**
2. **Standard: polski ZBP** (`buildPolishQrPayload`), **nie EPC** — EPC069-12
   obsługuje wyłącznie EUR (`lib/documents.ts:81`), a koszty są w PLN.
3. **Prawdziwa integracja bankowa (automatyczne inicjowanie przelewu):
   ODRZUCONA** przy wcześniejszej rozmowie — wymagałaby licencji PISP albo
   pośrednika z taką licencją. Nieadekwatne dla jednoosobowej działalności
   płacącej własne koszty. Nie proponować ponownie.

## Co audyt już ustalił — NIE sprawdzaj tego drugi raz

**Po stronie panelu i bazy nie trzeba dokładać NICZEGO** (rzadka sytuacja
w tym projekcie):

- Kolumna istnieje: `lib/db.ts:1348` — `costs.dostawca_konto`
- API ją zwraca: `app/api/costs/route.ts:18` oraz
  `app/api/costs/[id]/route.ts:24`
- Panel ją wypełnia: `CostEditor.tsx:414`, a OCR paragonu nawet odczytuje
  numer z walidacją 26 cyfr (`lib/costs-ocr.ts:112`) i weryfikacją Białą
  Listą MF

Braki są wyłącznie po stronie apki:

- `Models/Cost.swift` dekoduje 12 pól i **`dostawca_konto` wśród nich nie ma**
  — ~3 linie do dodania, serwer już to wysyła.

## Zakres

1. **Pole w modelu** — `dostawcaKonto` w `Models/Cost.swift` (~3 linie).
2. **Port `buildPolishQrPayload`** (`lib/documents.ts:99-119`) do rdzenia apki
   jako **czysta funkcja** (~30 linii). Świadomie w rdzeniu, nie w widoku —
   żeby dało się sprawdzić poprawność payloadu bez odpalania symulatora.
3. **Generator QR + widok** na `KosztDetailView` (~60 linii). `CoreImage` +
   `CIQRCodeGenerator`, bez żadnej zewnętrznej zależności.

Dane wejściowe QR (1:1 z tym, co panel wkleja do schowka w
`CostEditor.tsx:422`):

- konto: `dostawca_konto`
- kwota: `kwotaBrutto`; fallback — netto + VAT
- tytuł: `[numer_faktury, dostawca_nazwa]` złączone `" — "`, a gdy oba puste:
  `opis`, a gdy i to puste: `"Płatność"`

## Pułapki techniczne — wszystkie wykryte w audycie, nie odkrywaj ich bólem

- **Kodowanie: `.isoLatin1`, NIE `.utf8`.** Bank nie odczyta kodu z polskimi
  znakami zapisanymi w UTF-8.
- **Rozmiar**: `CIQRCodeGenerator` zwraca obrazek ~23×23 px. Trzeba go
  przeskalować `CGAffineTransform` **PRZED** rasteryzacją, plus
  `.interpolation(.none)` w SwiftUI. Bez tego kod jest rozmyty i nieczytelny
  dla skanera.
- **Nazwa odbiorcy ucinana do 20 znaków** — to wymóg standardu ZBP, nie bug.
  Nie „naprawiać".
- **`buildPolishQrPayload` zwraca `null`** gdy NRB ≠ 26 cyfr, gdy brak nazwy
  albo tytułu, albo gdy całość przekracza 160 znaków. Apka musi ten `nil`
  obsłużyć komunikatem, a nie pustym miejscem.
- **Starsze koszty mają `dostawca_konto` = `DEFAULT ''`.** Widok ma wtedy
  powiedzieć wprost „uzupełnij numer konta dostawcy", a **nie rysować pusty
  albo błędny kod**.
- **Zostaw w OBU plikach komentarze wzajemnie się wskazujące** — w
  `lib/documents.ts` przy `buildPolishQrPayload` i w porcie Swifta. Rozjazd
  tych dwóch implementacji byłby **cichy**: nic się nie wysypie, bank po
  prostu odrzuci kod, a nikt nie będzie wiedział dlaczego.

## Ryzyka

- **Weryfikacja końcowa wymaga prawdziwego telefonu z aplikacją bankową.**
  Symulator udowodni tylko, że kod się wygenerował — nie, że bank go czyta.
  To zadanie dla właściciela; zapisz je jako „nie zweryfikowano dotykiem",
  jeśli nie zostanie zrobione w tej sesji.
- **Dwie kopie tej samej reguły** (TS + Swift) to udokumentowany wzorzec
  długu w tym projekcie — stąd wymóg komentarzy wzajemnych wyżej.
- Numer konta z OCR bywa błędny mimo walidacji 26 cyfr — QR wiernie odtworzy
  błąd. Widok powinien pokazywać numer konta czytelnie **obok** kodu, żeby dało
  się go zweryfikować okiem przed skanowaniem.

## Szacunek pracy

**Pół sesji.** Podział: model ~3 linie, port funkcji ~30 linii, generator +
widok ~60 linii.

## Jak pracować

- **Zielony build nie jest dowodem.** Zrzut ekranu profilu kosztu z kodem,
  plus przypadek „koszt bez numeru konta" — oba obejrzeć.
- Payload sprawdź **porównawczo**: te same dane wejściowe przepuść przez
  `buildPolishQrPayload` w panelu (node) i przez port w Swifcie; stringi mają
  być identyczne co do znaku.
- **Sprawdzaj, czy coś WOŁA kod, nie czy kod istnieje** — pole dodane do
  modelu, którego widok nie czyta, to piąty przypadek tego wzorca w projekcie.

## Wynik

Profil kosztu w apce pokazuje skanowalny kod QR ZBP z danymi przelewu (albo
jasny komunikat o braku numeru konta), port funkcji siedzi w rdzeniu jako
czysta funkcja z komentarzem wskazującym na bliźniaka w panelu, i odwrotnie.

## Prompt otwierający kolejny czat

```
Kontynuujemy aplikację natywną Leggera Hub. Przeczytaj
docs/natywna-aplikacja/00-plan.md, potem
docs/natywna-aplikacja/10-brief-qr-platnosci-kosztow.md (kontekst ustaleń:
08-wynik-audytu-apki.md sekcja B3), i dodaj kod QR z danymi przelewu na
profilu kosztu. Standard ZBP, nie EPC — decyzja podjęta, nie otwieraj jej
ponownie. Repo apki: /Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios,
panel: /Volumes/OWC_SN850X/projekty_ai/poltechnickx-website.
```
