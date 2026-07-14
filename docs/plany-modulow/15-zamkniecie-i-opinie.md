# Moduł 15 — Zamknięcie projektu i opinie

> Przeczytaj najpierw `docs/plany-modulow/README.md` (zasady wspólne),
> `CLAUDE.md` i `docs/plany-modulow/00-mapa-drogi-klienta.md` → sekcja
> "Etap 8 — Zamknięcie i opinia". Rób ten moduł PO module 12 (fundament
> linkowania) — nowe zdarzenie "opinia zebrana" powinno od razu być
> klikalne na osi czasu klienta.

## Kontekst (żeby nie zaczynać od zera)

Dziś projekt po prostu zmienia status na "Wdrożone", bez żadnego rytuału
zamknięcia. To jeden z najczęściej pomijanych, a najtańszych do zrobienia
dobrze etapów — dla nowej firmy bez portfolio (Leggera Labs, zero klientów
na starcie, patrz pamięć projektu `poltechnickx-positioning`) **to główne
źródło przyszłych referencji i case studies**.

## Stan faktyczny (co już jest — nie budować od zera)

- Status projektu (`PROJECT_STATUSES`, `lib/projects.ts:71-78`) — zmiana na
  "Wdrożone" to dobry punkt zaczepienia dla podpowiedzi ("czy wysłać
  podsumowanie i poprosić o opinię?").
- `client_events`/`logClientEvent()` — gotowy mechanizm do zapisania
  zdarzenia "opinia zebrana" na osi czasu klienta (patrz Moduł 12 dla
  klikalności).
- Klient (`lib/clients.ts`) nie ma dziś żadnego pola na ocenę/opinię —
  trzeba dodać.
- Wzorzec e-podpisu/zgody z Modułu 11 (Umowy/NDA) — może się przydać przy
  polu "zgoda na case study/referencję", jeśli ma być formalnie
  potwierdzana.

## Otwarte pytania do zadania właścicielowi na starcie tego czatu

1. **Forma oceny** — liczba 1-5, gwiazdki, czy coś innego? Jeden ogólny
   wskaźnik czy kilka (np. jakość / terminowość / komunikacja)?
2. **Jak zbierana** — czy to formularz wysyłany klientowi (link, jak
   publiczna oferta), czy właściciel wpisuje ocenę sam na podstawie
   rozmowy z klientem?
3. **Zgoda na referencję/case study** — osobne pole tak/nie, czy pełny
   tekst zgody do zaakceptowania (bliżej formalnej zgody RODO/marketingowej)?
4. **Szablon podsumowania projektu** — czy ma być generowany automatycznie
   z danych projektu (kamienie, co zrobiono), czy to zawsze ręcznie pisany
   tekst z podpowiedzią "nie zapomnij wysłać"?
5. **Gdzie widoczne wyniki** — czy oceny/opinie mają się gdzieś agregować
   (np. średnia na Pulpicie, przyszła strona z referencjami na stronie
   marketingowej) w tym module, czy to zostaje na później?

## Zasady, które nadal obowiązują (z README.md, nie łamać bez pytania)

- Miękkie podpowiedzi, nigdy twarde bramki — podpowiedź przy "Wdrożone",
  nie blokada zmiany statusu.
- Zero AI/LLM w logice.
- Migracje idempotentne w `lib/db.ts`, `npx tsc --noEmit` po każdej paczce
  zmian, podgląd wizualny lokalnie.

## Definicja ukończenia

Nie da się jej dziś w pełni spisać — zależy od odpowiedzi na pytania
wyżej. Minimum: przy zamknięciu projektu właściciel dostaje miękką
podpowiedź o podsumowaniu i prośbie o opinię, a klient ma pole na
ocenę/zgodę na referencję widoczne w jego karcie.
