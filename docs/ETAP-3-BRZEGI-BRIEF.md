# Brief etapu 3: sytuacje krytyczne, których jeszcze nie przechodziliśmy

**Powstał:** 2026-08-06, po zamknięciu etapu 2.
**Zakres:** panel. Apki nie ruszamy (na wierzchu `255dc84`).
**Czas:** jedna sesja.
**Etap 3 z pięciu** `docs/PLAN-DOMKNIECIA.md`.

---

## Po co to

Trzy przejścia „na sucho" i siedem audytów sprawdzały drogi, którymi system
CHODZI: udaną, nieudaną, przez drugi rok obrotowy, przez podwójne kliknięcie.
Zostały cztery sytuacje, w których coś **przerywa** pracę w połowie. Żadna nie
była nigdy przebiegnięta.

Kolejność w tym briefie jest wg tego, ile da się zmierzyć **z tego
środowiska** — nie wg wagi.

---

## NAJPIERW PRZECZYTAJ: rekonesans zrobiony 2026-08-06

**Uwaga metodologiczna, ważniejsza od samych ustaleń.** Brief etapu 2 zawierał
rekonesans, który pomylił się **w obie strony**: wymienił 21 uchwytów bez
ochrony (żaden nie był dziurą) i przy okazji sam popełnił błąd „plik ≠ uchwyt",
przed którym ostrzegał (pisał „8 tras", było 10 uchwytów). **Wszystko poniżej
jest CZYTANE Z KODU, nie zmierzone.** Traktuj jako listę hipotez do obalenia,
nie jako wynik. Rozstrzyga przebieg.

### Ustalenie A — kontroli współbieżności NIE MA ŻADNEJ

Sprawdzone gretem po całym `app` i `lib`:

- **zero** `If-Match` / `ETag` / nagłówka wersji,
- **zero** `UPDATE … WHERE … AND updated_at = <oczekiwane>`.

Każdy zapis jest bezwarunkowy. **Ostatni wygrywa, po cichu.** Podejrzenie
z planu domknięcia jest więc potwierdzone co do mechanizmu — pozostaje pytanie
o SKUTEK, a ten zależy od punktu B.

### Ustalenie B — to, co ratuje sytuację, to granularność PATCH-a

Trasy dokumentowe robią zapis **pole po polu**:

```ts
if ("tytul" in body)  await sql`UPDATE offers SET tytul = … WHERE id = ${id};`;
if ("klient_nip" in body) await sql`UPDATE offers SET klient_nip = … WHERE id = ${id};`;
```

Czyli trasa dotyka **wyłącznie pól faktycznie przysłanych**. Edytor oferty też
jest granularny — `patchOffer(patch: Partial<Offer>)` wysyła sam zmieniony
fragment.

**Wniosek do sprawdzenia, nie do przyjęcia:** dwie karty edytujące RÓŻNE pola
tego samego rekordu prawdopodobnie się nie zadepczą; groźny jest dopiero
**ten sam kawałek treści w dwóch kartach**. To zawęża scenariusz 1, ale go nie
kasuje — i **nie wiadomo, czy wszystkie edytory są granularne**. Sprawdź co
najmniej: Ofertę, Umowę, Fakturę (pozycje!), Klienta, Projekt, Notatkę.
Edytor, który przy zapisie wysyła cały obiekt formularza, przywróci stan
sprzed minuty we WSZYSTKICH polach naraz.

**Drugi, osobny objaw:** edytor po zapisie robi optymistyczną podmianę
(`setOffer(prev => ({ ...prev, ...patch }))`) i **nie doczytuje rekordu**.
Nawet gdy baza jest spójna, druga karta pokazuje nieaktualny ekran i nic
o tym nie mówi.

### Ustalenie C — 401 w trakcie pracy PRZEŁADOWUJE stronę

`app/[lang]/admin/dane.ts` (gardło odczytu):

```ts
if (res.status === 401) {
  if (typeof window !== "undefined") window.location.reload();
  throw new SesjaWygasla();
}
```

Przeładowanie **kasuje niezapisany formularz bez ostrzeżenia**. Ale to jest
gardło **ODCZYTU**, a policzone:

| co | ile |
|---|---|
| pliki panelu wołające `pobierzJSON` | 16 |
| pliki panelu z surowym `await fetch(` | 57 |
| wywołania `POST`/`PATCH` w UI panelu | **190** |
| …z tego przez `pobierzJSON` | **0** |

**Żaden ZAPIS nie idzie przez wspólne gardło.** Każdy obsługuje 401 po
swojemu albo wcale. To jest dokładnie ta rodzina, którą apka zamknęła w Fazie
A1 („ile ekranów kłamie"), a panel został — patrz
`docs/natywna-aplikacja/22-wynik-a1-komunikaty.md`.

**Pytanie do zmierzenia:** właściciel wypełnia formularz przez dziesięć minut,
sesja wygasa, klika „Zapisz". Co widzi? Hipotezy: (a) cisza i wygląd sukcesu,
(b) przeładowanie i utrata treści, (c) uczciwy komunikat. **Nie zgaduj —
przebiegnij.** Sesję da się unieważnić bez czekania: zmień `ADMIN_PASSWORD`
w `.env.local` i zrestartuj `npm run dev` (token sesji to
`sha256(hasło:sekret)`, więc zmiana hasła unieważnia ciastko), albo skasuj
ciastko w narzędziach przeglądarki.

---

## Cztery scenariusze

### 1. Dwie karty edytujące TEN SAM rekord — **główny cel etapu**

Nie „to samo działanie" (podwójne kliknięcie jest zamknięte w trzecim
przejściu), tylko **dwie różne TREŚCI**. Otwierasz ofertę na laptopie
i na iPadzie, zmieniasz cenę w jednym i opis w drugim, zapisujesz oba.

Do przebiegnięcia, w tej kolejności:
1. dwa PATCH-e w RÓŻNE pola → czy oba przeżyły (spodziewane: tak, patrz B);
2. dwa PATCH-e w TO SAMO pole → który wygrał i czy ktokolwiek się dowiedział;
3. **pozycje faktury/oferty** — tam zapis bywa „skasuj i wstaw od nowa",
   więc dwie karty mogą dać duplikaty albo utratę całej listy. To jest
   najbardziej podejrzane miejsce w całym scenariuszu;
4. czy któryś edytor wysyła cały obiekt zamiast różnicy (patrz B).

**Zanim zaproponujesz naprawę — zapytaj właściciela.** Blokada rekordu,
ostrzeżenie „ktoś inny zmienił to w międzyczasie" i „ostatni wygrywa, ale
powiedz o tym" to trzy różne produkty. Przy jednoosobowym panelu najtańsza
uczciwa odpowiedź może być czwarta: **wykrywać i mówić, nie blokować** —
w duchu reguły „co odwracalne, nie pyta". To decyzja nietechniczna.

### 2. Wygaśnięcie sesji w połowie pracy

Patrz ustalenie C. Mierzalne w całości z tego środowiska, i prawdopodobnie
najtańsze do naprawienia (jedno gardło zapisu, wzorem `pobierzJSON`).

### 3. Zerwane żądanie w połowie wysyłki maila

Bezpiecznik odcisku **istnieje i został przeczytany** (trzecie przejście),
ale nigdy nie przebiegł — dev nie ma skrzynki. Wymaga atrapy SMTP.
Jeśli postawienie atrapy zje pół sesji, **zapisz to jawnie jako
niesprawdzone i dlaczego** — to jest dopuszczalny wynik, zgodnie
z kryterium etapu w planie.

### 4. Odtworzenie bazy z kopii zapasowej

Audyt 3 sprawdzał skrypt, ale kopie na NAS **nie są uruchomione** (mówi to
Pulpit). Bez działających kopii nie ma czego odtwarzać. To najpewniej
**zapis „nie da się tu sprawdzić i dlaczego"**, nie przebieg — i tak jest
w porządku.

---

## Czego NIE robić

- **Nie dokładaj blokad rekordów ani potwierdzeń** bez pytania właściciela —
  reguła Fazy 4 („co odwracalne, nie pyta") działa w obie strony.
- **Nie przerabiaj wszystkich 190 zapisów na wspólne gardło z rozpędu.**
  Najpierw zmierz, co się dzieje dziś; potem umów zakres.
- **Nie ruszaj apki.**
- Nie zaczynaj od greta jako werdyktu — patrz nagłówek rekonesansu.

---

## Sprawdzenie i zamknięcie

`npx tsc --noEmit -p tsconfig.json`, `npm test` (**352**),
`npm run przejscie` (**116 działa · 0 regresji**). Nowe zdania w przejściu dla
każdego scenariusza, który dało się przebiec.

**Sonda 401 (`scripts/sonda-401.ts`) nie jest tu potrzebna**, ale jeśli po
drodze dołożysz trasę — uruchom ją, wyłączając wcześniej `DEV_ADMIN_BYPASS`
i przywracając go po (narzędzie samo odmówi, jeśli tego nie zrobisz).

Wynik do **`docs/ETAP-3-WYNIK.md`**, aktualizacja `HANDOFF.md`, odhaczenie
etapu 3 w `docs/PLAN-DOMKNIECIA.md`. Commit i push tylko dla panelu.
