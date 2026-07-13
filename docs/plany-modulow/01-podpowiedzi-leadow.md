# Moduł 1 — Podpowiedzi dla leadów + mapa procesu (luka ⑤)

> Przeczytaj najpierw `docs/plany-modulow/README.md` (zasady wspólne) i `CLAUDE.md`.
> Potem zaproponuj plan, zadaj pytania z sekcji „Otwarte decyzje", dopiero buduj.

## Problem (nietechnicznie)

Panel miał uczyć właściciela procesu sprzedaży „krok po kroku", nie tylko
rejestrować dane. Dziś jest to zrobione **połowicznie**:

- **Karty klientów** mają miękką podpowiedź per status (np. „Cisza od jakiegoś
  czasu — ustaw przypomnienie…") — `CLIENT_STATUS_HINT` w `lib/clients.ts`.
- **Leady NIE mają żadnej podpowiedzi.** Przy statusie „Rozmowa umówiona" panel
  nie mówi, co zrobić dalej. A leady to początek lejka — właśnie tu podpowiedź
  jest najcenniejsza.
- **Nigdzie nie widać uzgodnionego 12-krokowego procesu** (od „znalezienie
  leada" po „nurture"). Właściciel musi go pamiętać z głowy.

## Uzgodniony 12-krokowy proces (z pamięci projektu — nie renegocjować)

1. Znalezienie leada 2. Pierwszy kontakt 3. Rozmowa kwalifikująca
4. Oferta (PoC-first) 5. Negocjacja 6. Akceptacja (auto: projekt+faktura-szkic)
7. Kickoff/kamienie milowe 8. Realizacja 9. Wystawienie faktury
10. Pilnowanie płatności 11. Zamknięcie/referencja 12. Nurture (kontakt za X mies.).

## Zakres

**W zakresie:**
1. `LEAD_STATUS_HINT` — statyczny tekst podpowiedzi per status leada, wzorowany
   1:1 na `CLIENT_STATUS_HINT`. Renderowany w `LeadDetailPanel.tsx` pod
   `StatusTag` (dokładnie jak w `ClientDetailPanel.tsx:200`).
2. Mapa 12 kroków widoczna w UI jako miękka ściągawka (nie bramka) — z
   zaznaczeniem, gdzie w procesie jest dany lead/klient.

**Poza zakresem** (nie rób bez wyraźnej prośby): zmiana samej listy statusów
leadów, twarde blokady przejścia, przypisywanie zadań do kroków, AI sugerujące
treść.

## Statusy leadów (stan faktyczny — `lib/leads.ts`)

```
"Nowe zgłoszenie ze strony", "Do kontaktu", "Napisano - czeka na odpowiedź",
"Przypomnienie wysłane", "Rozmowa umówiona", "Pilotaż w trakcie",
"Zamknięte - sukces", "Odrzucone / brak zainteresowania"
```

Do każdego napisz jedno zdanie „co teraz zrobić". Zamknięte statusy (sukces/
odrzucone) mogą mieć podpowiedź neutralną lub żadną. Propozycja treści (do
akceptacji właściciela — zapytaj):

- Nowe zgłoszenie ze strony → „Ktoś sam się zgłosił — odezwij się dziś, póki
  gorące. Zadzwoń albo napisz i zmień status."
- Do kontaktu → „Zrób pierwszy ruch: telefon lub krótki, spersonalizowany mail.
  Wspomnij, co konkretnie możesz zautomatyzować w ich branży."
- Napisano - czeka na odpowiedź → „Piłka po ich stronie. Jeśli cisza ~4 dni,
  panel przypomni o follow-upie."
- Przypomnienie wysłane → „Drugi kontakt poszedł. Brak odpowiedzi po kolejnym
  tygodniu? Rozważ zamknięcie albo zmianę kanału (telefon zamiast maila)."
- Rozmowa umówiona → „Przygotuj kwalifikację: jaki problem, jaka skala, jaki
  budżet. Cel rozmowy = zgoda na PoC, nie od razu duży kontrakt."
- Pilotaż w trakcie → „PoC leci. Umów termin pokazania wyniku — to on domyka
  sprzedaż. Gdy klient powie „tak", zrób z leada ofertę."
- Zamknięte - sukces → „Wygrane. Klient i projekt już są — pilnuj realizacji i
  poproś o referencję po wdrożeniu."
- Odrzucone / brak zainteresowania → „Zamknięte. Warto ustawić przypomnienie za
  parę miesięcy — sytuacja klienta się zmienia."

## Plan techniczny

### Krok 1 — `LEAD_STATUS_HINT`
- `lib/leads.ts`: dodaj `export const LEAD_STATUS_HINT: Record<string, string>`
  (klucze = wartości ze `STATUSES`). Czysta stała, bez `"use client"`.
- `app/[lang]/admin/leads/shared.tsx`: re-eksport z `lib/leads.ts` (wzorem, jak
  `clients/shared.tsx` re-eksportuje `CLIENT_STATUS_HINT`).

### Krok 2 — render w panelu leada
- `app/[lang]/admin/leads/LeadDetailPanel.tsx`: pod blokiem `StatusTag`
  (ok. linia 188–200) dodaj `<p>` z `LEAD_STATUS_HINT[lead.status]`, klasy jak w
  `ClientDetailPanel.tsx:200` (`text-[12.5px] text-muted opacity-80`).
- Sprawdź też podstronę `app/[lang]/admin/leads/[id]/page.tsx` — czy renderuje
  ten sam `LeadDetailPanel` (wg CLAUDE.md peek panel i podstrona dzielą komponent).

### Krok 3 — mapa 12 kroków (miękka ściągawka)
Wybierz jedną z form (zapytaj właściciela w „Otwarte decyzje"):
- **Wariant A (lekki):** komponent `ProcessMap` renderowany na dole panelu
  leada/klienta — 12 kroków w poziomie, aktualny krok podświetlony marką.
  Mapowanie statusu→krok to statyczna tabela w `lib/leads.ts`/`lib/clients.ts`.
- **Wariant B (osobny widok):** mała podstrona/sekcja na Pulpicie „Twój proces"
  — 12 kroków z krótkim opisem każdego, bez wiązania z konkretnym rekordem.

Rekomendacja: **Wariant A** — podpowiedź „jesteś tu" jest cenniejsza przy
konkretnym leadzie niż abstrakcyjna lista.

### Krok 4 — weryfikacja
- `npx tsc --noEmit -p tsconfig.json`.
- `preview_start name:"dev"` → otwórz leada w każdym statusie (seed ma leady;
  zmień status w UI) → potwierdź, że podpowiedź się zmienia i mapa podświetla
  właściwy krok. Zrzut ekranu dla właściciela.

## Otwarte decyzje (zapytaj właściciela)
1. Treść podpowiedzi — zaakceptować powyższe, czy poprawić tonem?
2. Mapa procesu: Wariant A (przy rekordzie) czy B (osobny widok)? Czy w ogóle
   teraz, czy same podpowiedzi wystarczą na pierwszy krok?

## Definicja ukończenia
- Każdy status leada pokazuje podpowiedź w panelu (peek + podstrona).
- (Jeśli wybrane) mapa 12 kroków widoczna i podświetla aktualny krok.
- `tsc` czysty, zweryfikowane wizualnie, zrzut dla właściciela.
- Zaktualizowany `HUB_SETUP.md` (sekcja o podpowiedziach/mentorze).
