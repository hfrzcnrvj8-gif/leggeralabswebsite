# Moduł 19 — Śledzenie czasu pracy

> Przeczytaj najpierw `docs/plany-modulow/README.md` (zasady wspólne),
> `CLAUDE.md` i `docs/plany-modulow/00-mapa-drogi-klienta.md` → sekcja
> "Etap 5 — Realizacja" (śledzenie czasu). Ten moduł powstał z prośby
> właściciela "pracować mądrze, nie tylko ciężko" — to narzędzie do
> samopoznania, nie do rozliczania klienta godzinowo (chyba że właściciel
> zdecyduje inaczej przy starcie tego czatu).

## Kontekst (żeby nie zaczynać od zera)

Najczęstszy błąd początkującego konsultanta: wycenia projekt "na oko",
robi go, dostaje zapłatę — i nigdy się nie dowiaduje, że realna stawka
godzinowa wyszła poniżej sensownej. Dziś istnieje rentowność finansowa
projektu (przychód minus koszty twarde), ale bez czasu nie widać
**prawdziwej** rentowności — tej liczonej też Twoim czasem.

## Stan faktyczny (co już jest — nie budować od zera)

- `ProjectDetailPanel.tsx` — już liczy i pokazuje rentowność
  (`rentownosc`: `przychod_netto`, `koszty_netto`, `zysk_netto`) na
  podstawie faktur i kosztów powiązanych z projektem. To dokładnie
  miejsce, obok którego ma stanąć nowy wskaźnik "efektywna stawka
  godzinowa".
- `ProjectTask`/`ProjectMilestone` (`lib/projects.ts`) — istniejące
  jednostki pracy, do których można doczepić zalogowany czas.
- Brak dziś jakiegokolwiek pola/tabeli na godziny pracy — to nowa tabela.

## Otwarte pytania do zadania właścicielowi na starcie tego czatu

1. **Ziarnistość logowania** — stoper "start/stop" w czasie rzeczywistym,
   czy prosty ręczny wpis "X godzin dzisiaj/w tym tygodniu" (rekomendacja
   z mapy drogi: to drugie, mniej uciążliwe dla jednoosobowej firmy)?
2. **Poziom przypięcia** — czas logowany per zadanie (`ProjectTask`), per
   kamień, czy tylko zbiorczo per projekt? Bardziej szczegółowe = więcej
   wglądu, ale więcej klikania.
3. **Czy to ma wpływać na fakturowanie** — czy to WYŁĄCZNIE narzędzie do
   własnej analityki (rekomendacja domyślna), czy właściciel chce w
   przyszłości też fakturować godzinowo na podstawie tych danych? To
   wpływa na to, czy warto już teraz projektować pod "stawka godzinowa
   klienta" jako osobne pole.
4. **Widoczność stawki godzinowej** — czy pokazywać ją tylko przy
   zamkniętym projekcie (podsumowanie), czy też na bieżąco w trakcie
   realizacji (ryzyko: może demotywować przy projektach, które się
   przeciągają — do przemyślenia z właścicielem, nie zakładać).

## Zasady, które nadal obowiązują (z README.md, nie łamać bez pytania)

- Miękkie podpowiedzi, nigdy twarde bramki — logowanie czasu to
  dobrowolne narzędzie, nie obowiązek blokujący inne akcje.
- Zero AI/LLM w logice.
- Migracje idempotentne w `lib/db.ts`, `npx tsc --noEmit` po każdej paczce
  zmian, podgląd wizualny lokalnie.

## Definicja ukończenia

Nie da się jej dziś w pełni spisać — zależy od odpowiedzi na pytania
wyżej. Minimum: właściciel może zalogować czas poświęcony na projekt i
zobaczyć efektywną stawkę godzinową obok istniejącej rentowności
finansowej.
