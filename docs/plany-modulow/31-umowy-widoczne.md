# Moduł 31 — Umowy: pułapka bramki i moduł, o którym panel nigdy nie wspomina

> Przeczytaj `docs/plany-modulow/README.md` (zasady wspólne), `CLAUDE.md`,
> `00-mapa-drogi-klienta.md` (Krok 3) oraz `11-umowy-i-nda.md` (moduł źródłowy).
> Brief powstał **z audytu Modułu 29** (2026-07-17).
>
> **Kolejność: to TRZECI i OSTATNI z trzech briefów audytu 29 (32 → 30 → 31).**
> Moduł 32 zamknięty 2026-07-17, Moduł 30 zamknięty 2026-07-17.

## PRZECZYTAJ NAJPIERW — weryfikacja briefu w kodzie (2026-07-17, po Module 30)

Brief sprawdzony gretem przed startem czatu. **Wszystkie znaleziska A/B/C
potwierdziły się co do linii** — nie trać czasu na ponowne sprawdzanie:

| Teza briefu | Stan |
|---|---|
| bramka `projects/[id]/route.ts:144` (`WHERE project_id = … AND status = 'Podpisana'`), twarda, 409 | ✅ potwierdzona; odpala **tylko** przy wejściu w „W trakcie" |
| `ContractEditor.tsx:151` — `kinds={["client", "lead"]}`, bez projektu | ✅ potwierdzone |
| `contracts/[id]/route.ts:46` przyjmuje `project_id` | ✅ potwierdzone — serwer potrafi, UI nie daje |
| `hub/today` i `leads/notify` nie pytają bazy o umowy | ✅ potwierdzone (zero wystąpień „contracts") |
| `clients/[id]/route.ts:37-45` pobiera oferty/faktury/projekty, **nie umowy** | ✅ potwierdzone |
| `search/route.ts:33-37` — leady/klienci/projekty/notatki/wydarzenia, bez umów/ofert/faktur | ✅ potwierdzone |
| `lib/notifications.ts` — brak `offer_accepted`/`contract_signed`/`review_collected` | ✅ potwierdzone |

### ❗ Sprostowanie A — „naprawa jednej linii" z Części A jest PUŁAPKĄ

Brief rekomenduje: *„dodać `"project"` do `kinds` `LinkPicker`-a w
`ContractEditor.tsx` … to może być zmiana jednej linii"*. **Nie rób tego.**

`linkValueFor()` (`lib/links.ts`) jest **WYŁĄCZNE w obrębie `kinds`** — czyści
wszystkie kolumny z listy, po czym ustawia jedną:

```ts
for (const kind of kinds) value[COLUMN[kind]] = null;
if (picked && kinds.includes(picked.kind)) value[COLUMN[picked.kind]] = picked.id;
```

Czyli `kinds={["client","lead","project"]}` znaczy: **wybranie projektu wyzeruje
`client_id` umowy**. A `client_id` na umowie jest właśnie tym, czego potrzebuje
Część B (umowy na karcie klienta filtrowanej po `client_id`). Jedna linia
naprawiłaby Część A i **jednocześnie rozwaliła Część B** — cicho, bez błędu.

To dokładnie ta sama pułapka, na którą natknął się Moduł 30: tam edytory Faktur/
Ofert dostały `kinds={["client"]}`, żeby wybór klienta nie skasował `lead_id`, na
którym stoi `lib/offerAccept.ts`. Komentarz w `lib/links.ts:76-80` mówi o tym
wprost: to reguła dla RĘCZNEGO wyboru „czyj to rekord", a nie dla pól, które są
śladem pochodzenia.

**Projekt na umowie to inna oś niż klient/lead** („czyj to rekord" vs „czego
dotyczy"), więc potrzebuje **osobnego pola/pickera** (`kinds={["project"]}`,
własne `value={{ project_id }}`), nie dopisania do istniejącego. To nadal mała
zmiana — ale nie jednolinijkowa.

### Kontekst po Module 30 (przydatne, nie blokujące)

- `LinkPicker` ma od Modułu 30 opcjonalną stopkę (`footer`) — przydatna, jeśli
  przy pustej liście projektów trzeba dać wyjście.
- `components.tsx` ma `LinkHint` (miękka podpowiedź) i `ClientLinkPicker` —
  gotowe wzorce, jeśli Część A pójdzie w stronę podpowiedzi zamiast bramki.
- Karta klienta ciągnie dziś oferty/faktury/projekty w jednym `Promise.all`
  (`clients/[id]/route.ts:37`) — dołożenie umów to dopisanie zapytania tam.
- `CLIENT_EVENT_KINDS` (`lib/clients.ts`) **już zna** `contract_created`,
  `contract_sent`, `contract_signed` i `review_collected` — oś czasu klienta
  umowy widzi. Niewidoczne są w Pulpicie/mailu/wyszukiwarce/dzwonku, nie
  wszędzie. To zawęża Część B.

## Skąd to się wzięło

Audyt Modułu 29 uznał Krok 3 (Umowa) za **najpoważniejszą dziurę w całej drodze
klienta** — i to nie dlatego, że moduł jest źle zrobiony. Moduł 11 jest zrobiony
dobrze: umowa generuje się z zaakceptowanej oferty, kopiuje zakres i cenę,
e-podpis działa tym samym mechanizmem co oferta, jest bramka „nie ruszysz
projektu bez podpisanej umowy".

Problem jest w **szwach**: Umowy istnieją tylko dla samych siebie.

> **Umowa jest jedynym miejscem z twardą bramką w całym panelu — i jednocześnie
> jedynym modułem, o którym panel nigdy sam z siebie nie wspomni.**

## Część A — Pułapka bez wyjścia (to jest błąd, nie decyzja)

**Objaw:** projekt założony ręcznie („+ Dodaj projekt", albo powstały z notatki)
**nigdy nie da się przestawić na „W trakcie"**. Panel odpowiada *„Brak podpisanej
umowy — podpisz umowę przed rozpoczęciem realizacji"* — a jedynej rzeczy, która to
odblokuje, **nie da się zrobić klikając**.

**Dlaczego (potwierdzone w kodzie):**
- `app/api/projects/[id]/route.ts:144` — bramka szuka umowy przypiętej **do tego
  projektu**: `SELECT 1 FROM contracts WHERE project_id = ${id} AND typ = 'umowa'
  AND status = 'Podpisana'`
- Umowa dostaje `project_id` **tylko wtedy, gdy powstała z oferty**
- `ContractEditor.tsx:150` — `LinkPicker` w edytorze umowy ma
  `kinds={["client", "lead"]}` — **bez projektu**
- Serwer to potrafi (`contracts/[id]/route.ts:46` przyjmuje `project_id`) — **UI
  po prostu nie daje takiej opcji**

Jedyne wyjście dzisiaj: cofnąć się i przejść całą ścieżkę oferta→akceptacja od
nowa.

**To narusza zasadę panelu** („tylko miękkie podpowiedzi, nigdy twarde bramki" —
`README.md`). Bramka umowy była świadomym, zatwierdzonym wyjątkiem (mapa: *„to
jest formalny start projektu, nie wcześniej"*), ale wyjątek miał **pilnować
kolejności, a nie zamykać drogę bez wyjścia**.

**Prawdopodobna naprawa** (do potwierdzenia): dodać `"project"` do `kinds`
`LinkPicker`-a w `ContractEditor.tsx`. Serwer już to obsługuje — czyli to może
być zmiana jednej linii. **Ale najpierw pytanie 1 niżej.**

## Część B — Umowy są niewidzialne poza własnym ekranem

Umowa wisząca tydzień niepodpisana **nigdy się nie przypomni**. Potwierdzone:

| Gdzie | Pokazuje | Umowy? |
|---|---|---|
| Pulpit (`app/api/hub/today/route.ts`) | leady, klienci, projekty, kamienie, zaległe faktury, szkice, wygasłe oferty, poczta, kontakty retencyjne | **nie pyta bazy o umowy w ogóle** |
| Dzienny mail (`app/api/leads/notify/route.ts`) | to samo | **nie** |
| Karta klienta → „Powiązane" (`ClientDetailPanel.tsx:375`) | oferty, faktury, projekty | **nie** (API klienta ich nie pobiera — `clients/[id]/route.ts:43-45`) |
| Wyszukiwarka Cmd+K (`app/api/search/route.ts:33-37`) | leady, klienci, projekty, notatki, wydarzenia | **nie** (podobnie brak ofert i faktur) |
| Statystyki | — | brak wskaźnika **„% projektów z podpisaną umową"**, mimo że mapa wymienia go jako miarę tego etapu (cel: 100%) |

## Część C — Cisza po najważniejszym zdarzeniu w lejku

`lib/notifications.ts:17` zna rodzaje: nowy lead, poczta, faktura
opłacona/przypomnienie/wezwanie, cykliczne. **Nie ma rodzaju:**
- „oferta zaakceptowana"
- „umowa podpisana"
- „wpłynęła opinia"

Klient akceptuje ofertę e-podpisem w nocy → **dzwonek milczy**. Najważniejsze
zdarzenie w całym lejku sprzedaży nie generuje żadnego sygnału — dowiesz się,
wchodząc na Oferty.

**Uwaga na świadomą decyzję Modułu 24:** dzwonek to **kronika zdarzeń**, świadomie
NIE druga lista „do zrobienia" (Pulpit liczy stan na żywo). Te trzy zdarzenia
pasują do definicji kroniki („czego przegapiłem") — ale to musi potwierdzić
właściciel, bo Moduł 24 świadomie odrzucił kilka kandydatów.

## Do rozstrzygnięcia z właścicielem

1. **Czy bramka umowy ma w ogóle obejmować projekty zakładane ręcznie?** Trzy
   opcje: (a) tak, ale dać w UI możliwość przypięcia umowy do projektu (naprawa
   pułapki, jedna linia); (b) bramka tylko dla projektów z oferty, ręczne
   projekty wolne; (c) zamienić twardą bramkę na miękką podpowiedź, zgodnie z
   ogólną zasadą panelu. **Rekomendacja: (a)** — najmniejsza zmiana, zachowuje
   zatwierdzony sens bramki.
2. **Czy Umowy mają wejść na Pulpit i do dziennego maila?** („umowa wysłana X dni
   temu, wciąż niepodpisana"). Jeśli tak — po ilu dniach ciszy?
3. **Czy dołożyć wskaźnik „% projektów z podpisaną umową"** do Statystyk (mapa go
   wymienia, cel 100%)?
4. **Czy trzy nowe rodzaje powiadomień** (oferta zaakceptowana / umowa podpisana /
   wpłynęła opinia) pasują do kroniki zdarzeń z Modułu 24, czy to już „druga lista
   do zrobienia", której Moduł 24 świadomie unikał?
5. **Czy dołożyć Umowy (i Oferty, i Faktury) do wyszukiwarki Cmd+K?**

## Zakres (po odpowiedziach)

- `"project"` w `kinds` `LinkPicker`-a w `ContractEditor.tsx` (naprawa pułapki)
- Umowy w `app/api/clients/[id]/route.ts` → sekcja „Powiązane" na karcie klienta
- Opcjonalnie: zapytanie o umowy w `hub/today` + dzienny mail
- Opcjonalnie: nowe rodzaje w `lib/notifications.ts` + hooki w miejscu zdarzenia
  (wzorem Modułu 24 — nie tylko w cronie)
- Opcjonalnie: wskaźnik w Statystykach
- Opcjonalnie: umowy/oferty/faktury w `app/api/search/route.ts`

## Weryfikacja

`npx tsc --noEmit -p tsconfig.json` + podgląd (`preview_start name:"dev"`).
Ścieżka na żywo: „+ Dodaj projekt" → spróbuj przestawić na „W trakcie" →
powinno dać się przypiąć umowę bez przechodzenia przez ofertę.
