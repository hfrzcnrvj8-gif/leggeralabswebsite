# Brief: domknięcie apki — luki wobec panelu + funkcje mobile-only

> Repo apki: `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`.
> Powstał 2026-07-20 z inwentaryzacji **opartej na kodzie**, nie na
> dokumentacji: lista tras `app/api/**/route.ts` zestawiona z tym, co realnie
> woła `APIClient.swift`. Trasa istniejąca w panelu, której Swift nie woła ani
> razu, jest twardym dowodem luki — i tak powstała ta lista.
>
> **Zakres jest za duży na jeden czat.** Fazy niżej są ponumerowane i możliwie
> niezależne. Bierz jedną na czat.

## Co już zrobione (nie powtarzaj)

**Faza 13.0 — promocja leada na klienta ✅ (2026-07-20, w czacie stopera).**
`APIClient.promujLeada()` → `AppStore.promujLeada()` → przycisk „Utwórz
klienta" w zakładce Akcje profilu leada. Trasa jest idempotentna po stronie
serwera (lead z `client_id` dostaje z powrotem istniejącego klienta), więc apka
świadomie nie blokuje przycisku „na wszelki wypadek" — znika on tylko dlatego,
że po awansie nie ma już czego robić. Profil czyta **świeży rekord ze sklepu**
(`biezacyLead`), nie kopię z konstruktora — inaczej przycisk zostawałby na
ekranie po udanej akcji i wyglądał na zepsuty.

**Faza 13.1, paczka 1 — „poza biurkiem" ✅ (2026-07-20).** Cztery pozycje
z czternastu, wybrane wg kosztu braku, nie łatwości budowy:

1. **Kontakty nurture** — wiersz „Zaplanowane kontakty" na Pulpicie jest
   klikalny: szkic z serwera → poprawka → wysyłka (jedno żądanie, które wysyła,
   odhacza i loguje zdarzenie na osi klienta), plus „załatwione bez maila"
   gestem w bok. Apka **nie ma własnego szablonu** i nie powinna dostać —
   `buildNurtureMessage` zna rytm 14/90 dni, język i link do opinii; kopia
   w Swifcie byłaby czwartym bliźniakiem do synchronizowania ręcznie.
2. **Opinie klienta** — sekcja w profilu projektu w trzech stanach (zebrana /
   poproszono i czekamy / nic nie ruszyło): prośba mailem, kopiowanie samego
   linku, wpisanie opinii zebranej ustnie. To **zdjęło „prośbę o opinię"
   z poziomu 3** — opinię zbiera się po spotkaniu, nie po powrocie do biurka.
   Szkic podsumowania jest lokalny, krótszy i tylko po polsku; przy projekcie
   obcojęzycznym ekran mówi wprost, że pełną wersję zrobi panel (świadome
   odstępstwo — panel nie wystawia `buildProjectClosingSummary` żadną trasą).
3. **NIP / VAT-UE** przy dodawaniu klienta — numer polski idzie do Białej Listy
   MF, numer z kodem kraju do VIES (ta sama reguła co w panelu: „PL" nigdy
   przez VIES). Nie nadpisuje pól już wypełnionych.
4. **Logi zmian klienta** — zakładka „Logi", której klient nie miał, choć lead
   miał ją od początku. Wygląd logu wyjechał do wspólnego `ListaZmian`.

**Cztery poprawki po weryfikacji na telefonie (ten sam dzień).** Żadnej z nich
nie dało się zobaczyć przed oddaniem apki właścicielowi — warto wiedzieć, czego
szukać następnym razem:

- **Nie było czego kliknąć.** Kontakty nurture powstają wyłącznie automatycznie
  (14 i 90 dni po zamknięciu projektu Z KLIENTEM), więc sekcja była pusta i na
  produkcji, i w danych testowych. Dev-seed (`lib/dev-db.ts`) ma teraz jeden
  wymagalny kontakt, a apka furtkę `LEGGERA_DEV_NURTURE=1`. **Funkcja bez
  danych testowych jest funkcją niesprawdzalną.**
- **Wiersz nie wyglądał na klikalny** — brakowało strzałki, którą ma lead obok.
  Właściciel zobaczył Pulpit i powiedział „nie widzę nic nowego". Miał rację.
