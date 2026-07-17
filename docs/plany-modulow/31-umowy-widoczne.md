# Moduł 31 — Umowy: pułapka bramki i moduł, o którym panel nigdy nie wspomina

> Przeczytaj `docs/plany-modulow/README.md` (zasady wspólne), `CLAUDE.md`,
> `00-mapa-drogi-klienta.md` (Krok 3) oraz `11-umowy-i-nda.md` (moduł źródłowy).
> Brief powstał **z audytu Modułu 29** (2026-07-17).

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
