# Testy reguł biznesowych (Audyt 6, 2026-07-23)

**Po co to jest.** Do Audytu 6 cały projekt weryfikowaliśmy ręcznie (curl,
zrzuty, oglądanie). Ręczna weryfikacja łapie błędy dobrze, ale **nie chroni
przed regresją** — nikt nie zauważy, że poprawka z lipca zepsuła regułę z
marca, dopóki się na to nie natknie.

**Co testujemy — i tylko to.** Wyłącznie **czyste reguły biznesowe** z `lib/`
(bez UI, bez bazy), które **dublują się z aplikacją iOS** (repo
`leggera-hub-ios`) i już raz się rozjechały:

- `parseQuickAdd` — rozbiór „jutro 14:00 call" (bliźniak: `Kalendarz.rozbierz`)
- `waLink` / `lastPhoneDigits` — numery telefonu (bliźniak: `Kontakty.whatsApp`)
- `snoozeOptions` / `sendLaterOptions` — terminy odłożenia/wysyłki
  (bliźniak: `Snooze.opcje` / `WysylkaPozniej.opcje`)
- `daysBetweenISO` — dni kalendarzowe, na których stoi reguła „wymaga
  działania dziś" (`isOverdue`); bliźniak: `LeadRules.dniOd`
- `ocenKopie` — ocena stanu kopii zapasowych (nie dublowana z apką, ale to
  reguła nadzoru, której cichy błąd byłby kosztowny — patrz Audyt 3/4)

**Czego NIE testujemy.** Interfejsu — tam ręczne oglądanie zrzutów jest
skuteczniejsze (świadoma decyzja, Audyt 6). Bazy, tras HTTP, migracji.

## Jak uruchomić

```bash
npm test
```

Runner: wbudowany `node --test` + `tsx` (jedyna zależność testowa, dev-only —
rozwiązuje importy `.ts` bez rozszerzeń, których surowy Node nie zjada).

**Reguła: test jest wart tyle, ile rozjazd, który złapie.** Każdy plik pinuje
arytmetykę (progi, kolejność, zaokrąglenia), a nie tylko „nie rzuca wyjątkiem".
Dopisując test, sprawdź, że **czerwieni się**, gdy zepsujesz regułę — inaczej
zieleń niczego nie dowodzi (zasada z czterech poprzednich audytów).
