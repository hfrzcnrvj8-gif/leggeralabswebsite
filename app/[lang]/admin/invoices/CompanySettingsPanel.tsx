"use client";

import { useEffect, useState } from "react";
import { IconX } from "@tabler/icons-react";
import { type CompanySettings, DEFAULT_COMPANY_SETTINGS } from "@/lib/invoices";
import { useUI } from "../ui";

export function CompanySettingsPanel({ onClose }: { onClose: () => void }) {
  const { toast } = useUI();
  const [s, setS] = useState<CompanySettings | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setS({ ...DEFAULT_COMPANY_SETTINGS, ...(d.settings ?? {}) }));
  }, []);

  const patch = async (p: Partial<CompanySettings>) => {
    setS((prev) => (prev ? { ...prev, ...p } : prev));
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    if (!res.ok) toast("Nie udało się zapisać.", "error");
  };

  if (!s) {
    return <div className="h-64 animate-pulse rounded-lg bg-[var(--hairline)]" />;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Dane firmy (sprzedawca)</h2>
        <button onClick={onClose} className="flex items-center gap-1 rounded-full border hairline px-2.5 py-1 text-xs text-muted hover:text-[var(--fg)]">
          <IconX size={13} /> Zamknij
        </button>
      </div>
      <p className="mt-1 text-[12px] text-muted">Te dane trafiają na każdą fakturę. Możesz je zmienić w każdej chwili.</p>

      <div className="mt-4 space-y-2.5">
        <SField label="Nazwa firmy" value={s.nazwa} onSave={(v) => patch({ nazwa: v })} placeholder="np. Leggera Labs Patryk Piecyk" />
        <div className="grid grid-cols-2 gap-2.5">
          <SField label="NIP" value={s.nip} onSave={(v) => patch({ nip: v })} placeholder="0000000000" />
          <SField label="Telefon" value={s.telefon} onSave={(v) => patch({ telefon: v })} placeholder="+48 …" />
        </div>
        <SField label="Ulica i numer" value={s.ulica} onSave={(v) => patch({ ulica: v })} placeholder="ul. Przykładowa 12/3" />
        <div className="grid grid-cols-[110px_1fr] gap-2.5">
          <SField label="Kod pocztowy" value={s.kod} onSave={(v) => patch({ kod: v })} placeholder="00-000" />
          <SField label="Miasto" value={s.miasto} onSave={(v) => patch({ miasto: v })} placeholder="Warszawa" />
        </div>
        <SField label="Kraj" value={s.kraj} onSave={(v) => patch({ kraj: v })} placeholder="PL" />
        {s.adres.trim() && !s.ulica && !s.miasto && (
          <p className="rounded-lg bg-[var(--hairline)]/40 px-2.5 py-1.5 text-[11px] text-muted">
            Stary, jednoliniowy adres: <span className="text-[var(--fg)]">{s.adres}</span> — przepisz go do pól powyżej, żeby poprawnie trafił na fakturę i do KSeF.
          </p>
        )}
        <SField label="E-mail" value={s.email} onSave={(v) => patch({ email: v })} placeholder="kontakt@…" />
        <SField label="Nr konta (do przelewu)" value={s.konto} onSave={(v) => patch({ konto: v })} placeholder="PL00 0000 0000 0000 0000 0000 0000" />
        <div className="grid grid-cols-2 gap-2.5">
          <SField label="Nazwa banku" value={s.bank_nazwa} onSave={(v) => patch({ bank_nazwa: v })} placeholder="np. mBank" />
          <SField label="BIC / SWIFT" value={s.swift} onSave={(v) => patch({ swift: v })} placeholder="np. BREXPLPWMBK" />
        </div>

        <div className="mt-3 rounded-lg border hairline p-3">
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span>
              <span className="block text-sm text-[var(--fg)]">Płatnik VAT</span>
              <span className="block text-[11px] text-muted">Wyłącz, jeśli korzystasz ze zwolnienia z VAT.</span>
            </span>
            <input
              type="checkbox"
              checked={s.vat_payer}
              onChange={(e) => patch({ vat_payer: e.target.checked })}
              className="h-4 w-4 cursor-pointer accent-[#4ea7fc]"
            />
          </label>
          {!s.vat_payer && (
            <div className="mt-2.5">
              <SField
                label="Podstawa zwolnienia"
                value={s.zwolnienie_podstawa}
                onSave={(v) => patch({ zwolnienie_podstawa: v })}
                placeholder="np. art. 113 ust. 1 ustawy o VAT"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="mb-1 block text-[11px] text-muted">Domyślny termin płatności (dni)</label>
            <input
              type="number"
              value={s.domyslny_termin_dni}
              onChange={(e) => setS((prev) => (prev ? { ...prev, domyslny_termin_dni: Number(e.target.value) } : prev))}
              onBlur={(e) => patch({ domyslny_termin_dni: Number(e.target.value) })}
              className="w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)]"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[11px] text-muted">Domyślne uwagi na nowej fakturze</label>
          <SField
            textarea
            label=""
            value={s.domyslne_uwagi}
            onSave={(v) => patch({ domyslne_uwagi: v })}
            placeholder="np. Dziękuję za współpracę. Płatność przelewem."
          />
          <p className="mt-1 text-[11px] text-muted">Wstawiana automatycznie przy tworzeniu nowej faktury — nadal można ją zmienić na konkretnej fakturze.</p>
        </div>

        <div className="mt-3 rounded-lg border hairline p-3">
          <h3 className="text-sm text-[var(--fg)]">Windykacja — odsetki ustawowe</h3>
          <p className="mt-0.5 text-[11px] text-muted">
            Roczna stawka w % — wpisz ją ręcznie (zmienia się okresowo, ogłasza NBP/MF). Panel nigdy jej sam nie wylicza ani nie aktualizuje. Puste = wezwania
            do zapłaty nie pokazują kwoty odsetek.
          </p>
          <div className="mt-2 max-w-[160px]">
            <NumberField
              value={s.stawka_odsetek_ustawowych}
              onSave={(v) => patch({ stawka_odsetek_ustawowych: v })}
              placeholder="np. 11,25"
              suffix="%"
            />
          </div>
        </div>

        <div className="mt-3 rounded-lg border hairline p-3">
          <h3 className="text-sm text-[var(--fg)]">Rezerwa podatkowa</h3>
          <p className="mt-0.5 text-[11px] text-muted">
            Ile procent kwoty netto każdej faktury warto odłożyć na każdy z podatków — poglądowy wskaźnik, nie automat księgowy, nie zastępuje wyliczeń
            księgowej.
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2.5">
            <div>
              <label className="mb-1 block text-[11px] text-muted">VAT</label>
              <NumberField value={s.rezerwa_vat_procent} onSave={(v) => patch({ rezerwa_vat_procent: v ?? 0 })} placeholder="0" suffix="%" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-muted">PIT</label>
              <NumberField value={s.rezerwa_pit_procent} onSave={(v) => patch({ rezerwa_pit_procent: v ?? 0 })} placeholder="0" suffix="%" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-muted">ZUS</label>
              <NumberField value={s.rezerwa_zus_procent} onSave={(v) => patch({ rezerwa_zus_procent: v ?? 0 })} placeholder="0" suffix="%" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Pole liczbowe (procent) z lokalnym buforem tekstu, zapis na onBlur —
 * wzorem SField, ale z konwersją string↔number i opcjonalnym `null` (dla
 * "nie ustawiono", patrz stawka_odsetek_ustawowych). */
function NumberField({
  value,
  onSave,
  placeholder,
  suffix,
}: {
  value: number | null;
  onSave: (v: number | null) => void;
  placeholder?: string;
  suffix?: string;
}) {
  const [v, setV] = useState(value == null ? "" : String(value));
  useEffect(() => setV(value == null ? "" : String(value)), [value]);
  const commit = () => {
    const trimmed = v.trim().replace(",", ".");
    if (!trimmed) {
      onSave(null);
      return;
    }
    const n = Number(trimmed);
    if (Number.isFinite(n)) onSave(n);
  };
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        placeholder={placeholder}
        className="w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
      />
      {suffix && <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted">{suffix}</span>}
    </div>
  );
}

function SField({
  label,
  value,
  onSave,
  placeholder,
  textarea,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const className = "w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted";
  return (
    <div>
      {label && <label className="mb-1 block text-[11px] text-muted">{label}</label>}
      {textarea ? (
        <textarea
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => v !== value && onSave(v)}
          placeholder={placeholder}
          rows={2}
          className={className}
        />
      ) : (
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => v !== value && onSave(v)}
          placeholder={placeholder}
          className={className}
        />
      )}
    </div>
  );
}
