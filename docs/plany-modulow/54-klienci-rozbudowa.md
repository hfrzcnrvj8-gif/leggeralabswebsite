# Moduł 54 — Klienci: rozbudowa poza audyt (program na 3 kroki)

> Przeczytaj najpierw `README.md` (zasady wspólne), `CLAUDE.md` oraz
> `51-audyt-uiux-panel-i-apka.md` → „Stan po module Klienci". Techniczne
> szczegóły wykonanych rund: `HUB_SETUP.md` → sekcje „Moduł 51 … Klienci".

## Skąd to się wzięło

Audyt UI/UX modułu Klienci (Moduł 51) domknął **parytet i kompletność** wobec
mapy drogi klienta. Właściciel zapytał wprost, czy to już maksimum. Odpowiedź
brzmiała **nie** — i po przeglądzie wzorców (Attio, Clay) powstała lista pięciu
rzeczy wykraczających poza audyt. Właściciel zatwierdził **wszystkie pięć**,
wraz z wyraźną zgodą na pracę „na zapas" przy sufitach technicznych.

**Dwie pierwsze są zrobione** (rytm kontaktu, szukanie po historii — patrz
`HUB_SETUP.md`, rundy 4–6). Ten dokument opisuje **trzy pozostałe**, w
zatwierdzonej kolejności.

## Kolejność (zatwierdzona 2026-07-26)

1. ~~Rytm kontaktu per klient~~ ✅ wykonane
2. ~~Szukanie po treści historii~~ ✅ wykonane
3. ~~Sufity techniczne~~ ✅ wykonane (2026-07-26) — szczegóły i **dwie decyzje
   odbiegające od tego briefu** w `HUB_SETUP.md` → „Moduł 54 — Klienci, krok 3"
4. ~~Wiele osób kontaktowych przy firmie~~ ✅ wykonane (2026-07-26) —
   `HUB_SETUP.md` → „Moduł 54 — Klienci, krok 4"
5. **Pliki przy kliencie (NAS)** — ⏸ ODŁOŻONE do przeprowadzki panelu na NAS
   (Moduł 55). Powód: w docelowym układzie to zwykły katalog obok bazy, bez
   tunelu i bez nowego punktu awarii — budowanie tunelu teraz byłoby pracą do
   wyrzucenia. Wyzwalacz: rejestracja firmy, patrz `PO_REJESTRACJI.md` pkt 13a.
6. ~~Układ boczny profilu (atrybuty | oś czasu)~~ ✅ wykonane (2026-07-26) —
   `HUB_SETUP.md` → „Moduł 54 — Klienci, krok 6"

---

## Krok 3 — Sufity techniczne ✅ WYKONANE 2026-07-26

> **Uwaga przy czytaniu:** dwa z trzech punktów wykonano INACZEJ, niż zakładał
> ten opis. 3a nie dostało stronicowania (decyzja właściciela: sufit
> z ostrzeżeniem), a propozycja z 3c zepsułaby liczniki w apce. Aktualny stan
> jest w `HUB_SETUP.md` → „Moduł 54 — Klienci, krok 3". Poniższy tekst zostaje
> jako zapis tego, co wiedzieliśmy PRZED wejściem w kod.

Trzy znane ograniczenia. Dziś NIE bolą (rejestr ma kilka rekordów), ale
właściciel świadomie zgodził się je zdjąć zawczasu.

### 3a. `GET /api/clients` zwraca wszystko naraz

Bez stronicowania, z podzapytaniem `AVG` po projektach dla każdego klienta.
Przy 500 klientach to jeden duży JSON plus agregat liczony za każdym razem.

**Uwaga przy projektowaniu:** panel filtruje i sortuje po stronie klienta
(`ClientsDashboard`), a apka tak samo (`KlienciListaTresc.widoczni`). Wprowadzenie
stronicowania oznacza przeniesienie filtrowania/sortowania na serwer ALBO
świadome ograniczenie „filtruj w obrębie wczytanej strony" — drugie jest
pułapką z rodziny „lista, która kłamie pustką" (ustalenie A1). Zdecyduj z
właścicielem, zanim zaczniesz.

### 3b. Operacje masowe robią N żądań w pętli

`bulkUpdateStatus` i `bulkDelete` w `ClientsDashboard.tsx` wołają `PATCH`/`DELETE`
osobno na każdego zaznaczonego klienta. Przy 50 zaznaczonych to 50 rund HTTP —
a `neon()` płaci rundę HTTP za KAŻDE zapytanie SQL, więc koszt się mnoży.

Docelowo: `PATCH /api/clients/bulk` przyjmujące listę id + pola.
Pamiętaj o `logFieldChanges` — audyt zmian musi zapisać każdy rekord osobno.

### 3c. Apka dociąga cztery listy dla jednego menu

`dociagnijDokumentyDoPowiazan()` (AppStore) pobiera umowy, oferty, faktury
i projekty, żeby menu przytrzymania „Otwórz powiązane" nie pokazywało pół
prawdy. To cztery żądania raz na uruchomienie apki.

Docelowo: jeden endpoint powiązań klienta (`GET /api/clients/:id/powiazane`)
albo dołożenie powiązań do listy klientów. **Nie usuwaj dociągania, zanim nie
będzie zamiennika** — bez tego menu wraca do milczenia o istniejących
dokumentach.

---

## Krok 4 — Wiele osób kontaktowych przy firmie ✅ WYKONANE 2026-07-26

> **Rozstrzygnięcie pułapki z końca tej sekcji:** właściciel wybrał, żeby adresy
> osób weszły do `findContactsByEmail` jako TRZECIE źródło (obok aliasów
> i adresu firmowego). Tabela aliasów została nietknięta. Szczegóły i to, czego
> ten brief nie przewidział (cztery drogi tworzenia klienta, każda z własną
> migawką), w `HUB_SETUP.md` → „Moduł 54 — Klienci, krok 4".

