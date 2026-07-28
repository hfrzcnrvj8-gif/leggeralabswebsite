"use client";

import { useEffect, useState } from "react";
import { IconX } from "@tabler/icons-react";
import { type CompanySettings, DEFAULT_COMPANY_SETTINGS } from "@/lib/invoices";
import { useUI } from "../ui";
import { SekcjaProfilu, WierszPola } from "../ProfileSection";

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

      {/* Moduł 59, paczka F — ustawienia sprzedawcy w tych samych wierszach
          „etykieta po lewej", co profile rekordów. To najbliższy odpowiednik
          ekranu Ustawień z apki (`List(.insetGrouped)`): grupy pól na płytach
          z nagłówkiem, a nie jedna kolumna etykiet nad polami. */}
      <div className="mt-4 space-y-4">
        <SekcjaProfilu tytul="Firma">
          <SField label="Nazwa firmy" value={s.nazwa} onSave={(v) => patch({ nazwa: v })} placeholder="np. Leggera Labs Patryk Piecyk" />
          <SField label="NIP" value={s.nip} onSave={(v) => patch({ nip: v })} placeholder="0000000000" />
          {/* Kto podpisuje umowy po naszej stronie — wchodzi w rubrykę podpisu
              na wydruku umowy/NDA/aneksu (2026-07-27). Puste = nazwa firmy. */}
          <SField
            label="Podpisuje umowy"
            value={s.osoba_podpisujaca}
            onSave={(v) => patch({ osoba_podpisujaca: v })}
            placeholder="imię i nazwisko — trafia do rubryki podpisu"
          />
        </SekcjaProfilu>

        <SekcjaProfilu tytul="Adres">
          <SField label="Ulica" value={s.ulica} onSave={(v) => patch({ ulica: v })} placeholder="ul. Przykładowa 12/3" />
          <WierszPola etykieta="Kod / Miasto">
            {/* Wąski kod, szerokie miasto — ten sam podział, co w profilu leada
                i klienta, żeby adres wyglądał wszędzie tak samo. */}
            <div className="w-[84px] shrink-0">
              <SFieldInput value={s.kod} onSave={(v) => patch({ kod: v })} placeholder="00-000" />
            </div>
            <SFieldInput value={s.miasto} onSave={(v) => patch({ miasto: v })} placeholder="Warszawa" />
          </WierszPola>
          <SField label="Kraj" value={s.kraj} onSave={(v) => patch({ kraj: v })} placeholder="PL" />
          {s.adres.trim() && !s.ulica && !s.miasto && (
            <p className="px-3 py-2 text-[11px] leading-snug text-muted">
              Stary, jednoliniowy adres: <span className="text-[var(--fg)]">{s.adres}</span> — przepisz go do pól powyżej, żeby poprawnie trafił na fakturę i do KSeF.
            </p>
          )}
        </SekcjaProfilu>

        <SekcjaProfilu tytul="Kontakt i konto">
          <SField label="Telefon" value={s.telefon} onSave={(v) => patch({ telefon: v })} placeholder="+48 …" />
          <SField label="E-mail" value={s.email} onSave={(v) => patch({ email: v })} placeholder="kontakt@…" />
          <SField label="Konto" value={s.konto} onSave={(v) => patch({ konto: v })} placeholder="PL00 0000 0000 0000 0000 0000 0000" />
          <SField label="Nazwa banku" value={s.bank_nazwa} onSave={(v) => patch({ bank_nazwa: v })} placeholder="np. mBank" />
          <SField label="BIC / SWIFT" value={s.swift} onSave={(v) => patch({ swift: v })} placeholder="np. BREXPLPWMBK" />
        </SekcjaProfilu>

        <SekcjaProfilu tytul="VAT">
          <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2">
            <span>
              <span className="block text-sm text-[var(--fg)]">Płatnik VAT</span>
              <span className="block text-[11px] text-muted">Wyłącz, jeśli korzystasz ze zwolnienia z VAT.</span>
            </span>
            <input
              type="checkbox"
              checked={s.vat_payer}
              onChange={(e) => patch({ vat_payer: e.target.checked })}
              className="h-4 w-4 cursor-pointer accent-[var(--zaznaczenie)]"
            />
          </label>
          {!s.vat_payer && (
            <SField
              label="Podstawa zwolnienia"
              value={s.zwolnienie_podstawa}
              onSave={(v) => patch({ zwolnienie_podstawa: v })}
              placeholder="np. art. 113 ust. 1 ustawy o VAT"
            />
          )}
        </SekcjaProfilu>

        <SekcjaProfilu tytul="Domyślne na nowej fakturze">
          <WierszPola etykieta="Termin płatności" title="Domyślny termin płatności w dniach">
            <input
              type="number"
              value={s.domyslny_termin_dni}
              onChange={(e) => setS((prev) => (prev ? { ...prev, domyslny_termin_dni: Number(e.target.value) } : prev))}
              onBlur={(e) => patch({ domyslny_termin_dni: Number(e.target.value) })}
              className="w-[90px] rounded-lg border hairline bg-transparent py-1.5 text-[var(--fg)]"
            />
            <span className="text-[12px] text-muted">dni</span>
          </WierszPola>
          {/* Uwagi to treść wielolinijkowa — poza wierszem o stałej wysokości. */}
          <div className="space-y-1 px-3 py-2">
            <label className="block text-[11px] text-muted">Uwagi</label>
            <SFieldTextarea
              value={s.domyslne_uwagi}
              onSave={(v) => patch({ domyslne_uwagi: v })}
              placeholder="np. Dziękuję za współpracę. Płatność przelewem."
            />
            <p className="text-[11px] text-muted">Wstawiane automatycznie przy tworzeniu nowej faktury — nadal można je zmienić na konkretnej fakturze.</p>
          </div>
        </SekcjaProfilu>

        <SekcjaProfilu tytul="Windykacja — odsetki ustawowe">
          <p className="px-3 py-2 text-[11px] leading-snug text-muted">
            Roczna stawka w % — wpisz ją ręcznie (zmienia się okresowo, ogłasza NBP/MF). Panel nigdy jej sam nie wylicza ani nie aktualizuje. Puste = wezwania
            do zapłaty nie pokazują kwoty odsetek.
          </p>
          <WierszPola etykieta="Stawka roczna">
            <div className="w-[120px]">
              <NumberField
                value={s.stawka_odsetek_ustawowych}
                onSave={(v) => patch({ stawka_odsetek_ustawowych: v })}
                placeholder="np. 11,25"
                suffix="%"
              />
            </div>
          </WierszPola>
        </SekcjaProfilu>

        <SekcjaProfilu tytul="Rezerwa podatkowa">
          <p className="px-3 py-2 text-[11px] leading-snug text-muted">
            Ile procent kwoty netto każdej faktury warto odłożyć na każdy z podatków — poglądowy wskaźnik, nie automat księgowy, nie zastępuje wyliczeń
            księgowej.
          </p>
          <WierszPola etykieta="VAT">
            <div className="w-[120px]">
              <NumberField value={s.rezerwa_vat_procent} onSave={(v) => patch({ rezerwa_vat_procent: v ?? 0 })} placeholder="0" suffix="%" />
            </div>
          </WierszPola>
          <WierszPola etykieta="PIT">
            <div className="w-[120px]">
              <NumberField value={s.rezerwa_pit_procent} onSave={(v) => patch({ rezerwa_pit_procent: v ?? 0 })} placeholder="0" suffix="%" />
            </div>
          </WierszPola>
          <WierszPola etykieta="ZUS">
            <div className="w-[120px]">
              <NumberField value={s.rezerwa_zus_procent} onSave={(v) => patch({ rezerwa_zus_procent: v ?? 0 })} placeholder="0" suffix="%" />
            </div>
          </WierszPola>
        </SekcjaProfilu>
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

/** Wiersz ustawienia: wspólny `WierszPola` + pole z buforem i zapisem na blur.
 *  Moduł 59, paczka F — wcześniej rysował własną etykietę NAD polem. */
function SField({
  label,
  value,
  onSave,
  placeholder,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <WierszPola etykieta={label}>
      <SFieldInput value={value} onSave={onSave} placeholder={placeholder} />
    </WierszPola>
  );
}

/** Samo pole, bez wiersza — dla miejsc, gdzie w jednym wierszu stoją dwa
 *  (kod i miasto). Bufor lokalny, żeby pisanie nie strzelało PATCH-em na
 *  każdą literę; zapis dopiero, gdy wartość naprawdę się zmieniła. */
function SFieldInput({ value, onSave, placeholder }: { value: string; onSave: (v: string) => void; placeholder?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onSave(v)}
      placeholder={placeholder}
      className="w-full rounded-lg border hairline bg-transparent py-1.5 text-[var(--fg)] placeholder:text-muted"
    />
  );
}

function SFieldTextarea({ value, onSave, placeholder }: { value: string; onSave: (v: string) => void; placeholder?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <textarea
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onSave(v)}
      placeholder={placeholder}
      rows={2}
      className="w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
    />
  );
}
