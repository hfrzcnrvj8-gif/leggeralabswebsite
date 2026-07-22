# Moduł 40 — unieważnianie publicznych linków

> Powstał z **Audytu 1** (`docs/AUDYT-1-WYNIKI.md`, ustalenie 8), decyzja
> właściciela z 2026-07-22. Jeden czat, wąski zakres.

## Problem, zmierzony

Pięć rodzajów tokenów w publicznych linkach — oferta, umowa, faktura,
wezwanie do zapłaty, formularz opinii — jest **wieczne i nieodwoływalne**.
Sprawdzone w schemacie (`lib/db.ts`: `share_token`, `wezwanie_share_token`,
`review_token` — same `TEXT`, bez `expires_at`, bez `revoked_at`) i w pięciu
trasach `*/public/[token]`, z których żadna nie sprawdza wieku tokenu.

Skutek: mail przesłany dalej przez klienta = trwały dostęp do dokumentu,
którego nie da się cofnąć.

## Decyzja właściciela (nie zmieniać bez pytania)

**Tokeny zostają wieczne.** Automatyczne wygasanie odrzucone świadomie:
faktura sprzed dwóch lat ma się dalej otwierać, a link umierający sam
generowałby telefony „nie działa mi Pana link".

Dochodzi **ręczne** unieważnienie: przycisk w panelu, świadomy ruch
właściciela, wtedy gdy wie, że link poszedł nie tam.

## Zakres

1. **Baza** — `revoked_at TIMESTAMPTZ` przy każdym z pięciu tokenów
   (`ALTER TABLE … ADD COLUMN IF NOT EXISTS` w istniejących `create*Schema()`,
   pamiętaj o bramce migracji: `schemaUpToDate()` / `markSchemaApplied()`).
   **Nie kasuj tokenu** — pusty `share_token` zrobiłby z „unieważniony"
   nieodróżnialny od „nigdy nie wysłany", a kolejne „Wyślij" wygenerowałoby
   nowy i cicho przywróciło dostęp.
2. **Trasy publiczne** — warunek `… AND revoked_at IS NULL` w pięciu
   zapytaniach. Odpowiedź: **410 Gone** z czytelnym komunikatem po polsku
   („Ten link został unieważniony przez wystawcę"), nie 404 — klient ma
   wiedzieć, że dokument istnieje, tylko dostęp odebrano.
3. **Panel** — w profilu Oferty/Umowy/Faktury/Wezwania/Projektu, obok
   istniejącego „Kopiuj link": „Unieważnij link" przez `confirm()`
   z `useUI()` (**nigdy** `window.confirm`). Po unieważnieniu widoczny stan
   „link unieważniony <data>" i przycisk „Wygeneruj nowy" (kasuje `revoked_at`
   i wstawia nowy token — stary URL zostaje martwy).
4. **Apka iOS** — tylko podgląd stanu. Unieważnianie zostaje w panelu:
   to ruch rzadki i nieodwracalny, a na telefonie łatwiej go stuknąć przez
   przypadek.

## Pułapki tego projektu

- **Sprawdź, czy coś WOŁA kod.** Pięć razy w tym projekcie pole istniało,
  a nikt go nie wywoływał. `revoked_at` bez warunku w trasie publicznej
  byłby szóstym razem.
- Publiczne trasy robią `SELECT *` z **czarną listą** ukrywanych pól — nowa
  kolumna `revoked_at` wypłynie w odpowiedzi sama z siebie. To jest ten sam
  mechanizm, który wyciekł `client_id` (Audyt 1, ustalenie 6). Przy okazji
  tego modułu zamień czarne listy na białe.
- Trasa wezwania ma **własny** token, osobny od faktury — to celowe.
  Unieważnienie faktury nie może unieważniać wezwania ani odwrotnie.
