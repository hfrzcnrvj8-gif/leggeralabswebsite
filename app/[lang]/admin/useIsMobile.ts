"use client";

import { useEffect, useState } from "react";

/** Czy jesteśmy na wąskim ekranie — poniżej breakpointu `md` Tailwinda (768 px),
 *  czyli telefon, ale już nie iPad.
 *
 *  Po co hook, skoro większość rzeczy da się zrobić klasami `md:`? Bo część
 *  różnic mobilnych to nie styl, tylko INNA STRUKTURA i inna animacja — wspólny
 *  `Modal` renderuje na telefonie arkusz wysuwany z dołu (z uchwytem i
 *  ściąganiem palcem), a na desktopie wyśrodkowane okno. Tego nie da się
 *  wyrazić samym CSS-em.
 *
 *  SSR/pierwszy render zwraca `false` (wariant desktopowy), korekta następuje w
 *  `useEffect` — inaczej serwer i klient wyrenderowałyby różne drzewa i React
 *  zgłosiłby błąd hydratacji. Świadomie `matchMedia`, nie listener `resize`:
 *  odpala się tylko przy realnym przekroczeniu progu, nie przy każdym pikselu. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isMobile;
}
