# Prompt startowy — Faza 5 (wygląd), OSTATNIA faza planu zaplecza

Wklej całą treść poniżej jako pierwszą wiadomość w nowym czacie.

---

Zaczynamy Fazę 5 planu zaplecza panelu Leggera Hub — ostatnią.

Na start przeczytaj, w tej kolejności:
- HANDOFF.md — punkt startu, stan po Fazie 4 i pełny brief Fazy 5
- CLAUDE.md — zasady pracy w tym repo i pułapki środowiska
- docs/PLAN-ZAPLECZE.md — sekcja „Faza 5"
- docs/PIERWSZE-PRZEJSCIE-NA-SUCHO.md — znaleziska E i D2

Punkt startu: ostatni commit to `c7ee130` „Faza 4: co nieodwracalne — pyta, co
odwracalne — nie pyta", repo czyste i wypchnięte, `tsc` czysto, `npm test`
281/281, `npm run przejscie` = 68 działa · 0 znanych luk · 0 regresji ·
0 obejść · 0 pominiętych. Lista znanych luk z pierwszego przejścia jest PUSTA
— więc każde nowe „⚠ ZNANA LUKA" to coś, co dopiero co dołożyliśmy. Jeśli
`git log` pokazuje co innego — sprawdź, kto pracował po drodze, ZANIM
cokolwiek dodasz do indeksu.

Zakres fazy: sześć zebranych usterek wyglądu — E1 (`.glass` bez rozmycia
w zbudowanym CSS), E2 (okna `useUI()` jasne w ciemnym panelu — od Fazy 4 jest
ich CZTERY, nie trzy), E3 (wiersz „Daty" wychodzi poza kartę projektu),
E4 (nazwa kamienia milowego ucięta w pół słowa), D2 (nowy lead ląduje poza
ekranem) i F (otwarty próg 24×24 w Katalogu).

Zanim cokolwiek napiszesz, zapytaj mnie wprost o cztery rzeczy — to decyzje
produktowe, nie techniczne, i nie zgaduj:
1. Czy Faza 5 to DOKŁADNIE te sześć pozycji, czy przy okazji robimy przegląd
   wyglądu szerzej (i jak szeroko — bo to zmienia rozmiar fazy z jednego
   wieczoru na kilka).
2. D2 — co ma się stać po dodaniu leada: lista przewija się do nowego i go
   podświetla, czy nowe rekordy sortują się na górę, dopóki nie mają kontaktu?
   To dwa różne zachowania listy i widać je wszędzie, nie tylko w Leadach.
3. F (próg 24×24 w Katalogu) — czym ma być docelowo. Trzeci moduł z rzędu to
   odnotowuje, więc warto rozstrzygnąć raz.
4. Czym kończy się cały plan zaplecza: czy po tej fazie uznajemy go za
   zamknięty i piszemy podsumowanie całości, czy zostaje jeszcze coś, co
   chcesz dorzucić.

Uwagi, które mają realny wpływ na kształt pracy:
- Podgląd w przeglądarce ma ZAMROŻONY rAF (karta „hidden"): animacje
  framer-motion nie kończą się, element usunięty ze stanu potrafi zostać
  w DOM, a `opacity` bywa 0. Rozstrzyga przeładowanie strony albo pomiar
  klatek — NIE zrzut ekranu.
- Świeżo otwarta karta podglądu bywa 0×0 (`innerWidth: 0`) i wtedy każdy
  pomiar geometrii kłamie (`h-6 w-6` mierzy się jako 17×24 i wygląda jak
  usterka klikalności, którą nie jest). Otwórz NOWĄ kartę i sprawdź
  `innerWidth`, zanim cokolwiek zmierzysz.
- E1 i E2 siedzą w ZBUDOWANYM CSS, nie w źródle — źródło deklaruje to, co
  trzeba. Dowodem jest `getComputedStyle`, nie odczytanie pliku.
- Tailwind nie generuje reguł dla `bg-[var(--x)]/40` — krycie na zmiennej CSS
  cicho nie działa (raz było już 86 martwych klas). Rozstrzyga
  `getComputedStyle`, nie wygląd w kodzie.
- Mierząc kolor: pierwszy `<span>` bywa opakowaniem `display: contents` —
  mierz najgłębszy węzeł, inaczej dostaniesz wartość opakowania.
- Poprawiając E2 sprawdź WSZYSTKIE cztery okna `AdminUIProvider`
  (confirm / prompt / choose / potwierdzenie), nie trzy.

Sprawdzenie fazy: `npm run przejscie` sprawdzi tu mało, bo to faza o wyglądzie
— ale ma dalej wychodzić na zielono (68, zero regresji), a dowodem poprawek
jest POMIAR: `getComputedStyle` dla E1/E2, geometria dla E3/E4, pozycja
rekordu na liście dla D2.

Pracuj tak jak dotąd: `npm run dev` w tle, `npm run przejscie` do weryfikacji,
`npx tsc --noEmit` po każdej paczce zmian, testy jednostkowe na reguły, które
da się sprawdzić bez bazy. Nie jestem programistą — jeśli coś wymaga decyzji
nietechnicznej, pytaj wprost. Na koniec podaj mi polecenie do commita i pusha.

---

## Dług, o którym trzeba pamiętać niezależnie od Fazy 5

**Apka iOS nie potwierdza działań nieodwracalnych.** Po Fazie 4 wystawienie
faktury, wysyłka dokumentu i usunięcie rekordu **z telefonu wracają z 428
i nie robią nic**. To świadomy wybór („szczelnie od razu", bez furtki dla
apki), nie przeoczenie — ale to jedyna rzecz, która dziś działa GORZEJ niż
przed Fazą 4. Brief gotowy do osobnej sesji:
`docs/natywna-aplikacja/35-brief-potwierdzenia.md`.

To osobna sesja **nad apką**, nie część Fazy 5. Można ją zrobić przed Fazą 5,
po niej albo równolegle — ale nie w tym samym czacie, bo to inne repo.
