# Brief: rejestr wiadomości i rozmów + Kalendarz

> Brief wdrożeniowy pod **jeden osobny czat**. Zaczynasz od przeczytania
> `00-plan.md` (cały) i `inwentarz/02-projekty-hub.md` (sekcje „Kalendarz",
> `GET /api/events/deadlines`) oraz `inwentarz/01-leady-crm.md` (logi kontaktu).
> Repo apki: `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`.

**Skąd to się wzięło.** Właściciel, oglądając zakres Fazy 5 (2026-07-19),
poprosił o dwie rzeczy poza briefem:

> „w mobile przydałby się taki ogólny rejestr wiadomości/akcji, coś jak spis
> połączeń w telefonie, tyle że też ze spisem maili, wiadomości z komunikatorów
> itp. do tego dodałbym KALENDARZ"

Zostały świadomie odłożone tutaj, żeby nie rozdymać tamtej sesji. Pulpit i
zmiana układu belki (jego trzecie życzenie) zostały zrobione od razu.

---

## Zanim zaczniesz: jedna rzecz jest niemożliwa i trzeba to powiedzieć wprost

**Komunikatory odpadają i to nie jest kwestia nakładu pracy.** iOS nie daje
żadnej aplikacji dostępu do wiadomości WhatsAppa, Messengera ani iMessage —
to zamknięte piaskownice, bez API. Nie ma obejścia, którego warto szukać.

W panelu „WhatsApp" i „LinkedIn" istnieją **wyłącznie jako etykieta kanału
przy ręcznie zalogowanej rozmowie** (`ContactChannel` w `lib/leads.ts`). Żadna
integracja nic stamtąd nie zaciąga i nigdy nie zaciągała. Jeśli właściciel
spodziewa się, że rejestr sam pokaże wątek z WhatsAppa — trzeba to sprostować,
zanim powstanie kod, a nie po.

**Co da się zrobić i ma realną wartość:** jeden strumień z tego, co panel
już wie — maile przychodzące i wychodzące, zalogowane telefony (z „nieodebrane"
jako osobnym, wyróżnionym rodzajem, jak w spisie połączeń), oraz kontakty
zapisane na osi leadów i klientów.

---

## Część A: Rejestr — najpierw JEDNA decyzja

Danych jest komplet, ale **nie ma endpointu, który by je scalał**. Panel trzyma
je w trzech miejscach: `mail_messages`, logi kontaktu leadów
(`/api/leads/[id]/activity`) i klientów (`/api/clients/[id]/activity`).

Są dwie drogi i **trzeba wybrać, zanim napiszesz linijkę Swifta**:

### Droga 1 — nowa trasa agregująca w panelu (`GET /api/activity`)

Jedno zapytanie UNION po trzech źródłach, sortowane po dacie, stronicowane.

- **Za:** apka robi jedno żądanie; sortowanie i stronicowanie po stronie bazy;
  panel webowy dostaje ten sam rejestr za darmo, jeśli kiedyś zechce.
- **Przeciw:** nowa trasa w panelu, czyli praca po obu stronach; trzeba
  wymyślić wspólny kształt wiersza dla trzech różnych tabel.

### Droga 2 — scalanie po stronie apki

Apka pobiera to, co już umie, i skleja w pamięci.

- **Za:** zero zmian w panelu.
- **Przeciw:** **logi kontaktu są per-rekord** — nie ma trasy „wszystkie logi
  wszystkich leadów". Apka musiałaby odpytać każdy lead i każdego klienta
  osobno (dziesiątki żądań), albo pokazywać wyłącznie maile, co nie jest tym,
  o co właściciel prosił. Stronicowanie po scalonej liście też trzeba by
  napisać ręcznie.

**Rekomendacja: Droga 1** — i to jest już SPRAWDZONE, nie przeczucie
(zweryfikowane gretem 2026-07-19, przy zamykaniu poprzedniej sesji):

- **Trasy zbiorczej dla logów kontaktu NIE MA.** Każde zapytanie do
  `lead_activity` i `client_activity` filtruje po jednym rekordzie
  (`WHERE lead_id = ...` / `WHERE client_id = ...`). Droga 2 oznaczałaby więc
  odpytanie każdego leada i każdego klienta z osobna — dziesiątki żądań na
  jedno otwarcie ekranu.
- **Ale scalanie już gdzieś istnieje i warto je podebrać.**
  `app/api/events/deadlines/route.ts` odpytuje `lead_activity JOIN leads`
  oraz `client_activity JOIN clients` **bez filtra po pojedynczym rekordzie**
  (ogranicza je miesiącem) i produkuje gotowe rodzaje `call`, `call-missed`
  i `email`. To jest najbliższy istniejący wzorzec — przeczytaj go, zanim
  napiszesz własny SQL. Uwaga: to nie jest to samo zadanie (deadline'y są
  nakładką na kalendarz w oknie miesiąca, rejestr ma być historią wstecz
  ze stronicowaniem), więc kopiuj kształt zapytań, nie logikę zakresu.

### Kształt, gdy wybierzecie Drogę 1

Sugerowany wiersz — trzymaj się nazw z panelu, nie wymyślaj nowych:

```
{ id, kind: "mail-in"|"mail-out"|"call"|"call-missed"|"contact",
  kiedy: timestamptz, tytul, podtytul,
  client_id, lead_id, kanal, kierunek, wynik }
```

`GET /api/events/deadlines` **już produkuje bardzo podobne rodzaje**
(`call`, `call-missed`, `email`) i ma gotową logikę „co jest czym" — przeczytaj
ją, zanim napiszesz własną. To dobry punkt startu, ale nie to samo: deadline'y
są nakładką na kalendarz w oknie miesiąca, rejestr ma być historią wstecz.

### UI

Jedna lista, jak spis połączeń: ikona rodzaju, kto, o czym, kiedy (względnie).
Filtr po rodzaju. Nieodebrane wyróżnione — **ale bez systemowej czerwieni**
(reguła marki, patrz `apka-jezyk-wizualny`); użyj `.ciemnaCzerwien`, tak jak
wylogowanie. Wejście w wiersz prowadzi do maila / leada / klienta.

Miejsce w belce: **„Więcej"**, chyba że właściciel powie inaczej. Belka jest
pełna (Pulpit · Poczta · Leady · Projekty · Więcej) i szósta zakładka włącza
brzydkie systemowe „More" — nie dokładaj jej bez rozmowy.

---

## Część B: Kalendarz

Poziom 1 w inwentarzu, trasy gotowe i opisane:

- `GET /api/events?month=YYYY-MM` — ręczne wydarzenia (dopasowanie po
  **nakładaniu się** zakresu z miesiącem, nie po samej dacie startu),
- `POST/PATCH/DELETE /api/events` — pełny CRUD,
- `GET /api/events/deadlines?month=` — **wyliczone** terminy z innych modułów
  (faktury, projekty, kamienie, przypomnienia o leadach i klientach, telefony,
  maile). Wyłącznie do odczytu: kalendarz ich nie tworzy ani nie kasuje.

### Na czym łatwo się przewrócić

1. **Dwa strumienie, nie jeden.** Wydarzenia są edytowalne, deadline'y nie.
   Zlanie ich w jedną listę skończy się próbą skasowania terminu faktury
   z poziomu kalendarza. Rozróżniaj wizualnie.
2. **`godzina: null` = całodniowe**, a `czas_trwania_min` ma sens tylko
   z godziną (siatka bez niego zakłada 60 min).
3. **`data_koniec` jest WŁĄCZNIE** i nie może być przed `data` (serwer da 400).
4. **Quick-add** („jutro 14:00 call") panel parsuje **deterministycznie po
   stronie klienta** (`parseQuickAdd()` w `lib/events.ts`) — świadomie bez AI.
   Jeśli przenosisz go do apki, przenieś **regułę**, nie pomysł: odtwórz tę
   funkcję w rdzeniu, tak jak `Snooze.opcje()` i `RytmPrzypomnien`.
5. **Każde nowe pole daty** musi iść przez walidację i wyświetlać się przez
   `Daty.poPolsku` — nigdy surowy ISO (`CLAUDE.md`, `<input type="date">`).

### Zakres na telefon

Miesiąc + lista dnia, dodawanie wydarzenia, podgląd deadline'ów. Siatka
tygodniowa i przeciąganie wydarzeń to praca przy biurku — nie wciskaj ich.

---

## Jak pracować (to samo, co się sprawdziło)

- Buduj i **oglądaj sam w symulatorze**: `xcodegen generate` → `xcodebuild` →
  `simctl install/launch` → `simctl io <dev> screenshot`.
- **Furtki DEBUG przekazuje się przez `SIMCTL_CHILD_*`**, nie flagą `--env`
  (README apki). Dołóż własne dla nowych ekranów — bez nich ich nie zobaczysz.
- **Trasy zapisu sprawdzaj curlem** w dokładnie tym kształcie, którego używa
  apka.
- `LeggeraHubCore` **nie importuje SwiftUI ani UIKit**.
- Reguły wyglądu: jeden akcent na ekran, prawdziwy Liquid Glass, gradient
  wyłącznie na ikonach, tekst biały, bez systemowej czerwieni.

## Lekcja z Fazy 5, którą warto mieć z tyłu głowy

**Kod, który wygląda poprawnie, potrafi nie robić nic.** Przypomnienia stopera
były „zaplanowane" i zgłaszały zero błędów, a kolejka iOS-a była pusta —
asynchroniczne kasowanie zjadało wpisy dodane chwilę później. Wyszło to
wyłącznie dlatego, że odczytałem **prawdziwy stan systemu**, zamiast ufać temu,
że wywołałem właściwą funkcję. Przy każdej rzeczy, która „dzieje się w tle"
(powiadomienia, synchronizacja, kolejki), zaplanuj sobie sposób obejrzenia
efektu, zanim uznasz ją za zrobioną.

---

## Prompt otwierający kolejny czat

```
Kontynuujemy aplikację natywną Leggera Hub. Przeczytaj
docs/natywna-aplikacja/00-plan.md oraz
docs/natywna-aplikacja/03-brief-rejestr-kalendarz.md, potem zrób
Część A (rejestr wiadomości i rozmów) i Część B (Kalendarz).
Repo apki: /Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios.
```
