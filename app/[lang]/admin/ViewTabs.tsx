"use client";

import { AnimatePresence, motion } from "framer-motion";
import { EASE_LIQUID, SPRING } from "@/lib/motion";
import type { ReactNode } from "react";

// Zakładki przełączania widoku (Tablica / Tabela / Oś czasu) — wspólne dla
// Leadów, Klientów i Projektów. Audyt wizualny 2026-07-16 (Moduł 21):
// wcześniej ten sam markup był przepisany w trzech dashboardach, a gradientowe
// podkreślenie POJAWIAŁO SIĘ skokowo pod nową zakładką (`{view === "x" && <span/>}`)
// zamiast przejechać pod nią.
//
// `layoutId` sprawia, że framer traktuje podkreślenie jako JEDEN element
// zmieniający pozycję, a nie dwa różne znikające/pojawiające się — stąd
// przejazd.
//
// Moduł 23: `layoutId` był stały ("na stronie jest zawsze najwyżej jeden
// zestaw zakładek"), a to przestało być prawdą — profil klienta/leada dostał
// własne zakładki i otwiera się MODALEM NAD listą, która ma swoje. Przy dwóch
// zestawach o tym samym `layoutId` framer uznaje oba podkreślenia za ten sam
// element i animuje przejazd z zakładek listy do zakładek modala. Każdy zestaw
// podaje więc własny `layoutId`; wartość domyślna zachowuje zachowanie
// wcześniejszych wywołań (Leady/Klienci/Projekty).
export function ViewTabs<T extends string>({
  value,
  onChange,
  tabs,
  layoutId = "view-tab-underline",
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: { id: T; label: string }[];
  layoutId?: string;
}) {
  return (
    <>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`relative flex h-full items-center px-1 text-[13px] transition-colors ${
            value === t.id ? "text-[var(--fg)]" : "text-muted hover:text-[var(--fg)]"
          }`}
        >
          {t.label}
          {value === t.id && (
            <motion.span
              layoutId={layoutId}
              transition={SPRING}
              className="bg-brand-accent absolute inset-x-0 bottom-0 h-[2px] rounded-full"
            />
          )}
        </button>
      ))}
    </>
  );
}

/** Zawartość przełączana zakładkami — znika i pojawia się przenikaniem
 *  zamiast podmieniać się w jednej klatce. `mode="wait"` czeka, aż stary
 *  widok zniknie, żeby przez moment nie było widać dwóch list na sobie.
 *
 *  Świadomie animujemy WYŁĄCZNIE `opacity`, bez przesunięcia: `transform`
 *  na rodzicu tworzy nowy blok zawierający dla `position: fixed` potomków,
 *  a Kanban/Tabela mają w środku przypięte paski akcji. */
export function ViewSwitch({
  viewKey,
  children,
  fill = false,
}: {
  viewKey: string;
  children: ReactNode;
  /** Widok ma wypełnić dostępną wysokość i przewijać się w środku (Moduł 35) —
   * Kanban, tabela, Gantt, Poczta. **Opt-in, nie domyślnie**: ten sam komponent
   * przełącza też zakładki w profilu klienta/leada, gdzie treść siedzi w modalu
   * o własnej wysokości (`max-h-[85vh]`) i rozciąganie jej zepsułoby układ. */
  fill?: boolean;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={viewKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15, ease: EASE_LIQUID }}
        className={fill ? "flex flex-1 flex-col md:min-h-0" : undefined}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
