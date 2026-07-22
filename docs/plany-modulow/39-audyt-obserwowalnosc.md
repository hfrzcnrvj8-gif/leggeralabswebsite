# Brief: Audyt 4 — obserwowalność (pierwszy z siedmiu audytów końcowych)

> Brief wdrożeniowy pod **jeden osobny czat**. To nie jest nowy plan —
> to **wykonanie Audytu 4** z `docs/AUDYTY-KONCOWE.md`. Tamten dokument jest
> zakresem, ten mówi, jak go przejechać i co już wiadomo.
>
> Powstał 2026-07-22, w dniu, w którym bramka audytów się otworzyła.

## Dlaczego ten audyt jest pierwszy

Kolejność w `AUDYTY-KONCOWE.md` jest **wg ryzyka, nie wg numeracji**:
**4 → 1 → 3 → 2 → 6 → 5 → 7**. Obserwowalność idzie pierwsza, bo bez niej
kolejne audyty pracują na ślepo: nie da się ocenić, czy coś się psuje, kiedy
nic tego nie zapisuje.

Właściciel poprosił o to wprost, swoimi słowami:

> „żeby to działało teraz i działało zawsze, a jeżeli coś się gdzieś psuje albo
> jest zagrożenie, to wszystko ma swoje logi i jesteśmy w stanie szybko
> namierzyć miejsca problematyczne"

## Stan zastany — zmierzony 2026-07-22, nie założony

| Co | Stan |
|---|---|
| `console.error` w panelu | **95** |
| `console.log` / `console.warn` | 18 |
| System zbierający te błędy | **brak** (sprawdzone: zero zależności typu Sentry/Logtail/OTel) |
| Powiadomienie, gdy coś padnie | **tylko dla kopii zapasowych** |
| Retencja logów Vercela (plan Hobby) | liczona w godzinach |
| Trasy API | 148 tras / 210 uchwytów |
| Testy automatyczne | **zero**; `package.json` nie ma nawet skryptu `test` |

**Skutek, który trzeba nazwać wprost: awaria o 3:00 jest do rana niewidoczna
i nie do odtworzenia.** Panel może się psuć tygodniami, a jedynym objawem
będzie „jakoś dziwnie działa".

## Co ROZSTRZYGNĄĆ z właścicielem (nie decyduj sam)

