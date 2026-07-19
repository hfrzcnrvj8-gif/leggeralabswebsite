# Brief: natywne bajery (widżet, Siri, Share Extension, Face ID)

> Brief wdrożeniowy pod **jeden osobny czat**. Zaczynasz od przeczytania
> `00-plan.md` (cały — szczególnie „Faza 6" i „Domknięcie: WhatsApp").
> Repo apki: `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`.

**Skąd to się wzięło.** Właściciel wybrał ten moduł 2026-07-19, pytany wprost,
co ma być następne — przed iPadem, przed fakturami i przed macOS. To jest
odstępstwo od kolejności faz z `00-plan.md` (tam Faza 7 = iPad) i jest
**świadome**: to rzeczy, których PWA nie potrafiła w ogóle, a apka jest już
realnie używana codziennie na telefonie.

Zakres: **widżet „co dziś"**, **skrót do Siri („zaloguj rozmowę")**,
**Share Extension** (udostępnij stronę → nowy lead), **Face ID przy wejściu**.

---

## Zanim napiszesz linijkę kodu: przeczytaj to, bo zmienia kolejność pracy

### Dwie z czterech rzeczy uderzają w darmowe konto Apple

Sprawdzone gretem 2026-07-19, stan repo:

- `project.yml` ma **jeden target** (`LeggeraHub`) i **zero entitlements**,
- `Keychain.swift` zapisuje token **bez `kSecAttrAccessGroup`**.

