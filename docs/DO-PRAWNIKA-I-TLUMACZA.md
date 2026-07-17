# Do prawnika i tłumacza — zbiorcza lista (audyt 2026-07-17, Moduł 29)

> **Po co ten dokument.** Przez cały czas budowy panelu Claude tworzył
> mechanizmy prawne (umowa, NDA, wezwanie do zapłaty, zgody RODO), ale
> **świadomie nie redagował wiążącej treści prawnej** — to nie jest rola
> modelu. Zamiast organizować weryfikację prawną moduł po module, właściciel
> poprosił 2026-07-15 o **jedną zbiorczą listę na ostatecznym audycie**. To
> jest ta lista.
>
> **Jak jej użyć.** Zabierz ten plik do prawnika (i osobno do tłumacza).
> Kolejność ma znaczenie — patrz „Kolejność prac" na końcu. Firma **nie jest
> jeszcze zarejestrowana**, więc część pozycji i tak czeka na rejestrację
> (`PO_REJESTRACJI.md`).
>
> **Czego ten dokument NIE obejmuje:** rzeczy do zrobienia po rejestracji
> działalności, które nie wymagają prawnika (np. wpisanie NIP-u w ustawienia)
> — te są w `PO_REJESTRACJI.md`.

---

## Sekcja 1 — DO PRAWNIKA, priorytet krytyczny

Te dokumenty **trafiają do klienta i są wiążące**. Panel wyświetla na nich
widoczne ostrzeżenie, że to szkic — ale ostrzeżenie nie zastępuje weryfikacji.
**Nie używać z prawdziwym klientem przed przeglądem prawnika.**

### 1.1. Umowa o wdrożenie — 15 klauzul
- **Gdzie:** `lib/contracts.ts` → `CONTRACT_CLAUSES`
- **Co to:** pełna treść umowy, którą klient podpisuje e-podpisem.
- **Co zawiera:** zakres i wyłączenia, zasady zmiany zakresu, reklamacje
  (2 rundy bezpłatnych poprawek), przeniesienie praw autorskich po zapłacie,
  **ograniczenie odpowiedzialności do wysokości wynagrodzenia**, kopie
  zapasowe, systemy stron trzecich, **brak gwarancji poprawności wyników AI**,
  licencje open-source, brak SLA, **milczący odbiór po 7 dniach**,
  RODO/powierzenie danych, wsparcie powdrożeniowe, poufność, płatność 14 dni.
- **Status:** oznaczone jako niezweryfikowany szkic roboczy. Tylko po polsku.
- **Na co zwrócić uwagę prawnika:** ograniczenie odpowiedzialności, milczący
  odbiór i wyłączenie gwarancji wyników AI to trzy klauzule, które najczęściej
  bywają podważane jako abuzywne albo nieskuteczne — warto by przeszły przez
  prawnika w pierwszej kolejności.

### 1.2. NDA (umowa o poufności) — 5 klauzul
- **Gdzie:** `lib/contracts.ts` → `NDA_CLAUSES`
- **Co to:** dokument wysyłany do podpisu **przed** rozmową kwalifikacyjną,
  gdy rozmowa dotknie wewnętrznych systemów klienta.
- **Co zawiera:** cel, definicja informacji poufnych, zobowiązanie, wyłączenia,
  okres obowiązywania 2 lata.
- **Status:** oznaczone jako niezweryfikowany szkic. Tylko po polsku.

