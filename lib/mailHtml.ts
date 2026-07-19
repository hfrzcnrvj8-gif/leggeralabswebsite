// Moduł 4 (druga tura 2026-07-15) — bezpieczne pokazanie HTML-a maila.
//
// PROBLEM: treść maila to kod od OBCEJ osoby. Wrzucony wprost do panelu
// (dangerouslySetInnerHTML) mógłby wykonać skrypt na tej samej domenie, na
// której właściciel jest zalogowany — czyli wykraść ciasteczko sesji i dostać
// pełny dostęp do panelu. Wystarczyłby jeden spreparowany mail od kogokolwiek.
//
// OBRONA W DWÓCH NIEZALEŻNYCH WARSTWACH (jedna może zawieść, obie naraz — nie):
//  1. TU: odkażanie — wycinamy skrypty, zdarzenia (onclick=...), <iframe>,
//     <form>, style z `expression()`, linki `javascript:`.
//  2. W UI (MailBodyHtml.tsx): wynik ląduje w <iframe sandbox> BEZ
//     allow-scripts i BEZ allow-same-origin, czyli nawet gdyby coś się tu
//     prześlizgnęło, nie ma jak się wykonać ani sięgnąć do sesji panelu.
//
// Server-only (sanitize-html potrzebuje Node'a) — wołane w GET /api/mail/[id].
import sanitizeHtml from "sanitize-html";

/** Przezroczysty 1x1 GIF — podmieniamy nim zdalne obrazki, żeby układ maila
 * się nie rozjechał, dopóki właściciel ich nie wczyta. */
const BLANK_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

export type SanitizedMailHtml = {
  html: string;
  /** Czy wycięliśmy jakieś zdalne obrazki — UI pokazuje wtedy "Pokaż obrazki". */
  blockedImages: boolean;
};

/**
 * Odkaża HTML maila i (domyślnie) blokuje zdalne obrazki.
 *
 * Blokada obrazków to nie paranoja: zdalny obrazek w mailu to klasyczny
 * "tracking pixel" — samo otwarcie wiadomości zdradza nadawcy, że i kiedy ją
 * przeczytałeś (i Twój adres IP). Dlatego domyślnie NIE ładujemy, a właściciel
 * decyduje kliknięciem — tak samo jak robi Outlook i Gmail.
 */
export function sanitizeMailHtml(rawHtml: string, allowImages = false): SanitizedMailHtml {
  if (!rawHtml || !rawHtml.trim()) return { html: "", blockedImages: false };

  let blockedImages = false;

  const clean = sanitizeHtml(rawHtml, {
    allowedTags: [
      "p", "div", "span", "br", "hr",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "strong", "b", "em", "i", "u", "s", "sub", "sup", "small",
      "ul", "ol", "li", "dl", "dt", "dd",
      "blockquote", "pre", "code",
      "a", "img",
      // Maile marketingowe (jak ten z LinkedIna) są w całości zbudowane na
      // tabelach — bez nich układ rozsypuje się w pionową kolumnę.
      "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "colgroup", "col",
      "center", "font",
    ],
    // Świadomie BEZ: script, style, iframe, object, embed, form, input,
    // link, meta, base — to wektory wykonania kodu albo wycieku danych.
    allowedAttributes: {
      a: ["href", "name", "target", "title"],
      img: ["src", "alt", "title", "width", "height", "style"],
      td: ["colspan", "rowspan", "align", "valign", "width", "height", "bgcolor", "style"],
      th: ["colspan", "rowspan", "align", "valign", "width", "height", "bgcolor", "style"],
      tr: ["align", "valign", "bgcolor", "style"],
      table: ["width", "align", "border", "cellpadding", "cellspacing", "bgcolor", "style"],
      col: ["width", "span", "style"],
      font: ["color", "face", "size"],
      "*": ["style", "align", "dir", "lang"],
    },
    // Tylko bezpieczne schematy — odcina `javascript:` i `data:` w linkach.
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    // Dodatkowa siatka na style inline: bez `expression()`, `url(javascript:)`,
    // `position:fixed` (mail nie ma prawa nakładać się na panel).
    allowedStyles: {
      "*": {
        color: [/^[^;{}()]*$/],
        "background-color": [/^[^;{}()]*$/],
        "text-align": [/^(left|right|center|justify)$/],
        "font-size": [/^[\d.]+(px|pt|em|rem|%)$/],
        "font-weight": [/^(normal|bold|bolder|lighter|[1-9]00)$/],
        "font-family": [/^[^;{}()]*$/],
        "font-style": [/^(normal|italic|oblique)$/],
        "text-decoration": [/^[^;{}()]*$/],
        padding: [/^[\d.]+(px|pt|em|rem|%)?( [\d.]+(px|pt|em|rem|%)?){0,3}$/],
        margin: [/^[\d.]+(px|pt|em|rem|%)?( [\d.]+(px|pt|em|rem|%)?){0,3}$/],
        width: [/^[\d.]+(px|pt|em|rem|%)$/],
        "max-width": [/^[\d.]+(px|pt|em|rem|%)$/],
        height: [/^[\d.]+(px|pt|em|rem|%)$/],
        // UKRYWANIE — musi przejść, inaczej psujemy maile zamiast je czyścić.
        // Newslettery chowają tak „preheader": tekst podglądu dla skrzynki
        // odbiorczej, zapisany na początku <body> i schowany przez
        // `display:none` albo `max-height:0;overflow:hidden;opacity:0`.
        // Gdy te reguły wylecą, ukryty tekst ROBI SIĘ WIDOCZNY i wygląda jak
        // wyciek śmieci na górze wiadomości (zgłoszenie właściciela 2026-07-19:
        // duchy liter obok treści). Żadna z nich nie pozwala wykonać kodu —
        // `position` świadomie zostaje poza listą, bo mail nie ma prawa
        // nakładać się na panel.
        display: [/^(none|block|inline|inline-block|inline-table|table|table-row|table-cell|list-item|flex|inline-flex)$/],
        visibility: [/^(visible|hidden|collapse)$/],
        opacity: [/^[\d.]+$/],
        overflow: [/^(visible|hidden|auto|scroll)$/],
        // Jednostka opcjonalna: preheadery pisze się jako `max-height:0`,
        // a samo zero bez jednostki odpadłoby na wzorcu wymagającym `px`.
        "max-height": [/^[\d.]+(px|pt|em|rem|%)?$/],
        "line-height": [/^[\d.]+(px|pt|em|rem|%)?$/],
        border: [/^[^;{}()]*$/],
        "border-radius": [/^[\d.]+(px|pt|em|rem|%)$/],
      },
    },
    transformTags: {
      // Każdy link otwiera się w nowej karcie i bez `window.opener` — bez
      // `noopener` strona docelowa mogłaby przejąć kartę panelu.
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" },
      }),
      img: (tagName, attribs) => {
        const src = attribs.src || "";
        // `data:` obrazki są osadzone w mailu (nie śledzą) — te zostawiamy.
        const isRemote = /^https?:/i.test(src);
        if (isRemote && !allowImages) {
          blockedImages = true;
          return { tagName, attribs: { ...attribs, src: BLANK_PIXEL, "data-blocked": "1", alt: attribs.alt || "" } };
        }
        return { tagName, attribs };
      },
    },
    // Treść wyciętych tagów też ma zniknąć (inaczej zobaczylibyśmy goły kod
    // CSS/JS jako tekst).
    nonTextTags: ["style", "script", "textarea", "option", "noscript", "head", "title"],
  });

  return { html: clean, blockedImages };
}

