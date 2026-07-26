# Prompt do wklejenia w nowym czacie — moduł OFERTY

> Powstał 2026-07-26, po domknięciu Klientów (Moduł 51 audyt + Moduł 54
> rozbudowa, w tym pięciorundowa przebudowa profilu rekordu).

Kontynuujemy audyt UI/UX i kompletności panelu (leggeralabs.pl/admin, repo
bieżące) oraz apki natywnej iPhone/iPad (`leggera-hub-ios`, osobne repo:
`/Volumes/OWC_SN850X/projekty_ai/leggera-hub-ios`), moduł po module,
w kolejności lejka sprzedaży. **Pulpit, Leady i Klienci są zrobione.**

**ZANIM ZACZNIESZ — przeczytaj:**
- `docs/plany-modulow/51-audyt-uiux-panel-i-apka.md` — kontekst inicjatywy
  i sekcje „Stan po module…" (Pulpit, Leady, Klienci) wraz z podsekcją
  „Domknięcie: profil rekordu przebudowany".
- `docs/plany-modulow/00-mapa-drogi-klienta.md` — mapa etapów; Oferty to
  Etap 4 (Oferta PoC-first) i wejście do Etapu 5–6 (Negocjacja, Akceptacja).
- `docs/plany-modulow/20-szablony-ofert.md` — brief szablonów ofert; sprawdź,
  ile z niego jest zbudowane, zanim cokolwiek zaproponujesz.
- `HUB_SETUP.md` → sekcje „Moduł 54 — Klienci, krok 6" (wzorzec profilu
  rekordu, obowiązujący od teraz) oraz wszystko o Ofertach.
- `CLAUDE.md` — zasady projektu.

**Teraz bierzemy moduł: Oferty.**

Sprawdź i oceń, a potem zaproponuj właścicielowi KONKRETNE poprawki — nie
pytaj ogólnie „co zmienić".

## Co sprawdzić

1. **Parytet między platformami** — panel (`/admin/offers`,
   `OffersDashboard.tsx`, `OfferEditor.tsx`), iPhone i iPad (`leggera-hub-ios`).
   Te same statusy, pola, akcje, drogi wejścia? Dowód luki w apce to trasa
   panelu, której `APIClient.swift` nie woła — grep po `/api/offers`.
   **Odwrotnie NIE działa**: „trasa niewołana" nie zawsze znaczy „funkcja
   niewidoczna" (bywa dostępna inną drogą).
2. **Kompletność wobec mapy drogi klienta** — czy przejście
   oferta → akceptacja → umowa → projekt działa na każdej platformie
   i czy niczego nie gubi po drodze (Moduł 12: fundament linkowania,
   Moduł 11: umowy i NDA).
3. **Poziom premium** — swipe/long-press na liście, klikalność wierszy,
   spójność kolorów statusu, filtr w pasku, skróty klawiszowe.
4. **Profil oferty wobec nowego wzorca.** Edytor oferty ma dziś inny kształt
   niż profil leada i klienta (`max-w-7xl`, tabela pozycji). **To NIE jest
   automatycznie błąd** — CLAUDE.md wprost mówi, że Faktury/Oferty/Projekty
   mają własne, węższe limity, bo mają inny kształt treści. Ale zestaw je
   z nowym wzorcem i powiedz właścicielowi, co warto przenieść, a co zostawić.

## Lekcje z poprzednich modułów, warte sprawdzenia u Ofert

Wszystkie to **realne błędy złapane wcześniej**, nie teoria:

1. **„Na sztywno w kodzie" cicho psuje wskaźniki.** Sprawdź, czy któraś
   ścieżka tworzenia oferty nie wpisuje wartości na stałe w pole, po którym
   coś potem liczymy (statusy, źródło, waluta, termin ważności).
2. **Idempotencja i widoczny ślad.** Każda akcja tworząca dokument z oferty
   (umowa, projekt, faktura) musi mieć oba: drugie kliknięcie nie może robić
   drugiego dokumentu, a karta musi wiedzieć, że dokument już istnieje.
3. **Kolor niesie znaczenie i łatwo go okłamać.** Udana akcja pokazana jak
   błąd, albo dwa różne kolory na to samo znaczenie.
4. **Lista, która kłamie pustką** (ustalenie A1). Stan pusty ma mówić, czego
   brakuje i co to zmienia — nie samo „brak".
5. **Sufity techniczne.** Czy `GET /api/offers` oddaje wszystko naraz i czy
   operacje masowe nie robią N żądań w pętli (wzorzec z Modułu 54, krok 3:
   sufit z GŁOŚNYM ostrzeżeniem zamiast przedwczesnego stronicowania).
6. **Weryfikuj POMIAREM, nie zrzutem.** Przy przebudowie profilu rekordu trzy
   kolejne zgłoszenia właściciela rozstrzygnął dopiero pomiar w przeglądarce
   (wysokości wierszy, pozycje krawędzi) — zrzut za każdym razem wyglądał
   wiarygodnie. Panel oglądaj lokalnie (`npm run dev` + narzędzia
   przeglądarki), NAJPIERW obejrzyj, POTEM wnioskuj.

## Czego NIE ruszać

- **Rzeczy z `PO_REJESTRACJI.md`** — firma nie jest zarejestrowana
  (m.in. KSeF test→produkcja, dane sprzedawcy, nota prawna).
- **Przeprowadzka na NAS** (Moduł 55) — czeka na rejestrację firmy,
  patrz `PO_REJESTRACJI.md` pkt 13a.
- **Reguła „model tylko proponuje"** — punktowe użycia lokalnego LLM są
  dozwolone wyłącznie tam, gdzie właściciel je zatwierdził (CLAUDE.md →
  „Świadome decyzje produktowe"). Nowy punkt wymaga wyraźnej prośby.

## Na koniec modułu

- Dopisz „Stan po module Oferty" do
  `docs/plany-modulow/51-audyt-uiux-panel-i-apka.md`.
- Uzupełnij `HUB_SETUP.md`.
- Dopisz moduł do `lib/instrukcje.ts` (podręcznik obsługi dla panelu i apki)
  — dopiero gdy moduł jest sprawdzony i uznany za gotowy.
- Przygotuj prompt do następnego modułu w kolejce: **Umowy**.
