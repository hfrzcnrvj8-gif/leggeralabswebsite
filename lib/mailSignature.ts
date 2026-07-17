// Moduł 4 — podpisy mailowe PL/EN/DE (właściciel poprosił 2026-07-15).
//
// DLACZEGO HTML, A NIE GOTOWY PNG. W repo leżały `stopka_mailowa_{PL,EN,DE}.png`
// — cały podpis jako jeden obrazek. Wygląda ładnie i jest bezużyteczny:
//  1. większość klientów blokuje domyślnie obrazki → u odbiorcy pusta ramka
//     (dokładnie tę blokadę sami włączyliśmy w lib/mailHtml.ts),
//  2. telefon/mail/LinkedIn to piksele — nie da się kliknąć ani skopiować,
//  3. mail będący głównie obrazkiem dostaje gorszą ocenę antyspamową,
//  4. brak dostępności (czytniki ekranu nie odczytają obrazka).
// Dlatego dane kontaktowe są PRAWDZIWYM tekstem z linkami, a obrazki (zdjęcie,
// logo, ikony) są tylko ozdobą — podpis czyta się w całości nawet, gdy się nie
// wczytają.
//
// DLACZEGO TABELE I STYLE INLINE. Outlook na Windows renderuje HTML silnikiem
// Worda: flexbox/grid/klasy CSS nie działają, marginesy są ignorowane. Układ
// na `<table>` + `style="..."` przy każdym elemencie to nie zaniedbanie, tylko
// jedyny sposób, żeby podpis wyglądał tak samo wszędzie.
//
// DLACZEGO BANER JEST HTML-em, A NIE OBRAZKIEM. W repo są gotowe
// `sygnatura_baner_{PL,EN,DE}.png`. Odtworzyłem je jako HTML (to samo hasło,
// te same kolory marki), bo baner-obrazek znika przy zablokowanych obrazkach —
// a to właśnie on niesie CTA, czyli jedyny element podpisu, który ma coś
// sprzedać. Kolorowy prostokąt z tekstem renderuje się ZAWSZE.
//
// Obrazki wysyłamy jako załączniki `cid:` (osadzone w wiadomości), NIE jako
// zdalne `https://` — te drugie są blokowane jak każdy tracking pixel.
import type { Locale } from "@/i18n/config";

/** Dane właściciela w podpisie. Świadomie stałe w kodzie, nie w
 * `company_settings`: to zasób marki (jak logo), a nie ustawienie do zmiany co
 * tydzień. Adres jest jeden — `kontakt@leggeralabs.pl` (decyzja właściciela
 * 2026-07-15; PNG-i miały nieaktualne `kontakt@patrykpiecyk.pl`). */
export const SIGNATURE_IDENTITY = {
  imie: "Patryk Piecyk",
  email: "kontakt@leggeralabs.pl",
  telefon: "+48 515 272 593",
  telefonHref: "+48515272593",
  www: "leggeralabs.pl",
  wwwHref: "https://leggeralabs.pl",
  linkedin: "linkedin.com/in/patrykpiecyk",
  linkedinHref: "https://www.linkedin.com/in/patrykpiecyk",
  firma: "Leggera Labs",
} as const;

/** Paleta marki — te same wartości co `brand.*` w tailwind.config.ts. W mailu
 * nie ma zmiennych CSS ani Tailwinda, więc muszą być wpisane wprost.
 * `purpleLight`/`gold` to dokładnie stopy gradientu `.text-liquid`
 * (`app/globals.css`) — kanon marki, patrz `gradientBar`/`bannerHtml`. */
const BRAND = {
  purple: "#7C3AED",
  purpleLight: "#A78BFA",
  gold: "#E0A93B",
  ink: "#141414",
  inkSoft: "#4A4A4A",
  hairline: "#E6E3DD",
  bannerBg: "#1B1033",
} as const;

/**
 * Poziomy pasek w gradiencie marki (fiolet→złoto), tzw. "bulletproof
 * background": Outlook na Windows (silnik Worda) NIE obsługuje
 * `background-image` z CSS, więc dostaje osobno VML (`v:rect` +
 * `v:fill type="gradient"`) w komentarzu warunkowym `<!--[if mso]>`, a
 * wszystkie inne klienty — zwykłą komórkę tabeli z `background-image` i
 * `bgcolor` jako ostatnią deską ratunku. Bez obrazków — nie psuje
 * gwarancji "podpis czyta się bez wczytanych obrazków".
 * Renderuje się TYLKO w Outlooku na Windows/prawdziwym mailu — Chrome nie
 * interpretuje VML w ogóle, patrz „Jak podejrzeć efekt" w
 * `docs/plany-modulow/04c-podpis-mailowy.md`.
 */
