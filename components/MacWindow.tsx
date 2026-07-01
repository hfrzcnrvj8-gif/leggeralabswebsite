"use client";

import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import type { ReactNode } from "react";

export function MacWindow({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children?: ReactNode;
}) {
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);

  const rotateX = useSpring(useTransform(my, [0, 1], [8, -8]), {
    stiffness: 180,
    damping: 18,
  });
  const rotateY = useSpring(useTransform(mx, [0, 1], [-8, 8]), {
    stiffness: 180,
    damping: 18,
  });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - rect.left) / rect.width);
    my.set((e.clientY - rect.top) / rect.height);
  };

  const reset = () => {
    mx.set(0.5);
    my.set(0.5);
  };

  return (
    <motion.div
      onMouseMove={handleMove}
      onMouseLeave={reset}
      style={{ rotateX, rotateY, transformPerspective: 1000 }}
      className="group relative rounded-2xl"
    >
      <div className="card-paper overflow-hidden rounded-2xl">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b px-4 py-3 hairline">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          <span className="ml-3 truncate font-mono text-xs text-muted">
            {title}
          </span>
        </div>

        {/* Viewport / placeholder */}
        <div className="relative aspect-video overflow-hidden">
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
          {children ?? (
            <div className="relative flex h-full flex-col items-center justify-center gap-3 text-center">
              <span className="glass grid h-14 w-14 place-items-center rounded-full text-xl transition-transform duration-300 group-hover:scale-110">
                ▶
              </span>
              {caption && (
                <p className="px-6 text-sm text-muted">{caption}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
