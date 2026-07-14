# Mapa drogi klienta — od leada do stałej relacji (wzorzec pracy solo-konsultanta)

> Ten plik to **dokument nadrzędny** nad resztą `docs/plany-modulow/` — mapuje
> pełną, wzorcową drogę klienta przez firmę i pokazuje, który moduł panelu
> (istniejący albo jeszcze niezbudowany) odpowiada za który etap. Powstał
> 2026-07-14 na wyraźną prośbę właściciela: "wypracować raz wzorzec, który
> jest najlepszy, i według niego pracować, a aplikacja ma to monitorować i
> pomagać, gdybym zbaczał z toru". Właściciel jest początkującym
> przedsiębiorcą — to też ma być **jego podręcznik dobrych praktyk**, nie
> tylko specyfikacja techniczna.
>
> Przed startem NOWEGO modułu z tego pliku: przeczytaj `README.md` (zasady
> wspólne) i `CLAUDE.md`, potem sekcję dotyczącą tego etapu poniżej.

## Jak czytać ten dokument

Ten plik ma dwie warstwy:
1. **Docelowy przepływ pracy** (sekcja zaraz poniżej) — gotowa instrukcja
   "co robić krok po kroku", zakładająca, że WSZYSTKO z tej mapy jest już
   zbudowane. To jest odpowiedź na pytanie "jak mam pracować".
2. **Etapy ze szczegółami i uzasadnieniem** (dalej w pliku) — dla każdego
   etapu: co się dzieje, dobre praktyki branżowe, stan modułu w panelu
   (✅ gotowe / 🔧 do rozbudowy / 🆕 do zbudowania), jak to monitorować.
   To jest odpowiedź na pytanie "dlaczego akurat tak" i "co jeszcze trzeba
   zbudować, żeby przepływ z punktu 1 rzeczywiście działał".

---

## Docelowy przepływ pracy — krok po kroku (stan PO wdrożeniu wszystkiego)

> Zakłada pełne wdrożenie mapy: Umowy, fundament linkowania, rozbudowaną
> windykację, Onboarding, Zamknięcie+opinie, Wsparcie, Retencję, NDA,
> widoczność źródeł i rezerwę podatkową. Dopóki dany element nie jest
> zbudowany (patrz 🆕/🔧 w etapach niżej), ten krok robisz dziś ręcznie,
> poza aplikacją — panel Cię tego jeszcze nie pilnuje.

### Krok 0 — Pierwszy kontakt / rozmowa odkrywcza
**Robisz**: odbierasz zgłoszenie (formularz/telefon/polecenie), zakładasz
lead w panelu (albo panel go zakłada sam, jeśli przyszedł z formularza na
stronie). Jeśli w rozmowie kwalifikacyjnej trzeba będzie omawiać
wewnętrzne systemy/dane klienta, zanim cokolwiek podpiszecie — wysyłasz
NDA do podpisu PRZED tą rozmową, nie po.
**Panel robi za Ciebie**: zapisuje źródło leada, podpowiada pytania
kwalifikacyjne wg statusu, pilnuje terminu Twojej odpowiedzi (nurture).
**Gotowe do przejścia dalej, gdy**: masz odpowiedź na kluczowe pytania
(budżet / decydent / potrzeba / termin) i — jeśli dotyczy — podpisane NDA.

### Krok 1 — Kwalifikacja leada
**Robisz**: decydujesz: pasuje / nie pasuje. Jeśli nie — zamykasz lead
kulturalnie i szybko (panel podpowiada gotowy szablon odmowy). Jeśli tak —
przechodzisz do wyceny.
**Panel robi za Ciebie**: pilnuje, żeby żaden lead nie "zawisł" bez
decyzji (przypomnienia), pokazuje na Pulpicie, ile leadów czeka.
**Gotowe do przejścia dalej, gdy**: status leada = "kwalifikowany"/gotowy
do oferty.

### Krok 2 — Oferta
**Robisz**: zaczynasz od pasującego szablonu (jeśli masz), dopasowujesz
zakres i cenę, wysyłasz.
**Panel robi za Ciebie**: generuje link do publicznej oferty z terminem
ważności, pilnuje braku odpowiedzi, zapisuje e-podpis klienta przy
akceptacji (IP + user-agent + imię), **automatycznie zakłada Klienta**
jeśli jeszcze nie istnieje.
**Gotowe do przejścia dalej, gdy**: oferta zaakceptowana (masz e-podpis)
albo świadomie odrzucona/wygasła (wtedy droga się kończy tutaj, lead
wraca do nurture na "spróbuj później").

