# Brief: standard branżowy (Linear/Notion) + eksport do Excela

> Brief wdrożeniowy pod **jeden osobny czat**. Dotyczy **panelu i aplikacji
> natywnej naraz** — to jedyny brief w tym folderze, który świadomie obejmuje
> obie powierzchnie. Repo apki: `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`.
>
> Powstał 2026-07-20 na pytanie właściciela zadane wprost: *„czy nasza
> aplikacja dorównuje Linearowi i Notion funkcjonalnością i przejrzystością?
> czy integracja z Excelem byłaby potrzebna, niezależnie od platformy?"*

## Dlaczego osobny czat

Pytanie padło pod koniec sesji poświęconej Dynamic Island, w której zdążyły
się wydarzyć trzy błędne diagnozy i kilkanaście buildów. To pytanie o **kierunek
produktu**, nie o kod — zasługuje na czat, który zaczyna od przejrzenia obu
powierzchni, a nie dopisuje się do naprawiania przycisku.

## Część A — parytet z Linear/Notion

### Czego NIE trzeba robić od nowa

**Audyt spójności wizualnej apki iOS został zrobiony 2026-07-20** i jego wynik
jest niżej w skrócie. Nie zlecaj go drugi raz.

### ⚠️ Aktualizacja 2026-07-22 — sprawdzone gretem, nie z pamięci

Między spisaniem tego briefu a jego wykonaniem weszło **38 commitów apki**.
Poniższa lista otwartych pozycji była wtedy prawdziwa; dziś część już nie jest,
a jedna urosła. Stan zweryfikowany 2026-07-22 przed otwarciem czatu:

| Pozycja z audytu | Stan na 2026-07-22 |
|---|---|
| **Dług A1** (jedno pole błędu na 12 modułów) | ✅ **ZROBIONY 2026-07-21.** `Komunikaty.swift` → enum `Zasob`, każdy ekran pyta o SWOJE pobranie. Brief niżej nazywa go „najpilniejszym" — **to już nieaktualne, nie zaczynaj od niego.** |
| 1. Odznaka-kapsułka od zera | ⚠️ **OTWARTE, urosło.** 33 użycia `Capsule()` w 12+ plikach poza `Marka.swift`; `StatusPillTekst` używany tylko w Ofertach i Umowach. Wspólnej `Odznaka(tekst:)` nadal nie ma. |
| 2. `WierszDanych` dwa razy | ⚠️ **OTWARTE, w gorszej formie.** Te same struktury mają dziś ODWRÓCONE nazwy w dwóch plikach: `KontaktWiersz`/`PoleWiersz` (`LeadDetailView:328`, `:358`) vs `WierszKontaktu`/`WierszPola` (`KlientDetailView:291`, `:315`). Grep po nazwie ich nie zestawi. |
| 3. Pięć nieoficjalnych stylów przycisku | ⚠️ OTWARTE. Oficjalne to `PrzyciskGlowny`, `PrzyciskPoboczny`, `PrzyciskStop` (`Marka.swift:56/75/113`). |
| 4. Cztery promienie kart | ⚠️ OTWARTE, jest ich **pięć**: 8, 12, 16, 20, 22. Żaden nie jest stałą — w `Marka.swift`/`Theme.swift` nie ma nazwy dla promienia. |
| 5. `.font(.system(size:))` w 11 miejscach | ⚠️ **OTWARTE, podwoiło się do 22.** Nowe ekrany (Kalendarz 4-poziomowy, Przypomnienia, Zaproszenia) dołożyły swoje. To jest dowód, że bez tokenu dług rośnie liniowo z liczbą ekranów. |
| 6. Log aktywności w dwóch wariantach | ⚠️ OTWARTE. `LogWiersz` (`LeadDetailView:376`) vs `ListaZmian` (`KlientDetailView:241`). |

**Powierzchnie, których audyt z 2026-07-20 NIE WIDZIAŁ** — powstały później
i nie były oglądane pod kątem spójności ani razu:

- **Przypomnienia** (moduł + trzeci strumień w Kalendarzu, 2026-07-22),
- **Kalendarz na czterech poziomach** (rok/miesiąc/tydzień/dzień) z rozpiską
  godzinową i nawigacją gestem,
