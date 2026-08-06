# Brief etapu 2: bezpieczeństwo — sprawdzenie PRZYROSTU

**Powstał:** 2026-08-06, jako drugi etap `docs/PLAN-DOMKNIECIA.md`.
**Zakres:** panel. Apki nie ruszamy.
**Czas:** jedna sesja.

---

## Po co to, skoro Audyt 1 zamknął temat

Audyt 1 (2026-07-22, `docs/AUDYT-1-WYNIKI.md`, commit `a485b00`) przejrzał
wszystkie trasy i zamknął temat. **Od tamtej pory repozytorium urosło.**
Policzone tuż przed napisaniem tego briefu:

| co | ile |
|---|---|
| plików tras `app/api/**/route.ts` | **188** |
| uchwytów HTTP (GET/POST/PATCH/DELETE) | **266** — 103 POST, 91 GET, 41 DELETE, 31 PATCH |
| **plików tras DODANYCH po Audycie 1** | **39** |
| plików tras ZMIENIONYCH po Audycie 1 | **83** |

`CLAUDE.md` ostrzega wprost: **każda nowa trasa w `app/api` jest domyślnie
OTWARTA**, bo `proxy.ts` wyłącza `/api` ze swojego zakresu. Zapomniana linijka
nie daje żadnego objawu — build przechodzi, panel działa, `tsc` jest czysty.

---

## NAJPIERW PRZECZYTAJ TO — dwie metody już udowodniły, że kłamią

To jest najważniejsza część briefu. **Nie zaczynaj od grepowania.**

### Kłamstwo nr 1 (Audyt 1): grep po PLIKU

Plik może mieć cztery uchwyty i jedno `isAuthed()`. Audyt 1 policzył tak
9 tras tam, gdzie było ich 16. **Licz uchwyty, nie pliki.**

### Kłamstwo nr 2 (rekonesans do tego briefu, 2026-08-06): grep po UCHWYCIE

Naprawiłem metodę — pociąłem pliki na ciała uchwytów i sprawdziłem, czy
`isAuthed()` stoi w tym konkretnym ciele. Wyszło **21 uchwytów bez ochrony**.
Sprawdzone jeden po drugim: **żaden nie był dziurą.**

Najciekawszy fałszywy pozytyw to `POST /api/invoices/[id]/ksef/send`. Uchwyt
wygląda tak:

```ts
export async function POST(req, { params }) {
  const { id } = await params;
  return runSend(id, odczytajPotwierdzenie(req.headers));
}
```

Ochrona siedzi w `runSend()`, czyli **jedno wywołanie dalej**. Grep po ciele
uchwytu tego nie widzi. Dokładnie tak samo zachowa się każdy uchwyt, który
deleguje robotę do funkcji pomocniczej — a takich będzie przybywać.

### Co z tego wynika dla metody

**Jedynym testem, który nie kłamie, jest SONDA 401 na żywej trasie**, przy
wyłączonym dev-bypassie. Grep służy wyłącznie do zbudowania listy rzeczy DO
SPRAWDZENIA, nigdy do wydania werdyktu. To jest ta sama lekcja, którą projekt
ma już zapisaną przy ośmiu innych okazjach: **rozstrzyga pomiar, nie wygląd
kodu.**

---

## Punkt wyjścia: 21 uchwytów bez `isAuthed()` w ciele

Rekonesans znalazł te i **wstępnie** ocenił jako w porządku. To jest lista do
POTWIERDZENIA sondą, nie wynik.

| uchwyt | dlaczego (wstępnie) w porządku |
|---|---|
| `POST admin/login`, `POST admin/logout` | logowanie i wylogowanie — z definicji przed sesją |
| `POST backup/ping` | własny `BACKUP_PING_SECRET`, fail-closed bez niego |
| `GET calendar/ics` | własny `CALENDAR_ICS_SECRET` w query, fail-closed bez niego |
| `GET leads/notify`, `GET leads/hunt/run` | crony Vercela, `Authorization: Bearer CRON_SECRET` |
| `POST telefonia/webhook` | token w query — centrala nie umie nagłówków |
| `GET references` | dane z definicji publiczne (opinie ZE ZGODĄ na referencję) |
| `POST/GET ksef/auth/test` | **ochrona jest — w GET wprost, w POST przez helper** |
| `POST invoices/[id]/ksef/send` | **ochrona w `runSend()`, nie w uchwycie** |
| 8 × `*/public/[token]/*` (oferty, umowy, faktury, wezwanie, opinia) | publiczne z założenia — chroni je token + hamulec |

