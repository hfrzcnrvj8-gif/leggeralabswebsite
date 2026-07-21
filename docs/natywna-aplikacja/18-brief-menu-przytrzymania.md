# Brief: menu po przytrzymaniu (Faza 14)

> Repo apki: `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`.
> Spisany 2026-07-21, na prośbę właściciela, po audycie końcowym
> (`17-wynik-audytu-koncowego.md`). **Osobny czat.**

## Skąd to się wzięło

Zgłoszenie właściciela, dosłownie: *„nie ma w aplikacji opcji, że jeżeli
przytrzymam dłużej jakiś przycisk czy opcję, to nie ma żadnej dodatkowej
funkcji albo szybkiego działania"*.

Zweryfikowane gretem, nie na słowo — i zgadza się co do joty:

| Rzecz | Wynik |
|---|---|
| `.contextMenu` w całej apce | **0** |
| `onLongPressGesture` / `LongPressGesture` | **0** |
| pliki z `swipeActions` | 10 |

Jedyne, co reaguje na przytrzymanie, to **ikona apki na ekranie głównym**
(`UIApplicationShortcutItems`, Faza 13.2) — czyli zupełnie inna powierzchnia,
obsługiwana przez system, nie przez widoki.

To jest luka w podstawowej afordancji iOS-a: przytrzymanie wiersza znaczy tam
„pokaż mi wszystko, co mogę z tym zrobić". Dziś apka po każdą taką rzecz
odsyła do wnętrza rekordu — dwa stuknięcia i powrót zamiast jednego gestu.

## Zakres do rozstrzygnięcia W CZACIE, nie tutaj

Poniższa tabela to **propozycja**, nie zlecenie. Pierwsze zadanie tamtego czatu
to przejść ją z właścicielem i wyciąć to, czego nie użyje.

| Wiersz | Kandydaci na menu |
|---|---|
| Lead | Zadzwoń · WhatsApp · Mail · Zaloguj rozmowę · Zmień status · Skopiuj telefon |
| Klient | jak lead + Przejdź do projektów klienta |
| Mail | Obsłużone · Archiwizuj · Odłóż · Odpowiedz · Zrób leada · Wycisz wątek |
| Projekt | Start/Stop stopera · Zmień status · Zdrowie · Otwórz klienta |
| Faktura | Oznacz opłaconą · Wyślij przypomnienie · Link dla klienta |
| Koszt | Oznacz opłacony · Podgląd załącznika · Kod QR przelewu |
| Notatka | Przypnij · Przekuj w projekt · Do kalendarza · Archiwizuj |
| Wydarzenie | Edytuj · Usuń · Otwórz powiązany rekord |
| Wiersz Pulpitu | akcja właściwa dla tej kolejki (np. „Załatwione bez maila") |

## Reguła, bez której to wyjdzie gorsze niż brak funkcji

**Gest w bok i przytrzymanie muszą się DZIELIĆ robotą, a nie dublować.**

- **w bok** = jedna, najczęstsza akcja, wykonywana bez patrzenia,
- **przytrzymanie** = komplet, w tym rzeczy, które dziś nie mają innego wejścia
  niż wnętrze rekordu.

Jeśli menu powtórzy to, co już jest w geście, dołoży ruchu i nic nie da.

Drugi warunek: **wszędzie tak samo**. Funkcja, która działa na Leadach, a nie
działa na Klientach, uczy, że nie warto próbować — a wtedy nikt jej nie używa
także tam, gdzie jest. To jest główny argument za tym, żeby robić to jako
jedną paczkę, a nie doklejać ekran po ekranie.

## Rzeczy, które trzeba sprawdzić, zanim się napisze pierwszą linię

1. **`.contextMenu` na wierszu `List` z `NavigationLink`** — czy przytrzymanie
   nie zaczyna kolidować z przejściem dalej. W SwiftUI to bywa kapryśne, gdy
   wiersz ma i `NavigationLink`, i `contextMenu`, i `swipeActions` naraz.
2. **Podgląd (`preview:`)** — `contextMenu` na iOS 16+ umie pokazać miniaturę
   rekordu nad menu. Do rozstrzygnięcia: czy warto, czy to zbędna praca. Dla
   maila podgląd treści byłby realnie użyteczny; dla leada raczej nie.
3. **Kolor w menu.** Pozycje kasujące idą przez `role: .destructive` — i tu
   akurat jest to POPRAWNE (w menu systemowym to konwencja Apple, inaczej niż
   przy przyciskach na liście, patrz N5 w `17-wynik-audytu-koncowego.md`).
   Ikony: SF Symbols, spójne z tym, co widać w pasku akcji tego samego rekordu.
4. **Haptyka** — iOS daje ją sam przy otwarciu menu. Nie dokładać własnej.
5. **Czy akcja ma potwierdzenie.** „Usuń" z menu musi pytać dokładnie tak samo,
   jak „Usuń" z gestu — dziś to `confirmationDialog` w każdym module.

## Czego NIE robić

- **Nie ruszać „poziomu 3"** (faktury: wystawianie i edycja pozycji, korekty,
  KSeF, akceptacja ofert, umowy). Menu może pokazać wyłącznie te akcje, które
  apka już umie wykonać.
- **Nie dokładać akcji, których nie ma w `APIClient`.** Powtarzalny błąd tego
  projektu: menu wygląda kompletnie, a jedna pozycja nic nie robi. Każda
  pozycja musi mieć wołającego po drugiej stronie — sprawdzić gretem, nie na
  pamięć.
- **Nie zastępować gestów w bok.** Zostają; menu je uzupełnia.

## Jak weryfikować

Menu kontekstowego **nie da się otworzyć bez dotyku** — ani w symulatorze
przez `simctl`, ani przez lustro QuickTime (ono tylko pokazuje ekran).
Możliwości są dwie i obie trzeba założyć z góry:

- **myszą w oknie symulatora** przez computer-use — przytrzymanie lewego
  przycisku ~1 s otwiera menu; sprawdzone w tej sesji, że kliknięcia
  w symulatorze działają,
- **na telefonie**: build wgrywa się kablem, a apkę da się uruchomić na
  wybranym ekranie zdalnie — `devicectl` przyjmuje furtki `LEGGERA_DEV_*`
  przez prefiks **`DEVICECTL_CHILD_`** (odkryte 2026-07-21, dopisane do README).
  Ale samo przytrzymanie musi zrobić właściciel palcem.

## Stan wyjściowy

- Wersja apki w chwili spisania briefu: **48** (`a0a6721`), wgrana na iPhone'a.
- Numerowane wydania działają — ekran „Ustawienia → O aplikacji" pokazuje numer,
  datę i rewizję, więc da się jednoznacznie powiedzieć, co jest na telefonie.
