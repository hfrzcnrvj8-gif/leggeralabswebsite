# Prompt do nowego czatu — Moduł 41 (drugi składnik logowania, TOTP)

> Skopiuj wszystko poniżej linii i wklej jako pierwszą wiadomość w **nowym
> czacie Claude Code** w tym repo. Nic więcej nie trzeba dopisywać.
>
> (Ten plik jest tylko „schowkiem" na prompt — sam brief żyje w
> `41-drugi-skladnik-totp.md`.)

---

Zrób moduł opisany w `docs/plany-modulow/41-drugi-skladnik-totp.md`. Najpierw
przeczytaj ten plik, `CLAUDE.md` i `docs/AUDYT-1-WYNIKI.md` (ustalenia 1 i 9 —
hamulec logowania i to, że zmiana hasła nie odbiera dostępu telefonowi), potem
zaproponuj plan, dopiero potem działaj.

To domknięcie Audytu 1: hamulec prób zamknął zgadywanie hasła, ale nie zamyka
jego wycieku. Właściciel poprosił wprost o 2FA (kod z aplikacji) 2026-07-22.

Uwagi, które oszczędzą Ci czasu:

* **`CLAUDE.md` mówi, że panel ma „jedno hasło" jako świadome ograniczenie
  zakresu — ten moduł to znosi.** Zaktualizuj tamten zapis, zamiast się na
  niego powoływać.
* **Drogi powrotu są przesądzone — właściciel wybrał je 2026-07-22** (patrz
  rozdział „Drogi powrotu" w briefie). Mają powstać **obie**, nie jedna:
  (1) papierowe kody zapasowe — ekran musi dać się wydrukować i skopiować,
  z wyraźnym ostrzeżeniem, że później nie będą już nigdzie widoczne;
  (2) ten sam sekret TOTP na **dwóch** urządzeniach — kod QR nie może znikać
  po pierwszym zeskanowaniu, a obok niego pokaż sekret tekstem (menedżer haseł
  na Macu nie zawsze zeskanuje kod z ekranu tego samego komputera).
  Nie wracaj do tej dyskusji i nie proponuj drugiego konta administratora —
  zostało świadomie odrzucone jako osobny, większy moduł.
* **Nie opieraj bezpieczeństwa na „wyłączniku w Vercelu".** Zostaje w zakresie
  (`TOTP_DISABLED=1`, jedna linia), ale **nie jest** główną drogą powrotu:
  prowadzi przez łańcuch Vercel → GitHub → Apple → skrzynka, który wg
  ustalenia 12 Audytu 1 **był zerwany przez pół roku bez żadnego objawu**.
  Zmiana `ADMIN_PASSWORD` też nie wyłącza TOTP — to nigdy nie jest wyjście.
* **Wymuś potwierdzenie kodem, ZANIM zapiszesz sekret jako aktywny.** Literówka
  przy przepisywaniu sekretu daje dokładnie ten sam skutek co punkt wyżej.
* **Zużyty kod trzeba zapamiętać** (ok. 90 s), inaczej podsłuchany kod da się
  użyć drugi raz w tym samym oknie. Tolerancja ±1 okno, nie więcej.
  Porównanie przez `timingSafeEqual`, wzorem `safeEqual` z `lib/auth.ts`.
* **Drugi krok wepnij w istniejący hamulec** (`lib/rateLimit.ts`, osobna akcja)
  — sześciocyfrowy kod ma tylko milion kombinacji. Progi żyją w tamtym module,
  nie w trasie.
* **Apka na iPhone to osobne repozytorium** (`/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`).
  `POST /api/admin/login` musi zwrócić rozróżnialny błąd „wymagany kod", żeby
  apka wiedziała, że ma o niego zapytać. Drugi składnik dotyczy **wydania**
  tokenu urządzenia, nie każdego żądania — raz wydany token działa dalej.
  Dokładając pole do modelu Swift z ręcznym `init(from decoder:)`, dopisz je
  w **trzech** miejscach (właściwość, `CodingKeys`, `init`): opcjonalny `var`
  bez przypisania kompiluje się bez ostrzeżenia i jest zawsze `nil` — ta
  pułapka zjadła jedną rundę w Module 40.
* **Bramka migracji obowiązuje** — nowa tabela = `schemaUpToDate()` /
  `markSchemaApplied()`. Zapytanie nie-DDL wewnątrz migracji owijaj
  w `inMigration()`.
* `useUI()` → `confirm()`/`toast()`, nigdy `window.confirm`. Daty przez
  `formatPlDate()`. Ikony `@tabler/icons-react` (mapy w
  `app/[lang]/admin/icons.tsx`). Animacje wyłącznie ze stałych w
  `lib/motion.ts` (`SPRING` / `EASE_LIQUID`), nigdy z palca.
* Zanim zgłosisz coś jako lukę, sprawdź `CLAUDE.md` → „Świadome decyzje
  produktowe".

Weryfikacja — `tsc` tu nic nie udowodni. Wymagane minimum:

1. Włącz 2FA od zera: kod QR → zeskanowanie → **odmowa zapisu przy błędnym
   kodzie** → zapis przy poprawnym.
2. Wyloguj się i zaloguj ponownie: hasło **bez** kodu nie wpuszcza, hasło
   z kodem wpuszcza, kod użyty drugi raz w tym samym oknie **nie** wpuszcza.
3. Zużyj jeden kod zapasowy — wpuszcza raz, drugi raz już nie.
4. **Sprawdź obie drogi powrotu, bo to one decydują, czy właściciel nie
   zostanie zamknięty przed własną firmą:** kody zapasowe dają się
   wydrukować/skopiować, a ten sam sekret zeskanowany dwa razy generuje
   po obu stronach **ten sam** kod w tej samej chwili.
5. Sprawdź wyłącznik awaryjny (`TOTP_DISABLED`) — trzecia droga, też ma
   działać, a nie tylko być napisana.
6. Hamulec: kilka błędnych kodów pod rząd blokuje próby.
7. `npx tsc --noEmit -p tsconfig.json` po każdej paczce (pełny `next build`
   failuje w sandboxie z EPERM).

Serwer dev: `npm run dev`, logowanie pominięte (`DEV_ADMIN_BYPASS` w
`.env.local`), dane z PGlite (`lib/dev-db.ts`) — produkcyjna baza jest poza
zasięgiem. **Uwaga:** dev-login omija całe logowanie, więc drugiego składnika
nie sprawdzisz „przez wejście do panelu" — potrzebujesz osobnej ścieżki
weryfikacji (np. wywołania trasy logowania wprost, z tymczasowo wyłączonym
bypassem). Zaplanuj to od razu, nie na końcu. Jeśli inny czat trzyma serwer,
nie zabijaj go — otwórz `preview_start url:"http://localhost:3000/pl/admin"`,
to ten sam kod. Panel `/admin` jest jednomotywowy — ciemny.

Nie jestem programistą i nie czytam kodu — jeśli coś wymaga mojej decyzji,
zapytaj wprost, po polsku, bez żargonu. Na koniec zaktualizuj `HUB_SETUP.md`,
dopisz wynik w `docs/AUDYT-1-WYNIKI.md`, popraw zapis o „jednym haśle"
w `CLAUDE.md`, odhacz w `docs/plany-modulow/README.md` i podaj mi komendę
do commita.