**Trzy z nich zasługują na osobną uwagę sondy**, bo ich „ochrona" to nie
`isAuthed()`, tylko sekret w URL-u: `calendar/ics`, `telefonia/webhook`
i `backup/ping`. Pytanie do sprawdzenia nie brzmi „czy jest sekret", tylko:
**czy bez sekretu trasa naprawdę odmawia i czy sekret nie wycieka do logów.**

Komenda, którą wygenerowano tę listę (do powtórzenia, nie do zaufania):

```bash
grep -rhoE '^export async function (GET|POST|PATCH|PUT|DELETE)' app/api --include=route.ts | wc -l
```

Pełne cięcie na uchwyty zrobił jednorazowy skrypt w Pythonie — **nie został
zapisany do repo świadomie**, bo ma udowodnioną wadę (nie widzi ochrony
w helperze), a narzędzie z wadą, które leży w `scripts/`, prędzej czy później
zostanie użyte jako werdykt. Jeśli uznasz, że warto mieć je na stałe — napisz
je tak, żeby szło ZA wywołaniami funkcji, i dopiero wtedy commituj.

---

## Zakres

### 1. Przyrost, nie całość

Sercem etapu jest **39 nowych plików tras** i **83 zmienione**. Pełna lista
nowych, pogrupowana:

- **`leads` (9):** `blacklist`, `blacklist/[id]`, `candidates`,
  `candidates/[id]/hook`, `candidates/[id]/reject`, `candidates/[id]/take`,
  `hunt/run`, `hunts`, `hunts/[id]`
- **`offers` (7):** `[id]/remind`, `[id]/sections`, `[id]/sections/[sectionId]`,
  `[id]/version`, `bulk`, `public/[token]/comment`, `public/[token]/reject`
- **`admin` (6):** `2fa`, `2fa/backup-codes`, `2fa/confirm`, `2fa/disable`,
  `2fa/start`, `wejscie`
- **`clients` (5):** `[id]/contacts`, `[id]/contacts/[contactId]`, `bulk`,
  `powiazania`, `search`
- **`contracts` (4):** `[id]/aneks`, `[id]/faktura-zaliczkowa`,
  `[id]/podpis-nasz`, `[id]/remind`
- **`mail` (2):** `[id]/draft-note`, `[id]/summarize-thread`
- **po jednym:** `hub/propozycje`, `instrukcje`, `notes/[id]/attachment`,
  `observability`, `sciezka/[rodzaj]/[id]`, `share-links/[kind]/[id]`

Komenda odtwarzająca tę listę:

```bash
git diff --name-status a485b00..HEAD -- 'app/api/**/route.ts' | grep '^A'
```

**Zwróć szczególną uwagę na trzy grupy:**

- **`admin/2fa/*` i `admin/wejscie`** — trasy, które same są mechanizmem
  logowania. Otwarte `2fa/disable` znaczyłoby, że drugi składnik da się zdjąć
  bez pierwszego. To najpoważniejsza możliwa dziura w tym zestawie.
- **`offers/public/[token]/reject` i `/comment`** — nowa powierzchnia dla
  KLIENTA, dołożona w kroku 5. Publiczna świadomie; pytanie brzmi, czy ma
  hamulec i czy nie wypuszcza pól, których klient widzieć nie powinien.
- **`*/bulk` (klienci, oferty)** — jedno żądanie dotyka wielu rekordów.
  Otwarta trasa hurtowa jest gorsza od otwartej pojedynczej dokładnie tyle
  razy, ile rekordów obejmuje.

