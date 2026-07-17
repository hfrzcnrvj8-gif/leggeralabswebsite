# Moduł 30 — Powiązanie z Klientem: obowiązkowe tam, gdzie cała droga na nim wisi

> Przeczytaj `docs/plany-modulow/README.md` (zasady wspólne), `CLAUDE.md` oraz
> `00-mapa-drogi-klienta.md`. Ten brief powstał **z audytu Modułu 29**
> (2026-07-17) — nie jest nowym pomysłem, tylko domknięciem luki potwierdzonej
> w kodzie.
>
> **Kolejność: to DRUGI z trzech briefów audytu (32 → 30 → 31).** Moduł 32 jest
> zamknięty (2026-07-17) — patrz **Sprostowanie C** niżej, bo dotknął tego
> samego dokumentu (`00-mapa-drogi-klienta.md`) i część Zakresu poniżej jest
> już nieaktualna. Modułu 31 nie rób przy okazji — ma osobny czat.

## PRZECZYTAJ NAJPIERW — weryfikacja briefu w kodzie (2026-07-17)

Brief został **ponownie sprawdzony gretem** przed startem tego czatu (lekcja z
audytu 29: dokumentacja tego projektu bywa nieaktualna). Wszystkie znaleziska
się potwierdziły, ale **trzy rzeczy poniżej są sformułowane myląco** i bez tej
poprawki zbudujesz coś, co już istnieje:

### ❗ Sprostowanie A — pickery Faktur i Ofert JUŻ linkują, nie tylko kopiują
Sekcja 6 cytuje odłożoną pozycję Modułu 22: *„picker kopiuje dane nabywcy, nie
linkuje"*. **To nieprawda w dzisiejszym kodzie.** `pickClient` w
`InvoiceEditor.tsx:247` i `OfferEditor.tsx:93` ustawia `client_id` **obok**
skopiowanych pól nabywcy, a PATCH-e (`api/invoices/[id]/route.ts:94`,
`api/offers/[id]/route.ts:53`) to zapisują. Komentarz w `InvoiceEditor.tsx:249`
mówi wprost: *„Kopiujemy dane klienta na pola nabywcy (to niezależna migawka…) i
podpinamy `client_id`, żeby działał link »→ Karta klienta«"*. Działa też
`ClientLinkChip`.

