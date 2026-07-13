# Moduł 4 — Skrzynka mailowa dwukierunkowa (luka ⑦b, dawna „Faza D — Mail")

> Przeczytaj najpierw `docs/plany-modulow/README.md` (zasady wspólne) i `CLAUDE.md`.
> To NAJWIĘKSZY moduł i wymaga decyzji właściciela o rejestracji aplikacji
> u dostawcy poczty. Nie zaczynaj budować, zanim właściciel nie zdecyduje o
> zakresie (patrz „Otwarte decyzje”) — być może wystarczy wariant minimalny.

## Problem (nietechnicznie)

Panel wysyła maile (oferty, faktury, przypomnienia), ale jest **jednokierunkowy**:

- **Odpowiedzi klientów są niewidoczne w panelu** — trafiają do zwykłej skrzynki
  Gmail/Outlook. Historia kontaktu w panelu ma tylko „co wysłaliśmy", nie „co
  odpisali". Żeby zobaczyć całość rozmowy, właściciel i tak musi otworzyć drugą
  aplikację (pocztę). To główny powód, dla którego panel **nie jest jeszcze
  jedyną apką** do prowadzenia firmy.

## Uwaga wstępna — czy w ogóle teraz?

Podczas audytu ustalono, że po zbudowaniu wysyłki ofert/faktur + przypomnień
**część potrzeby maila już jest załatwiona**. Zanim zbudujesz pełną skrzynkę
OAuth, rozważ z właścicielem, czy nie wystarczy **wariant minimalny** (niżej) —
pełna skrzynka to duży, kosztowny w utrzymaniu kawałek.

## Warianty zakresu (od najmniejszego)

### Wariant 0 — „reply-to + ręczne wklejenie" (najtańszy)
- Maile z panelu mają `Reply-To` na prawdziwą skrzynkę właściciela → odpowiedzi
  lądują tam, gdzie i tak zagląda. W panelu nic nie budujemy.
- Opcjonalnie: pole „wklej odpowiedź klienta" w osi kontaktu (ręczny wpis).
- **Kiedy wybrać:** jeśli wolumen maili jest mały, a druga apka (poczta) nie
  przeszkadza aż tak.

### Wariant 1 — odbiór przez webhook (średni, bez pełnego OAuth)
- Skonfiguruj adres typu `kontakt@leggeralabs.pl` u dostawcy, który umie
  **inbound webhook** (np. ta sama rodzina co obecny `RESEND_API_KEY` — sprawdź,
  czy Resend/inny obsługuje inbound, albo dedykowany inbound-parser).
- Webhook `POST /api/mail/inbound` parsuje maila, dopina go do właściwego
  leada/klienta po adresie nadawcy, zapisuje w osi kontaktu.
- **Bez** wysyłki z UI, **bez** OAuth. Panel „widzi" odpowiedzi, ale pełne
  redagowanie nadal w poczcie.
- **Kiedy wybrać:** chcesz widzieć odpowiedzi w panelu, ale nie potrzebujesz
  pełnego klienta pocztowego.

### Wariant 2 — pełna skrzynka OAuth (największy)
- OAuth do Gmail (Google Cloud project + zgoda) lub Outlook (Microsoft Entra).
- Synchronizacja wątków, lista wiadomości w panelu, wysyłka i odpowiadanie z UI,
  wątki dopięte do leadów/klientów.
- Duży zakres: tokeny odświeżane, paginacja, obsługa załączników, zgodność RODO
  (przechowywanie treści maili), rate limity API.
- **Kiedy wybrać:** panel MA być jedynym miejscem, gdzie właściciel czyta i pisze
  maile.

**Rekomendacja:** zacznij od **Wariantu 0 lub 1**. Wariant 2 tylko jeśli
właściciel świadomie chce zrezygnować z osobnego klienta pocztowego i zna koszt
utrzymania integracji.

## Stan faktyczny (co już jest)

- Wysyłka: `lib/email.ts` (`sendEmail`, Resend HTTP API, `RESEND_API_KEY` /
  `RESEND_FROM`). Używane w: raport dzienny, wysyłka oferty/faktury, przypomnienia.
- Osie kontaktu: `lead_activity`, `client_activity` + `client_events`
  (`logClientEvent`). To naturalne miejsce, gdzie doklejać przychodzące maile.
- Dopięcie po adresie: lead/klient mają pole `email`.
- Cron: `app/api/leads/notify` (jeśli potrzebny polling zamiast webhooka).

## Plan techniczny (dla Wariantu 1 — odbiór przez webhook)

### Krok 1 — schemat
- `lib/db.ts`: `mail_messages` (id, kierunek in/out, lead_id, client_id,
  from, to, subject, body_text, body_html, message_id, in_reply_to, received_at)
  — idempotentnie. Indeksy po lead_id/client_id i po message_id (dedup).

### Krok 2 — endpoint inbound
- `app/api/mail/inbound/route.ts` — **publiczny** (webhook dostawcy), ale
  chroniony sekretem w nagłówku (jak `CRON_SECRET`: fail-closed bez sekretu).
  Waliduje podpis dostawcy jeśli jest. Parsuje payload, dedup po `message_id`.
- Dopina do leada/klienta: `SELECT ... WHERE email = <from>`; jeśli brak —
  zapisz jako „nieprzypisane" do ręcznego dopięcia (nie gub maila).
- Zapisz też jako wpis osi (`client_activity`/`lead_activity` lub przez
  `logClientEvent`), żeby pojawił się w historii kontaktu.

### Krok 3 — UI
- Sekcja „Wiadomości" na karcie leada/klienta: wątek in/out chronologicznie.
- (Wariant 2 dodatkowo: lista skrzynki + okno pisania; osobny większy zakres.)

### Krok 4 — weryfikacja
- `npx tsc --noEmit`.
- Dev: zasymuluj payload inbound (POST z przykładowym mailem) → sprawdź dopięcie
  do właściwego klienta i wpis w osi. Dedup: drugi POST z tym samym `message_id`
  nie tworzy duplikatu. Zrzut/log dla właściciela.

## RODO / prawo (ważne — skonsultuj z sekcją prawną projektu)
Przechowywanie treści maili klientów to przetwarzanie danych osobowych:
- Zaktualizuj politykę prywatności (kategoria danych: korespondencja) — patrz
  `PO_REJESTRACJI.md` i istniejąca polityka.
- Ustal retencję (jak długo trzymamy treści) i sposób usunięcia na żądanie.
- To kolejny argument, by zacząć od Wariantu 0/1 (mniej danych = mniej ryzyka).

## Otwarte decyzje (zapytaj właściciela — KLUCZOWE przed startem)
1. **Który wariant?** 0 (reply-to), 1 (odbiór webhook), czy 2 (pełny OAuth)?
2. **Dostawca poczty** — Gmail czy Outlook? (determinuje OAuth/inbound).
3. **Czy właściciel jest gotów zarejestrować aplikację** u Google/Microsoft
   (Wariant 2) — to jego decyzja i jego konto.
4. **Retencja** treści maili w panelu (RODO).

## Definicja ukończenia (zależnie od wariantu)
- Wariant 0: maile mają poprawny Reply-To; (opcjonalnie) ręczny wpis odpowiedzi.
- Wariant 1: odpowiedzi klientów pojawiają się w panelu, dopięte do właściwego
  rekordu, z dedup; polityka prywatności zaktualizowana.
- Wariant 2: pełne czytanie/pisanie z panelu, wątki dopięte, tokeny odświeżane.
- `tsc` czysty, zweryfikowane na dev, zrzut dla właściciela, `HUB_SETUP.md`
  zaktualizowany.
