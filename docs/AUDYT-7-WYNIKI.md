# Audyt 7 — czy to nadal jest ten produkt: wyniki (2026-07-23)

Siódmy i **ostatni** z siedmiu audytów końcowych (kolejność wg ryzyka:
4 → 1 → 3 → 2 → 6 → 5 → **7**). Zakres: `docs/AUDYTY-KONCOWE.md` → „Audyt 7",
brief wykonawczy: `docs/plany-modulow/46-audyt-7-produkt.md`.
Poprzednie: `docs/AUDYT-4/1/3/2/6/5-WYNIKI.md`.

**Pytanie audytu:** nie „czy działa", „czy bezpieczne", „czy tanie" — te
odpowiedziały poprzednie sześć. Ten pyta **„czy to jest jeszcze to, czego
potrzebujesz"**. Pytanie produktowe, nie techniczne — bo panel rósł ponad rok
i część decyzji zapadła w innych okolicznościach niż dzisiejsze.

**Charakter tego audytu inny niż reszty:** więcej rozmowy z właścicielem niż
kodu. Zgodnie z briefem skończył się **decyzjami i zapisem kierunku, nie
implementacją**. **Zero zmian w kodzie** — i to jest poprawny wynik dla tego
audytu, nie brak.

> **Najważniejszy wniosek z góry:** po roku rozwoju **produkt nadal jest tym,
> czego właściciel potrzebuje**. Żaden z trzech tematów nie ujawnił rzeczy do
> cofnięcia ani do wycięcia. Dwa tematy potwierdziły dotychczasowy kierunek
> (moduły zostają, dwa front-endy zostają), jeden **otworzył nowy, świadomy
> kierunek rozwoju** (rozszerzenie AI w kształcie „proponuje → zatwierdzasz" na
> trzy nowe punkty — jako decyzja, nie jako kod tej sesji).

---

## Metoda

Trzy pytania kierunkowe zadane właścicielowi **wprost, po polsku, bez żargonu**
(właściciel nie programuje). Materiał do pytań: inwentarz modułów panelu
(`app/[lang]/admin/` + `app/api/`), mapa drogi klienta, ustalenia sześciu
poprzednich audytów. **Grep po UŻYCIU, nie po definicji** — ale tylko jako
materiał; rozstrzygnięcie każdego z trzech pytań należy do właściciela, nie do
kodu. „Martwe w kodzie" (9 eksportów z Audytu 6) i „nieużywane przez
właściciela" to **dwie różne rzeczy** — pierwszą rozstrzyga grep, drugą tylko on.

---

## Ustalenia — trzy rozstrzygnięcia

### 1. Reguła „zero AI" — ROZSZERZAMY kształt „proponuje → zatwierdzasz" o trzy punkty ✅ DECYZJA WŁAŚCICIELA

**Kontekst (nie odkrywany drugi raz):** reguła „zero AI" jest **otwarta od
2026-07-19** — właściciel sam ją odblokował argumentem: *„jako integrator
lokalnych LLM sam nie korzystam w moim własnym produkcie — to słaba
autoreklama"* (pamięć `regula-zero-ai-otwarta` — **nie powołuj się na „zero AI"
jak na rozstrzygnięcie, bo już nim nie jest**). Ta rozmowa miała się odbyć
podczas audytów; tu jest jej miejsce.

**Pytanie nie brzmiało „czy AI".** Brzmiało: **„czy kształt »model proponuje,
właściciel zatwierdza« da się rozszerzyć bez oddawania modelowi decyzji"** — i
jeśli tak, gdzie. Punkt wyjścia: dziś ten kształt działa w **dwóch** miejscach
(Moduły 6–8): szkic odpowiedzi mailowej i OCR paragonu/wizytówki — **lokalny
Ollama na Macu Studio właściciela, nigdy chmura** (pamięć
`lokalne-ai-zbudowane-ale-niewpiete`: AI działa na produkcji, lokalnie
wyłączone świadomie przez brak `OLLAMA_API_URL` w `.env.local`).

**Decyzja właściciela: rozszerzyć TEN SAM kształt na wszystkie trzy
przedyskutowane punkty:**