### 2. Sonda 401 — z WYŁĄCZONYM dev-bypassem

Bez tego sonda kłamie i pokaże, że wszystko jest chronione (lekcja z audytu
Projektów). W `.env.local` jest `DEV_ADMIN_BYPASS=1` — zakomentuj albo ustaw
`0`, **zrestartuj `npm run dev`** (zmienne czyta się przy starcie) i dopiero
wtedy sonduj. Po skończeniu **przywróć**, bo bez niego nie zobaczysz panelu
lokalnie ani nie przejdzie `npm run przejscie`.

Sonda ma dla każdego uchwytu odpowiedzieć jednym z dwóch zdań:

- **chroniony** — bez ciastka sesji oddaje 401;
- **publiczny świadomie, bo…** — z podanym powodem i mechanizmem, który go
  pilnuje zamiast `isAuthed()` (token, sekret, cron).

Trzeciego wyniku nie ma. „Nie wiem" znaczy: sprawdź jeszcze raz.

### 3. Trzy rzeczy poza listą tras

- **Publiczne strony dokumentów** — czy `lib/publicFields.ts` obejmuje kolumny
  dodane po Audycie 1. Przybyło ich sporo (`superseded_at`, `powod_odrzucenia`,
  `komentarz_odrzucenia`, pola aneksu, `kotwica`). Pytanie: czy klient przez
  publiczny link nie widzi czegoś, czego nie powinien — na przykład powodu,
  dla którego JEGO ofertę oznaczono jako przegraną.
- **Hamulce** — czy `lib/rateLimit.ts` nadal działa po zmianach z kroku 5
  (zmieniono to, co się liczy: pomyłki zamiast wszystkiego, plus zerowanie
  licznika po sukcesie). Sprawdź też, czy nowe trasy publiczne (`reject`,
  `comment`) w ogóle są pod hamulcem.
- **Dane osobowe w logach** — czy nowe trasy nie robią `console.log` z e-mailem,
  telefonem albo NIP-em. Audyt 2 (RODO) ustalił, że surowe dane w logach są
  problemem; nowe trasy tego ustalenia nie znały.

---

## Czego NIE robić

- **Nie przepisuj Audytu 1 od zera.** Jego wynik stoi; tu sprawdzamy PRZYROST.
- **Nie „naprawiaj" tras publicznych świadomie.** Osiem tras `public/[token]`,
  formularz kontaktowy, `references` i crony mają być otwarte. Dopisanie im
  `isAuthed()` zepsułoby produkt, a wygląda jak poprawka bezpieczeństwa.
- **Nie rozluźniaj hamulca publicznych dokumentów, „bo przeszkadza w sondzie"** —
  próg 5/60 min jest decyzją z Audytu 1 (`HANDOFF.md`). Sondę ułóż tak, żeby
  go nie zjadała, albo sonduj po restarcie serwera.
- **Nie ruszaj apki.**
- **Nie zostawiaj wyłączonego `DEV_ADMIN_BYPASS`** po skończonej robocie.

---

## Sprawdzenie

`npx tsc --noEmit -p tsconfig.json`, `npm test` (**352**),
`npm run przejscie` (**116 działa · 0 regresji**) — nawet jeśli nie zmieniasz
kodu, bo przejście jest jedynym sprawdzeniem, które chodzi po żywych trasach.

**Uwaga na kolejność:** `npm run przejscie` wymaga WŁĄCZONEGO dev-bypassu.
Sonduj z wyłączonym, potem przywróć i dopiero uruchamiaj przejście.

---

## Na koniec

Wynik do **`docs/AUDYT-1B-PRZYROST.md`** — także wtedy, gdy jest pusty. Pusty
wynik po sondzie na 266 uchwytach jest wartościowy: znaczy, że wzorzec
`if (!(await isAuthed()))` utrzymał się przez czterdzieści nowych plików,
i następny audyt nie musi liczyć tego trzeci raz.

Zaktualizuj `HANDOFF.md` i odhacz etap 2 w `docs/PLAN-DOMKNIECIA.md`.
Commit i push tylko dla panelu.
