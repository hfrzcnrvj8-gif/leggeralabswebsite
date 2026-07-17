"use client";

import { AnimatePresence, motion } from "framer-motion";
import { EASE_LIQUID, SPRING } from "@/lib/motion";
import type { ReactNode } from "react";

// Wspólny modal całego panelu (audyt wizualny 2026-07-16, Moduł 21).
//
// Do tej rundy KAŻDY z dziesięciu modali w panelu miał ten sam overlay
// przepisany ręcznie, ale kartę animował inaczej: dziewięć używało
// `duration: 0.14, ease: "easeOut"` (140 ms to nie przejście, tylko
// mignięcie), Projekty miały spring 420/34, a okno kompozycji w Poczcie
// nie animowało karty w ogóle — tylko przyciemnienie tła. Jeden wzorzec
// UI, trzy różne zachowania. Ten komponent jest jedynym miejscem, w którym
// ten wzorzec żyje.
//
// Spring 420/32 (`SPRING`) i krzywa `EASE_LIQUID` pochodzą z `lib/motion.ts`
// — jedno źródło płynności panelu (Moduł 36). Świadomie NIE wymyślamy tu
// własnych wartości.

export function Modal({
  open,
  onClose,
  children,
  z = 90,
  card = "my-auto w-full",
}: {
  open: boolean;
  /** Kliknięcie w tło / Escape. Zwróć `false`, żeby zablokować zamknięcie
   *  (np. Koszty w trakcie odczytu AI). */
  onClose: () => void | false;
  children: ReactNode;
  /** Warstwa — 90 dla profilu rekordu, 95 dla modala nad modalem. */
  z?: 90 | 95;
  /** Klasy KARTY. Domyślnie sam kontener bez tła — Leady/Klienci rysują
   *  `.card-paper` wewnątrz własnego `*DetailPanel.tsx`. Moduły z węższym
   *  modalem podają tu np. `card-paper … max-w-3xl …`. */
  card?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: EASE_LIQUID }}
          // Klasy warstwy MUSZĄ być pełnymi literałami — Tailwind skanuje
          // kod statycznie, więc `z-[${z}]` nie wygenerowałoby się w CSS.
          className={`fixed inset-0 ${
            z === 95 ? "z-[95]" : "z-[90]"
          } flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-[2px] sm:p-8`}
          onClick={() => onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={SPRING}
            onClick={(e) => e.stopPropagation()}
            className={card}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
