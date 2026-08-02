# Prompt do wklejenia w nowym czacie — apka iOS uczy się potwierdzać

**Plik tymczasowy.** Wklej treść poniżej (od linii `---` w dół) jako pierwszą
wiadomość w nowym czacie, po czym skasuj ten plik przy najbliższym commicie.

---

Zaczynamy pracę nad **aplikacją iOS**, nie nad panelem. Repo apki leży obok
tego: `../leggera-hub-ios`. Panel (to repo) jest zamknięty i nie ruszamy go
w tej sesji poza czytaniem.

Na start przeczytaj, w tej kolejności:
- `HANDOFF.md` — aktualny stan całości i lista rzeczy otwartych
- `docs/natywna-aplikacja/35-brief-potwierdzenia.md` — pełny brief tej roboty,
  z kontraktem nagłówków i tabelą wszystkich dotkniętych tras
- `CLAUDE.md` — zasady pracy w tym repo i pułapki środowiska
- `docs/natywna-aplikacja/00-plan.md` — czerwona ramka na górze; reszta pliku
  to historia, nie lista zadań
- README apki w `../leggera-hub-ios` — furtki DEBUG, budowanie, wgrywanie

## Punkt startu

Panel: ostatnie commity to „Faza 5: wygląd…" (`1eb9446`) i dwa handoffy nad nim.
Repo panelu czyste i wypchnięte, `tsc` czysto, `npm test` 281/281,
`npm run przejscie` = 68 działa · 0 znanych luk · 0 regresji · 0 obejść ·
0 pominiętych. Jeśli `git log` pokazuje co innego — sprawdź, kto pracował po
drodze, ZANIM cokolwiek dodasz do indeksu.

## Problem, dla którego to robimy

Plan zaplecza (Faza 4) dał trasom jawną listę działań nieodwracalnych i barierę
**w TRASIE, nie w przycisku**. Panel się tego nauczył, apka nie. Skutek:
**wystawienie faktury, wysyłka dokumentu i usunięcie rekordu z telefonu wracają
dziś z HTTP 428 i nie robią NIC.** To jedyna rzecz w całym projekcie, która
działa gorzej niż przed planem — i świadomy koszt decyzji „szczelnie od razu",
nie przeoczenie. Pełna tabela dotkniętych ekranów jest w briefie.

## Zanim zaczniesz pisać kod, zapytaj mnie wprost o trzy rzeczy

1. **Zakres tej sesji** — czy robimy wyłącznie potwierdzenia, czy przy okazji
   dokładamy brakujący ekran „Propozycje" (trasa `/api/hub/propozycje` gotowa
   od Fazy 3, brakuje samego widoku SwiftUI, briefu jeszcze nie ma). To różnica
   między jednym wieczorem a dwoma.
2. **Jak ma wyglądać okno potwierdzenia na telefonie** — arkusz od dołu
   (`.confirmationDialog` / `.sheet`) czy alert. Przy poziomie „mocne" trzeba
   przepisać frazę, więc potrzebne jest pole tekstowe — a alert z polem
   wygląda na iOS inaczej niż arkusz i to widać. Pokaż mi wariant, zanim
   rozjedziesz go po dwudziestu ekranach.
3. **Na czym testujemy.** Apka w DEBUG rozmawia z **produkcją**, więc test
   kasujący rekord jest testem na żywych danych. Czy zakładamy rekord-atrapę
   i kasujemy go tą samą drogą, czy wolisz, żebym najpierw przełączył apkę na
   lokalny panel (`SIMCTL_CHILD_LEGGERA_DEV_BACKEND=lokalny`)?

## Rzeczy, które mają realny wpływ na kształt pracy

- **Nie przepisuj listy działań nieodwracalnych do Swifta.** Cała treść okna —
  tytuł, skutek, napis na przycisku, czy trzeba coś przepisać — przychodzi
  w odpowiedzi 428. Apka ma się dowiedzieć o barierze od serwera, nie znać jej
  z góry. To jest sens tej architektury: lista żyje w jednym miejscu i nie może
  się rozjechać na dwie kopie.
- **Jedno miejsce w `APIClient`, nie dwadzieścia ekranów.** Wzór do przepisania
  to `wykonajZadanie()` z `app/[lang]/admin/Potwierdzenie.tsx` w panelu: wyślij
  normalnie → jeśli 428 z opisem, pokaż arkusz → powtórz z nagłówkami.
  To ta sama lekcja co A1 („16 z 20 ekranów kłamie pustym stanem") — dwudziesty
  ekran zapomni.
- **`x-potwierdzenie-fraza` musi iść przez `addingPercentEncoding(withAllowedCharacters: .alphanumerics)`**,
  NIE `.urlQueryAllowed` — nagłówki HTTP niosą tylko latin-1, a przepisuje się
  „Wdrożenie w Łodzi". Pamięć projektu ma osobny wpis o tym, jak escapowanie
  przez dwa języki gubi znaki BEZ żadnego objawu.
- **Nie owijaj tego dodatkowym `confirm`-em w apce.** Dwa pytania pod rząd o to
  samo uczą klikać „tak" bez czytania, czyli niszczą to, co ta bariera buduje.
- **Nowy plik `.swift` wymaga `xcodegen`** — inaczej nie trafi do targetu
  i kompiluje się „zielono" bez twojego kodu.
- **Pole opcjonalne bez przypisania w `init(from:)` kompiluje się i zawsze jest
  `nil`** — dokładając pole do modelu, sprawdź trzy miejsca.

## Sprawdzenie

Dowodem NIE jest to, że się kompiluje. Dowodem jest para pomiarów na tym samym
rekordzie: **przed** poprawką akcja wraca z 428 i nic się nie dzieje, **po**
poprawce arkusz się pokazuje, a akcja przechodzi. Zrób to dla obu poziomów —
zwykłego („Na pewno?") i mocnego (przepisanie frazy) — bo to dwie różne ścieżki
w kodzie. Sprawdź też przypadek negatywny: zgoda na JEDNO działanie nie ma
przepuszczać innego (serwer to sprawdza, apka nie powinna tego obchodzić).

## Jak pracujemy

Nie jestem programistą — jeśli coś wymaga decyzji nietechnicznej, pytaj wprost.
Na koniec podaj mi polecenia do commita i pusha **dla obu repozytoriów**, jeśli
zmieni się coś po stronie panelu (nie powinno).
