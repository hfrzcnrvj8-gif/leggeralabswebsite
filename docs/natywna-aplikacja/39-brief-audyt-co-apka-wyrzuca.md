# Brief: audyt „serwer oddaje, apka wyrzuca do kosza"

**Powstał:** 2026-08-05, po paczce „apka dogania panel"
(`38-wynik-apka-dogania-panel.md`).
**Dotyczy repozytorium apki** (`../leggera-hub-ios`), commit bazowy `8870614`.
**Panelu NIE ruszamy** — jeśli okaże się, że trzeba, powiedz właścicielowi
wprost, zanim cokolwiek zmienisz.

---

## Po co ten audyt

Przy paczce z 2026-08-05 sprawdzałem dwie trasy — nie po to, żeby ich szukać,
tylko dlatego, że akurat je dotykałem. Znalazły się **cztery** pola, które
serwer oddaje, a apka wyrzuca:

| trasa | pole | co przez to nie działało |
|---|---|---|
| `GET /api/hub/today` | `propozycje` | całego mechanizmu nie było na telefonie |
| `GET /api/hub/today` | `projektyZagrozone` | zerwany projekt niewidoczny do czasu, aż się spóźni |
| `GET /api/hub/today` | `zapomnianeSzkiceUmow` | szkic umowy, o którym się zapomniało, nigdzie |
| `GET /api/offers/:id` | `sections`, `contract` | **bloki treści oferty nie pokazywały się NIGDY** |

I jedno, którego nie zdążyłem naprawić — **`expiredOffers` z `/api/hub/today`**:
oferty PO TERMINIE WAŻNOŚCI. Panel liczy je do „wymaga działania dziś"
(`totalActionable` w `DashboardHome.tsx`), apka nie ma dla nich sekcji. To jest
znalezisko potwierdzone, nie hipoteza — zacznij od niego.

