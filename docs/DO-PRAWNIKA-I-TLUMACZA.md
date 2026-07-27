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

### 2.1a. ⚠️ Ustalenia Audytu 2 (RODO) — do polityki prywatności (2026-07-23)

Pełne uzasadnienie: `docs/AUDYT-2-WYNIKI.md`. Polityka dziś **nie wymienia**
poniższych, a panel je realizuje — dopisać **jednym ruchem z prawnikiem** przy
uzupełnianiu administratora danych:

- **Retencja — liczby MUSZĄ zgadzać się z kodem** (jak `MAIL_RETENTION_MONTHS`):
  - **Leady bez konwersji: 24 miesiące** od ostatniego kontaktu, potem
    automatyczne usunięcie (`LEADS_RETENTION_MONTHS` w `lib/leads.ts`,
    egzekwuje `purgeStaleLeads` w dziennym cronie). Decyzja właściciela
    2026-07-23. **Zmienisz jedno — zmień drugie.**
  - **Korespondencja e-mail: 24 miesiące** (już w kodzie — patrz 2.1 wyżej).
  - **Klienci + faktury/umowy: bez auto-usuwania** — dane trzymane przez okres
    obowiązku podatkowego (**5 lat**) i przedawnienia roszczeń. Do potwierdzenia
    z prawnikiem/księgową, czy 5 lat + zapas to właściwy okres i od kiedy liczyć.
- **Podprocesorzy do wymienienia:** Neon (baza), Vercel (hosting), **az.pl**
  (poczta — potwierdzić, czy wymaga wpisu), **Resend** (wysyłka maili, USA —
  przekazanie poza EOG), MF/KSeF (faktury, po przejściu na produkcję).
- **Off-site kopii (Audyt 3)** — zaszyfrowany drugi dysk poza domem to **nowe
  miejsce z danymi osobowymi**; wymienić przy przekazywaniu poza EOG/kopiach.
- **Zgoda na case study utrwalana z IP i przeglądarką** (`review_consent_*`
  w `projects`) — trwały dowód zgody; opisać podstawę i okres przechowywania
  (patrz też 1.4).
- **Prawo do usunięcia — jak to działa dziś** (do opisania w polityce prostym
  językiem): usunięcie leada/klienta kasuje kartotekę, logi kontaktu i historię
  zmian; **migawki na fakturach/umowach zostają** (obowiązek podatkowy); dane
  w kopiach zapasowych **wygasają same w ≤4 tygodnie** (rotacja 7 dni + 4 tyg.).
- **Lokalne AI (Ollama) jako przewaga** — jeśli polityka wspomina o
  automatyzacjach AI, warto zaznaczyć, że model działa **lokalnie na sprzęcie
  administratora**, dane nie trafiają do chmury dostawcy LLM (art. o
  minimalizacji i braku przekazania poza EOG działa tu na naszą korzyść).

### 2.1b. ⚠️ Łowca leadów — pozyskiwanie danych z CEIDG (Moduł 52, 2026-07-25)

Panel zaczął **sam pobierać dane firm z rejestru publicznego CEIDG** i odkładać
je do skrzynki kandydatów (`docs/plany-modulow/52-generator-leadow.md`). To jest
**nowa kategoria danych i nowe źródło**, którego polityka prywatności dziś nie
wymienia. Trzy rzeczy do dopisania jednym ruchem z prawnikiem:

- **Kategoria i źródło.** Dane jednoosobowych działalności z CEIDG (imię,
  nazwisko, adres wykonywania działalności, NIP, REGON, telefon, e-mail, strona
  — o ile przedsiębiorca sam je opublikował) **są danymi osobowymi**, mimo że
  dotyczą firmy. Źródło: **rejestr publiczny CEIDG** (art. 14 RODO — dane
  zebrane NIE od osoby, której dotyczą). Dodatkowo status VAT z **Białej listy
  podatników MF** i sygnały z **publicznej strony internetowej firmy** (sama
  strona główna, jedno pobranie, `robots.txt` respektowany).
