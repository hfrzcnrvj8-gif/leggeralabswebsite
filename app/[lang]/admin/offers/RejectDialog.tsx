"use client";

import { useState } from "react";
import { OFFER_REJECT_REASONS } from "@/lib/offers";

/**
 * „Dlaczego klient powiedział nie" — pytane RAZ, w momencie odrzucenia oferty
 * (Moduł 57). Powód idzie na oś czasu klienta razem ze zdarzeniem
 * `offer_rejected`, więc historia firmy nie kończy się na „wysłano ofertę".
 *
 * Osobny plik, bo odrzucić ofertę da się z DWÓCH miejsc — z pigułki statusu na
 * liście i z profilu oferty. Dwie kopie tego okna rozjechałyby się przy
 * pierwszej zmianie listy powodów, a wtedy statystyka „na czym przegrywamy"
 * liczyłaby dwa różne słowniki.
 */
export function OknoOdrzucenia({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: (powod: string, komentarz: string) => void;
}) {
  const [powod, setPowod] = useState<string>(OFFER_REJECT_REASONS[0]);
  const [komentarz, setKomentarz] = useState("");
  return (
    <div>
      <h2 className="text-sm font-medium text-[var(--fg)]">Oferta odrzucona — dlaczego?</h2>
      <p className="mt-1 text-[12px] text-muted">
        Zapisze się na osi czasu klienta. Po kilkunastu ofertach to jedyne miejsce, z którego da się
        odczytać, na czym realnie przegrywasz.
      </p>
      <div className="mt-3 space-y-1">
        {OFFER_REJECT_REASONS.map((r) => (
          <button
            key={r}
            onClick={() => setPowod(r)}
            className={`flex w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-left text-[13px] ${
              powod === r
                ? "border-brand-purple/60 bg-brand-purple/10 text-[var(--fg)]"
                : "hairline text-muted hover:text-[var(--fg)]"
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <textarea
        value={komentarz}
        onChange={(e) => setKomentarz(e.target.value)}
        rows={2}
        placeholder="Własnymi słowami (opcjonalnie) — np. „budżet dopiero w przyszłym kwartale”."
        className="mt-3 w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-[13px] text-[var(--fg)] placeholder:text-muted"
      />
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-full border hairline px-4 py-1.5 text-xs text-muted">
          Anuluj
        </button>
        <button
          onClick={() => onConfirm(powod, komentarz)}
          className="btn-primary rounded-full px-4 py-1.5 text-xs font-semibold"
        >
          Zapisz odrzucenie
        </button>
      </div>
    </div>
  );
}
