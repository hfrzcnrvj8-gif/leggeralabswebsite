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
 * Dlaczego pigułka jest `absolute right-0`, a nie zwykłym elementem flex:
 * pasek ma kilka ikon obok siebie. Gdyby rosły w układzie, hover przesuwałby
 * sąsiadów — goniłbyś uciekający cel. Tutaj zewnętrzny `span` trzyma stałe
 * 24×24 px (layout się nie rusza), a pigułka rozsuwa się W LEWO, nad sąsiadów,
 * dokładnie jak w macOS, gdzie „Wymaż wszystko" wychodzi nad treść.
 * Stąd nieprzezroczyste tło (`--bg-soft`) i `z-20` — inaczej pod spodem
 * prześwitywałyby sąsiednie ikony.
 *
 * Szerokość animujemy przez `max-width`, bo CSS nie umie animować `width: auto`.
 * **Popularna sztuczka `grid-cols-[0fr]` → `[1fr]` tu NIE działa** — sprawdzone
 * na żywo 2026-07-17: `1fr` to ułamek WOLNEJ przestrzeni, a pigułka jest
 * `absolute` i sama dopasowuje się do treści, więc wolnej przestrzeni nie ma i
 * track wychodzi 0 px (nawet przy ręcznie wymuszonym `1fr`). `max-width` jest
 * odporny na kontekst. Cena: przy etykiecie węższej niż limit ruch kończy się
 * przed końcem `duration` — niewidoczne przy 200 ms i wyjściowej krzywej.
 * Krzywa `[0.16,1,0.3,1]` — ta sama co Popover/modal (jedna krzywa w panelu).
 *
 * Podpis zostaje też w `aria-label` — czytnik ekranu nie „najeżdża myszą".
 */

import type { ReactNode } from "react";

export function ExpandingIconButton({
  label,
  icon,
  onClick,
  href,
  disabled,
  ariaLabel,
}: {
  /** Podpis odsłaniany po najechaniu. Krótki — to etykieta, nie zdanie. */
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  /** Gdy podany, renderuje <a> (np. pobieranie pliku) zamiast <button>. */
  href?: string;
  disabled?: boolean;
  /** Domyślnie `label`; osobno, gdy podpis jest skrócony dla oka. */
  ariaLabel?: string;
}) {
  const inner = (
    <>
      <span className="max-w-0 overflow-hidden opacity-0 transition-[max-width,opacity] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:max-w-[240px] group-hover:opacity-100 group-focus-visible:max-w-[240px] group-focus-visible:opacity-100">
        <span className="block whitespace-nowrap pl-1 pr-1.5 text-[12px]">{label}</span>
      </span>
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">{icon}</span>
    </>
  );

  const cls =
    "group absolute right-0 top-0 flex h-6 items-center rounded-md px-1 text-muted transition-colors hover:z-20 hover:bg-[var(--bg-soft)] hover:text-[var(--fg)] hover:ring-1 hover:ring-[var(--hairline)] focus-visible:z-20 focus-visible:bg-[var(--bg-soft)] focus-visible:text-[var(--fg)] disabled:opacity-40";

  return (
    // Stała ramka 24×24 — trzyma miejsce w pasku, żeby rozsuwanie się pigułki
    // nie przesuwało pozostałych ikon.
    <span className="relative block h-6 w-6 shrink-0">
      {href ? (
        <a href={href} className={cls} aria-label={ariaLabel ?? label}>
          {inner}
        </a>
      ) : (
        <button type="button" onClick={onClick} disabled={disabled} className={cls} aria-label={ariaLabel ?? label}>
          {inner}
        </button>
      )}
    </span>
  );
}
