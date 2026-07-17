# Moduł 5 — Leggera Hub jako aplikacja mobilna (PWA)

> Przeczytaj najpierw `docs/plany-modulow/README.md` (zasady wspólne) i `CLAUDE.md`.
> To moduł DOMYKAJĄCY — róbmy go po funkcjach (1–4), bo mobilny sens ma dopiero
> to, co realnie jest w panelu. Architektura zdecydowana — patrz „DECYZJA”.

## Cel (słowami właściciela)

„Na koniec chcę mieć całą tę aplikację też na telefonie, w formie mobilnej.”
Nazwa całości: **Leggera Hub** — wszechogarniający program do prowadzenia firmy
(leady, klienci, projekty, faktury, koszty, poczta, kalendarz — w jednym miejscu,
także w kieszeni). Nazwa jest już ustalona w `CLAUDE.md`; tu ją tylko utrwalamy
jako markę aplikacji, którą właściciel instaluje na telefonie.

## DECYZJA: PWA (Progressive Web App), nie natywna apka ze sklepu

**POTWIERDZONE przez właściciela 2026-07-17** (przy okazji Modułu 36): chce
„pełnoprawną aplikację działającą na iPhonie i iPadzie" i po przedstawieniu obu
dróg **wybrał PWA**, świadomie odrzucając natywną apkę z App Store. Nie pytaj o
to drugi raz — ta decyzja jest zamknięta.

Panel to Next.js — najtańsza i wystarczająca droga na telefon to **PWA**:
instalowalna na ekranie głównym, uruchamia się jak zwykła aplikacja (pełny ekran,
własna ikona), działa na iOS i Androidzie, **bez App Store / Google Play, bez
osobnego kodu**. Dla jednoosobowego narzędzia to idealny wybór. „Pełnoprawna" w
rozumieniu właściciela = **wygodna na każdym jego urządzeniu Apple**, nie =
obecność w sklepie.

Natywne opakowanie (Capacitor/React Native) rozważać TYLKO, jeśli kiedyś potrzebna
będzie obecność w sklepie albo głęboka integracja sprzętowa — teraz nie jest, nie
budować. PWA daje 95% korzyści za ułamek kosztu.

### iPhone I iPad — dwa różne ekrany, nie jeden „mobilny"

Właściciel wprost wymienił **iPada**. To osobny cel, nie „telefon tylko większy":

- **iPhone (~375–430 px):** wąski, jedna kolumna, nawigacja kciukiem. Tu leży 80%
  roboty (Kanban/tabele/edytory nie mieszczą się).
- **iPad (~768–1024 px, pion I poziom):** szerszy — bliżej desktopu. Część widoków
  desktopowych zadziała wprost, ale trzeba je **sprawdzić osobno** (dwie kolumny
  zamiast jednej albo trzech; oś czasu projektów bywa używalna na iPadzie w
  poziomie, na iPhonie nie). iPadOS Safari też wspiera „Dodaj do ekranu głównego"
  → PWA instaluje się identycznie. Weryfikacja MUSI objąć **oba** breakpointy
  (`resize_window preset:"tablet"` 768×1024 obok `preset:"mobile"` 375×812), a na
  iPadzie także **orientację poziomą** (landscape), bo tam apka spędzi sporo czasu.

## Uczciwie: PWA to dwie osobne prace (nie mylić ich)

1. **Opakowanie PWA (łatwe, ~1 dzień):** manifest + service worker + ikony →
   „zainstaluj na ekranie głównym”, pełny ekran, ikona Leggera Hub. To sama
   „skorupa”.
2. **Responsywność każdego widoku (właściwa robota):** panel był projektowany pod
   desktop. Część widoków jest wąsko-nieprzyjazna: **Kanban** (leady/projekty),
   **Oś czasu** projektów (`ProjectTimeline.tsx`), **tabele** (lista faktur/kosztów),
   **modale edytorów** (`InvoiceEditor`/`OfferEditor`/`ProjectsDashboard` —
   wyśrodkowane, dużo pól), **peek panel** wysuwany z prawej. Na telefonie trzeba
   je przejść jeden po drugim i doprowadzić do używalności. To 80% wysiłku modułu.

Nie obiecuj „mobilnie” po samym dodaniu manifestu — bez kroku 2 apka będzie się
instalować, ale źle używać na wąskim ekranie.

## Stan faktyczny (co pomaga)

- Tailwind v3 z klasami responsywnymi już w użyciu (`sm:`/`lg:` widać np. w
  `DashboardHome.tsx`, `CalendarView.tsx`) — fundament jest.
- `AppShell.tsx` — wspólna powłoka (nawigacja) do zrobienia trybu mobilnego
  (hamburger/dolna belka zamiast bocznego menu).
- Narzędzia dev do weryfikacji: `resize_window preset:"mobile"` (375×812) +
  screenshot — sprawdzać KAŻDY widok na wąsko.
- `app/icon.svg` (logo dwóch „L”) — baza pod ikony PWA w różnych rozmiarach.
- Motyw jasny/ciemny już wspierany — PWA ma to uszanować (theme-color per motyw).

## Plan techniczny

### Krok 1 — skorupa PWA
- `app/manifest.ts` (Next.js Metadata API `MetadataRoute.Manifest`): `name:
  "Leggera Hub"`, `short_name: "Leggera Hub"`, `display: "standalone"`,
  `start_url: "/pl/admin"`, `theme_color`/`background_color` zgodne z motywem,
  ikony (192/512 + maskable) wygenerowane z `app/icon.svg`.