function gradientBar(widthPx: number, heightPx: number): string {
  return `<!--[if mso]>
<v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:${widthPx}px;height:${heightPx}px;">
<v:fill type="gradient" color="${BRAND.purpleLight}" color2="${BRAND.gold}" angle="0" />
</v:rect>
<![endif]-->
<!--[if !mso]><!-->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
  <tr><td width="${widthPx}" height="${heightPx}" bgcolor="${BRAND.purple}" style="background-color:${BRAND.purple};background-image:linear-gradient(120deg, ${BRAND.purpleLight} 0%, ${BRAND.gold} 100%);font-size:1px;line-height:1px;">&nbsp;</td></tr>
</table>
<!--<![endif]-->`;
}

type SignatureCopy = {
  rola: string;
  bannerTytul: string;
  bannerAkcent: string;
  bannerTagline: string;
  bannerCta: string;
  poufnosc: string;
  altZdjecie: string;
  altLogo: string;
};

/** Teksty 1:1 z kanonem marki (i18n/dictionaries/*.json → footer.tagline,
 * cta.bookingCta) plus hasło z oryginalnego banera. Nie wymyślam nowych — mają
 * brzmieć tak samo jak strona. */
const COPY: Record<Locale, SignatureCopy> = {
  pl: {
    rola: "Założyciel",
    bannerTytul: "Odzyskaj swoje dane.",
    bannerAkcent: "Przyspiesz swój biznes.",
    bannerTagline: "Bez chmury. Bez kompromisów.",
    bannerCta: "Umów bezpłatny audyt →",
    poufnosc:
      "Wiadomość i jej załączniki mogą zawierać informacje poufne przeznaczone wyłącznie dla adresata. Jeśli otrzymałeś ją omyłkowo, poinformuj nadawcę i usuń wiadomość.",
    altZdjecie: "Patryk Piecyk",
    altLogo: "Leggera Labs",
  },
  en: {
    rola: "Founder",
    bannerTytul: "Take back your data.",
    bannerAkcent: "Accelerate your business.",
    bannerTagline: "No cloud. No compromise.",
    bannerCta: "Book a free audit →",
    poufnosc:
      "This message and its attachments may contain confidential information intended solely for the addressee. If you received it by mistake, please notify the sender and delete it.",
    altZdjecie: "Patryk Piecyk",
    altLogo: "Leggera Labs",
  },
  de: {
    rola: "Gründer",
    bannerTytul: "Holen Sie sich Ihre Daten zurück.",
    bannerAkcent: "Beschleunigen Sie Ihr Geschäft.",
    bannerTagline: "Keine Cloud. Keine Kompromisse.",
    bannerCta: "Kostenlosen Check buchen →",
    poufnosc:
      "Diese Nachricht und ihre Anhänge können vertrauliche Informationen enthalten, die ausschließlich für den Adressaten bestimmt sind. Sollten Sie sie versehentlich erhalten haben, benachrichtigen Sie bitte den Absender und löschen Sie sie.",
    altZdjecie: "Patryk Piecyk",
    altLogo: "Leggera Labs",
  },
};

export const SIGNATURE_LANGS: Locale[] = ["pl", "en", "de"];

export const SIGNATURE_LANG_LABEL: Record<Locale, string> = {
  pl: "Polski",
  en: "English",
  de: "Deutsch",
};

/** Obrazki osadzane w wiadomości. `cid` musi być unikalny w obrębie maila.
 *
 * `url` jest ścieżką publiczną, a nie ścieżką na dysku, bo pliki z `public/`
 * NIE trafiają do funkcji serverless na Vercelu — próba czytania ich przez
 * `fs` działałaby lokalnie i wywaliła się na produkcji. Pobieramy je więc z
 * własnej domeny (patrz fetchSignatureImages w lib/mailbox.ts), a gdy się nie
 * uda — mail i tak leci, tylko bez ozdób. Dane kontaktowe są tekstem, więc
 * podpis pozostaje kompletny. */
export const SIGNATURE_IMAGES = [
  { cid: "sig-photo@leggeralabs", url: "/assets/signature/sygnatura_zdjecie_kolo.png", filename: "patryk-piecyk.png" },
  { cid: "sig-logo@leggeralabs", url: "/assets/signature/sygnatura_logo.png", filename: "leggera-labs.png" },
] as const;

