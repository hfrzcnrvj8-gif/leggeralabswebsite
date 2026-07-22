# Moduł 41 — drugi składnik logowania (TOTP)

> Powstał z **Audytu 1** (`docs/AUDYT-1-WYNIKI.md`), decyzja właściciela
> z 2026-07-22: *„Chcę 2FA (kod z aplikacji, TOTP)"*. Jeden czat.

## Dlaczego

Panel ma **jedno hasło i żadnego drugiego składnika**, a odblokowuje wszystkie
dane wszystkich klientów. Audyt 1 dołożył hamulec prób (5/15 min), co zamyka
zgadywanie — **nie zamyka wycieku**. Hasło wpisane na podrobionej stronie,
przechwycone z menedżera haseł albo powtórzone z innego serwisu daje pełny
dostęp natychmiast. Drugi składnik jest jedyną rzeczą, która to przerywa.

`CLAUDE.md` opisuje „jedno hasło" jako świadome ograniczenie zakresu — **ten
brief je znosi**, na wyraźną prośbę właściciela. Zaktualizuj tamten zapis.

## Zakres

1. **Sekret TOTP** — 20 bajtów z `randomBytes`, base32, w nowej tabeli
   (jeden wiersz — panel jest jednoosobowy). Bramka migracji obowiązuje.
2. **Włączenie** — w Ustawieniach: kod QR (`otpauth://totp/…`) do zeskanowania
   w Google Authenticator/1Password + **wymuszone potwierdzenie jednym
   poprawnym kodem**, zanim sekret zostanie zapisany jako aktywny. Bez tego
   kroku literówka przy przepisywaniu zamyka właściciela przed jego panelem.
3. **Logowanie** — po poprawnym haśle drugi krok: 6 cyfr. Tolerancja ±1 okno
   (30 s) na rozjazd zegara, **nie więcej**. Weryfikacja `timingSafeEqual`.
   Zużyty kod zapamiętać na 90 s (inaczej podsłuchany kod da się użyć
   ponownie w tym samym oknie).
