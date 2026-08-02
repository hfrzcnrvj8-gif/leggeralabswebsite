# Handoff — stan na 2026-08-02, po Fazie 2 planu zaplecza

Plik tymczasowy: wklej jako pierwszą wiadomość w nowym czacie. Pamięć Claude ma
to samo zapisane na trwałe. Pełny opis funkcjonalności: `HUB_SETUP.md` /
`LEADS_SETUP.md`; zasady pracy: `CLAUDE.md`; pułapki środowiska: `CLAUDE.md` →
„Znane pułapki tego środowiska".

## Punkt startu

- Panel: `8ce1c25` „Faza 2: jedna bramka decyduje, co wolno wysłać do klienta"
- Repozytorium czyste i wypchnięte. `tsc` czysto, `npm test` **250/250**.
- `npm run przejscie`: **47 działa · 3 znane luki · 0 regresji · 0 obejść ·
  0 pominiętych**.

Jeśli `git log` pokazuje co innego — ktoś pracował po drodze, sprawdź co
(`git log` PRZED `git add`; równoległa sesja już raz wchłonęła cudze zmiany).

## Gdzie jesteśmy w planie

Plan: `docs/PLAN-ZAPLECZE.md`, powstał po ręcznym przejściu opisanym
w `docs/PIERWSZE-PRZEJSCIE-NA-SUCHO.md`. Kolejność zatwierdzona przez
właściciela. Trzydzieści kilka znalezisk to nie trzydzieści kilka usterek,
tylko **cztery brakujące mechanizmy** — każdy objawiający się w kilku modułach
naraz.

| faza | co dowozi | stan |
|---|---|---|
| 0a | całą drogę klienta przechodzi jedno polecenie | ✅ |
| 0b | kontrola spójności jako ekran *Zdrowie* | ✅ |
| 1 | jedno przepisanie danych klienta (`lib/przepisanie.ts`) | ✅ |
| 2 | jedna bramka „czy to wolno wysłać" (`lib/bramkaWysylki.ts`) | ✅ |
| **3** | **komplet skutków zdarzenia — jako propozycje** | **← teraz** |
| 4 | lista działań nieodwracalnych i potwierdzenia | ⏳ |
| 5 | wygląd (zebrane usterki wizualne) | ⏳ |

## Co zamknęła Faza 2 — żeby nie robić tego drugi raz

