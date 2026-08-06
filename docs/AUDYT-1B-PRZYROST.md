# Audyt 1B — przyrost tras od Audytu 1

**Wykonany:** 2026-08-06. **Zakres:** panel (apki nie dotykano).
**Etap 2 z pięciu** `docs/PLAN-DOMKNIECIA.md`. Brief: `docs/ETAP-2-BEZPIECZENSTWO-BRIEF.md`.
**Punkt odniesienia:** Audyt 1 (2026-07-22, `docs/AUDYT-1-WYNIKI.md`, commit `a485b00`).

---

## Wynik jednym zdaniem

**Zero dziur. Zero zmian w zachowaniu panelu.** Wszystkie **266 uchwytów HTTP**
ma rozstrzygnięcie: **252 chronione** (sonda bez ciastka dostaje 401),
**14 publicznych świadomie**, każdy z nazwanym mechanizmem, który pilnuje go
zamiast `isAuthed()`. Wzorzec `if (!(await isAuthed()))` utrzymał się przez
**39 nowych plików tras** i 83 zmienione.

To jest ten „pusty wynik", o który prosił brief — i on jest wartościowy:
następny audyt nie musi liczyć tego trzeci raz.

| co | ile |
|---|---|
| plików tras `app/api/**/route.ts` | 188 |
| uchwytów HTTP | **266** (91 GET, 103 POST, 41 DELETE, 31 PATCH) |
| plików tras dodanych po Audycie 1 | 39 |
| plików tras zmienionych po Audycie 1 | 83 |
| **uchwytów odmawiających bez ciastka (401)** | **252** |
| **uchwytów publicznych świadomie** | **14** |
| dziur | **0** |

Sprawdzenie: `tsc` czysto, `npm test` **352/352**,
`npm run przejscie` **116 działa · 0 regresji**.

---

## Metoda — i dlaczego akurat taka

Brief ostrzegał, że dwie metody już skłamały. Potwierdziło się, i doszła
trzecia obserwacja.

| metoda | kiedy skłamała | jak |
|---|---|---|
| grep po **PLIKU** | Audyt 1, 2026-07-22 | plik ma cztery uchwyty i jedno `isAuthed()` — naliczył 9 tras tam, gdzie było 16 |
| grep po **UCHWYCIE** | rekonesans do etapu 2, 2026-08-06 | ochrona bywa o jedno wywołanie dalej (`POST invoices/[id]/ksef/send` → `runSend()`) — 21 „dziur", żadna prawdziwa |
| **liczenie plików zamiast uchwytów** | ten brief, 2026-08-06 | brief pisał „8 × `public/[token]`" — uchwytów jest **10** (patrz tabela niżej) |

Trzecia pozycja jest tą samą pomyłką co pierwsza, popełnioną przy pisaniu
ostrzeżenia przed nią. **Plik to nie uchwyt** — również w dokumentacji.

Rozstrzygała **sonda na żywej trasie**: strzał w każdy z 266 uchwytów bez
ciastka sesji i bez nagłówka `Authorization`, przy `DEV_ADMIN_BYPASS=0`
i po restarcie `npm run dev`.

**Kontrola odwrotna (najważniejsza część metody).** Sonda, która widzi same
401, może być zepsuta zamiast uspokajająca. Że rozróżnia stany, dowodzą jej
własne wyniki: `GET /api/references` oddał 200 z danymi, `POST /api/leads`
oddał 400 z walidacji. Gdyby sonda kłamała, te dwie też byłyby 401.

**Druga sonda — nagłówkiem.** Pierwsza nie wysyłała `Authorization` w ogóle,
więc nie dotykała gałęzi Bearer w `isAuthed()`. Powtórzona na 256 uchwytach
(bez `public/`, żeby nie zjeść hamulca dokumentów) z `Authorization: Bearer
<CRON_SECRET>`: **żadna trasa nie bierze sekretu crona za sesję
administratora**. Kontrolnie też ze śmieciowym tokenem — `leads/notify`,
`mail/outbox/run`, `GET /api/leads` i `admin/wejscie` oddają 401.

