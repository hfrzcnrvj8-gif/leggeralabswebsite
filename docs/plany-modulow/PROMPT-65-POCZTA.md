# Prompt do wklejenia w nowym czacie — POCZTA

> Powstał 2026-08-01, po domknięciu Kosztów (Moduł 63).
> Kolejność wybrana przez właściciela: Poczta przed Notatnikiem.

---

## ZACZNIJ OD TEGO — ten moduł NIE jest jak cztery poprzednie

Audyty Projektów, Faktur, Katalogu i Kosztów znajdowały za każdym razem tę samą
rodzinę usterek: trasa bierze śmieć, po cichu podmienia go na wartość domyślną
i odpowiada `{"ok":true}`. **W Poczcie tego wzorca prawdopodobnie NIE MA** —
i wejście z założeniem, że jest, spali dzień.

Zmierzone gretem przy pisaniu tego promptu, w `app/api/mail` (**22 uchwyty
HTTP w 17 plikach**, liczone po `export async function`):

- **Autoryzacja: 22/22 uchwytów ma REALNĄ bramkę** — nie wzmiankę w
  komentarzu, tylko `if (!(await isAuthed()))`. Sprawdzone blok po bloku,
  nie gretem po pliku.
- **`PATCH /api/mail/:id` waliduje wszystko i oddaje 400 z powodem**:
  `MOVE_TARGETS.includes` → „invalid move target", `MAIL_STATUSES.includes` →
  „invalid status", `senderDecision` tylko `approved`/`blocked`,
  `snoozeUntil` przez `isPlausibleTimestamp`. Do tego 404 / 422 / 502 / 503
  w sensownych miejscach.
- **`POST /api/mail/compose` sprawdza odbiorców, typ MIME i rozmiar** — pusty
  adres i pusta treść odbijają się 400.
- **Kolejka wysyłki jest odporna na podwójną wysyłkę** — `runDueOutbox()`
  zaklepuje wiersze jednym atomowym `UPDATE ... FOR UPDATE SKIP LOCKED`,
  właśnie po to, żeby cron i wejście z apki nie wysłały tego samego maila dwa
  razy.

**Sygnał „0 trafień `zeSlownika` w Poczcie" jest FAŁSZYWIE POZYTYWNY.** Poczta
robi to samo, co `zeSlownika`, tylko napisane inline. Nie przepisuj tego na
`zeSlownika` dla samej symetrii — to byłaby zmiana bez powodu w module, który
działa. Chyba że pomiar pokaże realną dziurę, wtedy jasne.

**Ale to nie znaczy, że nie ma czego robić.** Ryzyko w tym module jest zupełnie
innego rodzaju — patrz niżej.

---

## Dlaczego ten moduł jest inny niż wszystkie pozostałe

Poczta to **jedyny moduł, który działa NA ZEWNĄTRZ firmy**. Reszta panelu
zapisuje liczby do bazy; ten wysyła wiadomości do prawdziwych ludzi.

Konsekwencja: **błąd tutaj jest NIEODWRACALNY.** Zła kwota w koszcie jest
poprawialna do końca roku podatkowego. Mail wysłany do klienta nie jest
poprawialny nigdy. Traktuj każdą ścieżkę wysyłki (`compose`, `reply`,
`forward`, `schedule`, `outbox/run`) z tą podejrzliwością, którą przy Kosztach
rezerwowałeś dla `vat_odliczenie_procent`.

Drugi wyróżnik: Poczta jest **jedynym modułem zależnym od cudzego serwera**
(IMAP/SMTP w az.pl). Wszystko może zawieść w połowie — i wtedy pytanie brzmi
nie „czy pokazujemy błąd", tylko **„czy potrafimy odróżnić »nie ma« od »nie
udało się sprawdzić«"**.

---

## Cztery konkrety z rekonesansu, warte sondy

**1. „Cofnij wysyłkę" żyje w PRZEGLĄDARCE, nie na serwerze.**
`app/[lang]/admin/mail/useUndoSend.ts` — 10 sekund odliczania po stronie
klienta, świadoma decyzja właściciela z 2026-07-15 (Vercel nie utrzymuje
kolejki między zimnymi startami). Nie cofaj tej decyzji, ale **zmierz jej
brzegi**:

