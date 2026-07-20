# Brief: Umowy i NDA w aplikacji (Faza 14)

> Brief wdrożeniowy pod **jeden osobny czat**. Zaczynasz od `00-plan.md`,
> potem ten plik. Repo apki: `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`.
> Panel: `/Volumes/OWC_SN850X/projekty_ai/poltechnickx-website`.
> Źródło ustaleń: `08-wynik-audytu-apki.md`, sekcje A5 i B4.
> Inwentarz API: `inwentarz/03-finanse.md`, sekcja „Umowy i NDA".

## Dlaczego teraz

To nie jest pomysł na później — to **luka, którą apka sama sygnalizuje i nie
daje z niej wyjścia**:

- Pulpit pokazuje sekcję „**Umowy bez odpowiedzi**" (`PulpitView.swift:273-283`,
  dane ze `staleContracts` w `/api/hub/today`) — i ta sekcja jest
  **NIEKLIKALNA**.
- Apka **nie woła `/api/contracts` ANI RAZU**, choć panel ma pełny moduł
  (`app/[lang]/admin/contracts/`, `app/api/contracts`, `/[id]`, `/[id]/send`,
  `/[id]/accept`, `contracts/public/[token]/accept`, `lib/contracts.ts`).
- Do tego **bramka umowy zwraca 409** i blokuje zmianę statusu projektu
  (`APIClient.swift:1292`). Czyli apka mówi „nie możesz, bo brakuje umowy" —
  i nie pozwala tej umowy wysłać. Sygnał bez akcji.
- `PulpitUmowa.status` (`Models/Pulpit.swift:92`) jest już **dekodowane
  i nieużywane** — czeka gotowe.

Inwentarz (`03-finanse.md`) ma Umowy na **poziomie 2** od Fazy 1, ale nigdy nie
doczekały się własnej fazy budowy.

## Decyzja właściciela — ROZSTRZYGNIĘTA

**Umowy w apce: TAK, budujemy.**

Rozstrzygnięty jest też **zakres samej bramki umowy** (decyzja 2026-07-17,
w pamięci projektu): twarda bramka zostaje, ale **tylko dla projektów z
`client_id`** — projekty wewnętrzne są wolne. Nie zmieniać tego przy okazji.

## PYTANIE DO WŁAŚCICIELA — zadaj je NA POCZĄTKU SESJI, po polsku

**Czy apka ma umieć TWORZYĆ umowę, czy tylko podglądać i wysyłać istniejącą?**

Inwentarz `03-finanse.md` odpowiada „tylko podgląd i wysyłka" — i na tym
oprzyj domyślny zakres, dopóki właściciel nie powie inaczej. Poziomy z
inwentarza:

| Trasa | Poziom |
|---|---|
| `GET /api/contracts` (lista umów + NDA) | **2** |
| `GET /api/contracts/[id]` (dokument) | **2** |
| `POST /api/contracts/[id]/send` (wyślij link do podpisu) | **2** |
| `POST /api/contracts/[id]/accept` (oznacz jako podpisaną) | **2** |
| `POST /api/contracts` (nowa umowa z oferty / NDA z leada) | 3 |
| `PATCH` / `DELETE /api/contracts/[id]` | 3 |

Poziom 3 = świadomie odłożone. Jeśli właściciel powie „chcę też tworzyć",
tworzenie z **zaakceptowanej oferty** jest najprostsze (serwer robi całą
robotę: kopiuje dane klienta, `zakres_prac` z pozycji, `cena` = suma pozycji;
przy istniejącej umowie zwraca jej id bez duplikatu) — ale to poszerza zakres
i szacunek pracy.

## Zakres (domyślny, poziom 2)

1. **Lista Umów** — nowy ekran (najpewniej w „Więcej", jak Faktury/Oferty
   z Fazy 10). Umowy i NDA w jednej liście, rozróżnione typem.
2. **Profil dokumentu** — dane klienta, zakres prac, cena/waluta, termin,
   status, referencja (`UM-2026-XXXXXX` / `NDA-2026-XXXXXX`), plus nota
   „SZABLON — WYMAGA WERYFIKACJI PRAWNEJ", którą nosi każdy dokument.
3. **Akcje**: „Wyślij do podpisu" (`/[id]/send`) i „Oznacz jako podpisaną"
   (`/[id]/accept`) — obie z potwierdzeniem, obie mają jasno komunikować
   wynik.
4. **Uklikalnienie sekcji na Pulpicie** — „Umowy bez odpowiedzi" prowadzi do
   profilu dokumentu. To zamyka lukę A5. `PulpitUmowa.status` już czeka.
5. **Wyjście z bramki 409** — komunikat odmowy przy zmianie statusu projektu
   ma prowadzić do umowy tego projektu (albo do listy Umów), zamiast być
   ślepym „nie możesz".

