# Brief: Faza 13.1, paczka 2 — kształtowanie projektu

> Repo apki: `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`.
> Ciąg dalszy `13-brief-domkniecie-apki.md`. **Paczka 1 („poza biurkiem")
> jest zrobiona i wgrana 2026-07-20 — nie powtarzaj jej.**

## Skąd ta paczka

Faza 13.1 miała 14 pozycji, czyli za dużo na jeden czat. Podzielona na trzy
paczki wg tego, ile kosztuje brak:

| Paczka | Zakres | Stan |
|---|---|---|
| 1 — poza biurkiem | nurture, opinie, NIP/VIES, logi klienta | ✅ 2026-07-20 |
| **2 — kształtowanie projektu** | **ten dokument** | ⏳ |
| 3 — konfiguracja i liczby | ustawienia, `/api/stats`, cykliczne, eksporty, ICS | ⏳ |

Paczka 3 jest ostatnia świadomie: `/api/stats` to największy model do napisania
w całej Fazie 13.1 przy najmniejszym zysku na telefonie, a eksporty CSV i ICS
to czynności jednorazowe, w których telefon nie ma przewagi nad biurkiem.

## Zakres paczki 2

Wszystko dotyczy JEDNEGO ekranu — profilu projektu (`ProjektDetailView.swift`).

1. **Zakładanie zadań i kolejność** — `POST /api/projects/[id]/tasks`
   (`{text, milestone_id?}` → `{ok, tasks[]}`) oraz
   `POST /api/projects/[id]/tasks/reorder` (`{ids: string[]}` → `{ok, tasks[]}`).
2. **Kamienie milowe** — `POST /milestones` (`{nazwa, termin?}`),
   `PATCH|DELETE /milestones/[milestoneId]`, `POST /milestones/reorder`.
3. **Onboarding** — `POST /onboarding` (`{tekst}` **albo** `{seedDefaults}`),
   `PATCH|DELETE /onboarding/[itemId]` (`{done?, tekst?}`).
4. **Zasoby** — `POST /resources` (`{etykieta, url}`),
   `DELETE /resources/[resourceId]`.
5. **Zależności** — `POST|DELETE /dependencies` (`{depends_on_id}`). Serwer
   odrzuca (400) odwołanie do samego siebie i cykl wsteczny.
6. **Planowanie notatki** — `POST /api/notes/[id]/schedule`
   (`{data: "YYYY-MM-DD", godzina?}` → zamienia notatkę w wydarzenie) oraz
   `GET|POST /api/notes/[id]/activity`. To jedyna pozycja spoza profilu
   projektu; wchodzi tu, bo „przekuj notatkę" już w apce jest i to jest jej
   brakująca połowa.

### Co JUŻ działa (nie buduj tego drugi raz)

Zweryfikowane w kodzie 2026-07-20, wbrew temu, co sugerował brief 13:

- **Onboarding, kamienie i zasoby są już czytane i wyświetlane.**
  `GET /api/projects/[id]` zwraca je w środku, a apka dekoduje je do modeli
  w `Models/Projekt.swift`. **Brakuje wyłącznie zapisu** — nie pisz modeli od
  zera i nie wyceniaj tego jak nowego modułu.
- **Odhaczanie zadań działa** (`PATCH /tasks/[taskId]`). Luką jest zakładanie
  i kolejność, nie edycja.
- Zależności apka świadomie pomijała przy dekodowaniu (`ProjektSzczegoly`) —
  tu model trzeba faktycznie dołożyć.

## Zasada przewodnia (bez zmian, właściciel 2026-07-20)

Automatyka · przypomnienia · monitoring na żywo · **wszystko związane
z klientem/leadem jest tak oznaczone i trafia do historii tego konta**
(`logClientEvent`). Funkcja tworząca zdarzenie bez przypięcia go do konta jest
niedokończona.

## Pułapki, które kosztowały już czas

- **Sprawdź, czy nowa funkcja ma NA CZYM działać w danych testowych.** Paczka 1
  oddała kontakty nurture, których nie dało się zobaczyć ani na produkcji, ani
  lokalnie — bo powstają same, 14 dni po zamknięciu projektu. Zanim uznasz coś
  za zrobione, zadaj sobie pytanie: czy istnieje wiersz w bazie, który to
  wyświetli? Jeśli nie — dołóż go do `ensureSeeded()` w `lib/dev-db.ts`.
- **Nowa akcja na istniejącym wierszu potrzebuje afordancji.** Wiersz, który
  stał się klikalny, ale wygląda identycznie jak przedtem, jest dla właściciela
  nieodróżnialny od braku zmian (zgłoszenie 2026-07-20: „nie widzę nic nowego").
- **Nie ufaj własnemu komentarzowi o tym, co przyjmuje trasa.** W paczce 1
  komentarz twierdził, że `POST /api/clients` nie bierze ulicy ani kodu; brał.
  Adres pobrany z Białej Listy ginął w chwili zapisu. Otwórz `route.ts`.

- **Kilka `.sheet` na jednym widoku SwiftUI = działa jeden.** `ProjektDetailView`
  ma od paczki 1 jeden arkusz wybierany wartością (`enum Arkusz`) — dokładaj
  przypadki do niego, NIE nowe `.sheet(isPresented:)`.
- **Nie portuj reguł panelu do Swifta**, jeśli da się je wziąć z serwera. Przy
  paczce 1 wygrało to dwa razy (szkic nurture bierzemy z trasy; szkic
  podsumowania projektu świadomie NIE jest portem — patrz `OpiniaView.swift`).
  README apki: „Trzy reguły żyją w DWÓCH miejscach".
- **Każde nowe pole daty** musi iść przez walidację i wyświetlać się przez
  `formatPlDate`/`Daty.poPolsku` — `<input type="date">` potrafi zapisać rok
  „0202". Dotyczy terminu kamienia milowego.
- **Telefon rozmawia z produkcją.** Weryfikacja czegokolwiek, co wysyła maila
  albo kasuje rekord, kończy się na otwarciu ekranu — reszta należy do
  właściciela. Do iterowania wyglądem służy `LEGGERA_DEV_BACKEND=lokalny`
  w symulatorze.
- **Usuwanie**: apka dziś nie kasuje NICZEGO (żaden `DELETE` nie jest wołany).
  Paczka 2 wprowadza pierwsze kasowanie (kamień, zasób, zależność) — zrób to
  gestem w bok z potwierdzeniem, nie gołym przyciskiem.

## Czego nie ruszać

Poziom 3, udokumentowany: wystawianie i edycja faktur, korekty, KSeF, pozycje
i akceptacja ofert, cały moduł umów. Oś czasu / Gantt (`/api/projects/timeline`)
też zostaje przy biurku — na telefonie nie ma jak jej pokazać.

## Prompt do wklejenia w nowym czacie

```
Przeczytaj docs/natywna-aplikacja/14-brief-faza13-paczka2.md, potem CLAUDE.md
i README apki (/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios).

Bierzemy Fazę 13.1, paczkę 2 — kształtowanie projektu. Paczka 1 (nurture,
opinie, NIP/VIES, logi klienta) jest zrobiona i wgrana, nie powtarzaj jej.

Zanim napiszesz linijkę kodu, sprawdź w kodzie — nie na słowo dokumentacji —
co z zakresu paczki 2 już działa. Brief mówi, że onboarding, kamienie i zasoby
są CZYTANE i brakuje tylko zapisu; potwierdź to albo obal, zestawiając
app/api/projects/[id]/route.ts z tym, co dekoduje Models/Projekt.swift.

Trzymaj zasadę nadrzędną: automatyka, przypomnienia, monitoring na żywo,
i wszystko związane z klientem/leadem ma trafiać do historii tego konta.

Nie ruszaj poziomu 3 (faktury, KSeF, oferty, umowy, oś czasu).

Weryfikuj na moim telefonie (procedura w README apki, działa). Pamiętaj, że
telefon gada z produkcją — nic nie wysyłaj ani nie kasuj na prawdziwych
danych, zatrzymaj się na otwarciu ekranu i powiedz mi, co mam stuknąć.
```