Ta runda wykryła **trzeci cron, którego brief nie wymieniał**:
`GET /api/mail/outbox/run` (bez nagłówka 401, z `CRON_SECRET` 200). Lista
21 uchwytów z rekonesansu była niepełna — kolejny argument za sondą.

**Czego sonda NIE dowodzi (uczciwie).** Że 401 jest nie do obejścia inną
drogą — porównanie ciastka i odporność na atak czasowy sprawdzał Audyt 1
i ta warstwa się nie zmieniła. Sonda podstawia też nieistniejące
identyfikatory (`999999`), więc trasa chroniona tylko dla NIEKTÓRYCH wartości
parametru wyglądałaby na chronioną; dlatego uchwyty o najwyższej stawce
(2FA, hurtowe) przeczytano dodatkowo — wszystkie mają `isAuthed()` w pierwszej
linii ciała, bezwarunkowo.

**Narzędzie zostaje w repo:** `scripts/sonda-401.ts`. Zaczyna od
samosprawdzenia i **odmawia biegu przy włączonym dev-bypassie** — bez tego
pokazałoby komplet zieleni i fałszywie uspokoiło. Uruchomione w wersji
commitowanej i odtworzyło te same 14 wyników niezależnie.

---

## 14 uchwytów publicznych świadomie

Każdy ma mechanizm zamiast `isAuthed()`. **Żadnemu z nich nie wolno dopisać
`isAuthed()`** — to wyglądałoby na poprawkę bezpieczeństwa, a zepsułoby produkt.

| uchwyt | odpowiedź sondy | co go pilnuje |
|---|---|---|
| `POST admin/logout` | 200 | nic i nie musi — kasuje ciastko, którego nie ma; nie czyta i nie zmienia danych |
| `POST leads` | 400 (walidacja) | formularz kontaktowy strony; hamulec `HAMULEC_FORMULARZ` 5/60 min |
| `GET references` | 200 z danymi | dane z definicji publiczne — tylko opinie ze zgodą na case study; jawna lista kolumn |
| `POST telefonia/webhook` | 500 | `TELEFONIA_WEBHOOK_SECRET` w query; fail-closed — bez sekretu w env trasa się zamyka |
| `GET contracts/public/[token]` | 404 | token w linku = hasło |
| `POST contracts/public/[token]/accept` | 400 | token + `strazDokumentuPublicznego` |
| `GET invoices/public/[token]` | 404 | token w linku |
| `GET invoices/wezwanie/public/[token]` | 404 | **osobny** token wezwania |
| `GET offers/public/[token]` | 404 | token w linku |
| `POST offers/public/[token]/accept` | 400 | token + hamulec |
| `POST offers/public/[token]/comment` | 400 | token + hamulec (`sukcesLiczySie: true`) |
| `POST offers/public/[token]/reject` | 404 | token + hamulec |
| `GET projects/review/public/[token]` | 404 | token w linku |
| `POST projects/review/public/[token]/submit` | 404 | token + hamulec |

Uchwytów `public/[token]` jest **10**, nie 8.

### Cztery trasy chronione sekretem, nie sesją — sprawdzone dwustronnie

Brief słusznie kazał im się przyjrzeć osobno: ich „ochrona" to sekret,
a trasa, która odmawia ZAWSZE, wygląda w sondzie identycznie jak chroniona,
choć jest po prostu zepsuta. Sprawdzone w obie strony:

| trasa | bez sekretu | ze złym | **z poprawnym** |
|---|---|---|---|
| `GET calendar/ics` | 401 | 401 | **200** (`?token=`) |
| `POST backup/ping` | 401 | 401 | **200** (`Authorization: Bearer`) |
| `GET leads/notify` | 401 | 401 | **200** (cron) |
| `GET leads/hunt/run` | 401 | 401 | **200** (cron) |
| `GET mail/outbox/run` | 401 | — | **200** (cron) |