- **Zaproszenia na spotkanie** (lista uczestników, odpowiedzi, odwołanie),
- **Powtarzanie** (sekcja formularza, plakietki serii, dialog „ta okazja czy
  cała seria") — 2026-07-22.

Te cztery obejrzyj **jako pierwsze**: są najświeższe, więc najpewniej odtwarzają
doktrynę z pamięci zamiast z tokenów — dokładnie ten mechanizm, który audyt
opisał jako źródło wrażenia „doklejania".

### Wynik audytu wizualnego apki — stan na 2026-07-20 (historyczny)

**Fundament jest lepszy, niż sugeruje zgłoszenie właściciela.** `Marka.swift`
ma spisaną doktrynę („jeden akcent na ekran", „czerwień znika", status = kropka
+ tekst). Problem: **doktryna nie jest egzekwowana w kodzie** — brakowało
tokenów i wspólnych widoków, więc każdy ekran odtwarzał ją z pamięci i za
każdym razem trochę inaczej. Stąd wrażenie „doklejania".

Naprawione w tej samej sesji:

- tokeny semantyczne `Znaczenie.uwaga/blad/sukces/wToku` (`Theme.swift`)
  i podmiana ~25 wystąpień surowych `.green` / `.red` / `.orange`;
- `Color.markaZielen` — stonowana zieleń „zamknięte dobrze" zamiast jaskrawej
  systemowej (ten sam błąd naprawiono wcześniej przy czerwieni, przy zieleni
  nikt go nie zauważył);
- `Font.tytulWiersza` / `podpisWiersza` i podmiana w 14 miejscach — ta sama
  rola wiersza listy miała trzy różne rozmiary czcionki;
- `monospacedDigit()` na liczniku Pulpitu (46 pt, podskakiwał przy każdej
  zmianie) i wspólny `LicznikCzasu` zamiast trzech kopii stopera.

**Otwarte, świadomie nietknięte** (uporządkowane wg zwrotu z pracy):

1. **Odznaka-kapsułka budowana od zera w 6 plikach** — `PocztaListView:284`
   i `:488`, `WiadomoscView:290`, `SubskrypcjeView:42`, `ZaplanowaneView:44`,
   `KlientDetailView:132` (padding 6/2 zamiast 7/2 — odstaje),
   `ZalacznikiSekcja:67` (inny kształt). Do tego istnieje już `StatusPillTekst`
   (`Marka.swift:121`) robiący prawie to samo → **dwa niezależne języki
   plakietki, wybierane losowo**. Poprawka: jeden `Odznaka(tekst:)`.
2. **`WierszDanych` istnieje dwa razy znak w znak** — `LeadDetailView:325`
   i `KlientDetailView:238`. Tak samo `Label("Wymaga działania dziś")`
   (`LeadDetailView:95`, `KlientDetailView:39`).
3. **Pięć nieoficjalnych stylów przycisku** obok dwóch oficjalnych —
   `RejestrView:148` (padding 11/6), `WiadomoscView:755`, `:786`, `:722`.
   Do tego `PrzyciskGlowny` (padding 12) i `PrzyciskPoboczny` (11) różnią się
   o 1 pt bez powodu i stojąc obok siebie nie mają równej wysokości
   (`LeadDetailView:220-252`).
4. **Cztery promienie kart, żaden nie jest stałą** — 12 / 16 / 20 / 22.
   Karta Pulpitu i karta Poczty to ten sam obiekt z różnicą 2 pt.
5. **Hardkodowane `.font(.system(size:))` w 11 miejscach** — wyłamują się
   z Dynamic Type. Uzasadnione są dwa (licznik-bohater, proporcja znaku).
6. **Wiersz logu aktywności w dwóch wariantach** — historia kontaktu wygląda
   inaczej zależnie od tego, czy wejdziesz przez leada czy przez klienta.

### Co realnie porównać z Linear/Notion

Nie porównuj „funkcji do funkcji" — Leggera Hub jest świadomie mniejszym
produktem dla jednej osoby (bez zespołów, uprawnień, integracji z Gitem).
Porównuj **przejrzystość i przewidywalność**:

- **Jedna rzecz = jedno miejsce.** Linear nigdy nie pokazuje tej samej liczby
  dwa razy na ekranie. W apce znaleziono to przy stoperze (przycisk „Zatrzymaj
  — 0:30" i pasek „0:30" dwa centymetry niżej) — poprawione, ale poszukaj
  innych wystąpień.
- **Kolor niesie znaczenie albo go nie ma.** Patrz punkt o czterech kolorach
  dla „coś jest nie tak".
- **Pusty stan mówi prawdę.** Znaleziony przykład: Pulpit przy padniętym
  pobieraniu pokazywał „0 — nic nie czeka", identycznie jak przy realnie pustym
  dniu. Zero ma znaczyć zero, nie „nie wiem". Poprawione na Pulpicie —
  **sprawdź pozostałe listy**.
- **Błąd ma się gdzie pokazać.** Dług A1 z audytu Fazy 11½: jedno pole
  `bladLeadow` na 12 modułów, renderowane w JEDNYM miejscu
  (`LeadsListView.swift:20`). Wybuchło realnie 2026-07-20 — patrz niżej.

## Część B — Excel

### ⚠️ ZANIM ZADASZ PYTANIA: eksport CSV JUŻ ISTNIEJE

Sprawdzone gretem 2026-07-22. Brief w pierwotnej wersji pytał „co ma wychodzić
do pliku" tak, jakby nie było nic — a w panelu stoją **trzy gotowe trasy**
z przyciskami:

| Trasa | Co daje | Gdzie przycisk |
|---|---|---|
| `GET /api/leads/export` | cały rejestr leadów; `?ids=` zawęża do zaznaczonych (Moduł 34) | `LeadsDashboard.tsx` |
| `GET /api/invoices/export?from&to` | rejestr sprzedaży dla księgowej, sumy netto/VAT/brutto per dokument, z rabatami; pomija szkice; domyślnie bieżący miesiąc | `InvoicesDashboard.tsx` |
| `GET /api/costs/export?from&to` | rejestr zakupów wg daty wydatku; domyślnie bieżący miesiąc | `CostsDashboard.tsx` |

**Czego NIE ma:**
- eksportu w **apce** — `APIClient.swift` nie woła żadnej z tych tras
  (świadome pominięcie z Fazy 13.1, paczka 3),
- formatu **XLSX** — wszystko wychodzi jako CSV,
- eksportu **czasu pracy** (stoper/`work_sessions`), projektów, klientów,
  wydarzeń i przypomnień.

**Nie zaczynaj więc od „czy eksport ma sens".** Zacznij od pokazania
właścicielowi, co już dostaje, i zapytaj, czego mu w TYM brakuje. Pytania
niżej są nadal dobre, ale zadaj je w tym kontekście — inaczej zamówi coś,
co ma od miesiąca.

### Rekomendacja: eksport, NIE integracja dwukierunkowa

Uzasadnienie, nie preferencja: dwukierunkowa synchronizacja z arkuszem tworzy
**trzecie miejsce, w którym te same dane mogą się rozjechać** (baza, panel,
arkusz), a rozjazd wychodzi zwykle przy fakturze. Księgowa i tak prosi o plik,
nie o dostęp do arkusza.

**Do rozstrzygnięcia z właścicielem w nowym czacie** (przeformułowane
2026-07-22 pod stan faktyczny — patrz tabela wyżej):

1. **Czy dzisiejsze trzy CSV-ki wystarczają treścią?** Czego brakuje księgowej
   w rejestrze sprzedaży/zakupów? Czy potrzebny jest eksport czasu pracy do
   rozliczeń z klientem (dziś go nie ma, a stoper zbiera dane)?
2. **CSV czy XLSX?** CSV jest i działa. XLSX wymaga biblioteki, ale trzyma typy
   liczb/dat i formatowanie — pytanie brzmi, czy Excel psuje dziś coś przy
   otwieraniu tych plików (polskie znaki, daty, kwoty z przecinkiem), bo to
   jedyny realny powód, żeby zmieniać format.
3. **Czy eksport ma być też w apce?** Dziś nie ma. **Uwaga:** na iOS plik
   oddaje się przez arkusz udostępniania — to inna praca niż `<a download>`.
   Zapytaj wprost, czy właściciel kiedykolwiek eksportowałby z telefonu.
4. Czy potrzebny jest **import** (np. lista kosztów z arkusza banku), bo to
   zupełnie inny zakres niż eksport.

### Czego NIE proponować

Integracji z Google Sheets ani API Microsoftu — to logowanie OAuth, zgody
i utrzymanie tokenów dla jednoosobowej działalności, która potrzebuje pliku
raz w miesiącu.

## Kontekst techniczny, który oszczędzi czasu

- **Setnych sekundy nie da się pokazać w Live Activity ani w widżecie.** System
  rysuje odczyt sam (`Text(timerInterval:)`) i odświeża go najwyżej raz na
  sekundę, a na ekranie blokady po kilku minutach rzadziej. Zegar Apple'a robi
  to inaczej, bo jest aplikacją systemową. Wewnątrz apki setne działają
  (`Stoper.licznikSetne`, `TimelineView(.animation)`).
- ~~**Dług A1 jest najpilniejszy**~~ — **NIEAKTUALNE od 2026-07-21.** Rozbicie
  zrobione: `Komunikaty.swift` → enum `Zasob`, każdy ekran pyta o swoje
  pobranie. Historia, dla kontekstu: 2026-07-20 apka przestała pobierać dane,
  a właściciel zobaczył wyłącznie „0 — nic nie czeka" i puste listy, bo szesnaście
  z dwudziestu ekranów nie czytało jedynego pola błędu.
- **Stan bazy: panel i apka są funkcjonalnie domknięte.** Z 43 modułów w tym
  folderze otwarte są dwa: ten (37) i Moduł 16 („wsparcie posprzedażowe —
  dopiero gdy będzie realna potrzeba"). Moduł 5 (PWA) jest martwy: 2026-07-19
  właściciel porzucił PWA na rzecz apki natywnej. Nie sugeruj się jego statusem
  🚧 w `README.md`.
- **„Produkcyjna apka" nie jest zablokowana funkcjami**, tylko dwiema rzeczami,
  których żaden moduł nie ruszy: **darmowe konto Apple** (build wygasa na
  telefonie po 7 dniach, brak dystrybucji) i **plan Hobby na Vercelu** (użytek
  komercyjny łamie warunki, limit dwóch cronów wyczerpany — `vercel.json`).
  Oba czekają na rejestrację działalności, patrz `PO_REJESTRACJI.md`. Nie
  obiecuj właścicielowi, że ten moduł czyni apkę produkcyjną.

## Jak pracować

- **Sprawdź gretem, zanim uwierzysz temu plikowi.** Aktualizacja z 2026-07-22
  znalazła w nim trzy nieprawdy naraz: dług A1 opisany jako „najpilniejszy" był
  już zrobiony, jeden punkt urósł dwukrotnie zamiast zmaleć, a Część B pytała
  o eksport, który stoi w panelu od miesiąca. To nie jest wada tego briefu —
  tak działa każdy dokument w tym repo starszy niż kilka dni. Ta sama lekcja
  co przy `claude-md-klamal-o-ikonach`: **nieaktualna dokumentacja rozkazuje,
  zamiast informować.**
- Zacznij od `docs/natywna-aplikacja/00-plan.md` i `CLAUDE.md`, potem ten plik.
- **Zielony build nie jest dowodem** — uruchom w symulatorze i obejrzyj.
- Część A to w dużej mierze praca mechaniczna (podmiana tokenów) — nadaje się
  do zrobienia hurtem, ale **po każdej paczce build i zrzut**.
- Część B zacznij od czterech pytań wyżej. Nie buduj eksportu, zanim nie
  wiadomo czego.

## Prompt otwierający kolejny czat

```
Przeczytaj docs/plany-modulow/37-standard-branzowy-i-excel.md (zacznij od
sekcji „Aktualizacja 2026-07-22" i od tabeli w Części B — reszta pliku jest
starsza i miejscami nieprawdziwa), potem CLAUDE.md i
docs/natywna-aplikacja/00-plan.md.

Chcę dwóch rzeczy: (1) żeby apka i panel były spójne wizualnie jak Linear
albo Notion — zacznij od czterech ekranów, których audyt z 20.07 nie widział
(Przypomnienia, Kalendarz 4-poziomowy, Zaproszenia, Powtarzanie), obejrzyj
je na żywo i pokaż mi, gdzie odstają; (2) pokaż mi najpierw, co dzisiejszy
eksport CSV realnie daje, a dopiero potem zapytaj, czego mi w nim brakuje.

Zanim cokolwiek napiszesz — sprawdź w kodzie, czy pozycje z briefu nadal są
otwarte. Ten plik już raz kłamał.
```
