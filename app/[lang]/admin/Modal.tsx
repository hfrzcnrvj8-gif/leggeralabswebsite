"use client";

import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { EASE_LIQUID, SPRING } from "@/lib/motion";
import type { ReactNode } from "react";
import { useIsMobile } from "./useIsMobile";

// Wspólny modal całego panelu (audyt wizualny 2026-07-16, Moduł 21).
//
// Do tamtej rundy KAŻDY z dziesięciu modali w panelu miał ten sam overlay
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
//
// Moduł 5, Paczka 3 (2026-07-17) — NA TELEFONIE to samo okno renderuje się
// jako ARKUSZ wysuwany z dołu, z uchwytem i zamykaniem przez ściągnięcie
// palcem, bo tak działają okna w natywnych apkach iOS (decyzja właściciela:
// „wygląda jak lekko poprawiony desktop"). Od `md` w górę BEZ ZMIAN —
// wyśrodkowane okno, zgodnie z CLAUDE.md. Zmiana jest w tym jednym pliku,
// więc dotyczy wszystkich modali panelu naraz.

/** Ile trzeba ściągnąć w dół (px) albo jak szybko szarpnąć (px/s), żeby arkusz
 *  się zamknął. Wartości z zachowania natywnych arkuszy iOS: krótkie, szybkie
 *  szarpnięcie zamyka tak samo jak powolne przeciągnięcie przez pół ekranu. */
const SHEET_CLOSE_OFFSET = 110;
const SHEET_CLOSE_VELOCITY = 600;

export function Modal({
  open,
  onClose,
  children,
  z = 90,
  card = "my-auto w-full",
}: {
  open: boolean;
  /** Kliknięcie w tło / Escape / ściągnięcie arkusza. Zwróć `false`, żeby
   *  zablokować zamknięcie (np. Koszty w trakcie odczytu AI). */
  onClose: () => void | false;
  children: ReactNode;
  /** Warstwa — 90 dla profilu rekordu, 95 dla modala nad modalem, 205 dla
   *  okna otwieranego z popovera/menu (te żyją na `z-[200]`). */
  z?: 90 | 95 | 205;
  /** Klasy KARTY. Domyślnie sam kontener bez tła — Leady/Klienci rysują
   *  `.card-paper` wewnątrz własnego `*DetailPanel.tsx`. Moduły z węższym
   *  modalem podają tu np. `card-paper … max-w-3xl …`. */
  card?: string;
}) {
  const isMobile = useIsMobile();
  // `dragListener={false}` + ręczny start z uchwytu — bez tego przeciąganie
  // konkurowałoby z przewijaniem treści w środku arkusza (profil leada ma
  // własny `overflow-y-auto`) i każda próba scrollowania zamykałaby okno.
  const dragControls = useDragControls();

  // 205 = NAD popoverami/menu (te siedzą na `z-[200]`, patrz Menu.tsx). Wprost
  // dla okien otwieranych Z WNĘTRZA popovera — np. zaproszenie na spotkanie
  // wołane z podglądu dnia w Kalendarzu (2026-07-22). Bez tego modal ląduje
  // POD popoverem, który go otworzył, i wygląda jak zawieszony panel.
  const zClass = z === 205 ? "z-[205]" : z === 95 ? "z-[95]" : "z-[90]";

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
          className={`fixed inset-0 ${zClass} ${
            isMobile
              ? "flex items-end justify-center bg-black/50 backdrop-blur-[2px]"
              : "flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-[2px] sm:p-8"
          }`}
          onClick={() => onClose()}
        >
          {isMobile ? (
            <motion.div
              // Arkusz: wjeżdża z dołu, wyjeżdża w dół — ten sam ruch, którym
              // właściciel go zamyka palcem, więc gest i animacja są spójne.
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={SPRING}
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              // Górna granica 0 = arkusza nie da się przeciągnąć wyżej niż
              // jego pozycja docelowa; `dragElastic` na dole daje gumowanie.
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              onDragEnd={(_e, info) => {
                if (info.offset.y > SHEET_CLOSE_OFFSET || info.velocity.y > SHEET_CLOSE_VELOCITY) {
                  onClose();
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full"
            >
              {/* Uchwyt — jedyne miejsce, z którego startuje przeciąganie.
                  `touch-none` wyłącza natywne gesty przeglądarki pod palcem,
                  inaczej Safari próbowałoby jednocześnie przewijać stronę. */}
              <div
                onPointerDown={(e) => dragControls.start(e)}
                className="flex touch-none cursor-grab justify-center pb-2 pt-1 active:cursor-grabbing"
                aria-hidden
              >
                <span className="h-1 w-9 rounded-full bg-white/30" />
              </div>
              <div className={card}>{children}</div>
            </motion.div>
          ) : (
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
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