## Reguły serwera, które apka musi respektować

- **`CONTRACT_STALE_DAYS = 7`** — dokument w statusie „Wysłana" z `sent_at`
  starszym niż 7 dni jest „wiszący". Dni ciszy = `floor((now − sent_at)/24h)`.
  To ta sama reguła, którą Pulpit już pokazuje — **nie licz jej drugi raz
  po swojemu**, chyba że świadomie i identycznie (patrz A6 audytu: rozjazdy
  reguł to udokumentowany dług tego projektu).
- **`ContractStatus`**: `"Szkic" | "Wysłana" | "Podpisana" | "Odrzucona"`.
- `POST /[id]/send` zwraca **400 przy braku `klient_email`** — apka ma to
  powiedzieć wprost, nie jako błąd sieci.
- `POST /[id]/accept` zwraca **409, gdy już podpisana**.
- `sent_at` jest ustawiany przy KAŻDEJ wysyłce (restart licznika ciszy) —
  ponowna wysyłka jest legalna i celowa.
- **`cena` w `GET /api/contracts` może przyjść jako string `NUMERIC`** —
  apka ma już wzorzec defensywnego dekodowania we wszystkich modelach
  finansowych (audyt potwierdził, że jest konsekwentny). Użyj go.
- Podpis przez publiczny link **dzwoni w Centrum powiadomień** (może paść
  w nocy) — apka pokazuje to już przez powiadomienia, nic tu nie dobudowuj.

## Ryzyka

- **Zakres może się rozjechać**, jeśli pytanie wyżej zostanie zadane dopiero
  w połowie pracy. Zadaj je pierwsze.
- **Rozjazd reguły 7 dni** między Pulpitem (serwer) a nowym ekranem (Swift) —
  cichy i mylący. Bezpieczniej pokazywać liczbę dni ciszy z tego samego
  źródła, co Pulpit.
- **Treść klauzul jest stała i tylko po polsku** — apka nie renderuje treści
  umowy; do przeczytania pełnego dokumentu służy publiczny link
  `/pl/umowa/<token>` (podgląd tego linku był poprawiany pod szerokość
  telefonu, commit `b218ba1`). Nie budować własnego renderera klauzul.
- **Wysyłka maila to akcja nieodwracalna z telefonu** — potwierdzenie
  obowiązkowe (wzorzec z reszty apki; wyjątek `KalendarzView` jest w audycie
  odnotowany jako błąd, nie precedens).

## Szacunek pracy

**Jedna sesja** przy zakresie poziomu 2 (lista + profil + dwie akcje +
uklikalnienie Pulpitu + wyjście z bramki). Serwer jest w całości gotowy —
praca jest po stronie Swifta: model `Contract`, ~4 funkcje w `APIClient`,
dwa widoki.

Dołożenie tworzenia umowy (poziom 3) to **+pół sesji** i wymaga picker'a
zaakceptowanych ofert / leadów.

## Jak pracować

- **Zielony build nie jest dowodem.** Zrzuty: lista, profil, stan po wysyłce,
  stan „brak e-maila klienta", ścieżka z Pulpitu.
- **Sprawdzaj, czy coś WOŁA kod, nie czy kod istnieje.** Ten moduł powstaje
  dokładnie dlatego, że pole `PulpitUmowa.status` istniało i nikt go nie
  czytał, a sekcja Pulpitu istniała i nie dało się w nią kliknąć. Nie dołóż
  szóstego przypadku.
- Sprawdź trasy **curlem** zanim zbudujesz widok — inwentarz może być
  nieaktualny (dokumentacja w tym projekcie kłamała już kilka razy).

## Wynik

Apka ma ekran Umów/NDA z podglądem i dwiema akcjami, sekcja „Umowy bez
odpowiedzi" na Pulpicie jest klikalna, a odmowa 409 przy zmianie statusu
projektu prowadzi do konkretnej umowy. Luka A5 zamknięta. Plus notka
w `00-plan.md`, czego nie zweryfikowano dotykiem (co najmniej: realna wysyłka
maila do drugiej strony).

## Prompt otwierający kolejny czat

```
Kontynuujemy aplikację natywną Leggera Hub. Przeczytaj
docs/natywna-aplikacja/00-plan.md, potem
docs/natywna-aplikacja/11-brief-umowy-w-apce.md (kontekst:
08-wynik-audytu-apki.md sekcje A5/B4 oraz inwentarz/03-finanse.md,
sekcja „Umowy i NDA"), i zbuduj Umowy w apce. NAJPIERW zadaj
właścicielowi pytanie z briefu o zakres (tworzenie vs. tylko podgląd
i wysyłka). Repo apki: /Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios,
panel: /Volumes/OWC_SN850X/projekty_ai/poltechnickx-website.
```
