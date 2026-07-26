# Prompt do wklejenia w nowym czacie — moduł UMOWY

> Powstał 2026-07-26, po domknięciu Ofert (Moduł 57).

Kontynuujemy audyt UI/UX i kompletności panelu (leggeralabs.pl/admin, repo
bieżące) oraz apki natywnej iPhone/iPad (`leggera-hub-ios`, osobne repo:
`/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`), moduł po module,
w kolejności lejka sprzedaży. **Pulpit, Leady, Klienci i Oferty są zrobione.**

**ZANIM ZACZNIESZ — przeczytaj:**
- `docs/plany-modulow/51-audyt-uiux-panel-i-apka.md` — kontekst inicjatywy
  i sekcje „Stan po module…", ze **„Stan po module «Oferty»"** włącznie:
  jest tam lista rzeczy świadomie nieruszonych, z których **dwie wracają
  wprost do Ciebie** (patrz niżej).
- `HUB_SETUP.md` → „Moduł 57 (audyt UI/UX) — Oferty" (wzorce, które właśnie
  ustaliliśmy i które warto powtórzyć) oraz wszystko o Umowach i NDA.
- `docs/plany-modulow/00-mapa-drogi-klienta.md` — Umowy to Etap 6–7
  (Akceptacja → Start projektu); patrz też Moduł 11 (umowy i NDA)
  i Moduł 14 (checklista onboardingowa).
- `docs/plany-modulow/KANDYDACI-FUTURE-PROOF.md` — zanim zaproponujesz
  cokolwiek „bo tak robi konkurencja".
- `CLAUDE.md` — zasady projektu.

**Teraz bierzemy moduł: Umowy (i NDA).**

Sprawdź i oceń, a potem zaproponuj właścicielowi KONKRETNE poprawki — nie
pytaj ogólnie „co zmienić".

## Dwie sprawy przekazane wprost z modułu Oferty

1. **Kolor statusu dokumentów — rozstrzygnąć RAZ, dla wszystkich.** Panel
   konsekwentnie maluje „dokument w obiegu" na cyjanowo (Oferty, Umowy,
   Faktury), apka równie konsekwentnie na fioletowo. To dwie spójne palety,
   nie błąd jednego modułu — dlatego w Ofertach świadomie tego nie ruszono.
   Przy Klientach precedens brzmiał „wygrała apka". Zdecyduj z właścicielem
   i zrób to w JEDNYM podejściu dla wszystkich trzech modułów, nie po kawałku.
2. **`contractReference` jest już naprawiona** (rok czytany przez
   `documentYear()`, nie `new Date()`) — ale sprawdź, czy w Umowach nie ma
   drugiej takiej linijki. Ta pułapka wyszła w tym projekcie trzy razy.

## Zgłoszenie właściciela do tego modułu (2026-07-26)

„Layout modułu Umowy jest jakiś dziwny, «Wyślij do podpisu» zajmuje za dużo
miejsca, myślę że powinno być tutaj w ogóle więcej opcji." Ostre rogi płyty
pod przyciskiem są już naprawione (przycisk dostał własną sekcję), ale
**reszta zgłoszenia jest otwarta**: profil umowy w apce ma dziś jedną akcję
i pustą sekcję „Zakres prac", gdy umowa jest szkicem. Zacznij od pytania,
czego właściciel realnie potrzebuje przy umowie w terenie — nie zgaduj.

## Co sprawdzić

1. **Parytet między platformami** — panel (`/admin/contracts`,
   `ContractsDashboard.tsx`, `lib/contracts.ts`), iPhone i iPad
   (`UmowyView.swift`). Dowód luki w apce to trasa panelu, której
   `APIClient.swift` nie woła — grep po `/api/contracts`. Odwrotnie NIE działa.
2. **Domknięcie lejka.** Oferta → umowa → **start projektu**: czy „bramka
   umowy" (Moduł 31, twarda tylko dla projektów z `client_id`) jest widoczna
   z obu stron i czy podpisanie umowy realnie odblokowuje projekt.
   Czy z umowy widać projekt, a z projektu umowę.
