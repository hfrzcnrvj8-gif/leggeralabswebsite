# Brief: Audyt 7 — Czy to nadal jest ten produkt

> Brief wdrożeniowy pod **jeden osobny czat**. To nie jest nowy plan — to
> **wykonanie Audytu 7** z `docs/AUDYTY-KONCOWE.md`, **ostatniego z siedmiu**.
> Powstał 2026-07-23, po domknięciu Audytu 5 (wydajność i koszty).

## Dlaczego ten audyt jest teraz — i czym różni się od poprzednich sześciu

Kolejność wg ryzyka: **4 → 1 → 3 → 2 → 6 → 5 → 7**. Sześć domknięte
(obserwowalność, bezpieczeństwo, niezawodność, RODO, kod, koszty). **Audyt 7 jest
ostatni i jest inny od wszystkich poprzednich.** Tamte pytały „czy działa", „czy
bezpieczne", „czy tanie" — techniczne „czy". Ten pyta **„czy to jest jeszcze to,
czego potrzebujesz"** — pytanie produktowe, nie techniczne.

Jest ważniejszy, niż się wydaje, bo **panel rósł ponad rok** i część decyzji
zapadła w innych okolicznościach niż dzisiejsze. To rozmowa, nie grep — choć
grep dostarczy jej materiału.

**Charakter tego audytu: więcej rozmowy z właścicielem niż kodu.** Poprzednie
audyty kończyły się zmianami w kodzie; ten najprawdopodobniej skończy się
**decyzjami i zapisem kierunku**, nie implementacją. Nie buduj nic bez wyraźnej
zgody — trzy tematy niżej to pytania do rozstrzygnięcia, nie zadania do wykonania.

## Zakres — trzy pytania (za `docs/AUDYTY-KONCOWE.md` → „Audyt 7")

### 1. Reguła „zero AI" jest OTWARTA — co z nią zrobić

**Właściciel sam ją odblokował 2026-07-19** argumentem: *„jako integrator
lokalnych LLM sam nie korzystam w moim własnym produkcie — to słaba
autoreklama"* (pamięć `regula-zero-ai-otwarta` — **nie powołuj się na „zero AI"
jak na rozstrzygnięcie, bo już nim nie jest**). Ta rozmowa miała się odbyć
podczas audytów — teraz jest jej miejsce.

