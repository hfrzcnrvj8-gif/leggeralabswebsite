# Brief: apka dogania panel po dwóch planach zaplecza

**Powstał:** 2026-08-05, po zamknięciu `docs/PLAN-PO-DRUGIM-PRZEJSCIU.md`.
**Dotyczy repozytorium apki** (`../leggera-hub-ios`), nie panelu.
**Pilność:** średnia. Nic nie jest zepsute — brakuje ekranów do funkcji, które
w panelu działają i są przetestowane.

**Zastępuje** `36-brief-propozycje.md` jako punkt wejścia. Tamten zostaje
i jest dalej najlepszym opisem SAMEGO ekranu propozycji — ale powstał
2026-08-02, gdy reguły były trzy, a dziś jest ich sześć i jedna ma dwie drogi
wyjścia. Różnice wypisane niżej.

---

## Po co ten brief istnieje

Przez cztery kroki planu panel dostał funkcje, których apka nie zna. Za każdym
razem zapisywaliśmy „nie zrobione świadomie — to osobna robota po stronie
apki". Uzbierało się pięć pozycji z jednego obszaru, więc idą jednym czatem
zamiast pięcioma.

**Wszystko po stronie serwera jest gotowe.** Nie ma tu ani jednej rzeczy, którą
trzeba dobudować w panelu.

---

## Co NAPRAWDĘ jest do zrobienia (sprawdzone w kodzie apki 2026-08-05)

Kolejność = malejąca wartość. Pierwsze dwie pozycje to 80% pożytku.

| # | co | stan w apce | ile roboty |
|---|---|---|---|
| 1 | **Ekran „Propozycje"** | nie ma nic | duża |
| 2 | **Dwie nowe sekcje Pulpitu** | `PulpitDzis` ich nie dekoduje | mała |
| 3 | **Wybór poziomu windykacji** | apka wysyła zawsze podpowiadany | mała |
| 4 | **Karta „Odpowiedź na wersję N"** na ofercie | model ma `parentOfferID`, ale nie powód odmowy | mała |
| 5 | Rubryka „Wynika z" na fakturze | apka nie pokazuje źródeł faktury wcale | średnia, najmniej pilna |

### Czego NIE ma na tej liście, choć wcześniejsze notatki to sugerowały

Sprawdzone po kodzie i **odwołane** — nie rób tego:

- **Odrzucenie oferty przez klienta (C1) nie jest funkcją apki.** Apka jest
  narzędziem WŁAŚCICIELA; przycisk „Dziękuję, rezygnujemy" żyje na publicznej
  stronie oferty, którą otwiera klient w przeglądarce. Apka ma z tego widzieć
  wyłącznie SKUTEK — a skutek już widzi (patrz punkt niżej).
- **Nowy rodzaj powiadomienia `offer_rejected` nie wymaga niczego.** Apka nie
  mapuje rodzajów powiadomień na ikony (nie ma w niej ani jednego `case
  "lead_new"`), a oś czasu klienta zna `offer_rejected` od dawna —
  `Models/Client.swift:575`.
- **Hierarchia akcji na ofercie (D1) już jest poprawna.** `OfertyView.swift:575`
  i `:583` bramkują akcje po statusie (`szkic` → wyślij, `wysłana` → akceptuj),
  czyli apka robiła to dobrze, zanim panel się poprawił. **Nie „naprawiaj" tego
  na wzór panelu.**

To jest ta sama lekcja co zwykle: **dowodem luki jest kod apki, nie zapis
w cudzej notatce.** Trzy z ośmiu pozycji, które wpisałem do handoffu z pamięci
o panelu, po sprawdzeniu okazały się nieistniejące.

---

## 1. Ekran „Propozycje" — największy kawałek

Szczegółowy opis mechanizmu, kontraktu trasy i pułapek:
**`36-brief-propozycje.md`** — przeczytaj go w całości, jest aktualny co do
zasady. Poniżej wyłącznie to, co się od jego napisania ZMIENIŁO.

### Reguł jest sześć, nie trzy

| reguła | moduł | przycisk | drugi przycisk |
|---|---|---|---|
| `opinia-zamyka-projekt` | `projects` | Zamknij projekt | — |
| `wygrany-lead-bez-przypomnienia` | `leads` | Zdejmij przypomnienie | — |
| `oplacony-klient-aktywny` | `clients` | Przestaw na Aktywny | — |
| `faktura-wg-obowiazujacych-warunkow` | `invoices` | Dopisz pozycję | — |
| `odrzucona-oferta-domyka-leada` | `leads` | Zamknij lead | **Kontakt za 3 mies.** |
| `zerwany-projekt-domkniecie` | `projects` | Wstrzymaj projekt | — |

**Nie zaszywaj tej listy w apce.** Zdanie, napis na przycisku i link przychodzą
z serwera gotowe — apka ma je tylko narysować. Reguła dodana kiedyś w panelu ma
pojawić się w apce bez jej przebudowy.

### `akcjaAlt` — druga droga wyjścia (krok 4)

Nowe, opcjonalne pole w propozycji:

```json
{ "regula": "odrzucona-oferta-domyka-leada", "rekordId": "<uuid>",
  "modul": "leads", "zdanie": "Oferta dla X odrzucona (Za drogo) — …",
  "akcja": "Zamknij lead", "akcjaAlt": "Kontakt za 3 mies.",
  "link": "/pl/admin/leads/<uuid>" }
```

Gdy `akcjaAlt` jest obecne, propozycja ma **dwa** przyciski. Decyzja jedzie tym
samym `POST /api/hub/propozycje`, tylko z inną wartością:

| przycisk | `decyzja` |
|---|---|
| `akcja` | `"zrob"` |
| `akcjaAlt` | `"zrob-alt"` |
| „nie teraz" | `"odrzuc"` |
| cofnięcie „nie teraz" | `"przywroc"` |

Panel świadomie ma **maksymalnie dwie** drogi wyjścia — przy trzech pytanie
przestaje być pytaniem i staje się formularzem. Zbuduj widok tak, żeby drugi
przycisk był opcjonalny, ale **nie** rób z tego listy N akcji.

### Odpowiedź na decyzję niesie treść

`POST` oddaje `{ ok: true, komunikat: "…" }` — na przykład „Kontakt umówiony na
05.11.2026.". **Pokaż ten komunikat**, nie własne „Gotowe": to jedyne miejsce,
z którego właściciel dowie się, co dokładnie się stało. Odmowa (`409`) też ma
sensowną treść w `error` — propozycja mogła się zdezaktualizować między
wczytaniem a kliknięciem.

---

## 2. Dwie nowe sekcje Pulpitu (krok 4) — najtańsza pozycja

`GET /api/hub/today` zwraca dwa pola, których `PulpitDzis` nie dekoduje:

| pole JSON | co to jest | dlaczego osobna sekcja |
|---|---|---|
| `projektyZagrozone` | projekty ze zdrowiem „Zagrożony"/„Zerwany" | „Projekty z minionym terminem" ich **nie łapie**, bo termin jest w przyszłości — projekt psuje się, zanim spóźni |
| `zapomnianeSzkiceUmow` | umowy/aneksy w szkicu, które nigdy nie wyszły | `uspioneUmowy` (`staleContracts`) pokazuje WYSŁANE bez podpisu; szkic, o którym się zapomniało, nie pokazywał się nigdzie |

Kształt elementów jest ten sam co w sekcjach, które apka już rysuje
(`dueProjects` → `Projekt`, `staleContracts` → `PulpitUmowa`), więc nie trzeba
nowych modeli — wystarczy nowa właściwość na istniejącym typie.

