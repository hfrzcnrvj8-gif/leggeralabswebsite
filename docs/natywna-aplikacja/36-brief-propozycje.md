# Brief: „Propozycje" w apce iOS

**Powstał:** 2026-08-02, po domknięciu potwierdzeń (`35-brief-potwierdzenia.md`).
**Stan:** do zrobienia w osobnej sesji nad apką (`../leggera-hub-ios`).
**Pilność:** średnia. Nic nie jest zepsute — brakuje widoku funkcji, która
w panelu działa od Fazy 3 planu zaplecza.

---

## Po co to

Faza 3 (`lib/propozycje.ts`) zbudowała regułę **„panel proponuje, właściciel
zatwierdza"**: deterministyczne zapytania SQL wyłapują skutek zdarzenia, którego
nie wypada zrobić automatem, i podają go do zatwierdzenia jednym zdaniem.

Cały mechanizm — reguły, trwałe „nie teraz", cofanie decyzji — **istnieje
i działa**. Widzi go tylko panel. Na telefonie nie ma go wcale, a to tam
najczęściej ląduje pytanie „co dziś zrobić".

Dziś są trzy reguły (`REGULY_PROPOZYCJI`), wszystkie oczywiste dopiero po
przeczytaniu zdania:

| reguła | moduł | zdanie (przykład) | przycisk |
|---|---|---|---|
| `opinia-zamyka-projekt` | `projects` | „Opinia o „X" przyszła — zamknąć projekt jako „Wdrożone"?" | Zamknij projekt |
| `wygrany-lead-bez-przypomnienia` | `leads` | „Y jest wygrany, a ma zaplanowane „demo" na 5 sie — zdjąć przypomnienie?" | Zdejmij przypomnienie |
| `oplacony-klient-aktywny` | `clients` | „Z zapłacił(a) fakturę FV 12/2026 — przestawić klienta na „Aktywny"?" | Przestaw na Aktywny |

**To NIE jest „Skrzynka propozycji AI"** (`docs/plany-modulow/`, odłożona).
Tu nie ma modelu — są reguły SQL. Nie mieszaj tych dwóch rzeczy w nazewnictwie
ani w zakresie.

---

## Najważniejsze: dane JUŻ przychodzą do apki

`GET /api/hub/today` zwraca pole **`propozycje`** (route.ts:347, liczone przez
`zbierzPropozycje()` w try/catch). Apka woła tę trasę przy każdym wejściu na
Pulpit i **wyrzuca to pole do kosza**, bo `PulpitDzis` go nie dekoduje.

Skutek praktyczny: **dla Pulpitu nie trzeba ani jednego nowego żądania.**
Wystarczy dodać pole do modelu.

I tu pułapka, która w tym projekcie chodzi po rękach:

> **`PulpitDzis` ma RĘCZNY `init(from:)`.** Pole dodane tylko jako `public var`
> i do `CodingKeys` skompiluje się i **zawsze będzie puste** — bez błędu, bez
> ostrzeżenia. Nowe pole = **trzy miejsca**: właściwość, `CodingKeys`,
> przypisanie w `init(from:)`. Patrz pamięć: „Swift: opcjonalny var zawsze nil".

Trzymaj się tam wzorca „miękkiego dekodowania" (`lista(_:)` / `decodeIfPresent`
w `try?`), żeby zmiana kształtu po stronie panelu zabrała JEDNĄ sekcję, a nie
cały Pulpit.

---

## Kontrakt trasy (sprawdzony w kodzie, nie z pamięci)

### Odczyt

`GET /api/hub/propozycje` — wszystkie. `?modul=projects|leads|clients` — zawęża.
`?odrzucone=1` dokłada listę odłożonych.

```json
{
  "propozycje": [
    {
      "regula": "oplacony-klient-aktywny",
      "rekordId": "<uuid>",
      "modul": "clients",
      "zdanie": "Nordwind Studio zapłacił(a) fakturę FV 12/2026 — przestawić klienta na „Aktywny”?",
      "akcja": "Przestaw na Aktywny",
      "link": "/pl/admin/clients/<uuid>"
    }
  ],
  "odrzuconych": 2,
  "odrzucone": [ { "regula": "...", "rekordId": "...", "kiedy": "..." } ]
}
```