To ostatnie jest sednem całego modułu. **Widżet i Share Extension to osobne
procesy** — nie widzą Keychaina głównej apki, dopóki nie dostaną wspólnej
grupy dostępu (`keychain-access-groups`) albo App Group. Jedno i drugie to
**entitlement przypięty do zespołu Apple**, a właściciel pracuje na **darmowym
Apple ID** (README apki: podpis wygasa po 7 dniach, konto płatne zakłada „na
sam koniec").

Czyli: **widżet bez tokenu nie pobierze niczego i pokaże pustkę.** To nie jest
detal do rozwiązania „potem" — to jest pytanie, czy ta połowa modułu w ogóle
się uda przed założeniem płatnego konta.

**Nie zgaduj, czy się da — sprawdź to jako PIERWSZĄ rzecz w czacie**, na
najmniejszym możliwym targecie, zanim napiszesz jakikolwiek interfejs. Jeśli
się nie da, powiedz właścicielowi wprost i zrób to, co się da (niżej), zamiast
budować widżet, który zawsze świeci pusty.

Drugie ograniczenie darmowego konta: **limit identyfikatorów aplikacji**
(rzędu 10 na 7 dni). Każde rozszerzenie to osobny bundle ID, więc zabawa
w tworzenie i kasowanie targetów potrafi ten limit wyczerpać i zablokować
wgrywanie czegokolwiek na kilka dni. Twórz targety rozważnie.

### Kolejność pracy wynika wprost z powyższego

Rób **od rzeczy niezależnych od konta do zależnych** — wtedy nawet przy
najgorszym rozstrzygnięciu moduł kończy się czymś działającym:

1. **Face ID** — `LocalAuthentication`, zero entitlements, zero rozszerzeń.
2. **Siri / App Intents** — intencje mieszkają w **głównej apce**, nie
   w rozszerzeniu; też bez entitlements.
3. **Widżet** — wymaga rozstrzygnięcia z Keychainem.
4. **Share Extension** — jw., plus najwięcej ruchomych części.

---

## 1. Face ID przy wejściu

Najmniejsza i najpewniejsza część. Apka trzyma token w Keychain i wchodzi od
razu — na zgubionym telefonie **każdy, kto go odblokuje, widzi wszystkich
klientów**. Face ID zamyka tę dziurę bez zmiany czegokolwiek po stronie panelu.

- `LAContext`, `.deviceOwnerAuthentication` (**nie** `...WithBiometrics` —
  ten drugi nie pozwala wrócić kodem, gdy Face ID zawiedzie, np. w masce).
- **Blokada MUSI dać się wyłączyć.** To wewnętrzne narzędzie jednej osoby,
  a nie bank; wymuszona i niewyłączalna byłaby uciążliwością, nie
  bezpieczeństwem. Przełącznik w „Więcej".
- **Nieudane uwierzytelnienie nie kasuje tokenu.** Kuszące („bezpieczniej"),
  ale oznacza wpisywanie hasła po każdym nieudanym spojrzeniu.
- Pytanie do właściciela, jeśli nie odpowie sam: blokada przy **każdym**
  wejściu na pierwszy plan czy tylko po zimnym starcie? Domyśl: po zimnym
  starcie i po dłuższej nieobecności — inaczej przełączenie się do przeglądarki
  i z powrotem prosi o twarz co 10 sekund.
- **Nie da się tego zweryfikować bez dotyku**: dopasowanie twarzy w symulatorze
  to pozycja w menu `Features → Face ID`, nie polecenie `simctl`. Zaplanuj, że
  ten fragment potwierdzi właściciel na telefonie.

## 2. Siri: „zaloguj rozmowę"

- **`AppIntents`**, nie stary `SiriKit` — intencja jest zwykłym typem
  w kodzie, bez osobnego rozszerzenia i bez pliku intencji.
- Logika ma iść przez rdzeń (`AppStore.zalogujRozmowe`), nie przez własną
  kopię — inaczej reguły kanału/kierunku/wyniku rozjadą się z ekranem.
- **Intencja nie może wysyłać niczego sama poza zapisem logu.** Zasada projektu
  („model proponuje, właściciel zatwierdza") dotyczy AI, ale duch jest ten sam:
  głos steruje zapisem notatki, nie wysyłką maila do klienta.
- Uwaga na rdzeń: `LeggeraHubCore` **nie może importować `AppIntents`**
  (to framework platformowy) — intencja mieszka w warstwie widoku, jak
  `UNUserNotifications` przy stoperze.
- Weryfikacja bez dotyku jest trudna (Skróty to cudza apka). Da się sprawdzić,
  czy intencja **jest widoczna** dla systemu, i przetestować samą logikę
  wołaniem tej samej funkcji rdzenia.

## 3. Widżet „co dziś"

- `PulpitDzis` w rdzeniu **jest już gotowym agregatem** (leady, klienci,
  projekty po terminie, faktury, kamienie, poczta, wydarzenia, KPI) —
  widżet nie potrzebuje nowej trasy w panelu, tylko dostępu do `/api/hub/today`.
- Cała trudność to **token** (patrz wyżej). Rozstrzygnij to najpierw.
- Trzymaj widżet **mały i jednoznaczny**: liczba rzeczy wymagających ruchu dziś
  plus dwie–trzy najpilniejsze pozycje. Widżet, który próbuje pokazać cały
  Pulpit, staje się nieczytelnym znaczkiem — ten sam błąd, co „desktop
  wciśnięty w telefon" z porażki PWA.
- Odświeżanie: `TimelineProvider` z rozsądnym oknem (system i tak przydziela
  budżet). **Nie próbuj odświeżać co minutę** — iOS to zignoruje, a wyglądać
  będzie na zepsute.
- **Widżety da się zrzucić w symulatorze** — to jedna z niewielu rzeczy tego
  modułu, którą naprawdę obejrzysz sam.
- Reguła marki obowiązuje: jeden akcent, gradient wyłącznie na ikonach, tekst
  biały, bez systemowej czerwieni.

## 4. Share Extension: udostępnij stronę → nowy lead

- Wejście: URL (i tytuł strony) z Safari.
- **Rozszerzenie ma być głupie.** Niech weźmie adres, pokaże jedno pole na
  nazwę firmy i wyśle `POST /api/leads` — bez listy leadów, bez wykrywania
  duplikatów, bez wyboru statusu. Rozszerzenia mają twardy limit pamięci
  i giną, gdy się je przeciąży.
- `zrodlo_kategoria` = **„Ręcznie dodane"**, tak jak przy dodawaniu leada
  w apce. To NIE jest kosmetyka: panel wysyła powiadomienie (dzwonek) tylko
  dla kategorii „Formularz na stronie", a lead dodany świadomie ma nie hałasować.
- Znów: **token**. Jeśli Keychain nie da się współdzielić, ta część odpada
  razem z widżetem.

---

## Jak pracować (to samo, co się sprawdziło)

- Buduj i **oglądaj sam w symulatorze**: `xcodegen generate` → `xcodebuild` →
  `simctl install/launch` → `simctl io <dev> screenshot`.
- **Furtki DEBUG przez `SIMCTL_CHILD_*`**, nie flagą `--env` (README apki).
  Dołóż własne dla nowych ekranów.
- **Trasy zapisu sprawdzaj curlem** w dokładnie tym kształcie, którego używa
  apka.
- `LeggeraHubCore` **nie importuje SwiftUI, UIKit, AppIntents ani WidgetKit.**
- **Reguły żyjące w dwóch miejscach mają test parytetu** (README apki:
  `parseQuickAdd`↔`SzybkiDopisek`, `waLink`↔`Kontakty.whatsApp`). Jeśli
  dołożysz kolejną, dołóż i test.

## Dwie lekcje, które warto mieć z tyłu głowy

1. **Kod, który wygląda poprawnie, potrafi nie robić nic.** Przypomnienia
   stopera były „zaplanowane" i zgłaszały zero błędów, a kolejka iOS-a była
   pusta. Przy każdej rzeczy dziejącej się w tle (widżet, intencja, kolejka)
   zaplanuj sposób obejrzenia **prawdziwego stanu systemu**, zanim uznasz ją
   za zrobioną.
2. **Sprawdzaj, czy coś WOŁA kod, nie czy kod istnieje.** Trzy razy w tym
   projekcie pole i funkcja istniały, a nikt ich nie używał (Moduł 30,
   Moduł 31, WhatsApp w Fazie 6). Na pytanie „czy X jest gotowe" nie
   odpowiadaj z dokumentacji — zgrepuj wywołania.

## Czego NIE robić w tym module

- Nie ruszaj iPada, faktur, ofert ani macOS — to osobne fazy.
- **Nie dorabiaj powiadomień push.** Wciąż czekają na konto Apple Developer
  i to co innego niż lokalne powiadomienia stopera, które już działają.
- Nie przemalowuj istniejących ekranów przy okazji.

---

## Prompt otwierający kolejny czat

```
Kontynuujemy aplikację natywną Leggera Hub. Przeczytaj
docs/natywna-aplikacja/00-plan.md oraz
docs/natywna-aplikacja/04-brief-natywne-bajery.md, potem zrób ten moduł:
Face ID, skrót do Siri, widżet „co dziś" i Share Extension.
Repo apki: /Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios.

Zacznij od rozstrzygnięcia sprawy Keychaina i darmowego konta Apple
(sekcja „Zanim napiszesz linijkę kodu") — od tego zależy, czy widżet
i Share Extension są w tym momencie w ogóle wykonalne. Jeśli nie są,
powiedz mi to wprost i zrób Face ID oraz Siri.
```
