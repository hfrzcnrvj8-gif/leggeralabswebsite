"use client";

// Etap 1 Modułu 4b — pole odbiorcy dla "Nowa wiadomość"/"Przekaż": wpisanie
// dowolnego adresu RĘCZNIE (decyzja właściciela 2026-07-15 — odbiorca nie
// musi być w CRM) + podpowiedź "z bazy" (klienci/leady z adresem e-mail),
// wzorem ClientPickerButton z ../components.tsx (faktury/oferty), ale
// zwracająca sam adres, nie cały rekord klienta.
import { useEffect, useState } from "react";
import { Popover } from "../Menu";

type ContactOption = { id: string; nazwa: string; email: string; type: "client" | "lead" };

/** Wspólne dociąganie klientów+leadów z adresem e-mail — jeden fetch na
 * otwarcie formularza wysyłki, współdzielony przez pole "Do" i "DW". */
export function useMailContacts(): ContactOption[] | null {
  const [contacts, setContacts] = useState<ContactOption[] | null>(null);
  useEffect(() => {
    void (async () => {
      const [clientsRes, leadsRes] = await Promise.all([
        fetch("/api/clients").then((r) => (r.ok ? r.json() : { clients: [] })),
        fetch("/api/leads").then((r) => (r.ok ? r.json() : { leads: [] })),
      ]);
      const clients: ContactOption[] = (clientsRes.clients ?? [])
        .filter((c: { email?: string }) => c.email)
        .map((c: { id: string; nazwa: string; email: string }) => ({ id: c.id, nazwa: c.nazwa, email: c.email, type: "client" as const }));
      const leads: ContactOption[] = (leadsRes.leads ?? [])
        .filter((l: { email?: string }) => l.email)
        .map((l: { id: string; firma: string; email: string }) => ({ id: l.id, nazwa: l.firma, email: l.email, type: "lead" as const }));
      setContacts([...clients, ...leads]);
    })();
  }, []);
  return contacts;
}

/** Pole "Do"/"DW": input z dowolnym adresem + przycisk "Z bazy" obok, który
 * wstawia adres wybranego klienta/leada. `multiple` pozwala doklejać kolejne
 * adresy po przecinku (pole DW) zamiast nadpisywać (pole Do). */
export function RecipientField({
  value,
  onChange,
  contacts,
  placeholder,
  multiple = false,
}: {
  value: string;
  onChange: (v: string) => void;
  contacts: ContactOption[] | null;
  placeholder: string;
  multiple?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border hairline bg-transparent px-3 py-2 text-[13px] outline-none focus:border-brand-purple/50"
      />
      {contacts && contacts.length > 0 && (
        <Popover
          width={280}
          align="right"
          trigger={(open) => (
            <button
              type="button"
              onClick={open}
              className="shrink-0 rounded-full border hairline px-2.5 py-1.5 text-[12px] text-muted hover:text-[var(--fg)]"
              title="Wybierz z klientów/leadów"
            >
              🔍 Z bazy
            </button>
          )}
        >
          {(close) => (
            <ContactPickerList
              contacts={contacts}
              onPick={(c) => {
                onChange(multiple && value.trim() ? `${value.trim()}, ${c.email}` : c.email);
                close();
              }}
            />
          )}
        </Popover>
      )}
    </div>
  );
}

function ContactPickerList({ contacts, onPick }: { contacts: ContactOption[]; onPick: (c: ContactOption) => void }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const filtered = needle ? contacts.filter((c) => `${c.nazwa} ${c.email}`.toLowerCase().includes(needle)) : contacts;
  return (
    <div className="max-h-72 overflow-y-auto">
      <div className="p-1.5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Szukaj klienta/leada…"
          autoFocus
          className="w-full rounded-md border hairline bg-transparent px-2 py-1 text-[12.5px] text-[var(--fg)] placeholder:text-muted"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="px-3 py-3 text-center text-[12px] text-muted">Brak dopasowań.</p>
      ) : (
        filtered.map((c) => (
          <button
            key={`${c.type}-${c.id}`}
            type="button"
            onClick={() => onPick(c)}
            className="flex w-full flex-col px-2.5 py-1.5 text-left hover:bg-[var(--hairline)]"
          >
            <span className="truncate text-[13px] text-[var(--fg)]">
              {c.type === "client" ? "👤" : "🎯"} {c.nazwa || "(bez nazwy)"}
            </span>
            <span className="truncate text-[11px] text-muted">{c.email}</span>
          </button>
        ))
      )}
    </div>
  );
}
