# Moduł 4c — Podpis mailowy: symetria, gradient marki, wzorce topowych firm

> Przeczytaj najpierw `CLAUDE.md` i `HUB_SETUP.md` → „Moduł 4 — trzecia tura"
> (dlaczego podpis jest HTML-em, a nie PNG-iem — tego NIE cofamy).
> Mały/średni, głównie wizualny. Wymaga oglądania efektu, nie tylko kodu.

## Skąd to się wzięło

Podpis PL/EN/DE zbudowany 2026-07-15 (`lib/mailSignature.ts`) działa, ale
właściciel obejrzał go **w prawdziwym Outlooku** i zgłosił trzy rzeczy. Zrzut
w historii czatu; poniżej jego uwagi 1:1.

## Do poprawy (konkretnie)

### 1. Symetria lewej kolumny
> „lewa sekcja ze zdjęciem i logo brandu jest niesymetrycznie umieszczona
> względem prawej strony informacyjnej, zrób tak żeby to nie kuło w oczy"

Dziś: lewa komórka (zdjęcie 88px + logo pod nim) i prawa (imię, rola, 4
wiersze kontaktu) są wyrównane do góry, a pionowa kreska (`border-left`) ma
wysokość prawej komórki. Efekt: bloki „nie siedzą" względem siebie.
Do przemyślenia: wyśrodkowanie pionowe lewej kolumny, wyrównanie kreski do
pełnej wysokości, albo zrównanie wysokości obu kolumn.
⚠️ Sprawdzaj efekt wzrokowo — patrz „Jak podejrzeć" niżej.

### 2. Gradient marki zamiast płaskiego fioletu
> „same kolory (kreska pod założyciel i baner) są fioletowe a nie gradient
> purpurowo złoty, to jest do poprawy"

Ma rację — kanon to `.text-liquid` w `app/globals.css`:
`linear-gradient(120deg, #a78bfa 0%, #e0a93b 60%, #fff7e8 100%)`
(fiolet → złoto → krem). Podpis używa płaskiego `#7C3AED`. Off-brand.

**Techniczna pułapka, którą trzeba znać:** Outlook na Windows renderuje HTML
silnikiem Worda i **nie obsługuje gradientów CSS**. Standardowe wyjścia:
- **VML** (`<v:rect>` + `<v:fill type="gradient">`) w warunkowym komentarzu
  `<!--[if mso]>` — Outlook widzi VML, reszta klientów CSS-owy
  `background-image: linear-gradient(...)`, a `bgcolor` zostaje jako ostatnia
  deska ratunku. To tzw. „bulletproof background".
- Gradient jako obrazek — **ODRADZANE**: cała decyzja o banerze-HTML-u wzięła
  się stąd, że baner niesie CTA i nie może zniknąć przy zablokowanych
  obrazkach (patrz HUB_SETUP). VML/CSS działa BEZ obrazków, więc nie psuje tej
  gwarancji.

Kreska pod „Założyciel": ten sam trik (element 2px z gradientem + `bgcolor`).

### 3. Research: wzorce stopek topowych firm
> „przy okazji jak już to robimy weź na tapet najlepsze wzorce stopek topowych
> firm i porównaj je z nimi, czy czegoś tu brakuje albo można coś poprawić?"

Zbadaj i **porównaj z naszym podpisem**, co mamy, czego brak, co zbędne:
- Jak robią to firmy stawiające na markę (Apple, Stripe, Linear, Notion,
  Figma, Superhuman/Grammarly, agencje kreatywne) — struktura, hierarchia,
  ile informacji, czy zdjęcie, czy baner CTA.
- Standardy techniczne: szerokość, wysokość, waga maila, `Content-ID` vs
  linkowane obrazki, tryb ciemny (nasz podpis ma jasne tło — sprawdź, jak
  wygląda w ciemnym Outlooku/Apple Mail; to realne ryzyko), dostępność
  (kontrast, alt), zachowanie na telefonie (nasze `max-width:560px`).
- Czy `--` przed podpisem tekstowym (RFC 3676 signature delimiter) jest
  zaletą, czy problemem (część klientów zwija wszystko poniżej).
- Prawne: czy JDG w PL ma obowiązek podawać dane w stopce mailowej (dziś
  klauzula poufności jest, danych rejestrowych nie ma — firma NIE jest jeszcze
  zarejestrowana, patrz `PO_REJESTRACJI.md`; po rejestracji może być
  konieczne dopisanie NIP-u/adresu).
- Ryzyko: **czy zdjęcie i baner nie zwiększają szansy na spam** (stosunek
  obrazków do tekstu).

Wynik: krótka lista „dodać / zmienić / wyrzucić" + rekomendacja, którą
zatwierdza właściciel PRZED wdrożeniem.

## Czego NIE zmieniać (świadome decyzje, nie niedoróbki)
- **Podpis jest HTML-em, nie obrazkiem.** Gotowe `stopka_mailowa_*.png`
  zostały usunięte celowo (blokada obrazków u odbiorcy, brak klikalności,
  gorsza ocena antyspamowa).
- **Baner jest HTML-em, nie PNG-iem** — niesie CTA, musi renderować się zawsze.
  (`sygnatura_baner_*.png` leżą w repo, ale są NIEUŻYWANE.)
- **Adres wszędzie `kontakt@leggeralabs.pl`** (decyzja właściciela).
- **Przełącznik języka ręczny** (PL domyślnie), nie automat po kraju klienta.
- **Tabele + style inline** — bo Outlook. To nie zaniedbanie.
- **Obrazki jako `cid:`**, pobierane po HTTP z `siteUrl` (pliki z `public/` nie
  trafiają do funkcji serverless na Vercelu).
- **Zawsze multipart text+HTML.**

## Jak podejrzeć efekt (bez wysyłania maila)
Dev-serwer + tymczasowy plik w `public/`:
```ts
// gen-sig.mts w katalogu projektu, potem: npx tsx gen-sig.mts && rm gen-sig.mts
import { signatureHtml, SIGNATURE_IMAGES } from "./lib/mailSignature";
import { writeFileSync, readFileSync } from "node:fs";
let pages = "";
for (const lang of ["pl","en","de"] as const) {
  let html = signatureHtml(lang, "https://cal.com/leggeralabs/audyt");
  for (const img of SIGNATURE_IMAGES) {
    const b64 = readFileSync("public" + img.url).toString("base64");
    html = html.replaceAll(`cid:${img.cid}`, `data:image/png;base64,${b64}`);
  }
  pages += `<h3>${lang}</h3>${html}`;
}
writeFileSync("public/_sig-preview.html", `<!doctype html><meta charset="utf-8"><body style="background:#fff;padding:20px">${pages}</body>`);
```
→ `http://localhost:3000/_sig-preview.html`. **Pamiętaj usunąć plik po sesji.**
⚠️ To podgląd w przeglądarce, nie w Outlooku — ostateczny test robi właściciel,
wysyłając maila do siebie. VML-a NIE zobaczysz w Chrome w ogóle.

## Definicja ukończenia
- Symetria poprawiona, obejrzana w podglądzie.
- Gradient marki (fiolet→złoto) na kresce i banerze, działający BEZ obrazków,
  z `bgcolor` jako fallbackiem; VML dla Outlooka.
- Raport z researchu + zatwierdzone przez właściciela zmiany wdrożone.
- `npx tsc --noEmit`, podgląd usunięty, `HUB_SETUP.md` zaktualizowany.
- Właściciel testuje na żywo (mail do siebie, Outlook) — to jedyny prawdziwy
  test.
