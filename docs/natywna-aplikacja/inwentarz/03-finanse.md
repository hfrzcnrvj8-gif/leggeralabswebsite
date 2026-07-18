# Inwentarz API — Faktury, Oferty, Umowy, KSeF, Koszty, Statystyki, Ustawienia

> Część inwentarza API panelu Leggera Hub dla natywnej aplikacji iOS.
> Dokument samowystarczalny — pisany do czytania w osobnym repo, bez dostępu
> do kodu backendu. Stan na 2026-07-19.
>
> **Konwencje wspólne dla wszystkich tras:**
> - Baza URL: produkcyjny panel (Vercel). Wszystkie trasy admin-only wymagają
>   nagłówka `Authorization: Bearer <token>` (patrz `00-uwierzytelnianie.md`);
>   brak/zły token → `401 {"error":"unauthorized"}`.
> - Trasy **publiczne** (`/public/[token]`) nie wymagają auth — losowy token
>   (32 znaki hex) w URL pełni rolę hasła-w-linku. Służą KLIENTOWI właściciela
>   (podgląd/e-podpis w przeglądarce), apka natywna ich nie woła.
> - Body zawsze JSON (wyjątek: upload załącznika kosztu = `multipart/form-data`).
> - Kwoty NUMERIC z bazy bywają zwracane jako stringi — trasy listowe zwykle
>   normalizują (`Number(...)`), ale apka powinna defensywnie parsować liczby.
> - Daty: pola DATE jako `"YYYY-MM-DD"` (czasem pełny ISO — obcinać do 10
>   znaków), znaczniki czasu jako ISO timestamptz.
> - Błędy: `{"error": "komunikat po polsku"}` z sensownym statusem HTTP
>   (400/404/409/500). Komunikaty nadają się do pokazania użytkownikowi 1:1.
> - PATCH-e są **częściowe per pole**: aktualizowane jest tylko to, co w body
>   (sprawdzane przez `"pole" in body`). Puste stringi w polach dat = NULL.
>
> **Poziomy w apce:**
> - **1** — pełna funkcja mobilnie. W tej grupie TYLKO ścieżka „koszt ze
>   zdjęcia paragonu" (utwórz koszt → wgraj zdjęcie → OCR → popraw → zapisz).
> - **2** — podgląd + lekkie akcje: faktury (podgląd, „opłacona",
>   przypomnienie, wysyłka), oferty/umowy (podgląd, wysyłka, oznacz
>   podpisaną/zaakceptowaną-lekko).
> - **3** — tylko desktop: wystawianie/edycja faktur, KSeF, korekty,
>   zaliczki, statystyki, konfiguracja, szablony, eksporty CSV.
> - **—** — trasa publiczna dla klienta końcowego, nie dla apki.

## Spis tras

