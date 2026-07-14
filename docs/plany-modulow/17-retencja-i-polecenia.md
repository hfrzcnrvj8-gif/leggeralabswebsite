# Moduł 17 — Retencja i polecenia

> Przeczytaj najpierw `docs/plany-modulow/README.md` (zasady wspólne),
> `CLAUDE.md` i `docs/plany-modulow/00-mapa-drogi-klienta.md` → sekcja
> "Etap 10 — Retencja i polecenia". Ten moduł **zamyka pętlę** całej mapy
> drogi klienta — zadowolony klient wraca jako nowy lead.

## Kontekst (żeby nie zaczynać od zera)

Relacja z klientem nie kończy się na zapłaconej fakturze. Firmy postrzegane
jako premium nie znikają po zakończeniu projektu — zaplanowany kontakt
2-3 miesiące później ("jak działa wdrożenie? potrzebujecie czegoś
jeszcze?") regularnie generuje kolejne zlecenia i polecenia. Kategoria
źródła leada "Polecenie" **już istnieje** w systemie
(`SOURCE_CATEGORIES`, `lib/leads.ts:114-123`) — ten moduł domyka pętlę,
żeby faktycznie było co do niej wpisywać.

## Stan faktyczny (co już jest — nie budować od zera)

- Nurture leadów (Moduł 2, `docs/plany-modulow/02-nurture-automatyczny.md`)
  — mechanika `next_followup`/przypomnień **już istnieje**, ale pilnuje
  leadów PRZED zamknięciem sprzedaży. Ten moduł potrzebuje analogicznego
  mechanizmu dla klientów PO zakończeniu projektu — do zbadania, czy da
  się reużyć istniejące pole `next_followup`/`next_action` na kliencie
  (`lib/clients.ts`), czy potrzebny osobny wyzwalacz.
- `client_events`/`logClientEvent()` — do zapisania zdarzenia "kontakt
  retencyjny wykonany".
- `zrodlo_kategoria` na leadzie — źródło "Polecenie" już się liczy w
  danych, tylko nic dziś nie pokazuje tego wskaźnika (patrz Moduł 18,
  Pulpit).

## Otwarte pytania do zadania właścicielowi na starcie tego czatu

1. **Wyzwalacz przypomnienia** — czy to ręcznie ustawiana data (jak dziś
   `next_followup` na leadzie), czy automatycznie proponowana X miesięcy
   po zamknięciu projektu (Moduł 15)? Jeśli automatyczna — jaki domyślny
   odstęp (2-3 miesiące? do potwierdzenia)?
2. **Treść kontaktu retencyjnego** — czy panel podpowiada gotowy szablon
   wiadomości (jak przy leadach), czy to zostaje całkowicie w gestii
   właściciela?
3. **Pytanie o polecenie** — czy to osobny krok/podpowiedź, czy część tej
   samej wiadomości retencyjnej?
4. **Gdzie widoczne** — czy klienci "do sprawdzenia" pojawiają się na
   Pulpicie analogicznie do leadów wymagających kontaktu?

## Zasady, które nadal obowiązują (z README.md, nie łamać bez pytania)

- Miękkie podpowiedzi, nigdy twarde bramki.
- Zero AI/LLM w logice.
- Migracje idempotentne w `lib/db.ts`, `npx tsc --noEmit` po każdej paczce
  zmian, podgląd wizualny lokalnie.

## Definicja ukończenia

Nie da się jej dziś w pełni spisać — zależy od odpowiedzi na pytania
wyżej. Minimum: właściciel ma sposób ustawienia/otrzymania przypomnienia
o kontakcie z klientem po zakończeniu projektu, a panel pokazuje, ile
nowych leadów faktycznie przyszło z poleceń.
