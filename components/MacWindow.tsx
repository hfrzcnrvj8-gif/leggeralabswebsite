"use client";

import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import type { ReactNode } from "react";

export function MacWindow({
  title,
  caption,
  onSwipe,
  children,
}: {
  title: string;
  caption?: string;
  onSwipe?: (direction: 1 | -1) => void;
  children?: ReactNode;
}) {
  const handleDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    if (!onSwipe) return;
    if (info.offset.x < -60) onSwipe(1);
    else if (info.offset.x > 60) onSwipe(-1);
  };

  return (
    <div className="relative rounded-2xl">
      <div className="card-paper overflow-hidden rounded-2xl">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b px-4 py-3 hairline">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={title}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.2 }}
              className="ml-3 truncate font-mono text-xs text-muted"
            >
              {title}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Viewport / placeholder — draggable to swipe between items */}
        <motion.div
          drag={onSwipe ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.6}
          onDragEnd={handleDragEnd}
          className={`relative h-[46vh] max-h-[440px] min-h-[240px] overflow-hidden ${onSwipe ? "cursor-grab active:cursor-grabbing" : ""}`}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(var(--hairline) 1px, transparent 1px), linear-gradient(90deg, var(--hairline) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-purple via-brand-pink to-brand-gold"
            aria-hidden
          />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={caption ?? "content"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="pointer-events-none relative flex h-full flex-col items-center justify-center gap-3 text-center"
            >
              {children ?? (
                <>
                  <span className="glass grid h-14 w-14 place-items-center rounded-full text-xl transition-transform duration-300">
                    ▶
                  </span>
                  {caption && (
                    <p className="px-6 text-sm text-muted">{caption}</p>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
