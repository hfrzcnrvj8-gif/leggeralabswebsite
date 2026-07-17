# Plany modułów — kolejne kroki Leggera Hub (po audycie przepływów 2026-07-13)

**Leggera Hub** = wszechogarniający program do prowadzenia firmy (leady, klienci,
projekty, faktury, koszty, poczta, kalendarz — w jednym miejscu, docelowo także na
telefonie). Ten folder to zestaw **briefów wdrożeniowych**, po jednym na moduł.
Każdy moduł robimy w **osobnym czacie**, żeby zaczynać ze świeżym kontekstem. Plik
danego modułu jest samowystarczalny — nowy czat nie musi znać poprzednich rozmów.

> **Zacznij od [`00-mapa-drogi-klienta.md`](00-mapa-drogi-klienta.md)** —
> nadrzędny dokument (2026-07-14) mapujący pełną drogę klienta od leada do
> stałej relacji, etap po etapie, z rekomendowaną kolejnością budowy i
> wskaźnikami do monitorowania. Lista modułów poniżej to konkretne briefy
> wdrożeniowe wynikające z tej mapy.

## Jak używać (dla właściciela)

1. Otwórz nowy czat z Claude Code w tym repo.
2. Wklej polecenie w stylu:
   > „Zrób moduł opisany w `docs/plany-modulow/01-podpowiedzi-leadow.md`.
   > Najpierw przeczytaj ten plik i CLAUDE.md, potem zaproponuj plan i zapytaj
   > o otwarte decyzje, dopiero potem buduj."
3. Na końcu czatu, jak zawsze:
   `rm -f .git/index.lock && git add -A && git commit && git push`.

## Kolejność (rekomendowana)

Od najprostszego i najbardziej „domykającego proces" do największego:

| # | Moduł | Rozmiar | Plik |
|---|-------|---------|------|
| 1 | ✅ Podpowiedzi dla leadów + mapa procesu (⑤) | mały | [01-podpowiedzi-leadow.md](01-podpowiedzi-leadow.md) |
| 2 | ✅ Nurture — automatyczne przypomnienia po zamknięciu (⑥) | mały/średni | [02-nurture-automatyczny.md](02-nurture-automatyczny.md) |
| 3 | ✅ Kanały kontaktu — telefon/WhatsApp/LinkedIn (⑦a) | średni | [03-kanaly-kontaktu.md](03-kanaly-kontaktu.md) |
| 4 | ✅ Natywna poczta w panelu (IMAP/SMTP az.pl) — podgląd, auto-przypisanie, odpowiadanie, lista „do obsłużenia” (⑦b) | duży | [04-skrzynka-mailowa.md](04-skrzynka-mailowa.md) |
| 4b | ✅ Poczta: pełny klient — Etap 1 ✅ (nowa wiadomość/przekaż/odpowiedz wszystkim/cofnij wysyłkę/szablony); Etap 2 ✅ rdzeń (foldery IMAP: Odebrane/Wysłane/Kosz/Archiwum, MOVE, klawiatura, bulk actions — Drafts/CONDSTORE/flagi/outbox+cron świadomie odłożone, patrz dokument); Etap 3 ✅ (screener, VIP, snooze, wątkowanie, follow-up nudge — patrz 4f) | duży, wieloetapowy | [04b-poczta-pelny-klient.md](04b-poczta-pelny-klient.md) |
| 4c | ✅ Podpis mailowy: symetria, gradient marki, wzorce topowych firm | mały/średni, wizualny | [04c-podpis-mailowy.md](04c-podpis-mailowy.md) |
| 4d | ✅ Poczta: dopasowanie do klienta (LUKA), kartoteka, szybkie akcje, szerokość | średni | [04d-poczta-powiazanie-i-ux.md](04d-poczta-powiazanie-i-ux.md) |
| 4e | ✅ Poczta: upodobnienie UX do Apple Mail (pasek akcji na górze, kategorie w sidebarze, baner wypisu z listy) | średni, wizualny | [04e-poczta-apple-mail-ux.md](04e-poczta-apple-mail-ux.md) |
| 4f | ✅ Poczta: follow-up nudge („wysłałeś, cisza od N dni") — ostatni nieskończony punkt Etapu 3 | średni, nowy kształt zapytania (agregacja po wątku w poprzek folderów) | [04f-poczta-nudge.md](04f-poczta-nudge.md) |
| 5 | Leggera Hub jako aplikacja mobilna (PWA) — cała apka na telefonie | duży | [05-mobilna-aplikacja.md](05-mobilna-aplikacja.md) |
| 6 | ✅ AI: infrastruktura Ollama (fundament pod 7 i 8, nie samodzielna funkcja) | mały | [06-ai-infrastruktura-ollama.md](06-ai-infrastruktura-ollama.md) |
| 7 | ✅ AI: szkice odpowiedzi mailowych (wymaga 4 i 6) | średni | [07-ai-szkice-mailowe.md](07-ai-szkice-mailowe.md) |
| 8 | ✅ AI: odczyt paragonów/faktur zakupowych — OCR w Kosztach (wymaga 6) | średni | [08-ai-ocr-koszty.md](08-ai-ocr-koszty.md) |
| 9 | ✅ Koszty jako branżowy standard — metoda płatności, inspiracje z liderów (wymaga 8) | duży, wieloetapowy | [09-koszty-branzowy-standard.md](09-koszty-branzowy-standard.md) |
| 10 | ✅ Dopracowanie Kalendarza — agregacja działań, tagi, dopasowanie do klienta | otwarty zakres, zacznij od pytań | [10-kalendarz-dopracowanie.md](10-kalendarz-dopracowanie.md) |
| 11 | ✅ Umowy + NDA | duży, częściowo prawny | [11-umowy-i-nda.md](11-umowy-i-nda.md) |
| 12 | ✅ Fundament linkowania (podstrony faktur/ofert + klikalna oś czasu klienta) | średni, infrastrukturalny | [12-fundament-linkowania.md](12-fundament-linkowania.md) |
| 13 | ✅ Faktury: eskalacja windykacji + rezerwa podatkowa (wymaga 11 dla treści prawnej) | średni | [13-faktury-windykacja.md](13-faktury-windykacja.md) |
| 14 | ✅ Onboarding klienta (wymaga 11) | mały/średni | [14-onboarding-klienta.md](14-onboarding-klienta.md) |
| 15 | ✅ Zamknięcie projektu i opinie (najlepiej po 12) | mały/średni | [15-zamkniecie-i-opinie.md](15-zamkniecie-i-opinie.md) |
| 16 | Wsparcie posprzedażowe — dopiero gdy będzie realna potrzeba | mały, otwarty zakres | [16-wsparcie-posprzedazowe.md](16-wsparcie-posprzedazowe.md) |
| 17 | ✅ Retencja i polecenia | mały/średni | [17-retencja-i-polecenia.md](17-retencja-i-polecenia.md) |
| 18 | ✅ Pulpit: wskaźniki zdrowia biznesu | średni | [18-pulpit-wskazniki.md](18-pulpit-wskazniki.md) |
| 19 | ✅ Śledzenie czasu pracy | mały/średni | [19-sledzenie-czasu.md](19-sledzenie-czasu.md) |
| 20 | ✅ Szablony ofert / pakiety usług | mały | [20-szablony-ofert.md](20-szablony-ofert.md) |
| 21 | ✅ Audyt wizualny: panel na poziomie Apple/Linear — wspólny `Modal` (10 kopii → 1, jeden spring), `ViewTabs`/`ViewSwitch` (przejeżdżające podkreślenie + przenikanie list), gradient marki jako jedna klasa + jeden stan „wybrane” w całym panelu, Kanban bez ramek. Odłożone świadomie: struktura pasków narzędzi, emoji vs ikony (patrz `HUB_SETUP.md` → „Audyt wizualny”) | otwarty zakres, zacznij od zrzutów ekranu | [21-audyt-wizualny-premium.md](21-audyt-wizualny-premium.md) |
| 22 | ✅ **Powiązania wszędzie** — jeden `LinkPicker` (klient+lead) zamiast trzech wzorców, użyty w Poczcie/Leadach/Umowach/Projektach/Kalendarzu/Kosztach; aliasy adresów e-mail (mail od klienta z innego adresu już nie zostaje „Nieprzypisany” na zawsze); lead → istniejący klient; PATCH umów; kolumny w kosztach i notatkach. **Odłożone świadomie:** `lead_id`/`project_id` w UI Faktur/Ofert — tamtejszy `ClientPickerButton` obsługuje tylko klientów; wymaga osobnej decyzji (patrz `HUB_SETUP.md` → „Moduł 22”). **Sprostowanie 2026-07-17:** stało tu „picker kopiuje dane nabywcy, **nie linkuje**" — nieprawda i to ona wprowadziła w błąd brief 30: `pickClient` ustawia `client_id` **obok** migawki danych nabywcy, a PATCH-e to zapisują. Brakuje wyłącznie `lead_id`/`project_id` | duży, **fundament pod 23 i 26** | [22-powiazania-wszedzie.md](22-powiazania-wszedzie.md) |
| 23 | ✅ **Zakładki w kliencie/leadzie** (Wizytówka / Historia kontaktu / Logi zmian, wewnątrz `*DetailPanel.tsx` → działają i w modalu, i na podstronie `[id]`; `ViewTabs` dostał prop `layoutId`) + **audyt zmian od zera** (`field_changes`, hook w PATCH-ach klientów i leadów, własny endpoint `/changes`, `lib/audit.ts` czysty ↔ `lib/auditLog.ts` serwerowy — inaczej build wywala `node:async_hooks`) + **lista klientów tylko do podglądu** (zostaje sam status, symetria z leadami). **Świadomie odłożone:** audyt faktur/ofert/projektów — `entity` jest tekstem, więc to jedna linia w ich PATCH-u (patrz `HUB_SETUP.md` → „Moduł 23") | duży, po 22 | [23-zakladki-klient-lead.md](23-zakladki-klient-lead.md) |
| 24 | ✅ **Centrum powiadomień** — dzwonek w sidebarze (panel nie ma górnego paska) jako **kronika zdarzeń**, świadomie NIE druga lista „do zrobienia": Pulpit liczy stan na żywo, dzwonek odpowiada na „czego przegapiłem". Tabela `notifications` z `dedupe_key` (bez niego cron dokładałby te same wpisy co rano); hooki **w miejscu zdarzenia**, nie tylko w cronie (formularz i płatność dzwonią natychmiast — cron leci raz dziennie o 06:00 i tylko na Vercelu, więc sam by nie wystarczył); `lib/notifications.ts` czysty ↔ `lib/notificationLog.ts` serwerowy. **Świadomie NIE dzwoni:** lead dodany ręcznie, wpłata częściowa, newslettery, toasty (patrz `HUB_SETUP.md` → „Moduł 24"). Retencja 30 dni, `read_at` pod przyszły push (Moduł 5) | średni | [24-centrum-powiadomien.md](24-centrum-powiadomien.md) |
| 25 | ✅ **Menu kontekstowe (prawy przycisk)** — `Popover` rozszerzony **wstecznie zgodnie** o `anchor`/`open`/`onClose` (20 konsumentów nietkniętych), nowe `useContextMenu`/`ContextMenu`/`ContextMenuItem` + `useCopy()`. Wdrożone na 6 modułach (Faktury, Poczta, Leady, Klienci, Koszty, Projekty) — **jako skrót, nie zamiennik**: widoczne przyciski zostają. Menu dubluje akcje i **dokłada kopiowanie** (e-mail/NIP/numer/kwota) + „otwórz w nowej karcie". Przy okazji: ręczne menu Poczty (dwunasty wzorzec, `absolute` + własny click-outside) usunięte na rzecz `PropertyMenu`, oraz naprawiony **istniejący wcześniej** błąd `place()` — mierzył wysokość przed zamontowaniem menu (250 px na oko), więc wysokie menu uciekały poza dolną krawędź. **Świadomie odłożone:** „powiel jako szkic" (dotyka logiki zapisu, nie UI), long-press na mobile (Moduł 5) | średni | [25-menu-kontekstowe.md](25-menu-kontekstowe.md) |
| 26 | ✅ Notatnik — powiązania z CRM (`LinkPicker` + filtry), naprawa duplikatów (idempotencja na serwerze: `notes.project_id`/`event_id`, nie stan przycisku), przypięcie+archiwum, → kalendarz z dziedziczeniem powiązania, profil + podstrona `[id]`, wyszukiwarka po tagach i logu. Przy okazji naprawiona wspólna `EditableTextarea` (mierzyła wysokość tylko przy zmianie treści) | średni, po 22 | [26-notatnik.md](26-notatnik.md) |
| 27 | ✅ **Gęstość ekranu + liquid glass w przełącznikach** — Faktury/Oferty: `sm:max-w-2xl sm:grid-cols-3` → `xl:grid-cols-6` na pełną szerokość (904 px martwego pasa zagospodarowane **nowymi KPI**, decyzja właściciela: kolumny, nie wykres) — Faktury dostały najstarszą zaległość / opłacone w mies. / szkice, Oferty skuteczność / wygasające w 7 dni / średnią wartość. Legenda Kosztów: wpis 317 px → 190 px (**wykres świadomie zostaje mały** — decyzja z Modułu 9, nie cofaj bez pytania). Część B: wzorzec `ViewTabs` (`layoutId` + spring) rozciągnięty na `FilterPills` (Poczta + Notatnik naraz) i nowy `SegmentedSwitch` w Osi czasu; pasek zaznaczenia Poczty dostał `AnimatePresence` (`height`+`opacity`, inaczej skok układu). Szkło na kontenerach segmentowych (decyzja właściciela), **tagi Notatnika świadomie bez szkła**. `layoutId` **wymagany, bez domyślki** — oba komponenty renderują po dwa zestawy naraz. **Mobile:** poziomy scroll (530 px @ 375) jest sprzed tej zmiany, należy do Modułu 5 | mały/średni | [27-gestosc-i-liquid-glass.md](27-gestosc-i-liquid-glass.md) |
| 28 | ✅ **Kalendarz: pełna doba** — `DAY_RANGE` 0–24 zamiast liczonego z wydarzeń `timelineRange()` (błędne koło: żeby noc się pojawiła, musiało tam już być wydarzenie, którego nie było jak dodać); osiem scrolli → **jeden wspólny** + `sticky` nagłówki dni; auto-scroll na bieżącą godzinę (decyzja właściciela, `HOUR_PX = 48` zostaje). Pomiar wykazał, że tamte osiem `overflow-y-auto` **nigdy nie przewijało** (żaden przodek nie ogranicza wysokości) — stąd `max-h` na wspólnym kontenerze. Naprawiona pułapka graniczna: klik w dolną krawędź dawałby **00:00** zamiast 23:45 (`minutesToTime(1440)` zawija dobę). **Świadomie odłożone:** układ całego panelu związany z viewportem (`min-h` → `h` w `AppShell`) — naprawiłby to u źródła, ale dotyka wszystkich modułów | mały/średni | [28-kalendarz-24h.md](28-kalendarz-24h.md) |

| 29 | ✅ **Ostateczny audyt drogi klienta** (2026-07-17) — zaplanowany z góry („po ukończeniu modułów 11-20"). Cztery produkty oddane: **[`docs/DO-PRAWNIKA-I-TLUMACZA.md`](../DO-PRAWNIKA-I-TLUMACZA.md)** (zbiorcza lista, obiecana 2026-07-15), werdykt drogi krok po kroku (2 PEŁNE, 5 SZWÓW, **3 DZIURY**), rejestr odłożonych + `PO_REJESTRACJI.md` (**nie był kompletny** — dopisano pozycje 6–12). Trzy wzorce → briefy **30/31/32**; czwarty dopisany do briefu 16. Naprawione od ręki: `/impressum` wypadł z sitemapy (Google indeksował placeholdery), skorygowane nieaktualne „brak KSeF" i „brak załączników" w tym README/HUB_SETUP. Konkurencja: **rozwijać panel** — rynek nie ma produktu łączącego obóz księgowy z sprzedażowym; jedyna prawdziwa luka to **Moduł 5 (mobilna)**. Wyniki: `HUB_SETUP.md` → „Moduł 29" | średni, zacznij od pytań | [29-audyt-koncowy.md](29-audyt-koncowy.md) |
| 30 | ⏳ **NASTĘPNY — Powiązanie z Klientem** — korzeń łączący Kroki 2/6/10 drogi klienta: oferta/faktura założona „od zera" nie ma klienta i nic o tym nie mówi → brak retencji, pusta karta klienta, pusta oś czasu. Domyka odłożoną pozycję Modułu 22. **Brief zweryfikowany gretem 2026-07-17** (sekcja „PRZECZYTAJ NAJPIERW" — trzy sprostowania: pickery Faktur/Ofert **już linkują**, dziura to **jedna trasa** `POST /api/invoices`, Krok 2 mapy poprawiony przez Moduł 32). **Zacznij od pytań.** Gotowy prompt: [PROMPT-30.md](PROMPT-30.md) | średni, z audytu 29 | [30-powiazanie-z-klientem.md](30-powiazanie-z-klientem.md) |
| 31 | ⏳ **Umowy: pułapka bramki + widoczność** — projekt założony ręcznie **nigdy nie przejdzie na „W trakcie"** (umowy nie da się przypiąć do projektu z UI, choć serwer to potrafi). Umowy nieobecne na Pulpicie, w dziennym mailu, wyszukiwarce, karcie klienta i statystykach. Cisza po e-podpisie oferty | średni, z audytu 29 | [31-umowy-widoczne.md](31-umowy-widoczne.md) |
| 32 | ✅ **Teksty prowadzące sprzed Modułów 11–17** (2026-07-17) — mapa procesu **12 → 15 kroków** (doszły Umowa/Onboarding/Wsparcie; **NDA świadomie NIE osobnym krokiem** — jest opcjonalne, więc mieszka w podpowiedzi przy „Rozmowa umówiona", gdzie stoi przycisk wysyłki), przesunięte `LEAD_STATUS_STEP`/`CLIENT_STATUS_STEP`. Naprawione **przypomnienie, którego nie było widać**: `isOverdue()` odrzucał zamknięte leady w pierwszej linii — **tylko dla „Odrzucone"** (decyzja właściciela; „Zamknięte - sukces" zostaje wyłączone, bo dublowałoby retencję Modułu 17). Cztery obietnice mapy drogi rozstrzygnięte **na korzyść kodu** (szablon odmowy = kolizja ze świadomą decyzją Modułu 4b o pustych szablonach; status „kwalifikowany" nigdy nie istniał; przypomnienie przed terminem odrzucone w Module 13). `quick-log` → paleta poleceń (`PALETTE_ONLY`), **nie sidebar**. **Odnotowane, nie naprawione:** „automatycznie zakłada Klienta" → Moduł 30; szersza nieaktualność znaczników 🆕/🔧 w mapie drogi (patrz `HUB_SETUP.md` → „Moduł 32") | mały/średni, z audytu 29 | [32-teksty-prowadzace.md](32-teksty-prowadzace.md) |

| 33 | ⏳ **Ikony zamiast emoji w panelu** (emoji zostają w mailach) — dokończenie migracji z 2026-07-11, nie nowy kierunek: emoji pełnią dziś rolę **ikon systemowych** (`icon="🏢"`, foldery Poczty), a renderują się inaczej na każdym systemie, nie dziedziczą koloru i nie trzymają siatki. ~128 linii, ale `Menu.tsx` już przyjmuje `ReactNode` → **bez zmian typów**. **Wyjątek na stałe: podpis mailowy / mail dzienny zostają na emoji** (w HTML-u maila nie ma komponentów React). **Po 30 i 31** (decyzja właściciela 2026-07-17) | mały/średni, wizualny | [33-ikony-zamiast-emoji.md](33-ikony-zamiast-emoji.md) |

Moduły 1–3 są niezależne — można je robić w dowolnej kolejności. Moduł 4 (poczta)
jest duży i najlepiej robić go bliżej końca. **Moduł 5 (mobilny) robimy NA SAMYM
KOŃCU** — mobilny sens ma dopiero to, co realnie jest już w Leggera Hub, a duża
część tej pracy to doprowadzenie każdego widoku do używalności na wąskim ekranie.

**Moduły 6–8 (AI, lokalne modele przez Ollamę)** to osobna, młodsza gałąź
(decyzja 2026-07-14, patrz niżej) — Moduł 6 to fundament (musi być pierwszy z
tej trójki), Moduł 8 jest od niego zależny ale niezależny od poczty, więc może
powstać wcześniej niż Moduł 4. Moduł 7 wymaga zarówno Modułu 4 (poczta musi
istnieć), jak i Modułu 6.

## Zasady wspólne dla WSZYSTKICH modułów (nie łamać bez pytania)

Zebrane z `CLAUDE.md` i pamięci projektu — każdy czat MUSI ich przestrzegać:

- **Panel jednoosobowy** — jedno hasło, brak ról/wielu użytkowników. To świadomy
  wybór, nie luka.
- **Zero AI/LLM w logice** przypominaczy, podpowiedzi, dopasowań i kolejkowania —
  to zawsze deterministyczne reguły i statyczny tekst w kodzie, bez wyjątków.
  **Wyjątek, świadomie dodany 2026-07-14** (patrz Moduły 6–8): punktowe,
  jawnie zainicjowane kliknięciem użycia **lokalnego** modelu (przez Ollamę na
  własnym sprzęcie właściciela, NIGDY chmurowe API) do generowania treści do
  zaakceptowania — np. szkic odpowiedzi mailowej, odczyt paragonu. Model
  zawsze proponuje, właściciel zawsze zatwierdza/edytuje/wysyła ręcznie; model
  nigdy nie decyduje, nie wysyła, nie zapisuje niczego bez tego kroku.
- **Tylko miękkie podpowiedzi, nigdy twarde bramki** — nic nie może blokować
  właścicielowi przejścia dalej. Podpowiedź informuje, nie zabrania.
- **Właściciel nie czyta kodu** — każdą decyzję nietechniczną zadaj wprost przez
  pytanie; nie zakładaj domyślnych wartości tam, gdzie liczy się preferencja.
- **Design system**: `.card-paper`, `.glass` (tylko chrome), `.hairline`,
  `.btn-primary` (jedno CTA/widok), paleta marki (`brand.purple/pink/gold/cyan`),
  **ikony `@tabler/icons-react` w chrome, emoji w treści** — panel ma dziś jedno
  i drugie. **Kierunek rozstrzygnięty 2026-07-17: w panelu ikony, w mailach
  emoji** (wdrożenie = Moduł 33, po 30/31). Do tego czasu: dopasuj się do
  otoczenia edytowanego pliku, **nie ujednolicaj hurtem przy okazji** (patrz
  `CLAUDE.md` → „Emoji vs ikony"; do 2026-07-17 stała tu nieprawdziwa reguła
  „emoji zamiast ikon").
  `useUI()` (`toast/confirm/prompt`), nigdy `window.*`.
- **Baza**: migracje idempotentne w `lib/db.ts` (`CREATE TABLE IF NOT EXISTS` /
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`), nigdy ręczne migracje. Klient
  `neon()` zwraca zwykłe tablice, nie `{rows}`.
- **Daty** przez `isPlausibleDateString()` (walidacja) i `formatPlDate()`
  (wyświetlanie), „dziś" przez `todayLocalISO()` (`lib/dates.ts`, strefa
  Europe/Warsaw) — nigdy surowy string/ISO ani `new Date()` do porównań dnia.
- **Każdy admin API route** zaczyna od `if (!(await isAuthed())) return 401`.
- **Weryfikacja**: `npx tsc --noEmit -p tsconfig.json` po każdej paczce zmian
  (pełny `next build` failuje w sandboxie). Podgląd wizualny lokalnie:
  `preview_start name:"dev"` (PGlite + dev-login, patrz `CLAUDE.md` → „Lokalne
  środowisko dev").

## Kontekst: co już jest zrobione (żeby nie budować od zera)

Pełny cykl życia leada działa end-to-end:
lead → (oferta = auto-klient) → akceptacja (atomowo: projekt + faktura-szkic,
lead → „Zamknięte - sukces") → realizacja (kamienie/zadania) → wystawienie faktury
→ płatności (częściowe, auto-„Opłacona") → automatyczne przypomnienia o
zaległościach (cron dzienny) → oś czasu klienta scalająca wszystkie zdarzenia.

Pulpit (`app/api/hub/today`) agreguje „co dziś": leady, klienci, projekty,
kamienie po terminie, zaległe faktury, faktury-szkice do wystawienia, wygasłe
oferty, kalendarz z nakładką realnych terminów. Mail dzienny (`app/api/leads/notify`,
cron 06:00) raportuje to samo + wysyła przypomnienia + generuje faktury cykliczne.

**Moduły 1–5 w tym folderze to trzy luki świadomie odłożone podczas audytu
2026-07-13** (⑤ mentor nierówny, ⑥ nurture ręczny, ⑦ komunikacja
jednokanałowa) + mobilna wersja — nie nowe pomysły, tylko domknięcie procesu.

**Moduły 6–8 (AI)** mają inne pochodzenie: pytanie właściciela 2026-07-14
"czy warto dodać lokalne AI (Ollama), żeby jeszcze bardziej usprawnić pracę".
Odpowiedź nie jest "wsadź AI wszędzie" — świadomie tylko dwa konkretne, wąskie
miejsca (szkice mailowe, OCR paragonów), tam gdzie oszczędność czasu jest
namacalna i ryzyko pomyłki niskie (wszystko do zatwierdzenia przez
właściciela). Podpowiedzi w Leadach/Klientach (treść kontaktu) i logika
dopasowań/przypominaczy pozostają świadomie bez AI — to nie miejsca, gdzie
brakuje czasu, tylko gdzie liczy się przewidywalność.

**Moduł 6 zbudowany i zweryfikowany end-to-end (2026-07-14)** — Tailscale
Funnel na Mac Studio właściciela (publiczny adres `*.ts.net`, świadomie nie
zapisywany tutaj w repo — patrz `OLLAMA_API_URL`/`OLLAMA_API_SECRET` w env
Vercela), `lib/ollama.ts`
(tylko tekstowy `ollamaGenerate`/`ollamaHealth`, **bez obsługi obrazów jeszcze**),
`GET /api/ai/health` potwierdza żywe połączenie z modelami na Macu (lista
dostępna w `HUB_SETUP.md`, m.in. warianty `qwen2.5vl`/`qwen3-vl` z
`"capabilities": ["vision", ...]` — kandydaci na model OCR w Module 8).
Szczegóły w `HUB_SETUP.md` → sekcja "Infrastruktura AI".

**Moduł 9** ma jeszcze inne pochodzenie: po zbudowaniu i naprawieniu Modułu 8
(OCR) właściciel przetestował go na prawdziwej fakturze i zgłosił nową
ambicję — zrobić z modułu Koszty coś na poziomie najlepszych dostępnych
narzędzi (Ramp, Expensify, QuickBooks, wFirma/ifirma), nie tylko
"wystarczające". To świadomie duży, wieloetapowy, częściowo otwarty zakres
(plakietki metody płatności, kopiowanie danych do przelewu, i dalsze pomysły
z rynku do priorytetyzacji z właścicielem) — patrz plik modułu po pełny
kontekst i wyniki wstępnego researchu konkurencji.

**Moduł 10** wypączkował z Modułu 3 (kanały kontaktu, 2026-07-14) — przy
okazji dołożono do Kalendarza agregację połączeń telefonicznych, a
właściciel zasygnalizował, że chce więcej ("wszystkie działania z
odpowiednimi tagami, dopasowaniem do klienta"). Świadomie NIE dociągnięte w
tej samej sesji (żeby nie rozjeżdżać się w nieskończoność) — zakres
celowo otwarty, plik modułu zaczyna się od pytań, nie od gotowej decyzji.

**Moduły 11–20** mają inne pochodzenie: po zbudowaniu Modułu 9 (Koszty)
właściciel poprosił o pełny audyt drogi klienta od leada do zapłaconej
faktury — "chcę wypracować raz wzorzec, który jest najlepszy, i według
niego pracować, a aplikacja ma to monitorować". Pięć równoległych agentów
przejrzało kod (Leady, Klienci, Oferty→Projekty, Faktury, konwencje
linkowania) i potwierdziło realne luki, które właściciel zgłaszał
intuicyjnie (Umowy, eskalacja windykacji) plus kilka, o których nie
wiedział (Onboarding, Zamknięcie+opinie, Wsparcie, Retencja, fundament
linkowania). Do tego dwie rzeczy zainspirowane przeglądem generycznego
pakietu "skilli" Claude Code pogrupowanych po działach firmy — właściciel
zapytał, czy warto się tym zainspirować; odpowiedź: nie jako gotowy
pakiet (zbyt generyczny, nieznający polskiego prawa/JDK), ale dwa
konkretne pomysły trafiły w lukę ("pracować mądrze, nie tylko ciężko"):
śledzenie czasu pracy (Moduł 19) i szablony ofert (Moduł 20). **Pełne
uzasadnienie, dobre praktyki branżowe i wskaźniki do monitorowania każdego
etapu — patrz [`00-mapa-drogi-klienta.md`](00-mapa-drogi-klienta.md), nie
duplikowane tutaj.** Właściciel zatwierdził całą kolejność 2026-07-14;
**ostateczny, całościowy audyt drogi klienta — po ukończeniu modułów
11-20.**
