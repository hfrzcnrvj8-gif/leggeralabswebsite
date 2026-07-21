# Brief: gesty w bok w Fakturach i innych modułach (dopisek do Fazy 14)

> Repo apki: `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`.
> Spisany 2026-07-21, po zgłoszeniu właściciela podczas testów Modułu A5/A8/A9
> na telefonie. **Osobny czat, razem z `18-brief-menu-przytrzymania.md`
> (Faza 14) — to jest ten sam temat afordancji list, nie nowy.**

## Skąd to się wzięło

Właściciel, testując build 59 na telefonie: *„fajnie jakby w fakturach jak
i innych modułach po przesunięciu lewo/prawo były jakieś funkcje (jak
w mailu) oraz ciągle nie działa dłuższe przytrzymanie pozycji aby wywołać
menu akcji"*.

Druga część zdania (długie przytrzymanie) **ma już gotowy brief** —
`18-brief-menu-przytrzymania.md`, spisany tego samego dnia po audycie
końcowym, nigdy nie zrealizowany. Właściciel nie wiedział, że już istnieje —
warto to powiedzieć na starcie tamtego czatu, żeby nie tłumaczyć drugi raz
tego, co już jest rozpisane.

Pierwsza część (gesty w bok poza Pocztą) jest nowa — dopisek do tego samego
briefu, bo to ta sama rodzina afordancji („co ten wiersz umie zrobić bez
wchodzenia w środek").

## Stan zmierzony dziś (2026-07-21, build 59)

- `swipeActions` istnieje w **10 plikach** (audyt z briefu 18) — głównie
  Poczta i (od dziś) pojedynczy wiersz Wpłat w `FakturyView.swift` (Moduł A9).
- Listy **główne** rekordów (Faktury, Oferty, Umowy, Leady, Klienci, Koszty,
  Projekty) **nie mają żadnego gestu w bok** na wierszu listy — wejście
  w rekord to jedyna droga do jakiejkolwiek akcji.
- `.contextMenu` / `onLongPressGesture`: **0** w całej apce (bez zmian od
  briefu 18).

## Zakres do rozstrzygnięcia W CZACIE

Brief 18 ma już tabelę kandydatów na menu przytrzymania per moduł — to jest
punkt startowy. Do tego dochodzi pytanie o **gest w bok** per moduł (jedna,
najczęstsza akcja — patrz reguła niżej), np.:

| Wiersz listy | Kandydat na gest w bok |
|---|---|
| Faktura | Oznacz opłaconą (jeśli nieopłacona) / Wyślij przypomnienie (jeśli po terminie) |
| Oferta | Wyślij ofertę |
| Umowa | Wyślij do podpisu |
| Lead | Zadzwoń albo Zmień status |
| Klient | Zadzwoń (już jest — patrz `KlienciListaTresc.swift`, wzorzec do skopiowania) |
| Koszt | Oznacz opłacony |

To propozycja, nie zlecenie — pierwsze zadanie tamtego czatu to przejść ją
z właścicielem, tak jak brief 18 każe zrobić z tabelą menu.

## Reguła (ta sama co w briefie 18)

**Gest w bok i menu przytrzymania DZIELĄ się robotą, nie dublują jej.**
Gest w bok = jedna, najczęstsza akcja. Przytrzymanie = komplet. Rób je razem,
w jednej paczce — osobno wychodzi niespójnie (działa na Fakturach, nie na
Ofertach) i wtedy nikt nie próbuje żadnego z dwóch.

## Czego NIE robić

Patrz `18-brief-menu-przytrzymania.md` → „Czego NIE robić" — te same zasady
(nie ruszać poziomu 3, nie dokładać akcji bez wołającego w `APIClient`, nie
zastępować już istniejących gestów w Poczcie).

## Jak weryfikować

**Symulator + mysz działa** — sprawdzone w tej sesji (Moduł A5/A8/A9,
2026-07-21): `computer-use` z dostępem do „Simulator" potrafi scrollować
(przez `left_click_drag`, nie scroll wheel — ten nie działał) i klikać
w listach, przyciskach i `confirmationDialog`. To odpowiada na pytanie z
briefu 18 („jak zweryfikować bez dotyku") — nie trzeba już zakładać wyłącznie
telefonu i QuickTime.

## Stan wyjściowy

- Wersja apki w chwili spisania: **59** (`03a1ff5` + poprawki A5/A9 tego dnia),
  wgrana na iPhone'a i na symulator.
