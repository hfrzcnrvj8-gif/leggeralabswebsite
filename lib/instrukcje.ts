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
    "Na razie opisane są Pulpit, Leady, Klienci, Oferty, Umowy i NDA, Projekty, Faktury, Katalog, Koszty oraz Poczta — moduły uznane za gotowe i sprawdzone na wszystkich urządzeniach. Kolejne dopisujemy tu po domknięciu każdego z nich, więc ten spis rośnie razem z aplikacją.",
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
      { tytul: "Telefon: przesunięcie palcem", opis: "Na liście leadów w prawo — „Obsłużone”, a zaraz obok „Zadzwoń” (przygaszony, bo wychodzi poza apkę). W skrzynce kandydatów w prawo — Weź, w lewo — Odrzuć. Zasada jest jedna w całej aplikacji: w prawo idzie to, co posuwa sprawę do przodu albo kończy ją dobrze, w lewo wyłącznie to, co odsuwasz od siebie. To samo jest w menu po przytrzymaniu wiersza." },
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
          "W prawo — „Obsłużone” (tylko przy kliencie z zaległym przypomnieniem; przy pozostałych nie ma czego gasić) i „Zadzwoń”. W lewo nie ma nic: przy kliencie nie ma czego odsuwać od siebie. To samo jest w menu po przytrzymaniu wiersza, razem ze zmianą statusu i logowaniem rozmowy.",
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
          "„Wstaw z szablonu” wkłada cały szkielet oferty (pozycje, bloki treści i uwagi), „Z katalogu” dokłada pojedynczy komponent z cennika. Kolejność pozycji zmieniasz strzałkami — klient czyta je z góry na dół. Wszystko po wstawieniu jest w pełni edytowalne: szablon to punkt startowy, nie sztywny wzór. Dobrze napisaną ofertę zapisz z powrotem przyciskiem „Zapisz jako szablon”.",
      },
      {
        tytul: "3. Napisz, co klient dostaje — nie tylko za ile",
        opis:
          "Sekcja „Treść oferty” to bloki, które klient czyta NAD cennikiem: kontekst, zakres, harmonogram, warunki. Sześć gotowych szkieletów wstawisz przyciskiem „+ Gotowa sekcja” i uzupełnisz w nawiasach. Bez nich oferta jest samą tabelą cen — a ceny bez opisu porównuje się wyłącznie po kwocie.",
      },
      {
        tytul: "4. Rozważ pozycje „do wyboru”",
        opis:
          "Kwadracik przy pozycji robi z niej dodatek, który klient sam zaznacza na swojej stronie — kwota przelicza mu się od razu, a na fakturę po akceptacji trafia tylko to, co wybrał. Tak sprzedasz wariant bez pisania drugiej oferty.",
      },
      {
        tytul: "5. Ustaw ważność i walutę",
        opis:
          "Ważność ustawiasz jednym kliknięciem: 7, 14 albo 30 dni od dziś, albo z kalendarza — pod siatką widzisz od razu, ile dni to od dzisiaj. Na dokumencie stoi zdanie, że kwoty są NETTO i nie zawierają VAT; dla klienta spoza Polski dochodzi zdanie o możliwym odwrotnym obciążeniu. To jedyna rzecz, dzięki której panel wie, kiedy się o ofertę upomnieć. Waluta ma znaczenie dla klienta zagranicznego: wydruk liczy w niej, a po akceptacji przechodzi na fakturę.",
      },
      {
        tytul: "6. Jeśli sprzedajesz oszczędność czasu — pokaż ją liczbą",
        opis:
          "W „Zwrot dla klienta” wpisz, ile godzin miesięcznie wdrożenie oszczędza i ile kosztuje godzina u klienta. Dokument sam policzy oszczędność i czas zwrotu, zaokrąglając miesiące w GÓRĘ i podpisując, że to szacunek z rozmowy. Puste pola = bloku nie ma.",
      },
      {
        tytul: "7. Wyślij mailem albo skopiuj link",
        opis:
          "Wysyłka zamyka treść oferty — od tej chwili poprawki idą przez nową wersję, więc przejrzyj dokument, zanim klikniesz. „Wyślij mailem” wysyła klientowi link do podglądu z możliwością podpisu i przestawia „Szkic” na „Wysłana”. Jeśli wolisz wysłać samemu — „Kopiuj link dla klienta” (także pod prawym przyciskiem myszy na liście). UWAGA: publiczna strona nie pokazuje SZKICÓW, więc przy kopiowaniu linku do szkicu panel zapyta, czy oznaczyć ofertę jako wysłaną. Link możesz w każdej chwili unieważnić; wysyłka unieważnionym linkiem jest zablokowana.",
      },
      {
        tytul: "8. Sprawdzaj, czy klient otworzył",
        opis:
          "Po wysyłce w profilu oferty i na liście widać, ile razy klient otworzył link i kiedy ostatnio. Pierwsze otwarcie zapala dzwonek — to zwykle najlepszy moment na telefon. Jeśli po pięciu dniach nadal cisza, oferta pojawi się na Pulpicie w „Oferty bez decyzji” z gotowym przypomnieniem do wysłania.",
      },
      {
        tytul: "9. Gdy klient mówi „tak”",
        opis:
          "„Akceptuj ofertę” zakłada projekt (opcjonalnie z szablonu) i szkic faktury z tymi samymi pozycjami, zamyka leada sukcesem i wpisuje wszystko na oś czasu klienta. Klient może zrobić to sam z linku — wtedy dostajesz powiadomienie.",
      },
      {
        tytul: "10. Gdy klient mówi „nie” — zapisz to i powiedz dlaczego",
        opis:
          "Ustaw status „Odrzucona”; panel zapyta o powód z krótkiej listy (za drogo, nie ten termin, wybrali kogoś innego, brak decyzji, inny). Robi się to z pigułki statusu na liście, z profilu oferty i z telefonu. Po kilkunastu ofertach to jedyne miejsce, z którego da się odczytać, na czym realnie przegrywasz.",
      },
      {
        tytul: "11. Gdy klient chce czegoś inaczej",
        opis:
          "Na swojej stronie klient ma obok akceptacji drugi przycisk: „Chcesz czegoś inaczej?”. Jego wiadomość trafia do dzwonka, na oś czasu klienta i mailem do Ciebie. Poprawioną ofertę zrób przyciskiem „Nowa wersja oferty” — poprzednia zostanie oznaczona jako zastąpiona i wypadnie ze skuteczności, zamiast liczyć się jako druga przegrana szansa.",
      },
      {
        tytul: "12. Po akceptacji — umowa",
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
        tytul: "Klient dostaje potwierdzenie, Ty dostajesz sygnał",
        opis:
          "Po akceptacji e-podpisem klient dostaje maila z numerem referencyjnym i linkiem, a na samym dokumencie pojawia się blok „Potwierdzenie akceptacji” (kto, kiedy, numer). Ty w tym czasie dostajesz powiadomienie w dzwonku.",
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
        tytul: "Wysłanej oferty już nie poprawisz — i to jest celowe",
        opis:
          "Po wysłaniu treść jest zamknięta: pozycje, ceny, bloki i dane klienta. Powód jest prosty — klient patrzy na ten sam link, więc cicha poprawka znaczyłaby, że dokument „u niego” przestaje być tym, co dostał. Panel pilnuje tego po stronie serwera, nie tylko w oknie edycji, więc nie obejdziesz tego z telefonu ani z drugiej karty. Wolne zostają: status, powód odrzucenia, data ważności i powiązania — to praca handlowa, nie zmiana treści. Poprawka merytoryczna idzie przez „Nową wersję oferty”. Zaakceptowana oferta jest zamknięta w całości, bo powstały z niej projekt i faktura.",
      },
      {
        tytul: "Klient widzi to, co dostał — nie to, co jest w bazie",
        opis:
          "W chwili wysyłki panel zapisuje kopię oferty i to JĄ pokazuje pod publicznym linkiem. Nawet gdyby coś w bazie się później zmieniło, klient ma przed sobą dokument z dnia wysłania — a Ty masz czym się posłużyć, gdyby kiedyś doszło do sporu. Żywy zostaje tylko status: po podpisaniu klient nie zobaczy już przycisku akceptacji.",
      },
      {
        tytul: "Duplikat mnoży, wersja zastępuje",
        opis:
          "„Duplikuj” robi drugą, niepowiązaną ofertę — to jest w porządku, gdy sprzedajesz temu samemu klientowi coś nowego. „Nowa wersja” zastępuje: poprzednia wypada z liczników. Użycie duplikatu do poprawki zakresu zaniża skuteczność, bo jedna rozmowa liczy się wtedy dwa razy.",
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
      { tytul: "Telefon i iPad", opis: "Oferty działają na telefonie w komplecie poza cennikiem: treść, ślad otwarcia, przypomnienia, udostępnienie linku, akceptacja z wyborem szablonu projektu, odrzucenie z powodem i nowa wersja. Pozycji i cen nie składa się kciukiem — to zostaje przy biurku. Na iPadzie lista i profil stoją obok siebie." },
      { tytul: "n", opis: "Nowa oferta." },
      { tytul: "Prawy przycisk myszy", opis: "Menu na wierszu listy: wysyłka, przypomnienie, kopiowanie linku, zamknięcie statusem, duplikat, usunięcie." },
      {
        tytul: "Telefon: przesunięcie palcem",
        opis:
          "W prawo — „Wyślij”. W lewo — „Odrzucona”. To samo (plus „Wygasła”) jest w menu po przytrzymaniu wiersza.",
      },
    ],
  },

  /* ────────────────────────────── UMOWY I NDA ─────────────────────────── */
  {
    id: "umowy",
    nazwa: "Umowy i NDA",
    gdzie: "Panel: piąta pozycja w menu. Telefon: zakładka „Więcej” → Umowy. iPad: w panelu bocznym.",
    poCoTo:
      "Papier przed pracą. Podpisana umowa to jedyna rzecz, która odblokowuje start projektu dla klienta — a NDA idzie jeszcze wcześniej, przed rozmową, w której padną szczegóły cudzych systemów. Oba dokumenty druga strona podpisuje elektronicznie, pod linkiem z maila.",
    kiedy:
      "NDA: zanim usiądziesz do rozmowy odkrywczej. Umowa: zaraz po akceptacji oferty — panel wygeneruje ją jednym przyciskiem z karty oferty.",
    kroki: [
      {
        tytul: "1. Umowa robi się z oferty, nie od zera",
        opis:
          "Na karcie zaakceptowanej oferty jest „Wygeneruj umowę” — przenosi dane klienta, zakres z pozycji, kwotę, walutę i język. Drugie kliknięcie nigdy nie zrobi drugiego dokumentu: karta pokazuje wtedy status istniejącej umowy i „Otwórz umowę”. NDA powstaje analogicznie z profilu leada („Przygotuj NDA”). Wolnostojący szkic obu typów zrobisz przyciskiem + na liście Umów.",
      },
      {
        tytul: "2. Sprawdź to, czego oferta nie znała",
        opis:
          "Termin realizacji, uwagi, kraj drugiej strony (jest na wydruku) i walutę wynagrodzenia. Klauzule są stałe — jeden szablon na wszystkie umowy — i świadomie nie da się ich edytować per dokument. Nad dokumentem stoi ostrzeżenie, że treść prawna czeka na weryfikację prawnika; to nie jest usterka, tylko stan faktyczny do czasu rejestracji firmy.",
      },
      {
        tytul: "3. „Wyślij mailem” — i od tej chwili druga strona widzi migawkę",
        opis:
          "Mail idzie z linkiem do podglądu i e-podpisu; status przeskakuje ze „Szkic” na „Wysłana”. W tym samym momencie panel zapisuje MIGAWKĘ treści: to, co druga strona przeczytała, zostaje zamrożone. Jeśli poprawisz dokument w panelu, ona dalej widzi wersję z wysyłki — dopóki nie wyślesz ponownie. To jest dowód na wypadek sporu, nie ozdoba.",
      },
      {
        tytul: "4. Podpis: elektroniczny albo Twój, ręczny",
        opis:
          "Druga strona wpisuje imię i nazwisko pod dokumentem — panel zapisuje datę, IP i przeglądarkę jako dowód złożenia oświadczenia woli, a Ty dostajesz powiadomienie. Jeśli podpisaliście papierowo, kliknij „Oznacz jako podpisaną” (działa też z telefonu). Statusem tego nie zrobisz — podpis to data, nie etykieta.",
      },
      {
        tytul: "5. Gdy nie podpiszą — zamknij sprawę z powodem",
        opis:
          "Status „Odrzucona” pyta o powód z krótkiej listy (zapisy nie do przyjęcia, własny wzór umowy, zmiana planów, brak decyzji, inny). Powód ląduje na osi czasu klienta. Przy NDA to jedyne miejsce, w którym zostaje ślad, dlaczego kontrahent nie podpisał. Robi się to z pigułki na liście, z profilu i z telefonu.",
      },
      {
        tytul: "6. Zmiana po podpisie: aneks, nie poprawka",
        opis:
          "Podpisanej umowy nie da się edytować — obie strony mają jej kopię. Zmianę wprowadza „Sporządź aneks” (na liście i w profilu podpisanej umowy). Aneks pokazuje WYŁĄCZNIE to, co się zmienia, w układzie „było → jest”, i ma własny numer, własny link i własny podpis. Oryginał zostaje podpisany i dalej obowiązuje. Drugi aneks liczy „było” od ostatniego PODPISANEGO aneksu, nie od pierwotnej umowy.",
      },
      {
        tytul: "7. Umowa ciągła: wypełnij okres obowiązywania",
        opis:
          "„Rodzaj umowy” wybiera zestaw klauzul (wdrożeniowa / utrzymaniowa / PoC). Przy utrzymaniowej wypełnij sekcję „Obowiązywanie”: od, do, „przedłuża się sama” i okres wypowiedzenia. To jedyna rzecz w całym panelu, która dzieje się SAMA i po terminie nie da się jej odkręcić — umowa odnawialna przedłuża się w milczeniu. Panel zacznie się o tym przypominać na 60 dni przed (albo wcześniej, jeśli wypowiedzenie jest dłuższe).",
      },
      {
        tytul: "8. Podpisz po swojej stronie",
        opis:
          "Dokument ma dwie rubryki: Wykonawca i Zamawiający. „Podpisz po naszej stronie” wstawia Twoje imię (z ustawień firmy, pole „Podpisuje umowy”) i datę — druga strona widzi wtedy dokument już podpisany przez Ciebie. Cofnąć da się to tylko dopóki ona nie podpisała.",
      },
      {
        tytul: "9. Podepnij projekt",
        opis:
          "Pole „Projekt” w nagłówku umowy decyduje, który projekt ta umowa odblokowuje. Bez tego bramka startu („projekt z klientem wymaga podpisanej umowy”) będzie nie do przejścia, mimo że umowa leży podpisana.",
      },
    ],
    automaty: [
      {
        tytul: "Cisza po wysyłce liczy się sama",
        opis:
          "Dokument wysłany i niepodpisany od tygodnia odzywa się na Pulpicie i w porannym mailu, a licznik „cisza od N dni” widać też na liście Umów i w telefonie. Ponowna wysyłka zeruje ten zegar — bo właśnie przypomniałeś.",
      },
      {
        tytul: "Podpis drugiej strony dzwoni",
        opis:
          "E-podpis pod linkiem wywołuje powiadomienie i wpis na osi czasu klienta. Twoje własne „oznacz jako podpisaną” nie dzwoni — wiesz, że kliknąłeś.",
      },
      {
        tytul: "Dowód e-podpisu znika po sześciu latach",
        opis:
          "IP i przeglądarka osoby podpisującej czyszczą się automatycznie po terminie przedawnienia roszczeń. Sam podpis (imię, nazwisko, data) zostaje — to treść drukowana pod dokumentem.",
      },
    ],
    pulapki: [
      {
        tytul: "Podpisanego dokumentu nie cofniesz statusem",
        opis:
          "Ani nie usuniesz. To celowe: drugą kopię ma druga strona. Pomyłkę naprawia aneks — a jeśli dokument nigdy nie powinien powstać, zostaw go zamkniętego zamiast kasować historię.",
      },
      {
        tytul: "NDA się nie aneksuje",
        opis:
          "Nie ma w nim warunków handlowych, więc nie ma czego zmieniać — potrzebujesz innych zapisów, sporządź nowe NDA. Aneksu do aneksu też nie ma: kolejny robi się zawsze do umowy.",
      },
      {
        tytul: "Aneks bez zmian nie da się wysłać",
        opis:
          "Świeży aneks startuje z warunkami umowy, więc na starcie nie zmienia niczego i panel odmawia jego wysyłki. Najpierw zmień zakres, kwotę, walutę albo termin — dopiero wtedy ma treść.",
      },
      {
        tytul: "Klauzule zostają po polsku",
        opis:
          "Język wydruku (PL/EN/DE) dotyczy nagłówków i przycisków; sama treść prawna jest na razie tylko polska i czeka na tłumacza oraz prawnika. Na wydruku obcojęzycznym stoi o tym zdanie.",
      },
    ],
    skroty: [
      { tytul: "/", opis: "Kursor do wyszukiwarki (szuka po drugiej stronie, zakresie prac i numerze dokumentu)." },
      { tytul: "j / k", opis: "Ruch po liście dokumentów." },
      { tytul: "Enter", opis: "Otwiera zaznaczony dokument." },
      { tytul: "n", opis: "Nowa umowa." },
      {
        tytul: "Telefon i iPad",
        opis:
          "Podgląd dokumentu, wysyłka do podpisu, „oznacz jako podpisaną”, „nie podpisali” z powodem, filtr statusu i licznik ciszy. Aneks pokazuje na telefonie tabelę „było → jest”. Tworzenie umowy i sporządzanie aneksu zostają przy biurku.",
      },
      {
        tytul: "Telefon: przesunięcie palcem",
        opis: "W prawo — „Wyślij”, a przy wysłanym dokumencie także „Przypomnij”. W lewo — „Nie podpisali”. To samo jest w menu po przytrzymaniu wiersza.",
      },
    ],
  },
  {
    id: "projekty",
    nazwa: "Projekty",
    gdzie: "Panel: szósta pozycja w menu. Telefon: zakładka Projekty. iPad: pozycja w panelu bocznym, z własnym trybem „oś czasu”.",
    poCoTo:
      "Miejsce, w którym umowa zamienia się w robotę: co jest do zrobienia, na kiedy, ile już zeszło i czy na tym projekcie w ogóle zarabiasz. Tablica pokazuje etap, oś czasu — kto się z kim mija w kalendarzu.",
    kiedy:
      "Projekt zakłada się sam w chwili akceptacji oferty. Ręcznie — gdy robisz coś bez oferty (własny produkt, próbne wdrożenie, praca wewnętrzna).",
    kroki: [
      {
        tytul: "1. Dwie osie, które nie mają ze sobą nic wspólnego",
        opis:
          "„Status” mówi, na jakim ETAPIE jest praca (Pomysł → Planowanie → W trakcie → Testy / review → Wdrożone, plus Wstrzymane). „Zdrowie” mówi, czy idzie DOBRZE (Na dobrej drodze / Zagrożony / Zerwany) i ustawiasz je ręcznie — panel nigdy nie wylicza go z terminów. Projekt może być „W trakcie” i „Zagrożony” naraz; to nie sprzeczność, tylko dwa różne pytania.",
      },
      {
        tytul: "2. Start dla klienta wymaga podpisanej umowy",
        opis:
          "Przestawienie projektu Z KLIENTEM na „W trakcie” odbije się, dopóki nie ma podpisanej umowy podpiętej do tego projektu — to jedyna twarda blokada w całym panelu. Projekt bez klienta (wewnętrzny, próbny) startuje bez papieru. Umowę i faktury tego projektu widzisz w sekcji „Dokumenty” w jego profilu, więc nie musisz sprawdzać w drugim module, czy papier istnieje.",
      },
      {
        tytul: "3. Kamienie milowe i zadania",
        opis:
          "Kamień to termin z nazwą („Makiety zaakceptowane”), zadanie to jedna rzecz do odhaczenia. Zadania mogą wisieć pod kamieniem albo luzem. Kolejność jednych i drugich zmienia się przeciąganiem — na wszystkich trzech ekranach. Szablon projektu (przy zakładaniu) wstawia komplet kamieni z terminami liczonymi od startu.",
      },
      {
        tytul: "4. Stoper zamiast pamiętania",
        opis:
          "Czas liczy się NA SERWERZE od momentu startu, więc zamknięcie apki albo restart telefonu niczego nie gubi. Na telefonie stoper odpalisz przesunięciem wiersza w prawo, a chodzący pomiar widać na Wyspie. Pomiar można przypiąć do konkretnego zadania — wtedy wiesz nie tylko ile, ale i na czym.",
      },
      {
        tytul: "5. Rentowność liczy się sama, ale tylko ze złotówek",
        opis:
          "Przychód to faktury tego projektu (z rabatami, bez proform i szkiców), koszty — wydatki podpięte do projektu. Z tego wychodzi zysk i efektywna stawka godzinowa, czyli jedyna liczba mówiąca, czy ta praca była warta czasu. Faktury w innych walutach są pomijane i panel pisze o tym wprost — nie przelicza kursów.",
      },
      {
        tytul: "6. Wystaw fakturę prosto stąd",
        opis:
          "Przycisk „Wystaw fakturę” w sekcji Dokumenty zakłada szkic z przepisanymi danymi nabywcy i gotowym powiązaniem. Pozycje zostają PUSTE — świadomie: kwota wzięta z kamieni milowych byłaby liczbą, której nikt nie zatwierdził. Przycisk pojawia się dopiero przy podpiętym kliencie, bo bez niego nie ma na kogo wystawić.",
      },
      {
        tytul: "7. Zamknięcie: poproś o opinię",
        opis:
          "Po „Wdrożone” zakładka „Opinia klienta” wysyła prośbę o ocenę (jakość, terminowość, komunikacja) pod linkiem. Widać, kiedy prośba poszła i czy jest odpowiedź; opinię możesz też wpisać ręcznie, jeśli klient powiedział ją przez telefon.",
      },
      {
        tytul: "8. Oś czasu: gdzie się mijają terminy",
        opis:
          "Pasek biegnie od startu do terminu, a jego KOLOR to status projektu — ten sam, co pigułka na tablicy. Kropki to kamienie milowe, pionowa złota kreska to dziś. Pasek po terminie robi się pomarańczowy, a po dwóch tygodniach czerwony. Naprzemienne pasy co 14 dni to sam rytm patrzenia, nie „sprinty” — nic się do nich nie przypisuje. Na iPadzie oś czasu jest natywnie (ikona w nagłówku listy), na telefonie jej nie ma i mieć nie będzie: na tej szerokości pasmo czasu przestaje odpowiadać na pytanie, po które się je otwiera.",
      },
    ],
    automaty: [
      {
        tytul: "Checklista wdrożeniowa startuje sama",
        opis:
          "Nowy projekt — nieważne, czy z oferty, czy z ręki — dostaje komplet pozycji wdrożeniowych do odhaczenia. Nie trzeba o niej pamiętać ani jej włączać.",
      },
      {
        tytul: "Termin po czasie odzywa się na Pulpicie",
        opis:
          "Projekt z minionym terminem, który nie jest „Wdrożone”, trafia na Pulpit i do porannego maila. Reguła jest deterministyczna: minął termin i nie jest zamknięty. Żadnego zgadywania.",
      },
      {
        tytul: "Bramka umowy pilnuje się sama",
        opis:
          "Blokada startu bez papieru stoi po stronie serwera, nie w interfejsie — nie da się jej ominąć ani z telefonu, ani wpisując status inaczej.",
      },
    ],
    pulapki: [
      {
        tytul: "Zdrowie nie zmienia się samo",
        opis:
          "To Twoja ocena, nie wyliczenie. Projekt po terminie NIE zrobi się „Zagrożony” z automatu — jeśli chcesz, żeby ktoś (Ty za miesiąc) to zobaczył, ustaw ręcznie.",
      },
      {
        tytul: "„Na dobrej drodze” nie ma koloru i to jest celowe",
        opis:
          "Zdrowie odzywa się barwą tylko wtedy, gdy jest źle — pomarańcz przy zagrożonym, czerwień przy zerwanym. Zieleń w całej aplikacji znaczy „skończone sukcesem”, więc projekt idący zgodnie z planem świeciłby tym samym kolorem, co projekt już zamknięty. Brak alarmu to dobra wiadomość.",
      },
      {
        tytul: "Kolejność zadań a ich kamień to dwie różne rzeczy",
        opis:
          "Przeciąganie zmienia kolejność w obrębie jednej grupy. Żeby przenieść zadanie POD inny kamień, użyj wyboru kamienia w samym zadaniu.",
      },
      {
        tytul: "Usunięty projekt zabiera swoją historię",
        opis:
          "Kamienie, zadania, wpisy dziennika i pomiary czasu znikają razem z nim. Faktury i umowy zostają (są własnymi dokumentami), ale tracą powiązanie. Projekt, którego nie chcesz widzieć, lepiej oznaczyć „Wstrzymane”.",
      },
    ],
    skroty: [
      { tytul: "/", opis: "Kursor do wyszukiwarki projektów." },
      { tytul: "j / k", opis: "Ruch po liście." },
      { tytul: "Enter", opis: "Otwiera zaznaczony projekt." },
      { tytul: "n", opis: "Nowy projekt (także z szablonu)." },
      { tytul: "1–6", opis: "Zmiana statusu przy otwartym profilu." },
      {
        tytul: "Telefon i iPad",
        opis:
          "Podgląd, stoper, odhaczanie zadań i pozycji wdrożenia, zmiana statusu i zdrowia, dziennik, prośba o opinię. Zakładanie projektu i planowanie kamieni od zera zostaje przy biurku. iPad ma dodatkowo oś czasu.",
      },
      {
        tytul: "Telefon: przesunięcie palcem",
        opis:
          "W prawo na wierszu projektu — stoper (drugie przesunięcie go zatrzymuje). W lewo nie ma nic: projektu się nie odsuwa od siebie jednym gestem. Kamienie i zadania kasuje się przesunięciem w lewo.",
      },
    ],
  },
  {
    id: "faktury",
    nazwa: "Faktury",
    gdzie: "Panel: pozycja w menu pod Umowami. Telefon i iPad: „Więcej” → Faktury. Z profilu projektu wchodzisz w sekcji „Dokumenty”.",
    poCoTo:
      "Ostatnie dwa kroki lejka: wystawienie i pilnowanie, żeby przelew naprawdę przyszedł. Tu mieszka rejestr sprzedaży, windykacja i KSeF.",
    kiedy:
      "Fakturę zakłada się z projektu albo z oferty (dane nabywcy przepisują się same), rzadziej ręcznie. Szkic można poprawiać do woli; wystawienie nadaje numer i zamyka treść.",
    kroki: [
      {
        tytul: "1. Szkic wolno wszystko, wystawiona już nie",
        opis:
          "Dopóki faktura nie ma numeru, jest szkicem i zmienia się bez ograniczeń. „Wystaw fakturę” nadaje numer z ciągłej numeracji i od tej chwili TREŚĆ jest zablokowana — nazwy nabywcy, kwot ani waluty nie da się już podmienić. Status i powiązania zostają wolne, bo to nie treść dokumentu. Wystawionej faktury nie da się też usunąć: zostawiłaby dziurę w numeracji. Jedyne drogi wyjścia to „Anulowana” (numer zostaje w rejestrze) albo korekta.",
      },
      {
        tytul: "2. Korekta to nowy dokument, nie edycja starego",
        opis:
          "„Utwórz korektę” zakłada nowy szkic, w którym wpisujesz stan PO korekcie — panel sam pokazuje różnicę wobec faktury pierwotnej i to ją wysyła do KSeF. Oryginał zostaje nietknięty; obie faktury widzisz potem powiązane ze sobą.",
      },
      {
        tytul: "3. Trzy rodzaje dokumentu, jeden rejestr",
        opis:
          "„Faktura” to dokument fiskalny i liczy się do przychodu. „Proforma” nie — to prośba o zapłatę z własną numeracją, którą można potem jednym ruchem przekształcić w fakturę. „Faktura zaliczkowa” bierze pieniądze z góry, a późniejsza faktura końcowa ją rozlicza (wybierasz ją z listy, a panel odejmuje kwotę zaliczki od reszty do zapłaty).",
      },
      {
        tytul: "4. Rabat siedzi na pozycji, nie na fakturze",
        opis:
          "Rabat wpisuje się jako procent przy konkretnej pozycji i liczy się od kwoty netto, PRZED VAT-em. Nie ma osobnego rabatu na całą fakturę — ten sam efekt daje wpisanie tego samego procentu na każdej pozycji. Wszystkie kwoty w panelu (Pulpit, Statystyki, rentowność projektu, wezwania) liczą się z rabatem.",
      },
      {
        tytul: "5. Kolor mówi o pieniądzach, nie o urzędzie",
        opis:
          "Kolorowa pigułka niesie status PŁATNOŚCI: szary szkic, fioletowa „Wystawiona” (czekasz na ich przelew), zielona „Opłacona”, złota „Po terminie”. Osobno, z samej daty, liczy się PILNOŚĆ — termin robi się pomarańczowy zaraz po terminie i czerwony po dwóch tygodniach. Plakietka KSeF jest świadomie SZARA i mówi słowem („KSeF ✓”), żeby zielone „przyjęte przez urząd” nie wyglądało jak „zapłacone”. Czerwona robi się tylko przy odrzuceniu.",
      },
      {
        tytul: "6. Windykacja: przypomnienie ma poziomy",
        opis:
          "„Przypomnij” wysyła maila, którego ton rośnie z liczbą dni po terminie — od uprzejmego przypomnienia po wezwanie do zapłaty z odsetkami. Odsetki liczą się ze stawki, którą wpisujesz RĘCZNIE w Danych firmy: panel nigdy sam jej nie zgaduje ani nie aktualizuje. Historia wysyłek zostaje na fakturze, więc widać ile poszło i na jakim poziomie.",
      },
      {
        tytul: "7. KSeF stoi na środowisku testowym",
        opis:
          "Wysyłka działa end-to-end, ale na serwerach TESTOWYCH Ministerstwa — faktury nie mają mocy prawnej. Produkcja odblokuje się dopiero po rejestracji firmy. Kafel na górze listy liczy miesięczną sprzedaż wobec progu, poniżej którego mikrofirma może w 2026 fakturować poza KSeF, i ostrzega po przekroczeniu.",
      },
      {
        tytul: "8. Waluta jest z listy i panel nie przelicza kursów",
        opis:
          "Do wyboru PLN, EUR, USD i GBP — nic spoza tej listy nie wejdzie. Każda kwota pokazuje się w walucie SWOJEGO dokumentu, a sumy w KPI liczą się osobno dla każdej waluty (nie ma jednej liczby „razem”). Przeliczaniem kursów panel się nie zajmuje i mówi o tym wprost tam, gdzie to ma znaczenie — na przykład przy rentowności projektu.",
      },
      {
        tytul: "9. Faktury cykliczne wystawiają się same",
        opis:
          "Szablon z pozycjami i cyklem („co miesiąc”) zakłada szkic w wyznaczonym dniu. Szkic, nie gotową fakturę — numer nadajesz Ty, po sprawdzeniu. Szablon można wyłączyć bez kasowania.",
      },
    ],
    skroty: [
      { tytul: "/", opis: "Kursor do wyszukiwarki faktur (numer, klient)." },
      { tytul: "j / k", opis: "Ruch po liście." },
      { tytul: "Enter", opis: "Otwiera zaznaczoną fakturę." },
      {
        tytul: "Bez „n”",
        opis:
          "Faktury świadomie nie zakłada się skrótem — zaczyna się ją od projektu albo oferty, żeby dane nabywcy i powiązania przepisały się same.",
      },
      {
        tytul: "Telefon i iPad",
        opis:
          "Podgląd dokumentu, wysyłka mailem, oznaczenie opłaty i przypomnienie o zaległości. Zakładanie faktury i edycja pozycji zostają przy biurku — to praca na kilkanaście pól, nie na kciuk.",
      },
      {
        tytul: "Telefon: przesunięcie palcem",
        opis:
          "W lewo na wierszu faktury — dwie osobne akcje: „Przypomnij” i „Oznacz opłaconą”. W prawo nie ma nic.",
      },
    ],
    automaty: [
      {
        tytul: "Numer nadaje się sam i nie ma w nim dziur",
        opis:
          "Kolejny numer bierze się z ciągłej numeracji rocznej w chwili wystawienia. Dlatego wystawionej faktury nie da się usunąć — zostałaby luka, której nie wolno mieć. Ponowne kliknięcie „Wystaw” nie nadaje drugiego numeru.",
      },
      {
        tytul: "Wpłata na całość sama zamyka fakturę",
        opis:
          "Zarejestrowanie wpłaty pokrywającej resztę przestawia status na „Opłacona”. Usunięcie tej wpłaty cofa go z powrotem — status nie zostaje na „opłacona” po wycofaniu pieniędzy. Wpłata częściowa statusu nie rusza.",
      },
      {
        tytul: "Zaległości odzywają się bez pytania",
        opis:
          "Faktura po terminie trafia na Pulpit i do porannego maila. Reguła jest deterministyczna: minął termin płatności i status nie jest „Opłacona” ani „Anulowana”.",
      },
      {
        tytul: "Faktura cykliczna zakłada SZKIC, nie gotowy dokument",
        opis:
          "W dniu z szablonu powstaje szkic z przepisanymi pozycjami. Numer nadajesz Ty, po sprawdzeniu — panel nigdy nie wystawia dokumentu fiskalnego sam.",
      },
    ],
    pulapki: [
      {
        tytul: "Proforma to NIE faktura, choć wygląda podobnie",
        opis:
          "Proforma ma własną numerację i nie liczy się do przychodu ani do progu KSeF. Jeśli szukasz brakujących pieniędzy w Statystykach, sprawdź najpierw, czy dokument nie jest przypadkiem proformą.",
      },
      {
        tytul: "Faktura bez daty wystawienia wypada z liczników",
        opis:
          "KPI Pulpitu i sumy miesięczne liczą się po dacie wystawienia. Faktura, która jej nie ma, nie pojawi się w żadnej z tych liczb — a wygląda w rejestrze normalnie.",
      },
      {
        tytul: "Przypomnienie potrzebuje adresu e-mail klienta",
        opis:
          "Bez adresu na fakturze windykacja nie ma dokąd wysłać maila i po cichu nic nie robi. Adres uzupełnia się na fakturze albo na karcie klienta.",
      },
      {
        tytul: "„Po terminie” to złoto, nie czerwień",
        opis:
          "Faktura spóźniona o dzień i spóźniona o pół roku mają ten sam STATUS. Różnicę pokazuje kolor TERMINU obok — pomarańczowy zaraz po terminie, czerwony po dwóch tygodniach. Patrz na datę, nie na samą pigułkę.",
      },
      {
        tytul: "Wysłana faktura pokazuje klientowi migawkę",
        opis:
          "Publiczny link pokazuje dokument w stanie z chwili wysyłki. Zmiana czegokolwiek później (o ile w ogóle przejdzie przez blokadę) nie zmieni tego, co klient już widział.",
      },
    ],
  },

  /* ────────────────────────────── KATALOG ───────────────────────────── */
  {
    id: "katalog",
    nazwa: "Katalog",
    gdzie: "Panel: menu po lewej → Katalog. Telefon i iPad: „Więcej” → Katalog. Przy pozycjach oferty i faktury: przycisk „Z katalogu”.",
    poCoTo:
      "Magazyn części, z których składasz oferty i faktury — sprzęt, software, robocizna, serwis. To jedyne miejsce, w którym mieszka KOSZT ZAKUPU, czyli druga połowa każdej marży.",
    kiedy:
      "Wpisujesz komponent wtedy, kiedy poznajesz jego cenę — po wycenie od dostawcy, często w drodze (dlatego telefon ma pełną edycję). Wyjmujesz go przy biurku, składając ofertę.",
    kroki: [
      {
        tytul: "1. Cena bazowa to ta, która wchodzi na dokument",
        opis:
          "Cena bazowa (netto) jest kwotą, którą przycisk „Z katalogu” wstawia na pozycję oferty albo faktury. Widełki „od–do” są tylko podpowiedzią zakresu dla Ciebie — nigdzie się same nie wstawiają. Dolna granica nie może być wyższa od górnej; taki zapis odbije się z komunikatem, zamiast po cichu zniknąć z widoku.",
      },
      {
        tytul: "2. Koszt zakupu i marża są wyłącznie Twoje",
        opis:
          "Koszt zakupu żyje TYLKO w katalogu. Nie kopiuje się na pozycję dokumentu i nie ma jak trafić na wydruk ani na publiczny link dla klienta. Marża liczy się od ceny sprzedaży (ile z ceny jest zyskiem). Jeśli wyjdzie ujemna — czyli sprzedajesz poniżej kosztu — pokaże się na czerwono, w panelu i w telefonie.",
      },
      {
        tytul: "3. Waluta pozycji jest jej własna",
        opis:
          "Komponent kupowany w euro trzymaj w euro. Panel NIE przelicza kursów: wstawiając taką pozycję do dokumentu w innej walucie, dostaniesz pytanie i kwota wejdzie bez zmiany. To świadome — kurs z dnia zakupu zna tylko właściciel.",
      },
      {
        tytul: "4. Pozycja na dokumencie to niezależna kopia",
        opis:
          "W chwili wstawienia dokument zapisuje własną kopię nazwy, ceny, VAT-u i jednostki. Późniejsza zmiana ceny w katalogu — albo usunięcie komponentu — nie rusza ani jednej wystawionej oferty czy faktury. Działa to tak samo, jak dane nabywcy przepisane z karty klienta.",
      },
      {
        tytul: "5. Pozycję z faktury można odłożyć do katalogu",
        opis:
          "Ikona zakładki obok wiersza faktury zapisuje tę pozycję jako komponent — razem z walutą dokumentu. Wpisujesz raz, korzystasz zawsze.",
      },
    ],
    automaty: [
      {
        tytul: "Katalog startowy",
        opis:
          "Przy pierwszym uruchomieniu wjeżdża gotowa biblioteka komponentów wdrożenia lokalnego LLM (trzy poziomy sprzętu, software, robocizna, serwis). Możesz ją dowolnie zmieniać i kasować — to punkt wyjścia, nie zestaw obowiązkowy.",
      },
      {
        tytul: "Kategorie zwijają się same",
        opis:
          "Nagłówki widać tylko dla kategorii, które mają choć jedną pozycję, a licznik przy pigułce filtra pokazuje, ile ich jest. Pusta kategoria nie zajmuje miejsca.",
      },
    ],
    pulapki: [
      {
        tytul: "Zmiana ceny nie działa wstecz — i to jest zamierzone",
        opis:
          "Podniesienie ceny komponentu nie podniesie kwot na dokumentach, które już powstały. Jeśli chcesz zaktualizować ofertę, wstaw pozycję jeszcze raz.",
      },
      {
        tytul: "Cena ujemna jest dozwolona",
        opis:
          "Bo rabat wystawia się jako osobną pozycję dokumentu, z kwotą na minusie. Przy takiej pozycji nie podawaj kosztu zakupu — inaczej „marża” zaświeci na czerwono, choć nic złego się nie dzieje.",
      },
      {
        tytul: "Usunięcie komponentu jest bezpieczne",
        opis:
          "Dokumenty, które z niego korzystały, mają własne kopie pozycji i nic im się nie stanie. Zniknie tylko klocek z biblioteki — i stary link do jego profilu.",
      },
    ],
    skroty: [
      { tytul: "„/” albo ⌘F", opis: "Szukanie po nazwie, opisie i dostawcy — panel, telefon i iPad tak samo." },
      { tytul: "j / k, Enter", opis: "Kursor po liście i otwarcie edycji (panel). ⌘N albo „n” — nowy komponent." },
      { tytul: "Prawy przycisk myszy / przytrzymanie", opis: "Menu: otwórz profil, edytuj, skopiuj nazwę lub cenę, usuń." },
      { tytul: "Przesunięcie w lewo (telefon)", opis: "Usuwa komponent — z pytaniem o potwierdzenie." },
    ],
  },

  /* ─────────────────────────────── KOSZTY ───────────────────────────── */
  {
    id: "koszty",
    nazwa: "Koszty",
    gdzie: "Panel: menu po lewej → Koszty. Telefon i iPad: „Więcej” → Koszty.",
    poCoTo:
      "Rejestr pieniędzy WYCHODZĄCYCH — faktury od dostawców, abonamenty, sprzęt, ZUS. To jedyny moduł patrzący w drugą stronę niż reszta panelu, i to z niego powstaje rejestr zakupów dla księgowej.",
    kiedy:
      "Wpisujesz koszt wtedy, kiedy dostajesz fakturę albo paragon — najczęściej w drodze, dlatego na telefonie „nowy koszt” od razu otwiera aparat. Wyjmujesz całość raz w miesiącu, jako plik CSV dla księgowej.",
    kroki: [
      {
        tytul: "1. Kwota netto i stawka VAT liczą resztę same",
        opis:
          "Wpisujesz netto i wybierasz stawkę — brutto przelicza się samo i nie da się go nadpisać ręcznie. Kwota ujemna jest dozwolona: tak wpisuje się fakturę korygującą od dostawcy (zwrot, rabat po fakcie).",
      },
      {
        tytul: "2. Odliczenie VAT to decyzja, nie domysł",
        opis:
          "Do wyboru 100% (zwykły koszt firmowy), 50% (np. samochód używany też prywatnie) albo 0% (np. reprezentacja). Panel NICZEGO tu nie zgaduje po kategorii ani po opisie — wybór jest zawsze Twój, bo to on decyduje, ile VAT-u odliczysz.",
      },
      {
        tytul: "3. Faktura w obcej walucie potrzebuje kursu",
        opis:
          "Wybierz walutę faktury i wpisz kurs do złotego z dnia poprzedzającego jej wystawienie — tak liczy to ustawa o VAT. Bez kursu koszt zapisze się, ale NIE wejdzie do żadnej sumy ani do wykresu, i będzie o tym mówił wprost. Kwoty widzisz podwójnie: w walucie faktury i w przybliżeniu w złotych.",
      },
      {
        tytul: "4. Termin płatności to co innego niż data płatności",
        opis:
          "Termin mówi, DO KIEDY masz zapłacić — bierzesz go z faktury dostawcy. Data płatności mówi, KIEDY zapłaciłeś, i wpisuje się sama, gdy oznaczysz koszt jako opłacony. Po minięciu terminu data na liście robi się pomarańczowa, a po dwóch tygodniach czerwona.",
      },
      {
        tytul: "5. Załącznik to Twój dowód",
        opis:
          "Skan albo PDF faktury (do 8 MB) trzyma się przy koszcie. Na telefonie robisz zdjęcie paragonu, a odczyt AI proponuje pola — proponuje, nie zapisuje. Zawsze zatwierdzasz sam.",
      },
    ],
    automaty: [
      {
        tytul: "Koszty cykliczne",
        opis:
          "Szablon abonamentu (hosting, licencje) tworzy nowy koszt-SZKIC, gdy nadejdzie jego data. Szkic czeka na Twoje sprawdzenie i opłacenie — nic nie płaci się samo. Szablon ma własną walutę, ale nie ma kursu: kurs jest z konkretnego dnia, a szablon nie wie, kiedy odpali.",
      },
      {
        tytul: "Import z KSeF",
        opis:
          "Pobiera faktury, na których jesteś nabywcą, i tworzy z nich gotowe koszty z oryginałem w załączniku. KSeF podaje walutę faktury, ale nie zawsze kurs — takiemu kosztowi trzeba kurs dopisać, żeby wszedł do sum.",
      },
      {
        tytul: "Ostrzeżenie o duplikacie i o amortyzacji",
        opis:
          "Ten sam NIP, kwota i data co przy innym wpisie? Panel zapyta, czy to nie dubel — możesz to wyciszyć raz na zawsze. Sprzęt powyżej 10 000 zł netto dostaje przypomnienie o amortyzacji. Oba są miękkie: niczego nie blokują i niczego nie rozliczają za Ciebie.",
      },
    ],
    pulapki: [
      {
        tytul: "Kurs 1,00 przy walucie obcej to prawie zawsze pomyłka",
        opis:
          "Znaczy „1 euro = 1 złoty” i zaniża koszt kilkakrotnie — dlatego panel o tym krzyczy. Jeśli widzisz to ostrzeżenie, wpisz prawdziwy kurs.",
      },
      {
        tytul: "Suma miesiąca jest zawsze w złotych",
        opis:
          "Koszty w euro czy dolarach wchodzą do niej po Twoim kursie. Te bez kursu są z niej wyłączone, a pod kwotą widnieje, ile ich jest — żeby suma nigdy nie udawała kompletnej.",
      },
      {
        tytul: "Koszt zakupu komponentu to CO INNEGO",
        opis:
          "Cena, za jaką kupujesz sprzęt do odsprzedaży, mieszka w Katalogu i służy do liczenia marży. Ten moduł to realne wydatki firmy. Dwie różne rzeczy o podobnej nazwie.",
      },
    ],
    skroty: [
      { tytul: "„/” albo ⌘F", opis: "Szukanie po dostawcy, opisie i nazwie projektu — panel, telefon i iPad tak samo." },
      { tytul: "j / k, Enter", opis: "Kursor po liście i otwarcie kosztu (panel). ⌘N albo „n” — nowy koszt." },
      { tytul: "⌘N na telefonie", opis: "Otwiera APARAT, nie pusty formularz — bo nowy koszt w drodze to zdjęcie paragonu. Świadome odstępstwo od panelu." },
      { tytul: "Prawy przycisk myszy / przytrzymanie", opis: "Menu: otwórz, skopiuj kwotę lub dane do przelewu, zmień status, usuń." },
    ],
  },

  /* ─────────────────────────────── POCZTA ───────────────────────────── */
  {
    id: "poczta",
    nazwa: "Poczta",
    gdzie: "Panel: menu po lewej → Poczta. Telefon i iPad: druga zakładka w dolnej belce.",
    poCoTo:
      "Twoja skrzynka z az.pl w środku panelu — obok leadów, klientów i projektów. To jedyny moduł, który wysyła coś NA ZEWNĄTRZ firmy: wszystko inne zapisuje liczby do bazy, a ten wysyła wiadomości do prawdziwych ludzi.",
    kiedy:
      "Codziennie rano zamiast Outlooka. Poczta trafia tu z dopiętym klientem albo leadem, więc od razu widać, kto pisze i w jakiej sprawie — a odpowiedź zostaje na osi kontaktu.",
    kroki: [
      {
        tytul: "1. Masz 10 sekund, żeby się rozmyślić",
        opis:
          "Po kliknięciu „Wyślij” nic jeszcze nie leci — pojawia się pasek „Wysyłam za 10 s” z przyciskiem „Cofnij”. Tak samo w panelu i na telefonie. Uwaga: zamknięcie okna albo karty w trakcie odliczania PRZERYWA wysyłkę — wiadomość NIE pójdzie, a panel Ci to napisze.",
      },
      {
        tytul: "2. Odpowiedź trafia w ten sam wątek",
        opis:
          "Adresata, temat i nagłówki wątku ustala panel — u odbiorcy odpowiedź wpada pod oryginał, nie zakłada nowej rozmowy. Podpis dokleja się przy wysyłce w wybranym języku, więc w polu piszesz samą treść.",
      },
      {
        tytul: "3. Z maila jednym kliknięciem robisz leada, klienta albo zadanie",
        opis:
          "„Utwórz leada” zakłada kartę i wpisuje treść wiadomości do notatek. „Z maila → zadanie” wrzuca prośbę klienta do wybranego projektu i oznacza mail jako obsłużony. Jeśli klikniesz dwa razy z dwóch miejsc, panel przypnie do istniejącego wpisu zamiast robić duplikat.",
      },
      {
        tytul: "4. Wysyłka odłożona na później",
        opis:
          "Menu przy „Wyślij” pozwala wskazać porę („jutro rano”). Podana godzina to NAJWCZEŚNIEJSZY moment wysyłki, nie gwarantowany — kolejka rusza też przy każdym Twoim wejściu w Pocztę. Wiadomości z załącznikami odłożyć się nie da i panel mówi o tym wprost.",
      },
      {
        tytul: "5. Załączniki ściągają się dopiero przy kliknięciu",
        opis:
          "Panel trzyma tylko OPIS pliku (nazwę, rozmiar), nigdy jego treści — dlatego otwarcie trwa kilka sekund. Jeśli nie uda się połączyć ze skrzynką, dostaniesz osobny komunikat i prośbę, żeby NIE kasować wiadomości, dopóki połączenie nie wróci. To co innego niż „pliku już nie ma na serwerze”.",
      },
    ],
    automaty: [
      {
        tytul: "Szufladkowanie i screener nowych nadawców",
        opis:
          "Panel sam nadaje rodzaj (Zapytanie, Rachunek, Rozmowa, Reklama) po nagłówkach i treści — bez AI, po regułach. Nowy, nieznany nadawca czeka pod „Nowi nadawcy”, dopóki go nie zatwierdzisz albo nie zablokujesz. Odpisanie zatwierdza go samo.",
      },
      {
        tytul: "Przypomnienie o wątkach bez odpowiedzi",
        opis:
          "Wysłałeś i cisza? Wątek wraca na listę z liczbą dni ciszy. „Wycisz wątek” zdejmuje go z tej kolejki, ale ZOSTAWIA wiadomość w Odebranych — to dwie osobne rzeczy, nie archiwizacja.",
      },
      {
        tytul: "Trzy miejsca z lokalnym modelem AI",
        opis:
          "Szkic odpowiedzi, podsumowanie wątku i szkic notatki. Model działa na Twoim Macu, nigdy w chmurze, i zawsze tylko PROPONUJE: szkic ląduje w polu z paskiem „przeczytaj i popraw, zanim wyślesz”, a wysyłasz i zapisujesz zawsze Ty.",
      },
    ],
    pulapki: [
      {
        tytul: "Tego samego maila nie wyślesz dwa razy",
        opis:
          "Jeśli po błędzie („nie udało się wysłać”) klikniesz ponownie, a wiadomość mimo wszystko wyszła — panel odmówi i powie to wprost. Zdarza się to przy słabym zasięgu: telefon zrywa połączenie, gdy serwer już wysyła. Zamiast wysyłać drugi raz, sprawdź folder Wysłane.",
      },
      {
        tytul: "Kasowanie w „Subskrypcjach” dotyczy tylko kopii w panelu",
        opis:
          "Sprzątanie po nadawcy masówki usuwa wiadomości z panelu, ale NIE ze skrzynki az.pl — i mogą wrócić przy kolejnym pobraniu. Trwale załatwia sprawę dopiero link „wypisz się”.",
      },
      {
        tytul: "Przeczytane w panelu ≠ przeczytane w Outlooku",
        opis:
          "Statusy i foldery panelu żyją po jego stronie; panel nie zmienia flag na serwerze pocztowym. To świadome uproszczenie, nie usterka.",
      },
    ],
    skroty: [
      { tytul: "„/” albo ⌘F", opis: "Szukanie po nadawcy, temacie i treści — obejmuje też wyciszone i obsłużone." },
      { tytul: "j / k, Enter", opis: "Kursor po liście i otwarcie wiadomości. Spacja zaznacza." },
      { tytul: "r / a / f", opis: "Odpisz / Odpowiedz wszystkim / Przekaż dalej — przy otwartej wiadomości." },
      { tytul: "e", opis: "Oznacz jako obsłużone. Świadomie NIE archiwizuje — status i folder to dwie osobne osie." },
    ],
  },
  {
    id: "przypomnienia",
    nazwa: "Przypomnienia",
    gdzie: "Panel: menu po lewej → Przypomnienia. Telefon i iPad: zakładka „Więcej” → Przypomnienia.",
    poCoTo:
      "Lista rzeczy do zrobienia, wzorowana na Przypomnieniach Apple'a. Różnica wobec Kalendarza jest jedna, ale zasadnicza: tutaj termin jest NIEOBOWIĄZKOWY. „Kiedyś przejrzeć backupy” to pełnoprawny wpis, a wydarzenie bez daty nie miałoby sensu.",
    kiedy:
      "Kiedy coś masz zrobić, ale nie musisz nigdzie być o konkretnej porze: oddzwonić, dopytać o fakturę, przejrzeć dokumentację. Rzeczy z godziną i miejscem idą do Kalendarza.",
    kroki: [
      {
        tytul: "1. Wpisujesz jedno zdanie i już jest",
        opis:
          "Pole „Co masz zrobić?” na górze listy — Enter zapisuje. Formularza nie ma celowo: termin, priorytet i listę dokładasz później, klikając w gotowy wpis. Nowy wpis ląduje na liście, którą właśnie oglądasz.",
      },
      {
        tytul: "2. Bez terminu też jest w porządku",
        opis:
          "Wpis bez daty NIE liczy się jako zaległość i nie zaświeci na czerwono — to sprawa świadomie odłożona, nie zapomniana. Jedyne, co panel zrobi: po trzech miesiącach dopisze szarym „leży od 4 miesięcy”, żeby nie zniknęła Ci z oczu na dobre.",
      },
      {
        tytul: "3. Kroki wewnątrz zadania",
        opis:
          "Większą rzecz („Remont biura”) rozbijasz na kroki. Odhaczenie całego zadania odhacza WSZYSTKIE jego kroki — tak jak u Apple'a. W drugą stronę to nie działa: cofnięcie odhaczenia zostawia kroki zrobione. Kroki są jednopoziomowe, kroku nie da się rozbić na kolejne kroki.",
      },
      {
        tytul: "4. Powtarzanie zamyka WYSTĄPIENIE, nie serię",
        opis:
          "Odhaczasz „Rozliczenie z księgową” za lipiec i zadanie nie znika — wraca z terminem na sierpień. Rytm liczy się od pierwszej daty serii, więc „co miesiąc od 31.” nie zsuwa się na 28. po lutym. Kroki powtarzalnego zadania wracają wtedy na start razem z nim.",
      },
      {
        tytul: "5. Miejsce zamiast godziny",
        opis:
          "Przypomnienie może odezwać się, gdy dojdziesz na miejsce albo gdy je opuścisz — tego pilnuje TELEFON, nie serwer. Sama nazwa miejsca bez wskazania go na mapie to zwykła notatka i panel niczego wtedy nie obiecuje.",
      },
    ],
    automaty: [
      {
        tytul: "Powiadomienia planuje TELEFON, nie panel",
        opis:
          "Serwer nie wysyła w tym module nic — żadnego maila, żadnego pushu. Alarm o godzinie i alarm „na miejscu” ustawia apka na Twoim iPhonie. Skutek praktyczny: jeśli apki nie masz zainstalowanej albo odmówisz jej zgody na powiadomienia, przypomnienie będzie tylko wpisem na liście.",
      },
      {
        tytul: "Termin przeskakuje sam przy powtarzaniu",
        opis:
          "Zaległe zadanie cykliczne, odhaczone po trzech miesiącach, wraca za miesiąc od DZIŚ — a nie wyskakuje od razu z kolejną przeterminowaną datą. Reguła deterministyczna, bez AI.",
      },
    ],
    pulapki: [
      {
        tytul: "Godzina bez terminu nie zapisze się wcale",
        opis:
          "Sama godzina znaczyłaby „o 14:00 nigdy”. Panel odmówi i to napisze, zamiast przyjąć zapis i po cichu wyrzucić godzinę.",
      },
      {
        tytul: "Seria może stracić przyszłość, choć wygląda na żywą",
        opis:
          "Jeśli ustawisz „co miesiąc do 31 grudnia”, a potem przeniesiesz termin na przyszły czerwiec, powtórzenie nigdy nie nastąpi. Zapis przechodzi (bywa krokiem pośrednim), ale w profilu staje zdanie: „To ostatnie wystąpienie tej serii”. Przeczytaj je, zanim zamkniesz okno.",
      },
      {
        tytul: "Usunięcie listy NIE kasuje przypomnień",
        opis:
          "Wpisy z usuniętej listy trafiają do „Bez listy” — panel mówi z góry, ilu to dotyczy. Za to usunięcie ZADANIA kasuje jego kroki razem z nim.",
      },
    ],
    skroty: [
      { tytul: "„/” albo ⌘F", opis: "Szukanie po tytule i notatce — obejmuje też kroki wewnątrz zadań." },
      { tytul: "j / k, Enter", opis: "Kursor po liście i otwarcie wpisu. Kroki są w kolejności czytania, pod swoim zadaniem." },
      { tytul: "n albo ⌘N", opis: "Kursor do pola „Co masz zrobić?”." },
      { tytul: "Prawy przycisk myszy", opis: "Menu wiersza: odhacz, flaga, zdejmij termin, otwórz, usuń." },
    ],
  },
  {
    id: "notatnik",
    nazwa: "Notatnik",
    gdzie: "Panel: menu po lewej → Notatnik. Telefon: zakładka „Więcej” → Notatnik. iPad: pasek boczny.",
    poCoTo:
      "Miejsce na to, co pada w rozmowie, ZANIM stanie się leadem, zadaniem albo wydarzeniem. To jedyny moduł, w którym nie ma żadnej rubryki do wypełnienia — piszesz zdaniami, a dopiero potem decydujesz, czym to ma być.",
    kiedy:
      "Kiedy nie chcesz jeszcze zakładać rekordu, a szkoda zgubić myśl: pomysł na usługę, ustalenia z rozmowy, „sprawdzić, czy im się to opłaca”. Rzecz z terminem idzie do Przypomnień, rzecz z godziną i miejscem — do Kalendarza.",
    kroki: [
      {
        tytul: "1. Wpisz notatkę w pole na górze",
        opis:
          "Pierwsza linia stanie się tytułem, reszta treścią. Zapis: przycisk „Zapisz notatkę” albo Cmd+Enter — nie musisz sięgać po mysz.",
      },
      {
        tytul: "2. Dopisz tagi, jeśli chcesz je potem grupować",
        opis:
          "Pole pod treścią, po przecinku. Tagi pojawiają się jako pigułki nad listą i filtrują ją jednym kliknięciem. Wybrany tag zostaje po zamknięciu panelu.",
      },
      {
        tytul: "3. Powiąż z klientem albo leadem",
        opis:
          "Kontrolka „— powiąż —”. Notatka może należeć do klienta ALBO do leada, nigdy do obu naraz — panel tego pilnuje i odmówi, gdyby coś próbowało ustawić dwa jednocześnie.",
      },
      {
        tytul: "4. Przypnij to, do czego wracasz",
        opis:
          "Pinezka po lewej stronie tytułu. Przypięte stoją na górze listy i mają własną zakładkę.",
      },
      {
        tytul: "5. Przekuj notatkę w coś większego",
        opis:
          "„→ Przekuj w projekt” zakłada projekt z tytułem i treścią notatki, razem z listą powitalną. „Do kalendarza” rozwija małe pole daty i godziny i tworzy wydarzenie. Oba zabierają powiązanie notatki ze sobą.",
      },
      {
        tytul: "6. Sprzątaj archiwum, nie koszem",
        opis:
          "Ikona archiwum chowa notatkę z biurka, zostawiając ją do odczytania. Trwałe usunięcie jest dopiero w zakładce „Archiwum” — świadomie o jedno kliknięcie dalej.",
      },
    ],
    automaty: [
      {
        tytul: "Przekucie da się kliknąć dwa razy i nic się nie zdublouje",
        opis:
          "Notatka pamięta, że projekt (albo wydarzenie) z niej powstał. Drugie kliknięcie — także z drugiej karty przeglądarki albo z telefonu — otwiera to, co już jest, zamiast zakładać kolejny rekord. Pilnuje tego serwer, nie przycisk.",
      },
      {
        tytul: "Szukanie zagląda też do dziennika notatki",
        opis:
          "Pole „Szukaj” obejmuje tytuł, treść, tagi ORAZ wpisy dziennika — słowo zapisane w logu jest znajdowalne.",
      },
    ],
    pulapki: [
      {
        tytul: "Notatka nie przypomni o sobie sama",
        opis:
          "To jedyny moduł bez terminu i bez alarmu — nic z niego nie zadzwoni. Jeśli rzecz ma się o siebie upomnieć, przekuj ją w przypomnienie albo wydarzenie.",
      },
      {
        tytul: "Bardzo długa notatka zwija się na kafelku",
        opis:
          "Na liście treść przewija się wewnątrz kafelka, żeby jedna długa notatka nie zepchnęła reszty poza ekran. Całość widać po otwarciu profilu („⤢”), gdzie nic nie jest ucinane.",
      },
      {
        tytul: "Rysunek robi się tylko rysikiem, na iPadzie",
        opis:
          "Odręczny szkic (Apple Pencil) dołączysz z iPada. W panelu i na telefonie możesz go obejrzeć i usunąć, ale nie narysować.",
      },
    ],
    skroty: [
      { tytul: "„/”", opis: "Kursor do wyszukiwarki. Esc czyści frazę i oddaje fokus liście." },
      { tytul: "j / k, Enter", opis: "Kursor po kafelkach (rzędami) i otwarcie profilu notatki." },
      { tytul: "n albo ⌘N", opis: "Kursor do pola nowej notatki." },
      { tytul: "Cmd+Enter", opis: "Zapisuje notatkę wpisywaną w polu na górze, bez sięgania po przycisk." },
      { tytul: "Prawy przycisk myszy", opis: "Menu kafelka: otwórz, przypnij, przekuj w projekt, archiwum, usuń (tylko z archiwum)." },
    ],
  },
];

/** Moduł po `id` — do podstrony i do kotwic. */
export function modulInstrukcji(id: string): ModulInstrukcji | null {
  return MODULY.find((m) => m.id === id) ?? null;
}
