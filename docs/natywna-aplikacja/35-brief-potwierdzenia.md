# Brief: apka uczy się potwierdzać działania nieodwracalne

**Powstał:** 2026-08-02, przy Fazie 4 planu zaplecza (`docs/PLAN-ZAPLECZE.md`).
**Stan:** do zrobienia w osobnej sesji nad apką.
**Pilność:** wysoka — do czasu wykonania część działań **nie działa
z telefonu**. To jest świadomy koszt decyzji właściciela, nie przeoczenie.

## Co się stało po stronie panelu

Panel dostał jawną listę działań nieodwracalnych (`lib/nieodwracalne.ts`)
i regułę: **co nieodwracalne — pyta, co odwracalne — nie pyta.** Kluczowe jest
to, **gdzie** ta bariera mieszka: w **TRASIE**, nie w przycisku. Trasa odmawia
wykonania działania, dopóki żądanie nie niesie jawnego potwierdzenia.

Właściciel wybrał wariant **„szczelnie od razu"**: trasa traktuje panel i apkę
tak samo, bez furtki. Bariera z dziurą na jedną drogę to dokładnie ten błąd,
który naprawiała Faza 2 (bramka wysyłki działała tylko tam, gdzie ktoś
zajrzał).

## Co to znaczy dla apki DZIŚ

Te akcje wykonane z telefonu wracają z **HTTP 428** i nie robią nic:

| ekran w apce | trasa | id działania |
|---|---|---|
| Faktura → „Wystaw" | `POST /api/invoices/:id/issue` | `faktura-wystaw` |
| Faktura → KSeF | `POST /api/invoices/:id/ksef/send` | `ksef-wyslij` |
| Faktura → „Wyślij" | `POST /api/invoices/:id/send` | `faktura-wyslij` |
| Faktura → przypomnienie / wezwanie | `POST /api/invoices/:id/remind` | `faktura-przypomnij` albo `wezwanie-wyslij` (zależnie od poziomu — **rozstrzyga serwer**) |
| Oferta → „Wyślij" / przypomnienie | `POST /api/offers/:id/send`, `/remind` | `oferta-wyslij`, `oferta-przypomnij` |
| Umowa → „Wyślij" / przypomnienie | `POST /api/contracts/:id/send`, `/remind` | `umowa-wyslij`, `umowa-przypomnij` |
| Projekt → prośba o opinię | `POST /api/projects/:id/request-review` | `opinia-popros` |
| Kontakt kontrolny → wyślij | `POST /api/client-followups/:id/send` | `kontakt-kontrolny-wyslij` |
| Link publiczny → unieważnij / nowy | `POST /api/share-links/:kind/:id` | `link-uniewaznij`, `link-wygeneruj-nowy` |
| Usunięcie leada / klienta / projektu / faktury / oferty / umowy / notatki / kosztu | `DELETE /api/<moduł>/:id` | `lead-usun`, `klient-usun`, `projekt-usun`, `faktura-usun`, `oferta-usun`, `umowa-usun`, `notatka-usun`, `koszt-usun` |

Komunikat w polu `error` jest napisany po ludzku i **nadaje się do pokazania
wprost**, więc apka bez żadnej zmiany nie kłamie — mówi, że działanie wymaga
potwierdzenia. Ale go nie wykona.

## Kontrakt — co trzeba wysłać

Dwa nagłówki:

- `x-potwierdzenie: <id-działania>` — zgoda na KONKRETNE działanie. Zgoda na
  jedno nie przepuszcza innego (sprawdzane sondą przejścia).
- `x-potwierdzenie-fraza: <encodeURIComponent(przepisane)>` — tylko przy
  poziomie „mocne". **Kodowanie jest obowiązkowe**: nagłówki HTTP niosą
  latin-1, a przepisuje się nazwy w rodzaju „Wdrożenie w Łodzi".
  W Swifcie: `addingPercentEncoding(withAllowedCharacters: .alphanumerics)`
  — **nie** `.urlQueryAllowed`, bo ten przepuszcza znaki, których nagłówek nie
  uniesie. Serwer robi `decodeURIComponent`.

Nagłówek, nie ciało — bo połowa listy to `DELETE`.

## Kształt odpowiedzi 428

```json
{
  "error": "Wystawić fakturę? Faktura dostanie trwały numer… Potwierdź to działanie, żeby je wykonać.",
  "potwierdzenie": {
    "powod": "brak-potwierdzenia",
    "dzialanie": "faktura-wystaw",
    "poziom": "mocne",
    "tytul": "Wystawić fakturę?",
    "skutek": "Faktura dostanie trwały numer w serii i od tej chwili nie da się jej edytować…",
    "przycisk": "Wystaw fakturę",
    "coPrzepisac": "nazwę nabywcy"
  }
}
```

## Jak to zrobić dobrze (i czego nie robić)

1. **Nie przepisuj listy działań do Swifta.** Cała treść okna — tytuł, skutek,
   napis na przycisku, czy trzeba coś przepisać — przychodzi w odpowiedzi 428.
   Panel robi dokładnie tak i to jest sens tej architektury: lista żyje
   w JEDNYM miejscu, więc nie może się rozjechać. Apka ma się dowiedzieć
   o barierze od serwera, nie wiedzieć jej z góry.
2. **Wzór do przepisania — jeden `APIClient`, nie 20 ekranów.** W panelu to
   `wykonajZadanie()` z `app/[lang]/admin/Potwierdzenie.tsx`: wyślij normalnie
   → jeśli 428 z opisem, pokaż arkusz → powtórz z nagłówkami. Osiemnaście
   przycisków „Usuń" nie zna tego protokołu. W apce to samo powinno siedzieć
   w `APIClient`, inaczej dwudziesty ekran zapomni (to ta sama lekcja co A1 —
   „16 z 20 ekranów kłamie pustym stanem").
3. **Frazy do przepisania serwer NIE odsyła** — tylko etykietę. Wartość
   pokazuje apka, z rekordu, który i tak ma na ekranie; **porównuje serwer**.
   Nie próbuj wyciągać jej z odpowiedzi.
4. **Nie dokładaj `confirm`-a przed żądaniem.** Byłyby dwa pytania pod rząd
   o to samo — najkrótsza droga do klikania „tak" bez czytania.
5. **Porównanie frazy po stronie apki tylko jako wygoda** (odblokowanie
   przycisku). Reguła: `NFC` → zbij białe znaki → `lowercased`; polskich
   znaków NIE ignorujemy. Ostatnie słowo ma serwer.
6. **`GET /api/invoices/:id/ksef/send?send=1`** ma osobny nośnik potwierdzenia
   (parametry `potwierdzam` i `fraza`), bo klikając adres w przeglądarce nie
   da się dopisać nagłówków. Apka używa `POST` — jej to nie dotyczy.

## Jak sprawdzić, że działa

Nie na symulatorze i nie „na oko": apka rozmawia z **produkcją** (pamięć:
„DEBUG apki = PRODUKCJA"), więc test kasujący rekord jest testem na żywych
danych. Zrób to na rekordzie założonym do tego celu i skasuj go tą samą drogą.
Dowodem jest to, że **przed** poprawką akcja wraca z 428 i nie robi nic,
a **po** poprawce arkusz się pokazuje i akcja przechodzi.
