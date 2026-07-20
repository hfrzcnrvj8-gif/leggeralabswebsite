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

**Świadomie NIE ruszaj** (to jest „poziom 3", udokumentowany): wystawianie
i edycja faktur, korekty, KSeF (apka pokazuje status, nigdy go nie zmienia),
pozycje i akceptacja ofert, cały moduł umów.

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

1. **Przetwarzanie paragonu / wizytówki** — OCR lokalnym modelem trwa
   zauważalnie, a dziś nie widać, że cokolwiek się dzieje. Krótka aktywność
   z postępem i wynikiem to podręcznikowe użycie Wyspy.
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
