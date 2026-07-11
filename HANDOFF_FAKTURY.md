# Handoff — moduł Faktur (księgowość), stan na 2026-07-11

Ten plik jest tymczasowy — do wklejenia jako kontekst w nowym czacie, potem
można go usunąć (albo zostawić, nie szkodzi). Pełna, trwała dokumentacja
funkcjonalności jest już w `HUB_SETUP.md` (sekcja "Księgowość — dopięte do
końca").

## Stan: WSZYSTKO ZROBIONE, NIE ZACOMMITOWANE

`npx tsc --noEmit -p tsconfig.json` — czysto. Wszystko przetestowane lokalnie
(PGlite) w przeglądarce, end-to-end, łącznie z realnym bugiem znalezionym i
naprawionym po drodze (patrz niżej).

**Nic z tego nie jest jeszcze zacommitowane ani wypchnięte.** `git status`
pokazuje 24 zmienione/nowe pliki (lista w `HUB_SETUP.md` diff / poniżej).

## Co zrobić najpierw w nowym czacie

1. Przeczytaj `HUB_SETUP.md` (sekcja "Księgowość — dopięte do końca") — to
   jest pełny opis funkcjonalności.
2. Sprawdź `git status` i `git diff --stat` żeby zobaczyć zakres.
3. Zapytaj właściciela: **"Czy zrobić `git commit && git push`?"** — zgodnie
   z CLAUDE.md, on zawsze kończy sesję tym poleceniem, ale nigdy nie
   commituj bez pytania. To jedyna rzecz, która została nierozwiązana z
   poprzedniej sesji (zabrakło miejsca w oknie kontekstu, żeby dokończyć).
4. Jeśli `.git/index.lock` blokuje commit — każ właścicielowi
   `rm -f .git/index.lock` przed commitem (znana pułapka środowiska
   sandboxowego).

## Co zostało zbudowane (skrót)

Duży pakiet funkcji księgowych zatwierdzony przez właściciela przez
`AskUserQuestion` (Tier 1 + Tier 2 + baza kontrahentów GUS, bez KSeF i bez
linków płatności Stripe/Przelewy24 — świadomie odłożone):

1. **Faktura korygująca** — `koryguje_id`, prefiks numeracji `KOR`, tabela
   porównawcza przed/po na wydruku.
2. **Wysyłka mailem** — `share_token` + `/[lang]/faktura/[token]` (publiczny
   podgląd bez logowania) + `app/api/invoices/[id]/send` (Resend).
3. **Automatyczne przypomnienia o zaległościach** — w ramach istniejącego
   dziennego crona `/api/leads/notify` (BEZ nowego wpisu w `vercel.json`),
   odstęp 7 dni (`last_reminder_at`) + przycisk ręczny.
4. **Duplikowanie faktury** — `app/api/invoices/[id]/duplicate`.
5. **Wpłaty częściowe** — `invoice_payments`, karta "Płatności" w edytorze.
6. **Kurs NBP dla faktur w walucie obcej** — `lib/nbp.ts`, realny wymóg
   ustawy o VAT (kwota VAT musi być też w PLN), fail-open jeśli NBP
   nieosiągalne.
7. **Biała Lista MF (lookup NIP)** — `lib/mf.ts`, przycisk "Szukaj po NIP".
8. **Faktura proforma** — `typ_dokumentu`, własna numeracja `PF`, nie liczy
   się do KPI, przycisk "Przekształć w fakturę VAT".
9. **Faktura zaliczkowa** — `rozlicza_zaliczke_id`, odejmowanie na wydruku.
10. **Faktury cykliczne** — `recurring_invoices`, `RecurringPanel.tsx`
    (panel "Cykliczne" w pasku Faktur), generowanie szkiców w tym samym
    dziennym cronie (`generateDueRecurringInvoices()`).

## Realny bug znaleziony i naprawiony po drodze

W `RecurringPanel.tsx` edycja pozycji (nazwa/ilość/cena) patchowała serwer
na KAŻDYM naciśnięciu klawisza. To ścigało się z odświeżeniem listy
(`onSaved()` → nowy obiekt `template` z propsów → `useEffect` resetował
lokalny stan) i gubiło wpisywane znaki (np. wpisane "2000" zapisywało się
jako "0"). Naprawione na wzór już istniejący w `InvoiceEditor.tsx`: lokalny
stan podczas pisania, `patch()` dopiero na `onBlur`. Zweryfikowane przez
bezpośrednie zapytania do `/api/recurring` po edycji — wartość persystuje
poprawnie.

## Znane pułapki środowiska (przypomnienie z CLAUDE.md)

- `.git/index.lock` — każ właścicielowi usunąć przed commitem.
- Konsola przeglądarki w tym środowisku czasem pokazuje STARY, nieaktualny
  błąd kompilacji (np. "addDaysISO defined multiple times") nawet długo po
  naprawieniu — jeśli `tsc --noEmit` jest czyste, to fałszywy alarm z
  bufora narzędzia, nie prawdziwy błąd. Sprawdzaj przez świeży `read_page`/
  zapytanie do API zamiast ufać historii konsoli.
- Klik w przeglądarce (Browser pane) bywa "flaky" — czasem nie rejestruje
  się za pierwszym razem. Ponów próbę albo użyj `ref` z `read_page` zamiast
  współrzędnych, szczególnie po zmianie layoutu/przewinięcia.
- `npx tsc --noEmit -p tsconfig.json` to jedyna realna weryfikacja w tym
  środowisku — pełny `next build` failuje z EPERM w sandboxie.

## Co dalej (zgodnie z `virtual-company-roadmap` w pamięci)

Po commit/push: **Faza C — Pulpit prezesa** (prawdziwe KPI z pieniędzy i
pipeline: przychód miesięczny, wartość ofert, należności, "wymaga działania
dziś" ze wszystkich modułów). Potem **Faza D — Mail** (najcięższa, na
koniec).
