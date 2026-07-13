# Moduł 2 — Nurture: automatyczne przypomnienia po zamknięciu (luka ⑥)

> Przeczytaj najpierw `docs/plany-modulow/README.md` (zasady wspólne) i `CLAUDE.md`.
> Właściciel zdecydował: „niech działa tak, jak uważasz, że będzie miało
> największą użyteczność". Poniżej jest już **podjęta decyzja projektowa** — nie
> pytaj o wariant, tylko potwierdź liczby (odstępy) i buduj.

## Problem (nietechnicznie)

Krok 12 procesu to **nurture** — odezwanie się do klienta po czasie od zamknięcia
(sprawdzić jak działa wdrożenie, poprosić o referencję, zaproponować kolejną
automatyzację). Dziś działa tylko ręcznie: przypomnienie odpala się, jeśli
właściciel sam ustawi `next_followup`. Po wygranym dealu **nic nie planuje się
samo** — a klient, który raz zapłacił, to najtańsze źródło kolejnej sprzedaży.

## DECYZJA PROJEKTOWA (najwyższa użyteczność dla solo-founder)

**Nurture ma być w pełni automatyczny i powtarzalny — właściciel nie ustawia ani
nie klika nic, żeby zadziałało.** Zamiast pojedynczego przypomnienia budujemy
**rytm dwóch dotknięć** po wdrożeniu, bo dwa różne momenty mają różną wartość:

1. **+14 dni po „Wdrożone" — dotknięcie „świeże zadowolenie".** Klient właśnie
   dostał działającą automatyzację i jest najbardziej zadowolony → to najlepszy
   moment na **prośbę o referencję/opinię** i sprawdzenie, czy wszystko działa.
   To najcenniejszy pojedynczy touchpoint dla nowej agencji bez portfolio.
2. **+90 dni po „Wdrożone" — dotknięcie „kolejny krok".** Po kwartale użytkowania
   widać, co jeszcze da się zautomatyzować → moment na **upsell/nową propozycję**.

Po tych dwóch panel **nie nagabuje w nieskończoność** — dalej to już świadoma
decyzja właściciela (ręczne `next_followup` albo status „Uśpiony”).

**Dlaczego automatycznie, nie „propozycja do kliknięcia":** zgodnie z zasadą
„miękko, nigdy twarda bramka" — to i tak jest miękkie, bo nurture = *przypomnienie
właścicielowi, żeby się odezwał*, a NIE mail wysłany automatycznie za niego.
Panel nic nie wysyła do klienta sam; tylko wystawia właścicielowi zadanie „odezwij
się" na Pulpicie. Więc automatyczne zaplanowanie jest bezpieczne i najbardziej
użyteczne (zero rzeczy do zapamiętania). Właściciel zawsze może usunąć/przesunąć.

**Zero AI** — odstępy to statyczne stałe w kodzie, dobór momentu deterministyczny.

## Zakres

**W zakresie:** przy wdrożeniu projektu panel planuje klientowi dwa przyszłe
przypomnienia kontaktu (14 i 90 dni), z czytelnym powodem, tak żeby klient sam
wypływał na Pulpicie w „Klienci wymagający kontaktu" we właściwym dniu.

**Poza zakresem:** automatyczna wysyłka maili nurture do klienta (to byłby
outbound bez kontroli treści). Nurture = zadanie dla właściciela, nie mail za
niego. Zero AI dobierającego treść/termin.

## Stan faktyczny (co już jest)

- `clients.next_followup DATE` (`lib/db.ts`). `isClientOverdue(client)` → true,
  gdy `next_followup <= dziś` (sprawdź dokładną regułę w `lib/clients.ts`).
- Pulpit (`app/api/hub/today`) i mail dzienny pokazują „overdueClients"; przycisk
  „Obsłużone" w `DashboardHome.tsx` czyści `next_followup` i ustawia
  `ostatni_kontakt` na dziś (`markClientHandled`).
- `clientOverdueReason()` (`lib/clients.ts`) — tekst powodu na Pulpicie.
- Zdarzenia klienta: `logClientEvent()` (`lib/db.ts`).
- Trigger domknięcia: `app/api/projects/[id]/route.ts` PATCH już loguje zmianę
  statusu; „Wdrożone" to zamknięty status projektu (`CLOSED_PROJECT_STATUSES`).

## Problem techniczny: dwa przyszłe dotknięcia, jedno pole `next_followup`

`next_followup` trzyma jedną datę. Żeby mieć rytm 14+90 dni bez gubienia drugiego
dotknięcia, wybierz podejście (rekomendacja niżej):

