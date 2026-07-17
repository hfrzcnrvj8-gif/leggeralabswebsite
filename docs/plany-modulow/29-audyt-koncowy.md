# Moduł 29 — Ostateczny audyt drogi klienta (po Modułach 11–28)

> Przeczytaj `docs/plany-modulow/README.md` (zasady wspólne), `CLAUDE.md` oraz
> `00-mapa-drogi-klienta.md` (dokument nadrzędny). Ten brief spisany 2026-07-17,
> zaraz po zamknięciu Modułu 28 — stan modułów potwierdzony w README.

## Skąd to się wzięło

To **nie jest nowy pomysł** — audyt był zaplanowany z góry. `README.md` mówi
wprost: *„ostateczny, całościowy audyt drogi klienta — po ukończeniu modułów
11-20"*. Moduły 11–20 są zamknięte, a od tamtej decyzji doszło jeszcze osiem
(21–28). Właściciel zatwierdził uruchomienie audytu 2026-07-17.

Pochodzenie zlecenia (2026-07-14, jego słowa): *„chcę wypracować raz wzorzec,
który jest najlepszy, i według niego pracować, a aplikacja ma to monitorować"*.
Audyt odpowiada na pytanie **„czy panel faktycznie to robi"** — nie „co jeszcze
dobudować".

## Czym ten audyt RÓŻNI SIĘ od poprzednich

Były już dwa i **nie powtarzaj ich**:

- **2026-07-12, audyt 4-wymiarowy** (kod / prawo / konkurencja / automatyzacja)
  — WYKONANY. Główne ustalenie (brak KSeF) jest **nieaktualne** — KSeF
  wychodzący działa i był wielokrotnie potwierdzony „Przyjęto" na środowisku
  testowym MF (2026-07-13).
- **2026-07-13, audyt przepływów end-to-end** — WYKONANY, wykrył trzy luki,
  które stały się Modułami 1–4.

Ten audyt jest **trzeci i inny**: pyta nie „czy poszczególny moduł działa"
(wiemy, że działa), tylko **czy 28 modułów składa się w jedną spójną drogę** —
i co się przez ten czas rozjechało.

## Zakres — cztery produkty do oddania

Audyt ma **kończyć się listami do decyzji właściciela**, nie cichym dobudowywaniem.

### 1. Lista „do prawnika / tłumacza" (obowiązkowa, wprost obiecana)

Właściciel poprosił 2026-07-15, żeby **nie** organizować weryfikacji prawnych
moduł po module, tylko dostać **jedną zbiorczą listę na tym audycie**. Znane
pozycje:

1. **Treść klauzul Umów/NDA** (`lib/contracts.ts`, `CONTRACT_CLAUSES` /
   `NDA_CLAUSES`) — w kodzie wprost oznaczone jako niezweryfikowany szkic
   roboczy (`LEGAL_PLACEHOLDER_NOTE`). Wymaga prawdziwego prawnika przed
   użyciem z realnym klientem, niezależnie od języka.
2. **Tłumaczenia klauzul Umów/NDA na EN/DE** — nie napisane (świadomie).
   Infrastruktura (`contracts.jezyk`) jest gotowa, brakuje samej treści.
   Kolejność: najpierw prawnik po polsku (pkt 1), potem tłumaczenie, potem
   weryfikacja tłumaczenia.
3. **`PROJECT_REVIEW_CONSENT_TEXT`** (`lib/projects.ts`, Moduł 15) — zgoda na
   case study, przetłumaczona przez Claude na EN/DE. Niższa stawka niż umowa
   (zgoda marketingowa), ale wersja niemiecka dotyka sformułowań okołoRODO.
4. **Doskanuj resztę** — przeszukaj `lib/*.ts` pod kątem podobnych dopisków
   („SZABLON", „WYMAGA WERYFIKACJI"), bo Moduły 16–28 mogły dołożyć kolejne.

### 2. Spójność drogi klienta (rdzeń audytu)

Przejdź `00-mapa-drogi-klienta.md` **krok po kroku** (Krok 0 → stała relacja) i
dla każdego kroku odpowiedz: czy panel prowadzi właściciela dalej, czy w tym
miejscu wypada z aplikacji i robi coś ręcznie. Szukaj **szwów między modułami**,
nie błędów w środku modułu:

- czy dane wchodzą i wychodzą tam, gdzie trzeba (lead → oferta → projekt →
  faktura → opinia → retencja),
- czy któryś etap ma dwa różne UI robiące to samo,
- czy któraś podpowiedź kłamie po zmianach z Modułów 21–28.

### 3. Rejestr rzeczy świadomie odłożonych → decyzja: zostaje czy budujemy

