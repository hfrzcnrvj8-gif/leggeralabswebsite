"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Przewiń na górę"
          initial={{ opacity: 0, y: 16, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.8 }}
          transition={{ duration: 0.3, ease }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          className="glass fixed bottom-6 right-6 z-40 grid h-12 w-12 place-items-center rounded-full shadow-xl"
        >
          <motion.span
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            className="text-liquid text-xl"
            aria-hidden
          >
            ↑
          </motion.span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
