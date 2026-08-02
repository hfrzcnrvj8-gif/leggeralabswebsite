# Przejście „na sucho”

Cała droga klienta jednym poleceniem: lead → rozmowa → oferta → wysyłka →
akceptacja → umowa → podpis → projekt → faktura → zapłata → opinia.

```bash
npm run dev          # w jednym oknie
npm run przejscie    # w drugim
```

Powstało jako Faza 0 planu `docs/PLAN-ZAPLECZE.md`, po ręcznym przejściu
opisanym w `docs/PIERWSZE-PRZEJSCIE-NA-SUCHO.md`.

## Po co, skoro jest `npm test`

`npm test` to 34 pliki nad **czystymi funkcjami** z `lib/` — arytmetyka
faktur, daty, walidacja, TOTP. Ani jeden nie dotyka trasy API ani bazy.
Dlatego 209 przechodzących testów współistniało z ofertą wychodzącą do klienta
bez danych wystawcy: ten błąd nie mieszkał w żadnej funkcji, tylko w tym, co
trasa zapisała (albo czego nie zapisała).

Przejście sprawdza **dane po każdym kroku, nie kody odpowiedzi** — bo wszystkie
znaleziska z ręcznego przejścia wyszły z kodem 200.

## Cztery stany, nie dwa

| | znaczenie | wywala? |
|---|---|---|
| `✓ DZIAŁA` | ma działać i działa | nie |
| `✗ REGRESJA` | miało działać, nie działa | **tak, kod 1** |
| `⚠ ZNANA LUKA` | nie działa i wiemy o tym (numer z dokumentu przejścia) | nie |
| `★ NAPRAWIONE` | znana luka zaczęła działać | nie, ale krzyczy |

Gdyby to była zwykła asercja, skrypt byłby czerwony od pierwszego
uruchomienia i nie dałoby się odróżnić „luka, o której wiemy” od „właśnie coś
zepsuliśmy”.

**`★ NAPRAWIONE` jest tu najważniejsze.** Gdy naprawisz lukę i nie zdejmiesz
znacznika `luka` z asercji, skrypt to wykryje i powie wprost. To pilnuje, żeby
lista nie zestarzała się tak, jak zestarzała się tabela Modułu 59 — 34
wskazania, z czego 22 nieaktualne, bo nikt nie przechodził jej po naprawach.

## Dwie dodatkowe miary

**`↻ obejścia`** — ile razy trzeba załatać przepływ ręcznie, żeby w ogóle
dojść do końca. Dziś jedno: dopisanie e-maila klienta do oferty, bo bez niego
wysyłka odbija się o własną bramkę (skutek luki B1). Ta liczba powinna spaść
do zera po Fazie 1.

**`⊘ pominięte`** — czego dany przebieg NIE sprawdził. Bez tego skrypt
udawałby, że pokrycie jest pełne.

## Ograniczenia, o których trzeba wiedzieć

**Hamulec publicznych dokumentów: 5 prób / 60 min** na odcisk żądania
(`HAMULEC_DOKUMENT_PUBLICZNY`, audyt Modułu 57). Po kilku przebiegach pod rząd
droga **klienta** — akceptacja oferty i wysłanie opinii przez publiczny link —
przestaje być dostępna. Skrypt to wykrywa, dopina te kroki od strony panelu
i wypisuje je w `⊘ pominięte`.

To nie jest usterka i **nie wolno tego osłabiać dla wygody testu**. Żeby
przejść drogę klienta naprawdę: odczekaj godzinę albo zrestartuj `npm run dev`
(PGlite żyje w pamięci procesu, więc restart = czysta baza i czysty licznik).

**Skrypt ustawia własne warunki początkowe** — wpisuje „Dane firmy”
(prowizoryczne, firma nie jest zarejestrowana). Bez tego wynik zależałby od
tego, kiedy wstał serwer i czy ktoś wcześniej klikał po panelu. Sonda bramki
wysyłki czyści je na chwilę i **zawsze przywraca**.

**Skrypt zakłada prawdziwe rekordy** w dev-bazie, z sygnaturą czasu w nazwie
firmy (`Drukarnia Helios [przejście 104233]`). Restart serwera je czyści.

## Pułapka, w którą sam wpadłem — nie powtarzaj

Pierwsza wersja sprawdzała „czy wysyłka odmówiła”, patrząc na `status >= 400`.
Odmówiła — ale z powodu **pustego e-maila klienta**, nie braku wystawcy. Test
ogłosił lukę A2 za naprawioną, choć dokument dalej wychodził anonimowy.

**Sprawdzaj powód, nie kod.** Jeśli dwie różne przyczyny dają ten sam kod,
asercja musi je rozróżnić — albo trzeba zbudować sterowaną sondę, która zmienia
jedną rzecz naraz (patrz krok „Sonda: bramka wysyłki”).

## Gdy dokładasz sprawdzenie

```ts
sprawdz(
  "zdanie, które MA być prawdziwe o zapleczu",
  warunek,
  "B1",                    // numer luki — pomiń, jeśli to MA działać dziś
  "co dokładnie zobaczyłem" // pokazywane tylko przy niepowodzeniu
);
```

Zdanie pisz **twierdząco i po ludzku** — ten plik jest zarazem opisem tego, co
zaplecze ma robić. „opinia domyka projekt”, nie „sprawdź status po review”.