3. **Czy odrzucenie/wygaśnięcie umowy zostawia ślad** — w Ofertach okazało
   się, że oś czasu klienta znała wyłącznie sukces (`contract_created`,
   `contract_sent`, `contract_signed` — brak `contract_rejected`). Sprawdź,
   czy to samo nie dotyczy Umów, i czy NDA odrzucone przez kontrahenta ma
   gdzie zapisać „dlaczego".
4. **Profil dokumentu wobec wzorca z Modułu 57.** Umowy mają dziś ten sam
   `max-w-3xl` i najpewniej te same nieopisane pola co Oferty przed zmianą.
   Rozważ `SekcjaProfilu`/`WierszPola` + `max-w-5xl` (NIE pełny ekran).
5. **Sufity i wsad** — `GET /api/contracts` oddaje wszystko bez limitu
   i bez `total`; wzorzec do przeniesienia jest gotowy w `app/api/offers`
   (sufit z ostrzeżeniem) i `app/api/offers/bulk`.
6. **Walidacja statusu.** W Ofertach `PATCH` przyjmował dowolny string do
   40 znaków — sprawdź, czy Umowy nie mają tej samej dziury (`CONTRACT_STATUSES`
   istnieje, pytanie czy ktoś go używa po stronie zapisu).
7. **Poziom premium** — swipe/long-press na liście, klikalność wierszy,
   filtr w pasku, skróty (`/`, `j`/`k`, Enter — wzorzec z Ofert).

## Lekcje warte sprawdzenia u Umów

1. **„Na sztywno w kodzie" cicho psuje wskaźniki** (w Ofertach: VAT 23% dla
   każdej pozycji, także zagranicznej).
2. **Idempotencja MUSI mieć widoczny ślad.** Serwer dedupował umowę z oferty
   od dawna, ale karta mówiła „Wygeneruj" nawet nad podpisaną umową.
   Sprawdź NDA i wysyłkę do podpisu pod tym samym kątem.
3. **Lista, która kłamie pustką** (ustalenie A1) — stan pusty ma mówić, czego
   brakuje i co to zmienia.
4. **Weryfikuj POMIAREM, nie zrzutem.** Panel oglądaj lokalnie
   (`npm run dev` + narzędzia przeglądarki), wysokości i szerokości mierz
   w przeglądarce.
5. **Symulator: nie trać czasu na kalibrację dotyku.** Zrzut ma inną skalę niż
   przestrzeń współrzędnych `tap` — w module Oferty poszło na to kilka rund.
   Weryfikuj pełnym gestem albo po stanie w bazie, nie precyzyjnym tapem.

## Czego NIE ruszać

- **Rzeczy z `PO_REJESTRACJI.md`** — firma nie jest zarejestrowana (nota
  prawna, dane sprzedawcy, KSeF test→produkcja). Treść klauzul umownych to
  materiał do `docs/DO-PRAWNIKA-I-TLUMACZA.md`, nie do samodzielnego pisania.
- **Przeprowadzka na NAS** (Moduł 55) — czeka na rejestrację firmy.
- **Reguła „model tylko proponuje"** — nowy punkt użycia lokalnego LLM wymaga
  wyraźnej prośby właściciela.
- **Poziom 2 apki dla dokumentów** — podgląd i wysyłka tak, tworzenie
  i edycja klauzul nie. W Ofertach dołożyliśmy wyłącznie ZAMKNIĘCIE statusem,
  bo to sprawa telefoniczna; przy Umowach analogiczne byłoby „podpisana"/
  „odrzucona" — zapytaj, zamiast zakładać.

## Na koniec modułu

- Dopisz „Stan po module Umowy" do
  `docs/plany-modulow/51-audyt-uiux-panel-i-apka.md`.
- Uzupełnij `HUB_SETUP.md`.
- Dopisz moduł do `lib/instrukcje.ts` — dopiero gdy jest sprawdzony.
- Przygotuj prompt do następnego modułu w kolejce: **Projekty**.
