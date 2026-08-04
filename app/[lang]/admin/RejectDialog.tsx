"use client";

import { useState } from "react";
import { OFFER_REJECT_REASONS } from "@/lib/offers";

/**
 * „Dlaczego druga strona powiedziała nie" — pytane RAZ, w chwili odrzucenia
 * dokumentu. Powód idzie na oś czasu klienta razem ze zdarzeniem
 * (`offer_rejected` / `contract_rejected`), więc historia firmy nie kończy się
 * na „wysłano ofertę".
 *
 * **Wspólne dla Ofert i Umów, ale z osobnymi listami powodów** (audyt
 * Modułu 11, 2026-07-27). Okno jest jedno, bo odrzucić dokument da się z DWÓCH
 * miejsc w każdym module — z pigułki statusu na liście i z profilu — a dwie
 * kopie tego samego okna rozjeżdżają się przy pierwszej zmianie. Listy powodów
 * zostają rozdzielone (`OFFER_REJECT_REASONS` / `CONTRACT_REJECT_REASONS`):
 * ofertę przegrywa się na cenie, umowę na zapisach, a wspólny słownik zlałby
 * dwie różne porażki w jedną statystykę.
 *
 * Mieszka w korzeniu `admin/` z tego samego powodu co `icons.tsx`: dzieli je
 * kilka modułów naraz, więc żaden nie jest właścicielem.
 */
export function OknoOdrzucenia({
  onCancel,
  onConfirm,
  tytul = "Oferta odrzucona — dlaczego?",
  opis = "Zapisze się na osi czasu klienta. Po kilkunastu ofertach to jedyne miejsce, z którego da się odczytać, na czym realnie przegrywasz.",
  powody = OFFER_REJECT_REASONS as readonly string[],
  placeholder = "Własnymi słowami (opcjonalnie) — np. „budżet dopiero w przyszłym kwartale”.",
}: {
  onCancel: () => void;
  onConfirm: (powod: string, komentarz: string) => void;
  tytul?: string;
  opis?: string;
  powody?: readonly string[];
  placeholder?: string;
}) {
  const [powod, setPowod] = useState<string>(powody[0] ?? "");
  const [komentarz, setKomentarz] = useState("");
  return (
    <div>
      <h2 className="text-sm font-medium text-[var(--fg)]">{tytul}</h2>
      <p className="mt-1 text-[12px] text-muted">{opis}</p>
      <div className="mt-3 space-y-1">
        {powody.map((r) => (
          <button
            key={r}
            onClick={() => setPowod(r)}
            // Zaznaczenie niesione WYŁĄCZNIE kolorem jest niewidoczne dla
            // czytnika ekranu i dla każdego, kto nie odróżnia tych dwóch teł
            // (znalezisko D6). `aria-pressed` mówi to samo słowem — a przy
            // okazji daje się zmierzyć w sondzie, w przeciwieństwie do klasy.
            aria-pressed={powod === r}
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
        placeholder={placeholder}
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