| Metoda | Ścieżka | Po co | Poziom |
|---|---|---|---|
| GET | `/api/invoices` | Lista faktur z sumami i wpłatami | 2 |
| POST | `/api/invoices` | Nowa faktura-szkic | 3 |
| GET | `/api/invoices/[id]` | Faktura + pozycje + wpłaty + windykacja + korekty | 2 |
| PATCH | `/api/invoices/[id]` | Edycja nagłówka faktury | 3 |
| DELETE | `/api/invoices/[id]` | Usuń szkic (wystawionej nie wolno) | 3 |
| POST | `/api/invoices/[id]/issue` | „Wystaw fakturę" — numer, daty, status | 3 |
| POST | `/api/invoices/[id]/items` | Dodaj pozycję | 3 |
| PATCH | `/api/invoices/[id]/items/[itemId]` | Edytuj pozycję | 3 |
| DELETE | `/api/invoices/[id]/items/[itemId]` | Usuń pozycję | 3 |
| POST | `/api/invoices/[id]/payments` | Zarejestruj wpłatę (auto „Opłacona") | 2 |
| DELETE | `/api/invoices/[id]/payments/[paymentId]` | Usuń wpłatę | 2 |
| POST | `/api/invoices/[id]/remind` | Wyślij przypomnienie/wezwanie do zapłaty | 2 |
| POST | `/api/invoices/[id]/send` | Wyślij klientowi link do faktury mailem | 2 |
| POST | `/api/invoices/[id]/correct` | Utwórz fakturę korygującą (szkic) | 3 |
| POST | `/api/invoices/[id]/duplicate` | Duplikat / „przekształć proformę w FV" | 3 |
| GET | `/api/invoices/[id]/ksef/xml` | Wygeneruj XML FA(3) offline + walidacja | 3 |
| POST/GET | `/api/invoices/[id]/ksef/send` | Wyślij fakturę do KSeF (test) | 3 |
| GET | `/api/invoices/export` | Rejestr sprzedaży CSV dla księgowej | 3 |
| GET | `/api/invoices/public/[token]` | Publiczny podgląd faktury dla klienta | — |
| GET | `/api/invoices/wezwanie/public/[token]` | Publiczny podgląd wezwania do zapłaty | — |
| GET | `/api/offers` | Lista ofert z kwotą | 2 |
| POST | `/api/offers` | Nowa oferta-szkic (może awansować leada na klienta) | 3 |
| GET | `/api/offers/[id]` | Oferta + pozycje | 2 |
| PATCH | `/api/offers/[id]` | Edycja nagłówka oferty | 3 |
| DELETE | `/api/offers/[id]` | Usuń ofertę | 3 |
| POST | `/api/offers/[id]/items` | Dodaj pozycję | 3 |
| PATCH | `/api/offers/[id]/items/[itemId]` | Edytuj pozycję | 3 |
| DELETE | `/api/offers/[id]/items/[itemId]` | Usuń pozycję | 3 |
| POST | `/api/offers/[id]/send` | Wyślij klientowi link do oferty mailem | 2 |
| POST | `/api/offers/[id]/accept` | Akceptuj ofertę z panelu (tworzy projekt+fakturę) | 3 |
| POST | `/api/offers/[id]/apply-template` | Wstaw pozycje/uwagi z szablonu | 3 |
| POST | `/api/offers/[id]/duplicate` | Duplikat oferty | 3 |
| GET | `/api/offers/public/[token]` | Publiczny podgląd oferty | — |
| POST | `/api/offers/public/[token]/accept` | E-podpis klienta (akceptacja oferty) | — |
| GET | `/api/offer-templates` | Lista szablonów ofert | 3 |
| POST | `/api/offer-templates` | Nowy szablon oferty | 3 |
| PATCH | `/api/offer-templates/[id]` | Edycja szablonu | 3 |
| DELETE | `/api/offer-templates/[id]` | Usuń szablon | 3 |
| GET | `/api/contracts` | Lista umów + NDA | 2 |
| POST | `/api/contracts` | Nowa umowa (z oferty) / NDA (z leada) | 3 |
| GET | `/api/contracts/[id]` | Dokument | 2 |
| PATCH | `/api/contracts/[id]` | Edycja pól dokumentu | 3 |
| DELETE | `/api/contracts/[id]` | Usuń dokument | 3 |
| POST | `/api/contracts/[id]/send` | Wyślij link do podpisu mailem | 2 |
| POST | `/api/contracts/[id]/accept` | Oznacz jako podpisaną (ręcznie, w panelu) | 2 |
| GET | `/api/contracts/public/[token]` | Publiczny podgląd dokumentu | — |
| POST | `/api/contracts/public/[token]/accept` | E-podpis drugiej strony | — |
| GET/POST | `/api/ksef/auth/test` | Test uwierzytelnienia w KSeF (środowisko testowe) | 3 |
| GET | `/api/catalog` | Katalog usług/produktów | 3 |
| POST | `/api/catalog` | Dodaj pozycję katalogu | 3 |
| DELETE | `/api/catalog/[id]` | Usuń pozycję katalogu | 3 |
| GET | `/api/settings` | Dane firmy (sprzedawcy) | 3 |
| PATCH | `/api/settings` | Zapis danych firmy | 3 |
| GET | `/api/vies/[country]/[vat]` | Walidacja/autofill kontrahenta UE (VIES) | 3 |
| GET | `/api/mf/nip/[nip]` | Autofill kontrahenta PL (Biała Lista MF) | 3 |
| GET | `/api/costs` | Lista kosztów | 1 |
| POST | `/api/costs` | Nowy koszt (draft) | 1 |
| GET | `/api/costs/[id]` | Pojedynczy koszt | 1 |
| PATCH | `/api/costs/[id]` | Edycja kosztu (przelicza brutto) | 1 |
| DELETE | `/api/costs/[id]` | Usuń koszt | 1 |
| GET | `/api/costs/[id]/attachment` | Pobierz skan/PDF załącznika | 1 |
| POST | `/api/costs/[id]/attachment` | Wgraj skan/PDF (multipart) | 1 |
| DELETE | `/api/costs/[id]/attachment` | Usuń załącznik | 1 |
| POST | `/api/costs/[id]/ocr` | Odczyt paragonu lokalnym AI (Ollama) — propozycja pól | 1 |
| GET | `/api/costs/hints` | Podpowiedź duplikatu + kategorii/projektu (deterministyczna) | 1 |
| GET | `/api/costs/analytics` | Koszty per miesiąc × kategoria | 3 |
| GET | `/api/costs/export` | Rejestr zakupów CSV dla księgowej | 3 |
| POST | `/api/costs/import-ksef` | Import faktur zakupowych z KSeF (test) | 3 |
| GET | `/api/recurring-costs` | Lista szablonów kosztów cyklicznych | 3 |
| POST | `/api/recurring-costs` | Nowy szablon kosztu cyklicznego | 3 |
| PATCH | `/api/recurring-costs/[id]` | Edycja szablonu | 3 |
| DELETE | `/api/recurring-costs/[id]` | Usuń szablon | 3 |
| GET | `/api/stats` | Wskaźniki zdrowia biznesu (Pulpit-Statystyki) | 3 |

---

# Faktury

## GET /api/invoices
- **Po co**: Lista wszystkich faktur (szkice, wystawione, korekty, proformy, zaliczkowe) do widoku listy i KPI.
- **Auth**: admin-only.
- **Żądanie**: brak parametrów.
- **Odpowiedź**: `{ invoices: Invoice[] }` — każdy wiersz to pełny rekord `Invoice` (patrz Typy) plus wyliczone:
  - `netto`, `vat` (number) — sumy pozycji z rabatami,
  - `brutto` (number) — **kwota należności z TEGO dokumentu**: dla faktury rozliczeniowej (`rozlicza_zaliczke_id` ustawione) to pełna wartość MINUS brutto rozliczanej zaliczki (ile realnie zostało do zebrania); dla pozostałych pełna suma pozycji,
  - `zaplacono` (number) — suma zarejestrowanych wpłat.
- **Reguły biznesowe**: `brutto` tu jest świadomie INNE niż w eksporcie CSV (tam pełna wartość dokumentu). Sortowanie `created_at DESC`.
- **Poziom w apce**: 2.

## POST /api/invoices
- **Po co**: Tworzy nową fakturę-szkic (bez numeru, bez dat) — pusty dokument do dalszej edycji.
- **Auth**: admin-only.
- **Żądanie** (wszystko opcjonalne): `{ lead_id?, project_id?, client_id?, klient_nazwa?, klient_nip?, klient_adres?, typ_dokumentu?: "faktura"|"proforma"|"zaliczkowa" }`.
- **Odpowiedź**: `{ ok: true, id }`.
- **Reguły biznesowe**: przy podanym `lead_id` kopiuje nazwę firmy z leada i dziedziczy jego `client_id`; przy `project_id` dziedziczy `client_id` projektu (nie zakłada nowego klienta). Wstawia `domyslne_uwagi` z ustawień firmy. Dla `typ_dokumentu="zaliczkowa"` domyślnie `ceny_brutto=true` (zaliczka to naturalnie kwota brutto). Generuje `share_token` od razu. Szkic NIE trafia na oś czasu klienta (zdarzenie dopiero przy wystawieniu).
- **Poziom w apce**: 3.

## GET /api/invoices/[id]
- **Po co**: Pełne dane faktury do podglądu/edytora.
- **Auth**: admin-only.
- **Żądanie**: brak.
- **Odpowiedź**: `{ invoice: Invoice, items: InvoiceItem[], settings: CompanySettings|null, payments: InvoicePayment[], reminders: InvoiceReminder[], korekty: {id,numer,data_wystawienia,status}[], koryguje: {...,brutto}|null, zaliczka: {id,numer,status,ksef_status,ksef_numer,brutto}|null }`.
  - `korekty` — faktury korygujące wystawione DO tej faktury.
  - `koryguje` — oryginał, jeśli TA faktura jest korektą (z brutto do policzenia różnicy).
  - `zaliczka` — rozliczana faktura zaliczkowa, jeśli ta jest rozliczeniowa (kwota pozostała = brutto faktury − brutto zaliczki).
- **Poziom w apce**: 2 (podgląd; edycja pól — desktop).

## PATCH /api/invoices/[id]
- **Po co**: Częściowa edycja nagłówka faktury (dane nabywcy/odbiorcy, daty, waluta, język, uwagi, powiązania, pola korekty/zaliczki, status).
- **Auth**: admin-only.
- **Żądanie**: dowolny podzbiór pól: `klient_nazwa|nip|adres|ulica|kod|miasto|kraj|email`, `odbiorca_nazwa|ulica|kod|miasto|kraj`, `client_id|lead_id|project_id` (pusty string = odepnij, null), `przyczyna_korekty`, `rozlicza_zaliczke_id`, `zamowienie_wartosc` (number>0 albo null), `zamowienie_opis`, `typ_korekty` ("1"|"2"|"3"), `typ_dokumentu`, `uwagi`, `ceny_brutto` (bool), `waluta` ("PLN"|"EUR"|"USD"|"GBP"), `sposob_platnosci` ("przelew"|"gotowka"|"karta"), `jezyk` ("pl"|"en"|"de"), `status` (string z INVOICE_STATUSES), `data_wystawienia|data_sprzedazy|termin_platnosci` ("YYYY-MM-DD" walidowane `isPlausibleDateString`, "" = null, zły format → 400).
- **Odpowiedź**: `{ ok: true }`.
- **Reguły biznesowe**: brak walidacji przejść statusu po stronie serwera (UI pilnuje sensu) — apka nie powinna wymyślać własnych statusów. Daty MUSZĄ przechodzić walidację wiarygodności (rok 4-cyfrowy itd.).
- **Poziom w apce**: 3.

## DELETE /api/invoices/[id]
- **Po co**: Usuwa fakturę-SZKIC (kaskadowo pozycje).
- **Auth**: admin-only.
- **Odpowiedź**: `{ ok: true }` albo `400` z komunikatem.
- **Reguły biznesowe**: faktury z nadanym numerem NIE wolno usunąć (dziura w numeracji, art. 106e ustawy o VAT) → 400 „ustaw status Anulowana". Tylko szkice kasowalne.
- **Poziom w apce**: 3.

## POST /api/invoices/[id]/issue
- **Po co**: „Wystaw fakturę" — nadaje numer, uzupełnia daty, ustawia status „Wystawiona", pobiera kurs NBP dla walut obcych.
- **Auth**: admin-only.
- **Żądanie**: brak body.
- **Odpowiedź**: `{ ok: true, numer }` albo 400 z powodem.
- **Reguły biznesowe (kluczowe)**:
  - Numeracja nadawana DOPIERO tu (szkice nie zużywają numerów). Trzy osobne serie roczne wg prefiksu: `"FV n/rok"` (faktura i zaliczkowa), `"KOR n/rok"` (korekta), `"PF n/rok"` (proforma). Kolizje numerów łapie unikalny indeks + retry (max 5 prób).
  - Blokady 400: brak pozycji; korekta bez `przyczyna_korekty`; pozycja z ilością ≤ 0 (w korekcie pozycję się USUWA, nie zeruje).
  - Daty: `data_wystawienia` = dziś jeśli pusta, `data_sprzedazy` = data wystawienia, `termin_platnosci` = dziś + `domyslny_termin_dni` z ustawień.
  - Waluta ≠ PLN + płatnik VAT: pobiera średni kurs NBP sprzed **daty sprzedaży** (art. 31a ustawy o VAT) i zapisuje `kurs_nbp/kurs_nbp_data/kurs_nbp_tabela`; nieudany fetch nie blokuje. Ponowne wystawienie nie nadpisuje numeru ani kursu.
  - Loguje zdarzenie `invoice_issued` na osi klienta.
- **Poziom w apce**: 3.

## POST /api/invoices/[id]/items
- **Po co**: Dodaje pozycję do faktury (pustą albo od razu z danymi, np. z katalogu).
- **Auth**: admin-only.
- **Żądanie**: `{ nazwa?, cena_netto?, vat_stawka?, jednostka?, ilosc? }` — wszystko opcjonalne; domyślnie pusta nazwa, cena 0, VAT "23", ilość 1, jednostka wg języka faktury (pl "szt.", en "pcs.", de "Stk.").
- **Odpowiedź**: `{ ok: true, items: InvoiceItem[] }` (cała odświeżona lista).
- **Poziom w apce**: 3.

## PATCH /api/invoices/[id]/items/[itemId]
- **Po co**: Edytuje pojedyncze pola pozycji.
- **Auth**: admin-only.
- **Żądanie**: podzbiór: `nazwa` (≤500), `jednostka` (≤20), `ilosc` (number ≥ 0), `cena_netto` (number), `vat_stawka` (jedna z "23"|"8"|"5"|"0"|"zw"|"np"), `rabat_procent` (0–100, clampowane).
- **Odpowiedź**: `{ ok: true }`.
- **Poziom w apce**: 3.

## DELETE /api/invoices/[id]/items/[itemId]
- **Po co**: Usuwa pozycję faktury.
- **Auth**: admin-only. **Odpowiedź**: `{ ok: true }`.
- **Poziom w apce**: 3.

## POST /api/invoices/[id]/payments
- **Po co**: Rejestruje wpłatę (częściową lub pełną) na fakturę; pełne pokrycie automatycznie przestawia status na „Opłacona".
- **Auth**: admin-only.
- **Żądanie**: `{ kwota: number > 0, data?: "YYYY-MM-DD" }` (brak/zła data = dziś).
- **Odpowiedź**: `{ ok: true, payments: InvoicePayment[], status }` — `status` to stan faktury PO operacji.
- **Reguły biznesowe**: auto-„Opłacona" tylko ze statusów otwartych („Wystawiona"/„Po terminie") — nie nadpisuje „Anulowana"/„Szkic". Dla faktury ROZLICZENIOWEJ próg pełnej zapłaty = pełna wartość − brutto zaliczki. Częściowa wpłata nie zmienia statusu. Pełna zapłata loguje `invoice_paid` na osi klienta i dzwoni w Centrum powiadomień (dedupe per faktura).
- **Poziom w apce**: 2 — to jest mobilne „oznacz jako opłaconą" (wpłata na pełną kwotę).

## DELETE /api/invoices/[id]/payments/[paymentId]
- **Po co**: Usuwa błędnie zarejestrowaną wpłatę. Status faktury NIE cofa się automatycznie.
- **Auth**: admin-only. **Odpowiedź**: `{ ok: true }`.
- **Poziom w apce**: 2.

## POST /api/invoices/[id]/remind
- **Po co**: Ręcznie wysyła kolejny krok windykacji mailem do nabywcy.
- **Auth**: admin-only.
- **Żądanie**: brak body.
- **Odpowiedź**: `{ ok: true, level }` (1|2|3) albo 400: faktura niewystawiona / brak `klient_email`.
- **Reguły biznesowe (windykacja — Moduł 13)**:
  - Progi eskalacji wg dni po terminie: poziom 1 „Uprzejme przypomnienie" (+3 dni), 2 „Stanowcze przypomnienie" (+10), 3 „Wezwanie do zapłaty" (+21). Ręczne kliknięcie wysyła ZAWSZE przynajmniej poziom 1, nawet przed progiem. Ten sam mechanizm chodzi automatycznie w cronie dziennym.
  - Poziom 1/2: mail z linkiem publicznego podglądu faktury (`/pl/faktura/<share_token>`).
  - Poziom 3: formalne wezwanie — osobny token `wezwanie_share_token`, link `/pl/wezwanie/<token>`, referencja `WZ-<rok>-<6 znaków>`, opcjonalne odsetki ustawowe (tylko gdy `stawka_odsetek_ustawowych` ustawiona ręcznie w ustawieniach; proste odsetki roczne × dni/365). Ustawia `wezwanie_wystawiono_at`.
  - `reminder_level` na fakturze nigdy nie spada; każdy wysłany krok trafia do historii `invoice_reminders`.
  - Treść wezwania nosi notę „SZABLON — WYMAGA WERYFIKACJI PRAWNEJ" (firma jeszcze niezarejestrowana).
- **Poziom w apce**: 2.

## POST /api/invoices/[id]/send
- **Po co**: Wysyła klientowi mailem link do publicznego podglądu faktury.
- **Auth**: admin-only.
- **Żądanie**: brak body.
- **Odpowiedź**: `{ ok: true }` albo 400 (szkic / brak e-maila nabywcy).
- **Reguły biznesowe**: wymaga wystawionej faktury (numer). Generuje/reużywa `share_token`, link `/pl/faktura/<token>`. Loguje `invoice_sent` na osi klienta.
- **Poziom w apce**: 2.

## POST /api/invoices/[id]/correct
- **Po co**: Tworzy fakturę KORYGUJĄCĄ (szkic) do wystawionej faktury — kopiuje pozycje jako „stan po korekcie" do edycji; oryginał zostaje nienaruszony.
- **Auth**: admin-only.
- **Żądanie**: brak body.
- **Odpowiedź**: `{ ok: true, id }` (id nowej korekty) albo 400 gdy oryginał nie ma numeru.
- **Reguły biznesowe**: korekta dostaje `koryguje_id` = oryginał, kopiuje `typ_dokumentu` i `rozlicza_zaliczke_id` (żeby w KSeF wyszło KOR/KOR_ZAL/KOR_ROZ), daty i dane nabywcy. Numer z osobnej serii „KOR n/rok" dopiero przy wystawieniu. Wymaga uzupełnienia `przyczyna_korekty` przed wystawieniem.
- **Poziom w apce**: 3.

## POST /api/invoices/[id]/duplicate
- **Po co**: Kopiuje fakturę do nowego szkicu (dane nabywcy + pozycje; bez numeru, dat, wpłat). Także „Przekształć proformę w fakturę VAT".
- **Auth**: admin-only.
- **Żądanie**: `{ typ_dokumentu?: "faktura"|"proforma"|"zaliczkowa" }` — nadpisanie typu (proforma → faktura).
- **Odpowiedź**: `{ ok: true, id }`.
- **Reguły biznesowe**: świadomie NIE kopiuje `koryguje_id` ani `rozlicza_zaliczke_id` (duplikat = niezależny dokument); kopiuje `zamowienie_*` i `client_id`.
- **Poziom w apce**: 3.

## GET /api/invoices/[id]/ksef/xml
- **Po co**: Generuje dokument FA(3) XML z faktury — w pełni OFFLINE (nic nie wychodzi do MF) + lokalna walidacja reguł biznesowych.
- **Auth**: admin-only.
- **Żądanie**: query `?download=1` → surowy XML jako załącznik `FA3_<numer>.xml`; bez parametru → JSON.
- **Odpowiedź**: `{ xml: string, validation: { errors: string[], warnings: string[] } }` — komunikaty po polsku, `errors` blokują wysyłkę.
- **Poziom w apce**: 3.

## POST /api/invoices/[id]/ksef/send (oraz GET z `?send=1`)
- **Po co**: Realna wysyłka faktury FA(3) do KSeF przez sesję online — **wyłącznie środowisko TESTOWE** do czasu rejestracji firmy.
- **Auth**: admin-only.
- **Żądanie**: POST bez body. GET bez `?send=1` = tryb „na sucho": `{ dryRun: true, canSend, validation, xmlPreview, xmlLength }` bez ruchu do KSeF.
- **Odpowiedź** (realna wysyłka): `{ ok, status: "przyjeto"|"odrzucono"|"wyslano", env: "test", ksefNumber, statusCode, statusText, error?, hasUpo, sessionReference, invoiceReference, validation }`. Błędy walidacji → 400 `{ ok:false, stage:"walidacja", validation }`. Błąd po drodze → HTTP 200 z `{ ok:false, stage:"wysyłka", error }` (świadomie 200, żeby klient odczytał JSON).
- **Reguły biznesowe (KSeF)**:
  - Cykl życia na fakturze: `ksef_status` = `nie_wyslano` → `wyslano` (przetwarzane) → `przyjeto` (numer KSeF + UPO) / `odrzucono` (powód w `ksef_blad`).
  - `ksef_tryb` zapisywany jako `"test"`; produkcja technicznie zablokowana (bramka w konfiguracji env) do rejestracji firmy — patrz `PO_REJESTRACJI.md`.
  - Po przyjęciu zapisuje `ksef_qr` — link weryfikujący (KOD I) do kodu QR na wydruku (`https://qr-test.ksef.mf.gov.pl/...`).
  - Rodzaj dokumentu FA(3) wyznaczany automatycznie: VAT / ZAL (zaliczkowa) / ROZ (rozlicza zaliczkę) / KOR / KOR_ZAL / KOR_ROZ.
  - Walidacja blokuje m.in.: brak NIP/nazwy/adresu sprzedawcy, brak numeru (najpierw wystaw), proformę (dokument niefiskalny — nigdy do KSeF), fakturę walutową z VAT bez kursu NBP, korektę bez danych oryginału.
  - `maxDuration=60s` — wysyłka bywa długa; apka powinna mieć długi timeout.
- **Poziom w apce**: 3.

## GET /api/invoices/export
- **Po co**: Rejestr sprzedaży CSV dla księgowej (wystawione dokumenty z okresu; szkice pominięte).
- **Auth**: admin-only.
- **Żądanie**: query `?from=YYYY-MM-DD&to=YYYY-MM-DD` (domyślnie bieżący miesiąc).
- **Odpowiedź**: plik `text/csv` (attachment). Kolumny: Numer, Typ, Data wystawienia, Data sprzedaży, Termin płatności, Kontrahent, NIP, Kraj, Netto, VAT, Brutto, Waluta, Status, Numer KSeF, Rozlicza zaliczkę.
- **Reguły biznesowe**: kwoty = PEŁNE wartości z dokumentu (bez netowania zaliczek — inaczej niż `brutto` w GET /api/invoices).
- **Poziom w apce**: 3.

## GET /api/invoices/public/[token]
- **Po co**: Publiczny podgląd faktury dla KLIENTA (link z maila), renderowany na stronie `/pl/faktura/<token>`.
- **Auth**: **publiczna** — bez logowania; `share_token` w URL to hasło. Tylko faktury ze statusem ≠ „Szkic".
- **Odpowiedź**: `{ invoice, items, settings }` — z faktury usunięte wewnętrzne pola (`lead_id`, `project_id`, `last_reminder_at`).
- **Poziom w apce**: — (dla klienta końcowego).

## GET /api/invoices/wezwanie/public/[token]
- **Po co**: Publiczny podgląd formalnego wezwania do zapłaty (osobny dokument, osobny token).
- **Auth**: **publiczna** — `wezwanie_share_token`; widoczne dopiero gdy `wezwanie_wystawiono_at` ustawione.
- **Odpowiedź**: `{ invoice (z brutto, bez FK), settings }`.
- **Poziom w apce**: —.

---

# Oferty

## GET /api/offers
- **Po co**: Lista ofert do widoku listy/pipeline'u.
- **Auth**: admin-only.
- **Odpowiedź**: `{ offers: (Offer & { kwota: number })[] }` — `kwota` = suma pozycji (ilość × cena, bez VAT).
- **Reguły biznesowe**: oferta świadomie BEZ VAT — kwoty ogólne; VAT pojawia się dopiero na fakturze po akceptacji.
- **Poziom w apce**: 2.

## POST /api/offers
- **Po co**: Nowa oferta-szkic; może wejść z leada lub z gotowym klientem.
- **Auth**: admin-only.
- **Żądanie**: `{ lead_id?, client_id?, tytul?, klient_nazwa? }` (wszystko opcjonalne).
- **Odpowiedź**: `{ ok: true, id }`.
- **Reguły biznesowe (ważne)**: pierwsza oferta dla leada bez klienta **automatycznie awansuje leada na Klienta** (tworzy rekord w `clients`, spina `leads.client_id`, loguje `client_created`). Jawnie podany `client_id` wygrywa z leadem. Tytuł domyślny „Oferta — <firma>". Zdarzenie `offer_created` na osi klienta.
- **Poziom w apce**: 3.

## GET /api/offers/[id]
- **Po co**: Oferta + pozycje do podglądu/edytora.
- **Auth**: admin-only.
- **Odpowiedź**: `{ offer: Offer, items: OfferItem[] }` (ilosc/cena znormalizowane do number).
- **Poziom w apce**: 2.

## PATCH /api/offers/[id]
- **Po co**: Częściowa edycja nagłówka oferty.
- **Auth**: admin-only.
- **Żądanie**: podzbiór: `tytul`, `klient_nazwa|nip|adres|ulica|kod|miasto|kraj|email`, `client_id`/`lead_id` (pusty = null), `uwagi`, `status` (z OFFER_STATUSES), `jezyk` ("pl"|"en"|"de"), `wazna_do` ("YYYY-MM-DD", "" = null, zły format → 400).
- **Odpowiedź**: `{ ok: true }`.
- **Poziom w apce**: 3.

## DELETE /api/offers/[id]
- **Po co**: Usuwa ofertę (kaskadowo pozycje). Projekt/faktura utworzone przy akceptacji ZOSTAJĄ (samodzielne byty).
- **Auth**: admin-only. **Odpowiedź**: `{ ok: true }`.
- **Poziom w apce**: 3.

## POST /api/offers/[id]/items
- **Po co**: Dodaje pustą pozycję (nazwa z body, ilość 1, "szt.", cena 0).
- **Auth**: admin-only. **Żądanie**: `{ nazwa? }`. **Odpowiedź**: `{ ok: true, items: OfferItem[] }`.
- **Poziom w apce**: 3.

## PATCH /api/offers/[id]/items/[itemId]
- **Po co**: Edycja pozycji oferty. **Żądanie**: podzbiór `nazwa` (≤500), `jednostka` (≤20), `ilosc` (≥0), `cena` (number). **Odpowiedź**: `{ ok: true }`.
- **Auth**: admin-only. **Poziom w apce**: 3.

## DELETE /api/offers/[id]/items/[itemId]
- **Po co**: Usuwa pozycję. **Auth**: admin-only. **Odpowiedź**: `{ ok: true }`. **Poziom w apce**: 3.

## POST /api/offers/[id]/send
- **Po co**: Wysyła klientowi mailem link do publicznego podglądu oferty (z możliwością e-podpisu).
- **Auth**: admin-only.
- **Żądanie**: brak body.
- **Odpowiedź**: `{ ok: true, status }` albo 400 (brak `klient_email`).
- **Reguły biznesowe**: link `/pl/oferta/<share_token>`. Status „Szkic" → „Wysłana" (zamkniętych statusów nie rusza). Loguje `offer_sent`.
- **Poziom w apce**: 2.

## POST /api/offers/[id]/accept
- **Po co**: „Akceptuj ofertę" z panelu (np. klient potwierdził telefonicznie) — automatycznie tworzy PROJEKT + FAKTURĘ-szkic.
- **Auth**: admin-only.
- **Żądanie**: `{ template?: string, confirmExpired?: boolean }` — `template` = id szablonu projektu (kamienie milowe/zadania), `confirmExpired=true` pozwala świadomie zaakceptować przeterminowaną ofertę.
- **Odpowiedź**: `{ ok: true, projectId, invoiceId }`; błędy: 400 już zaakceptowana / brak pozycji, 409 przeterminowana (`{ error, expired: true }` — ponów z `confirmExpired`) lub przegrany wyścig o akceptację.
- **Reguły biznesowe (wspólne z publicznym e-podpisem)**: wszystko w JEDNEJ transakcji SQL: projekt (status „Pomysł", opcjonalnie z szablonu z kamieniami/zadaniami) + checklista onboardingowa + faktura-szkic z pozycjami skopiowanymi 1:1 (VAT domyślnie "23") + „claim" oferty (`WHERE status != 'Zaakceptowana'` chroni przed podwójnym kliknięciem) + lead → „Zamknięte - sukces". Zdarzenie `offer_accepted` na osi klienta. Brak `accepted_by_name` = akceptacja ręczna w panelu.
- **Poziom w apce**: 3.

## POST /api/offers/[id]/apply-template
- **Po co**: Wstawia pozycje i uwagi szablonu oferty do istniejącej oferty (dopisuje na końcu; uwagi doklejane pod istniejącymi). Czysta kopia — bez trwałego powiązania z szablonem.
- **Auth**: admin-only.
- **Żądanie**: `{ template_id: string }` (wymagane → 400).
- **Odpowiedź**: `{ ok: true, items: OfferItem[], offer }`.
- **Poziom w apce**: 3.

## POST /api/offers/[id]/duplicate
- **Po co**: Kopiuje ofertę do nowego szkicu (dane klienta + pozycje; bez ważności, statusu, powiązań projekt/faktura, share_tokenu).
- **Auth**: admin-only. **Odpowiedź**: `{ ok: true, id }`. Loguje `offer_created` (duplikat).
- **Poziom w apce**: 3.

## GET /api/offers/public/[token]
- **Po co**: Publiczny podgląd oferty dla klienta (strona `/pl/oferta/<token>`).
- **Auth**: **publiczna** — share_token; tylko oferty ≠ „Szkic".
- **Odpowiedź**: `{ offer (bez lead_id/project_id/invoice_id), items, settings }`.
- **Poziom w apce**: —.

## POST /api/offers/public/[token]/accept
- **Po co**: E-podpis KLIENTA — klient akceptuje ofertę sam, przez link.
- **Auth**: **publiczna** (token w URL).
- **Żądanie**: `{ name: string }` (imię i nazwisko podpisującego, wymagane).
- **Odpowiedź**: `{ ok: true, acceptedByName }` / błędy jak w adminowej akceptacji, ale **NIGDY nie omija wygaśnięcia** (klient nie „ożywi" starej oferty).
- **Reguły biznesowe**: ta sama transakcja co wyżej + zapis dowodu oświadczenia woli (`accepted_by_name`, `accepted_ip` z X-Forwarded-For, `accepted_user_agent`). Dzwoni w Centrum powiadomień (`offer_accepted`) — jedyne miejsce, bo klient może kliknąć o dowolnej porze.
- **Poziom w apce**: — (ale apka powinna umieć POKAZAĆ powiadomienie o akceptacji z centrum powiadomień).

---

# Szablony ofert

## GET /api/offer-templates
- **Po co**: Lista szablonów ofert (gotowe szkielety pozycji + domyślne uwagi).
- **Auth**: admin-only.
- **Odpowiedź**: `{ templates: OfferTemplate[] }` — `pozycje` to tablica JSONB (parsowana serwerowo).
- **Poziom w apce**: 3.

## POST /api/offer-templates
- **Po co**: Nowy szablon.
- **Auth**: admin-only.
- **Żądanie**: `{ nazwa? (domyślnie "Nowy szablon"), opis?, uwagi?, pozycje?: {nazwa, ilosc, jednostka, cena}[] }`.
- **Odpowiedź**: `{ ok: true, id }`.
- **Poziom w apce**: 3.

## PATCH /api/offer-templates/[id]
- **Po co**: Edycja szablonu. **Żądanie**: podzbiór `nazwa` (≤200), `opis` (≤500), `uwagi` (≤4000), `pozycje` (cała tablica nadpisywana). **Odpowiedź**: `{ ok: true }`.
- **Auth**: admin-only. **Poziom w apce**: 3.

## DELETE /api/offer-templates/[id]
- **Po co**: Usuwa szablon. **Auth**: admin-only. **Odpowiedź**: `{ ok: true }`. **Poziom w apce**: 3.

---

# Umowy i NDA

Jedna tabela dla obu typów (`typ: "umowa" | "nda"`). Treść klauzul jest STAŁA
(jeden szablon prawny, tylko po polsku, z notą „SZABLON — WYMAGA WERYFIKACJI
PRAWNEJ" na każdym dokumencie); per rekord zmienne są tylko pola: zakres prac,
cena, waluta, termin, dane klienta. Referencja dokumentu (do wyświetlenia)
liczona z id/roku: `UM-2026-XXXXXX` / `NDA-2026-XXXXXX` — bez numeracji fiskalnej.

## GET /api/contracts
- **Po co**: Lista wszystkich umów i NDA.
- **Auth**: admin-only.
- **Odpowiedź**: `{ contracts: Contract[] }` (uwaga: `cena` może być stringiem NUMERIC — parsować).
- **Reguła dla apki**: licznik „ciszy" — dokument w statusie „Wysłana" z `sent_at` starszym niż **7 dni** uznaje się za wiszący (Pulpit o nim przypomina). Dni ciszy = floor((now − sent_at)/24h).
- **Poziom w apce**: 2.

## POST /api/contracts
- **Po co**: Nowy dokument-szkic. Umowa zwykle generowana z ZAAKCEPTOWANEJ oferty; NDA zwykle z leada; oba dopuszczają wariant wolnostojący.
- **Auth**: admin-only.
- **Żądanie**: `{ typ: "umowa"|"nda" (domyślnie umowa), offer_id? (dla umowy), lead_id? (dla NDA), klient_nazwa? (wolnostojące) }`.
- **Odpowiedź**: `{ ok: true, id }`.
- **Reguły biznesowe**: umowa z `offer_id`: oferta musi być „Zaakceptowana" (inaczej 409); kopiuje dane klienta, `zakres_prac` z listy pozycji („- nazwa (ilość jednostka)"), `cena` = suma pozycji, `jezyk` z oferty; jeśli umowa dla tej oferty już istnieje — zwraca JEJ id (bez duplikatu). NDA z `lead_id`: kopiuje dane firmy z leada; język NDA zawsze "pl".
- **Poziom w apce**: 3.

## GET /api/contracts/[id]
- **Po co**: Pojedynczy dokument. **Auth**: admin-only. **Odpowiedź**: `{ contract: Contract }` (`cena` znormalizowana do number).
- **Poziom w apce**: 2.

## PATCH /api/contracts/[id]
- **Po co**: Edycja pól dokumentu, w tym powiązań CRM.
- **Auth**: admin-only.
- **Żądanie**: podzbiór: `client_id|lead_id|project_id|offer_id` (pusty = odepnij), `klient_nazwa|nip|ulica|kod|miasto|kraj|email`, `zakres_prac` (≤4000), `uwagi` (≤2000), `waluta`, `cena` (number), `status` (z CONTRACT_STATUSES), `jezyk` ("pl"|"en"|"de"), `termin_realizacji` (data, "" = null).
- **Odpowiedź**: `{ ok: true }`.
- **Poziom w apce**: 3.

## DELETE /api/contracts/[id]
- **Po co**: Usuwa dokument. **Auth**: admin-only. **Odpowiedź**: `{ ok: true }`. **Poziom w apce**: 3.

## POST /api/contracts/[id]/send
- **Po co**: Wysyła drugiej stronie mailem link do publicznego podglądu i e-podpisu.
- **Auth**: admin-only.
- **Żądanie**: brak body.
- **Odpowiedź**: `{ ok: true, status }` albo 400 (brak `klient_email`).
- **Reguły biznesowe**: link `/pl/umowa/<token>` albo `/pl/nda/<token>` wg typu. „Szkic" → „Wysłana". `sent_at` ustawiany przy KAŻDEJ wysyłce (restart licznika ciszy). Loguje `contract_sent`.
- **Poziom w apce**: 2.

## POST /api/contracts/[id]/accept
- **Po co**: „Oznacz jako podpisaną" z panelu (np. podpis papierowy).
- **Auth**: admin-only.
- **Żądanie**: brak body.
- **Odpowiedź**: `{ ok: true }`; 409 gdy już podpisana.
- **Reguły biznesowe**: brak `accepted_by_name` = oznaczono ręcznie (odróżnialne od e-podpisu klienta). Loguje `contract_signed`. Nie dzwoni w powiadomieniach (właściciel sam kliknął).
- **Poziom w apce**: 2.

## GET /api/contracts/public/[token]
- **Po co**: Publiczny podgląd dokumentu dla drugiej strony.
- **Auth**: **publiczna** — share_token; tylko dokumenty ≠ „Szkic".
- **Odpowiedź**: `{ contract (bez FK: lead/client/project/offer), settings }`.
- **Poziom w apce**: —.

## POST /api/contracts/public/[token]/accept
- **Po co**: E-podpis drugiej strony przez publiczny link.
- **Auth**: **publiczna**.
- **Żądanie**: `{ name: string }` (wymagane).
- **Odpowiedź**: `{ ok: true, acceptedByName }`; 409 gdy już podpisana.
- **Reguły biznesowe**: zapisuje imię + IP + user-agent jako dowód; „claim"-UPDATE chroni przed podwójnym podpisem. Loguje `contract_signed` i dzwoni w Centrum powiadomień (podpis może paść w nocy).
- **Poziom w apce**: — (powiadomienie o podpisie apka pokazuje z centrum powiadomień).

---

# KSeF — uwierzytelnianie

## GET/POST /api/ksef/auth/test
- **Po co**: Diagnostyka — pełen handshake uwierzytelnienia na środowisku **TESTOWYM** KSeF; potwierdza, że konfiguracja (token/certyfikat w env Vercela) działa.
- **Auth**: admin-only.
- **Żądanie**: brak.
- **Odpowiedź**: `{ ok: true, env: "test", referenceNumber, status, hasAccessToken, hasRefreshToken }` — świadomie NIE zwraca surowych tokenów. Błąd → 400 `{ ok:false, error }`.
- **Reguły biznesowe**: bramka test/prod w konfiguracji serwera — produkcja niedostępna do rejestracji firmy.
- **Poziom w apce**: 3.

---

# Katalog usług

## GET /api/catalog
- **Po co**: Zapisane pozycje katalogu (usługi/produkty) do szybkiego wstawiania na fakturę.
- **Auth**: admin-only. **Odpowiedź**: `{ items: CatalogItem[] }` (sortowane po nazwie).
- **Poziom w apce**: 3.

## POST /api/catalog
- **Po co**: Dodaje pozycję katalogu.
- **Auth**: admin-only.
- **Żądanie**: `{ nazwa (wymagane, ≤500), cena_netto?, vat_stawka? (domyślnie "23"), jednostka? (domyślnie "szt.") }`.
- **Odpowiedź**: `{ ok: true, id, items: CatalogItem[] }`.
- **Poziom w apce**: 3.

## DELETE /api/catalog/[id]
- **Po co**: Usuwa pozycję katalogu; faktury, które z niej korzystały, są nietknięte (pozycje faktur to niezależne kopie).
- **Auth**: admin-only. **Odpowiedź**: `{ ok: true }`. **Poziom w apce**: 3.

---

# Ustawienia firmy

## GET /api/settings
- **Po co**: Dane firmy-sprzedawcy (singleton `id='default'`): nazwa, NIP, adres, konto, tryb VAT, domyślne wartości dokumentów, stawki rezerwy podatkowej.
- **Auth**: admin-only. **Odpowiedź**: `{ settings: CompanySettings | null }`.
- **Poziom w apce**: 3 (choć apka może potrzebować odczytu np. `vat_payer` do renderowania podglądów).

## PATCH /api/settings
- **Po co**: Zapis danych firmy (częściowy, per pole).
- **Auth**: admin-only.
- **Żądanie**: podzbiór pól `CompanySettings`: `nazwa, nip, adres, ulica, kod, miasto, kraj, email, telefon, konto, bank_nazwa, swift, zwolnienie_podstawa, domyslne_uwagi` (stringi z limitami), `vat_payer` (bool), `domyslny_termin_dni` (0–365, domyślnie 14), `stawka_odsetek_ustawowych` (0–100 albo null — null = wezwania bez odsetek; panel NIGDY nie liczy „domyślnej" stawki sam), `rezerwa_vat_procent|rezerwa_pit_procent|rezerwa_zus_procent` (0–100).
- **Odpowiedź**: `{ ok: true, settings }` (stan po zapisie).
- **Reguły biznesowe**: `vat_payer=false` = zwolnienie z VAT — faktury bez VAT, na wydruku `zwolnienie_podstawa` (domyślnie „art. 113 ust. 1 ustawy o VAT"). Rezerwa podatkowa (3 stawki % od netto) to pomoc poglądowa „ile odłożyć", nie automat księgowy.
- **Poziom w apce**: 3.

---

# Lookupy kontrahentów

## GET /api/vies/[country]/[vat]
- **Po co**: Walidacja numeru VAT-UE + autouzupełnienie nazwy/adresu kontrahenta z UE przez VIES (proxy do API Komisji Europejskiej).
- **Auth**: admin-only.
- **Żądanie**: `country` = 2-literowy kod UE (osobliwości: EL = Grecja, XI = Irlandia Płn.; PL się tu NIE używa — dla PL jest Biała Lista), `vat` = numer bez prefiksu.
- **Odpowiedź**: `{ subject: { valid: true, nazwa, ulica, kod, miasto, kraj } }`; 502 błąd połączenia/zły format; 404 numer nieaktywny.
- **Reguły biznesowe**: część krajów (np. DE) suppresuje nazwę/adres („---" → puste stringi) — walidacja działa zawsze, autofill zależnie od kraju; puste pola nie powinny kasować danych wpisanych ręcznie.
- **Poziom w apce**: 3.

## GET /api/mf/nip/[nip]
- **Po co**: Autouzupełnienie danych kontrahenta polskiego z „Białej listy podatników VAT" MF (nazwa, adres, status VAT, numery kont).
- **Auth**: admin-only.
- **Żądanie**: `nip` = 10 cyfr (myślniki/spacje tolerowane).
- **Odpowiedź**: `{ subject: { nazwa, ulica, kod, miasto, statusVat: string|null, numeryKont: string[] } }`; 404 nie znaleziono.
- **Reguły biznesowe**: `numeryKont` służy do weryfikacji konta dostawcy przy kosztach — przelew >15 000 zł na konto spoza Białej Listy grozi utratą kosztu podatkowego (miękkie ostrzeżenie w UI, nic nie blokuje).
- **Poziom w apce**: 3.

---

# Koszty (poziom 1 — jedyna pełna funkcja mobilna w tej grupie)

Ścieżka mobilna „koszt ze zdjęcia paragonu": `POST /api/costs` (pusty draft) →
`POST /api/costs/[id]/attachment` (zdjęcie z aparatu) → `POST /api/costs/[id]/ocr`
(propozycja pól z lokalnego AI) → użytkownik poprawia → `PATCH /api/costs/[id]`
(zapis) — model NIGDY nie zapisuje nic sam.

## GET /api/costs
- **Po co**: Lista kosztów (faktur przychodzących/wydatków) z nazwą podpiętego projektu.
- **Auth**: admin-only.
- **Odpowiedź**: `{ costs: Cost[] }` — bez `zalacznik_dane` (tylko `zalacznik_nazwa/typ`), z `project_tytul`. Sortowanie po dacie wydatku malejąco. Uwaga: lista NIE zwraca `client_id`/`lead_id` (te tylko w GET /api/costs/:id).
- **Reguły biznesowe**: koszty wyłącznie w PLN (v1).
- **Poziom w apce**: 1.

## POST /api/costs
- **Po co**: Tworzy nowy koszt-draft (reszta pól przez PATCH).
- **Auth**: admin-only.
- **Żądanie** (wszystko opcjonalne): `{ dostawca_nazwa?, kategoria? (z COST_CATEGORIES, domyślnie "Inne"), vat_stawka? (domyślnie "23"), kwota_netto?, project_id? }`.
- **Odpowiedź**: `{ ok: true, id }`.
- **Reguły biznesowe**: `kwota_brutto` liczona serwerowo z netto+stawki. Status startowy „Nieopłacony".
- **Poziom w apce**: 1.

## GET /api/costs/[id]
- **Po co**: Pojedynczy koszt do edytora (pełne pola, w tym `client_id`/`lead_id`; bez danych binarnych załącznika).
- **Auth**: admin-only. **Odpowiedź**: `{ cost: Cost }`.
- **Poziom w apce**: 1.

## PATCH /api/costs/[id]
- **Po co**: Częściowa edycja kosztu.
- **Auth**: admin-only.
- **Żądanie**: podzbiór: `dostawca_nazwa` (≤300), `dostawca_nip` (≤30), `opis` (≤2000), `kategoria` (z COST_CATEGORIES), `project_id` (pusty = null), `client_id`/`lead_id` (relacja WYŁĄCZNA — ustawiany co najwyżej jeden; wysyłać oba pola razem, serwer zapisuje oba naraz), `metoda_platnosci` ("przelew"|"karta"|"gotowka"|"blik"|"paypal"|"apple_pay" albo null), `dostawca_konto` (≤40), `numer_faktury` (≤100), `vat_odliczenie_procent` (100|50|0), `duplikat_potwierdzony` (bool), `data_wydatku` (wymagana niepusta poprawna data), `data_platnosci`/`data_wplywu` (data albo "" = null), `kwota_netto` (number), `vat_stawka` (z VAT_RATES), `status` ("Nieopłacony"|"Opłacony").
- **Odpowiedź**: `{ ok: true }`.
- **Reguły biznesowe**: zmiana netto/stawki **przelicza brutto serwerowo**; status → „Opłacony" auto-ustawia `data_platnosci` na dziś, jeśli pusta. `vat_odliczenie_procent`: 100 pełne / 50 samochód mieszany / 0 reprezentacja — wybiera właściciel, panel nic nie zgaduje. `duplikat_potwierdzony=true` wycisza ostrzeżenie o duplikacie z /hints.
- **Poziom w apce**: 1.

## DELETE /api/costs/[id]
- **Po co**: Usuwa koszt — zawsze dozwolone (to nie dokument z numeracją fiskalną).
- **Auth**: admin-only. **Odpowiedź**: `{ ok: true }`. **Poziom w apce**: 1.

## GET /api/costs/[id]/attachment
- **Po co**: Serwuje zapisany skan/PDF załącznika (inline, do podglądu).
- **Auth**: admin-only (załącznik kosztu nie ma publicznego linku).
- **Odpowiedź**: surowe bajty z `Content-Type` pliku i `Content-Disposition: inline`; 404 gdy brak załącznika.
- **Poziom w apce**: 1.

## POST /api/costs/[id]/attachment
- **Po co**: Upload skanu/zdjęcia/PDF faktury od dostawcy.
- **Auth**: admin-only.
- **Żądanie**: `multipart/form-data`, pole `file`. Dozwolone typy: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`. Limit **8 MB** (zdjęcie z iPhone'a warto skompresować przed wysyłką).
- **Odpowiedź**: `{ ok: true, zalacznik_nazwa, zalacznik_typ }`; 400 zły typ/za duży/brak pliku.
- **Reguły biznesowe**: nadpisuje poprzedni załącznik (jeden na koszt); przechowywany base64 w wierszu bazy.
- **Poziom w apce**: 1 — kluczowy krok ścieżki „paragon ze zdjęcia".

## DELETE /api/costs/[id]/attachment
- **Po co**: Usuwa załącznik (koszt zostaje). **Auth**: admin-only. **Odpowiedź**: `{ ok: true }`. **Poziom w apce**: 1.

## POST /api/costs/[id]/ocr
- **Po co**: Odczytuje wgrany załącznik modelem wizyjnym (lokalna Ollama na Macu właściciela, model `qwen3-vl:8b`) i zwraca PROPOZYCJĘ pól formularza. **Nigdy nic nie zapisuje do bazy** — właściciel widzi sugestie, poprawia i zapisuje ręcznie PATCH-em. To jedyny dopuszczony wyjątek od zasady „zero AI w panelu": model zawsze proponuje, człowiek zatwierdza; wyłącznie lokalny model, nigdy chmurowe API.
- **Auth**: admin-only.
- **Żądanie**: brak body (czyta załącznik kosztu; PDF → render pierwszej strony do PNG).
- **Odpowiedź**: `{ suggestion: OcrSuggestion }` (patrz Typy). Pola, które nie przeszły walidacji (NIP ≠ 10 cyfr, konto ≠ polski IBAN 26 cyfr, niewiarygodna data), wracają puste/null — nigdy śmieciowa wartość. Stawka VAT dopasowywana matematycznie do pary netto/brutto z dokumentu.
- **Błędy**: 400 brak załącznika; 422 nieudany PDF/nieznany typ; **503 „Model AI niedostępny"** — Ollama offline; apka pokazuje „wpisz ręcznie", ścieżka działa dalej bez AI.
- **Uwaga wydajnościowa**: timeout serwera 100 s (`maxDuration=120`) — model wizyjny odpowiada wolno; apka potrzebuje długiego timeoutu i wyraźnego stanu „czytam paragon…".
- **Poziom w apce**: 1 — serce funkcji mobilnej.

## GET /api/costs/hints
- **Po co**: Dwie miękkie, w pełni deterministyczne podpowiedzi do edytora kosztu (zero AI): ryzyko duplikatu + kategoria/projekt znanego dostawcy.
- **Auth**: admin-only.
- **Żądanie**: query `?nip=<10 cyfr>&excludeId=<id edytowanego kosztu>&kwota=<brutto>&data=<YYYY-MM-DD>` (nip wymagany — inaczej oba null).
- **Odpowiedź**: `{ duplicate: { id, dostawca_nazwa, kwota_brutto, data_wydatku } | null, suggestion: { kategoria, project_id, project_tytul } | null }`.
- **Reguły biznesowe**: `duplicate` = inny koszt tego samego NIP z tą samą kwotą brutto (±0,01) i datą w oknie ±3 dni, o ile nie wyciszony (`duplikat_potwierdzony`). Nic nie blokuje — tylko informuje.
- **Poziom w apce**: 1 (warto pokazać przy zapisie kosztu z paragonu).

## GET /api/costs/analytics
- **Po co**: Suma kosztów brutto per miesiąc × kategoria do wykresu (ostatnie N miesięcy).
- **Auth**: admin-only.
- **Żądanie**: query `?months=6` (1–24, domyślnie 6).
- **Odpowiedź**: `{ months: "YYYY-MM"[], categories: CostCategory[], byCategory: Record<kategoria, number[]> }` — tablice równoległe do `months`; kategorie spoza listy sumowane do „Inne".
- **Poziom w apce**: 3.

## GET /api/costs/export
- **Po co**: Rejestr zakupów CSV dla księgowej (koszty z okresu wg daty wydatku).
- **Auth**: admin-only.
- **Żądanie**: query `?from=&to=` (domyślnie bieżący miesiąc).
- **Odpowiedź**: `text/csv` attachment. Kolumny m.in.: Dostawca, NIP, Nr faktury, Kategoria, Netto, VAT (stawka), Kwota VAT, **VAT do odliczenia** (kwota VAT × `vat_odliczenie_procent`), Brutto, Status, Metoda płatności, Nr konta dostawcy.
- **Poziom w apce**: 3.

## POST /api/costs/import-ksef
- **Po co**: Pobiera z KSeF (środowisko TESTOWE) faktury zakupowe, gdzie firma jest nabywcą, i tworzy z nich wpisy w Kosztach z oryginalnym XML jako załącznikiem.
- **Auth**: admin-only.
- **Żądanie**: `{ from?: "YYYY-MM-DD", to?: "YYYY-MM-DD" }` (domyślnie bieżący miesiąc; KSeF max 3 miesiące na zapytanie).
- **Odpowiedź**: `{ ok: true, env, found, imported, skipped, errors: string[], range: {from,to} }`; błąd → 200 z `{ ok:false, error }`.
- **Reguły biznesowe**: dedup po `ksef_numer` (już zaimportowane pomijane). Koszt rodzi się z kategorią „Inne", statusem „Nieopłacony", stawką VAT odgadniętą z kwot (etykieta poglądowa do poprawienia). `maxDuration=60`.
- **Poziom w apce**: 3.

---

# Koszty cykliczne

Szablony abonamentów/subskrypcji — dzienny cron tworzy z nich SZKICE kosztów,
gdy nadejdzie `next_run`; właściciel i tak ręcznie sprawdza/opłaca.

## GET /api/recurring-costs
- **Po co**: Lista szablonów. **Auth**: admin-only. **Odpowiedź**: `{ recurring: RecurringCost[] }` (aktywne najpierw, potem wg `next_run`).
- **Poziom w apce**: 3.

## POST /api/recurring-costs
- **Po co**: Nowy szablon.
- **Auth**: admin-only.
- **Żądanie**: `{ nazwa?, dostawca_nazwa?, dostawca_nip?, kategoria? (domyślnie "Subskrypcje"), kwota_netto?, vat_stawka? ("23"), cykl? (z RECURRING_CYCLES, domyślnie "miesiecznie"), next_run? ("YYYY-MM-DD", domyślnie dziś) }`.
- **Odpowiedź**: `{ ok: true, id }`. Startuje jako `active: true`.
- **Poziom w apce**: 3.

## PATCH /api/recurring-costs/[id]
- **Po co**: Edycja szablonu. **Żądanie**: podzbiór: `nazwa, dostawca_nazwa, dostawca_nip, dostawca_konto, opis, kategoria, kwota_netto, vat_stawka, metoda_platnosci, project_id, cykl, next_run, active`. **Odpowiedź**: `{ ok: true }`.
- **Auth**: admin-only. **Poziom w apce**: 3.

## DELETE /api/recurring-costs/[id]
- **Po co**: Usuwa szablon (już wygenerowane koszty zostają). **Auth**: admin-only. **Odpowiedź**: `{ ok: true }`. **Poziom w apce**: 3.

---

# Statystyki

## GET /api/stats
- **Po co**: Wskaźniki zdrowia biznesu na Pulpit-Statystyki — czyste agregacje SQL po istniejących danych (leady, projekty, faktury, klienci, czas pracy). Zero AI.
- **Auth**: admin-only.
- **Żądanie**: brak; trendy zawsze za ostatnie 12 miesięcy.
- **Odpowiedź**:
  ```
  {
    months: "YYYY-MM"[12],
    firstResponse: { avgHours: number|null, trend: {month, value: number|null}[] },
    conversion:   { totalLeads, convertedLeads, pct: number|null, trend: [...] },
    projectHealth:{ counts: Record<zdrowie, number>, total },
    dso:          { avgDays: number|null, oldestOverdueDays: number|null,
                    overdueCount, trend: [...] },
    reviews:      { closedProjectsCount, reviewsCollected, pct: number|null,
                    avgClientRating: number|null },
    referral:     { totalLeads, referralLeads, pct: number|null,
                    nurtureAsksSent, trend: [...] },
    timeTracking: { totalHours, trend: [...] }
  }
  ```
  `value: null` w trendzie = brak danych w miesiącu (nie zero).
- **Reguły biznesowe**: DSO liczone tylko po fakturach PLN typu „faktura" (bez proform/walut); konwersja = lead ma dziś `client_id`; zdrowie projektów to snapshot (Na dobrej drodze / Zagrożony / Zerwany, oś ręczna, niezależna od statusu).
- **Poziom w apce**: 3.

---

# Typy danych

Enumy podane jako dokładne wartości stringów zapisywane/zwracane przez API.

## Enumy wspólne

| Typ | Wartości |
|---|---|
| `DocLang` (jezyk dokumentu) | `"pl"` \| `"en"` \| `"de"` |
| `VatRate` | `"23"` \| `"8"` \| `"5"` \| `"0"` \| `"zw"` (zwolniony) \| `"np"` (nie podlega) |
| `InvoiceStatus` | `"Szkic"` \| `"Wystawiona"` \| `"Opłacona"` \| `"Po terminie"` \| `"Anulowana"` |
| `InvoiceDocType` (`typ_dokumentu`) | `"faktura"` \| `"proforma"` \| `"zaliczkowa"` |
| `PaymentMethod` (faktura, `sposob_platnosci`) | `"przelew"` \| `"gotowka"` \| `"karta"` |
| Waluty faktury | `"PLN"` \| `"EUR"` \| `"USD"` \| `"GBP"` (EUR odblokowuje QR SEPA na wydruku) |
| `KsefStatus` | `"nie_wyslano"` \| `"wyslano"` \| `"przyjeto"` \| `"odrzucono"` |
| `KsefTryb` | `"test"` \| `"prod"` (prod zablokowany do rejestracji firmy) |
| `KorektaTyp` (`typ_korekty`) | `"1"` (w dacie pierwotnej) \| `"2"` (w dacie korekty) \| `"3"` (inna data) |
| `OfferStatus` | `"Szkic"` \| `"Wysłana"` \| `"Zaakceptowana"` \| `"Odrzucona"` \| `"Wygasła"` |
| `ContractTyp` | `"umowa"` \| `"nda"` |
| `ContractStatus` | `"Szkic"` \| `"Wysłana"` \| `"Podpisana"` \| `"Odrzucona"` |
| `CostCategory` | `"Usługi"` \| `"Sprzęt"` \| `"Subskrypcje"` \| `"Biuro"` \| `"Marketing"` \| `"Podatki i ZUS"` \| `"Inne"` |
| `CostStatus` | `"Nieopłacony"` \| `"Opłacony"` |
| `PaymentMethod` (koszt, `metoda_platnosci`) | `"przelew"` \| `"karta"` \| `"gotowka"` \| `"blik"` \| `"paypal"` \| `"apple_pay"` \| null |
| VAT do odliczenia | `100` \| `50` \| `0` (procent) |

Stałe progowe: `KSEF_MICRO_THRESHOLD_PLN = 10000` (miesięczny próg brutto,
poniżej którego mikrofirma może w 2026 fakturować poza KSeF),
`AMORTYZACJA_PROG_NETTO = 10000` (sprzęt powyżej — amortyzacja, miękka
podpowiedź), `CONTRACT_STALE_DAYS = 7` (cisza po wysyłce umowy),
progi windykacji: poziom 1 = +3 dni, 2 = +10, 3 = +21 po terminie.

## Invoice

```ts
{
  id: string;                       // UUID
  numer: string | null;             // null = szkic; "FV 7/2026" / "KOR 1/2026" / "PF 2/2026"
  lead_id: string | null;
  client_id: string | null;         // powiązanie z kartą klienta (pola klient_* to migawka)
  project_id: string | null;
  klient_nazwa: string;
  klient_nip: string;               // polski NIP albo VAT-UE z prefiksem (np. "DE265685242")
  klient_adres: string;             // @deprecated — fallback dla starych rekordów
  klient_ulica: string; klient_kod: string; klient_miasto: string; klient_kraj: string;
  odbiorca_nazwa: string;           // pusty = brak osobnego odbiorcy
  odbiorca_ulica: string; odbiorca_kod: string; odbiorca_miasto: string; odbiorca_kraj: string;
  klient_email: string;
  share_token: string | null;       // publiczny link /pl/faktura/<token>
  last_reminder_at: string | null;
  reminder_level: number;           // 0-3, najwyższy wysłany poziom windykacji
  wezwanie_wystawiono_at: string | null;
  wezwanie_share_token: string | null; // /pl/wezwanie/<token>
  typ_dokumentu: InvoiceDocType;
  koryguje_id: string | null;       // ustawione = TA faktura jest korektą
  przyczyna_korekty: string;
  typ_korekty: string;              // "1"|"2"|"3"
  rozlicza_zaliczke_id: string | null; // ustawione = faktura rozliczeniowa (ROZ)
  zamowienie_wartosc: number | null;   // pełna wartość zamówienia (zaliczkowe)
  zamowienie_opis: string;
  kurs_nbp: number | null; kurs_nbp_data: string | null; kurs_nbp_tabela: string | null;
  data_wystawienia: string | null; data_sprzedazy: string | null; termin_platnosci: string | null;
  status: InvoiceStatus;
  waluta: string;                   // "PLN"|"EUR"|"USD"|"GBP"
  jezyk: DocLang;
  sposob_platnosci: "przelew"|"gotowka"|"karta";
  ceny_brutto: boolean;             // tylko tryb wpisywania w edytorze; w bazie zawsze netto
  uwagi: string;
  ksef_status: KsefStatus; ksef_tryb: KsefTryb | null;
  ksef_numer: string | null; ksef_upo: string | null; ksef_blad: string;
  ksef_wyslano_at: string | null; ksef_qr: string | null;
  created_at: string; updated_at: string;
}
```

Trasy listowe dokładają: `netto`, `vat`, `brutto`, `zaplacono` (number).

## InvoiceItem

```ts
{
  id: string; invoice_id: string;
  nazwa: string; ilosc: number; jednostka: string;   // "szt." / "pcs." / "Stk."
  cena_netto: number;
  vat_stawka: string;               // VatRate
  rabat_procent: number;            // 0-100, od netto pozycji przed VAT
  position: number;
}
// netto pozycji = ilosc*cena_netto*(1 - rabat/100); vat = netto*stawka; brutto = netto+vat
// (zaokrąglenia do groszy per pozycja)
```

## InvoicePayment / InvoiceReminder

```ts
InvoicePayment: { id; invoice_id; kwota: number; data: "YYYY-MM-DD"; created_at }
InvoiceReminder: { id; invoice_id; level: number /*1-3*/; kind: "reminder"|"wezwanie"; sent_at }
```

## CatalogItem

```ts
{ id: string; nazwa: string; cena_netto: number; vat_stawka: string; jednostka: string; created_at: string }
```

## Offer

```ts
{
  id: string; tytul: string;
  lead_id: string | null; client_id: string | null;
  project_id: string | null;        // ustawiane przy akceptacji
  invoice_id: string | null;        // ustawiane przy akceptacji
  klient_nazwa: string; klient_nip: string;
  klient_adres: string;             // @deprecated fallback
  klient_ulica: string; klient_kod: string; klient_miasto: string; klient_kraj: string;
  klient_email: string;
  share_token: string | null;       // /pl/oferta/<token>
  wazna_do: string | null;          // po tej dacie otwarta oferta = przeterminowana
  status: OfferStatus;
  jezyk: DocLang;
  uwagi: string;
  accepted_at: string | null;
  accepted_by_name: string | null;  // puste = zaakceptowano ręcznie w panelu
  accepted_ip: string | null; accepted_user_agent: string | null;
  created_at: string; updated_at: string;
}
// Lista dokłada `kwota` (suma pozycji, bez VAT).
// Referencja do wyświetlenia: "OF-<rok>-<6 znaków z id>".
// Statusy zamknięte: Zaakceptowana/Odrzucona/Wygasła.
// Wagi pipeline'u: Szkic 0.2, Wysłana 0.5, zamknięte 0.
```

## OfferItem / OfferTemplate

```ts
OfferItem: { id; offer_id; nazwa; ilosc: number; jednostka; cena: number; position }
OfferTemplate: { id; nazwa; opis; pozycje: {nazwa, ilosc, jednostka, cena}[]; uwagi; created_at; updated_at }
```

## Contract

```ts
{
  id: string;
  typ: "umowa" | "nda";
  status: ContractStatus;
  lead_id: string | null; client_id: string | null;
  project_id: string | null; offer_id: string | null;
  klient_nazwa: string; klient_nip: string;
  klient_ulica: string; klient_kod: string; klient_miasto: string; klient_kraj: string;
  klient_email: string;
  zakres_prac: string;              // tylko umowa; kopiowane z pozycji oferty, edytowalne
  cena: number; waluta: string;
  termin_realizacji: string | null;
  uwagi: string;
  share_token: string | null;       // /pl/umowa/<token> lub /pl/nda/<token>
  sent_at: string | null;           // ostatnia wysyłka mailem — licznik ciszy (próg 7 dni)
  accepted_at: string | null;
  accepted_by_name: string | null;  // puste = oznaczono ręcznie / podpis papierowy
  accepted_ip: string | null; accepted_user_agent: string | null;
  jezyk: DocLang;                   // NDA zawsze "pl"; klauzule i tak tylko po polsku
  created_at: string; updated_at: string;
}
// Referencja: "UM-<rok>-<6 znaków>" / "NDA-<rok>-<6 znaków>".
// Każdy dokument nosi notę "SZABLON — WYMAGA WERYFIKACJI PRAWNEJ".
```

## Cost

```ts
{
  id: string;
  dostawca_nazwa: string; dostawca_nip: string;
  kategoria: CostCategory | string;
  opis: string;
  data_wydatku: string;             // data wystawienia dokumentu
  kwota_netto: number;
  vat_stawka: VatRate | string;
  kwota_brutto: number;             // liczona serwerowo z netto+stawki
  status: "Nieopłacony" | "Opłacony";
  data_platnosci: string | null;
  project_id: string | null;
  client_id: string | null;         // relacja wyłączna z lead_id (max jeden)
  lead_id: string | null;
  metoda_platnosci: string | null;  // przelew|karta|gotowka|blik|paypal|apple_pay
  dostawca_konto: string;           // IBAN — do "kopiuj dane do przelewu", NIGDY nie inicjuje płatności
  numer_faktury: string;
  data_wplywu: string | null;       // data otrzymania (osobna od wystawienia)
  vat_odliczenie_procent: number;   // 100|50|0
  duplikat_potwierdzony: boolean;
  zalacznik_nazwa: string; zalacznik_typ: string;  // dane binarne osobno przez /attachment
  ksef_numer: string | null; ksef_tryb: string | null; // ustawione = import z KSeF
  created_at: string; updated_at: string;
  project_tytul?: string | null;    // tylko w GET /api/costs (JOIN)
}
```

## RecurringCost

```ts
{
  id: string; nazwa: string;
  dostawca_nazwa: string; dostawca_nip: string; dostawca_konto: string;
  kategoria: CostCategory | string; opis: string;
  kwota_netto: number; vat_stawka: VatRate | string;
  metoda_platnosci: string | null;
  project_id: string | null;
  cykl: string;                     // RecurringCycle, np. "miesiecznie" (lib/recurring.ts)
  next_run: string;                 // "YYYY-MM-DD" — kiedy cron utworzy kolejny szkic kosztu
  active: boolean;
  created_at: string; updated_at: string;
}
```

## OcrSuggestion (odpowiedź /api/costs/[id]/ocr)

```ts
{
  dostawca_nazwa: string;           // "" = model niepewny
  dostawca_nip: string;             // "" albo dokładnie 10 cyfr
  numer_faktury: string;
  dostawca_konto: string;           // "" albo zweryfikowany polski IBAN (26 cyfr)
  kwota_netto: number | null;
  vat_stawka: VatRate | null;       // dopasowana matematycznie do pary netto/brutto
  data_wydatku: string;             // "YYYY-MM-DD" albo ""
  data_platnosci: string;           // termin płatności z dokumentu albo ""
  opis: string;
}
// Wszystko to tylko PROPOZYCJA do formularza — użytkownik edytuje i zapisuje sam.
```

## CompanySettings

```ts
{
  nazwa: string; nip: string;
  adres: string;                    // @deprecated jednoliniowy fallback
  ulica: string; kod: string; miasto: string;
  kraj: string;                     // domyślnie "PL"
  email: string; telefon: string;
  konto: string;                    // IBAN
  bank_nazwa: string; swift: string;
  vat_payer: boolean;               // false = zwolniony z VAT (faktury bez VAT)
  zwolnienie_podstawa: string;      // pokazywana gdy vat_payer=false
  domyslny_termin_dni: number;      // domyślnie 14
  domyslne_uwagi: string;           // auto-wstawiane do nowych faktur
  stawka_odsetek_ustawowych: number | null; // ręczna; null = wezwania bez odsetek
  rezerwa_vat_procent: number; rezerwa_pit_procent: number; rezerwa_zus_procent: number;
}
```

## MfSubject / ViesSubject (lookupy)

```ts
MfSubject:   { nazwa; ulica; kod; miasto; statusVat: string|null; numeryKont: string[] }
ViesSubject: { valid: boolean; nazwa; ulica; kod; miasto; kraj }  // pola bywają puste (kraj suppresuje)
```
