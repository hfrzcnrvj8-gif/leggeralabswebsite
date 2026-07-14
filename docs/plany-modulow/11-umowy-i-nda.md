# Moduł 11 — Umowy + NDA

> Przeczytaj najpierw `docs/plany-modulow/README.md` (zasady wspólne),
> `CLAUDE.md` i **koniecznie** `docs/plany-modulow/00-mapa-drogi-klienta.md`
> → sekcje "Etap 3 — Umowa" i "Krok 0" w docelowym przepływie pracy — tam
> jest pełne uzasadnienie i kontekst tej luki. Ten plik NIE ma jeszcze
> gotowej decyzji architektonicznej — zacznij od pytań, nie od kodu.

## Kontekst (żeby nie zaczynać od zera)

Audyt 2026-07-14 (pięć równoległych agentów przeglądających kod) potwierdził:
**dziś nie istnieje żadna koncepcja umowy/kontraktu w panelu.** Jedyne
miejsce na warunki to wolne pole tekstowe "uwagi" na ofercie
(`app/[lang]/admin/offers/OfferEditor.tsx`, placeholder: "np. Zakres,
warunki płatności, uwagi dla klienta"), widoczne dla klienta na publicznej
stronie oferty, ale całkowicie nieustrukturyzowane.

To **największa realna luka prawna/biznesowa** znaleziona w audycie —
właściciel wprost o nią pytał: "chcę mieć wszystko czarno na białym: jaki
jest mój zakres obowiązków, co sobie zastrzegam, kiedy klient może
cokolwiek reklamować, a co wiązałoby się z dodatkowo płatną usługą".

Przy okazji tego samego mechanizmu (e-podpis) dokłada się **NDA** —
osobna sprawa od Umowy: NDA jest PRZED sprzedażą (podczas rozmowy
kwalifikacyjnej, gdy trzeba omówić wewnętrzne systemy klienta), Umowa PO
akceptacji oferty.

## Stan faktyczny (co już jest — nie budować od zera)

- **Wzorzec e-podpisu już istnieje i działa** — `lib/offerAccept.ts`,
  `Offer` ma `accepted_at`, `accepted_by_name`, `accepted_ip`,
  `accepted_user_agent` (`lib/offers.ts:63-68`). Publiczna strona akceptacji
  (`app/api/offers/public/[token]/accept/route.ts`) przechwytuje
  `x-forwarded-for` i `user-agent`, wymaga wpisania imienia i zaznaczenia
  checkboxa potwierdzenia (`OfferPrint.tsx`). **Ten sam mechanizm da się
  zreplikować dla Umowy/NDA** — nie wymyślać nowego.
- **Akceptacja oferty jest atomowa** (`lib/offerAccept.ts:65`,
  `withTransaction`) — tworzy projekt + fakturę-szkic + kopiuje pozycje w
  jednej transakcji. Umowa powinna prawdopodobnie dołączyć do tej samej
  transakcji (albo być osobnym krokiem PO tej transakcji — do ustalenia,
  patrz pytania niżej).
- Publiczny widok oferty: `app/[lang]/oferta/[token]/page.tsx` renderuje
  `OfferPrint.tsx` (współdzielony z widokiem admina/PDF) — wzorzec do
  powielenia dla publicznego widoku umowy.
- `company_settings` (`lib/db.ts`) ma dane sprzedawcy używane na
  fakturach/ofertach — do reużycia na umowie.

## Otwarte pytania do zadania właścicielowi na starcie tego czatu

Nie zgaduj żadnej z tych odpowiedzi — to decyzje produktowe (i częściowo
prawne), nie techniczne:

1. **Forma dokumentu** — czy Umowa to osobny dokument/PDF generowany po
   akceptacji oferty (jak dziś faktura-szkic), czy rozszerzenie samej
   oferty o dodatkowe, ustrukturyzowane pola widoczne dopiero po
   akceptacji?
2. **Szablon vs. edytowalna treść** — czy właściciel chce JEDEN stały
   szablon prawny z polami do wypełnienia (zakres, cena, terminy), czy
   możliwość edycji całej treści per umowa?
3. **Zakres pól** — co dokładnie ma zawierać (na podstawie cytatu
   właściciela): zakres prac, wyłączenia, zasady zmiany zakresu (change
   request → nowa mini-oferta/aneks), zasady reklamacji/poprawek (ile
   bezpłatnych rund, w jakim terminie), własność intelektualna/kod
   źródłowy, ograniczenie odpowiedzialności, warunki płatności. Czy coś
   pominięto?
4. **NDA — kiedy i jak wysyłane** — czy to osobny, ręcznie inicjowany
   dokument przy leadzie (przed rozmową odkrywczą), czy zawsze
   automatycznie proponowany na pewnym etapie statusu leada?
5. **Treść prawna** — **KTO redaguje wiążące klauzule prawne?** Claude
   buduje mechanizm/strukturę/UI, ale sama treść (zwłaszcza ograniczenie
   odpowiedzialności, RODO, IP) **musi przejść przez prawnika** przed
   użyciem z prawdziwym klientem — dokładnie tak samo jak nota prawna i
   polityka prywatności w `PO_REJESTRACJI.md`. Czy właściciel ma już
   dostęp do prawnika/wzoru, czy panel ma na starcie użyć jawnie
   oznaczonego placeholdera "SZABLON DO WERYFIKACJI PRAWNEJ"?
6. **Podpis: jeden krok czy dwa** — czy klient podpisuje ofertę i umowę
   jednym kliknięciem (jedna transakcja, jak dziś oferta→projekt→faktura),
   czy to dwa osobne kroki (najpierw akceptuje ofertę, potem osobno
   podpisuje umowę)?

## Zasady, które nadal obowiązują (z README.md, nie łamać bez pytania)

- Miękkie podpowiedzi, nigdy twarde bramki — ALE tu wyjątek wart
  przedyskutowania: czy start realizacji projektu (Etap 5) powinien być
  **zablokowany** bez podpisanej umowy? To pytanie do właściciela, nie
  domyślne założenie — "miękko" nie zawsze oznacza "zero barier" przy
  realnym ryzyku prawnym.
- Zero AI/LLM w logice — generowanie dokumentu z szablonu i pól to zwykła
  logika, nie AI.
- Migracje idempotentne w `lib/db.ts`, `npx tsc --noEmit` po każdej paczce
  zmian, podgląd wizualny lokalnie.
- Panel jednoosobowy, właściciel nie czyta kodu — każda decyzja
  nietechniczna (a tu jest ich dużo, patrz pytania wyżej) wymaga pytania
  wprost.

## Definicja ukończenia

Nie da się jej dziś w pełni spisać — zależy od odpowiedzi na pytania
wyżej. Minimum: nowy projekt startuje z jasno określonym, podpisanym
(e-podpisem) zakresem prac i warunkami, widocznymi zarówno dla właściciela
jak i klienta, z wyraźnym zastrzeżeniem, że treść prawna wymaga jeszcze
weryfikacji prawnika przed pierwszym realnym użyciem.
