"use client";

// Wybór cyklu powtarzania — WSPÓLNY dla Kalendarza i Przypomnień.
//
// Mieszka w korzeniu `admin/`, nie w `<moduł>/shared.tsx`, z tego samego
// powodu, co mapy ikon w `icons.tsx`: dwa moduły używają go tak samo i żaden
// nie jest jego właścicielem. Słownik cykli siedzi w `lib/recurrence.ts` —
// tutaj jest wyłącznie warstwa klikania.

import { IconRepeat } from "@tabler/icons-react";
import { CYKLE, CYKL_LABEL, type Cykl } from "@/lib/recurrence";

/** Sama pigułka „powtarza się" — na kafelku/wierszu, do czytania.
 * `numer` (które to wystąpienie) pokazujemy tylko, gdy je znamy. */
export function SeriaTag({
  cykl,
  numer,
  className = "",
}: {
  cykl: string | null | undefined;
  numer?: number;
  className?: string;
}) {
  if (!cykl || !(CYKLE as readonly string[]).includes(cykl)) return null;
  const opis = CYKL_LABEL[cykl as Cykl];
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] text-muted ${className}`}
      title={numer ? `${opis} — ${numer}. wystąpienie serii` : opis}
    >
      <IconRepeat size={12} />
      {opis}
    </span>
  );
}

/** Wybór cyklu + opcjonalne „do kiedy". Kontrolowany — stan trzyma formularz.
 *
 * „Do kiedy" pojawia się DOPIERO po wybraniu cyklu: data końca serii, która
 * się nie powtarza, nie znaczy nic, a puste pole obok „Nie powtarza się"
 * wyglądałoby jak coś, co trzeba wypełnić. */
export function CyklPicker({
  cykl,
  doDnia,
  odDnia,
  onChange,
  className = "",
}: {
  cykl: string | null;
  doDnia: string;
  /** Pierwsze wystąpienie — dolna granica dla „do kiedy". */
  odDnia: string;
  onChange: (next: { cykl: string | null; doDnia: string }) => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="flex items-center gap-1 text-[11px] text-muted">
        <IconRepeat size={12} />
        Powtarzaj:
      </span>
      <select
        value={cykl ?? ""}
        onChange={(e) => onChange({ cykl: e.target.value || null, doDnia: e.target.value ? doDnia : "" })}
        className="rounded-lg border hairline bg-transparent px-2 py-1 text-[11px] text-[var(--fg)]"
      >
        <option value="" className="bg-[var(--bg-soft)] text-[var(--fg)]">
          Nie powtarza się
        </option>
        {CYKLE.map((c) => (
          <option key={c} value={c} className="bg-[var(--bg-soft)] text-[var(--fg)]">
            {CYKL_LABEL[c]}
          </option>
        ))}
      </select>
      {cykl && (
        <label className="flex items-center gap-2 text-[11px] text-muted">
          do
          <input
            type="date"
            value={doDnia}
            min={odDnia}
            onChange={(e) => onChange({ cykl, doDnia: e.target.value })}
            className="rounded-lg border hairline bg-transparent px-2 py-1 text-[11px] text-[var(--fg)]"
          />
          <span className="text-muted">{doDnia ? "" : "(bez końca)"}</span>
        </label>
      )}
    </div>
  );
}