Po drodze złapano pomyłkę własnej sondy, wartą zapisania: pierwsze podejście
strzelało do `ics` parametrem `?secret=`, a do `backup/ping` sekretem w ciele
JSON. Obie oddały 401 — i **wyglądało to na poprawną ochronę**. Dopiero
lektura pokazała, że jedna czyta `?token=`, a druga nagłówek. **401 z powodu
źle zadanego pytania jest nie do odróżnienia od 401 z powodu ochrony** —
dlatego przy trasach na sekret trzeba pokazać też, że z poprawnym sekretem
wpuszczają.

**Uwaga do zapamiętania, nie usterka:** `calendar/ics` niesie sekret w URL-u,
więc trafia on do logów dostępowych Vercela i do historii aplikacji
kalendarzowej. To świadoma cena za subskrypcję kalendarza (Apple/Google nie
wysyłają nagłówków). Sekret jest osobny od hasła i od `CRON_SECRET`, a jego
wyciek daje wyłącznie odczyt kalendarza — nie dostęp do panelu.

---

## Trzy rzeczy poza listą tras

### 1. Publiczne strony dokumentów — biała lista wytrzymała

Po Audycie 1 doszły do tabel dokumentowych **52 kolumny**. Na białe listy
w `lib/publicFields.ts` weszła **21** — wszystkie to TREŚĆ dokumentu (okres
obowiązywania umowy, pola DPA, aneks, ROI oferty, czas realizacji,
`superseded_at`). **Nie weszła ani jedna kolumna wewnętrzna.**

Biała lista jest z natury odporna na to, czego bał się brief: nowa kolumna
nie staje się publiczna sama z siebie — ryzykiem jest brak pola u klienta,
nie nadmiar. Mimo to sprawdzone pomiarem, nie lekturą.

**Dowód empiryczny.** Oferta przepuszczona przez prawdziwą wysyłkę, potem
`powod_odrzucenia` i `komentarz_odrzucenia` ustawione na wartości-znaczniki
(`TAJNE-…`) i otwarty publiczny link:

```
pól u admina: 43  |  pól u klienta: 21
ukryte przed klientem (22): accepted_ip, accepted_user_agent, client_id,
  invoice_id, klient_email, komentarz_odrzucenia, lead_id, liczba_otwarc,
  migawka, migawka_at, odrzucona_at, ostatnio_otwarta_at, otwarta_at,
  parent_offer_id, powod_odrzucenia, project_id, przypomniano_at,
  share_revoked_at, share_token, updated_at, wersja, wyslana_at

czy „TAJNE" wyciekło do klienta: nie
czy migawka wyciekła: nie
czy share_token wyciekł: nie
```

Pytanie briefu — „czy klient widzi powód, dla którego JEGO ofertę oznaczono
jako przegraną" — ma odpowiedź **nie**, zmierzoną, a nie wyczytaną.

Sekcje oferty idą do klienta **bez filtrowania**, świadomie i bezpiecznie:
`offer_sections` ma tylko `id / offer_id / tytul / tresc / position`, czyli
treść pisaną przez właściciela DLA klienta.

Formularz opinii (`projects/review/public/[token]`) nie używa białej listy,
bo wylicza dziewięć pól jawnie — nie robi `SELECT *`, więc nowa kolumna też
się przez niego nie przeciśnie.

`GET /api/references` wydaje `review_consent_name` — imię i nazwisko osoby,
która podpisała zgodę. To jest sens referencji i jest bramkowane
`review_consent_case_study = true`. **Dowody techniczne zgody**
(`review_consent_ip`, `review_consent_user_agent`, `review_consent_text`)
**nie wychodzą** — ta sama ostrożność co przy `accepted_ip` na umowach
(ustalenie 5 Audytu 1). Wycofanie referencji: odznaczenie zgody w profilu
projektu działa natychmiast.

### 2. Hamulce — działają, także na nowej powierzchni z kroku 5

Wszystkie **pięć** publicznych tras zapisujących przechodzi przez
`strazDokumentuPublicznego`, w tym obie dołożone w kroku 5:

| trasa | straż | zerowanie po sukcesie |
|---|---|---|
| `offers/public/[token]/accept` | tak | zeruje (jednorazowa) |
| `offers/public/[token]/reject` | tak | zeruje (jednorazowa) |
| `offers/public/[token]/comment` | tak | **`sukcesLiczySie: true`** — poprawnie |
| `contracts/public/[token]/accept` | tak | zeruje |
| `projects/review/public/[token]/submit` | tak | zeruje |

Sprawdzone nie tylko po obecności wywołania: w każdej z nich **oba** liczniki
(`odnotujNieudana`, `odnotujUdana`) są faktycznie wołane — od 3 do 6 miejsc na
trasę. Zmiana z kroku 5 (liczą się pomyłki, sukces zeruje) nie rozluźniła
progu: **5/60 min i 60 globalnie bez zmian**. `comment` słusznie odstaje —
każda udana prośba o zmianę dzwoni powiadomieniem i wysyła maila, więc tam
sukces MUSI się liczyć.

Progu nie ruszano ani na chwilę, także „na potrzeby sondy" — sondę ułożono
tak, żeby go nie zjadała (druga runda pominęła trasy `public/`, a przed
`npm run przejscie` zrestartowano serwer, co czyści licznik razem z dev-bazą).

### 3. Dane osobowe w logach nowych tras — czysto

W 39 nowych plikach tras jest **14 wywołań `console.*`** (na 90 w całym
`app/api` — ta sama proporcja co w reszcie repo). **Żadne nie wypisuje
e-maila, telefonu ani NIP-u w treści komunikatu** — wszystkie mają stały
prefiks i obiekt błędu.

Trwały log jest czyszczony po obu stronach: `zapiszBlad()` przepuszcza
**i `komunikat`, i `szczegoly`** przez `oczyscTekst()` z `lib/observability.ts`
(e-mail → `[e-mail]`, konto → `[konto]`, NIP → `[NIP]`, telefon →
`[telefon]`, w kolejności od najdłuższego wzorca). To jest to ujście, które
czyta ekran *Zdrowie* i dzienny mail.

**Pozostaje, jak było przed tym audytem:** surowy `console.error(prefiks, err)`
idzie do logów wykonawczych Vercela nieoczyszczony, a błąd wysyłki maila
potrafi nieść adres odbiorcy. To wzorzec **repozytorium-szeroki i zastany**
(90 miejsc), nie przyrost — nowe trasy zachowują się dokładnie tak jak stare.
Odnotowane jako obserwacja dla Audytu 2, nie jako znalezisko tego etapu.

---

## Co przy okazji potwierdzono (nie było w zakresie)

Sonda przechodziła przez mechanizmy z faz zaplecza i wszystkie zadziałały
bez zaczepki:

- **Bramka wysyłki** zatrzymała ofertę trzy razy pod rząd, za każdym razem
  z innym powodem i konkretną wskazówką gdzie poprawić (brak nazwy wystawcy →
  brak e-maila odbiorcy).
- **Bariera potwierdzenia (Faza 4)** oddała **428**, a potem — co ważniejsze —
  odrzuciła nagłówek z potwierdzeniem **innego** działania
  (`„Potwierdzenie dotyczy innego działania niż «Wysłać ofertę klientowi?»"`).
  Nie da się jej przejść samym faktem posiadania nagłówka.

---

## Czego ten audyt świadomie nie robił

- **Nie przepisywał Audytu 1.** Jego ustalenia (porównanie odporne na atak
  czasowy, hamulec logowania, tokeny per-urządzenie, TOTP) stoją nietknięte.
- **Nie dopisywał `isAuthed()`** żadnej z 14 tras publicznych.
- **Nie ruszał progów hamulca.**
- **Nie ruszał apki** (`../leggera-hub-ios`, na wierzchu `255dc84`).
- Nie sprawdzał produkcji — dev chodzi na PGlite, produkcja na Neon. Logika
  autoryzacji jest ta sama, dane nie.

## Zmiany w kodzie

**Żadnych zmian w zachowaniu panelu.** Jedyny nowy plik to
`scripts/sonda-401.ts` — narzędzie pomiarowe, nie ruszające produktu.
