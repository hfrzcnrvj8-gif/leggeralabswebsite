# Faza 1 — inwentarz API i modelu danych (specyfikacja aplikacji)

> Wykonane 2026-07-19. To jest **specyfikacja, z której powstaje aplikacja
> natywna** — pisana tak, żeby czytać ją w osobnym repo (Swift), bez dostępu
> do kodu backendu. Plan nadrzędny: `00-plan.md`.

## Co tu jest

| Plik | Zakres | Skala |
|---|---|---|
| `inwentarz/00-uwierzytelnianie.md` | Logowanie apki: tokeny per-urządzenie, Bearer, Keychain, odbieranie dostępu | fundament |
| `inwentarz/01-leady-crm.md` | Leady, Klienci, Kontakty, Telefonia, Admin (login/urządzenia) | 30 tras |
| `inwentarz/02-projekty-hub.md` | Projekty, Czas/stoper, Notatnik, Kalendarz, Powiadomienia, Wyszukiwarka, Linki | 61 tras |
| `inwentarz/03-finanse.md` | Faktury, Oferty, Umowy, KSeF, Koszty (+OCR paragonu), Statystyki, Ustawienia | 74 trasy |
| `inwentarz/04-poczta-ai.md` | Poczta (pełny moduł apki!), szablony maili, lokalne AI, referencje | 19 tras |
| `inwentarz/05-model-danych.md` | 40 tabel, 18 schematów, enumy z polskimi etykietami, graf powiązań, konwencje | model danych |

Razem 184 opisane uchwyty (plan mierzył 183 + doszły 2 trasy urządzeń;
drobne różnice to kwestia liczenia multi-metodowych plików).

## Jak czytać (dla czatu budującego apkę)

1. Zacznij od `00-uwierzytelnianie.md` — bez tego żadna trasa nie odpowie.
2. Każda trasa ma przypisany **poziom w apce** (1 = pełna funkcja mobilnie,
   2 = podgląd/lekkie akcje, 3 = tylko desktop, — = publiczne trasy dla
   klienta końcowego, apki nie dotyczą). Faza 2 (bramka) potrzebuje tylko:
   logowania + tras Leadów z `01-leady-crm.md`.
3. Sekcje „Typy danych" na końcu każdego pliku są wzorcem dla struktur
   `Codable` w `LeggeraHubCore/Models` — enumy mają **polskie wartości**
   (np. status „Wdrożone", folder „obsłużony") i tak też muszą być kodowane.
4. Sekcje „Reguły biznesowe" istnieją po to, żeby nie odkrywać rocznych
   decyzji przez błędy w Swifcie (ryzyko nr 4 z planu). Gdy reguła wygląda
   dziwnie — najpierw `05-model-danych.md` i `HUB_SETUP.md`, potem pytanie
   do właściciela; nie „poprawiaj" jej po swojemu.

## Pułapki znane już teraz

- **Serwer często NIE waliduje enumów** (np. statusu leada) — apka musi
  pilnować dozwolonych wartości u siebie, dokładnie tych z inwentarza.
- **Daty**: wysyłaj `YYYY-MM-DD` przechodzące `isPlausibleDateString`;
  wyświetlaj przez własny formatter, nigdy surowego stringa z bazy.
- **Migawki dokumentów**: dane klienta na fakturze/ofercie/umowie są kopią
  z chwili wystawienia — edycja klienta ich nie zmienia i apka nie może
  ich „odświeżać".
- **AI (Ollama)** bywa offline — `503` to normalny stan, nie błąd apki;
  funkcje AI zawsze jako propozycja-do-zatwierdzenia.
- Inwentarz to **migawka na 2026-07-19** — przy każdej zmianie API w panelu
  trzeba zaktualizować odpowiedni plik inwentarza (inaczej specyfikacja
  zacznie kłamać, a to ona jest źródłem prawdy dla apki).
