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

---
_Kontekst i historia decyzji: pamięć Claude `comprehensive-audit-plan`._
