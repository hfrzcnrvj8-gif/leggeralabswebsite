# Czego mają dojrzałe CRM-y, a my nie — i co z tego naprawdę warto

> Spisane 2026-07-26 na pytanie właściciela: „wymieniasz sporo rzeczy, których
> nie mamy, a oni mają — czy coś z tego warto dodać, żeby być future-proof?".
> To NIE jest lista zadań. To rozstrzygnięcia, żeby nie wracać do nich co
> kilka tygodni od zera.

Punkt odniesienia: Attio, Linear, HubSpot. Kontekst: **jedna osoba, zero
klientów na dziś**, panel + apka iOS, dane własne.

## Jedno „tak": wyszukiwanie pełnotekstowe po wszystkim

**Dlaczego akurat to jest future-proof, a reszta nie.** Wartość wyszukiwania
rośnie wprost proporcjonalnie do ilości danych — dokładnie ta krzywa, o którą
chodzi w pytaniu. Przy dwóch klientach jest bezużyteczne, przy dwudziestu
i trzech latach korespondencji jest jedyną drogą do zdania „przecież
rozmawialiśmy o tym z kimś rok temu, tylko nie pamiętam z kim".

**Co już mamy:** paleta poleceń (⌘K) szuka po NAZWACH rekordów, a szukanie po
treści historii jest tylko przy Kliencie (Moduł 54, krok 2). Poza tym treści
maili, notatnika, ofert, faktur i umów są nieprzeszukiwalne.

**Czego brakuje:** jednego indeksu po treści z wszystkich modułów. Postgres ma
to w standardzie (`to_tsvector` + GIN), więc **to nie jest nowa zależność ani
nowy serwis** — to jedna kolumna wyliczana i jedno zapytanie. Do przemyślenia
przy budowie: polski słownik (`polish` nie jest wbudowany — jest `simple`
i trzeba zdecydować, czy wystarczy), oraz RODO — indeks po treści maili
to kolejna kopia danych osobowych i musi go objąć retencja z Audytu 2.

**Kiedy:** nie teraz. Po domknięciu modułów lejka (Oferty → Umowy → …),
przed pierwszym prawdziwym klientem albo zaraz po nim.

## Jedno „pilnuj, nie buduj": druga osoba w systemie

Panel jest **świadomie jednoosobowy** — brak ról, brak wielu użytkowników
(CLAUDE.md). To dobra decyzja i nie należy jej teraz cofać: budowanie ról dla
jednej osoby to praca dla hipotezy.

**Ale to jest jedyna rzecz z tej listy, która zdrożeje NIELINIOWO**, jeśli
kiedyś dojdzie podwykonawca albo księgowa z własnym dostępem. Nie dlatego, że
trzeba dopisać role — dlatego, że dziś **każda trasa zna dokładnie jedną
odpowiedź na pytanie „kto to robi"**, a log zmian (`field_changes`) nie ma
kolumny „kto".

**Co z tym zrobić dziś:** nic poza jednym nawykiem — **nie dokładać założenia
„użytkownik jest jeden" tam, gdzie nie musi**. Przy nowej tabelce z historią
działań kolumna `kto` kosztuje dziś zero, a jej brak kosztuje później migrację.

## Świadome „nie" — z powodem, nie z lenistwa

| Czego nie mamy | Dlaczego NIE budujemy |
|---|---|
| Widoki per zespół, uprawnienia | Jedna osoba. Zapisane widoki już są (`SavedViews`), a uprawnienia bez drugiego użytkownika nie mają czego chronić. |
| Budowniczy automatyzacji („jeśli to, to tamto") | To narzędzie dla kogoś, kto ma opisać CUDZY proces. Ty konfigurowałbyś je raz — czyli taniej jest zaprogramować regułę wprost, jak dotąd. Dodatkowo: generyczny builder rozmywa zasadę „automat proponuje, decyzję klikasz Ty". |
| Raportowanie z przeciągania pól (pivot) | Moduł Statystyki odpowiada na pytania, które faktycznie zadajesz. Budowniczy raportów dla jednego odbiorcy to interfejs do zadawania pytań, które i tak zadasz mi wprost. |
| Integracja z telefonią z pudełka | Świadomie odłożone (WebRTC→CallKit). Quick-log rozmowy i webhook już są i pokrywają realną potrzebę. |
| Edycja wielu rekordów naraz z klawiatury | Wsad po stronie serwera już jest (Moduł 54, krok 3b). Interfejs do masowej edycji ma sens przy setkach rekordów, nie przy kilkunastu. |

## Rzecz spoza tej listy, warta więcej niż cokolwiek z niej

**Szablony ofert** (`20-szablony-ofert.md`) — brief istnieje, moduł czeka.
To jedyna pozycja, która oszczędza czas przy KAŻDEJ ofercie, a nie dopiero
przy dużej skali. Wpada wprost w zakres najbliższego modułu (Oferty), więc
zacząć należy od sprawdzenia, ile z tego briefu jest już zbudowane.
