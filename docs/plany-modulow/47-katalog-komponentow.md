# Brief: Katalog komponentów — „wirtualny magazyn" pod oferty wdrożeń

> Brief wdrożeniowy pod **jeden osobny czat**. Powstał 2026-07-23 podczas
> rozmowy strategicznej domykającej Audyt 7 (`docs/AUDYT-7-WYNIKI.md`). To
> **nowy moduł**, nie audyt — ale świadomie **rozszerza istniejący Katalog
> usług** (`service_catalog`, Moduł 20), nie tworzy bytu od zera.

## Skąd to się wzięło (kontekst biznesowy)

Właściciel buduje ofertę consultingu **automatyzacji + wdrożeń lokalnych LLM
dla MŚP**, i chce sprzedawać **kompleksowo: software I hardware** (komputer/
serwer + „wszystko dookoła": UPS, NAS, sieć, warstwa software, robocizna,
umowa serwisowa). Każdy klient ma **inne wymagania sprzętowe** (usługa
personalizowana), ale właściciel potrzebuje **szablonu z widełkami cen** —
biblioteki komponentów, z której **składa ofertę per klient**.

**Kluczowa obserwacja, która kształtuje zakres:** personalizacja bierze się
z **kompozycji**, a szablon z **biblioteki klocków z widełkami**. Nie robimy
jednej sztywnej oferty — robimy katalog komponentów (sprzęt + software +
robocizna), z których powstaje pozycja oferty jednym kliknięciem. To mapuje
się na istniejącą architekturę: `service_catalog` → Oferty/Faktury (pozycje).

Orientacyjne poziomy wdrożenia (do doprecyzowania z właścicielem — **ceny
zmienne, nie wpisuj na sztywno w kod jako prawdę**):

| Poziom | Dla kogo | Model | Sprzęt | Rząd wielkości |
|---|---|---|---|---|
| PoC | dowód wartości | 7–14B | Mac właściciela / wynajem / Mac Mini | 0–8 tys. zł |
| Tier 1 | mała firma, 1–5 os., RAG | 7–14B | 1 GPU (RTX 4090/5090) lub Mac Studio 64–128 GB | ~12–25 tys. zł |
| Tier 2 | średnia, więcej równoległości | 14–32B | 1–2 GPU pro (RTX 6000 Ada 48 GB) | ~30–60 tys. zł |
| Tier 3 | większa, wielu użytkowników | 70B+ | serwer 2–4 GPU / rack | 80 tys. zł+ |

## Stan zastany (co już jest — nie budować od zera)

- `service_catalog` (`lib/db.ts` ok. linii 977): **płaska tabela** — `id`,
  `nazwa`, `cena_netto` (JEDNA cena, bez widełek), `vat_stawka`, `jednostka`,
  `created_at`. Brak kategorii, brak min/max, brak dostawcy.
- `app/api/catalog/route.ts` + `[id]/route.ts` — REST katalogu usług.
- Katalog jest **wpięty w pozycje Ofert i Faktur** (picker pozycji). To ta
  ścieżka, którą trzeba re-użyć, nie budować drugą.

## Zakres do przedyskutowania z właścicielem PRZED budową (decyzje nietechniczne)

Właściciel nie programuje — **zadaj wprost, po polsku, każde z tych pytań** i
nie zakładaj domyślnych wartości tam, gdzie liczy się jego preferencja:

1. **Widełki czy jedna cena?** Sprzęt ma cenę „od–do" (zależną od
   konfiguracji/dostawcy). Czy komponent trzyma `cena_min`/`cena_max` (a przy
   ofercie właściciel wybiera konkret), czy jedną cenę bazową + narzut? To
   decyduje o kształcie tabeli.
2. **Kategorie komponentów** — proponowane: compute / GPU / storage / sieć /
   zasilanie (UPS) / software (licencje, wdrożenie) / robocizna / serwis. Czy
   ta lista pasuje, czy właściciel chce inną?