- co się dzieje, gdy zamkniesz kartę w 5. sekundzie odliczania — mail idzie
  czy przepada? **Właściciel musi wiedzieć, która z tych dwóch rzeczy zachodzi**,
  bo obie są do obrony, a domysł nie;
- czy apka iOS ma to samo? Jeśli panel daje 10 s na rozmyślenie się, a telefon
  wysyła natychmiast, to jest realna różnica w zachowaniu, nie kosmetyka;
- czy odliczanie przeżywa przejście na inny ekran w panelu.

**2. MOVE i sync są wołane SYNCHRONICZNIE z żądania** — świadomy dług zapisany
w `04b-poczta-pelny-klient.md` („utrzymanie status quo, nie pogłębienie
długu"). Sprawdź, czy to się jeszcze mieści w limitach: Vercel Hobby ma sufit
czasu funkcji, a **apka ma własne, KRÓTSZE limity** i potrafi przerwać żądanie,
które panel spokojnie dokończy (pamięć `leady-runda-domykajaca` — dokładnie ta
pułapka). Duża skrzynka po dłuższej przerwie to najgorszy przypadek.

**3. Flagi IMAP są JEDNOKIERUNKOWE** — `\Seen`/`\Answered`/`\Flagged` nie są
lustrzane z Outlookiem (świadomie odłożone 2026-07-16). To zostaje, ale jest
tam ostrzeżenie warte sprawdzenia: **`PERMANENTFLAGS` na `SELECT` decyduje, czy
serwer w ogóle przyjmie zapis flagi — bez tego zapis bywa PO CICHU
IGNOROWANY.** Cicha porażka zapisu to ten sam kształt, co `{"ok":true}` na
śmieciu. Zmierz, czy panel gdziekolwiek zapisuje flagę bez sprawdzenia.

**4. Załącznik dociągany z IMAP na żądanie** (decyzja kosztowa, pamięć
`zalaczniki-na-zadanie-imap` — w bazie metadane, treść przy kliknięciu).
Pytanie kluczowe: **czy „ten załącznik już nie istnieje" mówi to samo, co „nie
mogę się teraz połączyć"?** Jeśli oba dają ten sam komunikat, właściciel
skasuje maila, który był w porządku. To jest odpowiednik „kosztu bez kursu"
z Modułu 63: stan nieustalony musi być NAZWANY, nie zamieciony pod dywan.

---

## Zakres

### A. Integralność — sonda `curl` PER UCHWYT HTTP

```bash
DEV_ADMIN_BYPASS=0 npx next dev -p 3111   # sonda 401
npx next dev -p 3111                       # sonda biznesowa
```

**22 uchwyty w 17 plikach.** Sonda 401 prawdopodobnie wyjdzie 22/22 (patrz
wyżej) — puść ją mimo to, zajmuje minutę i jest dowodem, nie założeniem.

Sonda biznesowa ma szukać czego innego niż przy Kosztach:

- **odbiorca**: adres bez `@`, sam `@`, 500 adresów naraz, adres z przecinkiem
  w nazwie, `Bcc` na 200 osób — co przechodzi do `sendMail`?
- **wstrzyknięcie nagłówka**: znak nowej linii w temacie albo w adresie
  (`Subject: X\nBcc: ktos@obcy.pl`). To klasyka SMTP i jedyne miejsce
  w produkcie, gdzie ma znaczenie;
- **`schedule`**: data w przeszłości, rok 0202, termin za 10 lat — i co robi
  `DELETE` zaplanowanej wiadomości, która JUŻ jest w trakcie wysyłki
  (`status = 'sending'`);
- **`subscriptions` DELETE** — wypisanie z newslettera to akcja NA ZEWNĄTRZ.
  Czy da się wypisać coś, czego nie ma? Czy odpowiada 404, czy `{"ok":true}`?
- **`to-task` / `create-lead` / `create-client`**: dwa kliknięcia z dwóch kart
  = dwa rekordy? Idempotencja należy do SERWERA, nie do blokady przycisku
  (pamięć `modul-26-notatnik`);
- **`sync`**: dwa równoległe wywołania — czy kursory per folder się nie
  rozjadą?

### B. Dwa ⚠️ z inwentarza — i dwa braki zmierzone gretem

Wiersz „Poczta" w `59-spojnosc-ui.md` pokazuje ⚠️ przy **Klawiaturze**
i **Stanach**, reszta ✅. Inwentarz mylił się CZTERY razy z rzędu, więc zmierz
oba — ale tym razem grep sugeruje, że **coś tu naprawdę jest**:

| co | pomiar |
|---|---|
| `useSkrotyListy` | 1 plik — jest |
| `PoleSzukania` | 1 plik — jest |
| `useContextMenu` | 1 plik — jest |
| `StanBledu` | 1 plik — jest |
| **`StanListy`** | **0 plików** |
| **`SekcjaProfilu`** | **0 plików** |

`StanListy` to wspólny pusty stan z paczki E, `SekcjaProfilu` to wiersz
„etykieta — wartość" z paczek F/F+. Poczta jest jedynym modułem bez obu.
Rozstrzygnij, czy to **brak** (do nadrobienia), czy **uzasadniony wyjątek** —
Poczta ma kształt Apple Mail, a nie listy rekordów, więc odpowiedź „nie pasuje"
jest dopuszczalna, ale musi być ZAPISANA, nie domyślna.

Rozstrzygaj **pomiarem**: `getComputedStyle` na klonie + wzór WCAG.

### C. Cała lista kontrolna, trzy platformy

Szczególnie:

- **Trzy punkty AI**: `draft-reply` (Moduł 7), `summarize-thread` (Moduł 49),
  `draft-note` (Moduł 50). Reguła brzmi „model proponuje, właściciel
  zatwierdza" — sprawdź, czy to jest **widoczne na ekranie**, a nie tylko
  prawdziwe w kodzie. Szczególnie przy odpowiedzi: szkic nie może dać się
  wysłać jednym kliknięciem bez przeczytania.
- **Parytet z apką** — Poczta ma tam pełny klient (Faza 4). Dowodem luki jest
  trasa panelu, której `APIClient` nie woła (pamięć `apka-luki-wobec-panelu`).
- **Nawigacja klawiaturą** j/k/Enter/r/e istnieje od Etapu 2 — sprawdź, czy nie
  gryzie się ze wspólnym `useSkrotyListy` z paczki C.

### D. Ruch i haptyka

Panel: `lib/motion.ts` (`SPRING`, `EASE_LIQUID`), żadnych liczb z palca.
Apka: `Ruch.swift`, haptyka przy GARDŁACH — a w Poczcie gardłem jest WYSŁANIE,
nie otwarcie wiadomości.

---

## Świadome decyzje — NIE cofaj bez pytania

- **„Cofnij wysyłkę" po stronie klienta** — decyzja właściciela 2026-07-15,
  wymuszona architekturą Vercela. Mierz brzegi, nie przepisuj.
- **Załączniki na żądanie z IMAP** — decyzja kosztowa; w bazie metadane, treść
  przy kliknięciu.
- **Flagi jednokierunkowe, CONDSTORE/QRESYNC, Robocze (Drafts)** — świadomie
  odłożone 2026-07-16, opisane w `04b-poczta-pelny-klient.md`.
- **„Wycisz" ≠ „Archiwizuj"** — dwie niezależne osie, decyzja właściciela
  2026-07-16. Wyciszenie chowa z kolejki, ale zostawia wiadomość w INBOX-ie.
- **Podpis mailowy zostaje na EMOJI** — w HTML-u maila nie wyrenderujesz
  komponentu Reacta, a ikony-obrazki bywają blokowane (`CLAUDE.md`, sekcja
  „Emoji vs ikony", wyjątek 1). To NIE jest niespójność do naprawienia.
- **Język podpisu wybiera właściciel ręcznie**, nie automat po kraju klienta.

## Czego NIE ruszać

- `PO_REJESTRACJI.md` — firma nie jest zarejestrowana.
- Przeprowadzka na NAS (Moduł 55) — czeka na rejestrację.
- Nowy punkt użycia lokalnego LLM wymaga wyraźnej prośby właściciela. Trzy
  istniejące (szkic odpowiedzi, podsumowanie wątku, szkic notatki) to komplet.

---

## Co zastajesz po Kosztach (Moduł 63)

- **`czytajPolaKosztu()`** (`lib/costs.ts`) — najnowszy wzorzec bramki zapisu,
  gdyby jednak okazał się w Poczcie potrzebny.
- **`maPrzelicznik()`** — wzorzec „danej, której NIE DA SIĘ ustalić": jest
  wyłączona z sum, ale **wyłączenie jest WIDOCZNE**. Ten wzorzec przenosi się
  wprost na załącznik, którego nie udało się dociągnąć.
- **`stopienPilnosci` na DACIE** — czerwień jako koniec rampy, nie trzeci kolor
  statusu.
- **Bramka zapisu psuje optymistyczny UI** — gdy trasa zacznie odmawiać, każdy
  edytor musi cofać `setState` i pokazywać dosłowny powód.
- **`lib/instrukcje.ts` ma dziewiąty moduł (Koszty).** Zmiana gestu, skrótu
  albo miejsca kontrolki = poprawka tam, w tym samym commicie.

**Punkt startu:** sprawdź `git log` w obu repozytoriach i upewnij się, że
wierzchołkiem jest commit Modułu 63 — jeśli nie, ktoś pracował po drodze.

**ZANIM ZACZNIESZ — przeczytaj:**
- `CLAUDE.md` — zasady projektu, w tym design system.
- `docs/plany-modulow/59-spojnosc-ui.md` — lista kontrolna z 10 kategorii.
  Wypełnij wiersz „Poczta".
- `HUB_SETUP.md` → „Moduł 4 — Etap 2 (foldery IMAP)" i **„Audyt Kosztów
  (Moduł 63)"**.
- `docs/plany-modulow/04b-poczta-pelny-klient.md` — co jest zrobione, a co
  świadomie odłożone (lista z nieprzekreślonymi punktami).
- `docs/plany-modulow/51-audyt-uiux-panel-i-apka.md` → „Stan po module Koszty".

---

## Weryfikacja — działające procedury

**Panel lokalnie** (PGlite + dev-login): `npm run dev`, potem narzędzia
przeglądarki. Pułapki, na których traci się czas:

- **Poczty NIE da się w pełni sprawdzić lokalnie bez skrzynki.**
  `isMailboxConfigured()` jest fałszem bez `MAIL_IMAP_HOST`/`MAIL_USER`/
  `MAIL_PASS`, a te żyją tylko w env Vercela. Część tras odda wtedy 400/503
  i **to jest poprawne zachowanie, nie awaria** — nie goń tego jako błędu.
  Zaplanuj, co da się zmierzyć lokalnie (walidacja wejścia, 401, kształt
  odpowiedzi), a co wymaga pytania do właściciela.
- **Next 16 nie uruchomi drugiego serwera dev dla tego samego katalogu** —
  i potrafi zostawić OSIEROCONY proces z poprzedniej sesji na porcie 3000.
  Sprawdź `lsof -iTCP -sTCP:LISTEN -P | grep 3000` i ubij go, zanim zaczniesz;
  inaczej sonda dostaje `000` i wygląda jak awaria wszystkich tras.
- **Baza PGlite kasuje się przy KAŻDYM przeładowaniu modułów serwera.** Twórz
  dane testowe i mierz je w jednym ciągu.
- **Konsola przeglądarki oddaje HISTORIĘ, nie stan bieżący.** Rozstrzyga
  `get_page_text` albo `read_page`.
- `getComputedStyle` na elemencie z `transition` zwraca wartość POCZĄTKOWĄ —
  rozstrzyga klon (`cloneNode`). Kontrast licz po KOMPOZYCJI rgba na
  nieprzezroczystym tle przodka. **I mierz NAJGŁĘBSZY węzeł z tekstem** —
  opakowanie `Tooltipa` ma `display: contents`, nie niesie koloru i zwróci
  odziedziczone `--fg` (przy Kosztach dało to niemal biel tam, gdzie ekran był
  czerwony).
- **Klikając w treść strony z poziomu JS, wyklucz pasek boczny** —
  `querySelectorAll('button')` trafia najpierw w link nawigacji i przenosi Cię
  na inny ekran.
- `npx tsc --noEmit` **nie widzi CSS-a, SQL-a ani JSX-a, który odrzuci
  Turbopack**. Po każdej paczce **załaduj dotknięty ekran**.
- `npm test` — 170 przypadków; `test/koszty.test.ts` jako najświeższy wzór
  testu bramki (czysta funkcja, bez bazy).

**Apka w symulatorze na LOKALNYM panelu:**

```bash
curl -s -X POST http://localhost:3000/api/admin/login \
  -H 'content-type: application/json' \
  -d '{"password":"<z .env.local>","device":"Symulator"}'   # ciało MUSI mieć `device`

SIMCTL_CHILD_LEGGERA_DEV_BACKEND=lokalny \
SIMCTL_CHILD_LEGGERA_DEV_TOKEN=<token> \
SIMCTL_CHILD_LEGGERA_DEV_ZGODA_CICHA=1 \
  xcrun simctl launch <udid> pl.leggeralabs.hub
```

`Skrypty/stempel-wersji.sh` **przed** `xcodebuild` — inaczej build zatrzyma się
błędem „Stempel wskazuje rewizję X, a repozytorium stoi na Y".
**`simctl install` kasuje zapisany token** — po każdej reinstalacji weź NOWY
z `/api/admin/login`. Przestrzeń dotyku symulatora ≠ piksele zrzutu.
Poczta jest w GŁÓWNEJ belce, więc `SIMCTL_CHILD_LEGGERA_DEV_TAB` tu zadziała.

---

## Lekcje warte sprawdzenia akurat u Poczty

1. **Cicha porażka zapisu to ten sam wróg, co `{"ok":true}` na śmieciu** —
   patrz `PERMANENTFLAGS` (konkret 3).
2. **Stan nieustalony musi być NAZWANY** — „nie wiem, czy załącznik istnieje"
   ≠ „załącznika nie ma" (konkret 4, wzorzec `maPrzelicznik` z Modułu 63).
3. **Idempotencja należy do SERWERA.** Blokada przycisku nie chroni przed
   drugą kartą — a tutaj skutkiem jest wysłany mail, nie zdublowany wiersz.
4. **Limity czasu apki są KRÓTSZE niż panelu** — długa trasa działa na
   desktopie i wywala się na telefonie.
5. **Komentarz SQL `--` wewnątrz `sql\`…\`` wycina resztę zapytania.**
6. **Nowe pole w Swifcie to TRZY miejsca** — właściwość, `CodingKeys`
   i `init(from:)`. Pominięcie trzeciego kompiluje się i po cichu nie działa.
7. **Nie naprawiaj tego, co działa.** Ten moduł jest najdojrzalszy w produkcie;
   zmiana bez zmierzonego powodu to nowy dług, nie porządek.

---

## Na koniec modułu

- Dopisz „Stan po module Poczta" do `51-audyt-uiux-panel-i-apka.md` —
  **łącznie z tym, czego NIE zmieniłeś i dlaczego**. Przy module w dobrym
  stanie to jest główny produkt sesji.
- **Wypełnij wiersz „Poczta"** w tabeli wyniku w `59-spojnosc-ui.md`.
- Uzupełnij `HUB_SETUP.md` — każdy nowy wzorzec z jednym zdaniem UZASADNIENIA.
- Dopisz moduł do `lib/instrukcje.ts` — dopiero gdy jest sprawdzony.
- Przygotuj prompt do następnego modułu: **Przypomnienia** (2 ❌, 4 ⚠️;
  sterują automatami, więc zła data działa jak rok „0202" w kosztach
  cyklicznych) albo **Notatnik** (`PROMPT-64-NOTATNIK.md` już gotowy).
- `rm -f .git/index.lock && git add -A && git commit && git push`.
