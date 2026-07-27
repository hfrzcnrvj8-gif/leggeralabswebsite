"use client";

/**
 * Gradient marki NA DOKUMENCIE — pasek u góry i kwota — rysowany jako SVG.
 *
 * **Po co osobne komponenty zamiast CSS.** Do 2026-07-27 oba elementy stały
 * na TLE: pasek to `background: <gradient>`, a kwota to sztuczka „gradient
 * jako tekst" (`background-clip: text` + `color: transparent`). Silniki
 * wydruku domyślnie **nie malują teł** — traktują je jako dekorację. Efekt
 * zgłoszony przez właściciela: na wydruku i w PDF znikał pasek ORAZ kwota,
 * czyli najważniejsza liczba na kartce. Przeżywało wyłącznie logo — bo to
 * jedyny element narysowany SVG-iem, z prawdziwym `fill`.
 *
 * To jest właśnie wskazówka: **`fill` w SVG to treść, nie tło.** Rysuje się
 * zawsze, niezależnie od ustawienia „grafika tła", w przeglądarce i w apce
 * (iOS renderuje PDF tą samą ścieżką drukowania). Dlatego pasek i kwota
 * przechodzą na SVG — wydruk wygląda wtedy identycznie jak podgląd, z
 * prawdziwym gradientem, a nie z zastępczym jednolitym kolorem.
 *
 * Kwota zostaje przy tym PRAWDZIWYM TEKSTEM (`<text>`, nie obrazek): da się
 * ją zaznaczyć, skopiować i znaleźć wyszukiwarką w PDF.
 */

/** Krańce gradientu marki na dokumencie.
 *
 * **Dobrane pod druk czarno-biały** (wymóg właściciela 2026-07-27). Domyślne
 * złoto marki (`#E0A93B`) po konwersji na szarość wychodzi bardzo jasne —
 * kontrast wobec białej kartki spada do ~2:1, czyli koniec kwoty robi się
 * blady. Ciemniejszy bursztyn `#B4761C` czyta się na ekranie praktycznie tak
 * samo (ta sama rodzina koloru), a w szarości trzyma ~3,7:1, więc cyfry
 * zostają czytelne również na drukarce monochromatycznej.
 *
 * Pasek może zostać na pełnym złocie marki — to dekoracja, nie treść, a jego
 * czytelność nie zależy od kontrastu liter. */
export const DOC_GRAD_OD = "#7C3AED";
export const DOC_GRAD_DO_PASEK = "#E0A93B";
export const DOC_GRAD_DO_TEKST = "#B4761C";

/** Pasek marki u góry dokumentu (3 px, pełna szerokość).
 *
 * `preserveAspectRatio="none"` — prostokąt ma się rozciągnąć na szerokość
 * kartki bez zachowywania proporcji; bez tego SVG skalowałby wysokość razem
 * z szerokością i pasek urósłby do kilkudziesięciu pikseli. */
export function PasekMarkiDokumentu({ id = "pasekMarki", wysokosc = 3 }: { id?: string; wysokosc?: number }) {
  return (
    <svg
      className="block w-full shrink-0"
      style={{ height: wysokosc }}
      viewBox={`0 0 100 ${wysokosc}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={DOC_GRAD_OD} />
          <stop offset="100%" stopColor={DOC_GRAD_DO_PASEK} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height={wysokosc} fill={`url(#${id})`} />
    </svg>
  );
}

/** Kwota dokumentu wypisana gradientem marki.
 *
 * Wyrównana DO PRAWEJ w dostępnej szerokości (`x="100%"`, `text-anchor="end"`)
 * — dokładnie tak, jak zachowywał się poprzedni `<span>` w wierszu
 * `justify-between`. SVG bez `viewBox` liczy współrzędne w pikselach CSS, więc
 * tekst rysuje się w naturalnym rozmiarze i nie skaluje się razem z kontenerem.
 *
 * `fontFamily` świadomie NIE jest podawane — SVG dziedziczy krój po
 * rodzicu, więc kwota ma ten sam font co reszta dokumentu, także po zmianie
 * kroju w jednym miejscu.
 */
export function KwotaGradientem({
  tekst,
  id = "kwotaGradient",
  rozmiar = 15,
  grubosc = 600,
  wysokosc = 20,
}: {
  tekst: string;
  id?: string;
  rozmiar?: number;
  grubosc?: number;
  wysokosc?: number;
}) {
  return (
    <svg className="block h-[20px] flex-1" height={wysokosc} aria-label={tekst} role="img">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={DOC_GRAD_OD} />
          <stop offset="100%" stopColor={DOC_GRAD_DO_TEKST} />
        </linearGradient>
      </defs>
      <text
        x="100%"
        y={rozmiar}
        textAnchor="end"
        fill={`url(#${id})`}
        fontSize={rozmiar}
        fontWeight={grubosc}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {tekst}
      </text>
    </svg>
  );
}
