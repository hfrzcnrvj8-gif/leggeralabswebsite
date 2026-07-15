# Checklista prawna — do wykonania PO rejestracji działalności

Ten plik istnieje, bo część elementów zgodności prawnej **świadomie odłożono**
do momentu, aż właściciel zarejestruje działalność gospodarczą (na dzień
2026-07-12 firma NIE jest jeszcze zarejestrowana). Do tego czasu nie ma
prawdziwych danych rejestrowych (nazwa, NIP, adres, REGON), więc te miejsca
zostały przygotowane, ale nie wypełnione. **Po rejestracji przejść całą listę.**

## 1. Nota prawna (`/impressum`) — WŁĄCZYĆ z prawdziwymi danymi
- Plik: `app/[lang]/impressum/page.tsx` — wypełnić blok `COMPANY`:
  nazwa + forma prawna, adres, osoba reprezentująca, telefon, **NIP**
  (obowiązkowy — art. 20 ust. 3 Prawa przedsiębiorców), ewentualnie REGON.
- Przywrócić link do noty:
  - `components/Footer.tsx` — odkomentować/wstawić `<Link href="/{lang}/impressum">`.
  - `components/Header.tsx` — przywrócić wpis w tablicy `pages`
    (jest zostawiony jako komentarz „Po rejestracji przywrócić: …").
- Podstawa prawna w treści jest już poprawna (polska: art. 5 UŚUDE +
  art. 20 ust. 3 Prawa przedsiębiorców) — NIE wracać do niemieckiego §5 DDG.

## 2. Polityka prywatności (`/privacy`) — uzupełnić administratora
- Treść (`i18n/dictionaries/*.json`, klucz `privacy`) opisuje już rzetelnie
  przepływy danych (formularz kontaktowy, e-podpis oferty zapisujący IP +
  user-agent, podprocesorzy, przekazywanie poza EOG, retencja).
- Do uzupełnienia po rejestracji: formalne dane administratora
  (pełna nazwa, adres, NIP) — dziś intro świadomie mówi, że to „szablon
  do uzupełnienia o dane rejestrowe".
- **DO DOPISANIA — korespondencja e-mail (Moduł 4, 2026-07-15).** Panel
  pobiera i przechowuje treść maili ze skrzynki az.pl (`mail_messages`), więc
  polityka musi wymieniać nową kategorię danych: **korespondencja e-mail**
  (adres nadawcy, temat, treść wiadomości).
  - **Retencja: 24 miesiące** — decyzja właściciela 2026-07-15, wdrożona w
    kodzie (`MAIL_RETENTION_MONTHS` w `lib/mail.ts`, czyszczenie dziennym
    cronem). Ta liczba w polityce MUSI zgadzać się z kodem — jeśli któraś
    się zmieni, zmień obie.
  - **Cel i podstawa**: obsługa korespondencji i realizacja umowy
    (art. 6 ust. 1 lit. b/f RODO) — do potwierdzenia z prawnikiem.
  - **Zakres**: panel przechowuje wyłącznie roboczą kopię (tylko INBOX, tylko
    treść, bez załączników). Oryginały zostają na serwerze pocztowym az.pl
    (osobny podmiot — sprawdzić, czy az.pl wymaga wpisu jako **podprocesor**).
  - **Usuwanie na żądanie**: dziś kasowanie maila to ręczna operacja na bazie
    — brak przycisku „usuń wiadomość" w panelu. Jeśli prawnik uzna to za
    niewystarczające, trzeba go dodać (mały zakres).
- **Zalecane:** przed publikacją z prawdziwymi danymi klientów dać całość
  (polityka + nota) do weryfikacji prawnikowi — kod czyni ją przejrzystą,
  ale nie zastępuje opinii prawnej.

## 3. KSeF (moduł Faktury) — przełączyć z trybu TESTOWEGO na produkcję
- Faza 2 audytu budowana jest wyłącznie na rządowym środowisku TESTOWYM
  (sztuczny NIP/podmiot). Produkcja wymaga: zarejestrowanej działalności,
  prawdziwego NIP-u oraz uwierzytelnienia Profilem Zaufanym / podpisem
  kwalifikowanym (od 2027 — certyfikatem KSeF).
- Przełączenie na produkcję to świadomy, osobny krok z udziałem właściciela
  — nie następuje automatycznie (bramka trybu prod jest zablokowana bez
  realnych danych firmy).

## 4. Ustawienia sprzedawcy w panelu (`/admin` → ustawienia firmy)
- Wpisać dane firmowe używane na fakturach/ofertach (nazwa, NIP, adres,
  konto/IBAN, ewentualnie bank + SWIFT), status VAT (płatnik/zwolniony)
  i podstawę zwolnienia, jeśli dotyczy.

## 5. KSeF przychodzący (moduł Koszty) — rozważyć automatyczny import
- Dziś import faktur zakupowych z KSeF (Koszty → „Pobierz z KSeF") jest
  **ręczny** — świadomie, bo na środowisku testowym i przy zero prawdziwych
  faktur automat mieliłby na próżno.
- Po przełączeniu KSeF na produkcję (pkt 3) i pojawieniu się realnych faktur
  kosztowych warto dodać **automatyczny codzienny import** przez istniejący
  dzienny cron (bez nowego wpisu w `vercel.json` — dołożyć wywołanie w
  `app/api/leads/notify`, wzorem automatycznych przypomnień o zaległościach).
  Wtedy panel sam dociąga nowe faktury zakupowe; dziś to funkcja „na zapas".

---
_Kontekst i historia decyzji: pamięć Claude `comprehensive-audit-plan`._
