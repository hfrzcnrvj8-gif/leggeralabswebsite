# Moduł 4d — Poczta: dopasowanie do klienta, kartoteka, szybkie akcje, szerokość

> Przeczytaj najpierw `CLAUDE.md` i `HUB_SETUP.md` → sekcje „Moduł 4".
> Średni. **Punkt 1 to realna luka w logice (nie kosmetyka) — zrób go pierwszy.**

## Skąd to się wzięło

Właściciel używa poczty na produkcji i zgłosił 2026-07-15, czego brakuje.
Poniżej jego uwagi 1:1 + diagnoza (zweryfikowana w kodzie, nie zgadywana).

---

## 1. ⚠️ LUKA: mail od znanego klienta nie jest rozpoznawany

> „mam wiadomość mail od adresu który jest zapisany jako klient i nie mam tam
> w poczcie takiej ikonki z odnośnikiem że to jest rozpoznany mail i dopasowany
> do tego klienta, a na tym mi bardzo zależało"

**To NIE jest problem UI — plakietka klienta działa** (`MailDashboard.tsx`
pokazuje `m.client_nazwa`, `MailDetailPanel.tsx` linkuje do karty). Problem
jest głębszy:

**Dopasowanie po adresie dzieje się WYŁĄCZNIE w chwili pobrania maila** —
`findContactsByEmail()` jest wołane tylko w `saveIncoming()`
(`lib/mailSync.ts:198`). Skutek: mail, który przyszedł ZANIM założyłeś
klienta, zostaje `client_id = NULL` **na zawsze** — nic go nigdy nie sprawdza
ponownie. A właściciel dopiero buduje bazę klientów, więc to jest normalny,
codzienny przypadek, nie wyjątek.

**Do zrobienia:** przepięcie istniejących wiadomości, gdy kontakt pojawi się
później. Możliwe podejścia (wybierz i uzasadnij):
- `rematchUnassigned()` w `syncMailbox()` — wzorem `backfillCategories()`:
  weź maile z `client_id IS NULL AND lead_id IS NULL AND kategoria <> 'reklama'`
  i spróbuj dopasować ponownie. Samo-naprawiające się, właściciel nic nie klika.
- Dodatkowo przy tworzeniu/edycji klienta i leada (POST/PATCH `/api/clients`,
  `/api/leads`) — dopnij ich zaległą korespondencję od razu.
- **Pamiętaj:** dopasowanie musi też dopisać wpis na oś kontaktu
  (`logMailOnTimeline`), inaczej mail będzie w Poczcie, ale nie na karcie
  klienta. I nie może dublować wpisu, gdy już istnieje (`mail_message_id`).

## 2. Kartoteka korespondencji na karcie klienta

> „w kliencie wciąż mi się nie pojawia rejestr taki w którym widzę tego maila,
> a każdy klient ma mieć taką teczkę/kartotekę gdzie to się wszystko zapisuje"

⚠️ **To ŚWIADOMA ZMIANA WCZEŚNIEJSZEJ DECYZJI.** Brief `04-skrzynka-mailowa.md`
mówił: „BEZ osobnej sekcji Wiadomości — mail ma wpadać w scalony feed jak
telefon z Modułu 3". Właściciel teraz wprost prosi o osobny rejestr. Jego
decyzja jest ważniejsza. **Nie cofaj tego z powrotem „bo tak było w briefie".**

Uwaga: część tego wrażenia bierze się z punktu 1 (mail nieprzypisany = nie ma
go na karcie w ogóle). Napraw 1, potem zapytaj właściciela, czy scalony feed
mu wystarcza, czy nadal chce osobnej teczki. **Zapytaj, zanim zbudujesz** —
to decyzja produktowa, nie techniczna.

Jeśli teczka: sekcja „Korespondencja" na `ClientDetailPanel.tsx`, lista maili
(temat, data, kierunek, status) z linkiem do pełnej treści
(`/[lang]/admin/mail/[id]`). Dane są — `mail_messages.client_id` + istniejące
`mail_message_id` na `client_activity`.

## 3. Szybkie akcje bez otwierania podglądu

> „żeby zmienić np. na obsłużony to muszę otwierać cały podgląd, a nie że
> kliknę na ten tag i mi się otwierają opcje, to też do poprawy"

Dziś zmiana statusu wymaga otwarcia modala (`MailDetailPanel`). Ma być: klik w
plakietkę statusu na LIŚCIE → menu z opcjami (Obsłużone / Wycisz / Przywróć).
API już jest: `PATCH /api/mail/[id]` przyjmuje `{ status }`.
- Wzorzec z panelu: `useUI()` (`toast`), optymistyczne usunięcie z listy jak w
  `DashboardHome.tsx` (`markMailHandled`).
- Uwaga: klik w plakietkę nie może otwierać modala (`stopPropagation`).
- Warto rozważyć skróty klawiszowe (`e` = obsłużone) — infrastruktura jest
  (`useRegisterActions`, paleta Cmd+K).

## 4. Szerokość: wykorzystać cały ekran

> „ogólnie cały podgląd tej tabeli powinien być rozciągnięty aby wykorzystać
> całą przestrzeń na ekranie"

Sztywne `max-w-5xl` w DWÓCH miejscach:
- `app/[lang]/admin/mail/MailDashboard.tsx:328` (modal podglądu),
- `app/[lang]/admin/mail/[id]/MailDetail.tsx:20` (podstrona).

⚠️ **Sprawdź z właścicielem, co dokładnie ma być szersze** — lista już jest na
pełną szerokość, więc chodzi najpewniej o podgląd wiadomości. CLAUDE.md mówi,
że profil rekordu w Leadach/Klientach jest BEZ `max-w` (pełna szerokość,
margines z paddingu overlayu) — to gotowy wzorzec do naśladowania.
Uwaga na czytelność: treść maila to jedna kolumna tekstu; bardzo długie
linijki czyta się źle. Rozważ szeroką ramkę, ale ograniczoną szerokość samego
akapitu (albo układ dwukolumnowy: lista + podgląd obok siebie, jak w Outlooku
— to by rozwiązało też punkt 3).

---

## Czego świadomie NIE ma tutaj
Wersje robocze, VIP, foldery (Wysłane/Kosz/Spam), flagi, przenoszenie między
skrzynkami, nowa wiadomość, przekaż, odpowiedz wszystkim — to **Moduł 4b**
(`04b-poczta-pelny-klient.md`), świadomie osobny i większy. Właściciel
przypomniał o nich 2026-07-15 („wciąż brak tego o co prosiłem") — są
zaplanowane, nie zapomniane.

## Definicja ukończenia
- Mail od znanego klienta/leada rozpoznaje się TAKŻE wtedy, gdy kontakt
  powstał później — zweryfikowane na dev (dodaj klienta o adresie
  istniejącego maila i sprawdź, czy plakietka i wpis na osi się pojawiają).
- Status zmieniany jednym kliknięciem z listy.
- Podgląd wykorzystuje ekran (po ustaleniu z właścicielem).
- Kartoteka na karcie klienta — jeśli właściciel ją potwierdzi po naprawie 1.
- `npx tsc --noEmit`, weryfikacja lokalna, `HUB_SETUP.md` zaktualizowany.
