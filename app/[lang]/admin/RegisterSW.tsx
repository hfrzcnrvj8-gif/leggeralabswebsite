"use client";

import { useEffect } from "react";

/** Rejestruje service worker skorupy PWA (Leggera Hub).
 *
 * SW działa realnie tylko po HTTPS (produkcja Vercel). Na `http://localhost`
 * bez HTTPS przeglądarka i tak go pomija — dlatego rejestrację odpalamy tylko
 * na produkcji, żeby w dev nie zaśmiecać konsoli i nie mieszać z HMR
 * (Turbopack). Komponent nic nie renderuje. */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Cichy fallback — brak SW nie może psuć działania panelu.
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
