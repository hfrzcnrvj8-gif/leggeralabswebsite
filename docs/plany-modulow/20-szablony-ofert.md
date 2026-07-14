# Moduł 20 — Szablony ofert / pakiety usług

> Przeczytaj najpierw `docs/plany-modulow/README.md` (zasady wspólne),
> `CLAUDE.md` i `docs/plany-modulow/00-mapa-drogi-klienta.md` → sekcja
> "Etap 2 — Oferta" (szablony ofert). Ten moduł powstał z prośby
> właściciela "pracować mądrze, nie tylko ciężko".

## Kontekst (żeby nie zaczynać od zera)

Zamiast pisać każdą ofertę od zera, właściciel chce 2-3 gotowe szkielety
(typowy zakres + typowa cena za typowy typ projektu). Szybsza praca, ale
ważniejsze: wymusza spójność zakresu (nic się nie zapomina, bo szablon już
to ma) i jest pierwszym krokiem w stronę produktyzacji usług — jasna
oferta zamiast "wyceniamy indywidualnie" za każdym razem.

## Stan faktyczny (co już jest — nie budować od zera)

- `Offer`/`OfferItem` (`lib/offers.ts`) — struktura oferty z pozycjami
  (nazwa, ilość, cena) już istnieje.
- `OfferEditor.tsx` — edytor pozycji oferty, punkt integracji dla
  "wstaw z szablonu".
- Wzorzec podobny do `RecurringInvoice`/`RecurringCost` (`lib/recurring.ts`,
  Moduł 9) — tam pozycje trzymane jako JSONB "odbitka" bez relacyjnej
  integralności, kopiowana przy generowaniu. Podobny wzorzec (szablon =
  zestaw pozycji + domyślny opis/uwagi) pasuje też tutaj, choć tu bez
  cyklicznego generowania — tylko "wstaw jako punkt startowy do edycji".

## Otwarte pytania do zadania właścicielowi na starcie tego czatu

1. **Ile szablonów i jakie** — właściciel sam definiuje treść (to decyzja
   biznesowa/ofertowa) — jakie typy usług/pakietów ma wymienić na start?
2. **Co szablon zawiera** — same pozycje (nazwa/ilość/cena), czy też
   domyślny tekst "uwag" (zakres/warunki, patrz Etap 2 mapy drogi)?
3. **Edytowalność po wstawieniu** — zawsze w pełni edytowalne po wstawieniu
   do nowej oferty (rekomendacja: tak, szablon to punkt startowy, nie
   sztywny szablon), czy niektóre pola mają zostać zablokowane?
4. **Zarządzanie szablonami** — osobny panel do tworzenia/edycji
   szablonów (jak `RecurringCostsPanel`), czy prostsze rozwiązanie (np.
   "zapisz tę ofertę jako szablon")?

## Zasady, które nadal obowiązują (z README.md, nie łamać bez pytania)

- Zero AI/LLM w logice.
- Design system: `.card-paper`, paleta marki, `useUI()` zamiast `window.*`.
- Migracje idempotentne w `lib/db.ts`, `npx tsc --noEmit` po każdej paczce
  zmian, podgląd wizualny lokalnie.

## Definicja ukończenia

Nie da się jej dziś w pełni spisać — zależy od odpowiedzi na pytania
wyżej. Minimum: właściciel może zacząć nową ofertę od gotowego szkieletu
zamiast pustej strony, z pełną możliwością edycji przed wysłaniem.
