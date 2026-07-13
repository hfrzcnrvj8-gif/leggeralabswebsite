# Moduł 10 — Dopracowanie Kalendarza

> Przeczytaj najpierw `docs/plany-modulow/README.md` (zasady wspólne) i `CLAUDE.md`.
> W przeciwieństwie do innych plików w tym folderze, **ten NIE ma jeszcze
> gotowej DECYZJI architektonicznej** — właściciel wprost poprosił, żeby
> najpierw zaproponować plan i dopytać o otwarte decyzje, zanim cokolwiek
> powstanie. Zacznij od pytań, nie od kodu.

## Kontekst (żeby nie zaczynać od zera)

2026-07-14, przy okazji Modułu 3 (kanały kontaktu), właściciel zapytał, czy
kalendarz mógłby agregować "te wszystkie działania z odpowiednimi tagami,
dopasowaniem do klienta itp." W tej samej sesji zdążyliśmy dołożyć **jedną
konkretną rzecz**: zalogowane połączenia telefoniczne (kanał="telefon")
pojawiają się teraz w kalendarzu jako kolorowe pozycje (turkus = odebrane,
czerwony = nieodebrane), klikalne do karty leada/klienta — patrz
`HUB_SETUP.md` → „Moduł 3 — trzecia tura: połączenia w Kalendarzu”. To był
świadomie wąski, pierwszy krok — **cała reszta "dopracowania" kalendarza
zaczyna się w tym module, w nowym czacie.**

## Stan faktyczny (co już jest — nie budować od zera)

- `lib/db.ts` — tabela `events` (id, tytul, opis, data, godzina, lead_id,
  project_id). **Brak `client_id`** — ręczne wydarzenie da się dziś powiązać
  tylko z leadem albo projektem, nie z klientem wprost (choć klient i tak
  jest osiągalny przez powiązany lead/projekt).
- `app/[lang]/admin/calendar/CalendarView.tsx` — widok miesiąca, siatka 7×N,
  klik w dzień pokazuje listę + formularz dodawania. Ręczne wydarzenia
  zawsze niebieskie (`#4ea7fc`), bez rozróżnienia typu/koloru/tagu.
- `app/api/events/deadlines/route.ts` — **osobny, wzorcowy mechanizm
  "wyliczonych terminów"**, tylko do odczytu (nic tu się nie zapisuje ani nie
  usuwa z poziomu kalendarza). Dziś nakłada: płatności faktur, terminy
  projektów, kamienie milowe, przypomnienia (next_followup) leadów/klientów,
  i (od 2026-07-14) połączenia telefoniczne. `DeadlineKind` + `DEADLINE_STYLE`
  w `CalendarView.tsx` to jedno wspólne miejsce kolorów/etykiet/linków — to
  jest wzorzec do rozszerzania, nie zaczynanie od zera.
- Limit **2 pozycje na dzień + "+N więcej"**, wspólny dla ręcznych wydarzeń i
  wyliczonych terminów — świadomy wybór przeciw zapychaniu siatki miesiąca.
- Kolory kanałów kontaktu już istnieją i są gotowe do reużycia:
  `CONTACT_CHANNEL_CLASS`, `CALL_OUTCOME_CLASS` w `lib/contact.ts`.

## Otwarte pytania do zadania właścicielowi na starcie tego czatu

Nie zgaduj żadnej z tych odpowiedzi — to decyzje produktowe, nie techniczne:

1. **Zakres "wszystkich działań"** — dziś w kalendarzu są tylko połączenia
   telefoniczne z historii kontaktu. Czy dołożyć też maile/WhatsApp/notatki?
   Jeśli tak — czy dalej z limitem 2+"więcej", czy potrzebny inny układ (np.
   dedykowany widok "agenda dnia" obok siatki miesiąca)?
2. **"Dopasowanie do klienta"** — co dokładnie właściciel ma na myśli:
   (a) możliwość powiązania RĘCZNEGO wydarzenia z klientem (dziś tylko
   lead/projekt), (b) filtrowanie kalendarza po konkretnym kliencie, (c) coś
   innego (np. osobny "kalendarz klienta" w karcie klienta)?
3. **"Odpowiednie tagi"** — czy chodzi o kolory (już częściowo jest — patrz
   `DEADLINE_STYLE`), czy o coś bardziej strukturalnego (np. własne,
   definiowane przez właściciela tagi/etykiety na wydarzeniach)?
4. **Czy limit 2+"więcej" na dzień dalej ma sens**, czy przy większej
   liczbie zagregowanych zdarzeń potrzebny jest inny układ dnia (np. rozwijana
   lista, oddzielny panel "agenda" zamiast czystej siatki miesiąca)?
5. Czy warto dodać **widok tygodnia/dnia** obok istniejącego widoku miesiąca
   — miesiąc dobrze pokazuje "co nadchodzi", słabiej "co mam dziś po kolei".

## Zasady, które nadal obowiązują (z README.md, nie łamać bez pytania)

- Miękkie podpowiedzi, nigdy twarde bramki.
- Zero AI/LLM w logice kalendarza/dopasowań.
- Design system: `.card-paper`, paleta marki, emoji zamiast ikon (w tym
  module `CalendarView.tsx` już używa gołych znaków `←`/`→` zamiast
  Tabler/lucide — zostań przy tej konwencji).
- Migracje idempotentne w `lib/db.ts`, `npx tsc --noEmit` po każdej paczce
  zmian, podgląd wizualny lokalnie (`preview_start name:"dev"`).

## Definicja ukończenia

Nie da się jej dziś w pełni spisać — zależy od odpowiedzi na pytania wyżej.
Minimum: właściciel widzi realną poprawę w tym, jak kalendarz pokazuje "co
się dzieje" w firmie, bez zagłuszania istniejących terminów finansowych/
projektowych, które kalendarz już dobrze obsługuje.