### 1.3. Wezwanie do zapłaty — treść i szablon
- **Gdzie:** `lib/invoices.ts` → `DUNNING_LEGAL_NOTE` (ostrzeżenie) oraz
  `app/[lang]/admin/invoices/[id]/wezwanie/print/DunningPrint.tsx` (treść:
  „Niniejszym wzywamy do zapłaty należności w terminie 7 dni…")
- **Co to:** formalne, przedsądowe wezwanie do zapłaty — osobny rodzaj pisma,
  wysyłany automatycznie przez panel po 21 dniach opóźnienia.
- **Status:** oznaczone jako szkic. Tylko po polsku.
- **Na co zwrócić uwagę:** to pismo ma **walor formalny** (poprzedza pozew),
  więc jego treść i sposób doręczenia mają realne znaczenie procesowe. Warto
  też potwierdzić z prawnikiem/księgową sposób naliczania **odsetek
  ustawowych za opóźnienie** (`lib/invoices.ts` → `lateInterestAmount` —
  liczy odsetki proste wg stawki wpisywanej ręcznie przez właściciela;
  kwota trafia do klienta w mailu i na wydruku).

### 1.4. ⚠️ Zgoda na case study / referencję — BEZ ostrzeżenia, a wiążąca
- **Gdzie:** `lib/projects.ts` → `PROJECT_REVIEW_CONSENT_TEXT`
- **Co to:** zgoda RODO klienta na publikację jego opinii, nazwy firmy i
  zakresu współpracy w materiałach marketingowych i na stronie z referencjami.
- **Status:** **ma pełne PL/EN/DE** (przetłumaczone przez Claude, nie przez
  tłumacza) i **nie ma żadnego oznaczenia „wymaga weryfikacji"** — w
  odróżnieniu od umowy i NDA.
- **Dlaczego to ważne:** treść zgody jest utrwalana dowodowo razem z imieniem,
  adresem IP i przeglądarką osoby, która ją zaznaczyła. Czyli opieramy dowód
  zgody na tekście, którego nikt nie zweryfikował. Wersja niemiecka dotyka
  sformułowań okołoRODO (rynek DE jest pod tym względem najbardziej wymagający).
- **Znalezione w audycie 2026-07-17** — brief Modułu 29 zakładał niższą stawkę
  („zgoda marketingowa"), ale brak ostrzeżenia podnosi ryzyko: nic nie
  powstrzyma przed użyciem tego z prawdziwym klientem.

### 1.5. ⚠️ Umowa powierzenia przetwarzania danych (RODO) — obiecana, nie istnieje
- **Gdzie:** `lib/contracts.ts:173` (klauzula RODO w umowie)
- **Co to:** klauzula w naszej własnej umowie **obiecuje klientowi**, że jeśli
  w trakcie prac uzyskamy dostęp do jego danych osobowych, „Strony zawrą
  **odrębną umowę powierzenia** przetwarzania danych osobowych".
- **Problem:** takiego wzoru **w panelu nie ma**. Umowa obiecuje dokument,
  który nie istnieje.
- **Dlaczego to ważne:** przy automatyzacjach AI dostęp do danych klienta to
  scenariusz podstawowy, nie wyjątek. To znaczy, że ta klauzula uruchomi się
  praktycznie przy każdym realnym projekcie.
- **Do zrobienia z prawnikiem:** wzór umowy powierzenia (DPA) przy okazji
  przeglądu umowy głównej.
- **Znalezione w audycie 2026-07-17.**

---

## Sekcja 2 — DO PRAWNIKA, priorytet normalny

### 2.0. Rekompensata za koszty odzyskiwania należności (40/70/100 EUR)
- **Gdzie:** nie istnieje — kandydat do dobudowania w Module 13 (windykacja).
- **Co to:** ustawowe prawo wierzyciela w transakcjach B2B do **zryczałtowanej
  rekompensaty** za koszty odzyskiwania należności — kwota zależy od wartości
  długu i **nie trzeba udowadniać, że koszty faktycznie się poniosło**.
- **Dlaczego na liście:** panel ma już eskalację windykacji i odsetki ustawowe,
  ale tego nie ma. Z całego przeglądu konkurencji (2026-07-17) to **jedyne
  miejsce, gdzie konkurent — wFirma — ma w tym obszarze więcej niż my**.
- **Do potwierdzenia z prawnikiem:** aktualne progi i kwoty, przesłanki
  naliczenia, oraz czy wspomnienie o niej w wezwaniu jest bezpieczne.
  **Nie wdrażać bez tej odpowiedzi** — to obszar, gdzie błąd kosztuje
  wiarygodność pisma.
- **Znalezione w audycie 2026-07-17** (przegląd konkurencji).

### 2.1. Polityka prywatności — weryfikacja + trzy brakujące kategorie danych
- **Gdzie:** `i18n/dictionaries/{pl,en,de}.json`, klucz `privacy`. Strona
  publiczna `/[lang]/privacy`.
- **Status:** ma pełne PL/EN/DE, sama deklaruje się jako „szablon poglądowy…
  powinien zostać zweryfikowany przez wykwalifikowanego prawnika".
- **Opisuje dziś:** formularz kontaktowy, e-podpis oferty (imię + IP +
  przeglądarka), podprocesorów, przekazywanie poza EOG, retencję.
- **⚠️ NIE opisuje czterech przepływów, które panel już realizuje:**
  1. **Korespondencja e-mail** (Moduł 4) — panel pobiera i przechowuje treść
     maili. Retencja 24 miesiące (`MAIL_RETENTION_MONTHS` w `lib/mail.ts`) —
     **ta liczba w polityce musi zgadzać się z kodem**. Sprawdzić, czy az.pl
     wymaga wpisu jako **podprocesor**.
  2. **E-podpis Umowy i NDA** (Moduł 11) — imię, IP, przeglądarka.
  3. **Formularz opinii o projekcie** (Moduł 15) — ocena + IP + przeglądarka.
  4. **Zgoda na case study** (Moduł 15) — patrz 1.4.
- **Do potwierdzenia z prawnikiem:** podstawa prawna dla poczty (art. 6 ust. 1
  lit. b/f RODO?), oraz czy brak przycisku „usuń wiadomość" w panelu (dziś
  kasowanie maila = ręczna operacja na bazie) jest wystarczający wobec prawa
  do usunięcia danych. Jeśli nie — trzeba dobudować (mały zakres).

### 2.2. Nota prawna / Impressum
- **Gdzie:** `app/[lang]/impressum/page.tsx`
- **Status:** treść i podstawa prawna są **poprawne** (polskie: art. 5 UŚUDE +
  art. 20 ust. 3 Prawa przedsiębiorców — NIE wracać do niemieckiego §5 DDG).
  Brakuje wyłącznie danych rejestrowych — to czeka na rejestrację, nie na
  prawnika (`PO_REJESTRACJI.md` pkt 1).
- **Dla prawnika:** tylko przegląd całości razem z polityką prywatności przed
  publikacją z prawdziwymi danymi.

### 2.3. Zastrzeżenie na ofercie — bez ostrzeżenia
- **Gdzie:** `app/[lang]/admin/offers/[id]/print/OfferPrint.tsx` →
  `eSignatureNote`
- **Co to:** „Oferta nie stanowi faktury ani formalnej umowy — jest niewiążącą
  propozycją warunków współpracy". Ma PL/EN/DE.
- **Dlaczego na liście:** to oświadczenie o **(nie)wiążącym charakterze
  dokumentu**, obok którego klient składa e-podpis. Nie ma oznaczenia
  „wymaga weryfikacji", a określa skutek prawny czynności klienta.
- **Znalezione w audycie 2026-07-17.**

### 2.4. Zgoda przy formularzu kontaktowym i kalkulatorze
- **Gdzie:** `i18n/dictionaries/*.json` → `contact.form.consent` /
  `consentLink`. Używane w `components/ContactForm.tsx`,
  `components/SavingsCalculator.tsx`.
- **Status:** PL/EN/DE, publiczne, bez oznaczenia weryfikacji. Niska stawka,
  ale to pierwszy punkt zbierania danych osobowych — warto przy okazji.

### 2.5. Wyłączenie odpowiedzialności za treści
- **Gdzie:** `i18n/dictionaries/*.json` → `impressum.disclaimer`
- **Status:** PL/EN/DE. Wzorowane na niemieckiej konstrukcji „Haftung für
  Inhalte" — **do potwierdzenia, czy ma sens w polskim porządku prawnym**,
  skoro reszta noty została świadomie przestawiona na polskie podstawy.

---

## Sekcja 3 — DO TŁUMACZA (dopiero PO prawniku)

> **Nie zlecaj tego przed Sekcją 1.** Tłumaczenie niezweryfikowanego szkicu to
> praca do wyrzucenia — prawnik zmieni treść, tłumaczenie trzeba będzie zrobić
> od nowa. To była świadoma decyzja przy Module 11, nie przeoczenie.

**Stan dzisiaj:** infrastruktura językowa jest gotowa (`lib/documents.ts` →
`DocLang = "pl" | "en" | "de"`; umowa dziedziczy język z oferty). Brakuje
wyłącznie treści.

**Znana asymetria:** jeśli ustawisz umowie język `en`/`de`, dokument wyrenderuje
nagłówki i e-podpis po angielsku/niemiecku, **ale klauzule zostaną po polsku** —
klient zagraniczny dostanie dokument mieszany. Panel uczciwie o tym informuje
(`CLAUSES_UNTRANSLATED_NOTE`), ale **to jest największa przeszkoda przed
sprzedażą za granicę**.

| Co przetłumaczyć | Gdzie | Ma | Brakuje |
|---|---|---|---|
| Klauzule umowy (15) | `lib/contracts.ts` → `CONTRACT_CLAUSES` | PL | **EN, DE** |
| Klauzule NDA (5) | `lib/contracts.ts` → `NDA_CLAUSES` | PL | **EN, DE** |
| Ostrzeżenie na wezwaniu | `lib/invoices.ts` → `DUNNING_LEGAL_NOTE` | PL | **EN, DE** (brak wzorca `_LANG`, w odróżnieniu od umów) |
| Treść wezwania do zapłaty | `DunningPrint.tsx` | PL na sztywno | **EN, DE** (komponent nie przyjmuje języka) |
| Maile windykacyjne 1 i 2 | `lib/invoices.ts` → `reminderEmailText` | PL | **EN, DE** |
| Mail z wezwaniem | `lib/invoices.ts` → `dunningEmailText` | PL | **EN, DE** |
| Wiadomość powitalna (onboarding) | `lib/projects.ts` → `buildOnboardingWelcomeMessage` | PL | **EN, DE** (funkcja nie przyjmuje języka) |

**Do weryfikacji przez tłumacza (już przetłumaczone przez Claude, nie przez
człowieka):** `PROJECT_REVIEW_CONSENT_TEXT` (patrz 1.4 — najpierw prawnik),
polityka prywatności, `eSignatureNote`, podsumowanie projektu
(`buildProjectClosingSummary`), szablony nurture (`lib/clients.ts`).

---

## Kolejność prac (ważne — nie odwracać)

1. **Prawnik, po polsku** — Sekcja 1 (umowa, NDA, wezwanie, zgoda na case
   study, wzór umowy powierzenia), potem Sekcja 2.
2. **Zdjęcie ostrzeżeń w kodzie** — po akceptacji prawnika usuwamy
   `LEGAL_PLACEHOLDER_NOTE` / `DUNNING_LEGAL_NOTE` z dokumentów (zadanie dla
   Claude, jedna sesja).
3. **Tłumacz** — Sekcja 3, na już zatwierdzonej treści polskiej.
4. **Weryfikacja tłumaczenia** — najlepiej prawnik z danej jurysdykcji dla
   wersji DE (rynek niemiecki jest najbardziej wymagający wobec RODO
   i sformułowań umownych).

**Rejestracja firmy jest niezależna od punktów 1–4** — prawnik może
weryfikować treść, zanim firma powstanie. Ale **żadnego z tych dokumentów nie
da się podpisać z klientem bez zarejestrowanej firmy jako strony umowy**
(patrz `PO_REJESTRACJI.md`).

---

_Powstało: audyt Modułu 29 (2026-07-17), `docs/plany-modulow/29-audyt-koncowy.md`.
Pozycje oznaczone „Znalezione w audycie 2026-07-17" to nowe ustalenia — brief
Modułu 29 ich nie przewidywał._