- Service worker: rozważ `@ducanh2912/next-pwa` albo minimalny własny SW
  (cache skorupy + strategia network-first dla danych — panel jest za auth i
  online-first; NIE cache’uj odpowiedzi API z danymi klientów bez przemyślenia
  RODO/świeżości). Zweryfikuj kompatybilność z Next 16/Turbopack przy budowie.
- Meta dla iOS (`apple-mobile-web-app-capable`, status bar, apple-touch-icon).

### Krok 2 — responsywna powłoka
- `AppShell.tsx`: na wąskim ekranie boczne menu → dolna belka nawigacji albo
  hamburger. Główne moduły dostępne kciukiem. Bezpieczne marginesy (safe-area
  insets dla notcha iOS).

### Krok 3 — responsywność widok po widoku (iteracyjnie)
Przejść i naprawić na wąsko, priorytetem to, czego używa się mobilnie najczęściej:
- **Pulpit** — już blisko; dopieścić siatkę KPI i sekcje na 1 kolumnę.
- **Leady/Klienci** — Kanban słabo działa na telefonie; daj domyślny widok listy
  na wąsko (leady mają już „Tabelę”), Kanban jako opcja na desktopie.
- **Faktury/Koszty** — tabele → karty na wąsko (stack zamiast kolumn).
- **Edytory (modale)** — na telefonie pełny ekran zamiast wyśrodkowanego okna,
  pola jedna pod drugą, duże cele dotykowe (≥44px), pickery dat mobilne.
- **Projekty/Oś czasu** — oś czasu jest z natury szeroka; na telefonie pokaż
  uproszczony widok listy kamieni/terminów zamiast poziomej osi (nie pchać osi na
  ekran 375px na siłę).
- **Poczta (moduł 4)** — projektować od razu mobilnie (lista → podgląd → odpowiedź).
- Kanały kontaktu (moduł 3) — duże przyciski `tel:`/`wa.me` to główny zysk mobilny.

### Krok 4 — powiadomienia (uczciwie o iOS)
- Web Push działa na Androidzie i na iOS **tylko** dla PWA dodanej do ekranu
  głównego (iOS 16.4+), z osobną zgodą, z ograniczeniami. NIE zakładać
  „natywnych pushy jak w App Store”. Na start rekomendacja: **bez web-push** —
  rolę powiadomień pełni dzienny mail (już działa) + Pulpit „co dziś”. Push jako
  ewentualny osobny mini-krok później, jeśli właściciel realnie tego potrzebuje.

### Krok 5 — weryfikacja
- Uwaga: pełny `next build` failuje w sandboxie (EPERM) — service worker/PWA
  realnie zweryfikuje się dopiero na Vercelu. W dev: `npx tsc --noEmit`, oraz
  przejście KAŻDEGO widoku w **DWÓCH** rozmiarach: `resize_window preset:"mobile"`
  (375×812, iPhone) **i** `preset:"tablet"` (768×1024, iPad) + screenshoty dla
  właściciela (to jest właściwy dowód responsywności). Na iPadzie sprawdź też
  **poziom** (landscape, np. 1024×768). Test „zainstaluj na ekranie głównym” na
  realnym iPhonie **i iPadzie** właściciela po deployu.
- **Pułapka podglądu** (patrz pamięć `podglad-rAF-zamrozony`): karta bywa `hidden`
  → `requestAnimationFrame` = 0 kl./s → animacje framer-motion nie ruszają, widok
  wygląda na zepsuty. Artefakt narzędzia, nie bug — zaczynaj od `tabs_create`,
  a gdy zamarznie, pompuj klatki zrzutami ekranu.

## Otwarte decyzje (zapytaj właściciela)

Właściciel chce **pełnoprawnej** apki (2026-07-17) — więc celem docelowym są
**WSZYSTKIE moduły responsywne**, nie tylko rdzeń. Pytania niżej dotyczą
**kolejności dostarczania i szczegółów**, nie „czy" — nie pytaj, czy chce pełnej
responsywności, bo chce.

1. **Kolejność dostarczania** (nie zakres — ten jest pełny) — czy dowozić
   iteracyjnie zaczynając od „mobilnego rdzenia” (Pulpit + Leady/Klienci + Poczta
   + szybkie kontakty `tel:`/`wa.me`), a resztę modułów w kolejnych paczkach —
   czy robić wszystko naraz w jednym dużym przejściu? **Rekomendacja: rdzeń
   najpierw**, bo daje najszybciej używalną apkę i pozwala Ci ją przetestować na
   telefonie, zanim dopieścimy rzadziej używane widoki. To duży moduł — dowożenie
   w paczkach jest bezpieczniejsze niż jeden wielki skok.
2. **Powiadomienia** — na start wystarczy mail + Pulpit (rekomendacja), czy chcesz
   od razu web-push (droższe, ograniczone na iOS — działa tylko po „dodaniu do
   ekranu głównego”, osobna zgoda)?
3. **Ikona/nazwa na ekranie głównym** — „Leggera Hub” + logo dwóch „L” z
   `app/icon.svg` (rekomendacja) czy coś innego?

## Definicja ukończenia (wersja startowa)
- Leggera Hub instaluje się na telefonie (ekran główny, ikona, pełny ekran).
- Mobilny rdzeń (min. Pulpit, Leady/Klienci, szybkie kontakty, Poczta jeśli
  gotowa) jest wygodny na 375px — potwierdzone screenshotami.
- Nawigacja dostosowana do kciuka; edytory używalne na telefonie.
- `tsc` czysty; PWA zweryfikowana na realnym telefonie po deployu; `HUB_SETUP.md`
  zaktualizowany o tryb mobilny.