Przez 28 modułów uzbierała się ich spora lista, rozsiana po `HUB_SETUP.md`
(szukaj „Świadomie odłożone" / „Świadomie NIE"). **Zbierz je w jedno miejsce** i
każdą przedstaw właścicielowi jako pytanie. Znane, na start:

| Rzecz | Skąd | Uwaga |
|---|---|---|
| **Dane az.pl w env Vercela** | Moduł 4 | **BLOKER** — poczta nie działa na produkcji bez tego. Wymaga działania właściciela, nie kodu. |
| Układ panelu związany z ekranem (`min-h` → `h` w `AppShell`) | Moduł 28 | Nic w panelu nie jest związane z wysokością ekranu → przewija się cała strona zamiast list. Fundament pod Moduł 5. |
| Poziomy scroll przy 375 px | Moduł 27 | Należy do Modułu 5 (PWA), nie naprawiać doraźnie. |
| `lead_id`/`project_id` w UI Faktur/Ofert | Moduł 22 | Tamtejszy picker kopiuje dane nabywcy, nie linkuje. |
| Audyt zmian dla faktur/ofert/projektów | Moduł 23 | `entity` jest tekstem → to jedna linia w ich PATCH-u. |
| Rabaty, cena brutto↔netto, domyślne uwagi | Faktury | Ostatnia zaległość z batcha edytora. |
| Załączniki w przekazywaniu maili | Moduł 4 | |
| „Powiel jako szkic" | Moduł 25 | Dotyka logiki zapisu, nie UI. |

Lista **nie jest kompletna** — to punkt startu, nie wynik. Dokończ ją gretem.

### 4. Stan „gotowości do prawdziwej firmy"

`PO_REJESTRACJI.md` to checklista **do wykonania po rejestracji działalności**.
Firma **nie jest jeszcze zarejestrowana** — te pozycje (nota prawna z prawdziwymi
danymi, dane administratora w polityce prywatności, KSeF test→produkcja,
ustawienia sprzedawcy) są **świadomie odłożone i NIE są brakami do naprawienia**.
Zadanie audytu: **sprawdzić, czy ta lista jest nadal kompletna** po Modułach
11–28, a nie odhaczać ją.

## Do rozstrzygnięcia z właścicielem

Zacznij od pytań, nie od gotowej tezy:

- **Czy audyt ma objąć też jakość kodu** (duplikacja, wydajność zapytań), czy
  wyłącznie drogę klienta i spójność produktu? Audyt kodu był robiony
  2026-07-12 i od tamtej pory doszło 28 modułów — może być wart powtórki, ale
  to podwaja zakres.
- **Co zrobić ze znalezionymi lukami w tej samej sesji?** Trzy opcje: (a) tylko
  raport i lista modułów do zrobienia osobno, (b) raport + naprawa drobiazgów
  od ręki, (c) raport + naprawa wszystkiego. Rekomendacja: **(b)** — audyt,
  który od razu przechodzi w budowanie, przestaje być audytem i rozjeżdża się.
- **Czy porównanie z konkurencją ma wrócić?** (Fakturownia/inFakt/wFirma dla
  faktur, Pipedrive/HubSpot dla sprzedaży — NIE SAP, patrz
  [[koszty-module-candidate]]).

## Czego NIE robić

- **Nie przebudowuj niczego „przy okazji".** To audyt. Każda zmiana wykraczająca
  poza drobiazg = pytanie do właściciela albo nowy brief modułu.
- **Nie traktuj świadomych decyzji jak błędów.** Zanim zgłosisz coś jako lukę,
  sprawdź `HUB_SETUP.md` i `CLAUDE.md` → „Świadome decyzje produktowe". Panel
  jednoosobowy, brak AI w logice, emoji zamiast ikon, ręczne „zdrowie" projektu,
  cykle wyłącznie wizualne, mały wykres w Kosztach — to **wybory**, nie
  niedoróbki.
- **Nie odhaczaj `PO_REJESTRACJI.md`** — firma nie jest zarejestrowana.
- **Nie powtarzaj audytu KSeF** — działa i jest potwierdzony na żywo.

## Weryfikacja

Ten moduł kończy się **dokumentem i rozmową**, nie kodem. Jeśli w ramach opcji
(b) powstaną drobne poprawki: `npx tsc --noEmit -p tsconfig.json` po każdej
paczce + podgląd w przeglądarce (`preview_start name:"dev"`).

Na koniec: zapisz wynik audytu w `HUB_SETUP.md`, odhacz w `README.md`, a luki
warte osobnej pracy zamień na briefy `30-*.md`, `31-*.md` — po jednym na czat,
zgodnie z konwencją tego folderu.