/** Kompletny dokument do <iframe srcdoc> — z własnym resetem stylów i
 * `<base target="_blank">`, żeby klik w link nie próbował podmienić ramki
 * (w sandboxie i tak by się nie udało, ale wtedy klik byłby po prostu głuchy).
 * CSP w środku ramki to trzecia warstwa: nawet gdyby jakiś skrypt przetrwał
 * odkażanie, `script-src 'none'` go nie uruchomi. */
export function buildMailSrcDoc(cleanHtml: string, dark: boolean): string {
  const fg = dark ? "#e6e6e6" : "#1a1a1a";
  const bg = dark ? "#141414" : "#ffffff";
  const link = dark ? "#8ab4f8" : "#1a56db";
  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src http: https: data:; style-src 'unsafe-inline'; font-src data:;">
<base target="_blank">
<style>
  /* CSS jest CELOWO minimalny — i to jest zmiana podejścia (2026-07-19).
     Wcześniej były tu reguły zerujące sztywne szerokości (max-width na
     wszystkim, width:auto na tabelach), które ZMUSZAŁY maila do przebudowy
     układu. To odwrotność tego, co robią klienty pocztowe: newsletter jest
     projektem graficznym o zadanej szerokości i przelany na inną szerokość
     rozpada się, nawet gdy nic nie jest ucięte. Apple Mail pokazuje go
     w naturalnych proporcjach i pomniejsza, gdy trzeba.
     Panel ma na treść ~865 px, więc typowy mail (600 px) mieści się bez
     żadnych sztuczek; szerszy dostaje poziomy pasek przewijania w ramce,
     zamiast rozjechanego układu. Skalowanie „jak w Apple Mail" robi apka
     natywna (WidokHTML w WiadomoscView.swift) — tam ekran bywa węższy niż
     mail i bez tego się nie da.
     15 px, nie 13 px: 13 px to rozmiar gęstego UI panelu, ale treść maila
     się CZYTA, a nie skanuje wzrokiem. */
  html,body{margin:0;padding:12px;background:${bg};color:${fg};
    font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}
  a{color:${link};}
  /* Jedyne ograniczenie szerokości, jakie zostaje: pojedynczy obrazek
     o gigantycznych wymiarach rozpychałby ramkę bez potrzeby. Tabel i tekstu
     nie ruszamy — to układ nadawcy. */
  img{max-width:100%;height:auto;}
</style>
</head><body>${cleanHtml}</body></html>`;
}
