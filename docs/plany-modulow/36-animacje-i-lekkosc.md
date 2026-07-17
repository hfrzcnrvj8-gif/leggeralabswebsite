# Moduł 36 — Animacje i lekkość: dokończenie rundy z 2026-07-16

> Przeczytaj `docs/plany-modulow/README.md` i `CLAUDE.md` (sekcja „Design
> system"). Brief powstał z uwagi właściciela 2026-07-17, po Module 34.

## To NIE jest nowy problem — to druga rata

Runda „lekkości" z **2026-07-16** (właściciel: panel jest „toporny, ociężały",
prośba o Apple/Linear) była **świadomie pierwszym krokiem**: naprawiła to, co
propaguje się globalnie przez wspólne klasy (`.btn-primary` → obwódka zamiast
gradientu, jedna krzywa, drobiazgi w Poczcie) i zostawiła pełny przegląd
pozostałych modułów na później. Zapisano wtedy wprost: *„jeśli właściciel wróci
z podobną uwagą przy innym module — to sygnał, żeby kontynuować tę samą rundę,
a nie traktować jako nowy problem"*. Właśnie wrócił. To jest ta kontynuacja.

## Rozstrzygnięte przy starcie (2026-07-17) — nie pytaj o to drugi raz

**„Liquid glass" NIE dosłownie.** Właściciel potwierdził: chodzi o **ogólne
wrażenie lekkości i płynności**, nie o szkło na kartach. Zasada z `CLAUDE.md`
zostaje: **`.glass` tylko na chrome** (nagłówek, overlay, Popover, dymki),
karty zostają `.card-paper`. Nie rozszerzaj glass na `.card-paper`.

## Zweryfikowane w kodzie (2026-07-17) — konkretny rozjazd

| Co | Stan |
|---|---|
| `prefers-reduced-motion` | ✅ **obsłużone** (`app/globals.css:359`) — tu jest czysto, nie ruszaj |
| jedna krzywa `cubic-bezier(0.16, 1, 0.3, 1)` | ❌ **tylko 3 wystąpienia**, a obok **7× `easeOut`**, **11× `linear`**, 2× `ease-out` |
| jedna sprężystość | ⚠️ `stiffness: 420` w **12** miejscach (standard), ale są odstępstwa: **500**, **400**, **120** |

**To jest sedno modułu.** Reguła z rundy 2026-07-16 mówi „używaj tej samej
krzywej przy każdym nowym animowanym elemencie" — i została zignorowana przez
kolejne moduły, bo `easeOut` to domyślna wartość framer-motion, którą dostajesz,
gdy nic nie napiszesz. Pojedynczo niewidoczne; łącznie panel „waży" różnie w
różnych miejscach.

## Zakres (propozycja)

1. **Ujednolicić krzywą i sprężystość** — `[0.16, 1, 0.3, 1]` dla przejść,
   `stiffness: 420 / damping: 32` dla springów. Wyjątki zostawiaj tylko z
   komentarzem UZASADNIAJĄCYM (np. `linear` dla spinnera jest poprawny —
   sprawdź, które z 11 `linear` to obroty, a które przeoczenia).
2. **Przejrzeć moduł po module** — czego runda 1 nie dotknęła: Leady, Klienci,
   Faktury, Koszty, Oferty, Umowy, Projekty, Kalendarz, Notatnik, Statystyki.
3. Rozważyć stałe w jednym miejscu (np. `lib/motion.ts` albo klasy w
   `globals.css`), żeby „ta sama krzywa" nie była regułą do zapamiętania, tylko
   importem. **To jedyna decyzja architektoniczna — zapytaj właściciela.**

## Odnotowane osobno (NIE mieszaj do tego modułu bez pytania)

- **Znaki typograficzne**: `✕` (17×), `✓` (6×), `★` (5×) zostały świadomie po
  Module 33 — dziedziczą kolor i nie mają problemu emoji. Ale `✕` jest
  **niespójne**: część panelu używa `IconX`, część znaku. Węższa, osobna runda.
- **Nagłówek `<h1>` Poczty** i **trzecia implementacja menu w
  `MailDashboard.tsx`** — odłożone świadomie w Modułach 21/25/33.
- **Struktura pasków narzędzi** — trzy różne języki paska (Moduł 21).

## ⚠️ Pułapka podglądu — krytyczna WŁAŚNIE dla tego modułu

Ten moduł jest o animacjach, a **w podglądzie animacje potrafią nie działać
wcale**: karta bywa `hidden` → `requestAnimationFrame` = **0 klatek/s** →
`framer-motion` nie rusza (treść stoi na `opacity: 0`, przełączniki widoku
wyglądają na zepsute). Zdiagnozujesz wtedy „błąd", którego nie ma.

**Zawsze zaczynaj od `tabs_create`** — świeża karta jest `visible` i ma ~50
kl./s. Test rozstrzygający i szczegóły: pamięć `podglad-rAF-zamrozony`,
`HUB_SETUP.md` → „Moduł 34".

## Weryfikacja

`tsc` NIC tu nie sprawdzi — to runda w 100 % wizualna. Podgląd na świeżej
karcie, w jednym motywie: **panel `/admin` jest ciemny-only** (`.admin-linear`,
`globals.css:303`, nigdy nie dostaje `.dark`).