/** Jeden wiersz kontaktu: ikona-emoji + etykieta z linkiem.
 *
 * Świadomie emoji zamiast leżących obok plików `icon_{phone,mail,globe,
 * linkedin}.png`: to cztery załączniki mniej w każdym mailu, a przy
 * zablokowanych obrazkach emoji nadal widać — PNG-a nie.
 *
 * NIE zamieniaj tego na ikony Tablera „dla spójności z panelem": od Modułu 33
 * panel jest na ikonach, ale to jest HTML maila — komponentu Reacta tu nie
 * wyrenderujesz, a ikona jako obrazek wraca do problemu blokowanych obrazków.
 * Wyjątek „w panelu ikony, w mailach emoji" jest świadomy i trwały —
 * patrz CLAUDE.md → „Emoji vs ikony".
 *
 * Znaki dobrane pod dawne CONTACT_CHANNEL_ICON z lib/contact.ts; ta mapa jest
 * już komponentem (`ContactChannelIcon`), więc podpis i oś kontaktu świadomie
 * przestały być identyczne — ten plik jest teraz jedynym źródłem swoich emoji. */
function row(icon: string, href: string, label: string): string {
  return `<tr>
  <td style="padding:2px 8px 2px 0;font-size:13px;line-height:20px;vertical-align:middle;">${icon}</td>
  <td style="padding:2px 0;font-size:13px;line-height:20px;vertical-align:middle;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <a href="${href}" style="color:${BRAND.ink};text-decoration:none;">${label}</a>
  </td>
</tr>`;
}

/** Zawartość banera CTA — ta sama dla wersji VML (Outlook) i CSS (reszta
 * klientów), patrz `bannerHtml`. */
function bannerContentRows(t: SignatureCopy): string {
  return `<tr>
    <td style="padding:16px 18px;">
      <div style="font-size:10px;letter-spacing:1.4px;font-weight:700;color:#B79CF7;padding-bottom:8px;">LEGGERA LABS.</div>
      <div style="font-size:17px;line-height:23px;font-weight:700;color:#FFFFFE;">${t.bannerTytul}</div>
      <div style="font-size:17px;line-height:23px;font-weight:700;color:#B79CF7;">${t.bannerAkcent}</div>
      <div style="font-size:12px;line-height:18px;color:#C9C4D4;padding-top:8px;">${t.bannerTagline}</div>
    </td>
    <td style="padding:16px 18px;text-align:right;vertical-align:bottom;white-space:nowrap;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;display:inline-block;">
        <tr><td bgcolor="#FFFFFE" style="background-color:#FFFFFE;border-radius:20px;padding:8px 14px;font-size:12px;font-weight:700;color:${BRAND.ink};white-space:nowrap;">${t.bannerCta}</td></tr>
      </table>
    </td>
  </tr>`;
}

/**
 * Baner CTA w gradiencie marki (fiolet→złoto), ten sam "bulletproof
 * background" trik co `gradientBar`: Outlook widzi VML (`v:roundrect` +
 * `v:fill type="gradient"`) z treścią zdublowaną w `v:textbox`, reszta
 * klientów CSS `background-image` + `bgcolor` jako fallback. Treść
 * zdublowana raz w każdej gałęzi to jedyny sposób, żeby Outlook nie
 * renderował obu wersji naraz (dlatego gałąź CSS jest owinięta w
 * `<!--[if !mso]><!-->` — bez tego mso widziałoby też płaską tabelę pod
 * VML-em).
 * Świadomie NIE dokładny kanon `.text-liquid` (który na 100% dochodzi do
 * prawie białego kremu) — na pełnowymiarowym tle banera to psuje kontrast
 * nakładanego tekstu (nagłówek, tagline). Gradient trzyma się tu ciemnych
 * odcieni (`bannerBg` → `purple` → `gold`, bez jasnego kremowego stopu), a
 * CTA dostał własną białą "pigułkę" z ciemnym tekstem, więc jest czytelne
 * niezależnie od tego, w którym miejscu gradientu wypadnie.
 * Szerokość/wysokość w `v:roundrect` to najlepsze przybliżenie (560×110px,
 * zgodnie z `max-width:560px` podpisu) — VML nie mierzy się do treści jak
 * HTML, więc przy dłuższych tłumaczeniach baner w Outlooku może mieć odrobinę
 * inny odstęp. Nie do zweryfikowania w Chrome (patrz „Jak podejrzeć efekt" w
 * `docs/plany-modulow/04c-podpis-mailowy.md`) — ostateczny test w prawdziwym
 * Outlooku robi właściciel.
 */
function bannerHtml(t: SignatureCopy): string {
  const rows = bannerContentRows(t);
  const stops = `0% ${BRAND.bannerBg}, 55% ${BRAND.purple}, 100% ${BRAND.gold}`;
  return `<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" arcsize="9%" fill="true" stroke="false" style="width:560px;height:110px;">
<v:fill type="gradient" color="${BRAND.bannerBg}" color2="${BRAND.gold}" colors="${stops}" angle="90" />
<v:textbox inset="0,0,0,0">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
${rows}
</table>
</v:textbox>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${BRAND.bannerBg}" style="border-collapse:collapse;background-color:${BRAND.bannerBg};background-image:linear-gradient(100deg, ${BRAND.bannerBg} 0%, ${BRAND.purple} 55%, ${BRAND.gold} 100%);border-radius:10px;">
${rows}
</table>
<!--<![endif]-->`;
}

