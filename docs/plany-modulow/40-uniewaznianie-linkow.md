# Moduł 40 — unieważnianie publicznych linków

> Powstał z **Audytu 1** (`docs/AUDYT-1-WYNIKI.md`, ustalenia 5, 6 i 8),
> decyzja właściciela z 2026-07-22. Jeden czat, wąski zakres.
>
> Moduł ma **dwie części**, które opłaca się zrobić razem, bo dotykają tych
> samych pięciu tras: (A) unieważnianie linków, (B) białe listy pól.
> Robione osobno oznaczałyby dwa razy tę samą robotę w tych samych plikach.

---

## Część A — unieważnianie linków

### Problem, sprawdzony w kodzie

Pięć rodzajów tokenów w publicznych linkach jest **wieczne i nieodwoływalne**.
Sprawdzone w schemacie (`lib/db.ts`: `share_token`, `wezwanie_share_token`,
`review_token` — same `TEXT`, bez `expires_at`, bez `revoked_at`) i w trasach,
z których żadna nie sprawdza wieku ani stanu tokenu.

Skutek: mail przesłany dalej przez klienta = **trwały dostęp do dokumentu**,
którego nie da się cofnąć.

### Decyzja właściciela (nie zmieniać bez pytania)

**Tokeny zostają wieczne.** Automatyczne wygasanie odrzucone świadomie:
faktura sprzed dwóch lat ma się dalej otwierać, a link umierający sam
generowałby telefony „nie działa mi Pana link".

Dochodzi **ręczne** unieważnienie: przycisk w panelu, świadomy ruch
właściciela wtedy, gdy wie, że link poszedł nie tam.

### Mapa tego, co trzeba objąć

| Token (kolumna) | Trasy | Strona publiczna | Renderuje |
|---|---|---|---|
| `offers.share_token` | `GET /api/offers/public/[token]`, **`POST …/accept`** | `/[lang]/oferta/[token]` | `OfferPrint` |
| `contracts.share_token` | `GET /api/contracts/public/[token]`, **`POST …/accept`** | `/[lang]/umowa/[token]`, `/[lang]/nda/[token]` | `ContractPrint` |
| `invoices.share_token` | `GET /api/invoices/public/[token]` | `/[lang]/faktura/[token]` | `InvoicePrint` |
| `invoices.wezwanie_share_token` | `GET /api/invoices/wezwanie/public/[token]` | `/[lang]/wezwanie/[token]` | `DunningPrint` |
| `projects.review_token` | `GET /api/projects/review/public/[token]`, **`POST …/submit`** | `/[lang]/opinia/[token]` | `ProjectReviewForm` |

**Pogrubione trasy ZAPISUJĄ.** Unieważnienie, które blokuje tylko odczyt,
byłoby połowiczne w najgorszym możliwym miejscu: ktoś ze starym linkiem
mógłby dalej **podpisać umowę** albo **zaakceptować ofertę**. Warunek musi
wejść we wszystkie sześć zapytań, nie w cztery.

### Zakres

1. **Baza** — `revoked_at TIMESTAMPTZ` przy każdym z pięciu tokenów
   (`ALTER TABLE … ADD COLUMN IF NOT EXISTS` w istniejących `create*Schema()`;
   bramka migracji: `schemaUpToDate()` / `markSchemaApplied()` — bez niej panel
   robi 150+ zapytań na zimny start).
   **Nie kasuj tokenu przy unieważnianiu** — pusty `share_token` zrobiłby
   z „unieważniony" stan nieodróżnialny od „nigdy nie wysłany", a kolejne
   kliknięcie „Wyślij" wygenerowałoby nowy i **cicho przywróciło dostęp**.
