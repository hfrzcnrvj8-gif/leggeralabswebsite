# Moduł 14 — Onboarding klienta

> Przeczytaj najpierw `docs/plany-modulow/README.md` (zasady wspólne),
> `CLAUDE.md` i `docs/plany-modulow/00-mapa-drogi-klienta.md` → sekcja
> "Etap 4 — Onboarding klienta". Rób ten moduł PO module 11 (Umowy) —
> onboarding startuje formalnie dopiero po podpisaniu umowy.

## Kontekst (żeby nie zaczynać od zera)

Dziś projekt startuje od razu po akceptacji oferty, bez żadnego
ustandaryzowanego "rytuału startu". Klient nie wie, czego się spodziewać
(kto się z kim kontaktuje, jak często będą statusy, czego panel/właściciel
od niego potrzebuje na start), a właściciel nie ma checklisty, co zebrać
przed pierwszym dniem realizacji. To jeden z najczęściej pomijanych
etapów przez małe firmy — pierwsze wrażenie z fazy realizacji buduje się
w pierwszym tygodniu.

## Stan faktyczny (co już jest — nie budować od zera)

- `ProjectResource` (`lib/projects.ts`) — istniejąca tabela na linki/zasoby
  przy projekcie (`etykieta`, `url`). Częściowo nadaje się do przechowania
  linków do dostarczonych materiałów/dostępów, ale to nie checklista.
- `ProjectActivity` — log notatek/zdarzeń przy projekcie, mógłby posłużyć
  do zapisania "onboarding zakończony".
- Projekt ma `opis` (jedno pole wolnego tekstu) — brak dziś żadnego pola
  strukturalnego pod "co potrzebuję od klienta".
- Wzorzec miękkich, nietwardych podpowiedzi już istnieje w Leadach
  (`LEAD_STATUS_HINT`, `lib/leads.ts:186-195`) — do powielenia w podobnej
  formie dla checklisty onboardingowej.

## Otwarte pytania do zadania właścicielowi na starcie tego czatu

1. **Checklista czy wolny tekst?** — czy onboarding to zestaw konkretnych,
   zaznaczalnych punktów (np. "dostępy do systemu X", "kontakt do
   decydenta", "materiały graficzne") ustandaryzowany dla wszystkich
   projektów, czy właściciel chce definiować checklistę per projekt?
2. **Wiadomość powitalna — automatyczna czy do ręcznego wysłania?** Zgodnie
   z generalną zasadą "zero automatycznego wysyłania bez zatwierdzenia"
   (tam gdzie dotyczy pieniędzy/zobowiązań) — tu ryzyko niższe, ale i tak
   do potwierdzenia: czy panel przygotowuje gotowy szablon do przejrzenia
   i ręcznego wysłania, czy wysyła sam po podpisaniu umowy?
3. **Gdzie w UI** — osobna zakładka/sekcja w `ProjectDetailPanel.tsx`, czy
   osobny krok/modal pokazywany raz przy tworzeniu projektu z zaakceptowanej
   oferty?
4. **Czy checklista blokuje start realizacji** (Etap 5), czy to czysto
   informacyjne przypomnienie? Zgodnie z zasadą "miękkie podpowiedzi,
   nigdy twarde bramki" domyślnie NIE blokuje — ale potwierdź wprost,
   zwłaszcza jeśli moduł 11 (Umowy) wprowadził jakąś twardszą blokadę
   przed umową.

## Zasady, które nadal obowiązują (z README.md, nie łamać bez pytania)

- Miękkie podpowiedzi, nigdy twarde bramki.
- Design system: `.card-paper`, paleta marki, emoji zamiast ikon,
  `useUI()` zamiast `window.*`.
- Migracje idempotentne w `lib/db.ts`, `npx tsc --noEmit` po każdej paczce
  zmian, podgląd wizualny lokalnie.

## Definicja ukończenia

Nie da się jej dziś w pełni spisać — zależy od odpowiedzi na pytania
wyżej. Minimum: każdy nowy projekt ma widoczną checklistę/sekcję
onboardingową, którą właściciel może uzupełnić przed startem realnej
pracy, i miękką podpowiedź, jeśli zostanie pominięta.