### Krok 3 — Umowa
**Robisz**: sprawdzasz wygenerowany z oferty projekt umowy (zakres,
wyłączenia, zasady zmiany zakresu, reklamacje, własność efektów pracy),
wysyłasz do podpisu.
**Panel robi za Ciebie**: kopiuje zakres/cenę z zaakceptowanej oferty do
szablonu umowy, pilnuje e-podpisu tym samym mechanizmem co oferta.
**Gotowe do przejścia dalej, gdy**: umowa podpisana przez obie strony —
**to jest formalny start projektu, nie wcześniej**.

### Krok 4 — Onboarding
**Robisz**: wysyłasz wiadomość powitalną (kontakt, częstotliwość
statusów, co dalej), zbierasz od klienta to, czego potrzebujesz do startu
(dostępy, materiały, dane kontaktowe do decydenta).
**Panel robi za Ciebie**: pokazuje checklistę onboardingową przy nowym
projekcie, pilnuje braków przed pierwszym dniem realizacji.
**Gotowe do przejścia dalej, gdy**: checklista onboardingowa domknięta —
masz wszystko, czego potrzebujesz, żeby zacząć pracę.

### Krok 5 — Realizacja
**Robisz**: pracujesz wg kamieni milowych, notujesz czas poświęcony (choćby
raz dziennie/tygodniowo, nie co do minuty), aktualizujesz status "zdrowia"
projektu (Na dobrej drodze / Zagrożony / Zerwany), informujesz klienta w
ustalonym rytmie. Prośba spoza umówionego zakresu → osobna wycena/aneks,
nie ciche wciąganie w budżet czasu.
**Panel robi za Ciebie**: pilnuje terminów kamieni, pokazuje status
zdrowia na Pulpicie, liczy efektywną stawkę godzinową (cena ÷ zalogowany
czas), żebyś widział z lotu ptaka, które projekty wymagają uwagi i które
typy zleceń faktycznie się opłacają.
**Gotowe do przejścia dalej, gdy**: kamień/cały zakres ukończony i
(najlepiej) formalnie potwierdzony przez klienta.

### Krok 6 — Fakturowanie
**Robisz**: wystawiasz fakturę od razu po ukończeniu etapu/projektu (nie
"kiedyś później").
**Panel robi za Ciebie**: generuje szkic faktury z danymi z projektu,
wysyła do KSeF, pokazuje rezerwę podatkową (ile z tej kwoty powinno pójść
na bok, zanim zaczniesz nią dysponować).
**Gotowe do przejścia dalej, gdy**: faktura wystawiona i wysłana klientowi.

### Krok 7 — Płatność / windykacja
**Robisz**: nic, dopóki wszystko idzie zgodnie z terminem — panel
przypomina klientowi sam. Jeśli mimo eskalacji nie płaci — decydujesz o
kolejnym kroku (wstrzymanie prac / dalsza windykacja poza panelem).
**Panel robi za Ciebie**: przypomnienie przed terminem, potem rosnąca
eskalacja tonu (uprzejme → stanowcze → formalne wezwanie do zapłaty z
opcjonalnymi odsetkami), licznik i historia przypomnień widoczne na
fakturze, auto-status "Opłacona" po pełnej wpłacie.
**Gotowe do przejścia dalej, gdy**: faktura ma status "Opłacona".