/**
 * Zwraca podpis jako HTML gotowy do wklejenia na koniec wiadomości.
 *
 * `bookingUrl` wstrzykiwany, a nie importowany z lib/site.ts, żeby ten plik dał
 * się przetestować bez env i żeby wołający jawnie decydował, dokąd prowadzi CTA.
 *
 * Tło całej tabeli (`SAFE_LIGHT`, prawie-biały #FFFFFE) jest świadomym
 * fallbackiem na dark mode: bez jawnego tła podpis dziedziczyłby tło maila, a
 * Outlook/Apple Mail w trybie ciemnym potrafią same odwrócić kolory jasnego
 * bloku HTML (czarny tekst → biały na czarnym), co przy naszej stałej palecie
 * marki wygląda losowo. Jawne jasne tło + prawie-biały zamiast czystego
 * #FFFFFF (klienci czasem "naprawiają" czysty czarno-biały kontrast inaczej
 * niż odcienie o 1 punkt od skrajności) trzyma wygląd przewidywalnym
 * niezależnie od trybu klienta. To samo dlatego logo (transparentne tło PNG)
 * dostaje jasną "podkładkę" pod spodem — inaczej na czarnym tle maila w dark
 * mode mogłoby zlać się z tłem.
 */
export function signatureHtml(lang: Locale, bookingUrl: string): string {
  const t = COPY[lang] ?? COPY.pl;
  const id = SIGNATURE_IDENTITY;
  const [photo, logo] = SIGNATURE_IMAGES;
  const SAFE_LIGHT = "#FFFFFE";

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${SAFE_LIGHT}" style="border-collapse:collapse;max-width:560px;background-color:${SAFE_LIGHT};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${BRAND.ink};">
  <tr>
    <td style="padding:0 20px 0 0;vertical-align:middle;" width="252">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
        <tr>
          <td style="vertical-align:middle;padding:0 14px 0 0;">
            <img src="cid:${photo.cid}" alt="${t.altZdjecie}" width="88" height="88" style="display:block;width:88px;height:88px;border:0;outline:none;" />
          </td>
          <td style="vertical-align:middle;background-color:${SAFE_LIGHT};border-radius:6px;padding:6px 10px;">
            <img src="cid:${logo.cid}" alt="${t.altLogo}" width="130" style="display:block;width:130px;height:auto;border:0;outline:none;" />
          </td>
        </tr>
      </table>
    </td>
    <td style="padding:0 0 0 20px;vertical-align:middle;border-left:1px solid ${BRAND.hairline};">
      <div style="font-size:19px;line-height:26px;font-weight:700;color:${BRAND.ink};">${id.imie}</div>
      <div style="font-size:13px;line-height:20px;color:${BRAND.inkSoft};padding-bottom:6px;">
        ${t.rola}&nbsp;·&nbsp;${id.firma}
      </div>
      <div style="padding-bottom:8px;">${gradientBar(40, 3)}</div>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
        ${row("📞", `tel:${id.telefonHref}`, id.telefon)}
        ${row("✉️", `mailto:${id.email}`, id.email)}
        ${row("🌐", id.wwwHref, id.www)}
        ${row("🔗", id.linkedinHref, id.linkedin)}
      </table>
    </td>
  </tr>
  <tr>
    <td colspan="2" style="padding:18px 0 0 0;">
      <a href="${bookingUrl}" style="text-decoration:none;color:#FFFFFE;">${bannerHtml(t)}</a>
    </td>
  </tr>
  <tr>
    <td colspan="2" style="padding:12px 0 0 0;font-size:10px;line-height:15px;color:#8A8A8A;">
      ${t.poufnosc}
    </td>
  </tr>
</table>`;
}

/** Wersja tekstowa podpisu — do części `text/plain` maila.
 * Nie jest opcjonalna: mail bez `text/plain` dostaje wyższą punktację
 * spamową, a klienty tekstowe (i część czytników) pokazałyby goły kod HTML. */
export function signatureText(lang: Locale, bookingUrl: string): string {
  const t = COPY[lang] ?? COPY.pl;
  const id = SIGNATURE_IDENTITY;
  return [
    "--",
    `${id.imie} — ${t.rola}, ${id.firma}`,
    `tel: ${id.telefon}`,
    `e-mail: ${id.email}`,
    id.wwwHref,
    id.linkedinHref,
    "",
    `${t.bannerTagline} ${t.bannerCta.replace(" →", "")}: ${bookingUrl}`,
  ].join("\n");
}
