"use client";

import { useEffect, useMemo, useState } from "react";
import { IconX } from "@tabler/icons-react";
import { type CompanySettings, DEFAULT_COMPANY_SETTINGS } from "@/lib/invoices";
import { useUI } from "../ui";
import { SekcjaProfilu, WierszPola } from "../ProfileSection";

/**
 * ZNALEZISKO D4 — „Dane firmy" nie miały przycisku Zapisz.
 *
 * Okno miało jedno wyjście („Zamknij") i zapisywało pole po polu, przy
 * opuszczeniu pola. Wyglądało dokładnie jak formularz z OK/Anuluj, więc
 * łatwo było uwierzyć, że zamknięcie oznacza porzucenie zmian — a zmiany
 * były już w bazie i szły na każdą kolejną fakturę.
 *
 * Decyzja właściciela (2026-08-02): klasyczny formularz. Zmiany siedzą
 * w pamięci, „Zapisz" wysyła je razem, zamknięcie z niezapisanymi zmianami
 * pyta. To zachowanie zgodne z tym, jak okno WYGLĄDA — o to szło w D4.
 */
export function CompanySettingsPanel({
  onClose,
  onBrudne,
}: {
  onClose: () => void;
  /** Zgłasza na zewnątrz, czy są niezapisane zmiany — modal nadrzędny pyta
   *  o nie przy zamknięciu kliknięciem w tło albo Escape'em, których ten
   *  komponent nie widzi. */
  onBrudne?: (brudne: boolean) => void;
}) {
  const { toast, confirm } = useUI();
  /** Stan ZAPISANY — to, co naprawdę siedzi w bazie. */
  const [zapisane, setZapisane] = useState<CompanySettings | null>(null);
  /** Stan EDYTOWANY — bufor, z którego nic nie wychodzi do bazy bez „Zapisz". */
  const [s, setS] = useState<CompanySettings | null>(null);
  const [zapisywanie, setZapisywanie] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        const dane = { ...DEFAULT_COMPANY_SETTINGS, ...(d.settings ?? {}) };
        setZapisane(dane);
        setS(dane);
      });
  }, []);

  /** Zmiana pola — TYLKO w buforze. Żadnego żądania. */
  const patch = (p: Partial<CompanySettings>) => {
    setS((prev) => (prev ? { ...prev, ...p } : prev));
  };

  // Co się różni od stanu zapisanego. Liczone z porównania, nie ze śledzenia
  // „ktoś coś kliknął": wpisanie wartości i cofnięcie jej z powrotem nie jest
  // zmianą, a pytanie o porzucenie niezmienionych danych byłoby fałszywym
  // alarmem — czyli dokładnie tym, co uczy klikać bez czytania.
  const zmienione = useMemo(() => {
    if (!s || !zapisane) return {} as Partial<CompanySettings>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(s) as (keyof CompanySettings)[]) {
      if (s[k] !== zapisane[k]) out[k] = s[k];
    }
    return out as Partial<CompanySettings>;
  }, [s, zapisane]);
  const brudne = Object.keys(zmienione).length > 0;

  useEffect(() => {
    onBrudne?.(brudne);
  }, [brudne, onBrudne]);

  const zapisz = async () => {
    if (!brudne || !s) return;
    setZapisywanie(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(zmienione),
    });
    setZapisywanie(false);
    if (!res.ok) {
      toast("Nie udało się zapisać.", "error");
      return;
    }
    setZapisane(s);
    onBrudne?.(false);
    toast("Dane firmy zapisane.");
    onClose();
  };

  const anuluj = async () => {
    if (brudne) {
      const ok = await confirm("Porzucić niezapisane zmiany w danych firmy?", { danger: true });
      if (!ok) return;
    }
    onBrudne?.(false);
    onClose();
  };

  if (!s) {
    return <div className="h-64 animate-pulse rounded-lg bg-[var(--hairline)]" />;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Dane firmy (sprzedawca)</h2>
        <button onClick={anuluj} className="flex items-center gap-1 rounded-full border hairline px-2.5 py-1 text-xs text-muted hover:text-[var(--fg)]">
          <IconX size={13} /> Zamknij
        </button>
      </div>
      <p className="mt-1 text-[12px] text-muted">
        Te dane trafiają na każdą fakturę. Zmiany zapisuje przycisk <span className="text-[var(--fg)]">Zapisz</span> na dole — zamknięcie okna ich nie zapisuje.
      </p>

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

      {/* Pasek zapisu — przyklejony do dołu okna, bo lista ustawień jest
          dłuższa niż ekran, a przycisk, do którego trzeba doscrollować, jest
          przyciskiem, którego się nie znajduje. */}
      <div className="sticky bottom-0 -mx-5 mt-5 flex items-center justify-end gap-2 border-t hairline bg-[var(--bg)] px-5 pt-3 sm:-mx-6 sm:px-6">
        <span className="mr-auto text-[11px] text-muted">
          {brudne
            ? `Niezapisane zmiany: ${Object.keys(zmienione).length}`
            : "Wszystko zapisane"}
        </span>
        <button onClick={anuluj} className="rounded-full border hairline px-3 py-1.5 text-xs">
          Anuluj
        </button>
        <button
          onClick={zapisz}
          disabled={!brudne || zapisywanie}
          className="rounded-full bg-[var(--fg)] px-3 py-1.5 text-xs font-medium text-[var(--bg)] hover:opacity-90 disabled:opacity-40"
        >
          {zapisywanie ? "Zapisuję…" : "Zapisz"}
        </button>
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
  // Tu bufor ZOSTAJE — inaczej „11," w trakcie wpisywania byłoby liczbą
  // niepoprawną i pole kasowałoby się pod palcem. Ale wartość trafia do
  // bufora formularza już przy pisaniu (gdy da się ją odczytać), nie dopiero
  // na `onBlur` — patrz komentarz przy `SFieldInput`.
  const [v, setV] = useState(value == null ? "" : String(value));
  useEffect(() => setV(value == null ? "" : String(value)), [value]);
  const commit = (tekst: string) => {
    const trimmed = tekst.trim().replace(",", ".");
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
        onChange={(e) => {
          setV(e.target.value);
          commit(e.target.value);
        }}
        onBlur={() => commit(v)}
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
 *  (kod i miasto).
 *
 *  Od Fazy 4 pisze WPROST do bufora formularza, bez własnego stanu i bez
 *  czekania na `onBlur`. Bufor lokalny istniał po to, żeby pisanie nie
 *  strzelało PATCH-em na każdą literę — a od D4 zmiana pola nie wysyła już
 *  niczego. Zostawienie zapisu na `onBlur` niosłoby realne ryzyko: kliknięcie
 *  „Zapisz" tuż po wpisaniu wartości opierałoby się na kolejności zdarzeń
 *  blur → click, a gubi się wtedy dokładnie to pole, które właśnie się
 *  wpisało. */
function SFieldInput({ value, onSave, placeholder }: { value: string; onSave: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onSave(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border hairline bg-transparent py-1.5 text-[var(--fg)] placeholder:text-muted"
    />
  );
}

function SFieldTextarea({ value, onSave, placeholder }: { value: string; onSave: (v: string) => void; placeholder?: string }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onSave(e.target.value)}
      placeholder={placeholder}
      rows={2}
      className="w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
    />
  );
}