**Skutek dla pytania 1 poniżej („migawka czy powiązanie?"): kod już odpowiedział
— OBA naraz**, dokładnie jak brief przewidywał. To pytanie jest więc do
**potwierdzenia z właścicielem, nie do rozstrzygnięcia od zera**. Nie przebudowuj
tego mechanizmu — on jest poprawny.

### ❗ Sprostowanie B — dziura to JEDNA trasa, nie „faktury w ogóle"
Sekcja 3 („Faktura NIE ZAPISUJE `client_id`") jest prawdziwa **wyłącznie dla
`POST /api/invoices`** (ręczne „+ Dodaj fakturę") — ta trasa nie ma kolumny
`client_id` w `INSERT` i **nie czyta jej nawet z body**. Natomiast:
- `POST /api/offers:80` **zapisuje** `client_id` i (`:60-76`) **faktycznie
  zakłada klienta z leada** + `logClientEvent`,
- `lib/offerAccept.ts:112` — faktura z zaakceptowanej oferty **dostaje**
  `client_id`.

Czyli **cała trasa „lead → oferta → akceptacja → projekt + faktura" jest
powiązana poprawnie**. Dziura otwiera się tylko tam, gdzie startujesz **bez
leada**: „+ Dodaj ofertę"/„+ Dodaj fakturę" (`body: "{}"`) → brak `client_id` →
brak retencji, pusta karta klienta, pusta oś czasu. To zawęża zakres i **zmienia
sens pytania 3** (to jest właściwe miejsce naprawy).

### ❗ Sprostowanie C — Krok 2 mapy jest już poprawiony (Moduł 32)
Ostatnia pozycja Zakresu („Korekta `00-mapa-drogi-klienta.md` Krok 2 — usunąć
obietnicę automatycznego zakładania klienta") jest **częściowo zrobiona**: Moduł
32 zmienił tekst na *„zakłada Klienta z leada, jeśli oferta powstała z leada"* i
dopisał ramkę wskazującą na Moduł 30. **Nie pisz tego drugi raz** — sprawdź, co
tam jest, i najwyżej dopnij po swojej zmianie. Reszta zakresu Modułu 32 nie
koliduje (tamten ruszał `lib/leads.ts`, `lib/process.ts`, podpowiedzi, paletę).

### Potwierdzone bez zastrzeżeń (nie trać czasu na ponowne sprawdzanie)
`OffersDashboard.tsx:42` i `InvoicesDashboard.tsx:64` wysyłają `body: "{}"`;
`components.tsx:417` → `if (clients.length === 0) return null` (na świeżym
panelu pickera **nie ma**); `api/projects/[id]/route.ts:233` → retencja tylko
`if (clientId && …)`; nagłówek `lib/links.ts:4` opisuje `ClientPickerButton` w
czasie przeszłym, a on żyje w dwóch edytorach.

## Skąd to się wzięło

Audyt Modułu 29 przeszedł mapę drogi klienta krok po kroku i znalazł **jeden
korzeń łączący trzy różne kroki** (2 Oferta, 6 Fakturowanie, 10 Retencja):

**Powiązanie z Klientem jest opcjonalne w miejscach, w których cała reszta drogi
na nim wisi — a panel nigdy o tym nie mówi.**

To najpoważniejsza luka funkcjonalna z całego audytu, bo jej skutki ujawniają się
**miesiące po tym, jak się ją popełni**, i wtedy nie da się ich odzyskać
automatycznie.

## Dowody z kodu (potwierdzone, nie hipotezy)

### 1. Mapa obiecuje automatyczne zakładanie klienta — panel tego nie robi
`00-mapa-drogi-klienta.md` (Krok 2) mówi: *„Panel robi za Ciebie: …
**automatycznie zakłada Klienta** jeśli jeszcze nie istnieje"*.

Nieprawda. Klient powstaje **tylko** wtedy, gdy oferta została utworzona z karty
leada. `lib/offerAccept.ts` nie zakłada klienta w ogóle — bierze wyłącznie to, co
już jest na ofercie.

### 2. „+ Dodaj ofertę" i „+ Dodaj fakturę" tworzą rekord bez klienta
- `OffersDashboard.tsx:42` — wysyła puste żądanie (`body: "{}"`)
- `InvoicesDashboard.tsx:64` — to samo

### 3. Faktura NIE ZAPISUJE `client_id` — nawet gdy go zna
`app/api/invoices/route.ts:82` — polecenie `INSERT INTO invoices (...)` zawiera
`lead_id` i `project_id`, ale **kolumny `client_id` w nim nie ma w ogóle**.
Czyli nawet fakturę tworzoną z leada, który ma już swojego klienta, zapisuje się
bez powiązania — przepisuje się sama nazwa firmy jako tekst.

### 4. Co przez to cicho przecieka
Oferta bez klienta → projekt i faktura też bez klienta → i wtedy **wypada cała
końcówka drogi, bez jednego ostrzeżenia**:
- `app/api/projects/[id]/route.ts:234` — retencja (Krok 10) planuje się **tylko**
  `if (clientId && ...)`. Bez klienta: **zero kontaktów kontrolnych, na zawsze**.
- `app/api/clients/[id]/route.ts:43-45` — karta klienta filtruje po `client_id`,
  więc nigdy nie pokaże tej oferty/faktury/projektu.
- Oś czasu klienta nie dostanie żadnego wpisu.

### 5. Ratunek istnieje, ale jest niewidoczny i mylący
Picker „Z bazy klientów" (`OfferEditor.tsx:92`) pozwala powiązać ręcznie. Ale:
- nic nie mówi, że **trzeba** go użyć,
- wpisanie nazwy klienta w zwykłym polu tekstowym **wygląda identycznie** i nie
  tworzy powiązania,
- **przycisk znika całkowicie, gdy baza klientów jest pusta**
  (`components.tsx:417` — `if (clients.length === 0) return null`), więc na
  świeżym panelu faktury nie da się powiązać z niczym.

### 6. Przy okazji: dwa różne UI robią to samo
- **Umowy, Koszty, Notatki, Poczta, Kalendarz, Projekty, Leady** → `LinkPicker`
  z Modułu 22 (Klienci / Leady / Projekty)
- **Faktury i Oferty** → stary `ClientPickerButton` (`components.tsx:416`) —
  inny wygląd, inna nazwa, tylko klienci

Nagłówek `lib/links.ts` opisuje ten stary przycisk **w czasie przeszłym**:
*„Przed tym modułem to samo robiły trzy różne mechanizmy: ClientPickerButton
(oferty/faktury)…"* — a on nadal tam jest i działa.

To bezpośrednio dotyka pozycji odłożonej w Module 22 (`lead_id`/`project_id`
w UI Faktur/Ofert — „picker kopiuje dane nabywcy, nie linkuje").

## Do rozstrzygnięcia z właścicielem (NIE zgadywać)

To jest **decyzja produktowa, nie techniczna** — dlatego moduł zaczyna się od
pytań:

1. **Co `client_id` na fakturze właściwie znaczy?** To pytanie zostało świadomie
   odłożone w Module 22 i nadal nie ma odpowiedzi. Dwie możliwości:
   - **Migawka** (dziś): faktura utrwala dane nabywcy na moment wystawienia —
     zmiana adresu klienta nie zmienia wystawionej faktury. **To jest poprawne
     księgowo** i nie wolno tego zepsuć.
   - **Powiązanie**: faktura wie, do którego klienta należy.
   - **Prawdopodobna odpowiedź: oba naraz** — `client_id` jako powiązanie (do
     karty klienta, osi czasu, retencji) **obok** utrwalonych pól tekstowych
     jako migawki. Ale to musi potwierdzić właściciel.
   - **AKTUALIZACJA 2026-07-17 (Sprostowanie A): kod już to robi „oba naraz"** i
     ma to opisane w komentarzu (`InvoiceEditor.tsx:249`). Więc to pytanie
     sprowadza się do: *„czy potwierdzasz to, co już działa?"* — a nie do wyboru
     architektury. Zadaj je krótko i nie przebudowuj mechanizmu migawki: jest
     poprawny księgowo.
2. **Czy powiązanie ma być wymagane, czy tylko podpowiadane?** Zasada panelu to
   *„tylko miękkie podpowiedzi, nigdy twarde bramki"* — więc raczej podpowiedź
   („ta faktura nie jest powiązana z klientem — nie pojawi się na jego karcie
   ani nie uruchomi kontaktu retencyjnego"). **Do potwierdzenia.**
3. **Czy „+ Dodaj ofertę/fakturę" ma od razu pytać o klienta**, czy zostawić
   puste i tylko ostrzegać?
4. **Czy dorobić powiązanie wstecz** dla ofert/faktur/projektów, które już
   istnieją bez klienta (dopasowanie po nazwie firmy do zatwierdzenia ręcznego)?
   W dev-bazie to nieistotne, ale na produkcji mogą już być takie rekordy.

## Zakres (po odpowiedziach) — zaktualizowany po weryfikacji 2026-07-17

- **`client_id` w `POST /api/invoices`** — trasa nie ma tej kolumny w `INSERT`
  ani nie czyta jej z body (patrz Sprostowanie B). To jedyna trasa z tą dziurą;
  `POST /api/offers` i `lib/offerAccept.ts` są już w porządku.
- **Ścieżka „od zera"**: „+ Dodaj ofertę"/„+ Dodaj fakturę" (`body: "{}"`) —
  czy pytać o klienta od razu, czy tworzyć puste i ostrzegać (pytanie 3).
- Naprawa `components.tsx:417` (`if (clients.length === 0) return null`) —
  picker musi być widoczny także przy pustej bazie, inaczej na świeżym panelu
  **nie da się powiązać niczego**. Uwaga: to działa też jako miękka ścieżka
  „załóż klienta stąd" — do przemyślenia razem z pytaniem 3.
- Miękka podpowiedź o braku powiązania (wzorem istniejących podpowiedzi,
  `LEAD_STATUS_HINT`/`CLIENT_STATUS_HINT`) — **nigdy twarda bramka**.
- Zastąpienie `ClientPickerButton` w Fakturach/Ofertach `LinkPicker`-em z
  Modułu 22 — **uwaga: to NIE jest naprawa błędu**, tylko ujednolicenie UI
  (dzisiejszy picker linkuje poprawnie, patrz Sprostowanie A). Jeśli zabraknie
  czasu/zgody właściciela, reszta modułu działa bez tego. `LinkPicker` daje
  przy okazji `lead_id`/`project_id`, czego stary picker nie ma — to właśnie
  odłożona pozycja Modułu 22.
- Aktualizacja nagłówka `lib/links.ts:4` (mówi o `ClientPickerButton` w czasie
  przeszłym, a on istnieje w dwóch edytorach).
- ~~Korekta `00-mapa-drogi-klienta.md` Krok 2~~ — **zrobione w Module 32**
  (Sprostowanie C); najwyżej dopnij po swojej zmianie.
- ~~Znaczniki 🆕/🔧 w `00-mapa-drogi-klienta.md` nieaktualne szeroko~~ —
  **ZROBIONE 2026-07-17** (`HUB_SETUP.md` → „Moduł 32" → „Domknięcie"). Cała
  mapa jest teraz zweryfikowana w kodzie. **Nie rób tego drugi raz** — jeśli
  Twoja zmiana dotknie Kroku 2 albo Etapu 10, tylko dopnij po sobie.

## Weryfikacja

`npx tsc --noEmit -p tsconfig.json` po każdej paczce + podgląd
(`preview_start name:"dev"`). Ścieżka do przejścia na żywo: utwórz ofertę z
ekranu Ofert (nie z leada) → zaakceptuj → sprawdź, czy projekt trafia na kartę
klienta i czy zaplanował się kontakt retencyjny.