**Dlaczego to jest osobna kategoria błędu.** Nie ma po nim ŻADNEGO objawu:
`tsc` przechodzi, build przechodzi, ekran się rysuje, `ContentUnavailableView`
nie wyskakuje (bo tablica jest pusta, a nie `nil` — czyli wg ustalenia A1
znaczy „naprawdę pusto"). Jedyny sposób, żeby go zobaczyć, to **porównać dwie
listy pól**. Dlatego to robota mechaniczna, a nie „przejrzenie kodu".

---

## Zakres, zmierzony

- **116** różnych adresów `/api/...` wołanych przez `APIClient.swift`
- **48** wywołań `GET` — czyli tyle odpowiedzi jest do porównania
- **41** struktur `*Response`/`Odpowiedz` dekodujących odpowiedzi
- **188** tras w panelu (większość apki nie dotyczy)

Audyt dotyczy **wyłącznie GET-ów** — tam, gdzie serwer coś OPOWIADA. Przy
`POST`/`PATCH` ryzyko jest odwrotne (apka wysyła pole, którego trasa nie zna)
i to osobna, mniejsza sprawa; jeśli zostanie czas, patrz „Rozszerzenie" niżej.

---

## Metoda (trzy kroki na trasę)

1. **Co trasa NAPRAWDĘ oddaje.** Czytaj `return NextResponse.json({ … })`
   w `app/api/.../route.ts`. Uwaga na rozwinięcia: `{ ...invoice, poprzednie_wiadomosci }`
   — pola z rozwinięcia też się liczą, a nie widać ich w liście kluczy.
2. **Co apka dekoduje.** Struktura `*Response` w `APIClient.swift` PLUS
   `CodingKeys` modelu, do którego to idzie. **Sprawdzaj OBA** — pole może być
   w modelu i nie być w strukturze odpowiedzi (to był przypadek `sections`:
   `OfertaSzczegoly` miało pole, widok je rysował, a `OfertaDetailResponse`
   go nie czytało).
3. **Różnicę oceń, nie zgłoś.** Nie każde pominięte pole to luka — apka
   świadomie nie dekoduje `settings`, `korekty`, `zaliczka` (poziom 3,
   „to się robi przy biurku"). Pytanie brzmi: **czy w apce istnieje ekran,
   na którym to pole miałoby co robić.** Jeśli tak — luka. Jeśli nie — wpis
   do wyniku z jednym zdaniem uzasadnienia, żeby następny audyt nie liczył
   tego drugi raz.

> **Nie da się tego zrobić `diff`em.** Nazwy po obu stronach są różne
> (`silenceDays` → `dniCiszy`), a mapowanie siedzi w `CodingKeys`. Skrypt może
> najwyżej podać kandydatów; decyzja jest za każdym razem ręczna.

### Pułapka, która przy tym czeka

**`draftAgeDays` kontra `silenceDays`.** Dwa różne pola o tym samym znaczeniu
„ile dni" na dwóch listach z tej samej trasy. Wzięcie jednego zamiast drugiego
dekoduje się bez błędu i pokazuje wszędzie „0 dni". Za każdym razem, gdy
dokładasz pole liczbowe, sprawdź w kodzie panelu, **która funkcja je liczy** —
nie zakładaj po nazwie sąsiada.

---

## Kolejność (od najgęstszego)

1. **`GET /api/hub/today`** — największy agregat w całej apce i już wiadomo,
   że ma dziurę (`expiredOffers`). Zrób go pierwszy i **domknij tę sekcję**:
   oferta po terminie ważności to pilniejszy stan niż „wysłana, cisza",
   którą Pulpit już pokazuje.
2. **Profile rekordów** — `/api/leads/:id`, `/api/clients/:id`,
   `/api/projects/:id`, `/api/invoices/:id`, `/api/offers/:id`,
   `/api/contracts/:id`. Tu wyszły dwie z czterech dzisiejszych luk.
3. **Listy** — `/api/leads`, `/api/clients`, `/api/projects`, `/api/invoices`,
   `/api/offers`, `/api/contracts`, `/api/costs`, `/api/catalog`.
4. **Reszta** — poczta, kalendarz, przypomnienia, rejestr, statystyki,
   kandydaci, instrukcje.

Jeśli sesja ma się skończyć w połowie, niech skończy się po punkcie 2.

---

## Czego przy tym NIE robić

- **Nie dokładaj pól „na zapas".** Pole bez ekranu, który je pokazuje, to
  martwy kod — dokładnie ten dług, który ten projekt łapał już przy
  „powiązaniu z klientem" (pole istniało, nikt go nie wołał).
- **Nie ruszaj panelu.** Jeśli trasa czegoś NIE oddaje, a powinna — to
  osobna decyzja i osobna sesja.
- **Nie przepisuj reguł do Swifta.** Gdy pole jest wyliczone przez serwer
  (`silenceDays`, `powod`, `opis`), apka je POKAZUJE, nie liczy drugi raz.
- **Nie „naprawiaj" świadomych pominięć** z poziomu 3 (KSeF, korekty,
  edycja pozycji). Sprawdź w README apki, zanim uznasz coś za lukę.

---

## Sprawdzenie

Dla każdej naprawionej luki dowodem jest **zrzut z symulatora plus stan
w danych**, jak w poprzedniej paczce — nie „pole jest zadeklarowane".

Dwie rzeczy, które kosztowały czas ostatnio i warto je znać od razu:

- **`LEGGERA_DEV_HASLO` bywa przegrane w wyścigu** z odzyskiwaniem sesji.
  Pewniej: wybij token `curl`em na `/api/admin/login` i podaj przez
  `LEGGERA_DEV_TOKEN`.
- **Logowanie tą samą nazwą urządzenia unieważnia poprzedni token** —
  działająca apka wylatuje wtedy do ekranu logowania w środku sprawdzania.
  Kolejnym przebiegom dawaj różne nazwy (`Sym-1`, `Sym-2`…).

Dane do sprawdzania: `npm run dev` + `npm run przejscie` w repo panelu.
**Dev-baza PGlite żyje w pamięci procesu** — restart serwera kasuje wszystko,
a rekordu „starszego niż dziś" nie da się w niej zrobić (to dlatego sekcja
„Zapomniane szkice umów" została bez dowodu z danych).

---

## Rozszerzenie, jeśli zostanie czas

**Druga strona tej samej monety:** apka wysyła w `POST`/`PATCH` pole, którego
trasa nie czyta. Objaw jest identyczny — cisza. Sprawdzenie: dla każdego
`struct Body: Encodable` w `APIClient.swift` znajdź, czy trasa faktycznie sięga
po każdy jego klucz. To węższa robota (tras zapisujących jest mniej), ale skutek
poważniejszy: **zapis, który wygląda na udany i nic nie zmienia.**

## Na koniec

Wynik do `docs/natywna-aplikacja/40-wynik-…` w repo panelu, wpis w README apki
(jeśli wyjdzie z tego reguła, a nie tylko lista poprawek), aktualizacja
`HANDOFF.md`. Commit i push **osobno dla obu repozytoriów**.
