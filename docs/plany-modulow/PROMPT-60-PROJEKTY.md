# Moduł PROJEKTY — rozbity na DWIE sesje (2026-07-31)

> Ten plik jest już tylko drogowskazem. Pierwotnie był jednym briefem; na
> prośbę właściciela moduł został rozdzielony, bo ma **28 uchwytów HTTP
> w 21 plikach** — najwięcej ze wszystkich audytowanych dotąd modułów,
> i nie mieści się w jednym czacie bez utraty jakości.

**Każda sesja = osobny czat. Oba pliki są samowystarczalne.**

| sesja | plik | zakres |
|---|---|---|
| 1/2 | [`PROMPT-60A-PROJEKTY-FUNDAMENT.md`](PROMPT-60A-PROJEKTY-FUNDAMENT.md) | integralność (sonda po 28 uchwytach), sufity i wsad, parytet panel ↔ apka, domknięcie lejka, poprawność danych i czasu |
| 2/2 | [`PROMPT-60B-PROJEKTY-WYGLAD.md`](PROMPT-60B-PROJEKTY-WYGLAD.md) | trzy pola ⚠️ z inwentarza Modułu 59 (kolor, nawigacja, treść), cała lista kontrolna na trzech platformach, widoki, gesty, ruch i haptyka |

**Kolejność ma znaczenie** — sesja 2 zaczyna od przeczytania wyniku sesji 1.
Sesja 1 kończy się aktualizacją briefu sesji 2 o to, co zastała.

## Dwa konkrety, od których zaczyna sesja 1

Oba sprawdzone w kodzie 2026-07-31, nie są hipotezami:

1. **`PATCH /api/projects/:id` nie waliduje słownika** — zapisuje `status`,
   `priorytet` i `zdrowie` prosto do bazy. `PROJECT_STATUSES` istnieje
   w `lib/projects.ts:260`, ale żadna trasa w `app/api` go nie importuje.
   Ta sama dziura, którą paczka A Modułu 59 zamknęła w Leadach i Fakturach.
2. **`POST /api/projects/review/public/:token/submit` nie ma hamulca** —
   publiczne trasy ofert (`accept`, `comment`) i umów (`accept`) wołają
   `lib/rateLimit.ts`, ta nie. Unieważnianie linków (Moduł 40) akurat
   obejmuje `project` i jest w porządku.
