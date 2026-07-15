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
| 5 | Leggera Hub jako aplikacja mobilna (PWA) — cała apka na telefonie | duży | [05-mobilna-aplikacja.md](05-mobilna-aplikacja.md) |
| 6 | ✅ AI: infrastruktura Ollama (fundament pod 7 i 8, nie samodzielna funkcja) | mały | [06-ai-infrastruktura-ollama.md](06-ai-infrastruktura-ollama.md) |
| 7 | AI: szkice odpowiedzi mailowych (wymaga 4 i 6) | średni | [07-ai-szkice-mailowe.md](07-ai-szkice-mailowe.md) |
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
  emoji zamiast ikon. `useUI()` (`toast/confirm/prompt`), nigdy `window.*`.
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
