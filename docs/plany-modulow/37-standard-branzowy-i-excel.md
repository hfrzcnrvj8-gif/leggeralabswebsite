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
jest niżej w skrócie. Nie zlecaj go drugi raz — zweryfikuj tylko, czy pozycje
oznaczone jako otwarte nadal są otwarte (część naprawiono tego samego dnia).

### Wynik audytu wizualnego apki — stan na 2026-07-20

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

### Rekomendacja: eksport, NIE integracja dwukierunkowa

Uzasadnienie, nie preferencja: dwukierunkowa synchronizacja z arkuszem tworzy
**trzecie miejsce, w którym te same dane mogą się rozjechać** (baza, panel,
arkusz), a rozjazd wychodzi zwykle przy fakturze. Księgowa i tak prosi o plik,
nie o dostęp do arkusza.

**Do rozstrzygnięcia z właścicielem w nowym czacie:**

1. Co konkretnie ma wychodzić do pliku: faktury? koszty? czas pracy (do
   rozliczeń z klientem)? leady? wszystko?
2. Format: `.xlsx` czy `.csv`? (CSV jest trywialny i otwiera się w Excelu;
   XLSX wymaga biblioteki, ale trzyma formatowanie i typy liczb/dat).
3. Gdzie ma być przycisk: panel, apka, oba? **Uwaga:** na iOS plik trzeba
   oddać przez arkusz udostępniania — to inna praca niż `<a download>`
   w panelu.
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
- **Dług A1 (jedno pole błędu na 12 modułów) jest najpilniejszy** i to nie jest
  teoria: 2026-07-20 apka przestała pobierać dane, a właściciel zobaczył
  wyłącznie „0 — nic nie czeka" i puste listy. Diagnoza stanęła, dopóki nie
  dołożono treści błędu z kodem systemowym. Rozbicie `bladLeadow` na pole per
  moduł to osobna paczka, ale powinna iść przed nowymi funkcjami.

## Jak pracować

- Zacznij od `docs/natywna-aplikacja/00-plan.md` i `CLAUDE.md`, potem ten plik.
- **Zielony build nie jest dowodem** — uruchom w symulatorze i obejrzyj.
- Część A to w dużej mierze praca mechaniczna (podmiana tokenów) — nadaje się
  do zrobienia hurtem, ale **po każdej paczce build i zrzut**.
- Część B zacznij od czterech pytań wyżej. Nie buduj eksportu, zanim nie
  wiadomo czego.

## Prompt otwierający kolejny czat

```
Przeczytaj docs/plany-modulow/37-standard-branzowy-i-excel.md, potem
CLAUDE.md i docs/natywna-aplikacja/00-plan.md. Chcę porozmawiać o dwóch
rzeczach: (1) czy Leggera Hub dorównuje przejrzystością Linearowi i Notion
i co konkretnie zrobić, żeby dorównywał, (2) czy i jaki eksport do Excela
ma sens. Najpierw zadaj mi pytania z Części B briefu, potem zaproponuj plan.
```