4. **Kody zapasowe** — 8 jednorazowych, pokazane RAZ przy włączaniu, w bazie
   tylko SHA-256 (wzorem `device_tokens`). Bez nich zgubiony telefon =
   utrata dostępu do własnej firmy, a nie ma nikogo, kto by konto odblokował.
   **Ekran musi je dać się wydrukować i skopiować** — właściciel wybrał papier
   jako główną drogę powrotu (decyzja 2026-07-22, patrz „Drogi powrotu" niżej),
   więc „przepisz z ekranu ręcznie" to za mało. Dodaj wyraźne ostrzeżenie, że
   po zamknięciu tego ekranu kody **nie będą już nigdzie widoczne**.
5. **Ten sam sekret na DWÓCH urządzeniach** — druga wybrana droga powrotu.
   Ekran włączania ma to mówić wprost („zeskanuj ten kod telefonem **oraz**
   menedżerem haseł na Macu") i **nie chować kodu QR po pierwszym skanowaniu**:
   TOTP nie wie, ile aplikacji odczytało sekret, więc dwa urządzenia generują
   po prostu te same kody. Obok QR pokaż sekret w postaci tekstowej — nie każdy
   menedżer haseł na Macu umie zeskanować kod z ekranu tego samego komputera.
6. **Aplikacja iOS** — `POST /api/admin/login` musi przyjąć `{ password, kod }`
   i zwrócić czytelny błąd „wymagany kod", żeby apka wiedziała, że ma o niego
   zapytać. Raz wydany token urządzenia działa dalej — drugi składnik dotyczy
   **wydania** tokenu, nie każdego żądania.
7. **Hamulec** — kod TOTP ma tylko milion kombinacji; wpiąć drugi krok w ten
   sam `lib/rateLimit.ts` (osobna akcja, np. `login-totp`, ten sam próg).

## Świadome wykluczenia

- **Bez SMS-a i bez maila jako drugiego składnika** — SMS jest podatny na
  przejęcie numeru, a mail chodzi przez tę samą skrzynkę, którą panel
  obsługuje (przejęcie skrzynki dawałoby oba składniki naraz).
- **Bez kluczy sprzętowych/passkeys** w tym module — większy zakres,
  osobna rozmowa.
- **Bez „zapamiętaj to urządzenie na 30 dni"** — panel już ma trwałe tokeny
  urządzeń, to byłby drugi mechanizm robiący to samo.

## Drogi powrotu — decyzja właściciela (2026-07-22)

Właściciel zapytał: *„piszesz, że nie ma administratora — a co gdybym ja nim
został?"*. Odpowiedź, która ukształtowała ten rozdział: **on już nim jest**.
„Nie ma administratora" nie znaczy „wakat do obsadzenia", tylko **„nie ma
drugiej strony"**. Odzyskiwanie konta działa w innych systemach dlatego, że
ktoś *inny* potwierdza tożsamość. W panelu jednoosobowym osoba zamknięta na
zewnątrz i osoba, która mogłaby otworzyć, to ta sama osoba — mianowanie się
administratorem dokłada etykietę, nie drogę. Liczy się **niezależność
składnika**, nie jego nazwa.

Wybrane drogi (obie mają powstać, nie „jedna albo druga"):

1. **Papierowe kody zapasowe** — jedyna droga niezależna od prądu, sieci,
   Apple i Vercela.
2. **Ten sam sekret TOTP na dwóch urządzeniach** (telefon + menedżer haseł na
   Macu) — utrata jednego urządzenia przestaje być zdarzeniem krytycznym.

**Odrzucone świadomie:** drugie konto administratora z rolami — to osobny,
duży moduł (dotyka wszystkich 195 powtórzeń `isAuthed()`) i ma sens dopiero,
gdy z panelu ma korzystać ktoś poza właścicielem.

## Pułapka: „wyłącznik w Vercelu" to łańcuch, nie kotwica

Pierwsza wersja tego briefu proponowała `TOTP_DISABLED=1` w panelu Vercela
jako klucz ostatniej instancji, z uzasadnieniem „właściciel ma dostęp do
Vercela zawsze". **To uzasadnienie jest fałszywe** i ustalenie 12 Audytu 1
pokazuje dlaczego:

> Vercel → logowanie przez **GitHuba** → GitHub bez hasła i bez 2FA, tylko
> „Zaloguj przez Apple" → Apple przekazuje pocztę na `kontakt@leggeralabs.pl`.

Ten łańcuch **był zerwany przez pół roku** (martwa domena docelowa) i nie
dawał żadnego objawu; naprawiono go 2026-07-22. Cztery ogniwa, żadne
niezależne od pozostałych.

Wyłącznik **zostaje w zakresie** — kosztuje jedną linię, a jest jedynym
wejściem, gdy papier i oba urządzenia przepadną naraz. Ale **nie wolno go
opisywać jako głównej drogi powrotu** ani nią uzasadniać rezygnacji z punktów
1–2. Właściciel świadomie nie wybrał go jako drogi podstawowej.

Do tego zostaje w mocy stare ostrzeżenie: zmiana `ADMIN_PASSWORD` **nie
wyłącza TOTP**, więc „zmienię hasło" nigdy nie jest wyjściem z tej pułapki.

## Uwaga z Modułu 40 (2026-07-22) — jak to w ogóle sprawdzić lokalnie

Dev-login (`DEV_ADMIN_BYPASS=1`) **omija całe logowanie**, więc drugiego
składnika nie da się sprawdzić „przez wejście do panelu" — panel wpuści zawsze.
Zaplanuj ścieżkę weryfikacji od razu (wywołanie trasy logowania wprost,
z tymczasowo wyłączonym bypassem), a nie na końcu, gdy kod już stoi.

Druga rzecz, na której Moduł 40 stracił rundę: dokładając pole do modelu
Swift w apce (`leggera-hub-ios`), dopisz je w **trzech** miejscach —
właściwość, `CodingKeys` **i** ręczny `init(from decoder:)`. Opcjonalny `var`
bez przypisania kompiluje się bez ostrzeżenia i jest zawsze `nil`.