Pytanie **nie** brzmi „czy AI". Brzmi: **„czy kształt »model proponuje, właściciel
zatwierdza« da się rozszerzyć bez oddawania modelowi decyzji"** — i jeśli tak, to
gdzie. Punkt wyjścia: dziś ten kształt działa w **dwóch** miejscach (szkic maila,
OCR paragonu/wizytówki — Moduły 6–8, **lokalny Ollama na Macu właściciela, nigdy
chmura**; pamięć `lokalne-ai-zbudowane-ale-niewpiete` — AI działa na produkcji,
lokalnie wyłączone świadomie). Świadomie **poza** AI zostały: podpowiedzi treści
kontaktu w Leadach/Klientach i cała logika przypominaczy/dopasowań/kolejkowania
(deterministyczne reguły — „gdzie liczy się przewidywalność, nie czas").

Do rozstrzygnięcia z właścicielem: czy są **nowe** punktowe miejsca, gdzie
„model proponuje → właściciel zatwierdza" oszczędza czas przy niskim ryzyku
(kandydaci do przedyskutowania, nie do wdrożenia z automatu: podsumowanie długiego
wątku poczty, szkic notatki z rozmowy, propozycja kategorii kosztu). **Twarda
granica zostaje: model nigdy nie decyduje, nie wysyła, nie zapisuje bez kliknięcia
właściciela; nigdy chmura, zawsze lokalny Ollama.**

### 2. Co się faktycznie używa — mapa żywotności modułów

Po roku część modułów może być **martwa albo półmartwa**. Warto wiedzieć, **zanim
zacznie się je utrzymywać z rozpędu**. To jedyna część audytu z realnym gretem.

- **Nie myl „kod istnieje" z „ktoś tego używa"** — lekcja z pięciu audytów. Audyt
  6 znalazł **9 martwych eksportów** (grep po UŻYCIU), część to rusztowanie pod
  niepodłączone moduły (geofence przypomnień), część resztki. **Nie odkrywaj ich
  drugi raz** — są w `docs/AUDYT-6-WYNIKI.md`, ust. 4. Ten audyt pyta wyżej: nie
  „czy funkcja jest wołana w kodzie", lecz **„czy właściciel realnie z niej
  korzysta"** — a to wie tylko właściciel. Zrób listę modułów panelu i zapytaj
  wprost, które otwiera, a których nigdy.
- Świadomie odłożone/uśpione **nie są martwe** (Moduł 16 wsparcie posprzedażowe —
  czeka na realną potrzebę; geofence — rusztowanie). Nie tnij ich.
- Produkt tej części: **mapa „żywy / uśpiony świadomie / kandydat do odstawienia"**,
  z decyzją właściciela przy każdym „kandydacie". Odstawienie ≠ kasowanie kodu
  (Audyt 6: martwe pola bywają podłączane, `list_unsubscribe_url` ożył) —
  to decyzja „przestań o tym myśleć jako o rzeczy do utrzymania".

### 3. Dwa front-endy — czy nadal się opłaca

Panel webowy **i** apka natywna iOS to **trwały koszt, nazwany wprost w planie**
(każda reguła biznesowa dublowana w dwóch miejscach — pamięć `audyt-6-kod`:
parytet pilnują testy + krótki audyt przy nowej platformie). Audyt 5 policzył
koszt pieniężny (~28 USD/mies. po rejestracji); ten pyta o koszt **utrzymania i
uwagi**.

Do rozstrzygnięcia: czy dwa front-endy nadal mają sens dla **jednej osoby**, czy
apka realnie się używa (patrz pkt 2 — uwaga właściciela z Audytu 5: apka jest
„wciąż tworzona i testowana, nie w użytku"), i czy plan macOS/iPadOS jest nadal
aktualny. **To pytanie o kierunek, nie o kod** — apki nie ruszamy w tym audycie.

## Co ROZSTRZYGNĄĆ z właścicielem (to jest rdzeń tego audytu)

Właściciel nie programuje — pytaj wprost, po polsku, bez żargonu. **Wszystkie
trzy pytania wyżej to pytania do niego, nie zadania.** Zwłaszcza:

1. Kierunek AI — czy rozszerzać kształt „proponuje→zatwierdza", i gdzie.
2. Które moduły realnie otwiera, a których nigdy (mapa żywotności).
3. Czy apka natywna nadal ma sens jako drugi front-end dla jednej osoby.

Nie decyduj żadnego z tych sam. Rekomendację możesz dać — ale decyzja jest jego.

## Weryfikacja — czym ten audyt różni się od reszty

„Zielony build nie jest dowodem" obowiązuje dalej, ale **ten audyt w większości
nie produkuje kodu do weryfikacji** — produkuje decyzje i zapis kierunku. Gdzie
jest grep (mapa żywotności modułów), rób go **po użyciu, nie po definicji**, i
**nie mieszaj „martwe w kodzie" z „nieużywane przez właściciela"** — to dwie różne
rzeczy, a tylko drugą rozstrzyga właściciel. Jeśli **wyjątkowo** coś zmienisz w
kodzie (mało prawdopodobne), `npx tsc --noEmit` + `npm test` po zmianie.

## Zasady prowadzenia (nie powtarzaj cudzej roboty)

- **Przeczytaj najpierw ustalenia wszystkich sześciu audytów**
  (`AUDYT-1/2/3/4/5/6-WYNIKI.md`) i pamięć projektu. Martwy kod, koszty, parytet
  apki, reguła AI — **już opisane**, nie odkrywaj drugi raz.
- **Nie odkrywaj na nowo świadomych decyzji** (`CLAUDE.md` → „Świadome decyzje
  produktowe"; `PO_REJESTRACJI.md`; sekcje „świadomie odłożone"). Spory kawałek
  tego, co wygląda na „martwe" albo „brakujące", jest wyborem.
- **To rozmowa produktowa** — więcej pytań do właściciela niż kodu. Nie buduj
  funkcji „przy okazji".
- **Jeden audyt = jeden czat.** To ostatni — po nim siedem audytów domkniętych.

## Środowisko

`npm run dev`, logowanie pominięte (`DEV_ADMIN_BYPASS` w `.env.local`), dane
z PGlite (`lib/dev-db.ts`). `npm test` dostępne (Audyt 6). Panel `/admin` jest
jednomotywowy — ciemny. Apka: repo `leggera-hub-ios` (osobne, jak w Audytach 6/5).

## Po zakończeniu

Główny produkt: **`docs/AUDYT-7-WYNIKI.md`** (wzorem `AUDYT-1..6-WYNIKI.md`) —
decyzje kierunkowe, mapa żywotności modułów, rozstrzygnięcie reguły AI i dwóch
front-endów. Zaktualizuj `docs/AUDYTY-KONCOWE.md` (odhacz Audyt 7 — **wszystkie
siedem domknięte**), odhacz w `docs/plany-modulow/README.md`, zapisz decyzje w
pamięci. Pozycje wymagające rejestracji/prawnika → `PO_REJESTRACJI.md` /
`DO-PRAWNIKA-I-TLUMACZA.md`. To **ostatni audyt** — po nim zamknięcie serii
„zanim uznamy system za skończony". Podaj właścicielowi komendę do commita.
