# Checklista prawna — do wykonania PO rejestracji działalności

Ten plik istnieje, bo część elementów zgodności prawnej **świadomie odłożono**
do momentu, aż właściciel zarejestruje działalność gospodarczą (na dzień
2026-07-12 firma NIE jest jeszcze zarejestrowana). Do tego czasu nie ma
prawdziwych danych rejestrowych (nazwa, NIP, adres, REGON), więc te miejsca
zostały przygotowane, ale nie wypełnione. **Po rejestracji przejść całą listę.**

> **Audyt Modułu 29 (2026-07-17) — sprawdzenie kompletności.** Zadaniem audytu
> było ustalić, czy ta lista jest nadal kompletna po Modułach 11–28 (powstałych
> już po jej napisaniu). **Nie była.** Pięć pierwotnych pozycji (1–5) jest nadal
> aktualnych i żadnej nie „załatwiły" nowe moduły, ale doszły **pozycje 6–12**
> poniżej. Treści prawne do weryfikacji przez prawnika zebrano osobno w
> [`docs/DO-PRAWNIKA-I-TLUMACZA.md`](docs/DO-PRAWNIKA-I-TLUMACZA.md) — tamten
> dokument i ten uzupełniają się: tu jest to, co wymaga **rejestracji firmy**,
> tam to, co wymaga **prawnika** (część pozycji wymaga obu).

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

# Pozycje dopisane w audycie Modułu 29 (2026-07-17)

> Wszystkie wynikają z Modułów 11–28, zbudowanych po napisaniu listy powyżej.

## 6. Nota prawna — przywrócić wpis w sitemapie
- Audyt wykrył, że `/impressum` był **odlinkowany z menu i stopki (świadomie),
  ale nadal siedział w `app/sitemap.ts`** — czyli Google dostawał zaproszenie do
  zaindeksowania strony z widocznymi placeholderami „[Pełna nazwa firmy]",
  „[NIP / ...]". Wpis **usunięto z sitemapy** w ramach audytu.
- **Po rejestracji:** dopisać `/impressum` z powrotem do tablicy `routes` w
  `app/sitemap.ts` — razem z odkomentowaniem linków w Header/Footer (pkt 1).

## 7. Dane firmy na Umowie, NDA i Wezwaniu do zapłaty (Moduły 11, 13)
- Wydruk umowy (`ContractPrint.tsx`) i wezwania (`DunningPrint.tsx`) drukują
  nazwę, adres, NIP i e-mail sprzedawcy — **zaciągane z Ustawień firmy, dziś
  pustych**. Umowa bez oznaczenia jednej ze stron jest bezużyteczna, a wezwanie
  bez danych wierzyciela nie ma waloru formalnego.
- Pkt 4 wyżej mówi tylko o „fakturach/ofertach" — powstał przed Modułami 11/13.
  **To ta sama czynność**, tylko konsekwencje sięgają dalej, niż pkt 4 zakładał.

## 8. Firmowy rachunek bankowy + zgłoszenie do Białej Listy VAT
- Numer konta z Ustawień firmy trafia na faktury **oraz na wezwanie do zapłaty**
  (`DunningPrint.tsx` — „Płatność na rachunek: …").
- Potrzebny **firmowy rachunek rozliczeniowy** (nie prywatny ROR) — powstaje
  dopiero po rejestracji i nadaniu NIP-u.
- **Zgłosić go do Białej Listy VAT** (przez CEIDG/urząd): panel już ostrzega, że
  przelew powyżej 15 000 zł na konto spoza Białej Listy grozi utratą kosztu
  (`lib/mf.ts`) — **ta sama zasada działa w drugą stronę**, klienci będą
  sprawdzać nasz numer.

## 9. Stawka odsetek ustawowych za opóźnienie (Moduł 13)
- `stawka_odsetek_ustawowych` w Ustawieniach firmy jest **domyślnie pusta** i
  panel z założenia nigdy jej sam nie ustawia ani nie aktualizuje (świadoma
  decyzja Modułu 13 — błąd w tym miejscu kosztuje wiarygodność pisma).
- Dopóki jest pusta, **wezwanie nie pokazuje żadnych odsetek**.
- Wpisać po rejestracji i **pamiętać o okresowej aktualizacji** (stawkę ogłasza
  MF/NBP, zmienia się w czasie).

## 10. Rezerwa podatkowa — trzy stawki ustawione na zero
- `rezerwa_vat_procent`, `rezerwa_pit_procent`, `rezerwa_zus_procent` są
  **domyślnie 0**, więc funkcja „ile z tej wpłaty odłożyć" (Pulpit) nic nie liczy.
- Wypełnić dopiero po rejestracji — wtedy wiadomo: VAT czy zwolnienie, forma
  opodatkowania (skala/liniowy/ryczałt) i realny ZUS.
- **Uwaga:** ZUS będzie się zmieniać w czasie (ulga na start → mały ZUS), więc
  tę stawkę trzeba będzie zaktualizować kilka razy w pierwszych latach.

## 11. Polityka prywatności — trzy nowe kategorie danych (Moduły 11, 15)
- Pkt 2 wyżej dopisuje korespondencję e-mail (Moduł 4). Audyt wykrył, że
  brakuje jeszcze trzech przepływów, które panel **już realizuje**:
  - **e-podpis Umowy i NDA** — imię, IP, przeglądarka (jak przy ofercie),
  - **formularz opinii o projekcie** (`/opinia/[token]`) — ocena + IP + przeglądarka,
  - **zgoda na case study/referencję** — pełna treść zgody utrwalana razem z
    danymi osoby, która ją zaznaczyła.
- Dopisać **jednym ruchem z prawnikiem** przy uzupełnianiu administratora.

## 12. Publiczna strona Referencji (Moduł 15)
- `app/[lang]/references/page.tsx` to gotowa, publiczna strona z opiniami
  klientów (dziś pusta). Treść zgody wymienia „Leggera Labs" jako podmiot
  publikujący.
- Publikowanie nazwy i opinii klienta pod szyldem firmy zakłada, że firma
  istnieje i jest wskazana jako administrator w polityce prywatności (pkt 2).
- Treść zgody → `docs/DO-PRAWNIKA-I-TLUMACZA.md` pkt 1.4.

---
_Kontekst i historia decyzji: pamięć Claude `comprehensive-audit-plan`.
Uzupełnienie pozycji 6–12: audyt Modułu 29, `docs/plany-modulow/29-audyt-koncowy.md`._