2. **Trasy** — warunek `AND revoked_at IS NULL` w sześciu zapytaniach z tabeli
   wyżej. Odpowiedź: **410 Gone** z komunikatem po polsku („Ten link został
   unieważniony przez wystawcę"), nie 404 — druga strona ma wiedzieć, że
   dokument istnieje, tylko dostęp odebrano. Strony publiczne muszą to
   rozróżnić i pokazać sensowny ekran zamiast „nie znaleziono".
3. **Panel** — w profilu Oferty/Umowy/Faktury/Wezwania/Projektu, obok
   istniejącego „Kopiuj link": **„Unieważnij link"** przez `confirm()`
   z `useUI()` (**nigdy** `window.confirm`). Po unieważnieniu widoczny stan
   „link unieważniony <data>" (`formatPlDate()`, nie surowy ISO) i przycisk
   **„Wygeneruj nowy"**.
4. **Apka iOS** — tylko podgląd stanu. Unieważnianie zostaje w panelu: ruch
   rzadki i nieodwracalny, a na telefonie łatwiej go stuknąć przez przypadek.

### Pułapka: „Wygeneruj nowy" i tak zwróci stary token

`ensureOfferShareToken()` i cztery bliźniacze funkcje (`lib/db.ts:1522+`)
zaczynają się od `if (existingToken) return existingToken;`. Wygenerowanie
nowego tokenu **nie może** iść przez nie — trzeba wprost nadpisać kolumnę
nowym `randomUUID()` i wyzerować `revoked_at` w jednym `UPDATE`. Inaczej
przycisk „Wygeneruj nowy" wygląda, jakby działał, i zwraca dokładnie ten sam
martwy link.

---

## Część B — białe listy pól w trasach publicznych

### Problem, sprawdzony w kodzie (Audyt 1, ustalenia 5 i 6)

Wszystkie cztery trasy dokumentowe robią `SELECT *` i **ukrywają czarną
listą** kilka kolumn. Znaczy to, że **każda nowa kolumna staje się publiczna
sama z siebie**.

To nie jest teoria — tak wyciekły już trzy rzeczy:

- `contracts/public` wydaje **`accepted_ip`, `accepted_user_agent`,
  `accepted_by_name`** — adres IP i przeglądarkę osoby, która podpisała
  umowę, każdemu, kto ma link. To dane osobowe bez podstawy (Audyt 2);
- `invoices/public` wydaje **`wezwanie_share_token`** — drugi, *celowo
  osobny* token do wezwania do zapłaty. Wydając go razem z fakturą, kasujemy
  sens tego rozdzielenia;
- `invoices/public` wydaje też **`client_id`**, kolumnę dodaną Modułem 30
  **po** napisaniu tej trasy — nikt nie dopisał jej do czarnej listy, bo nikt
  nigdy nie pamięta. Dwie sąsiednie trasy ją ukrywają, ta jedna nie.

Do tego wszystkie cztery zwracają cały wiersz `company_settings`, w tym
`rezerwa_vat_procent`, `rezerwa_pit_procent`, `rezerwa_zus_procent` — prywatne
ustawienia podatkowe właściciela, których wydruk nie używa.

### Jak to zrobić, żeby niczego nie urwać

**Kluczowy fakt, bez którego łatwo zepsuć panel:** strony publiczne
**re-używają komponentów wydruku z `/admin`**, sprawdzone w importach —
`app/[lang]/faktura/[token]/page.tsx` importuje `InvoicePrint`,
`umowa` i `nda` importują `ContractPrint`. Ten sam komponent działa w dwóch
trybach: w panelu bierze dane z `/api/invoices/[id]` (pełny wiersz),
publicznie z `/api/invoices/public/[token]`.

Zatem: **biała lista = dokładnie te pola, które czyta komponent wydruku.**
Wyprowadź ją z komponentu (`InvoicePrint`, `OfferPrint`, `ContractPrint`,
`DunningPrint`), nie z typu w `lib/`. Pole pominięte przez pomyłkę nie wywali
błędu — wydruk po prostu pokaże pustą rubrykę u klienta. Dlatego **każdy
z czterech wydruków trzeba obejrzeć na żywo** po zmianie, nie tylko skompilować.

Nowa kolumna w bazie po tej zmianie **nie wypłynie** — i o to chodzi.

### Uwaga na kolejność

Część A dokłada kolumnę `revoked_at`, którą czarna lista wypuściłaby na
zewnątrz. Jeśli robisz A przed B, pamiętaj o niej; jeśli B przed A, biała
lista załatwia sprawę sama.

---

## Pułapki tego projektu

- **Sprawdź, czy coś WOŁA kod.** Pięć razy w tym projekcie pole istniało,
  a nikt go nie wywoływał (Moduł 30, 31, `mail_folders.last_error`,
  WhatsApp w apce, `list_unsubscribe_url`). `revoked_at` bez warunku
  w trasie byłby szóstym razem.
- **Zielony `tsc` nie jest dowodem.** Dowodem jest otwarcie publicznego linku
  przed unieważnieniem i po nim, oraz obejrzenie czterech wydruków po zmianie
  białych list. Serwer dev: `npm run dev`, dev-login działa bez hasła,
  dane z PGlite (`lib/dev-db.ts`).
- Trasa wezwania ma **własny** token, osobny od faktury — to celowe.
  Unieważnienie faktury nie może unieważniać wezwania ani odwrotnie.
- `invoices/public` filtruje też `status != 'Szkic'`, a wezwanie
  `wezwanie_wystawiono_at IS NOT NULL` — te warunki zostają, dochodzi trzeci.
