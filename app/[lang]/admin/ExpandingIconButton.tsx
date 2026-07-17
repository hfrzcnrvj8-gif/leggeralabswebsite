"use client";

/**
 * Ikona, która po najechaniu ROZSUWA SIĘ w podpisaną pigułkę (Moduł 34, runda 2).
 *
 * Wzorzec: Centrum powiadomień macOS — „✕" po najechaniu rozsuwa się w „Wymaż
 * wszystko". Właściciel wskazał ten efekt wprost (2026-07-17) po pierwszej
 * rundzie, w której dostał zwykły dymek: *„nie tak jak chciałem, chciałem żeby
 * to się rozwijało tak jak u Apple"*. Różnica jest zasadnicza — dymek to OSOBNE
 * pudełko obok kontrolki, tu **sama kontrolka rośnie** i odsłania swój podpis.
 *
 * UKŁAD (zmienione 2026-07-17, runda 34b, na wyraźną prośbę właściciela):
 * pigułka jest teraz **zwykłym elementem `inline-flex`**, NIE `absolute`. Runda
 * 34 trzymała ją `absolute` w stałej ramce 24×24, żeby rozsuwanie nie ruszało
 * paska — ale rozwijana etykieta **nachodziła na sąsiednie ikony** (stąd było
 * nieprzezroczyste tło + `z-20`). Właściciel: *„zrób tak, żeby one na siebie nie
 * najeżdżały — jak się rozwija opis, niech ikonka, która byłaby zasłonięta, się
 * rozsuwa, żeby została widoczna"*. Rozwiązanie: rosnąć W UKŁADZIE. Pasek akcji
 * jest dosunięty do prawej (`flex-1` rozpychacz albo `justify-end`), więc gdy
 * jedna pigułka rośnie, jej **własna ikona zostaje na miejscu** (prawa krawędź
 * zakotwiczona przez prawego sąsiada), a ikony PO LEWEJ przesuwają się w lewo —
 * czyli ta, która byłaby zasłonięta, uchyla się i zostaje widoczna. Dawna obawa
 * „goniłbyś uciekający cel" nie występuje: cel (ikona pod kursorem) się nie
 * rusza, ruszają się tylko sąsiedzi obok. Bez `absolute` nie ma już nakładania,
 * więc `z-20` i krycie tła nie są już potrzebne do zasłaniania — tło pigułki
 * zostaje tylko jako jej własny hover.
 *
 * Szerokość animujemy przez `max-width`, bo CSS nie umie animować `width: auto`.
 * Teraz, gdy element jest w układzie, rosnący `max-width` etykiety naturalnie
 * poszerza przycisk, a flex-owy pasek płynnie przelicza pozycje sąsiadów — jeden
 * `transition` na `max-width` napędza i pigułkę, i przesunięcie sąsiadów.
 * Krzywa `--ease-liquid` (= `[0.16,1,0.3,1]`, lib/motion.ts) — jedna krzywa
 * w panelu, ta sama co Popover/modal.
 *
 * Podpis zostaje też w `aria-label` — czytnik ekranu nie „najeżdża myszą".
 *
 * Moduł 34b (2026-07-17) dołożył trzy własności, wymuszone przez wyjście poza
 * pasek Leadów — właściciel wybrał „pigułka wszędzie", też w wierszach tabel:
 * - `tone="danger"` — „Usuń"/„Anuluj" miały czerwony hover, zanim stały się
 *   pigułką; bez tego kasowanie wyglądałoby jak zwykła akcja;
 * - `newTab` — „Podgląd / wydruk" to `<a target="_blank">`, a nie pobranie pliku;
 * - `active` — ikona otwierająca menu (Popover) musi zostać podświetlona, gdy
 *   menu jest otwarte, a mysz zjechała z ikony. Sam `:hover` tego nie utrzyma.
 */

import type { ReactNode } from "react";

export function ExpandingIconButton({
  label,
  icon,
  onClick,
  href,
  newTab = false,
  disabled,
  ariaLabel,
  active = false,
  tone = "default",
}: {
  /** Podpis odsłaniany po najechaniu. Krótki — to etykieta, nie zdanie. */
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  /** Gdy podany, renderuje <a> (np. pobieranie pliku) zamiast <button>. */
  href?: string;
  /** Tylko z `href` — otwiera w nowej karcie (wydruk faktury/oferty). */
  newTab?: boolean;
  disabled?: boolean;
  /** Domyślnie `label`; osobno, gdy podpis jest skrócony dla oka. */
  ariaLabel?: string;
  /** Trzyma podświetlenie mimo braku hovera — dla ikon otwierających menu. */
  active?: boolean;
  /** `danger` = czerwony akcent akcji niszczącej (Usuń, Anuluj). */
  tone?: "default" | "danger";
}) {
  const inner = (
    <>
      <span className="max-w-0 overflow-hidden opacity-0 transition-[max-width,opacity] duration-200 ease-[var(--ease-liquid)] group-hover:max-w-[240px] group-hover:opacity-100 group-focus-visible:max-w-[240px] group-focus-visible:opacity-100">
        <span className="block whitespace-nowrap pl-1 pr-1.5 text-[12px]">{label}</span>
      </span>
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">{icon}</span>
    </>
  );

  const cls = [
    // `inline-flex shrink-0` — element w układzie, rośnie w miejscu i rozpycha
    // sąsiadów (patrz nagłówek). Bez `absolute`/`z-20` — nie ma już nakładania.
    "group inline-flex h-6 shrink-0 items-center rounded-md px-1 text-muted transition-colors",
    "hover:bg-[var(--bg-soft)] hover:ring-1 hover:ring-[var(--hairline)]",
    "focus-visible:bg-[var(--bg-soft)] focus-visible:ring-1 focus-visible:ring-[var(--hairline)]",
    tone === "danger"
      ? "hover:text-red-400 focus-visible:text-red-400"
      : "hover:text-[var(--fg)] focus-visible:text-[var(--fg)]",
    // Menu otwarte: podświetlenie zostaje, ale pigułka NIE jest rozsunięta —
    // rozsuwaniem steruje `group-hover`, więc otwarte menu nie blokuje paska.
    active ? "bg-[var(--bg-soft)] text-[var(--fg)] ring-1 ring-[var(--hairline)]" : "",
    "disabled:opacity-40",
  ].join(" ");

  return href ? (
    <a
      href={href}
      className={cls}
      aria-label={ariaLabel ?? label}
      {...(newTab ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      {inner}
    </a>
  ) : (
    <button type="button" onClick={onClick} disabled={disabled} className={cls} aria-label={ariaLabel ?? label}>
      {inner}
    </button>
  );
}
