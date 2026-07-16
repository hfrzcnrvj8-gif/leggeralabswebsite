# Moduł 23 — Zakładki w kliencie i leadzie + audyt zmian + listy tylko do podglądu

> Przeczytaj `docs/plany-modulow/README.md` i `CLAUDE.md`. Stan faktyczny
> poniżej zbadany 2026-07-16 — nie badaj od nowa.

## Skąd to się wzięło

Właściciel (2026-07-16): *„mamy listę jak teraz z klientów i tam nie można nic
edytować, to tylko spis ale kiedy wejdę w klienta to mam jego wizytówkę i tam
mogę zmieniać dane ale co ważne chcę aby były oddzielne zakładki na wizytówkę,
na historię kontaktu, na logi zmian, żeby nie wszystko tak jak teraz kumulowało
się na jednej stronie. W leadach analogicznie to samo."*

## Dwa ustalenia, które zmieniają zakres

**1. „Logi zmian" nie mają dziś źródła danych.** Panel nigdzie nie zapisuje,
kto/kiedy/z czego na co zmienił pole. Grep po `audit|changelog|field_history|
revision` w `app/` i `lib/` → zero. `client_events` (`lib/db.ts:1085`) to log
zdarzeń **biznesowych** (`client_created`, `offer_sent`, `invoice_paid` —
pełna lista `lib/clients.ts:108-128`), a nie zmian pól; leady nie mają nawet
tego. PATCH-e (`api/clients/[id]/route.ts:120-153`) aktualizują tylko
`updated_at`. **Trzecia zakładka = nowa tabela + hook w każdym PATCH-u.**

**2. Zgłoszenie właściciela było odwrotne do stanu faktycznego.** Lista
klientów (`clients/TableView.tsx`) pozwala dziś edytować **7 pól** inline:
`nazwa` (:124), `branza` (:140), `telefon` (:143), `email` (:146), `status`
(:150), `ostatni_kontakt` (:162), `notatki` (:168). To **leady** są tylko
spisem (`leads/TableView.tsx:194` — sam status), z uzasadnieniem w komentarzu
:20-28.

**Decyzja właściciela 2026-07-16: lista = tylko spis, WSZĘDZIE.** Z tabeli
klientów usuwamy edycję inline; zostaje **status** (główna akcja robocza dnia)
+ drag&drop w Kanbanie. Dane zmienia się wyłącznie w profilu.

## Sekcje profilu dziś (podstawa podziału na zakładki)

`ClientDetailPanel.tsx` (701 linii):
1. nagłówek `nazwa` + usuń (257-267) · 2. `StatusTag` + hint (269-272) ·
3. `ContactQuickActions` (274-276) · 4. siatka danych: NIP, branża, telefon,
email, WWW, LinkedIn, adres, kraj, ostatni kontakt, przypomnienie, następny
krok (278-320) · 5. notatka przypięta (322-325) · 6. **Powiązane** —
oferty/faktury/projekty (328-370) · 7. **Korespondencja** (372-396) ·
8. **Pełna historia** — formularz (404-530), filtry (532-547), oś czasu
(549-616) → **220 linii** · 9. `ProcessMap` (619-622)

`LeadDetailPanel.tsx` (603 linie): jak wyżej, bez NIP/Powiązanych/
Korespondencji; ma źródło (`PillPicker`) + promote/NDA (253-277).
**Log aktywności** (343-524) → **182 linie**.

Oba mają **identyczny ~130-linijkowy formularz wpisu** — kandydat na wspólny
komponent przy okazji.

## Proponowany podział na zakładki

- **Wizytówka** — sekcje 1-5 (+ „Powiązane" u klienta) + `ProcessMap`
- **Historia kontaktu** — „Pełna historia"/„Log aktywności" + Korespondencja
- **Logi zmian** — NOWE, patrz niżej

**Zakładki implementuj WEWNĄTRZ `*DetailPanel.tsx`**, nie w wrapperach —
wtedy działają automatycznie i w modalu, i na podstronie `[id]`. Ten sam
komponent renderuje oba tryby, sterowany propem `onClose`
(`ClientDetailPanel.tsx:636` — `PanelHeader` zwraca `null` bez `onClose`).

Użyj `ViewTabs` z `app/[lang]/admin/ViewTabs.tsx` (Moduł 21) — jest już
wspólny i ma przejeżdżające podkreślenie. Uwaga: `layoutId` jest tam stały
(`"view-tab-underline"`), a profil może być otwarty nad listą z własnymi
zakładkami — sprawdź, czy nie trzeba sparametryzować `layoutId`.

## Audyt zmian — nowa tabela

Minimum: `id`, `entity` (`client`/`lead`/...), `entity_id`, `field`,
`old_value`, `new_value`, `created_at`. Hook w PATCH-ach
(`api/clients/[id]/route.ts:120-153`, `api/leads/[id]/route.ts`).
Migracja: `CREATE TABLE IF NOT EXISTS` w `lib/db.ts` + bramka migracji
(`schemaUpToDate()`/`markSchemaApplied()` — patrz `HUB_SETUP.md`).

**Do rozstrzygnięcia z właścicielem:** czy audyt ma objąć wszystkie moduły
(faktury, oferty, projekty), czy na start tylko klientów i leadów. Panel jest
jednoosobowy, więc „kto" jest zawsze ten sam — wartość jest w „kiedy i z czego
na co", nie w rozliczaniu użytkowników.

## Zależności

Najlepiej PO Module 22 (powiązania) — 22 dotyka `LeadDetailPanel.tsx` i
`ClientDetailPanel.tsx` (picker klienta dla leada), więc robienie obu naraz
w różnych czatach = konflikty.

## Weryfikacja

1. `npx tsc --noEmit -p tsconfig.json` po każdej paczce.
2. Zakładki sprawdzone w OBU trybach: modal (z listy) i podstrona `[id]`
   (bezpośredni link) — to ten sam komponent, ale różne ścieżki.
3. Zrzuty przed/po (właściciel ocenia wizualnie).
4. Zaktualizuj `HUB_SETUP.md` i odhacz w `README.md`.
