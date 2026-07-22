"use client";

import { useEffect } from "react";

/**
 * Ostatnia deska ratunku (Audyt 4, ustalenie 4 — 2026-07-22).
 *
 * Łapie to, czego nie złapie `[lang]/admin/error.tsx`: wysypkę w samym
 * layoucie głównym. Next zastępuje wtedy CAŁY dokument, więc ten plik musi
 * renderować własne `<html>` i `<body>` — i z tego samego powodu nie może
 * korzystać z komponentów ani klas panelu (globalny CSS może nie wejść).
 * Stąd style z palca, wyjątkowo: to jedyny ekran, który musi wyglądać
 * znośnie nawet wtedy, gdy nie wczytało się nic innego.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    fetch("/api/errors/client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        komunikat: error.message || "Nieznany błąd (layout główny)",
        stos: error.stack ?? "",
        sciezka: typeof window !== "undefined" ? window.location.pathname : "",
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="pl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0B0B0F",
          color: "#E7E7EA",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "28rem" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 500, margin: 0 }}>Aplikacja się wywróciła</h2>
          <p style={{ fontSize: "13px", opacity: 0.7, marginTop: "8px", lineHeight: 1.5 }}>
            Awaria została zapisana — zobaczysz ją w porannym raporcie.
          </p>
          <p
            style={{
              fontSize: "11px",
              opacity: 0.6,
              marginTop: "12px",
              fontFamily: "ui-monospace, monospace",
              background: "rgba(255,255,255,0.06)",
              padding: "6px 8px",
              borderRadius: "8px",
            }}
          >
            {error.message || "Brak komunikatu."}
            {error.digest ? ` (${error.digest})` : ""}
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "16px",
              padding: "8px 14px",
              fontSize: "13px",
              borderRadius: "10px",
              border: "1px solid rgba(255,255,255,0.18)",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            Spróbuj ponownie
          </button>
        </div>
      </body>
    </html>
  );
}
