# Panel /admin — pulpit, projekty, notatnik, kalendarz

Rozszerzenie rejestru leadów (`LEADS_SETUP.md`) o pełny "command center" w
stylu Linear — jedno miejsce spinające wszystko, o czym warto pamiętać.
Bez dodatkowej konfiguracji: te same zmienne środowiskowe co dla leadów
(`DATABASE_URL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`) obsługują cały
panel. Tabele dla nowych modułów (`projects`, `project_tasks`,
`project_activity`, `notes`, `events`) tworzą się same przy pierwszym użyciu
API, tak jak wcześniej `leads`.

## Nawigacja

Górny pasek pod logo przełącza między modułami:

- **Pulpit** (`/admin`) — widok "co dziś": leady wymagające działania,
  projekty z minionym terminem, dzisiejsze wydarzenia z kalendarza,
  ostatnie notatki. Punkt startowy każdego dnia pracy.
- **Projekty** (`/admin/projects`) — Twoje własne projekty/wdrożenia jako
  tablica kanban (Pomysł → Planowanie → W trakcie → Testy/review →
  Wdrożone/Wstrzymane), z checklistą i logiem aktywności per projekt —
  ten sam mechanizm co przy leadach (peek panel, tagi statusu do
  klikania, drag&drop).
- **Notatnik** (`/admin/notes`) — szybkie zapisywanie pomysłów, z tagami.
  Przycisk „→ Przekuj w projekt” tworzy z notatki nowy projekt jednym
  kliknięciem.
- **Kalendarz** (`/admin/calendar`) — widok miesiąca, klik w dzień pokazuje
  listę wydarzeń i formularz dodawania nowego (tytuł + opcjonalna godzina).
- **Leady** (`/admin/leads`) — bez zmian, opisane w `LEADS_SETUP.md`.

## Przypominacz

Zamiast modelu AI generującego sugestie (świadomie, zgodnie z wcześniejszą
decyzją o nie wciąganiu tu żadnego LLM-a) — deterministyczne reguły, ten sam
duch co przy leadach:

- Projekt "wymaga działania", jeśli ma ustawiony termin, który minął lub jest
  dziś, i nie jest w statusie "Wdrożone".
- Dzienny raport mailowy (patrz `LEADS_SETUP.md` → sekcja o Resend) teraz
  obejmuje cały panel, nie tylko leady: leady wymagające działania, projekty
  po terminie, i dzisiejsze wydarzenia z kalendarza — jeden mail na
  kontakt@leggeralabs.pl zamiast osobnych powiadomień per moduł.

## Czego świadomie nie ma (na razie)

- Command palette (Cmd+K) i skróty klawiszowe działają na razie tylko w
  module Leady — pozostałe moduły mają proste przyciski "+". Rozszerzenie
  na cały panel to naturalny kolejny krok, jeśli się przyda.
- Brak powiązania projektu z konkretnym leadem w UI (kolumna `lead_id`
  istnieje w bazie, ale nie ma jeszcze selektora w interfejsie).
- Kalendarz nie obsługuje wydarzeń cyklicznych — każde wydarzenie to
  pojedynczy wpis.