- `zdanie` i `akcja` **pisze serwer**. Nie buduj ich w Swifcie — to ta sama
  zasada co przy potwierdzeniach 428: reguła żyje w jednym miejscu.
- `link` jest **webowy** (`/pl/admin/...`). Apka ma z niego wziąć wyłącznie
  `modul` + `rekordId` i otworzyć swój natywny ekran. Nie otwieraj tego adresu.
- Klucz propozycji to para **`regula:rekordId`** (`kluczPropozycji`). To jest
  `id` dla `Identifiable` — nie sam `rekordId`, bo jeden rekord może kiedyś
  mieć dwie propozycje.

### Decyzja

`POST /api/hub/propozycje`, ciało `{ regula, rekordId, decyzja }`, gdzie
`decyzja` to `"zrob" | "odrzuc" | "przywroc"`.

- `200 { ok: true, komunikat }` — pokaż `komunikat`, przeładuj listę.
- **`409 { error }` — to NIE jest awaria.** Znaczy „stan zmienił się
  w międzyczasie" (ktoś zamknął projekt ręcznie). Serwer robi zapis warunkowy,
  więc nigdy nie wykona skutku dwa razy. Apka ma **odświeżyć listę**
  i pokazać `error` jako wyjaśnienie, nie jako błąd połączenia.
  W `APIClient` 409 jest już mapowane na `APIError.odmowa(String)` —
  sprawdź, czy to wystarczy, zanim dołożysz nowy przypadek.
- Ta trasa **nie ma bariery 428** — propozycje są odwracalne (`przywroc`),
  więc świadomie nie pytają. Nie dokładaj potwierdzenia.

---

## Zapytaj mnie wprost o cztery rzeczy

### 1. Gdzie to mieszka

Panel wpina tę samą sekcję w **dwa miejsca**: Pulpit (wszystkie) i moduł,
którego dotyczy (Projekty / Leady / Klienci, z `?modul=`). Nowego modułu
świadomie NIE ma — „propozycja to sprawa do zrobienia dziś, więc mieszka tam,
gdzie patrzysz na sprawy do zrobienia".

Do rozstrzygnięcia: apka robi tak samo (4 miejsca, ale 3 z nich to nowe
żądania), czy na start **tylko Pulpit** (0 nowych żądań, patrz wyżej)?
To różnica między jednym wieczorem a półtora.

### 2. Jak wygląda „Nie teraz"

„Nie teraz" jest **trwałe, na zawsze dla tej pary** — decyzja właściciela
z Fazy 3. W panelu jedyną drogą powrotu jest „Odłożone (n) — przywróć", które
przywraca **wszystkie naraz**.

Do rozstrzygnięcia: na telefonie „na zawsze" po jednym machnięciu palcem bywa
groźniejsze niż przy myszy. Chcesz gest w bok (szybko, ryzykownie), dwa
przyciski pod zdaniem jak w panelu (wolniej, czytelniej), czy machnięcie
z krótkim „Cofnij" na dole ekranu?

### 3. Kolor — tu jest realna kolizja

Panel maluje przycisk akcji **cyjanem marki** i tłumaczy to wprost: reszta
„Wymaga działania dziś" jest złota, bo mówi o zaległości, a propozycja **nie
jest zaległa**.