- **Adres z Białej Listy ginął przy zapisie.** Komentarz w apce twierdził, że
  `POST /api/clients` nie przyjmuje ulicy i kodu — nieprawda, przyjmuje
  `ulica`, `kod`, `miasto`, `kraj`. Apka wysyłała samo miasto. Sprawdzaj trasę,
  nie własny komentarz sprzed godziny.
- **Face ID: dwa błędy.** Monit czekał na rundę HTTP do produkcji (stąd „lag
  przy drugim uruchomieniu"), a karencja zerowała się przy każdym powrocie na
  pierwszy plan, bo `.inactive` pada w OBIE strony — blokada po pierwszym
  odblokowaniu nie wracała już nigdy. Drugi błąd nie był zgłoszony; wyszedł
  przy czytaniu tego samego pliku.

Uboczne: `AppStore.bladAkcji` — osobne pole błędu dla akcji z arkuszy, żeby
komunikat został przy przycisku, a nie malował paska na całej liście. To wąski
krok w stronę A1 z audytu Fazy 11½, nie jego domknięcie.

## Zasada przewodnia (właściciel, 2026-07-20)

Cokolwiek dokładasz, ma trzymać cztery rzeczy, na których stoi ten produkt:

1. **maksymalna automatyka** — system sam przypomina, sam kolejkuje, sam
   podpowiada; właściciel zatwierdza, nie pilnuje;
2. **przypomnienia** — nic ważnego nie ginie po cichu;
3. **monitoring na żywo** — widać, co się dzieje, bez wchodzenia w moduł;
4. **wszystko związane z klientem/leadem jest tak oznaczone i trafia do
   historii tego konta.** To jest reguła twarda. Nowa funkcja, która tworzy
   zdarzenie bez przypięcia go do konta, jest niedokończona — patrz
   `logClientEvent()` w panelu i moduły 22/30 (`docs/plany-modulow/`).

## Faza 13.1 — luki wobec panelu, których nikt nie zdecydował

Te trasy istnieją w panelu i **nie mają w kodzie żadnego komentarza
uzasadniającego brak** — w odróżnieniu od faktur/KSeF/umów, które są świadomym
„poziomem 3" (patrz `Finanse.swift:17-18`, `README.md:46-48`). Kolejność wg
tego, ile kosztuje ich brak:

| Co | Trasa panelu | Uwaga |
|---|---|---|
| Onboarding projektu | `/api/projects/[id]/onboarding` (+`/[itemId]`) | cały Moduł 14 niewidoczny w telefonie |
| Opinie klienta | `/api/projects/[id]/{review,review-link,request-review}` | cały Moduł 15; prośbę o opinię wysyła się po spotkaniu |
| Kamienie milowe | `/api/projects/[id]/milestones` (×3) | projekt da się podglądać, nie da się kształtować |
| Zakładanie zadań, kolejność | `POST /api/projects/[id]/tasks`, `/tasks/reorder` | dziś można tylko odhaczać istniejące |
| Zasoby, zależności | `/api/projects/[id]/{resources,dependencies}` | |
| Ustawienia | `/api/settings` | apka nie zmienia żadnej konfiguracji |
| Wskaźniki | `/api/stats` | Pulpit żyje wyłącznie z `hub/today` |
| Follow-upy / nurture | `/api/client-followups/[id]{,/draft,/send}` | filar „automatyki", a w telefonie go nie ma |
| Koszty cykliczne | `/api/recurring`, `/api/recurring-costs` | |
| Weryfikacja NIP / VIES | `/api/mf/nip/[nip]`, `/api/vies/...` | na telefonie sensowniejsze niż przy biurku — dane wpisuje się w terenie |
| Eksporty CSV | `/leads/export`, `/invoices/export`, `/costs/export` | |
| Kalendarz ICS | `/api/calendar/ics` | |
| Planowanie notatki | `/api/notes/[id]/schedule`, `/activity` | |
| Zmiany klienta | `/api/clients/[id]/changes` | lead to ma, klient nie |

### Weryfikacja listy w kodzie (2026-07-20) — lista się obroniła

Sprawdzone ponownie, tą samą metodą (137 tras `app/api/**/route.ts` × 82
literały ścieżek w repo apki). **Wszystkie 14 pozycji potwierdzone jako
niewołane.** Cały ruch sieciowy apki jest w jednym pliku (`APIClient.swift`),
bez sklejania URL-i z kawałków — zbiór jest więc zamknięty, a nie „tyle
udało się znaleźć". Widżet i Share Extension nie budują własnych żądań.

Trzy sprostowania, które zmieniają wycenę (brief opisywał je za ostro):

- **Onboarding, kamienie i zasoby są już CZYTANE.** `GET /api/projects/[id]`
  zwraca je w środku, apka dekoduje i wyświetla. Brakuje wyłącznie zapisu —
  modele stoją, więc to nie jest „cały Moduł 14 niewidoczny".
- **Zadania: edycja działa.** `PATCH /tasks/[taskId]` jest wołany; brak dotyczy
  tylko zakładania (`POST`) i kolejności (`/reorder`).
- **Zmiany klienta były prawie darmowe** — wersja dla leada już działała,
  a kształt odpowiedzi jest identyczny (zrobione, patrz Faza 13.1 ✅ niżej).

### Luki, których ta lista NIE zawierała (uzupełnienie inwentarza)

Wyszły przy tej samej weryfikacji. Nie są częścią Fazy 13.1 — do decyzji
osobno, wpisane tu, żeby nie trzeba było ich odkrywać trzeci raz:

- `/api/admin/devices` (GET) i `/[id]` (DELETE) — **jedyna z wagą
  bezpieczeństwa**: odebranie dostępu zgubionemu telefonowi wymaga dziś panelu.
- `/api/projects/timeline` — dane Gantta (`{projects, dependencies}`).
- `/api/catalog` — katalog produktów, w apce nieobecny w całości.
- `/api/offer-templates` (+`/[id]`, `apply-template`, `duplicate`).
- `/api/costs/analytics`, `/api/costs/hints`, `/api/costs/import-ksef`.
- `/api/references`, `/api/contacts/lookup`, `/api/links/orphans`,
  `/api/leads/discover`, `/api/leads/notify`.
- **Brak usuwania czegokolwiek**: `DELETE` na projekcie, leadzie, kliencie,
  wpisie aktywności (trzy trasy), wpisie czasu, wpłacie do faktury. Apka
  potrafi tworzyć i zmieniać, nie potrafi cofnąć.
- `/api/notes/[id]` GET, `/api/time/[id]` (PATCH|DELETE).

Pominięte świadomie jako niedotyczące apki: trasy publiczne/tokenowe, webhooki
i ops (`ksef/auth/test`, `backup/ping`, `mail/outbox/run`, `telefonia/webhook`).

**Świadomie NIE ruszaj** (to jest „poziom 3", udokumentowany): wystawianie
i edycja faktur, korekty, KSeF (apka pokazuje status, nigdy go nie zmienia),
pozycje i akceptacja ofert, cały moduł umów.

**Dalszy ciąg Fazy 13.1 ma własny brief:**
`14-brief-faza13-paczka2.md` (paczka 2 — kształtowanie projektu; paczka 3 —
ustawienia, `/api/stats`, cykliczne, eksporty, ICS — opisana tam w tabeli).

## Faza 13.2 — funkcje, które mają sens TYLKO na telefonie

Ustalone z przeglądu Linear / Notion / Things / Superhuman / Pipedrive /
Sunsama (2026-07-20). Warto wiedzieć: **mobilny Linear jest pod tym względem
ubogi** — bez widżetów, bez Siri, bez offline'u. Apka Leggery ma już Live
Activity, widżet, Siri, Share Extension i OCR, czyli więcej niż wzorzec.

1. **Skaner wizytówek → kontakt.** Najlepszy stosunek zysku do kosztu, bo cała
   maszyneria stoi: aparat → OCR lokalnym modelem → zapis działa dla paragonów
   (`KosztZParagonuView.swift`, `/costs/[id]/ocr`). Wizytówka to ta sama droga
   z innym parserem. Pipedrive daje to wszystkim planom. Wizytówka istnieje
   fizycznie i tylko w chwili spotkania — desktop nie ma jak jej przejąć.
2. **Rozpoznawanie dzwoniącego z bazy CRM** (Pipedrive CallerID) + logowanie
   rozmowy jednym stuknięciem. Moduł telefonii i ręczne logowanie już są;
   brakuje tego, żeby telefon sam powiedział „to lead z wtorku".
   Technicznie: `CallKit` / `CXCallDirectoryProvider` — do sprawdzenia, czy
   działa na darmowym koncie Apple (patrz `wgrywanie-na-telefon`).
3. **Odpowiedź prosto z powiadomienia** (wzorzec Superhumana: przytrzymaj →
   odpisz → koniec). Pełna poczta w apce już jest, ale każda odpowiedź wymaga
   jej otwarcia.
4. **Ergonomia kciuka.** Superhuman świadomie zaprojektował gesty ZAMIAST
   portować skróty klawiszowe: swipe zamiast przytrzymania, powrót gestem
   gdziekolwiek na ekranie, przełącznik folderów przy DOLNEJ krawędzi. To nie
   nowa funkcja, tylko rewizja tego, co jest.

**Świadomie odradzone** (nie wciągaj bez wyraźnej prośby): przypomnienia
oparte o lokalizację — Things nie zrobiło tego przez lata mimo próśb, a
solo-konsultant nie ma tras handlowych; Apple Watch — duży koszt, wąskie
zastosowanie.

## Faza 13.3 — Dynamic Island i Live Activity poza stoperem

Właściciel chce „w pełni premium" apkę iOS. Sufity platformy są już zbadane
i **nie walcz z nimi** (patrz `12-brief-stoper-do-poprawki.md`): setnych
sekundy nie da się pokazać, ekran blokady gubi sekundy po ~3 minutach, iOS
ubija aktywność po ~8 h.

Kandydaci, od najsensowniejszego:

1. ✅ **Przetwarzanie paragonu / wizytówki** — ZBUDOWANE 2026-07-21
   (`15-brief-faza13-3-wyspa-ocr.md`). Odczyt przeniesiony na **sesję w tle**
   (`URLSessionConfiguration.background`), bo bez tego Wyspa zamarzłaby razem
   z uśpioną apką; wynik potrafi wrócić do apki obudzonej przez system, a gdy
   iOS ją ubił — czeka na dysku i otwiera gotowy formularz. **Wykonalność
   rozstrzygnięta eksperymentem na telefonie, nie założeniem**: 61-sekundowe
   żądanie skończyło się przy apce zepchniętej w tło (darmowe konto, bez push).
   Szczegóły, dowód i to, czego NIE dało się obejrzeć bez dotyku (rozwinięta
   Wyspa, ekran blokady), w README apki, sekcja „Odczyt zdjęcia w tle".
2. **Wysyłka maila z kolejki** — `outbox` ma odłożoną wysyłkę, a cron Vercela
   chodzi **raz dziennie** (patrz `apka-zalaczniki-skrzynka-faza8`). „Wyśle się
   o 8:00" pokazane na Wyspie zamienia niewidoczne oczekiwanie w widoczny stan.
3. **Rozmowa z leadem w toku** → po rozłączeniu „Zaloguj rozmowę" jednym
   stuknięciem. Spina się z punktem 2 Fazy 13.2 i z regułą „wszystko trafia do
   historii konta".

Czego **nie** robić: stałej Wyspy Pulpitu — została odrzucona w audycie Fazy
11½ (`apka-audyt-faza11-polowa`) i iOS i tak ubiłby ją po 8 h.

## Faza 13.4 — audyt na koniec

Dopiero PO powyższych: optymalizacja, błędy, niespójne funkcje i grafiki.
Zamówione przez właściciela wprost. Wchodzi w to lista „świadomie nie
naprawione" z audytu Fazy 11½ — z **A1 (wspólne pole błędu)** jako największym
długiem.

**Uwaga kolejnościowa:** to jest audyt APKI. Osobno stoi
`docs/AUDYTY-KONCOWE.md` — siedem audytów całości (bezpieczeństwo, RODO,
niezawodność, obserwowalność, wydajność), gdzie **obserwowalność jest
pierwsza**: 89 miejsc z `console.error` i zero systemu, który by je zbierał.
Te dwa audyty to nie to samo i nie zastępują się nawzajem.
