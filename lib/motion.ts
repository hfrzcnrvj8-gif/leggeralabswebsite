// Jedno źródło prawdy dla „lekkości" panelu — krzywa i sprężystość animacji.
//
// Dlaczego istnieje: runda „lekkości" z 2026-07-16 ustaliła jedną krzywą
// `[0.16, 1, 0.3, 1]` i jeden spring `420/32`, ale reguła „pamiętaj, żeby jej
// używać" przegrała z domyślną wartością framer-motion (`easeOut`), którą
// dostajesz, gdy nic nie napiszesz. Kolejne moduły ją „dziedziczyły" przez
// przeoczenie i panel zaczął „ważyć" różnie w różnych miejscach. Moduł 36
// zamienia regułę-do-zapamiętania na import: `transition={TWEEN}` /
// `transition={SPRING}` zamiast wpisywanej z palca liczby.
//
// Odpowiednik po stronie CSS/Tailwind: zmienna `--ease-liquid` w
// `app/globals.css` (dla nielicznych animacji czysto-CSS-owych, których
// framer-motion nie obejmuje). Trzymaj obie strony zsynchronizowane.

/** Krzywa „liquid" — łagodne wyhamowanie, wrażenie płynności bez ciężaru.
 *  Ta sama liczba co `--ease-liquid` w globals.css. Używaj do wszystkich
 *  przejść typu tween (fade, slide, przełączanie widoków/zakładek). */
export const EASE_LIQUID = [0.16, 1, 0.3, 1] as const;

/** Standardowe przejście tween panelu. `duration` możesz nadpisać przy
 *  rozłożeniu (`{ ...TWEEN, duration: 0.2 }`), ale krzywej już nie — o to
 *  chodzi. */
export const TWEEN = { duration: 0.18, ease: EASE_LIQUID } as const;

/** Standardowy spring panelu (420/32) — wchodzenie kart, pigułek, layoutu,
 *  toastów, hoverów. Był już w 12 miejscach „z palca"; teraz jeden import. */
export const SPRING = { type: "spring", stiffness: 420, damping: 32 } as const;

/** Miękki spring — ŚWIADOMY wyjątek dla wartości, które mają się „doliczać"
 *  powoli i widocznie (licznik `AnimatedNumber`). Standardowy 420/32 skończy
 *  zliczanie zanim oko je zauważy, więc tu niższa sztywność jest poprawna. */
export const SPRING_SOFT = { type: "spring", stiffness: 120, damping: 20 } as const;