- **Podstawa i obowiązek informacyjny.** Podstawa: **prawnie uzasadniony
  interes** (marketing bezpośredni B2B, motyw 47 RODO). Ponieważ dane nie
  pochodzą od tej osoby, **obowiązek informacyjny trzeba spełnić przy PIERWSZYM
  kontakcie** — do przygotowania **jedno zdanie do szablonu pierwszego maila**
  („Pana/Pani dane pozyskaliśmy z publicznego rejestru CEIDG; administratorem
  jest…; sprzeciw: …"). To jest treść, której panel dziś **nie ma** i którą musi
  napisać prawnik.
- **Retencja — liczba MUSI zgadzać się z kodem.** **Kandydat nieprzyjęty:
  30 dni** (`KANDYDACI_RETENCJA_DNI` w `lib/leadHunterRun.ts`, egzekwuje
  `purgeStareKandydaty` w dziennym cronie). Kandydat **przyjęty** staje się
  leadem i podlega retencji 24 mies. z punktu wyżej. Na **czarnej liście**
  (`lead_blacklist`) zostaje wyłącznie **NIP + znormalizowana nazwa + powód** —
  świadoma minimalizacja, żeby nie trzymać profilu osoby, której nie zamierzamy
  niczego proponować; do potwierdzenia, czy taki minimalny zapis „nie kontaktuj
  się ponownie" jest w porządku (naszym zdaniem to realizacja sprzeciwu, nie
  jego obejście).
- **Czego panel NIE robi** (warto, żeby prawnik o tym wiedział, bo to zmienia
  ocenę ryzyka): nie wysyła kandydatom **niczego** automatycznie, nie kupuje baz
  danych, nie scrapuje LinkedIna, nie profiluje modelem AI — sito jest
  deterministyczne (stałe w `lib/leadHunter.ts`), a każdą decyzję „odzywamy się
  / nie odzywamy" podejmuje człowiek ręcznie.

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

## Oferta — zapisy podatkowe (dodane 2026-07-27, DO SPRAWDZENIA)

