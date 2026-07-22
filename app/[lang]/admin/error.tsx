"use client";

import { useEffect } from "react";
import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";

/**
 * Granica błędu panelu (Audyt 4, ustalenie 4 — 2026-07-22).
 *
 * Do tego audytu w całym `app/` nie było ANI JEDNEGO `error.tsx` — wysypka
 * renderowania dawała domyślny ekran błędu Next i zero śladu gdziekolwiek.
 *
 * Robi dwie rzeczy, obie potrzebne:
 * 1. **Melduje** awarię do `error_log`, żeby przestała być niewidzialna.
 * 2. **Daje wyjście** — właściciel nie jest programistą; ekran bez przycisku
 *    „spróbuj ponownie" zostawia go z niczym poza przeładowaniem karty.
 *
 * **Klasa `admin-linear` jest tu obowiązkowa**, nie ozdobna. Ciemną paletę
 * panelu nakłada `AppShell.tsx`, który przy wysypce NIE renderuje się wcale —
 * ten ekran wchodzi na jego miejsce. Bez tej klasy dostajemy jasny ekran
 * błędu w panelu, który jest jednomotywowy-ciemny (patrz CLAUDE.md). Ten sam
 * zabieg co w portalach `Tooltip.tsx` i `Menu.tsx`, które też lądują poza
 * scope'em AppShella. Złapane zrzutem ekranu 2026-07-22, nie przewidziane.
 */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Zgłoszenie „na wylot": gdy padnie, i tak jesteśmy już na ekranie błędu.
    fetch("/api/errors/client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        komunikat: error.message || "Nieznany błąd interfejsu",
        stos: error.stack ?? "",
        sciezka: typeof window !== "undefined" ? window.location.pathname : "",
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="admin-linear flex min-h-screen items-center justify-center bg-[var(--bg)] p-6 font-sans text-[var(--fg)]">
      <div className="card-paper max-w-lg rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <IconAlertTriangle size={20} className="mt-0.5 shrink-0 text-brand-gold" />
          <div className="min-w-0">
            <h2 className="text-[15px] font-medium">Ten widok się wywrócił</h2>
            <p className="mt-1 text-[13px] text-muted">
              Awaria została zapisana — zobaczysz ją w porannym raporcie. Reszta panelu działa normalnie.
            </p>
            {/* Komunikat techniczny zostaje, ale schowany wizualnie: bywa
                jedyną wskazówką, gdy właściciel pyta „co się stało". */}
            <p className="mt-3 rounded-lg bg-[var(--hairline)]/60 px-2 py-1 font-mono text-[11px] text-muted">
              {error.message || "Brak komunikatu."}
              {error.digest ? ` (${error.digest})` : ""}
            </p>
            <button onClick={reset} className="btn-primary mt-4 inline-flex items-center gap-1.5 text-[13px]">
              <IconRefresh size={15} />
              Spróbuj ponownie
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