1. **Narzędzie zewnętrzne czy własna tabela?** Sentry i podobne mają darmowe
   progi wystarczające dla jednej osoby. Własne rozwiązanie (tabela
   `error_log` + ta sama droga meldunku, co przy kopiach) ma zaletę: zero
   nowych usług, zero nowych kosztów, dane zostają u właściciela — a to jest
   jego wyrażona preferencja („jak najwięcej lokalnie"). **Ale** własne
   rozwiązanie nie zadziała, gdy padnie sama baza, i o tym trzeba powiedzieć,
   zanim wybierze.
2. **Czym ma przychodzić alarm?** Dziś jedyny kanał to dzienny mail. Alarm
   raz na dobę przy padniętej wysyłce faktur to za późno — ale częstsze
   powiadomienia bez progów uczą ignorowania.
3. **Ile hałasu jest do przyjęcia?** Próg nieaktualności kopii ustawiono na
   36 h, celowo nie 24 h, żeby nie budzić fałszywym alarmem. Ta sama
   ostrożność przy każdym nowym.

## Co ZROBIĆ (zakres wykonawczy)

Pełna lista w `AUDYTY-KONCOWE.md` → „Audyt 4". W skrócie, w kolejności:

1. **Zinwentaryzuj 95 miejsc.** Podziel na: prawdziwy błąd / sytuacja
   przewidziana / szum. Nie wszystkie 95 zasługuje na alarm — część to
   `catch` wokół rzeczy opcjonalnych.
2. **Reguła, co trafia do logu.** Bez danych osobowych (log jest zbiorem
   danych osobowych — patrz Audyt 2), z identyfikatorem pozwalającym powiązać
   zdarzenia, z jasnym rozróżnieniem „błąd" od „przewidziane".
3. **Rozszerz wzorzec z kopii zapasowych.** Mechanizm z 2026-07-20 (meldunek →
   ocena stanu → pas na Pulpicie → linia w dziennym mailu) jest gotowy
   i sprawdzony. Kandydaci: synchronizacja poczty, cron dzienny, KSeF,
   kolejka wysyłki odłożonej, faktury cykliczne.
   **Zasada: każdy proces, który chodzi bez patrzenia, musi umieć się poskarżyć.**
4. **Zdrowie systemu jednym rzutem oka** — jeden ekran albo sekcja w dziennym
   mailu: kiedy ostatnio zadziałał każdy automat.

## Czego NIE robić

- **Nie dobudowuj funkcji.** Pytanie brzmi „czy to, co jest, da się utrzymać",
  nie „czego brakuje".
- **Nie przepisuj działającego kodu**, bo dałoby się ładniej.
- **Nie odkrywaj na nowo świadomych decyzji.** Sprawdź `CLAUDE.md` i sekcje
  „świadomie odłożone", zanim uznasz coś za błąd.
- **Nie rób przy okazji Audytu 1 ani 6.** Kuszą, bo są blisko. Jeden audyt =
  jeden czat; zmęczenie kontekstu daje pobieżne ustalenia, a te są gorsze niż
  ich brak, bo usypiają czujność.

## Dwa znaleziska z 2026-07-22, których NIE szukaj drugi raz

Wypadły przy okazji rozmowy o gotowości produkcyjnej. **Oba należą do Audytu 1
(bezpieczeństwo), nie do tego** — zapisane tu, żeby nie zginęły:

1. **`POST /api/admin/login` nie ma żadnego ograniczenia liczby prób.** Jedno
   hasło, nielimitowane strzały, publicznie dostępny endpoint. Samo porównanie
   hasła jest odporne na atak czasowy (`timingSafeEqual` w `lib/auth.ts`) —
   brakuje wyłącznie hamulca. Właściciel wie; ustalone, że to rzecz numer jeden
   do zrobienia, zanim w bazie znajdą się dane pierwszego klienta.
2. **Tylko 9 ze 148 tras nie sprawdza `isAuthed()`** i wszystkie wyglądają na
   świadomie publiczne: `calendar/ics`, `telefonia/webhook`, `admin/login`,
   `admin/logout`, `backup/ping`, `contracts/public/[token]`(+`accept`),
   `invoices/wezwanie/public/[token]`, `projects/review/public/[token]`.
   Audyt 1 ma je przejrzeć po kolei — „brak `isAuthed`" nie znaczy „dziura",
   ale każda z tych dziewięciu musi mieć własne uzasadnienie i własną ochronę
   (siła tokenu, sekret, wygasanie).

## Zasady prowadzenia (z trzech poprzednich audytów)

1. **Dokumentacja kłamie — weryfikuj gretem, nie pamięcią.**
2. **Sprawdzaj, czy coś WOŁA kod, nie czy kod istnieje.** W tym projekcie
   pięć razy pole i funkcja istniały, a nikt ich nie wywoływał — ostatni raz
   2026-07-22 (profil klienta gubił wynik rozmowy).
3. **Zielony build nie jest dowodem.** Wszystkie najpoważniejsze błędy tego
   projektu kompilowały się bez zarzutu.
4. **Nie powtarzaj poprzednich audytów** — przeczytaj ich ustalenia najpierw.

**Wynik audytu:** lista ustaleń z priorytetem, każde poparte odczytem kodu albo
uruchomieniem, plus wprost wypisane „sprawdzone i jest dobrze" — bo to też jest
wynik. Ustalenia wymagające decyzji nietechnicznej idą do właściciela wprost,
po polsku, bez żargonu.

## Prompt otwierający kolejny czat

```
Przeczytaj docs/plany-modulow/39-audyt-obserwowalnosc.md, potem
docs/AUDYTY-KONCOWE.md (sekcja „Audyt 4") i CLAUDE.md.

Zrób Audyt 4 — obserwowalność. To pierwszy z siedmiu audytów końcowych,
kolejność jest wg ryzyka: 4 → 1 → 3 → 2 → 6 → 5 → 7. Rób tylko ten jeden.

Zacznij od zinwentaryzowania 95 miejsc z console.error i podziału ich na
prawdziwe błędy, sytuacje przewidziane i szum — chcę wiedzieć, ile z tego
naprawdę zasługuje na alarm, zanim cokolwiek zbudujemy.

Potem zadaj mi trzy pytania z briefu (narzędzie zewnętrzne czy własna tabela,
czym ma przychodzić alarm, ile hałasu jest do przyjęcia). Nie decyduj za mnie.

Każde ustalenie ma być poparte odczytem kodu albo uruchomieniem, nie opisem
z dokumentacji.
```
