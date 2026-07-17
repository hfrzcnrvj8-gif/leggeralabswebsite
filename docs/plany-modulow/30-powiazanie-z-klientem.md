# Moduł 30 — Powiązanie z Klientem: obowiązkowe tam, gdzie cała droga na nim wisi

> Przeczytaj `docs/plany-modulow/README.md` (zasady wspólne), `CLAUDE.md` oraz
> `00-mapa-drogi-klienta.md`. Ten brief powstał **z audytu Modułu 29**
> (2026-07-17) — nie jest nowym pomysłem, tylko domknięciem luki potwierdzonej
> w kodzie.

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
2. **Czy powiązanie ma być wymagane, czy tylko podpowiadane?** Zasada panelu to
   *„tylko miękkie podpowiedzi, nigdy twarde bramki"* — więc raczej podpowiedź
   („ta faktura nie jest powiązana z klientem — nie pojawi się na jego karcie
   ani nie uruchomi kontaktu retencyjnego"). **Do potwierdzenia.**
3. **Czy „+ Dodaj ofertę/fakturę" ma od razu pytać o klienta**, czy zostawić
   puste i tylko ostrzegać?
4. **Czy dorobić powiązanie wstecz** dla ofert/faktur/projektów, które już
   istnieją bez klienta (dopasowanie po nazwie firmy do zatwierdzenia ręcznego)?
   W dev-bazie to nieistotne, ale na produkcji mogą już być takie rekordy.

## Zakres (po odpowiedziach)

- `client_id` w `INSERT` faktury i w ścieżce tworzenia oferty
- Zastąpienie `ClientPickerButton` w Fakturach/Ofertach `LinkPicker`-em z
  Modułu 22 (domyka odłożoną pozycję Modułu 22 i usuwa dwunasty wzorzec UI)
- Naprawa `if (clients.length === 0) return null` — picker musi być widoczny
  także przy pustej bazie (inaczej nowy panel nie pozwala powiązać niczego)
- Miękka podpowiedź o braku powiązania (wzorem istniejących podpowiedzi)
- Korekta `00-mapa-drogi-klienta.md` Krok 2 — usunąć obietnicę automatycznego
  zakładania klienta ALBO ją zrealizować (to też decyzja właściciela)
- Aktualizacja nagłówka `lib/links.ts` (mówi o `ClientPickerButton` w czasie
  przeszłym, a on istnieje)

## Weryfikacja

`npx tsc --noEmit -p tsconfig.json` po każdej paczce + podgląd
(`preview_start name:"dev"`). Ścieżka do przejścia na żywo: utwórz ofertę z
ekranu Ofert (nie z leada) → zaakceptuj → sprawdź, czy projekt trafia na kartę
klienta i czy zaplanował się kontakt retencyjny.