**Decyzja właściciela: lista osób ZASTĘPUJE dzisiejsze pole**, ale
`clients.osoba_kontaktowa` **zostaje jako migawka osoby głównej**.

Powód jest praktyczny: z tego pola korzysta dziś PIĘĆ miejsc i przepisywanie
wszystkich naraz to prosta droga do cichego błędu.

**Kto czyta `osoba_kontaktowa` (sprawdzone w kodzie 2026-07-26):**
1. `buildNurtureMessage` (`lib/clients.ts`) — powitanie w mailu retencyjnym.
2. Wiersz listy klientów — panel (`TableView`, `KanbanBoard`) i apka
   (`WierszKlienta`).
3. Wyszukiwarka globalna (`app/api/search/route.ts`) i lokalna w apce.
4. Eksport CSV (`app/api/clients/export/route.ts`).
5. `buildOnboardingWelcomeMessage` / `buildProjectClosingSummary`
   (`lib/projects.ts`) — powitania w wiadomościach projektowych.

**Kształt do zbudowania:** tabela `client_contacts` (id, client_id, imię,
rola, telefon, e-mail, `glowna BOOLEAN`), CRUD w panelu i apce, a przy zapisie
osoby głównej — przepisanie jej imienia do `clients.osoba_kontaktowa`.

**Pułapka:** dopasowywanie poczty do klienta idzie po adresie e-mail klienta
(`rematchUnassigned`, `lib/mailSync.ts`). Jeśli osoby dostaną własne adresy,
trzeba zdecydować, czy mail od osoby kontaktowej ma się dopinać do firmy —
i to jest zmiana zachowania Poczty, nie tylko Klientów.

---

## Krok 5 — Pliki przy kliencie (NAS Ugreen)

**Decyzja właściciela: pliki mają leżeć na NAS-ie Ugreen**, tam gdzie kopie bazy.

**To jest najtrudniejszy wariant i trzeba to powiedzieć wprost przy starcie:**
panel działa na Vercelu i **nie ma dostępu do NAS-a w sieci domowej**. Wymaga
jednego z:

- **Tunel** (Tailscale / Cloudflare Tunnel) — NAS wystawiony pod stabilnym
  adresem, panel łączy się przez niego. Działa z Vercela, ale to nowy punkt
  awarii: gdy tunel padnie albo NAS się wyłączy, załączniki znikają z panelu.
  Nadzór (Audyt 4) powinien to widzieć — inaczej awaria będzie cicha.
- **Wysyłka pośrednia** — panel trzyma metadane, plik wędruje na NAS skryptem
  z Maca właściciela. Zero ekspozycji NAS-a na świat, ale plik jest dostępny
  tylko wtedy, gdy Mac działa.

**Zanim cokolwiek zbudujesz, ustal z właścicielem, który wariant** — i pamiętaj
o `docs/AUDYT-2-WYNIKI.md` (RODO): pliki klientów to nowa kategoria danych, więc
rejestr czynności i retencja muszą to objąć. Dziś aplikacja **nie przechowuje
żadnych plików** — załączniki maili pobierają się z IMAP na żądanie (świadoma
decyzja kosztowa z Fazy 8, patrz pamięć `zalaczniki-na-zadanie-imap`).

---

## Krok 6 — Układ boczny profilu (atrybuty | oś czasu) ✅ WYKONANE 2026-07-26

> Stan faktyczny, wraz z tym, czego ten opis nie przewidział (zniknięcie
> zakładki „Wizytówka", nowa zakładka „Powiązane", limit szerokości osi czasu
> i rozjazd wobec profilu leada): `HUB_SETUP.md` → „Moduł 54 — Klienci, krok 6".

Wzorzec ze strony rekordu w Attio: wąska kolumna atrybutów po lewej (zawsze
widoczna, nie znika przy przewijaniu), cała pozostała szerokość na oś czasu
i powiązania.

**Co to daje:** dziś, żeby przeczytać historię, przewijasz przez wszystkie pola.
Po zmianie dane są stale pod ręką, a monitor pracuje na to, co czytasz
najczęściej.

**Czego nie daje:** żadnej nowej funkcji. To przemeblowanie i dotyczy **tylko
panelu** (na telefonie nie ma dwóch kolumn). Dlatego jest na końcu.

---

## Czego NIE ruszamy

- **Moduł 16 (wsparcie posprzedażowe)** — jedyny niezbudowany etap mapy drogi
  klienta, świadomie czeka na pierwszego klienta z realną potrzebą.
- **Retencja klientów** — brak auto-usuwania jest decyzją z Audytu 2 (faktury:
  5 lat obowiązku podatkowego).
- **Rzeczy z `PO_REJESTRACJI.md`** — firma nie jest zarejestrowana.
- **Kanban i eksport w apce** — świadome zawężenie („pełna kartoteka to praca
  przy biurku"), tak samo jak przy Leadach.

## Dług spoza modułu, odnotowany

**Statystyki liczą konwersję per źródło wyłącznie po leadach**
(`app/api/stats/route.ts` — grupowanie po `leads.zrodlo_kategoria`). Klient
utworzony bezpośrednio (z polecenia, bez przechodzenia przez lead) ma dziś
kategorię źródła, ale do tej metryki nie wchodzi. To ta sama klasa błędu, co
„na sztywno w kodzie" z Modułu 51: liczba istnieje i wygląda wiarygodnie, tylko
nie znaczy tego, co się wydaje. **Do zrobienia razem ze Statystykami**, nie tutaj.