- **Podejście A (rekomendowane) — mała tabela harmonogramu.** Nowa
  `client_followups` (id, client_id, due_date, powod, done_at) — idempotentnie w
  `lib/db.ts`. Przy „Wdrożone" wstaw 2 wiersze (14 i 90 dni). „Wymaga kontaktu" =
  istnieje wiersz z `due_date <= dziś AND done_at IS NULL`. „Obsłużone" ustawia
  `done_at`. Czyste, rozszerzalne, nie koliduje z ręcznym `next_followup`
  (te dwa źródła sumują się na Pulpicie).
- **Podejście B (lżejsze) — łańcuch na `next_followup`.** Ustaw od razu tylko
  +14 dni; gdy właściciel oznaczy „Obsłużone", panel proponuje/ustawia kolejne
  (+90). Prościej w bazie, ale gubi drugie dotknięcie, jeśli pierwsze nie zostanie
  „obsłużone" w panelu.

Rekomendacja: **Podejście A** — daje realny, przewidywalny rytm i zostaje pod
przyszłe rozszerzenia (np. nurture dla „Uśpionych”, przypomnienia rocznicowe).

## Plan techniczny (Podejście A)

### Krok 1 — schemat + stałe
- `lib/db.ts` (`ensureClientsSchema` lub nowa `ensureFollowupsSchema` z własnym
  cache): `client_followups` (id, client_id, due_date DATE, powod TEXT,
  created_at, done_at TIMESTAMPTZ NULL). Indeks po `client_id` i po `due_date`.
- `lib/clients.ts`: `NURTURE_OFFSETS = [{ days: 14, powod: "referencja/kontrola" },
  { days: 90, powod: "kolejna automatyzacja" }]` — jawne, łatwe do zmiany.
  Helper daty spójny z `lib/dates.ts` (arytmetyka, nie `new Date` do dnia).

### Krok 2 — planowanie przy wdrożeniu
- `app/api/projects/[id]/route.ts` PATCH: gdy status → „Wdrożone" a projekt ma
  `client_id`, wstaw wiersze `client_followups` wg `NURTURE_OFFSETS`
  (idempotentnie — nie duplikuj, jeśli już zaplanowane dla tego projektu/klienta;
  rozważ kolumnę `project_id` w harmonogramie dla dedupu). Zaloguj
  `logClientEvent(sql, clientId, "nurture_scheduled", "Zaplanowano kontakt
  kontrolny (14 i 90 dni)")`.

### Krok 3 — widoczność na Pulpicie i w mailu
- `app/api/hub/today`: do „Klienci wymagający kontaktu" dołóż klientów z
  `client_followups` wymagalnymi dziś (`due_date <= dziś AND done_at IS NULL`) —
  scal z istniejącą regułą `isClientOverdue`. Powód pokaż z `powod` („kontakt
  kontrolny: referencja” / „kontakt kontrolny: kolejna automatyzacja”).
- `app/api/leads/notify` (mail dzienny): analogicznie dorzuć do sekcji klientów.
- `DashboardHome.tsx` `markClientHandled`: „Obsłużone" ustawia `done_at` na
  wymagalnym wierszu (a przy ręcznym `next_followup` — jak dziś).

### Krok 4 — weryfikacja
- `npx tsc --noEmit -p tsconfig.json`.
- Dev: projekt z `client_id` → status „Wdrożone" → sprawdź 2 wiersze w
  harmonogramie + wpis w osi. Ustaw ręcznie `due_date` w przeszłości → klient
  pojawia się na Pulpicie z właściwym powodem → „Obsłużone" go zdejmuje. Zrzut
  dla właściciela.

## Otwarte decyzje (tylko liczby — zapytaj krótko, nie blokuj)
1. **Odstępy** — 14 i 90 dni OK? (łatwo zmienić jedną tablicą `NURTURE_OFFSETS`).
2. Czy chcesz od razu trzeci, długi „rocznicowy” touch (np. 365 dni)? Domyślnie NIE.

## Definicja ukończenia
- Po „Wdrożone” klient dostaje automatycznie 2 zaplanowane kontakty (14 i 90 dni),
  bez klikania, bez nadpisywania ręcznych dat.
- Klient wypływa na Pulpicie i w mailu we właściwym dniu z czytelnym powodem;
  „Obsłużone” go zdejmuje.
- `tsc` czysty, zweryfikowane na dev, zrzut dla właściciela, `HUB_SETUP.md`
  zaktualizowany.
