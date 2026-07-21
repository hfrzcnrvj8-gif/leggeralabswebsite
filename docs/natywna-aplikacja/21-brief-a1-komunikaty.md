# Brief: apka przestaje kłamać pustymi ekranami (ustalenie A1)

> Repo apki: `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`.
> Spisany 2026-07-21 po zamknięciu Fazy 15. **Osobny czat.**
> Stan wyjściowy: wydanie **56** (`9558410`) na iPhonie 15 Pro Max.
>
> A1 ciągnie się od audytu Fazy 11½ i jest **jedyną pozycją, którą audyt
> końcowy nazwał otwartym długiem** — reszta to brakujący zakres albo funkcje
> do dołożenia. Kształt rozwiązania właściciel wybrał 2026-07-21.

## Na czym polega problem

Apka po nieudanym pobraniu pokazuje **pusty stan**, czyli komunikat „nic tu nie
ma". To nie jest kosmetyka: ekran mówi coś **nieprawdziwego** o firmie. Różnica
między „nie masz dziś żadnych leadów" a „nie udało mi się ich pobrać" to
różnica między spokojnym dniem a przegapionym zgłoszeniem.

Najostrzejszy przykład, bo ekran sam siebie opisuje: `ZaplanowaneView` otwiera
się komentarzem *„niewidoczna kolejka to najgorszy rodzaj kolejki"*, po czym
przy padniętej sieci pokazuje **„Nic nie czeka. Odłożone wiadomości pojawią się
tutaj, zanim polecą."** — bo `pobierzKolejkeWysylki()` w `catch` pisze do
`bladLeadow` i **zwraca `[]`**, a ten widok `bladLeadow` nie czyta.

## Stan wyjściowy — zmierzony 2026-07-21 na wydaniu 56

Nie przepisany z audytu; przeliczony po zmianach Fazy 15.

| Miara | Wartość |
|---|---|
| Ekrany z pustym stanem (`ContentUnavailableView`) | **20** (26 wystąpień) |
| Z tego **nie czytających żadnego** pola błędu | **16** |
| Przypisania do `bladLeadow` | **67** |
| Przypisania do `bladAkcji` | 7 |
| `catch` kończący się `return []` / `nil` / `false` | **33** |
| `catch APIError.nieautoryzowany` (kopia w kopię) | **80** |
| Widoki czytające `bladLeadow` / `bladAkcji` / `odmowaBramki` | 3 / 3 / 1 |
| `AppStore.swift` | 2377 linii |

**Szesnaście ekranów potrafi powiedzieć „nic nie ma", kiedy naprawdę znaczy
„nie wiem".** Oto one:

`FakturyView`, `KlientDetailView`, `KosztyListView`, `LeadDetailView`,
`NotatnikView`, `OfertyView`, `PocztaListView`, `PowiadomieniaView`,
`ProjektyListView`, `RejestrView`, `StatystykiView`, `SubskrypcjeView`,
`SzablonyView`, `SzukajView`, `WiecejView`, `ZaplanowaneView`.

## Decyzja właściciela (2026-07-21)

**Jedna kolejka komunikatów w chrome**, wzorem `odmowaBramki`, zamiast dwunastu
pól modułowych. Do tego uwaga wynikająca wprost z pomiaru:

> **Sama kolejka NIE wystarczy.** Trzeba przy okazji dać pustym stanom trzeci
> wariant — „nie udało się wczytać" obok „pusto" i „ładuję" — inaczej 16 ekranów
> dalej będzie mówić „nic nie ma", tylko z dodatkowym dymkiem u góry.

To jest sedno tego modułu. Kolejka komunikatów jest łatwiejszą połową.

## Dwie osie, nie jedna

Rozdziel je świadomie, bo mają różne naprawy:

1. **Powiadomienie o awarii** — jedna kolejka w chrome, widoczna niezależnie od
   ekranu. Zastępuje `bladLeadow` jako kanał.
2. **Stan ekranu** — każdy widok listy musi umieć rozróżnić trzy rzeczy:
   `ładuję` / `pusto` / `nie udało się`. Dziś ma dwie.