> **Pułapka, przez którą to nie zadziała za pierwszym razem:** `PulpitDzis` ma
> **ręczny `init(from:)`** (`Models/Pulpit.swift`, ok. 456). Pole dodane jako
> `public var` i do `CodingKeys` **skompiluje się i zawsze będzie puste** — bez
> błędu, bez ostrzeżenia. **Nowe pole = trzy miejsca.** To jest dokładnie ten
> błąd, który w tym repo złapaliśmy już raz (pamięć: „Swift: opcjonalny var
> zawsze nil"). Trzymaj się tam wzorca `lista(_:)` / `decodeIfPresent` w `try?`,
> żeby zmiana kształtu po stronie panelu zabrała JEDNĄ sekcję, a nie Pulpit.

**To samo pole `propozycje` przychodzi tą samą trasą** — patrz punkt 1. Dla
Pulpitu nie trzeba ani jednego nowego żądania.

---

## 3. Wybór poziomu windykacji (krok 2)

**Stan dzisiejszy jest poprawny, tylko uboższy.** `APIClient.swift:2661` woła
`POST /api/invoices/<id>/remind` z pustym ciałem, a trasa ma to wprost opisane:
brak pola `poziom` = „wyślij podpowiadany". Nic nie jest zepsute — po prostu
z telefonu nie da się wysłać pisma łagodniejszego niż to, które panel proponuje
z dni zwłoki.

Skutek z drugiego przejścia: faktura 14 dni po terminie, do której nigdy nic nie
wysłano, dostawała **od razu stanowcze przypomnienie**; przy 48 dniach —
formalne wezwanie jako pierwszy kontakt w sprawie długu.

### Czego NIE trzeba: nowej trasy

**Dozwolone poziomy da się policzyć LOKALNIE**, z dwóch pól, które apka i tak
ma na fakturze (`termin_platnosci`, `reminder_level`). Reguła (panel:
`lib/invoices.ts` → `poziomyWindykacji`):

```
juzWyslany = clamp(reminder_level, 0, 3)
minimum    = max(1, juzWyslany)          // ręczne kliknięcie zawsze ≥ 1
zDni       = max(1, poziomZDniZwloki(daysOverdue))
sugerowany = max(minimum, zDni)
dozwolone  = [1,2,3].filter(>= minimum)
```

Przepisz to jako czystą funkcję w `LeggeraHubCore` **z testem**, obok tego, co
już tam jest. Serwer i tak sprawdzi wybór po swojemu i odmówi z czytelnym
komunikatem („Do klienta wyszło już »stanowcze przypomnienie« — nie da się
teraz wysłać łagodniejszego pisma."), więc lokalna kopia jest podpowiedzią,
a nie zabezpieczeniem.

Zasada, której nie wolno zgubić: **eskalacja nie cofa się poniżej poziomu,
który już wyszedł do klienta.**

### Potwierdzenie — już masz mechanizm

Wysyłka windykacji jest działaniem NIEODWRACALNYM: trasa bez nagłówka oddaje
**428** i opis. Apka umie to od `35-brief-potwierdzenia.md`
(`APIClient.wyslijNaURL`) — **nie dokładaj własnego okna „na pewno?"**.
Działania: `faktura-przypomnij` (poziomy 1–2) i `wezwanie-wyslij` (poziom 3).

---

## 4. Karta „Odpowiedź na wersję N" na ofercie (krok 5)

`GET /api/offers/<id>` oddaje od 2026-08-05 dodatkowe pole **`poprzednia`**
(obok `offer`, `items`, `sections`, `contract`, `bramka`):

```json
"poprzednia": { "id": "<uuid>", "tytul": "…", "wersja": 1,
  "status": "Odrzucona", "powod_odrzucenia": "Za drogo",
  "komentarz_odrzucenia": "Zarząd uciął budżet, chcą sam PoC",
  "odrzucona_at": "2026-08-05 12:31:00+01" }
```

`null`, gdy oferta nie ma poprzedniczki.

Sens: ekran, na którym piszesz ODPOWIEDŹ na odrzucenie, ma pokazywać
odrzucenie. Apka ma dziś `parentOfferID` (`Models/Finanse.swift:348`), ale nie
ma powodu odmowy poprzedniczki — a to jest jedyna rzecz, dla której się na tę
poprzedniczkę patrzy.

W panelu wygląda to tak (do skopiowania co do treści, nie co do wyglądu):

```
ODPOWIEDŹ NA WERSJĘ 1
Za drogo — Zarząd uciął budżet, chcą sam PoC
Klient odmówił 05.08.2026
[ Otwórz wersję 1 ]
```

Gdy poprzedniczka nie została odrzucona, tylko zastąpiona: „Poprzednia wersja
nie została odrzucona — zastąpiłeś ją sam."

**Przy okazji, gratis:** nowa wersja przenosi od kroku 5 komplet warunków
handlowych (termin realizacji, blok ROI, data ważności). Apka nic z tym nie
robi, ale gdyby gdzieś pokazywała „wersja 2 nie ma terminu" — to już nieprawda.

---

## 5. Rubryka „Wynika z" na fakturze (krok 3) — najmniej pilna

W panelu faktura ma rubrykę wymieniającą ofertę, umowę **oraz aneks**, z którego
pochodzą obowiązujące warunki (`InvoiceEditor.tsx:756`). Apka nie pokazuje
źródeł faktury **w ogóle**, więc to nie jest „dogonienie zmiany z kroku 3",
tylko nowa funkcja — stąd ostatnie miejsce.

Zrób ją tylko wtedy, gdy cztery pierwsze pozycje są skończone i sprawdzone.

---

## Jak pracować (skrót; reszta w README apki i `CLAUDE.md` panelu)

- **Nowy plik `.swift` wymaga `xcodegen`** — inaczej nie wejdzie do projektu.
- **DEBUG apki celuje w PRODUKCJĘ.** Nie testuj na niej rzeczy, które coś
  wysyłają do klienta. Windykacja wysyła MAILA — sprawdzaj na atrapie klienta
  z własnym adresem albo wcale.
- **Symulator: piksele kontra punkty** — nieudany tap to nie zepsuty przycisk;
  kliknij kontrolnie coś, co działało.
- Panel do rozmowy lokalnie: `npm run dev` w repo panelu + `PRZEJSCIE_URL`.
  Dev-baza to PGlite w pamięci procesu — restart serwera = czysta baza.
- Kończąc: `rm -f .git/index.lock && git add -A && git commit && git push`
  **w repozytorium apki**.

## Sprawdzenie

Dla każdej pozycji dowodem jest **zrzut z symulatora albo telefonu plus stan
w danych**, nie „kod wygląda dobrze":

1. Propozycje: lista z sześcioma regułami widoczna; propozycja z `akcjaAlt` ma
   DWA przyciski; „nie teraz" przeżywa restart apki (siedzi w bazie, nie
   w pamięci); komunikat z serwera pokazany dosłownie.
2. Pulpit: obie sekcje mają zawartość na dev-bazie po `npm run przejscie`
   (przejście zostawia zerwany projekt i zapomniany szkic umowy).
3. Windykacja: przy fakturze 14 dni po terminie da się wybrać poziom 1;
   po jego wysłaniu poziom 1 **znika** z listy dozwolonych.
4. Oferta wersji 2: karta pokazuje powód odrzucenia wersji 1.

Na koniec: **wynik do `docs/natywna-aplikacja/38-wynik-…`** w repo panelu, tak
jak przy poprzednich partiach, plus wpis w README apki.
