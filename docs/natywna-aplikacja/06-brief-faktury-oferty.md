# Brief: Faktury i Oferty w apce (Faza 10)

> Brief wdrożeniowy pod **jeden osobny czat**. Zaczynasz od `00-plan.md`.
> Repo apki: `/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`.

Wybrane przez właściciela 2026-07-20, po Fazie 8. Faza 9 (iPad) **przeskoczona
świadomie** — nie cofaj tej zmiany bez pytania.

## To jest POZIOM 2, i to jest sedno briefu

Plan (`00-plan.md`) dzieli funkcje na trzy poziomy. Faktury i Oferty są na
**poziomie 2 — „podgląd i lekkie akcje"**, a wystawianie faktur i KSeF stoją
wprost na **poziomie 3 — „świadomie tylko desktop"**.

**Największe ryzyko tego modułu to przepisanie edytora faktur na telefon.**
Pozycje, stawki VAT, korekty, waluty, KSeF — to praca przy biurku i wciskanie
jej w telefon było błędem Modułu 5 (PWA), tego samego, przez który porzuciliśmy
PWA. Jeśli w trakcie pojawi się pokusa „skoro już mamy listę, to dodajmy
dodawanie pozycji" — **zapytaj właściciela wprost**, zamiast dokładać.

## Zakres

### Faktury
- Lista z filtrem: nieopłacone / po terminie / wszystkie. Sortowanie
  „po terminie na górę", jak w Projektach.
- Podgląd faktury: numer, klient, kwoty, termin, status, pozycje **tylko do
  odczytu**.
- **„Oznacz jako opłaconą"** — najczęstsza akcja mobilna, warta całego modułu.
- **Przypomnienie o płatności** — wysyłka istniejącym mechanizmem panelu.
- PDF: podgląd przez QuickLook (wzorzec gotowy — `ZalacznikiSekcja.swift`
  z Fazy 8 robi dokładnie to samo dla załączników).

### Oferty
- Lista + podgląd, status (wysłana / obejrzana / zaakceptowana).
- **Wysyłka istniejącej oferty do klienta.**
- Podgląd PDF jak wyżej.

## Na czym łatwo się przewrócić

1. **Proforma nie jest dokumentem fiskalnym** i nie liczy się do KPI — panel
   już to wie (`lib/invoices.ts`, `typ_dokumentu !== 'proforma'`). Apka musi
   powtórzyć tę regułę, nie wymyślić własną.
2. **Kwoty to nie `Double`.** Grosze w liczbie zmiennoprzecinkowej dają
   „1234,99999". Sprawdź, czym operuje panel, i przenieś dokładnie to.
3. **Statusy faktur i ofert są osobnymi osiami** — jak status i „zdrowie"
   w Projektach (Faza 5). Nie łącz ich w jeden przełącznik.
4. **KSeF nie istnieje w apce.** Faktura wysłana do KSeF ma swój stan po
   stronie panelu; apka ma go POKAZYWAĆ, nigdy nie próbować zmieniać.
5. **Sprawdź, czy coś WOŁA kod, a nie czy kod istnieje.** Ten projekt ma na
   koncie cztery przypadki „pole jest, funkcja jest, nikt jej nie woła"
   (Moduł 30, 31, WhatsApp, `list_unsubscribe_url`).

## Zacznij od inwentarza, nie od kodu

`docs/natywna-aplikacja/inwentarz/` opisuje trasy API modułów. Faktury mają
ich 16, oferty 10 — to najwięcej po projektach. **Przeczytaj, zanim zaczniesz
pisać**, i wypisz, których apka NIE będzie wołać (poziom 3). Ta lista jest
częścią wyniku, nie notatką roboczą.

## Jak pracować

- Panel: `npx tsc --noEmit -p tsconfig.json` po każdej paczce.
- Apka: `xcodegen generate` → `xcodebuild` → `simctl` → zrzut.
- **Nie kończ na zielonym buildzie.** Cztery ostatnie realne błędy tego
  projektu (kasowanie przypomnień wyścigiem, pusta półka stopera, martwe
  `.sheet` w Fazie 8, ucięte nazwy w Subskrypcjach) wyglądały poprawnie
  w kodzie i wyszły dopiero na zrzucie.
- Przy sporach o wygląd **proś o wzorzec** — jeden zrzut z Apple Mail
  rozstrzygnął kiedyś to, czego trzy rundy opisu nie.

## Prompt otwierający kolejny czat

```
Kontynuujemy aplikację natywną Leggera Hub. Przeczytaj
docs/natywna-aplikacja/00-plan.md oraz
docs/natywna-aplikacja/06-brief-faktury-oferty.md, potem zrób Fazę 10:
faktury i oferty w apce (podgląd + „opłacona" + przypomnienie + wysyłka
oferty). Wystawianie faktur i KSeF zostają na desktopie — to poziom 3.
Repo apki: /Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios.
```
