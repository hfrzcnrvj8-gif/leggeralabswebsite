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
      </div>
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