Oś 2 wymaga, żeby widok **wiedział**, że jego pobranie padło. Dzisiaj nie wie:
metoda `AppStore` łyka błąd i zwraca `[]`, więc widok widzi pustą tablicę
nieodróżnialną od prawdziwej pustki. **To jest właściwy rdzeń A1** — nie liczba
pól błędu.

## Trzy istniejące pola — co z nimi

Nie są długiem i nie kasuj ich bezmyślnie:

- `odmowaBramki` (409, bramka umowy) — **wzorzec do naśladowania**, zostaje;
- `bladAkcji` (arkusze, Faza 13.1) — 7 miejsc, dobrze zakresowane;
- `bladLeadow` — **to jest dług**: 67 zapisów obsługujących dwanaście modułów.

## Podpowiedź, nie zlecenie: `wykonaj<T>(_:)`

Audyt 13.4 zauważył, że **80 kopii `catch APIError.nieautoryzowany`** i A1 to ta
sama robota. Wspólny helper w `AppStore` mógłby naraz: obsłużyć 401, wrzucić
komunikat do kolejki i zwrócić wynik w formie, która **odróżnia awarię od
pustki** (np. `Result` albo osobny stan ładowania per zasób).

Rozstrzygnij to na początku tamtego czatu — od tego zależy kształt całej paczki.
**Nie przyjmuj tego jako gotowej decyzji.**

## Czego NIE robić

- **Nie dziel `AppStore.swift`** przy okazji. Audyt odpowiedział „jeszcze nie";
  dzielić dopiero, gdyby po A1 nadal przeszkadzał.
- **Nie ruszaj „poziomu 3"** (faktury, korekty, KSeF, oferty, umowy).
- **Nie rób z tego alarmu.** Haptyka odmowy (Faza 15) jest świadomie NIE
  podpięta pod `bladLeadow`: telefon w kieszeni na słabym zasięgu wibrowałby
  sam z siebie. Kolejka komunikatów ma tę samą pułapkę — cicha awaria
  odświeżania w tle nie może krzyczeć.
- **Nie ruszaj `TykajacyCzas`** ani Live Activity.

## Jak weryfikować

Ten moduł ma **wyjątkowo łatwą** weryfikację i nie ma wymówki, żeby jej pominąć:

```
LEGGERA_DEV_BACKEND=http://10.255.255.1:3000
```

To adres pochłaniający pakiety — czyli realne „panel padł / zły WiFi", nie „port
zamknięty". Po poprawce N1 (limit zasobu 45 s) żądanie kończy się błędem, więc
**każdy z 16 ekranów da się obejrzeć w stanie awarii** i zrobić zrzut.

Symulator w zupełności wystarcza; telefon niepotrzebny. Panel lokalny:
`npm run dev` w repo strony (dev-seed + PGlite).

## Kontekst, który oszczędzi czasu

- `docs/natywna-aplikacja/17-wynik-audytu-koncowego.md` — ustalenie A1 i N1.
- `docs/natywna-aplikacja/20-wynik-plynnosc-i-haptyka.md` — Faza 15; zwłaszcza
  sekcja o progach renderowania, bo **trzeci wariant pustego stanu to dokładnie
  taki próg** i łatwo powtórzyć tam błąd „ekran maluje się na raty".
- README apki → „Żądania ekranu idą RÓWNOLEGLE" i „Ruch i haptyka".

## Powtarzalny wzorzec tego projektu — sprawdź, zanim uznasz coś za zrobione

Cztery razy z rzędu wychodziło to samo: **pole istnieje, kod wygląda poprawnie,
nikt go nie woła.** Moduły 30/31 (pole nie wysyłane), N6 (cała warstwa sieci bez
wołającego), N2 (domknięcie bez wstrzyknięcia), Faza 15 (`entity` dekodowane
i nieczytane).

Przy tym module pytanie kontrolne brzmi: **ile ekranów NAPRAWDĘ pokazuje nowy
stan błędu** — nie „ile ekranów dostało nowy kod". Mierz greppem po widokach,
nie po `AppStore`.