Na dokumencie oferty (`OfferPrint.tsx`, słownik `DICT`) doszły dwa zdania,
w trzech językach. Powstały z potrzeby produktowej („na ofercie nie jest
napisane, że cena nie zawiera podatku"), NIE z porady prawnej — proszę
o weryfikację brzmienia przed pierwszą ofertą dla klienta zagranicznego.

**1. Kwoty netto (zawsze):**
- PL: „Wszystkie kwoty są kwotami NETTO i nie zawierają podatku VAT. Podatek
  zostanie doliczony na fakturze zgodnie z obowiązującymi przepisami."
- EN: „All amounts are NET and exclude VAT. Tax will be added on the invoice
  in accordance with applicable regulations."
- DE: „Alle Beträge sind NETTOBETRÄGE und enthalten keine Mehrwertsteuer. Die
  Steuer wird auf der Rechnung gemäß den geltenden Vorschriften ausgewiesen."

**2. Odwrotne obciążenie (tylko gdy `klient_kraj` ≠ Polska):**
- PL: „Dla kontrahenta spoza Polski rozliczenie podatku może nastąpić w kraju
  nabywcy (odwrotne obciążenie) — stawka zostanie potwierdzona na fakturze."
- EN / DE: odpowiedniki w tym samym duchu (patrz `DICT` w `OfferPrint.tsx`).

Zdanie o odwrotnym obciążeniu jest celowo WARUNKOWE („może nastąpić",
„zostanie potwierdzona na fakturze") — oferta nie przesądza stawki, bo zależy
ona od statusu VAT-UE kontrahenta i rodzaju usługi. Jeśli to za mało ostrożne
albo przeciwnie, zbyt zachowawcze — proszę o poprawione brzmienie.

## Aneks do umowy — nowy dokument (dodane 2026-07-27, DO SPRAWDZENIA)

Panel potrafi od dziś sporządzić **aneks do podpisanej umowy** (Moduł 58).
Powstał, bo blokada edycji odsyłała po aneks, którego system nie miał —
podpisana umowa nie miała żadnej drogi zmiany.

**Kształt dokumentu.** Aneks NIE powtarza treści umowy ani jej klauzul.
Pokazuje wyłącznie warunki, które się zmieniają, w układzie „dotychczasowe
brzmienie → nowe brzmienie", i kończy klauzulą o pozostałych postanowieniach.
Zmienić da się cztery rzeczy: przedmiot umowy, wynagrodzenie, walutę,
termin realizacji. Danych stron aneks nie zmienia (to byłaby nowa umowa).

**Do weryfikacji — zdania wygenerowane przez panel, w trzech językach**
(`DICT` w `ContractPrint.tsx`, klucze `amendment*`). Powstały z praktyki
redakcyjnej, NIE z porady prawnej:

1. Zdanie wprowadzające:
   - PL: „Strony zgodnie postanawiają, że umowa wskazana powyżej ulega zmianie
     w następującym zakresie:"
   - EN: „The parties agree that the agreement referred to above is amended as
     follows:"
   - DE: „Die Parteien vereinbaren, dass der oben genannte Vertrag wie folgt
     geändert wird:"
2. Klauzula zamykająca (ostatni paragraf aneksu):
   - PL: „Pozostałe postanowienia umowy pozostają bez zmian."
   - EN: „All remaining provisions of the agreement remain unchanged."
   - DE: „Die übrigen Bestimmungen des Vertrages bleiben unverändert."

**Pytania do prawnika:**

- Czy powyższe dwa zdania wystarczą, czy aneks powinien mieć własny komparycję
  (oznaczenie stron, miejsce i datę zawarcia) ponad to, co już drukujemy
  (numer aneksu, referencja i data umowy-matki, obie strony, data
  przygotowania, e-podpis)?
- **Czy aneks może być zawarty elektronicznie tak samo jak umowa.** Panel
  używa dla aneksu dokładnie tego samego mechanizmu e-podpisu co dla umowy
  (imię i nazwisko + IP + przeglądarka + znacznik czasu). Jeśli umowa
  wymagałaby formy pisemnej pod rygorem nieważności, aneks dziedziczy ten
  wymóg — proszę o jednoznaczną odpowiedź, bo od niej zależy, czy e-podpis
  aneksu jest w ogóle wystarczający.
- Czy klauzula „Zmiana zakresu" w `CONTRACT_CLAUSES` (mówi o „odrębnej wycenie
  lub aneksie") jest spójna z tym, co aneks faktycznie robi.
- Czy przy zmianie wynagrodzenia aneks powinien wprost odnosić się do
  rozliczenia prac już wykonanych.

**Uwaga o numeracji.** Aneksy numerowane są w obrębie jednej umowy
(„Aneks nr 1", „nr 2"), referencja to `ANEKS-{nr}-{referencja umowy}`.
Kolejny aneks pokazuje jako „dotychczasowe brzmienie" warunki z ostatniego
PODPISANEGO aneksu, nie z pierwotnej umowy — proszę potwierdzić, że to
poprawne ujęcie („umowa w brzmieniu nadanym aneksem nr 1").

## Retencja dowodu e-podpisu — decyzja do potwierdzenia (2026-07-27)

Przy e-podpisie oferty, umowy, NDA i aneksu zapisujemy imię i nazwisko,
**adres IP i przeglądarkę** oraz znacznik czasu. Do tej pory te dane leżały
**bezterminowo** — Audyt 2 objął retencją leady i korespondencję, e-podpisu
nikt nie rozstrzygnął.

**Decyzja właściciela: 6 lat od podpisu** (`ESIGN_PROOF_RETENTION_MONTHS = 72`
w `lib/leadRetention.ts`), po czym dzienny cron zeruje **IP i przeglądarkę**.
Imię, nazwisko i data podpisu ZOSTAJĄ — to treść drukowana pod dokumentem,
a ich usunięcie zostawiłoby podpisany dokument z pustą rubryką.

**Do potwierdzenia przez prawnika:**
- Czy 6 lat (ogólny termin przedawnienia roszczeń majątkowych) to właściwy
  okres, czy dla tej kategorii danych powinien być inny.
- **Ten okres musi trafić do polityki prywatności** — dziś polityka nie mówi
  o retencji danych e-podpisu w ogóle (patrz sekcja 2.1a, gdzie wymieniono
  e-podpis jako kategorię danych bez podanego okresu).
