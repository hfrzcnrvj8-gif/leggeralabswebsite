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
5. **Aplikacja iOS** — `POST /api/admin/login` musi przyjąć `{ password, kod }`
   i zwrócić czytelny błąd „wymagany kod", żeby apka wiedziała, że ma o niego
   zapytać. Raz wydany token urządzenia działa dalej — drugi składnik dotyczy
   **wydania** tokenu, nie każdego żądania.
6. **Hamulec** — kod TOTP ma tylko milion kombinacji; wpiąć drugi krok w ten
   sam `lib/rateLimit.ts` (osobna akcja, np. `login-totp`, ten sam próg).

## Świadome wykluczenia

- **Bez SMS-a i bez maila jako drugiego składnika** — SMS jest podatny na
  przejęcie numeru, a mail chodzi przez tę samą skrzynkę, którą panel
  obsługuje (przejęcie skrzynki dawałoby oba składniki naraz).
- **Bez kluczy sprzętowych/passkeys** w tym module — większy zakres,
  osobna rozmowa.
- **Bez „zapamiętaj to urządzenie na 30 dni"** — panel już ma trwałe tokeny
  urządzeń, to byłby drugi mechanizm robiący to samo.

## Pułapka

Jeśli 2FA zostanie włączone, a kody zapasowe nie zadziałają, **nie ma drogi
awaryjnej** — nie ma administratora, który by je zresetował. Jedynym wyjściem
byłaby zmiana `ADMIN_PASSWORD`… która **nie wyłącza TOTP**. Przewidź jawny
wyłącznik: zmienna środowiskowa (np. `TOTP_DISABLED=1`) ustawiana w panelu
Vercela, która wyłącza drugi krok. Właściciel ma dostęp do Vercela zawsze —
to jest jego klucz zapasowy ostatniej instancji.
