# Moduł 16 — Wsparcie posprzedażowe

> Przeczytaj najpierw `docs/plany-modulow/README.md` (zasady wspólne),
> `CLAUDE.md` i `docs/plany-modulow/00-mapa-drogi-klienta.md` → sekcja
> "Etap 9 — Wsparcie posprzedażowe".
>
> **Uwaga: NIE budować "na zapas"** — ten moduł ma sens dopiero, gdy
> istnieją pierwsi klienci z realną potrzebą wsparcia po projekcie. Jeśli
> właściciel otwiera ten czat, a jeszcze nie ma żadnego zakończonego
> projektu z klientem — zapytaj wprost, czy to nie za wcześnie, zamiast
> budować niepotrzebną strukturę.

## Kontekst (żeby nie zaczynać od zera)

Po zakończeniu projektu klient może zgłosić błąd/pytanie — albo w ramach
gwarancji (bezpłatnie, ograniczony czas, ustalony w Umowie — Moduł 11),
albo jako nowe, płatne zlecenie. Dziś nie ma gdzie tego zgłosić/śledzić w
panelu poza zwykłym kontaktem mailowym/telefonicznym.

## Stan faktyczny (co już jest — nie budować od zera)

- Umowa (Moduł 11, jeśli już zbudowany) powinna definiować okres i zakres
  gwarancji — to punkt odniesienia: "czy to zgłoszenie jest jeszcze w
  gwarancji, czy to już nowe zlecenie".
- Wzorzec cyklicznych rozliczeń już istnieje (`lib/recurring.ts`,
  `recurring_invoices`, `recurring_costs` — patrz Moduł 9, Koszty) — do
  ewentualnego reużycia, jeśli właściciel zacznie oferować stałe
  wsparcie/retainer rozliczane cyklicznie.
- `client_events`/oś czasu klienta (Moduł 12) — naturalne miejsce, żeby
  zgłoszenie wsparcia było widoczne w historii klienta.

## Otwarte pytania do zadania właścicielowi na starcie tego czatu

1. **Czy ten moduł jest już potrzebny?** — patrz ostrzeżenie na górze.
2. **Lekki rejestr czy coś więcej** — prosty rejestr zgłoszeń (opis,
   gwarancja/płatne, status, daty) przy kliencie/projekcie, czy właściciel
   wyobraża sobie coś bardziej rozbudowanego (np. priorytety, SLA per
   zgłoszenie)?
3. **Stałe wsparcie/retainer** — czy w ogóle w planach oferowanie
   cyklicznego wsparcia (miesięczny abonament), czy tylko doraźne
   zgłoszenia post-projekt? To wpływa na to, czy warto od razu wpinać
   wzorzec `recurring_invoices`.
4. **Czas reakcji (nieformalne SLA)** — czy panel ma pilnować terminu
   odpowiedzi na zgłoszenie (jak nurture leadów), czy to zbyt
   rozbudowane na start?

## ⚠️ Dopisane przez audyt Modułu 29 (2026-07-17) — ta dziura NIE jest neutralna

Brief zakładał, że skoro Wsparcia nie ma, to po prostu „nic się nie dzieje" —
świadoma decyzja „nie budować na zapas". **Audyt drogi klienta ustalił, że tak
nie jest: zgłoszenie posprzedażowe wpada w tę dziurę i znika.**

Zgłoszenie od klienta po wdrożeniu przychodzi mailem. Poczta oferuje trzy
wyjścia (`app/api/mail/[id]/`): `create-lead`, `create-client`, `to-task`.

**Ścieżka 1 — „→ zadanie w projekcie" (naturalny wybór) → zadanie znika:**
- `api/mail/[id]/to-task/route.ts:28` proponuje **wszystkie projekty klienta,
  bez filtrowania po statusie** — więc także te „Wdrożone"
- `api/hub/today/route.ts:58` — Pulpit pyta o spóźnione kamienie z warunkiem
  `WHERE p.status != 'Wdrożone'`
- `lib/projects.ts:410` — reguła „projekt wymaga działania" zwraca „nie" dla
  zamkniętego projektu

**Skutek: zadanie wrzucone z maila do zamkniętego projektu jest niewidzialne na
Pulpicie i w dziennym mailu — na zawsze.** Prośba klienta trafia do panelu i
cicho zapada się w projekt, do którego właściciel nie ma już powodu zaglądać.

**Ścieżka 2 — „→ nowy lead" — niewiele lepsza:** wrzuca zgłoszenie gwarancyjne
z powrotem na tablicę sprzedaży, gdzie **zaniża konwersję lead→klient** i
uruchamia nurture, jakby to był ktoś nowy.

**Pytanie do właściciela (dodatkowe, przed pytaniem 1 wyżej):** czy ten przeciek
naprawić **niezależnie** od budowy całego modułu Wsparcia? Zgłoszenie znikające
bez śladu to realna strata dla klienta, a naprawa jest znacznie mniejsza niż
moduł — np. ostrzeżenie przy wyborze zamkniętego projektu w „→ zadanie", albo
pokazywanie zadań z zamkniętych projektów na Pulpicie. **To może być argument,
żeby zrobić mały fragment tego modułu wcześniej, niż mówi ostrzeżenie na górze.**

## Zasady, które nadal obowiązują (z README.md, nie łamać bez pytania)

- Miękkie podpowiedzi, nigdy twarde bramki.
- Zero AI/LLM w logice.
- Migracje idempotentne w `lib/db.ts`, `npx tsc --noEmit` po każdej paczce
  zmian, podgląd wizualny lokalnie.

## Definicja ukończenia

Nie da się jej dziś w pełni spisać — zależy od odpowiedzi na pytania
wyżej, w tym od tego, czy moduł jest w ogóle jeszcze potrzebny w momencie
startu tego czatu.
