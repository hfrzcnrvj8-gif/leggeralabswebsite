"use client";

import { motion, type PanInfo } from "framer-motion";
import type { ReactNode } from "react";

export function MacWindow({
  title,
  caption,
  onSwipe,
  compact = false,
  children,
}: {
  title: string;
  caption?: string;
  onSwipe?: (direction: 1 | -1) => void;
  compact?: boolean;
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
          <span className="ml-3 truncate font-mono text-xs text-muted transition-opacity duration-200">
            {title}
          </span>
        </div>

        {/* Viewport / placeholder — draggable to swipe between items */}
        <motion.div
          drag={onSwipe ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.6}
          onDragEnd={handleDragEnd}
          className={`relative overflow-hidden ${compact ? "h-auto" : "h-[74vh] max-h-[760px] min-h-[340px]"} ${onSwipe ? "cursor-grab active:cursor-grabbing" : ""}`}
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
            className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-purple to-brand-gold"
            aria-hidden
          />
          <div
            className={`relative flex flex-col items-center justify-center gap-3 text-center ${compact ? "py-8" : "pointer-events-none h-full"}`}
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
          </div>
        </motion.div>
      </div>
    </div>
  );
}