### Krok 8 — Zamknięcie i opinia
**Robisz**: wysyłasz krótkie podsumowanie ("co zrobiliśmy, co dalej,
dziękujemy"), prosisz o ocenę i (za zgodą) o referencję/case study.
**Panel robi za Ciebie**: podpowiada ten krok w momencie zmiany statusu
projektu na "Wdrożone", zapisuje ocenę i zgodę na referencję przy
kliencie.
**Gotowe do przejścia dalej, gdy**: opinia zebrana (albo świadomie
odpuszczona, jeśli klient nie chce) — projekt formalnie zamknięty.

### Krok 9 — Wsparcie (jeśli dotyczy)
**Robisz**: odpowiadasz na zgłoszenia w ramach gwarancji albo wyceniasz
jako nowe zlecenie, jeśli to spoza gwarancji.
**Panel robi za Ciebie**: prosty rejestr zgłoszeń przy kliencie/projekcie,
pilnuje terminu Twojej odpowiedzi.
**Gotowe do przejścia dalej, gdy**: zgłoszenie zamknięte albo przekształcone
w nową ofertę (wraca do Kroku 2).

### Krok 10 — Retencja (pętla powrotna)
**Robisz**: po ustalonym czasie (np. 2-3 miesiące) sprawdzasz, jak
klientowi się wiedzie, pytasz o nowe potrzeby i o polecenie, jeśli
jeszcze go nie było.
**Panel robi za Ciebie**: przypomina o tym kontakcie automatycznie po
zamknięciu projektu, pokazuje na Pulpicie % nowych leadów ze źródła
"Polecenie" — czyli czy ta pętla faktycznie się kręci.
**Gotowe**: nowy lead od poleconego kontaktu wraca do **Kroku 0** — koło
się zamyka.

### Jak sprawdzić, że CAŁY system działa jak należy (nie pojedynczy klient)
Raz w miesiącu/kwartale patrzysz na Pulpit i sprawdzasz:
- Czy czas do pierwszej odpowiedzi na leada jest krótki i stabilny.
- Czy konwersja lead→oferta→klient nie spada.
- Ile projektów ma status "Zagrożony" (więcej niż kilka = sygnał, że
  bierzesz za dużo naraz albo źle szacujesz terminy).
- Średni czas do zapłaty (DSO) i wiek najstarszej zaległej faktury.
- % zamkniętych projektów z zebraną opinią.
- % nowych leadów ze źródła "Polecenie" (rośnie = pętla retencji działa).

Jeśli któryś z tych wskaźników się psuje — to sygnał, żeby wrócić do
konkretnego etapu wyżej i sprawdzić, co w nim szwankuje, zanim problem
urośnie.

---

## Etap 1 — Lead (pozyskanie) ✅

**Co się dzieje**: ktoś zgłasza zainteresowanie (formularz, polecenie,
networking, zimny kontakt). Kwalifikujesz: czy to w ogóle pasujący klient
(budżet, zakres, termin), czy nie.

**Dobre praktyki premium**:
- Odpowiedź w ciągu godzin, nie dni — pierwsze wrażenie decyduje.
- Jasne "nie" zamiast ciągnięcia leada, który nie pasuje — szanuje czas
  obu stron.
- Ustandaryzowane pytania kwalifikacyjne (budżet / decydent / potrzeba /
  termin — tzw. BANT), żeby nie zapominać o niczym ważnym przy każdej
  rozmowie.

**Moduł w panelu**: ✅ gotowy — `docs/plany-modulow/01-podpowiedzi-leadow.md`,
`docs/plany-modulow/02-nurture-automatyczny.md`,
`docs/plany-modulow/03-kanaly-kontaktu.md`. Podpowiedzi per status, mapa
12-kroku, automatyczne przypomnienia o kontakcie, kanały telefon/WhatsApp/
LinkedIn.

**Drobna luka znaleziona w audycie 2026-07-14**: przy konwersji leada w
klienta część pól się gubi (osoba kontaktowa, LinkedIn, źródło, notatki) —
patrz "Szybkie porządki" niżej.

**🆕 NDA przed rozmową odkrywczą** (dopisane 2026-07-14, inspiracja: dział
"Legal") — przy automatyzacjach AI rozmowa kwalifikacyjna często dotyka
wewnętrznych systemów/danych klienta, zanim cokolwiek zostanie podpisane.
Dziś nie ma nic, co by to zabezpieczało. Osobne od Umowy (Umowa jest PO
sprzedaży, NDA PRZED) — prosty szablon + e-podpis (ten sam mechanizm co
przy Ofercie), wysyłany opcjonalnie, gdy rozmowa tego wymaga. Treść NDA
też do konsultacji prawnej przed pierwszym użyciem.

**Monitorować**: czas do pierwszej odpowiedzi na leada (dziś niemierzony —
warto dodać), liczba leadów wg statusu (już jest na Pulpicie). **🆕 Które
źródło (`zrodlo_kategoria`) faktycznie konwertuje na klientów, nie tylko
generuje leady** — dane już istnieją, brakuje tylko zestawienia na
Pulpicie.

---

## Etap 2 — Oferta ✅

**Co się dzieje**: przygotowujesz wycenę z konkretnym zakresem i ceną,
wysyłasz, klient akceptuje (e-podpisem) albo oferta wygasa.

**Dobre praktyki premium**:
- Stała, przejrzysta cena — bez ukrytych kosztów, bez "to zależy" bez
  konkretów.
- Termin ważności oferty (presja czasowa, ale uczciwa) — **już jest**
  ("wygasłe oferty" na Pulpicie).
- Przypomnienie, jeśli oferta wisi bez odpowiedzi — do sprawdzenia, czy
  istnieje osobno od ogólnego nurture leadów.

**Moduł w panelu**: ✅ gotowy. E-podpis (IP + user-agent + imię) zapisywany
przy akceptacji, atomowe tworzenie projektu+faktury-szkicu w jednej
transakcji (`lib/offerAccept.ts`).

**🆕 Szablony ofert / pakiety usług** (dopisane 2026-07-14, na wyraźną
prośbę: "pracować mądrze, nie tylko ciężko") — zamiast pisać każdą ofertę
od zera, 2-3 gotowe szkielety (typowy zakres + typowa cena za typowy typ
projektu). Szybsza praca, ale ważniejsze: wymusza spójność zakresu (nic
się nie zapomina, bo szablon już to ma) i jest pierwszym krokiem w stronę
produktyzacji usług — jasna oferta zamiast "wyceniamy indywidualnie" za
każdym razem. Właściciel sam definiuje treść szablonów (to decyzja
biznesowa/ofertowa, nie techniczna).

**Monitorować**: konwersja oferta→akceptacja, średni czas do odpowiedzi
klienta.

---

## Etap 3 — Umowa 🆕 (NOWY MODUŁ)

**Co się dzieje**: zanim zaczniesz pracę, obie strony mają czarno na białym:
dokładny zakres, co NIE wchodzi w zakres, zasady zmiany zakresu (i że to
kosztuje dodatkowo), zasady reklamacji/poprawek, kto co dostaje na
własność (ważne przy oprogramowaniu/automatyzacjach — komu należy kod?),
ograniczenie odpowiedzialności, warunki płatności.

**Dobre praktyki premium**: to jest **dokładnie to, co odróżnia
profesjonalną firmę od freelancera-amatora**. Najczęstszy błąd
początkującego przedsiębiorcy to praca "na zaufanie" bez papieru — kończy
się sporami o to, co było umówione. Nawet najprostsza, jednostronicowa
umowa (zakres + cena + terminy + co się dzieje przy zmianie zakresu) już
chroni obie strony.

**Stan dziś**: audyt 2026-07-14 potwierdził, że **nic z tego nie istnieje**
— jedyne miejsce na warunki to wolne pole tekstowe "uwagi" na ofercie,
widoczne dla klienta, ale nieustrukturyzowane.

**Do zaplanowania jako osobny moduł** (`docs/plany-modulow/11-umowy.md`,
numer do potwierdzenia z właścicielem przy starcie):
- Szablon umowy z polami: zakres prac, wyłączenia, zasady zmiany zakresu
  (change request → nowa mini-oferta/aneks), warunki płatności, zasady
  reklamacji/poprawek (ile bezpłatnych rund, w jakim terminie), własność
  intelektualna/kod źródłowy, ograniczenie odpowiedzialności.
- Generowana automatycznie z zaakceptowanej oferty (zakres/cena/pozycje
  kopiowane, tak jak dziś kopiują się do projektu i faktury).
- E-podpis tym samym mechanizmem co oferta (IP + user-agent + imię).
- **Treść prawna (klauzule) MUSI przejść przez prawnika przed użyciem z
  prawdziwym klientem** — Claude buduje mechanizm i strukturę, nie
  redaguje wiążącego tekstu prawnego. To samo zastrzeżenie co przy
  `PO_REJESTRACJI.md` (polityka prywatności/nota prawna).
- Otwarte pytanie do właściciela przy starcie tego modułu: czy umowa ma
  być osobnym dokumentem/PDF, czy rozszerzeniem oferty o dodatkowe pola
  widoczne dopiero po akceptacji?

**Monitorować**: % projektów z podpisaną umową przed startem prac (cel:
100%).

---

## Etap 4 — Onboarding klienta 🆕 (NOWY MODUŁ)

**Co się dzieje**: umowa podpisana, projekt startuje. Zanim zaczniesz
robotę, klient wie: kto z kim się kontaktuje, jak wygląda komunikacja
(jak często, jakim kanałem), jakie dane/dostępy musi dostarczyć, co się
dzieje krok po kroku.

**Dobre praktyki premium**: pierwsze wrażenie z fazy realizacji buduje się
w pierwszym tygodniu. Firmy postrzegane jako premium mają rytuał
"kickoff" — jasny start, nie ciche rozpoczęcie pracy bez słowa. Klient,
który nie wie, czego się spodziewać, zaczyna się niepokoić i pisać częściej
niż trzeba (co kradnie Twój czas) albo — gorzej — nie dostarcza w porę
tego, czego potrzebujesz.

**Stan dziś**: nie istnieje jako osobny krok — projekt startuje bez
żadnego ustandaryzowanego powitania/checklisty. `ProjectResource` (link do
zasobów) już istnieje i częściowo się do tego nadaje.

**Do zaplanowania**:
- Prosta checklista onboardingowa na starcie projektu (co potrzebujesz od
  klienta — dostępy, materiały, kontakt do decydenta) — **miękka
  podpowiedź**, wzorem istniejących podpowiedzi leadów, nie twarda brama.
- Automatyczna wiadomość powitalna po podpisaniu umowy (szablon: kontakt,
  częstotliwość statusów, co dalej) — do decyzji, czy wysyłana automatycznie
  czy tylko przygotowywana do ręcznego wysłania (zgodnie z zasadą "zero
  automatycznego wysyłania bez zatwierdzenia" gdzie dotyczy pieniędzy/
  zobowiązań, tu raczej bezpieczne, ale i tak do potwierdzenia).
- Zaproponować przy starcie tego modułu, czy to osobny "podmoduł", czy
  rozszerzenie istniejącego `ProjectDetailPanel` o sekcję "Onboarding".

**Monitorować**: czy każdy nowy projekt ma uzupełnioną checklistę
onboardingową przed pierwszym dniem pracy.

---

## Etap 5 — Realizacja (Projekty) ✅ (mały 🔧)

**Co się dzieje**: praca nad projektem — kamienie milowe, zadania, bieżąca
komunikacja, zarządzanie zakresem (żeby nie "dokładać" bezpłatnie).

**Dobre praktyki premium**:
- Regularne, przewidywalne statusy (nie tylko gdy klient zapyta) —
  cotygodniowy/comiesięczny rytm w zależności od skali projektu.
- Formalne potwierdzenie ukończenia kamienia milowego przez klienta, nie
  tylko odhaczenie po swojej stronie — buduje udokumentowaną historię
  "klient wiedział i się zgadzał na tym etapie".
- Dyscyplina zakresu: nowa prośba spoza umowy → osobna wycena/aneks (patrz
  Etap 3), nie ciche wciąganie w istniejący budżet czasu.

**Moduł w panelu**: ✅ w większości gotowy — kamienie, zadania, status
"zdrowia" (Na dobrej drodze/Zagrożony/Zerwany, świadomie niezależny od
statusu na tablicy, wzorem Linear).

**🔧 Do rozważenia (nie luka krytyczna, ale wzmacnia premium odczucie)**:
dziś Projekt jest całkowicie wewnętrzny — klient nie widzi nic z postępu
poza tym, co mu ręcznie napiszesz. Warto rozważyć (dopiero po Etapach 3-4,
osobna decyzja z właścicielem): czy chcesz jakąkolwiek formę widoku
postępu dla klienta (nawet prosty publiczny link ze statusem kamieni,
podobny do publicznego podglądu oferty/faktury, które już istnieją).

**🆕 Śledzenie czasu pracy** (dopisane 2026-07-14, na wyraźną prośbę:
"pracować mądrze, nie tylko ciężko") — najczęstszy błąd początkującego
konsultanta: wycenia projekt "na oko", robi go, dostaje zapłatę, i nigdy
się nie dowiaduje, że realnie wyszła stawka poniżej sensownej. Dziś
istnieje rentowność finansowa projektu (przychód minus koszty twarde,
`ProjectDetailPanel`), ale bez czasu nie widać **prawdziwej stawki
godzinowej**. Prosty log godzin przy zadaniu/kamieniu (nie stoper co do
sekundy — wystarczy szacunek na koniec dnia/tygodnia), agregowany do
"ile faktycznie kosztował mnie ten projekt w czasie" obok istniejącej
rentowności finansowej. To dane, które z czasem pokazują, które typy
projektów/klientów są opłacalne, a które nie — kluczowe do świadomego
ustalania cen w kolejnych ofertach (Etap 2).

**Monitorować**: rozkład statusów zdrowia projektów (ile "Zagrożony" —
to już częściowo widać na Pulpicie), terminowość kamieni, **efektywna
stawka godzinowa per projekt/kategoria** (po wdrożeniu śledzenia czasu).

---

## Etap 6 — Fakturowanie ✅

**Co się dzieje**: wystawiasz fakturę (za całość, za etap, albo cyklicznie
przy stałej współpracy).

**Dobre praktyki premium**:
- Fakturowanie natychmiast po ukończeniu etapu/projektu, nie "kiedyś
  później" — profesjonalna firma nie zwleka.
- Jasne warunki płatności ustalone już w umowie (Etap 3), nie negocjowane
  na fakturze.

**Moduł w panelu**: ✅ gotowy — szkic→wystawienie, KSeF, faktury cykliczne,
proformy/zaliczkowe.

**🆕 Rezerwa podatkowa** (dopisane 2026-07-14, inspiracja: dział "Finance")
— łatwo jako początkujący przedsiębiorca wydać to, co wpłynęło na konto,
zapominając że część należy się fiskusowi. Mały kalkulator/wskaźnik przy
wystawionych/opłaconych fakturach: "ile z tej kwoty warto odłożyć" wg
stawki ustawianej ręcznie przez właściciela (nie wyliczanej automatycznie
— to nie zastępuje księgowej, tylko pomaga nie wydać za dużo, zanim
księgowa policzy dokładnie). Nie osobny moduł księgowy, tylko rozszerzenie
istniejącego widoku faktur/Pulpitu.

**Monitorować**: liczba faktur-szkiców czekających na wystawienie (już na
Pulpicie).

---

## Etap 7 — Płatność i windykacja 🔧 (DO ROZBUDOWY)

**Co się dzieje**: klient płaci (w całości albo częściami). Jeśli nie płaci
w terminie — masz zdefiniowaną, konsekwentną ścieżkę reakcji.

**Dobre praktyki premium**:
- Przypomnienie **przed** terminem płatności (uprzejme, "przypominamy o
  zbliżającym się terminie"), nie tylko po fakcie.
- Eskalacja tonu wraz z czasem opóźnienia: łagodne przypomnienie → bardziej
  formalne → oficjalne wezwanie do zapłaty (to osobny, prawnie
  rozpoznawalny rodzaj pisma, nie kolejny e-mail o tej samej treści).
- Naliczanie odsetek ustawowych za opóźnienie — Twoje prawo, rzadko
  egzekwowane przez małe firmy, ale jego samo **wspomnienie** w wezwaniu
  zwiększa skuteczność.
- Konsekwentność: klient wie, że nie płacenie ma realne, przewidywalne
  konsekwencje (wstrzymanie kolejnych prac, przekazanie do windykacji) —
  to buduje szacunek do Twoich warunków, nie tylko do Twojej pracy.

**Stan dziś**: audyt 2026-07-14 potwierdził — istnieje TYLKO jeden, stały
szablon przypomnienia, wysyłany co 7 dni **w nieskończoność, bez
eskalacji**, bez licznika ile już poszło, bez odsetek, bez koncepcji
formalnego wezwania.

**Do rozbudowania w istniejącym module Faktury**:
- Licznik i historia wysłanych przypomnień widoczne na samej fakturze
  (dziś jest tylko `last_reminder_at`, nadpisywane za każdym razem).
- Rosnąca eskalacja: przypomnienie 1 (uprzejme) → przypomnienie 2 (bardziej
  stanowcze) → "wezwanie do zapłaty" jako osobny, formalny szablon (i
  osobny dokument/PDF, nie zwykły mail) po ustalonym progu dni opóźnienia.
- Opcjonalne pole "odsetki ustawowe" na wezwaniu — **stawka do ręcznego
  ustawienia przez właściciela** (zmienia się okresowo, ogłaszana przez
  NBP/Ministerstwo Finansów), NIE wyliczana automatycznie bez jego
  potwierdzenia — to obszar, gdzie błąd kosztuje wiarygodność.
- Przypomnienie **przed** terminem (np. 3 dni wcześniej), nie tylko po.
- Treść wezwania do zapłaty, tak jak treść umowy, **do konsultacji z
  prawnikiem/księgową** przed pierwszym prawdziwym użyciem.

**Monitorować**: średni czas do zapłaty (DSO — Days Sales Outstanding),
wiek zaległych faktur (ile dni po terminie), ile faktur wymagało więcej niż
jednego przypomnienia.

---

## Etap 8 — Zamknięcie projektu i opinia 🆕 (NOWY MODUŁ)

**Co się dzieje**: projekt/etap się kończy — formalne przekazanie
(dokumentacja, dostępy, podsumowanie co zrobiono), prośba o opinię/ocenę,
ewentualnie o referencję albo studium przypadku (za zgodą klienta).

**Dobre praktyki premium**: to jeden z **najczęściej pomijanych** etapów
przez małe firmy, a jeden z najtańszych do zrobienia dobrze. Zamknięcie z
klasą (krótkie podsumowanie "co zrobiliśmy, co dalej, dziękujemy") zostaje
w pamięci i jest bezpośrednim źródłem poleceń. Prośba o opinię zaraz po
udanym zakończeniu ma wielokrotnie wyższą skuteczność niż proszenie
miesiące później. Dla nowej firmy (Leggera Labs — zero klientów na starcie,
patrz pamięć projektu) **to jest główne źródło przyszłego portfolio**.

**Stan dziś**: nie istnieje — projekt po prostu zmienia status na
"Wdrożone", bez żadnego rytuału zamknięcia.

**Do zaplanowania**:
- Miękka podpowiedź przy zmianie statusu projektu na "Wdrożone": "Wyślij
  podsumowanie i poproś o opinię?" — z gotowym szablonem do edycji, nigdy
  automatycznie bez potwierdzenia.
- Proste pole "ocena klienta" (np. 1-5, opcjonalny komentarz) zapisywane
  przy kliencie — surowiec pod przyszłą stronę z referencjami.
- Pole "zgoda na case study/referencję" (tak/nie) — ważne prawnie, nie
  zakładać domyślnie zgody.

**Monitorować**: % zamkniętych projektów z zebraną opinią, średnia ocena.

---

## Etap 9 — Wsparcie posprzedażowe 🆕 (NOWY MODUŁ, jeśli dotyczy)

**Co się dzieje**: po zakończeniu projektu klient zgłasza błędy/pytania —
albo w ramach gwarancji (bezpłatnie, ograniczony czas), albo jako nowe,
płatne zlecenie.

**Dobre praktyki premium**:
- Jasno zdefiniowany okres gwarancji w umowie (Etap 3) — ile dni/tygodni
  poprawek bezpłatnych, co się liczy jako "błąd" a co jako "nowa funkcja"
  (czyli nowe płatne zlecenie).
- Przewidywalny czas reakcji na zgłoszenie (nawet nieformalne SLA typu
  "odpowiadam w ciągu 24h roboczych" buduje zaufanie).

**Stan dziś**: nie istnieje jako koncept — nie ma gdzie zgłosić/śledzić
zgłoszenia posprzedażowego, poza zwykłym kontaktem mailowym/telefonicznym.

**Do zaplanowania** (dopiero gdy będą pierwsi klienci z realną potrzebą
wsparcia — nie budować "na zapas"):
- Lekki rejestr zgłoszeń przy kliencie/projekcie: opis, czy w ramach
  gwarancji czy płatne, status, data zgłoszenia/zamknięcia.
- Jeśli stałe wsparcie/retainer: re-użycie wzorca `recurring_costs`/
  `recurring_invoices` (koszty/faktury cykliczne) dla cyklicznych
  faktur za abonament wsparcia — infrastruktura już istnieje.

**Monitorować**: liczba otwartych zgłoszeń, średni czas odpowiedzi.

---

## Etap 10 — Retencja i polecenia 🆕 (NOWY MODUŁ, zamyka pętlę)

**Co się dzieje**: relacja z klientem nie kończy się na fakturze. Kontakt
"sprawdzający" jakiś czas po zakończeniu (czy wszystko działa, czy są nowe
potrzeby), prośba o polecenie, rozpoznanie okazji do kolejnego zlecenia.

**Dobre praktyki premium**: pozyskanie nowego klienta kosztuje wielokrotnie
więcej niż utrzymanie/rozwinięcie relacji z istniejącym. Firmy postrzegane
jako premium **nie znikają** po wystawieniu faktury — jeden zaplanowany
kontakt 2-3 miesiące później ("jak działa wdrożenie? potrzebujecie
czegoś jeszcze?") regularnie generuje kolejne zlecenia i polecenia. Kategoria
źródła leada "Polecenie" już istnieje w systemie (`SOURCE_CATEGORIES`) —
to domyka pętlę: zadowolony klient → nowy lead.

**Stan dziś**: nie istnieje. Nurture (Moduł 2) pilnuje leadów PRZED
zamknięciem sprzedaży, ale nic nie pilnuje klientów PO zakończeniu
projektu.

**Do zaplanowania**:
- Analogicznie do nurture leadów: opcjonalne, ręcznie ustawiane
  przypomnienie "sprawdź klienta" X miesięcy po zamknięciu projektu —
  ta sama mechanika co `next_followup`, tylko wyzwalana zakończeniem
  projektu, nie statusem leada.
- Miękka podpowiedź przy takim kontakcie: "zapytaj o polecenie/opinię,
  jeśli jeszcze jej nie ma" (patrz Etap 8).

**Monitorować**: % klientów z zaplanowanym kontaktem po zakończeniu, %
nowych leadów ze źródła "Polecenie" (już da się policzyć dziś, tylko
nikt jeszcze tego nie pokazuje na Pulpicie).

---

## Poprzeczne (nie jeden etap, tylko całość drogi)

### Fundament linkowania 🔧
Audyt 2026-07-14: Faktury i Oferty **nie mają własnej podstrony `/[id]`**
(tylko druk PDF + edytor-modal), więc nic nie może do nich linkować
bezpośrednio. Oś czasu klienta istnieje, ale żaden wpis na niej nie jest
klikalny. Bez tego punktu "kliknij na coś i przenosi mnie do tego" (wprost
zgłoszone przez właściciela) nie da się zrobić porządnie. **To powinno
być zrobione PRZED etapem 8-10**, bo każdy kolejny moduł dokłada kolejne
zdarzenia do osi czasu klienta.

### Szybkie porządki (małe, przy okazji) 🔧
- Naprawić martwy link `/admin/invoices/[id]` z Pulpitu (404 dziś).
- Przy konwersji Lead→Klient donieść gubione pola (osoba kontaktowa,
  LinkedIn, źródło, notatki).

### Pulpit jako "czy jestem na dobrej drodze" 🔧
Docelowo Pulpit powinien pokazywać nie tylko "co dziś", ale też prosty
zestaw wskaźników zdrowia biznesu wymienionych w każdym etapie wyżej (czas
odpowiedzi, konwersje, DSO, wiek zaległości, % opinii, % poleceń). To
osobna, mniejsza praca po zbudowaniu etapów, które te dane w ogóle
generują — nie ma sensu budować wykresu z danych, których jeszcze nie ma.

---

## Podsumowanie — zatwierdzona kolejność budowy (2026-07-14)

Właściciel zatwierdził całą mapę (łącznie z NDA, śledzeniem czasu i
szablonami ofert dopisanymi w tej rozmowie) i zdecydował: pracujemy
**moduł po module, każdy w osobnym, nowym czacie**, dokładnie jak dotąd.
Poniżej finalna numeracja plików w `docs/plany-modulow/` (kontynuacja po
istniejącym `10-kalendarz-dopracowanie.md`):

| # | Moduł | Plik |
|---|-------|------|
| 11 | Umowy + NDA | [11-umowy-i-nda.md](11-umowy-i-nda.md) |
| 12 | Fundament linkowania (podstrony faktur/ofert + klikalna oś czasu klienta) | [12-fundament-linkowania.md](12-fundament-linkowania.md) |
| 13 | Faktury: eskalacja windykacji + rezerwa podatkowa | [13-faktury-windykacja.md](13-faktury-windykacja.md) |
| 14 | Onboarding klienta | [14-onboarding-klienta.md](14-onboarding-klienta.md) |
| 15 | Zamknięcie projektu i opinie | [15-zamkniecie-i-opinie.md](15-zamkniecie-i-opinie.md) |
| 16 | Wsparcie posprzedażowe | [16-wsparcie-posprzedazowe.md](16-wsparcie-posprzedazowe.md) |
| 17 | Retencja i polecenia | [17-retencja-i-polecenia.md](17-retencja-i-polecenia.md) |
| 18 | Pulpit: wskaźniki zdrowia biznesu | [18-pulpit-wskazniki.md](18-pulpit-wskazniki.md) |
| 19 | Śledzenie czasu pracy | [19-sledzenie-czasu.md](19-sledzenie-czasu.md) |
| 20 | Szablony ofert / pakiety usług | [20-szablony-ofert.md](20-szablony-ofert.md) |

Kolejność 11→20 jest rekomendowana (infrastruktura i największe luki
prawne najpierw), ale nieblokująca poza jednym wyjątkiem: **12 (fundament
linkowania) najlepiej zrobić przed 15/16/17**, bo one dokładają kolejne
zdarzenia do osi czasu klienta, którą 12 dopiero czyni klikalną. "Szybkie
porządki" (martwy link do faktur, gubione pola Lead→Klient) nie mają
osobnego numeru — dorzuć je przy okazji modułu 12, bo dotyczą tego samego
obszaru (linkowanie i dane klienta).

Moduły 4 (poczta), 5 (mobilny), 7 (AI-szkice mailowe) z `README.md`
pozostają osobną ścieżką — nie kolidują z powyższą kolejnością, można je
przeplatać wedle priorytetu.

**Ostateczny, całościowy audyt całej drogi (lead → płatność → wsparcie →
retencja) — po ukończeniu modułów 11-20.**
