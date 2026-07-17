# Moduł 32 — Teksty prowadzące zostały w świecie sprzed Modułów 11–17

> Przeczytaj `docs/plany-modulow/README.md` (zasady wspólne), `CLAUDE.md` oraz
> `00-mapa-drogi-klienta.md`. Brief powstał **z audytu Modułu 29** (2026-07-17).
>
> **Kolejność: to jest PIERWSZY z trzech briefów audytu (32 → 30 → 31)** —
> zatwierdzona przez właściciela 2026-07-17. Ten jest najmniejszy, a panel-mentor
> mylący się co do własnych możliwości jest najbardziej mylący na co dzień.
> Nie wymaga 30 ani 31 — jest samodzielny. **Jedno zastrzeżenie:** znalezisko 5
> („automatycznie zakłada Klienta") należy do **Modułu 30** — tutaj tylko
> odnotuj, nie naprawiaj, żeby oba briefy się nie pobiły o ten sam kod.

## Skąd to się wzięło

Panel ma być **mentorem** — właściciel poprosił: *„chcę wypracować raz wzorzec,
który jest najlepszy, i według niego pracować, a aplikacja ma to monitorować i
pomagać, gdybym zbaczał z toru"*. Cała warstwa podpowiedzi istnieje po to, żeby
mówić „co teraz".

Audyt Modułu 29 ustalił, że **ta warstwa opisuje panel sprzed ośmiu modułów**.
Podpowiedzi nie były aktualizowane od Modułu 11, mimo że Moduły 11–17 dołożyły
cztery nowe etapy drogi (Umowa, NDA, Onboarding, Wsparcie) i **zautomatyzowały
rzeczy, o które podpowiedzi wciąż proszą ręcznie**.

To nie jest kosmetyka. Mentor, który myli się co do własnych możliwości, jest
gorszy niż brak mentora — właściciel **nie czyta kodu** i ma prawo wierzyć temu,
co panel pisze na ekranie.

## Znaleziska (wszystkie potwierdzone w kodzie)

### 1. 🔴 Panel radzi ustawić przypomnienie, którego sam nigdy nie pokaże
**Najpoważniejsze — to działający błąd, nie tylko nieaktualny tekst.**

- `lib/leads.ts:194` — podpowiedź przy odrzuconym leadzie: *„Zamknięte. Warto
  ustawić przypomnienie za parę miesięcy — sytuacja klienta się zmienia."*
- `lib/leads.ts:255` — `isOverdue()` **odrzuca zamknięte leady, zanim spojrzy na
  `next_followup`**:
  ```
  if (CLOSED_STATUSES.has(lead.status)) return false;   // linia 255
  ...
  if (lead.next_followup) { ... }                        // linia 259 — nieosiągalne
  ```
- `isOverdue()` to **jedyna** ścieżka zasilająca Pulpit (`hub/today/route.ts:122`)
  **i** dzienny mail (`leads/notify/route.ts:403`).

**Skutek:** robisz dokładnie to, co panel radzi — i panel nigdy Ci o tym nie
przypomni. Cicho, bez śladu.

**Uwaga:** to nie jest to samo co nurture z Modułu 2 (`lib/clients.ts`, kontakty
+14/+90 dni) — tamto dotyczy **klientów po zamkniętym projekcie**. Dla
**odrzuconych leadów** nie ma żadnej innej ścieżki.

### 2. 🔴 Mapa procesu nie zna Umowy, NDA, Onboardingu ani Wsparcia
- `lib/process.ts` — ściągawka „gdzie jestem", renderowana **na każdej karcie
  leada i klienta** (`components.tsx:238`)
- Ma 12 kroków i idzie: *…6. Akceptacja → 7. Kickoff/kamienie…*
- **Kroku „Umowa" nie ma w ogóle.** Tak samo NDA, Onboardingu i Wsparcia.
- `AppShell.tsx:59` — komentarz twierdzi, że kolejność menu odpowiada tym 12
  krokom. **A w menu „Umowy" już są.**

### 3. Podpowiedź każe robić ręcznie to, co panel już robi sam
`lib/leads.ts:191` — przy statusie „Zamknięte - sukces": *„pilnuj realizacji i
poproś o referencję po wdrożeniu"*.

Moduły 15 i 17 robią to automatycznie: podpowiedź przy „Wdrożone" + gotowy
szablon + automatyczny kontakt +14 dni z linkiem do formularza opinii.

### 4. Podpowiedź milczy o NDA dokładnie tam, gdzie mapa go wymaga
`lib/leads.ts:186-195` — przy „Rozmowa umówiona": *„Przygotuj kwalifikację: jaki
problem, jaka skala, jaki budżet"* — **ani słowa o NDA**, mimo że:
- mapa mówi wprost *„NDA PRZED rozmową, nie po"* (Krok 0),
- przycisk do wysłania NDA jest **na tym samym ekranie**
  (`LeadDetailPanel.tsx:199`).

### 5. Sama mapa drogi klienta obiecuje cztery rzeczy, których nie ma
`00-mapa-drogi-klienta.md` to **dokument nadrzędny**, który właściciel czyta jako
instrukcję „jak mam pracować". Obiecuje:

| Obietnica | Gdzie w mapie | Rzeczywistość |
|---|---|---|
| „automatycznie zakłada Klienta" | Krok 2 | tylko z leada — patrz **Moduł 30** |
| „panel podpowiada gotowy szablon odmowy" | Krok 1 | **nie istnieje** — `mail-templates` startuje z pustą listą, nic nie jest wsiewane |
| „status leada = kwalifikowany" | Krok 1 | **taki status nie istnieje** (lista: Nowe zgłoszenie / Do kontaktu / Napisano / Przypomnienie wysłane / Rozmowa umówiona / Pilotaż w trakcie / Zamknięte-sukces / Odrzucone) |
| „przypomnienie **przed** terminem płatności" | Krok 7 | `lib/invoices.ts:418` mówi wprost: *„Świadomie BEZ przypomnienia przed terminem"* — **świadoma decyzja Modułu 13**, ale mapa jej nie odnotowała |

### 6. Drobiazg: ekran bez wejścia
`/pl/admin/quick-log` (szybkie zalogowanie rozmowy z telefonu) **nie jest
podlinkowany znikąd** — nie ma go w menu (`AppShell.tsx:66`) ani w palecie
poleceń. Trzeba znać adres na pamięć.

## Do rozstrzygnięcia z właścicielem

1. **Czy przypomnienie dla zamkniętego leada ma działać?** (znalezisko 1)
   Poprawka to przestawienie dwóch linii w `isOverdue()`, ale **zmienia to, co
   widzisz na Pulpicie i w dziennym mailu**:
   - dla **„Odrzucone"** — wygląda na oczywiste „tak" (podpowiedź to obiecuje),
   - dla **„Zamknięte - sukces"** — ostrożnie: tam kontakt po projekcie prowadzi
     już retencja z Modułu 17 (`lib/clients.ts`), więc włączenie tego mogłoby
     **dublować przypomnienia**.
   - **Rekomendacja: włączyć tylko dla „Odrzucone"**. Do potwierdzenia.
2. **Jak ma wyglądać mapa procesu po Modułach 11–17?** Ile kroków, w jakiej
   kolejności, czy NDA i Wsparcie to osobne kroki czy warianty? **To decyzja
   biznesowa o kształcie własnego procesu — nie zgaduję za właściciela.**
3. **Szablon odmowy** — mapa go obiecuje, nie istnieje. Dobudować (wsiewany
   szablon w `mail-templates`) czy usunąć obietnicę z mapy?
4. **Przypomnienie przed terminem płatności** — mapa obiecuje, Moduł 13
   świadomie odrzucił. Poprawić mapę czy zmienić decyzję?
5. **Czy `quick-log` ma trafić do menu/palety poleceń**, czy to celowo ukryty
   ekran „tylko z telefonu" (wtedy należy do Modułu 5)?

## Zakres (po odpowiedziach)

- `lib/leads.ts` — kolejność sprawdzeń w `isOverdue()` (znalezisko 1)
- `lib/leads.ts:186-195` — treść podpowiedzi: NDA przy „Rozmowa umówiona",
  usunięcie „poproś o referencję" przy „Zamknięte - sukces"
- `lib/process.ts` + komentarz w `AppShell.tsx:59` — mapa procesu po Modułach
  11–17
- `00-mapa-drogi-klienta.md` — korekta czterech obietnic z tabeli wyżej
- Opcjonalnie: szablon odmowy, `quick-log` w palecie poleceń

## Weryfikacja

`npx tsc --noEmit -p tsconfig.json` + podgląd (`preview_start name:"dev"`).
Ścieżka na żywo dla znaleziska 1: odrzuć leada → ustaw `next_followup` na dziś →
sprawdź, czy pojawia się na Pulpicie.
