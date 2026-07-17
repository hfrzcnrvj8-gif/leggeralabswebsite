"use client";

// Etap 1 Modułu 4b — pole odbiorcy dla "Nowa wiadomość"/"Przekaż": chipy
// (jak Apple Mail) zamiast gołego tekstu, żeby dało się mieć NAPRAWDĘ kilku
// odbiorców w jednym polu (Do/DW/UDW) — nie tylko tekst po przecinku, który
// serwer i tak dawniej parsował jako JEDEN adres dla "Do". Wpisanie
// dowolnego adresu RĘCZNIE (decyzja właściciela 2026-07-15 — odbiorca nie
// musi być w CRM) + podpowiedź "z bazy" (klienci/leady z adresem e-mail).
import { useEffect, useState } from "react";
import { IconSearch, IconUser, IconTarget } from "@tabler/icons-react";
import { Popover } from "../Menu";
import { parseAddressList } from "./shared";

type ContactOption = { id: string; nazwa: string; email: string; type: "client" | "lead" };

/** Wspólne dociąganie klientów+leadów z adresem e-mail — jeden fetch na
 * otwarcie formularza wysyłki, współdzielony przez pola Do/DW/UDW. */
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

/** Pole "Do"/"DW"/"UDW": chipy usuwalne + input do dopisywania kolejnych +
 * przycisk "Z bazy" obok. Enter/przecinek/blur/wklejenie z przecinkami
 * zamieniają wpisany tekst w chip(y) (przez parseAddressList — ten sam
 * parser co reszta modułu, więc "a@x.pl, b@y.pl" wklejone naraz daje dwa
 * chipy). Backspace na pustym polu usuwa ostatni chip (wzorem Apple Mail/
 * Gmaila). */
export function RecipientField({
  label,
  value,
  onChange,
  contacts,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  contacts: ContactOption[] | null;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    const parts = parseAddressList(raw);
    if (parts.length === 0) return;
    onChange(Array.from(new Set([...value, ...parts])));
    setDraft("");
  };

  return (
    <div className="flex items-start gap-1.5 border-b hairline py-2">
      <span className="mt-1.5 w-11 shrink-0 text-[12px] text-muted">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {value.map((email) => (
          <span key={email} className="flex items-center gap-1 rounded-full bg-[var(--hairline)] px-2 py-0.5 text-[12px]">
            {email}
            <button
              type="button"
              onClick={() => onChange(value.filter((v) => v !== email))}
              aria-label={`Usuń ${email}`}
              className="text-muted hover:text-[var(--fg)]"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit(draft);
            } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (/[,;]/.test(text)) {
              e.preventDefault();
              commit(text);
            }
          }}
          onBlur={() => {
            if (draft.trim()) commit(draft);
          }}
          placeholder={value.length === 0 ? placeholder : ""}
          className="min-w-[140px] flex-1 bg-transparent py-1 text-[13px] outline-none"
        />
      </div>
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
              <IconSearch size={13} />
            </button>
          )}
        >
          {(close) => (
            <ContactPickerList
              contacts={contacts}
              onPick={(c) => {
                onChange(Array.from(new Set([...value, c.email])));
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
              {c.type === "client" ? <IconUser size={12} className="mr-1 inline align-[-2px]" /> : <IconTarget size={12} className="mr-1 inline align-[-2px]" />}{c.nazwa || "(bez nazwy)"}
            </span>
            <span className="truncate text-[11px] text-muted">{c.email}</span>
          </button>
        ))
      )}
    </div>
  );
}
