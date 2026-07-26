/**
 * Instrukcje obsługi Leggera Hub — JEDNO ŹRÓDŁO treści dla panelu i apki.
 *
 * **Dlaczego w kodzie, a nie w bazie** (decyzja właściciela 2026-07-26). Opis
 * funkcji leży w repozytorium razem z funkcją, którą opisuje, więc zmiana
 * zachowania i poprawka opisu idą jednym commitem. Treść w bazie nie miałaby
 * nic, co zmusza do aktualizacji — a dokumentacja rozjeżdżająca się z kodem to
 * błąd, który ten projekt popełnił już raz (patrz `CLAUDE.md`: „jeśli gdzieś
 * widzisz starą regułę — jest nieaktualna").
 *
 * **Dlaczego dwa poziomy w jednym tekście.** Ktoś, kto widzi panel pierwszy
 * raz, potrzebuje „co robić i w jakiej kolejności”. Właściciel dodatkowo
 * potrzebuje „co dzieje się samo i dlaczego coś się pojawiło”. Rozdzielenie
 * tego na dwa dokumenty skończyłoby się tym, że drugi nigdy nie jest czytany;
 * rozdzielenie na dwie warstwy jednego tekstu daje obie odpowiedzi w miejscu,
 * w którym się je zadaje.
 *
 * **Zakres rośnie razem z modułami.** Dopisujemy moduł do tego pliku dopiero,
 * gdy jest sprawdzony i uznany za gotowy — instrukcja opisująca coś, czego
 * jeszcze nie ma, jest gorsza niż jej brak.
 */

/** Jeden krok albo jeden mechanizm — tytuł i wyjaśnienie. */
export type PunktInstrukcji = {
  tytul: string;
  opis: string;
};

export type ModulInstrukcji = {
  /** Klucz do adresu i do kotwicy w spisie treści. */
  id: string;
  nazwa: string;
  /** Gdzie tego szukać — dosłowna ścieżka w panelu i w apce. */
  gdzie: string;
  /** Jedno zdanie: po co ten moduł w ogóle istnieje. */
  poCoTo: string;
  /** Kiedy się po niego sięga w ciągu dnia. */
  kiedy: string;
  /** „Jak używać” — kolejność ma znaczenie, to jest przepis. */
  kroki: PunktInstrukcji[];
  /** Druga warstwa: co dzieje się bez Twojego udziału. */
  automaty: PunktInstrukcji[];
  /** Rzeczy, które mylą albo których nie wolno zrobić. */
  pulapki: PunktInstrukcji[];
  /** Skróty klawiszowe i gesty — puste, gdy moduł ich nie ma. */
  skroty: PunktInstrukcji[];
};

/** Wstęp: jak cała aplikacja działa od początku do końca. */
export const WSTEP = {
  tytul: "Jak to działa od początku do końca",
  akapity: [
    "Leggera Hub prowadzi jedną historię: obca firma staje się kontaktem, kontakt staje się rozmową, rozmowa staje się klientem, a klient — projektem i fakturą. Każdy moduł to jeden odcinek tej drogi, a nie osobne narzędzie. Dlatego rzeczy przechodzą z modułu do modułu same: przyjęty kandydat staje się leadem, zaakceptowana oferta tworzy projekt, zamknięty projekt prosi o opinię.",
    "Zasada, która tłumaczy najwięcej: panel nigdy nie kontaktuje się z nikim za Ciebie i nigdy nie podejmuje decyzji. Automaty tylko przygotowują, przypominają i pilnują — decyzję zawsze klikasz Ty. Dlatego zamiast „system wysłał ofertę” masz „system przygotował szkic i czeka”.",
    "Druga zasada: nic nie znika po cichu. Jeśli coś wymaga Twojego ruchu, zobaczysz to na Pulpicie, w porannym mailu i pod dzwonkiem w telefonie. Jeśli automat stanie, dostaniesz alarm z innej drogi niż ta, która padła.",
  ],
  /** Uczciwie: które odcinki drogi są już opisane. */
  stan:
    "Na razie opisane są Pulpit, Leady, Klienci i Oferty — moduły uznane za gotowe i sprawdzone na wszystkich urządzeniach. Kolejne dopisujemy tu po domknięciu każdego z nich, więc ten spis rośnie razem z aplikacją.",
};