| # | Nowy punkt | Kształt | Ryzyko | Podstawa techniczna |
|---|---|---|---|---|
| a | **Podsumowanie długiego wątku poczty** | Przycisk „Podsumuj wątek" → model streszcza, właściciel czyta; nic nie wysyła | Niskie (tylko czytanie) | `ollamaGenerate` (tekst) już istnieje; wątkowanie z Modułu 4b |
| b | **Szkic notatki z rozmowy** | Po rozmowie/mailu jednym klikiem szkic notatki do CRM → właściciel zatwierdza i zapisuje | Niskie (zapis dopiero po kliknięciu) | `ollamaGenerate` (tekst); Notatnik z Modułu 26 |
| c | **Propozycja kategorii kosztu** | Przy dodawaniu kosztu model podpowiada kategorię z paragonu (rozszerza istniejący OCR) | Najniższe (weryfikacja wzrokiem) | Rozszerza ścieżkę OCR Modułu 8 (model vision już wpięty) |

**Twarda granica zostaje bez zmian (potwierdzona):** model **nigdy nie
decyduje, nie wysyła, nie zapisuje bez kliknięcia właściciela; nigdy chmura,
zawsze lokalny Ollama.** Świadomie **poza** AI dalej zostają: podpowiedzi treści
kontaktu w Leadach/Klientach oraz cała logika przypominaczy/dopasowań/
kolejkowania — deterministyczne reguły, „gdzie liczy się przewidywalność, nie
czas". To rozszerzenie **nie rusza** tej granicy.