- `lib/bramkaWysylki.ts` — **jedna** odpowiedź „co jest nie tak z tym
  dokumentem, zanim wyjdzie": lista blokad i ostrzeżeń, nie `tak/nie`.
  Blokada → **400 na trasie**, same ostrzeżenia → **409**, przechodzone
  `mimo_ostrzezen: true` („Wyślij mimo to"). Zgoda **nie** obchodzi blokady.
- Pyta ją **pięć tras** (`offers|contracts|invoices/[id]/send`,
  `projects/[id]/request-review`, `client-followups/[id]/send`) i siedem
  miejsc w panelu. **Nowa wysyłka = wołanie bramki w TRASIE**; przycisk
  w interfejsie nie jest blokadą.
- W interfejsie: `PasekBramki` + `useWysylkaZBramka()`
  (`app/[lang]/admin/BramkaWysylki.tsx`).
- **Migawka obejmuje wystawcę**: oferta i umowa przy wysyłce, faktura przy
  wystawieniu (nie miała migawki w ogóle). Blok liczy `wystawcaDoMigawki()`
  z `lib/publicFields.ts` — publiczne trasy przepuszczają przez tę białą listę
  także migawkę, żeby prywatne ustawienia właściciela nie wyszły tylnymi drzwiami.
- Szkice maili dostają imię z *Dane firmy* → „Podpisuje umowy"
  (`danePodpisu()` w `lib/documents.ts`). Puste pole zostawia nawias
  świadomie — bramka wtedy zatrzyma wysyłkę i powie, gdzie go uzupełnić.

Szczegóły i lekcje: `HUB_SETUP.md` → „Faza 2 zaplecza", `docs/PLAN-ZAPLECZE.md`.

---

# Faza 3 — skutki zdarzenia, komplet — jako propozycje

**Zasada, zatwierdzona przez właściciela: panel proponuje, właściciel
zatwierdza.**

Dziś panel robi jedno i drugie niekonsekwentnie: lead przestawia się sam przy
akceptacji oferty, klient nie przestawia się nigdy. Ujednolicamy **w stronę
propozycji**.

## Trzy luki, które to zamyka

| nr | co się dzieje dziś | gdzie siedzi zdarzenie |
|---|---|---|
| **C1** | klient wystawił opinię, projekt **zostaje** „W trakcie" | `app/api/projects/review/public/[token]/submit/route.ts` (droga klienta) oraz `app/api/projects/[id]/review/route.ts` (wpis ręczny) — **dwie drogi, jeden skutek**, wzorem `lib/offerAccept.ts` |
| **C3** | lead „Zamknięte - sukces" **zostaje** z żywym `next_followup` — przypomnienie każe oddzwonić w sprawie zamkniętej | `lib/offerAccept.ts` (~w. 198, tam status leada się przestawia) |
| **C4** | faktura opłacona, klient **dalej** ma status „Prospekt" | `app/api/invoices/[id]/payments/` |

**C2 (mail mówi „zakończony", projekt jest „W trakcie") zamknęła Faza 2** jako
ostrzeżenie bramki (`mail-mowi-zakonczony`) — plan wprost mówi, że to blokada,
nie propozycja.

Wszystkie trzy są dziś widoczne jako czerwone reguły na ekranie *Zdrowie*
(`lib/spojnosc.ts`, znaczniki `luka: "C1" | "C3" | "C4"`) i jako `⚠ ZNANA LUKA`
w `npm run przejscie`. **Po naprawie zdejmij znaczniki w OBU miejscach** —
inaczej przejście zgłosi `★ NAPRAWIONE` i będzie miało rację.

## Gdzie mieszkają propozycje

**W istniejącym „Wymaga działania dziś"** — na Pulpicie i w module, którego
dotyczą. **Nowego modułu nie robimy.**

- Kafel „Wymaga działania dziś": `app/[lang]/admin/DashboardHome.tsx` (~w. 500)
- Dane: `app/api/hub/today/route.ts` — jedno `Promise.all`, potem filtry
  `isOverdue` / `isProjectOverdue` / `isInvoiceOverdue` / `dueFollowups`

To świadomie **nie jest** „Skrzynka propozycji AI"
(`ai-propozycje-orchestrator-plan`) — tamta jest odłożona na koniec i dotyczy
treści generowanych przez model. Tu **nie ma modelu**: deterministyczne reguły,
zgodnie z „Świadome decyzje produktowe" w `CLAUDE.md`. Jeśli tamta skrzynka
kiedyś powstanie, będzie można je połączyć — ale nie odwrotnie.

## Kształt propozycji

Jedno zdanie, jeden przycisk „zrób to", jeden „nie teraz".

| zdarzenie | propozycja |
|---|---|
| faktura opłacona | „Drukarnia Helios zapłaciła — przestawić klienta na Aktywny?" |
| klient przysłał opinię | „Opinia przyszła — zamknąć projekt jako Wdrożone?" |
| wygrany lead z żywym przypomnieniem | „Lead wygrany, ale ma zaplanowane demo na 5.08 — zdjąć przypomnienie?" |

**„Nie teraz" musi być TRWAŁE** — propozycja odrzucona nie wraca następnego
dnia. To jest różnica między pomocnym panelem a natrętnym. Czyli: ślad w bazie,
nie stan w przeglądarce.

## Co rozstrzygnąć z właścicielem NA STARCIE

To są decyzje produktowe, nie techniczne — nie zgaduj:

1. **Jedna propozycja na zdarzenie czy na rekord?** Klient z trzema opłaconymi
   fakturami — jedna propozycja czy trzy?
2. **Co znaczy „nie teraz"?** Odrzucenie raz na zawsze, czy odłożenie na N dni?
3. **Czy propozycje wchodzą też do apki iOS**, czy na razie tylko panel.
4. **Czy istniejące automaty zostają automatami?** Lead przestawia się sam przy
   akceptacji oferty. Plan mówi „ujednolicamy w stronę propozycji", ale to jest
   zmiana czegoś, co dziś działa — warto potwierdzić wprost.

## Sprawdzenie fazy (wprost z planu)

> Po przejściu testowej drogi na Pulpicie stoją dokładnie te propozycje,
> których się spodziewamy — ani jednej więcej.

Czyli: `npm run przejscie` rozszerzone o asercje na liście propozycji, plus
zdjęcie znaczników `C1`/`C3`/`C4` z przejścia i z `lib/spojnosc.ts`.

## Jak pracować w tym repo (skrót, reszta w CLAUDE.md)

- `npm run dev` w jednym oknie, `npm run przejscie` w drugim. Dev-baza to
  PGlite w pamięci procesu — **restart serwera = czysta baza**.
- `npx tsc --noEmit -p tsconfig.json` po każdej paczce zmian (pełny
  `next build` failuje w sandboxie z EPERM).
- `npm test` — 250 testów nad czystymi funkcjami z `lib/`.
- **Każda nowa trasa w `app/api` jest domyślnie OTWARTA** —
  `if (!(await isAuthed()))` sprawdzaj per uchwyt HTTP, nie per plik.
- Migracje w `lib/db.ts`, między `schemaUpToDate()` a `markSchemaApplied()`.
  **Zapytanie nie-DDL w migracji MUSI iść przez `inMigration()`**, inaczej
  w dev zakleszcza seeder i wszystkie `/api/*` wiszą kilkadziesiąt sekund.
- Podgląd w przeglądarce ma **zamrożony rAF** (karta „hidden"): animacje
  framer-motion stoją na wpół przezroczyste. To artefakt narzędzia, nie błąd —
  sprawdzaj treść przez DOM, nie przez sam zrzut.
- Kończąc: `rm -f .git/index.lock && git add -A && git commit && git push`.

---

## Otwarte poza planem zaplecza (nie ruszać przy okazji)

- **Rejestracja firmy** — `PO_REJESTRACJI.md`, osiemnaście punktów. Blokuje
  KSeF test → produkcja, prawdziwe dane w nocie prawnej, plan Vercel Pro
  (Hobby zabrania użytku komercyjnego), przeprowadzkę na NAS. **To nie są
  braki do naprawienia przed rejestracją.**
- **Próg 24×24 w Katalogu** (`CatalogDashboard.tsx`) — trzeci moduł z rzędu to
  odnotowuje. Plan wciąga to do Fazy 5; nie rób przy okazji czegoś innego.
- **A5 z przejścia** — „ZLECENIODAWCA / WYKONAWCA" w jednej rubryce na wydruku
  umowy. Treść dokumentu prawnego, nie reguła wysyłki; świadomie poza Fazą 2.
- **Moduł 54, ostatni krok** (pliki klienta na NAS) — czeka na Moduł 55, ten na
  rejestrację.
- **`CEIDG_TOKEN` w Vercelu** — bez niego Łowca leadów nie ma skąd brać
  kandydatów. Ruch właściciela.
- **Włączenie 2FA na produkcji** — silnik gotowy od Modułu 41. Drogi powrotu:
  papierowe kody zapasowe + ten sam sekret na drugim urządzeniu (NIE
  „wyłącznik w Vercelu").

## Czego NIE zaczynać bez wyraźnej prośby

- **Orchestrator propozycji AI** („Skrzynka propozycji AI") — odłożony na koniec.
- **Nowy punkt użycia lokalnego LLM** poza pięcioma zbudowanymi.
- **Moduł 16 — wsparcie posprzedażowe.** Do pierwszego klienta.
- **Przeprowadzka na NAS** poza etapem 1.
- Wszystko z sekcji „Świadome decyzje produktowe" w `CLAUDE.md`.

## Uczciwa etykieta stanu

**Kompletny funkcjonalnie, przeaudytowany, nieużywany produkcyjnie.** Od
2 sierpnia doszło coś, czego wcześniej nie było: **dwa narzędzia, które
sprawdzają dane, a nie kod** — przejście „na sucho" i kontrola spójności na
ekranie *Zdrowie*. Czego dalej nie ma: ani jednego prawdziwego klienta, ani
jednej faktury wystawionej naprawdę. Następny krok, który realnie zmienia stan,
jest nietechniczny: rejestracja działalności.