3. **Gotowe zestawy (Tier 1/2/3)** — czy chce zapisywać **złożone paczki**
   („Tier 1 = box + UPS + wdrożenie + 3 mies. serwisu") jako jeden wybór, czy
   składać zawsze ręcznie z pojedynczych komponentów? (To różnica: prosty
   katalog vs katalog + szablony zestawów.)
4. **Robocizna i serwis** — czy „umowa serwisowa/utrzymaniowa" to pozycja
   katalogu (powtarzalny przychód), czy osobny twór? (Sugestia: pozycja
   z jednostką „mies.".)
5. **Czy to jeden katalog z usługami, czy osobny?** `service_catalog` istnieje.
   Rozszerzamy go o kolumnę `rodzaj`/`kategoria` (jeden katalog, filtrowany),
   czy robimy `component_catalog` obok? (Sugestia: **rozszerzyć istniejący** —
   mniej dublowania, jeden picker.)
6. **Marża/narzut** — czy właściciel chce widzieć koszt zakupu vs cenę dla
   klienta (marża), czy tylko cenę sprzedaży? (Dane wrażliwe — jeśli tak,
   koszt zakupu **nie** może wyciec na publiczny wydruk oferty — patrz
   `lib/publicFields.ts`, Moduł 40.)

## Wskazówki architektoniczne (dla czatu wdrożeniowego)

- **Rozszerz `service_catalog`** przez `ALTER TABLE ... ADD COLUMN IF NOT
  EXISTS` w `lib/db.ts` (nigdy ręczna migracja; pamiętaj o bramce migracji —
  `schemaUpToDate`/`markSchemaApplied`). Kandydaci na kolumny: `kategoria`,
  `cena_min`, `cena_max`, `dostawca`, `koszt_zakupu` (jeśli decyzja 6 = tak),
  `opis`.
- **Re-użyj istniejącego pickera pozycji** Ofert/Faktur — komponent wpada jako
  pozycja tak samo jak usługa. Nie buduj drugiej ścieżki wstawiania.
- **Panel jednomotywowy ciemny**, ikony `@tabler/icons-react` (nie emoji),
  `Modal` wyśrodkowany, `useUI()` do toastów/potwierdzeń, paleta marki —
  wszystkie zasady z `CLAUDE.md`. Filtrowanie po kategorii wzorem `FilterPills`.
- **Ochrona tras:** każdy nowy `app/api/...` uchwyt zaczyna od
  `if (!(await isAuthed())) return 401` (nowa trasa jest domyślnie OTWARTA).
- **Wydruk oferty:** jeśli wejdzie `koszt_zakupu`/marża — **biała lista pól**
  w `lib/publicFields.ts` musi je wyciąć (nie mogą trafić do klienta).
- **Parytet apki** (`leggera-hub-ios`, osobne repo): jeśli katalog jest w apce,
  rozszerzenie o kategorie/widełki dotknie obu front-endów — krótki audyt
  drugiej platformy (zasada z Audytu 6/7).

## Czego ten moduł NIE ma robić

- **Nie prawdziwy magazyn ze stanami** (ilości na półce, zamówienia, dostawy) —
  to „wirtualny magazyn" = biblioteka pozycji cennikowych, nie system
  magazynowy. Jeśli właściciel chce stanów magazynowych, to osobny, większy
  zakres — dopytaj.
- **Nie automatyczny dobór sprzętu przez AI** — to katalog do ręcznego
  składania. (Ew. podpowiedź konfiguracji lokalnym Ollamą to osobny temat,
  zgodny z kierunkiem AI z Audytu 7, ale NIE w tym module.)
- **Nie integracja z dostawcami/API cen** — ceny wpisuje właściciel ręcznie.

## Środowisko i weryfikacja

`npm run dev` (PGlite + dev-login, `CLAUDE.md` → „Lokalne środowisko dev").
`npx tsc --noEmit -p tsconfig.json` + `npm test` po każdej paczce zmian.
Weryfikacja wizualna lokalnie (`preview_start name:"dev"`), bo dev-baza nie ma
pozycji katalogu — dołóż do `ensureSeeded()` w `lib/dev-db.ts` kilka przykładów
(sprzęt + usługa), inaczej ekran będzie pusty i nie zobaczysz kompozycji.

## Po zakończeniu

Aktualizuj `HUB_SETUP.md`, odhacz w `docs/plany-modulow/README.md`, zapisz
decyzje właściciela w pamięci. Podaj właścicielowi komendę do commita.