Ale słownik koloru apki (README) ma **cyjan przypisany do „Trwa, w toku"**
(`Znaczenie.wToku`, status projektu „W trakcie"). Wzięcie cyjanu na propozycje
da dwa znaczenia jednego koloru — a rozjazd słownika łapaliśmy w tym projekcie
już trzy razy.

Do rozstrzygnięcia: przenosimy rozumowanie panelu (cyjan, przyjmując, że
kontekst wystarcza), czy propozycje w apce są **neutralne** (napis akcji
`.primary`, bez akcentu), zgodnie z regułą „jeden akcent na ekran"?
**Cokolwiek wybierzesz, dopisz to do słownika w README apki** — cicha zmiana
roli koloru jest tu gorsza niż zła rola.

### 4. iPad

Kolumna iPada ma własne widoki (`*PanelIpad`). Sekcja Propozycji na iPadzie:
w tym samym miejscu co na iPhonie, czy przy okazji w panelu bocznym?
**Uwaga:** widok z sufiksem `PanelIpad` wpięty we wspólną mapę modułów daje na
iPhonie pusty ekran z żółtym trójkątem, bez crasha (pamięć:
„widok-ipada-we-wspolnej-mapie").

---

## Rzeczy, które mają wpływ na kształt pracy

- **Pusta sekcja ZNIKA — i to jest celowe.** Panel nie renderuje nic, gdy nie
  ma propozycji ani odłożonych: „Pulpit jest ekranem «co dziś zrobić», nie
  tablicą kontrolną; pusta sekcja «Propozycje: brak» uczy wyłącznie
  przewijania". **To jedyny świadomy wyjątek od ustalenia A1** („ekran nie
  kłamie pustym stanem") — nie „napraw" go pustym stanem z wyjaśnieniem.
  Gdy propozycji nie ma, ale coś jest odłożone, panel pokazuje samą linijkę
  „Nic nowego — n propozycje są odłożone".
- **Nie licz propozycji do „Wymaga działania dziś"** bez pytania. Panel liczy
  je osobno; propozycja nie jest zaległością.
- **Haptyka** idzie przez `AppStore.odczuj?(...)` przy **gardłach**, nie przy
  przyciskach (README apki, Faza 15). Decyzja o propozycji to zmiana danych
  wywołana palcem, więc `.sukces` / `.odmowa` — ale wstaw je w JEDNYM miejscu
  w sklepie, nie w widoku.
- **Ruch** wyłącznie z `Ruch.swift` (`Ruch.sprezyna` / `Ruch.plynny`). Panel
  animuje znikanie wiersza `layout` + `AnimatePresence`; w SwiftUI odpowiednik
  to `.animation(Ruch.sprezyna, value:)` na liście. **`transition` bez
  `animation` nie działa.**
- **Nowy plik `.swift` wymaga `xcodegen generate`** — inaczej kompiluje się
  „zielono" bez Twojego kodu.
- **`Skrypty/stempel-wersji.sh` przed każdym buildem** — bez tego budowa pada
  z „Stempel wskazuje rewizję …".

---

## Jak sprawdzić, że działa

Lokalnie, przeciw `npm run dev` (`SIMCTL_CHILD_LEGGERA_DEV_BACKEND=lokalny`) —
dev-seed PGlite ma dane, na których da się wyprodukować wszystkie trzy reguły:

1. **`opinia-zamyka-projekt`** — wpisz opinię przy projekcie o statusie innym
   niż „Wdrożone" (albo `UPDATE projects SET review_submitted_at = now()`).
2. **`wygrany-lead-bez-przypomnienia`** — lead na „Zamknięte - sukces"
   z ustawionym `next_followup`.
3. **`oplacony-klient-aktywny`** — klient „Prospekt" z fakturą „Opłacona".

Dowodem **nie** jest to, że sekcja się rysuje. Dowodem są trzy pomiary:

- **„Zrób to" zmienia stan w bazie** — sprawdź `curl`em rekord przed i po,
  nie samym zniknięciem wiersza z listy.
- **„Nie teraz" przeżywa restart apki** — bo jest w bazie, nie w pamięci; po
  ponownym wejściu propozycja ma NIE wrócić.
- **409 nie kłamie** — zamknij projekt w panelu, a potem kliknij „Zamknij
  projekt" na telefonie. Ma się pokazać zdanie o nieaktualności i odświeżona
  lista, a nie „brak połączenia z panelem".

Na koniec: **jeden przebieg na produkcji** nie jest tu potrzebny tak jak przy
potwierdzeniach (nic nieodwracalnego), ale wejście na Pulpit z telefonu po
wgraniu buildu potwierdzi, że pole `propozycje` faktycznie przychodzi
z prawdziwej bazy.

---

## Czego NIE robić

- **Nie przenoś reguł do Swifta.** Zdanie i napis na przycisku pisze serwer.
- **Nie dokładaj czwartej reguły** przy okazji — słownik reguł to decyzja
  produktowa z Fazy 3, a granica „automat vs propozycja" jest zapisana
  w `CLAUDE.md` i w nagłówku `lib/propozycje.ts`.
- **Nie zamieniaj istniejących automatów na propozycje.**
- **Nie ruszaj panelu.** Jeśli okaże się, że trzeba — powiedz wprost, zanim
  cokolwiek zmienisz.
