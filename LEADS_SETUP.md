# Rejestr leadów — wdrożenie

Co to jest: prosty, zabezpieczony hasłem panel pod `/admin/leads` (np.
`https://leggeralabs.pl/pl/admin/leads`), z bazą danych Postgres. Formularz
kontaktowy na stronie głównej automatycznie tworzy tam nowy wpis ze statusem
"Nowe zgłoszenie ze strony" przy każdym zgłoszeniu — obok tego możesz ręcznie
dodawać i śledzić leady, do których sam docierasz (Wilanów, Przysucha itd.).
Tabela leadów tworzy się sama przy pierwszym użyciu API — nie trzeba ręcznie
odpalać żadnego SQL-a.

## 1. Baza danych (Vercel Marketplace → Neon)

Vercel wycofał swój natywny produkt Postgres — bazy danych konfiguruje się dziś przez **Marketplace** (Neon, Supabase i inni). W Twoim panelu Storage widzisz tylko Edge Config i Blob, bo tam Postgresa już nie ma — trzeba go dodać jako integrację:

1. Wejdź na [vercel.com/marketplace?category=storage](https://vercel.com/marketplace?category=storage) (albo: projekt **leggeralabswebsite** → **Storage** → **Browse Marketplace**/**Connect Database**).
2. Wybierz **Neon** (darmowy plan wystarczy na start — to zresztą ten sam dostawca, na którym stał dawny Vercel Postgres).
3. Kliknij **Install/Add**, wybierz plan (Free), skonfiguruj (nazwa, region — najbliższy Twojemu projektowi, np. Frankfurt).
4. Połącz bazę z projektem **leggeralabswebsite** dla środowisk *Production*, *Preview* i *Development*. Neon doda automatycznie zmienną `DATABASE_URL` (i pokrewne) do projektu.

Alternatywnie z terminala: `vercel install neon` w folderze projektu — zrobi to samo jedną komendą.

## 2. Zmienne środowiskowe

W **Settings → Environment Variables** projektu na Vercel dodaj (dla Production, a najlepiej też Preview):

- `ADMIN_PASSWORD` — hasło, którym będziesz logować się do `/admin/leads`. Wybierz coś, czego nie używasz nigdzie indziej.
- `ADMIN_SESSION_SECRET` — losowy ciąg znaków do podpisywania sesji logowania. Wygeneruj lokalnie: `openssl rand -hex 32`.

`DATABASE_URL` jest już ustawiony automatycznie z kroku 1.

Przycisk **„Znajdź nowe leady”** nie wymaga żadnego klucza API ani konfiguracji płatności — korzysta z darmowych danych OpenStreetMap (Nominatim do geokodowania lokalizacji + Overpass API do wyszukania firm). Działa od razu po wdrożeniu. To nie jest funkcja oparta o żaden model AI (ani Anthropic, ani lokalną Ollamę) — bezpośrednie zapytanie do otwartej bazy danych.

Ograniczenie: obsługiwane są tylko branże z góry zmapowane na tagi OpenStreetMap (lista w `app/api/leads/discover/route.ts`, `BRANZA_TAGS`) — dokładnie te sześć, które są dostępne w rozwijanej liście w panelu. Kompletność danych bywa różna (baza jest tworzona społecznie) — czasem zabraknie telefonu czy strony www, ale nazwa i adres z reguły się znajdą.

Dzienny raport mailowy (patrz sekcja niżej) wymaga osobnej, opcjonalnej konfiguracji:

- `RESEND_API_KEY` — klucz z [resend.com](https://resend.com) (darmowy plan wystarcza). Bez niego panel działa normalnie, po prostu przycisk „Wyślij raport teraz” i codzienny cron zwrócą błąd zamiast wysłać maila.
- `RESEND_FROM` — opcjonalny, adres nadawcy po zweryfikowaniu domeny leggeralabs.pl w Resend, np. `Leggera Labs <leady@leggeralabs.pl>`. Bez tego maile idą z testowej domeny Resend i mogą trafiać do spamu.
- `CRON_SECRET` — opcjonalny, dowolny losowy ciąg; jeśli ustawiony, chroni `/api/leads/notify` przed wywołaniem z zewnątrz (Vercel Cron dołącza go automatycznie do własnych wywołań).

## 3. Lokalny rozwój (opcjonalnie)

```bash
npm install                 # doinstaluje @neondatabase/serverless
vercel env pull .env.local  # ściągnie DATABASE_URL i inne zmienne z Vercela
```

Dopisz do `.env.local` ręcznie `ADMIN_PASSWORD` i `ADMIN_SESSION_SECRET`, jeśli `vercel env pull` ich nie ściągnie (zależy, czy są ustawione też dla środowiska Development).

```bash
npm run dev
```

Wejdź na `http://localhost:3000/pl/admin/leads`, zaloguj się hasłem z `ADMIN_PASSWORD`.

## 4. Wdrożenie

Standardowo — commit + push do `main` (Vercel wdroży automatycznie), albo `vercel --prod` z terminala.

## 5. Pierwsze uruchomienie

1. Wejdź na `https://leggeralabs.pl/pl/admin/leads`, zaloguj się.
2. Kliknij **„Wczytaj listę startową”** — doda ok. 28 firm z Wilanowa i Przysuchy/Radomia, które już wcześniej znaleźliśmy (kancelarie prawne, biura rachunkowe, notariusze, kliniki stomatologiczne).
3. Wypełnij testowo formularz kontaktowy na stronie głównej — sprawdź, czy w rejestrze pojawia się nowy wpis ze statusem **„Nowe zgłoszenie ze strony”**.

## Widoki: tablica (kanban) i tabela

Domyślny widok to tablica w stylu Trello — kolumna na każdy status, karty przeciągasz między kolumnami myszką, żeby zmienić etap (albo klikasz kolorowy tag statusu na karcie/w wierszu — bez przeciągania). Przycisk „Tabela” przełącza na widok tabelaryczny z osobnymi kolumnami telefon/email/WWW, wygodniejszy do szybkiej edycji wielu pól naraz — wybór widoku zapamiętuje się w przeglądarce. Klik na nazwę firmy (lub ikonkę ↗) otwiera szczegóły w wysuwanym panelu z boku, bez opuszczania listy — Ctrl/Cmd/Shift+klik otwiera normalnie w nowej karcie.

## Automatyczne wyszukiwanie leadów

Przycisk **„Znajdź nowe leady”** odpytuje OpenStreetMap o wybraną branżę i lokalizację i zwraca dane, jakie są dostępne — nazwę, czasem telefon/stronę www, adres. Wyniki są automatycznie porównywane z tym, co już masz w rejestrze (po nazwie firmy), więc duplikaty są pomijane. Nowe firmy trafiają ze statusem „Do kontaktu”. Nie wymaga żadnej konfiguracji — działa od razu.

## Skróty klawiszowe i paleta poleceń

- `Cmd/Ctrl + K` — paleta poleceń: szybkie akcje (dodaj leada, zmień widok, znajdź leady, wyślij raport, wyloguj) i wyszukiwanie leada po nazwie z klawiatury.
- `/` — fokus na wyszukiwarkę.
- `n` — dodaj nowego leada.
- `j` / `k` — w widoku tabeli: przesuwa zaznaczenie w dół/górę, `Enter` otwiera zaznaczonego leada.
- `Esc` — zamyka wysuwany panel szczegółów / paletę poleceń.

## Dzienny raport mailowy

Raz dziennie (domyślnie 6:00 UTC, konfigurowalne w `vercel.json` → `crons[0].schedule`) Vercel Cron odpytuje `/api/leads/notify`, które wysyła na **kontakt@leggeralabs.pl** mail z listą leadów wymagających dziś działania (te same, co w banerze „Wymaga działania dziś” w panelu) oraz podsumowaniem liczby leadów wg statusu. Ten sam raport możesz wysłać ręcznie w dowolnej chwili przyciskiem **„Wyślij raport teraz”** w toolbarze (albo z palety poleceń).

Wymaga skonfigurowania `RESEND_API_KEY` (patrz sekcja o zmiennych środowiskowych wyżej) — bez tego przycisk pokaże błąd zamiast wysłać maila, reszta panelu działa normalnie.

## Jak to działa na co dzień

- Każde zgłoszenie z formularza na stronie ląduje automatycznie jako nowy lead ze statusem „Nowe zgłoszenie ze strony” — sekcja „Wymaga działania dziś” pokaże je od razu, dopóki nie zmienisz statusu.
- Leady, do których docierasz sam (mail/telefon), dodajesz ręcznie przyciskiem „+ Dodaj lead”, zmieniasz status na „Napisano - czeka na odpowiedź” i ustawiasz datę ostatniego kontaktu.
- Jeśli minęły 4+ dni bez zmiany statusu, taki lead sam trafia do sekcji „Wymaga działania dziś”.
- Wszystko trzyma się w jednej bazie danych, dostępnej z każdego urządzenia po zalogowaniu — nie tylko w jednej przeglądarce.

## Uwaga o bezpieczeństwie

Endpoint `POST /api/leads` jest celowo publiczny (bez logowania), żeby formularz na stronie mógł go wywołać bezpośrednio z przeglądarki. Zapisuje tylko te same dane, które i tak trafiają już do Ciebie przez Formspree (imię, e-mail, firma, wiadomość) — nic bardziej wrażliwego. Odczyt, edycja i usuwanie leadów (`GET`, `PATCH`, `DELETE`) wymagają zalogowania.
