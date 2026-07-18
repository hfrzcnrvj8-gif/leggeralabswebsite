# Uwierzytelnianie klienta natywnego — tokeny per-urządzenie

> Wdrożone w Fazie 1 (2026-07-19). Decyzja właściciela: tokeny per-urządzenie
> z możliwością odebrania dostępu — zgubiony telefon odcina się jednym
> kliknięciem w panelu webowym, bez zmiany hasła.

## Jak to działa

Panel webowy loguje się jak dotąd ciasteczkiem (`leggera_admin_session`,
deterministyczny token). Klient natywny ma osobny kanał:

1. **Logowanie**: `POST /api/admin/login` z body
   `{ "password": "<hasło>", "device": "iPhone Patryka" }`.
   Obecność pola `device` przełącza trasę w tryb natywny — zamiast ustawiać
   ciasteczko, serwer tworzy losowy token (32 bajty, hex) i zwraca:
   ```json
   { "ok": true, "device_id": "<uuid>", "token": "<64 znaki hex>" }
   ```
   Token pojawia się w odpowiedzi **tylko ten jeden raz** — w bazie leży
   wyłącznie jego SHA-256.
2. **Każde kolejne żądanie**: nagłówek `Authorization: Bearer <token>`.
   `isAuthed()` sprawdza nagłówek PRZED ciasteczkiem; poprawny token
   dodatkowo aktualizuje `last_used_at` (jedno zapytanie, bez dodatkowego
   kosztu). Zły / odebrany token → każda trasa admina zwraca `401`.
3. **Wylogowanie z urządzenia**: `POST /api/admin/logout` z nagłówkiem
   Bearer — unieważnia token TEGO urządzenia (`revoked_at`), wiersz zostaje
   jako ślad.
4. **Odebranie dostępu z panelu**: przycisk „Urządzenia" w sidebarze panelu
   webowego (`GET /api/admin/devices`, `DELETE /api/admin/devices/:id`).
   Po odebraniu apka przy najbliższym żądaniu dostaje `401` → wraca na ekran
   logowania.

## Wymagania po stronie aplikacji (Swift)

- **Token trzymamy w Keychain**, nigdy w `UserDefaults` (decyzja z
  `00-plan.md`).
- Nazwa urządzenia przy logowaniu: czytelna dla człowieka, np.
  `UIDevice.current.name` (to ją widać na liście „Urządzenia" w panelu);
  serwer przycina do 100 znaków.
- **Reakcja na 401**: każdy 401 poza ekranem logowania = token odebrany lub
  unieważniony → wyczyść Keychain i pokaż logowanie. Nie ponawiaj żądania.
- Hasło nie jest nigdzie przechowywane w apce — służy tylko do jednorazowej
  wymiany na token. Face ID chroni dostęp do apki, nie zastępuje tokenu.

## API urządzeń

| Metoda | Ścieżka | Po co |
|---|---|---|
| `POST` | `/api/admin/login` | Web: `{password}` → ciasteczko. Natywnie: `{password, device}` → `{ok, device_id, token}`; złe hasło → `401 {error}` |
| `POST` | `/api/admin/logout` | Z Bearerem: unieważnia token bieżącego urządzenia; z ciasteczkiem: kasuje ciasteczko |
| `GET` | `/api/admin/devices` | Lista urządzeń: `{devices: [{id, device_name, created_at, last_used_at, revoked_at}]}` (bez hashy) |
| `DELETE` | `/api/admin/devices/:id` | Odbiera urządzeniu dostęp (`revoked_at = now()`); idempotentne |

## Tabela `device_tokens`

| Kolumna | Typ | Uwagi |
|---|---|---|
| `id` | TEXT PK | uuid |
| `token_hash` | TEXT UNIQUE NOT NULL | SHA-256 tokenu; sam token zna tylko urządzenie |
| `device_name` | TEXT NOT NULL | nazwa podana przy logowaniu |
| `created_at` | TIMESTAMPTZ NOT NULL | default `now()` |
| `last_used_at` | TIMESTAMPTZ NOT NULL | odświeżane przy każdym uwierzytelnionym żądaniu |
| `revoked_at` | TIMESTAMPTZ NULL | `NOT NULL` = dostęp odebrany; wiersza nie kasujemy |

## Czego świadomie NIE ma

- Refresh-tokenów i wygasania po czasie — panel jest jednoosobowy, token żyje
  do ręcznego odebrania. Gdyby kiedyś było trzeba, `last_used_at` już jest.
- Ograniczeń per-token (ról, uprawnień) — jeden administrator, pełny dostęp.
- Rate-limitu na logowanie — hasło jest jedno i silne; do rozważenia przy
  wystawieniu apki poza TestFlight.

Zweryfikowane end-to-end 2026-07-19 (curl, serwer dev z ustawionym hasłem):
logowanie z `device`, dostęp Bearerem, `401` bez auth / ze złym tokenem /
po odebraniu dostępu, wylogowanie Bearerem, logowanie webowe bez zmian.