export const MODULY: ModulInstrukcji[] = [
  /* ────────────────────────────── PULPIT ────────────────────────────── */
  {
    id: "pulpit",
    nazwa: "Pulpit",
    gdzie: "Panel: pierwsza pozycja w menu po lewej. Telefon i iPad: pierwsza zakładka.",
    poCoTo:
      "Jeden ekran odpowiadający na pytanie „co mam dziś zrobić” — zebrane z całej aplikacji, żeby nie trzeba było obchodzić modułów po kolei.",
    kiedy:
      "Rano, na początku pracy. To jest ekran startowy: jeśli Pulpit jest pusty, na dziś nic nie wisi.",
    kroki: [
      {
        tytul: "1. Spójrz na licznik u góry",
        opis:
          "Duża liczba i podpis „wymaga dziś Twojego ruchu”. To suma wszystkiego, co czeka: leady po terminie, zaplanowane kontakty z klientami, maile do obsłużenia, faktury po terminie. Zero znaczy, że możesz zająć się czymś innym niż gaszenie pożarów.",
      },
      {
        tytul: "2. Przeczytaj sekcję „Nadzór”, jeśli jest",
        opis:
          "Pojawia się tylko wtedy, gdy coś jest nie tak z samym systemem: kopie zapasowe nie działają, automat stanął. To jedyna sekcja, która mówi o aplikacji, a nie o Twoich klientach — dlatego stoi wysoko i dlatego warto ją traktować poważnie.",
      },
      {
        tytul: "3. Przejdź sekcje od góry do dołu",
        opis:
          "Leady, zaplanowane kontakty, poczta, faktury. Każda pozycja jest klikalna i prowadzi prosto do rekordu. Kolejność sekcji nie jest przypadkowa — od rzeczy, które najszybciej stygną (nowy lead), do tych, które mogą poczekać.",
      },
      {
        tytul: "4. Zapisz to, co przyszło Ci do głowy — przycisk „+”",
        opis:
          "Nowy lead, skan wizytówki, notatka, koszt z paragonu. Pulpit jest ekranem, na którym najczęściej pojawia się myśl „zanotuj to, zanim wyleci z głowy” — dlatego tworzenie jest tutaj, a nie dopiero w module.",
      },
      {
        tytul: "5. Dzwonek — „Co czeka”",
        opis:
          "Liczba przy dzwonku to nieprzeczytane zdarzenia plus leady wymagające dziś ruchu. Po stuknięciu widzisz jedno i drugie: najpierw robotę do zrobienia, pod spodem kronikę tego, co się wydarzyło (nowy mail, opłacona faktura, zaakceptowana oferta).",
      },
      {
        tytul: "6. Menu „…” — rzeczy uruchamiane ręcznie",
        opis:
          "„Łowca: poluj teraz” odpala szukanie nowych firm od razu, zamiast czekać do nocy. „Wyślij dzienny raport” wysyła poranne podsumowanie natychmiast — przydaje się, gdy chcesz sprawdzić, co w nim jest.",
      },
    ],
    automaty: [
      {
        tytul: "Poranny raport, codziennie o 6:00",
        opis:
          "Mail z podsumowaniem: co wymaga działania, jakie faktury są po terminie, czy kopie zapasowe działają. Przy okazji panel wysyła klientom przypomnienia o zaległych fakturach, generuje faktury i koszty cykliczne, pobiera pocztę i sprząta dane po terminie retencji.",
      },
      {
        tytul: "Licznik liczy inne rzeczy niż dzwonek — i to jest celowe",
        opis:
          "Licznik na Pulpicie to „ile mam do zrobienia”. Kronika pod dzwonkiem to „co się wydarzyło”. Opłacona faktura jest zdarzeniem, ale nie jest robotą, więc wchodzi do kroniki, a nie do licznika. Dlatego obie liczby zwykle się różnią.",
      },
      {
        tytul: "Alarm, gdy automat stanie",
        opis:
          "Jeśli któryś automat nie zamelduje się przez 36 godzin, dostajesz osobnego maila — wysyłanego INNĄ drogą niż poranny raport. Gdyby padł sam raport, ostrzeżenie schowane w jego treści zginęłoby razem z nim.",
      },
    ],
    pulapki: [
      {
        tytul: "Szukanie po treści nie odmienia wyrazów",
        opis:
          "Wpisane słowo działa jak POCZĄTEK wyrazu: „faktur” znajdzie fakturę, faktury i fakturze. Ale „prośbę” nie znajdzie „prośby” — końcówka się rozjeżdża. Gdy czegoś nie widać, skróć słowo do rdzenia. Polskie znaki nie mają znaczenia: „zamowienie” znajdzie „zamówienie”.",
      },
      {
        tytul: "Pulpit nie jest listą wszystkiego",
        opis:
          "Pokazuje tylko to, co wymaga ruchu DZIŚ. Pełne listy są w modułach. Pusty Pulpit nie znaczy „nie mam klientów”, tylko „nic nie jest po terminie”.",
      },
    ],
    skroty: [
      { tytul: "⌘K / Ctrl+K", opis: "Paleta poleceń — wszystko, co da się zrobić, z klawiatury. Szuka DWOMA drogami naraz: po nazwie rekordu (lead, klient, oferta, faktura) i po TREŚCI (rozmowy, maile, notatki, opisy projektów). Wyniki z treści mają wycinek zdania i etykietę, skąd pochodzą." },
      { tytul: "Pociągnięcie w dół (telefon)", opis: "Odświeża dane. Nie ma osobnego przycisku „odśwież” — działa na każdym ekranie." },
    ],
  },

  /* ────────────────────────────── LEADY ────────────────────────────── */
  {
    id: "leady",
    nazwa: "Leady",
    gdzie: "Panel: menu po lewej → Leady. Telefon: zakładka Leady. iPad: pozycja w panelu bocznym.",
    poCoTo:
      "Rejestr firm, które MOGĄ zostać klientami — od momentu, gdy o nich usłyszysz, do decyzji „współpracujemy” albo „nie”.",
    kiedy:
      "Za każdym razem, gdy pojawia się nowy kontakt, i za każdym razem, gdy Pulpit mówi, że któryś lead czeka na ruch.",
    kroki: [
      {
        tytul: "1. Zrozum trzy widoki u góry",
        opis:
          "„Tablica” to kolumny według statusu — widać, gdzie utknął lejek. „Tabela” to gęsta lista do przeglądania i eksportu. „Kandydaci” to skrzynka Łowcy, czyli firmy znalezione automatycznie, które jeszcze NIE są leadami.",
      },
      {
        tytul: "2. Skąd biorą się leady",
        opis:
          "Pięć dróg: formularz na stronie (wpada sam i dzwoni), Łowca leadów (znajduje firmy w rejestrze CEIDG co noc), wyszukiwanie na mapie (firmy z OpenStreetMap), skan wizytówki z telefonu, oraz ręczne dodanie. Każda droga zostawia inną kategorię źródła — po niej liczy się później, które źródło naprawdę przynosi klientów.",
      },
      {
        tytul: "3. Przejdź kandydatów Łowcy — „Weź” albo „Odrzuć”",
        opis:
          "Każdy kandydat ma ocenę A/B/C i rozwijane „dlaczego” z listą sygnałów i punktów. „Weź” tworzy leada z terminem kontaktu na dziś. „Odrzuć” pyta o powód i dopisuje firmę na czarną listę, żeby nie wróciła. Tuż po odrzuceniu masz „Cofnij”, a całą czarną listę można przejrzeć i cofnąć później.",
      },
      {
        tytul: "4. Prowadź lead przez statusy",
        opis:
          "Kolejność, która działa: Nowe zgłoszenie ze strony → Do kontaktu → Napisano, czeka na odpowiedź → Przypomnienie wysłane → Rozmowa umówiona → Pilotaż w trakcie → Zamknięte, sukces (albo Odrzucone). Status zmieniasz przeciągnięciem karty na Tablicy albo kliknięciem pigułki statusu.",
      },
      {
        tytul: "5. Czytaj podpowiedź przy statusie",
        opis:
          "Każdy status ma jedno zdanie „co zwykle dalej” — np. przy „Rozmowa umówiona” przypomni, żeby wysłać NDA PRZED rozmową, jeśli będziecie omawiać ich dane. To nie jest AI, tylko stała podpowiedź, ale oszczędza pomyłek.",
      },
      {
        tytul: "6. Jak czytać profil leada",
        opis:
          "Ten sam układ, co u klienta: po lewej stała kolumna z danymi (zwijana kliknięciem w nagłówek sekcji), po prawej historia kontaktu. Nad zakładkami pasek „Proces sprzedaży” mówi jednym spojrzeniem, na którym z piętnastu kroków jesteś; klikniesz „wszystkie kroki”, żeby zobaczyć całą ścieżkę.",
      },
      {
        tytul: "7. Zapisuj każdy kontakt",
        opis:
          "W profilu leada masz log: telefon, mail, WhatsApp, LinkedIn. Zalogowana rozmowa aktualizuje datę ostatniego kontaktu, a od niej liczą się przypomnienia. Lead bez zapisanych kontaktów wygląda dla systemu jak zapomniany — i zacznie się o siebie upominać. Najkrótsza droga: przycisk „Zapisz kontakt” w nagłówku profilu — przenosi do historii i od razu ustawia kursor w polu wpisu.",
      },
      {
        tytul: "8. Ustaw termin, jeśli wiesz kiedy wrócić",
        opis:
          "Pole „następne przypomnienie” plus krótki opis PO CO. Ręcznie ustawiony termin bije wszystkie reguły automatyczne — jeśli powiedziałeś „wracam za miesiąc”, panel nie będzie zawracał głowy wcześniej.",
      },
      {
        tytul: "9. Gdy lead mówi „tak”",
        opis:
          "Z profilu tworzysz klienta i ofertę. Od tego momentu historia przenosi się do modułu Klienci, a lead zostaje jako ślad, skąd się wzięło.",
      },
    ],
    automaty: [
      {
        tytul: "Łowca leadów — co noc o 4:00",
        opis:
          "Bierze porcję firm z rejestru CEIDG według Twoich „polowań” (branża + obszar), sprawdza je w Białej liście podatników VAT i na ich stronie internetowej, przepuszcza przez sito i odkłada garść kandydatów do skrzynki. Firmy odrzucone przez sito nie zostają w bazie wcale — zostaje sam anonimowy licznik powodu.",
      },
      {
        tytul: "Sito jest deterministyczne, bez AI",
        opis:
          "Dyskwalifikatory: firma nieaktywna, brak jakiejkolwiek drogi kontaktu, branża spoza listy, własna branża IT, firma młodsza niż 18 miesięcy. Potem punkty: branża docelowa +30, czynny VAT +15, publiczny e-mail +15, telefon/strona/wiek/formularz/cennik po +10, skala i bliskość po +5, martwa strona −15. Progi: A od 70, B od 45, niżej C. Każdy punkt jest wypisany przy kandydacie.",
      },
      {
        tytul: "Kiedy lead sam się o siebie upomni",
        opis:
          "Zawsze przy „Nowe zgłoszenie ze strony”. W dniu ustawionego przypomnienia. Po 4 dniach ciszy, jeśli status to „Napisano, czeka na odpowiedź”. Po 14 dniach ciszy w każdym innym otwartym statusie — a jeśli nigdy nie było kontaktu, liczone od dnia dodania.",
      },
      {
        tytul: "Zaczepka od lokalnego modelu",
        opis:
          "Po przyjęciu kandydata możesz kliknąć „Zaczepka” — model działający na Twoim Macu czyta stronę firmy i proponuje JEDNO zdanie, co u niej zautomatyzować. Model niczego nie wysyła ani nie zapisuje: poprawiasz zdanie i sam decydujesz, czy trafi do notatki leada.",
      },
      {
        tytul: "Retencja danych",
        opis:
          "Kandydat, którego nie przyjmiesz, znika po 30 dniach. Lead bez konwersji znika po 24 miesiącach od ostatniego kontaktu. Na czarnej liście zostaje wyłącznie NIP, nazwa i powód — nic więcej.",
      },
    ],
    pulapki: [
      {
        tytul: "Kandydat to jeszcze nie lead",
        opis:
          "Dopóki nie klikniesz „Weź”, firma nie istnieje w rejestrze i nie psuje żadnego wskaźnika. To jest celowe: automat sypiący setki zimnych rekordów do rejestru zepsułby wszystkie liczby o konwersji, i to bez żadnego objawu awarii.",
      },
      {
        tytul: "„Oznacz jako obsłużone” a „Odłóż o tydzień”",
        opis:
          "W banerze na górze Leadów przy leadzie, z którym już rozmawiałeś, jest „Oznacz jako obsłużone” — ustawia status i dzisiejszą datę kontaktu. Przy leadzie, do którego NIGDY się nie odezwałeś, jest „Odłóż o tydzień”: wpisanie kontaktu, którego nie było, byłoby zapisaniem nieprawdy.",
      },
      {
        tytul: "Odrzucenie kandydata jest trwałe",
        opis:
          "Firma trafia na czarną listę i Łowca jej nie zaproponuje ponownie. Da się to cofnąć („Cofnij” zaraz po, albo „Przywróć” z czarnej listy), ale nie dzieje się to samo — dlatego pytamy o powód.",
      },
      {
        tytul: "Pierwszy mail do firmy z CEIDG musi mówić, skąd masz dane",
        opis:
          "Firma nie podała Ci ich sama — wzięliśmy je z publicznego rejestru, a to nakłada obowiązek informacyjny przy PIERWSZYM kontakcie. Gotowa klauzula jest w notatce każdego przyjętego kandydata i w szablonie „Pierwszy kontakt — kandydat Łowcy” w Poczcie.",
      },
    ],
    skroty: [
      { tytul: "1 / 2 / 3", opis: "Przełącza widoki: Tablica, Tabela, Kandydaci." },
      { tytul: "/", opis: "Kursor do wyszukiwarki." },
      { tytul: "j / k", opis: "Ruch po liście — w Tabeli i w skrzynce kandydatów." },
      { tytul: "Enter", opis: "W Tabeli otwiera lead. W skrzynce kandydatów rozwija „dlaczego”." },
      { tytul: "t / x (kandydaci)", opis: "„t” bierze kandydata, „x” odrzuca (zapyta o powód)." },
      { tytul: "Telefon: przesunięcie palcem", opis: "Na liście leadów w prawo — zadzwoń, w lewo — oznacz obsłużone. W skrzynce kandydatów w prawo — Weź, w lewo — Odrzuć. To samo jest w menu po przytrzymaniu wiersza." },
    ],
  },

  /* ────────────────────────────── KLIENCI ────────────────────────────── */
  {
    id: "klienci",
    nazwa: "Klienci",
    gdzie: "Panel: trzecia pozycja w menu. Telefon: zakładka „Więcej” → Klienci. iPad: trzecia pozycja w panelu bocznym.",
    poCoTo:
      "Kartoteka firm, z którymi rozmowa realnie się zaczęła — jedna, chronologiczna historia kontaktu plus wszystko, co do tej firmy przypięte: oferty, umowy, projekty, faktury, poczta i opinie.",
    kiedy:
      "Zanim zadzwonisz albo napiszesz do kogoś, kogo już znasz — żeby w pięć sekund przypomnieć sobie, na czym stanęło. I zaraz po rozmowie, żeby to zapisać.",
    kroki: [
      {
        tytul: "1. Zrozum, czym klient różni się od leada",
        opis:
          "Lead to firma, którą dopiero sprawdzasz. Klient to firma, z którą rozmowa już trwa i jest realna szansa coś zrobić — teraz albo za rok. Klient powstaje albo sam (pierwsza oferta zrobiona z leada), albo ręcznie przyciskiem „Utwórz klienta” na leadzie, gdy rozmowa wyprzedziła papiery.",
      },
      {
        tytul: "2. Status relacji to osobna oś niż sprzedaż",
        opis:
          "Prospekt / Aktywny / Uśpiony / Stracony opisują RELACJĘ, nie to, czy klient już zapłacił — to widać po ofertach i fakturach obok. Pod statusem stoi zdanie, co się zwykle w nim robi. Kolory znaczą to samo na każdym urządzeniu: fiolet — relacja żyje, złoto — prospekt, szarość — cisza.",
      },
      {
        tytul: "3. Jak czytać profil klienta",
        opis:
          "Po lewej stała kolumna z danymi — kontakt, rytm, osoby, firma, adres, notatka. Nagłówki sekcji można zwinąć kliknięciem i zostają zwinięte także przy następnym kliencie. Po prawej historia i „Powiązane” jako zakładki. Dane nie chowają się już za zakładką: czytasz oś czasu i masz numer telefonu obok, bez przełączania widoku.",
      },
      {
        tytul: "4. Zapisuj każdy kontakt w zakładce „Historia”",
        opis:
          "Kanał (telefon, mail, WhatsApp, LinkedIn, spotkanie), kierunek i — przy telefonie — czy odebrali oraz jak długo trwała rozmowa. Nieodebrane od klienta proponuje od razu przypomnienie na jutro. Z telefonu to samo robi „Zaloguj rozmowę”.",
      },
      {
        tytul: "5. Ustaw przypomnienie, jeśli wiesz, kiedy wrócić",
        opis:
          "To JEDYNA rzecz, która zapala klientowi „wymaga działania dziś” — inaczej niż u leadów nie ma tu żadnej reguły czasowej, bo tempo kontaktu z klientem jest zbyt różne. Do daty dopisz „po co”: sama data bez powodu nic nie mówi po tygodniu. Ustawisz je i na desktopie, i w apce (Edytuj).",
      },
      {
        tytul: "6. Sprawdź zakładkę „Powiązane”, zanim zaczniesz pracę",
        opis:
          "Oferty, umowy i NDA, projekty, faktury — w jednym miejscu, z klikalnym przejściem. To tutaj odpowiadasz sobie na pytanie, od którego zależy start projektu: czy umowa jest podpisana.",
      },
      {
        tytul: "7. Nowy dokument rób wprost z karty klienta",
        opis:
          "„+ Nowa oferta” i „+ Nowa faktura” w zakładce „Powiązane” zakładają dokument już powiązany z tym klientem i od razu go otwierają. To ważniejsze, niż wygląda: dokument bez powiązania nie trafi na oś czasu klienta ani do kontaktu retencyjnego.",
      },
      {
        tytul: "8. Uzupełnij „Skąd przyszedł”",
        opis:
          "Kategoria źródła przenosi się z leada, ale klienta dodanego ręcznie wpisujesz sam. Po tym polu liczy się, które źródło naprawdę zamienia się w klientów — puste zostawia dziurę w Statystykach.",
      },
    ],
    automaty: [
      {
        tytul: "Kontakty kontrolne po wdrożeniu projektu",
        opis:
          "Gdy projekt tego klienta dostaje status „Wdrożone”, panel planuje sam dwa kontakty: +14 dni (moment największego zadowolenia — dobra chwila na prośbę o opinię) i +90 dni (kwartał używania — dobra chwila na kolejną propozycję). Widać je na karcie klienta i na Pulpicie w dniu terminu. Panel przygotowuje szkic wiadomości; wysyłkę klikasz Ty.",
      },
      {
        tytul: "Opinie same wracają na kartę",
        opis:
          "Ocena wystawiona przez klienta przez publiczny formularz ląduje przy projekcie, a na karcie klienta widać ją razem z komentarzem i — najważniejsze — ze zgodą na wykorzystanie jako referencji. Bez tej zgody opinii nie wolno pokazać na zewnątrz.",
      },
      {
        tytul: "Poczta dopina się po adresie",
        opis:
          "Mail od adresu, który jest na karcie klienta, trafia do jego kartoteki korespondencji i na oś kontaktu sam. Gdy dopiszesz albo poprawisz e-mail, panel od razu przeszukuje zaległą pocztę i dopina to, co przyszło, zanim ten adres istniał.",
      },
      {
        tytul: "Historia z czasów leada nie znika",
        opis:
          "Rozmowy sprzed awansu na klienta widać dalej, oznaczone „z leada”. Bez tego karta wyglądałaby, jakby klient wziął się znikąd.",
      },
      {
        tytul: "Retencja danych",
        opis:
          "Klienci — inaczej niż leady — NIE są usuwani automatycznie. To celowe: faktury trzeba trzymać pięć lat z obowiązku podatkowego, a klient bez danych zostawiłby fakturę bez nabywcy.",
      },
    ],
    pulapki: [
      {
        tytul: "Usunięcie klienta nie usuwa jego dokumentów",
        opis:
          "Oferty, faktury, projekty i umowy zostają — tylko przestają być z kimkolwiek powiązane. To celowe (faktura musi przeżyć), ale znaczy, że po skasowaniu klienta te dokumenty wypadają z jego osi czasu i z kontaktów retencyjnych. Do naprawiania takich sierot służy „Powiąż wstecz” w palecie poleceń.",
      },
      {
        tytul: "„Obsłużone” nie zmienia statusu relacji",
        opis:
          "Przesunięcie palcem po kliencie gasi przypomnienie i wpisuje dzisiejszy kontakt — i tyle. U leadów ten sam gest przestawia status, bo tam status to etap obsługi jednej sprawy; u klienta to długa oś relacji, której jedna rozmowa nie przesuwa.",
      },
      {
        tytul: "Osoba kontaktowa nie jest ozdobą",
        opis:
          "To jej imieniem wita się wiadomość retencyjna, którą panel przygotowuje. Puste pole daje „Cześć,” zamiast „Cześć Anno,” — i tego nie widać, dopóki nie przeczytasz gotowego szkicu.",
      },
      {
        tytul: "Dwie oferty dla tego samego klienta to nie pomyłka",
        opis:
          "Przycisk „+ Nowa oferta” za każdym razem robi nową — świadomie, bo druga oferta dla stałego klienta jest normalna. Panel pilnuje czego innego: nowy szkic zawsze od razu się otwiera, więc nie zostanie niewidoczny.",
      },
      {
        tytul: "Pełna kartoteka i praca hurtowa zostają przy biurku",
        opis:
          "Telefon i iPad mają wszystko, co potrzebne w terenie: profil, edycję, log rozmowy, przypomnienie, powiązane dokumenty i opinie. Tablicy kanban, operacji na wielu klientach naraz i eksportu CSV tam nie ma — to celowe zawężenie, nie brak.",
      },
    ],
    skroty: [
      { tytul: "1 / 2", opis: "Przełącza widoki: Tablica, Tabela." },
      { tytul: "/", opis: "Kursor do wyszukiwarki." },
      { tytul: "j / k", opis: "Ruch po liście w Tabeli." },
      { tytul: "Enter", opis: "Otwiera kartę zaznaczonego klienta." },
      { tytul: "1–4 (przy otwartej karcie)", opis: "Ustawia status relacji: Prospekt, Aktywny, Uśpiony, Stracony." },
      { tytul: "n", opis: "Nowy klient. Na iPadzie ⌘N, a ⌘F ustawia kursor w wyszukiwarce." },
      {
        tytul: "Telefon i iPad: przesunięcie palcem",
        opis:
          "W prawo — zadzwoń. W lewo — „Obsłużone” (tylko przy kliencie z zaległym przypomnieniem; przy pozostałych nie ma czego gasić). To samo jest w menu po przytrzymaniu wiersza, razem ze zmianą statusu i logowaniem rozmowy.",
      },
    ],
  },

  /* ────────────────────────────── OFERTY ────────────────────────────── */
  {
    id: "oferty",
    nazwa: "Oferty",
    gdzie: "Panel: czwarta pozycja w menu. Telefon: zakładka „Więcej” → Oferty. iPad: w panelu bocznym.",
    poCoTo:
      "Moment, w którym rozmowa zamienia się w liczby. Oferta zbiera zakres i cenę w jeden dokument, który klient dostaje linkiem i może podpisać sam — a jej akceptacja uruchamia całą resztę: zakłada projekt i szkic faktury.",
    kiedy:
      "Gdy wiesz już, czego klient potrzebuje i za ile chcesz to zrobić. Oraz zawsze wtedy, gdy klient odpowie — „tak” i „nie” zapisuje się TU, nie w głowie.",
    kroki: [
      {
        tytul: "1. Zacznij od „dla kogo”, nie od pustej kartki",
        opis:
          "„+ Nowa oferta” najpierw pyta o powiązanie. To ważniejsze, niż wygląda: oferta bez klienta nie trafi na jego oś czasu, a po zamknięciu projektu nie zaplanuje się kontakt kontrolny. Wybór leada dodatkowo awansuje go na klienta — pierwsza oferta jest sygnałem, że rozmowa jest realna.",
      },
      {
        tytul: "2. Złóż pozycje z gotowych klocków",
        opis:
          "„Wstaw z szablonu” wkłada cały szkielet oferty (pozycje + uwagi), „Z katalogu” dokłada pojedynczy komponent z cennika. Wszystko po wstawieniu jest w pełni edytowalne — szablon to punkt startowy, nie sztywny wzór.",
      },
      {
        tytul: "3. Ustaw ważność i walutę",
        opis:
          "Data ważności to jedyna rzecz, dzięki której panel wie, kiedy się o ofertę upomnieć. Waluta ma znaczenie dla klienta zagranicznego: wydruk liczy w niej, a po akceptacji przechodzi na fakturę.",
      },
      {
        tytul: "4. Wyślij mailem — status zmieni się sam",
        opis:
          "„Wyślij mailem” wysyła klientowi link do podglądu z możliwością podpisu i przestawia „Szkic” na „Wysłana”. Link możesz w każdej chwili unieważnić; wysyłka unieważnionym linkiem jest zablokowana, nowy trzeba wygenerować świadomie.",
      },
      {
        tytul: "5. Gdy klient mówi „tak”",
        opis:
          "„Akceptuj ofertę” zakłada projekt (opcjonalnie z szablonu) i szkic faktury z tymi samymi pozycjami, zamyka leada sukcesem i wpisuje wszystko na oś czasu klienta. Klient może zrobić to sam z linku — wtedy dostajesz powiadomienie.",
      },
      {
        tytul: "6. Gdy klient mówi „nie” — zapisz to i powiedz dlaczego",
        opis:
          "Ustaw status „Odrzucona”; panel zapyta o powód z krótkiej listy (za drogo, nie ten termin, wybrali kogoś innego, brak decyzji, inny). Robi się to z pigułki statusu na liście, z profilu oferty i z telefonu. Po kilkunastu ofertach to jedyne miejsce, z którego da się odczytać, na czym realnie przegrywasz.",
      },
      {
        tytul: "7. Po akceptacji — umowa",
        opis:
          "Na karcie zaakceptowanej oferty jest „Wygeneruj umowę”, a gdy umowa już istnieje — jej status i „Otwórz umowę”. Drugie kliknięcie nigdy nie zrobi drugiego dokumentu.",
      },
    ],
    automaty: [
      {
        tytul: "Oferta po terminie nie znika sama",
        opis:
          "Panel jej NIE zamyka za Ciebie — pokazuje ją na czerwono na liście, wypisuje na Pulpicie z przyciskiem „oznacz jako wygasła”, a na ekranie Ofert dopisuje pod „W toku”, ile z tej kwoty jest już martwe. Decyzja zostaje Twoja, bo przedłużenie terminu bywa równie sensowne jak zamknięcie.",
      },
      {
        tytul: "Akceptacja robi trzy rzeczy naraz",
        opis:
          "Projekt, szkic faktury i domknięcie leada powstają w jednej operacji — albo wszystko, albo nic. Dwa kliknięcia (albo Twoje i klienta jednocześnie) nie założą dwóch projektów.",
      },
      {
        tytul: "Stawka VAT na szkicu faktury podpowiada się z kraju",
        opis:
          "Pusty kraj albo Polska → 23%. Inny kraj → „np” (odwrotne obciążenie). To tylko podpowiedź na szkicu — stawkę zmieniasz w edytorze faktury przed wystawieniem.",
      },
    ],
    pulapki: [
      {
        tytul: "Oferta bez daty ważności jest niewidzialna dla przypominacza",
        opis:
          "Nie trafi ani do „Wygasają w 7 dni”, ani do listy po terminie. Nikt się o nią nie upomni — będzie wisieć w „W toku” tak długo, aż sam o niej pomyślisz.",
      },
      {
        tytul: "Wskaźniki nie przeliczają walut",
        opis:
          "Panel nie zna kursów i celowo ich nie pobiera. Jeśli masz oferty w euro i w złotówkach, sumy u góry dodają liczby bez przeliczania — jest o tym napisane pod kafelkami.",
      },
      {
        tytul: "Usunięcie oferty nie usuwa tego, co z niej powstało",
        opis:
          "Projekt i faktura założone przy akceptacji zostają — to już osobne, samodzielne dokumenty.",
      },
      {
        tytul: "Na telefonie ofert się nie tworzy",
        opis:
          "Telefon i iPad służą do podglądu, wysyłki i zamknięcia oferty statusem („klient odrzucił”, „wygasła”). Składanie pozycji i akceptacja — która od razu zakłada projekt i fakturę — zostają przy biurku. To celowe zawężenie, nie brak.",
      },
    ],
    skroty: [
      { tytul: "/", opis: "Kursor do wyszukiwarki (szuka po tytule i nazwie klienta)." },
      { tytul: "j / k", opis: "Ruch po liście ofert." },
      { tytul: "Enter", opis: "Otwiera zaznaczoną ofertę." },
      { tytul: "n", opis: "Nowa oferta." },
      {
        tytul: "Telefon: przesunięcie palcem",
        opis:
          "W lewo na wierszu — „Wyślij” i „Odrzucona”. To samo (plus „Wygasła”) jest w menu po przytrzymaniu wiersza.",
      },
    ],
  },
];

/** Moduł po `id` — do podstrony i do kotwic. */
export function modulInstrukcji(id: string): ModulInstrukcji | null {
  return MODULY.find((m) => m.id === id) ?? null;
}
