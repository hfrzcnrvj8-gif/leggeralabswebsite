# Prompt do wklejenia w nowym czacie — moduł UMOWY

> Powstał 2026-07-26, po domknięciu Ofert (Moduł 57).
> **Uzupełniony 2026-07-27 o wnioski z audytu Modułu 57** — patrz sekcje
> „ANEKS", „Blokady", „Co audyt Ofert zostawił Umowom".

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

## ⚠️ ANEKS JEST JUŻ ZBUDOWANY (2026-07-27) — sekcja niżej jest HISTORIĄ

Właściciel poprosił o wdrożenie wniosków audytu od razu, więc aneks powstał
poza tym modułem. **Nie buduj go drugi raz.** Stan: `HUB_SETUP.md` →
„Moduł 58 — Aneks do umowy". Zbudowane też wszystkie wnioski otwarte
z audytu (hamulec publicznych tras, retencja e-podpisu, licznik otwarć,
kolor „Odrzucona") — patrz „Poprawki po audycie Modułu 57" tamże.

**Co z tego zostaje dla Ciebie:**

1. **Sprawdź aneks sondą, tak jak audyt sprawdził oferty.** Powstał
   w jednej sesji i przeszedł testy jednostkowe + przebieg end-to-end, ale
   nie przeszedł osobnego audytu. Pytania kontrolne: czy da się wysłać aneks
   po jego podpisaniu; czy `share-links` (Moduł 40) obsługuje typ `aneks`;
   czy aneks pokazuje się wszędzie tam, gdzie panel liczy umowy (Pulpit,
   oś czasu klienta, `signedContractRate`, dzienny mail) i czy POWINIEN.
2. **Treść prawna aneksu czeka na prawnika** —
   `docs/DO-PRAWNIKA-I-TLUMACZA.md` → „Aneks do umowy". Kluczowe pytanie:
   czy aneks wolno w ogóle zawrzeć e-podpisem, skoro dziedziczy formę umowy.
3. **Layout modułu Umowy dalej otwarty** — zgłoszenie właściciela z 26.07
   (niżej) nie zostało ruszone.

Reszta tej sekcji opisuje, DLACZEGO aneks powstał i jak jest zrobiony —
zostaje jako uzasadnienie decyzji, nie jako zadanie.

## Tło: dlaczego aneks musiał powstać

`lib/blokadaDokumentu.ts` odmawia zmiany podpisanej umowy zdaniem: **„Zmiana
wymaga aneksu."** Aneksu w systemie NIE MA. Panel wysyła właściciela po coś,
czego nie potrafi zrobić — a to jedyna droga wyjścia z zablokowanego
dokumentu, więc bez niej blokada jest ślepym zaułkiem.

Porównaj z dwoma pozostałymi dokumentami, bo tam ta droga istnieje i ma
dokładnie ten sam kształt:

| Dokument | Zablokowany bo | Droga wyjścia | Stan |
|---|---|---|---|
| Faktura | ma numer | korekta (`/api/invoices/:id/correct`) | ✅ jest |
| Oferta | wysłana | nowa wersja (`/api/offers/:id/version`) | ✅ jest |
| Umowa | podpisana | **aneks** | ❌ BRAK |

Kształt do powtórzenia (wzoruj się na `version` i `correct`, NIE wymyślaj
trzeciego wzorca):

- Aneks to **osobny wiersz** w `contracts` wskazujący na oryginał — jak
  `parent_offer_id` w ofertach. Oryginał **zostaje podpisany i nietknięty**
  (to jest cała różnica wobec „cichej edycji", przed którą broni blokada);
  aneks ma własny numer, własny link i własny e-podpis.
- **Nie kopiuj wzorca `superseded_at` z ofert.** Zastąpiona oferta wypada
  z liczników, bo nie jest ani wygrana, ani przegrana. Aneksowana umowa jest
  dalej obowiązująca — obie strony ją podpisały. Numeruj i licz obie.
- Zapytaj właściciela, czy aneks ma być pełną kopią treści z zaznaczonymi
  zmianami, czy samym opisem zmiany („§3 otrzymuje brzmienie…"). To decyzja
  nietechniczna i **prawna** — brzmienie klauzul aneksu idzie do
  `docs/DO-PRAWNIKA-I-TLUMACZA.md`, nie pisz go sam.
- Dopóki aneksu nie ma, komunikat blokady w `lib/blokadaDokumentu.ts` obiecuje
  coś, czego nie da się zrobić. Albo zbuduj aneks, albo zmień to zdanie.

## Blokady dokumentów — sprawdź je tak, jak sprawdził audyt

Audyt Modułu 57 (2026-07-27) znalazł **siedem otwartych uchwytów HTTP**
w tym, co dokumentacja opisywała jako „domknięte". Umowy przeszły ten audyt
czysto, ale mają dziś jeden dokument bez tabel podrzędnych — **każda tabela,
którą dołożysz (klauzule aneksu, załączniki, strony umowy), to nowy komplet
tras do zablokowania.**

Metoda, i tylko ta metoda: **sonda `curl` po KAŻDYM uchwycie HTTP osobno**,
na lokalnym dev-panelu, z odczytem stanu bazy po każdej próbie. Przegląd kodu
przepuścił wszystkie siedem — bo pliki *importują* blokadę i wołają ją
w pierwszym uchwycie, więc grep po pliku daje trafienie, a `DELETE` obok jest
otwarty. Gotowa sonda do przerobienia: `HUB_SETUP.md` → „Audyt Modułu 57".

Sprawdź też **drogę wyjścia**, nie tylko blokadę: czy da się z zablokowanego
dokumentu przejść dalej, czy właściciel utyka.

## Co audyt Ofert zostawił Umowom

1. **`accepted_ip` / `accepted_user_agent` bez retencji.** Umowy mają ten sam
   zestaw pól co oferty (e-podpis). Audyt 2 objął retencją leady (24 mies.);
   dowód złożenia oświadczenia woli żyje bezterminowo i nikt tego nie
   rozstrzygnął. Rozstrzygnij dla OBU dokumentów naraz — to jedna decyzja.
2. **Umowa nie ma migawki.** Oferta od 2026-07-27 zamraża treść przy wysyłce,
   więc klient widzi to, co dostał. Umowa renderuje publicznie dane ŻYWE.
   Dziś ratuje ją blokada `PATCH`-a, ale to ochrona przez zakaz, nie przez
   dowód: przy sporze nie ma czego pokazać sprzed podpisu. Zapytaj właściciela,
   czy umowa ma dostać `migawka` wzorem oferty (te same dwie kolumny).
   **Jeśli tak — zasada z audytu:** do migawki idzie to, co NAPISAŁ właściciel;
   żywe zostaje to, co ZROBIŁ klient (podpis, nazwisko) i sterowanie
   dokumentem (status, unieważnienie linku). Odwrotna kolejność scalania
   (`{...migawka, ...żywe}`) unieważnia całą funkcję po cichu.
3. **Publiczne trasy bez hamulca.** `contracts/public/:token/accept` nie ma
   odpowiednika `lib/rateLimit.ts` — tak samo jak trasy oferty. Jedna decyzja
   dla wszystkich publicznych tras dokumentów.
4. **Kolor statusu — zostało pół sprawy.** Rozstrzygnięcie z 2026-07-27
   („wygrywa paleta apki") objęło WYŁĄCZNIE status „Wysłana". `Odrzucona` jest
   dalej czerwona w panelu i szara w apce, w Ofertach i w Umowach. Domknij to
   w jednym podejściu dla obu modułów — i **nie zaczynaj od nowa dyskusji
   o „Wysłanej"**, ta jest zamknięta (fiolet marki, faktury świadomie
   neutralne).
5. **`contractReference` jest już naprawiona** (rok przez `documentYear()`,
   nie `new Date()`) — ale sprawdź, czy w Umowach nie ma drugiej takiej
   linijki. Ta pułapka wyszła w tym projekcie trzy razy; w Ofertach audyt
   przeszedł cały moduł greptem i nie znalazł już ani jednej.

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
6. **Sprawdzenie per PLIK kłamie — licz UCHWYTY HTTP.** Największe znalezisko
   audytu Ofert: pliki, które importują blokadę i wołają ją w `PATCH`, mają
   otwarty `DELETE` tuż niżej. Sprawdzaj `export async function` po kolei.
7. **Dokumentacja twierdziła, że jest domknięte.** Tabela w `HUB_SETUP.md`
   mówiła „trasa odmawia" o trasach, które zwracały 200. Nie ufaj opisowi
   własnej poprzedniej rundy — sprawdź trasę.
8. **Blokada bez drogi wyjścia to pułapka** (patrz aneks wyżej). Za każdym
   razem, gdy dokładasz zakaz, sprawdź, dokąd on odsyła i czy to coś istnieje.
9. **Pole może być „wolne mimo blokady" i niewidoczne dla klienta naraz.**
   W Ofertach ważność dało się przedłużyć jako ustępstwo wobec klienta,
   a klient dalej widział starą datę. Jeśli dołożysz Umowom migawkę, przejdź
   `POLA_MIMO_BLOKADY_UMOWY` pole po polu i zapytaj: czy druga strona to widzi?

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