**To decyzja kierunku, NIE kod tej sesji.** Zgodnie z konwencją projektu
(„jeden moduł = jeden czat", `docs/plany-modulow/README.md`) każdy z trzech
punktów powstaje jako **osobny brief w osobnym czacie**. Rekomendowana
kolejność (od najmniejszego ryzyka i największego re-użytku istniejącego kodu):

1. **(c) Propozycja kategorii kosztu** — najmniejsza, rozszerza już wpięty OCR
   Modułu 8, najłatwiejsza do weryfikacji wzrokiem.
2. **(a) Podsumowanie wątku poczty** — najwyższa namacalna oszczędność czasu,
   czysty tekst, zero zapisu.
3. **(b) Szkic notatki z rozmowy** — wymaga źródła (rozmowa/mail) i ścieżki
   zapisu-po-zatwierdzeniu.

Każdy brief musi powtórzyć guardrail: lokalny Ollama, propozycja → zatwierdzenie,
kontrolowany komunikat „Model AI niedostępny" gdy `lib/ollama.ts` zwróci `null`
(wzorzec z Modułu 8). **RODO:** przetwarzanie treści maila lokalnym modelem jest
już pokryte Audytem 2 jako **przewaga prywatności** (dane nie opuszczają Maca
właściciela) — nowego punktu prawnego nie ma.

### 2. Mapa żywotności modułów — NIC NIE ODSTAWIAMY ✅ DECYZJA WŁAŚCICIELA

Po roku część modułów mogła być martwa albo półmartwa — warto wiedzieć,
**zanim zacznie się je utrzymywać z rozpędu**. Właścicielowi przedstawiono pełny
inwentarz panelu, pogrupowany:

- **Rdzeń codzienny:** Pulpit, Leady, Klienci, Projekty, Notatnik, Kalendarz,
  Poczta, Przypomnienia.
- **Proces sprzedaży/rozliczeń:** Oferty, Umowy/NDA, Faktury (+ windykacja),
  Koszty, Statystyki, Szablony ofert/katalog.
- **Narzędzia/automaty:** Śledzenie czasu, Referencje/opinie, Nurture, Centrum
  powiadomień, quick-log, eksporty CSV.
- **AI:** szkic maila, OCR paragonu/wizytówki (lokalny Ollama).
- **Infrastruktura:** KSeF (tryb testowy), Telefonia/VoIP (webhook
  przygotowany, niepodłączony), kopie na NAS, 2FA/urządzenia.

**Decyzja właściciela — cytat:** *„póki co myślę że wszystko powinno zostać, bo
było wdrożone po naszej wspólnej konsultacji, ale jeszcze w praktyce
niewykorzystane. Dajemy temu czas i kiedyś wrócimy sprawdzić, czy faktycznie te
moduły nie są potrzebne."*

**Wynik: brak kandydatów do odstawienia. Wszystko zostaje „uśpione świadomie".**
To jest spójne z regułą tego audytu i z sześcioma poprzednimi:

- **„Zero klientów" ≠ „martwe".** Cały dolny odcinek procesu (Faktury, Umowy,
  Windykacja, KSeF, część Kosztów) jest **pusty, bo nie ma jeszcze realnych
  klientów** — to świadomie uśpione, nie martwe (brief, i `CLAUDE.md` →
  „Świadome decyzje produktowe"; `PO_REJESTRACJI.md`).
- **Odstawienie ≠ kasowanie kodu.** Audyt 6 pokazał, że martwe pola w tym
  projekcie **bywają podłączane, nie usuwane** — `list_unsubscribe_url` był
  „martwy", dziś ma 23 użycia. Nawet gdyby padła decyzja „nie pielęgnuj tego",
  kod by został.
- **Świadomie odłożone naprawdę nie są martwe:** Moduł 16 (wsparcie
  posprzedażowe — czeka na realną potrzebę), geofence przypomnień (rusztowanie).
  Nie tnij ich — to była lekcja Audytu 6.

**Zapisany warunek powrotu:** temat wraca **po pojawieniu się pierwszych
realnych klientów** — wtedy okaże się, które moduły realnie wchodzą do
codziennego obiegu, a które dalej leżą. Do tego czasu nie ma nic do zrobienia.

### 3. Dwa front-endy — OBA ZOSTAJĄ, plan macOS/iPadOS aktualny ✅ DECYZJA WŁAŚCICIELA

Panel webowy **i** apka natywna iOS to **trwały koszt, nazwany wprost w
planie**: każda reguła biznesowa dublowana w dwóch miejscach, parytet pilnowany
testami (Audyt 6, `npm test`) + krótkim audytem przy każdej nowej platformie.
Audyt 5 policzył koszt **pieniężny** (~99 USD/rok Apple Developer przy
publikacji, poza ~20 USD/mies. Vercel Pro); ten pytał o koszt **utrzymania i
uwagi**, oraz o to, czy apka realnie się używa (uwaga z Audytu 5: apka „wciąż
tworzona i testowana, **nie w użytku**").

**Decyzja właściciela: oba front-endy zostają, plan macOS → iPadOS pozostaje
aktualny.** Właściciel świadomie akceptuje podwójny koszt utrzymania i parytetu.

Uzasadnienie kierunkowe (kontekst, nie rozstrzygane samodzielnie):

- Apka nie jest długiem technicznym — jest **zbudowana, domknięta i
  przetestowana end-to-end** (fazy w `docs/natywna-aplikacja/`, pamięć
  `apka-audyt-koncowy-13-4`). „Nie w użytku" znaczy „właściciel jeszcze na co
  dzień pracuje w panelu na desktopie", nie „apka nie działa".
- Koszt parytetu jest **pod kontrolą**: reguły dublowane są nieliczne i
  **pokryte testami** (`parseQuickAdd`, snooze/wysyłka, telefony, „wymaga
  działania dziś", ocena kopii) — Audyt 6 złapał jeden realny rozjazd
  (`isOverdue`) właśnie tym mechanizmem i go naprięł.
- **Zasada parytetu na przyszłość (potwierdzona):** każda nowa reguła biznesowa
  dotykająca obu front-endów wymaga (1) testu w `npm test`, jeśli to czysta
  reguła, oraz (2) krótkiego audytu drugiej platformy — repo apki
  `leggera-hub-ios` jest osobne (cross-repo). To nie jest nowy koszt, tylko
  spisanie tego, co już działa.

**Apki nie ruszamy w tym audycie** (brief: „to pytanie o kierunek, nie o kod").

---

## Sprawdzone i jest dobrze (to też jest wynik)

- **Produkt nie wymaga cofania żadnej decyzji.** Po roku rozwoju i sześciu
  audytach technicznych żaden z trzech tematów produktowych nie ujawnił rzeczy
  zbudowanej „w innych okolicznościach", której dziś by się nie zbudowało.
- **Granica AI trzyma się mocno.** Rozszerzenie o trzy punkty **nie narusza**
  twardej zasady (lokalny model, propozycja → zatwierdzenie); logika
  przypominaczy/dopasowań dalej deterministyczna i świadomie bez AI.
- **Inwentarz modułów jest kompletny i uzasadniony.** Nie ma modułu, o którym
  właściciel by nie wiedział albo którego nie chciał — każdy powstał po wspólnej
  konsultacji. Mapa żywotności to nie „śmietnik do sprzątania", tylko „poczekaj
  na klientów i sprawdź w praktyce".
- **Dwa front-endy są policzone i zaakceptowane** — nie są „przypadkowym
  długiem", tylko świadomym wyborem z kontrolowanym kosztem parytetu.

---

## Czego ten audyt NIE zrobił (celowo)

- **Nie dobudował funkcji.** Trzy punkty AI to **zapis kierunku**, nie kod tej
  sesji — powstaną jako osobne briefy w osobnych czatach.
- **Nie wyciął ani nie „odstawił" żadnego modułu** — decyzja właściciela brzmi
  „wszystko zostaje, wracamy po klientach".
- **Nie ruszył apki** — kierunek potwierdzony, kodu brak.
- **Nie odkrywał drugi raz** martwego kodu (Audyt 6), kosztów (Audyt 5),
  parytetu apki (Audyt 6), ani reguły AI (pamięć `regula-zero-ai-otwarta`).

---

## Do zrobienia (właściciel / przyszłe czaty)

1. **AI — trzy nowe briefy modułów**, jeden czat każdy, w kolejności
   c → a → b (kategoria kosztu → podsumowanie wątku → szkic notatki). Do
   utworzenia, gdy właściciel zdecyduje ruszyć — nie teraz. Każdy powtarza
   guardrail lokalnego Ollamy i „propozycja → zatwierdzenie".
2. **Mapa żywotności — przegląd po pierwszych klientach.** Nie kalendarzowo:
   wyzwalaczem jest pojawienie się realnego obiegu klientów, wtedy sprawdzić,
   które moduły weszły do codziennego użytku.
3. **Parytet front-endów — pilnować przy każdej wspólnej regule** (test +
   krótki audyt drugiej platformy). Utrzymanie, nie nowe zadanie.

**Brak nowych pozycji do `PO_REJESTRACJI.md` i `DO-PRAWNIKA-I-TLUMACZA.md`** —
rozszerzenie AI jest lokalne (pokryte Audytem 2 jako przewaga prywatności),
pozostałe dwa tematy nie dotykają prawa.

---

## Domknięcie serii

To był **ostatni z siedmiu audytów końcowych**. Po nim **wszystkie siedem są
domknięte**:

| # | Audyt | Wynik |
|---|---|---|
| 4 | Obserwowalność | ✅ `error_log`/`automation_runs`/alarm mailowy, nadzór przeżywa śmierć crona |
| 1 | Bezpieczeństwo | ✅ hamulec logowania, TOTP (Moduł 41), unieważnianie linków (Moduł 40) |
| 3 | Niezawodność | ✅ `odtworz.sh` naprawiony (cichy błąd), 5 procedur powrotu, runbook |
| 2 | RODO | ✅ mapa danych, retencja leadów 24 mies., `field_changes` sprzątane z osobą |
| 6 | Kod | ✅ pierwsze testy (`npm test`), parytet apki, `isOverdue` naprawiony, CI/Dependabot |
| 5 | Koszty | ✅ nic wolne/drogie, 0 zmian w kodzie, ~20 USD/mies. Vercel Pro po rejestracji |
| 7 | Produkt | ✅ **ten dokument** — kierunek potwierdzony, AI rozszerzone jako decyzja |

**Umowa z samym sobą z 2026-07-20 („zanim uznamy system za skończony")
spełniona.** Naturalny następny kamień milowy to **rejestracja działalności** —
od niej `PO_REJESTRACJI.md` staje się listą do wykonania (Vercel Pro, KSeF
test→produkcja, nota prawna, konto Apple Developer), a część ustaleń zmienia się
z technicznych na prawne.
