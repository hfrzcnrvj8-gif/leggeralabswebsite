"use client";

// Faza 8 (2026-07-20) — kolejka wysyłki odłożonej.
//
// Ten ekran istnieje, bo **niewidoczna kolejka to najgorszy rodzaj kolejki**.
// Pokazujemy też pozycje JUŻ wysłane i nieudane, nie tylko oczekujące:
// „zniknęło z listy" jest nie do odróżnienia od „nigdy nie zadziałało",
// a przy wysyłce odłożonej właściciel musi móc sprawdzić, czy mail poszedł.
import { useCallback, useEffect, useState } from "react";
import { IconX, IconClock, IconCheck, IconAlertTriangle } from "@tabler/icons-react";
import { useUI } from "../ui";
import { formatPlDateTime } from "./shared";

type OutboxRow = {
  id: string;
  to_addr: string;
  subject: string;
  send_at: string;
  status: "queued" | "sending" | "sent" | "failed" | "cancelled";
  error: string | null;
  warnings: string | null;
  sent_at: string | null;
};

const STATUS_LABEL: Record<OutboxRow["status"], string> = {
  queued: "Czeka",
  sending: "Wysyłanie…",
  sent: "Wysłane",
  failed: "Nie poszło",
  cancelled: "Anulowane",
};

export function ScheduledView() {
  const { toast, confirm } = useUI();
  const [queue, setQueue] = useState<OutboxRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/mail/schedule");
    if (!res.ok) {
      toast("Nie udało się wczytać kolejki.", "error");
      return;
    }
    const data = await res.json();
    setQueue(Array.isArray(data.queue) ? data.queue : []);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const anuluj = useCallback(
    async (row: OutboxRow) => {
      const ok = await confirm(`Anulować wysyłkę „${row.subject || "(bez tematu)"}" do ${row.to_addr}?`);
      if (!ok) return;
      setBusy(row.id);
      try {
        const res = await fetch(`/api/mail/schedule?id=${encodeURIComponent(row.id)}`, { method: "DELETE" });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          // 409 = wiadomość zdążyła pójść. To nie awaria, tylko wyścig
          // z zegarem — pokazujemy powód i odświeżamy, żeby lista mówiła
          // prawdę o tym, co się właśnie stało.
          toast(data?.error || "Nie udało się anulować.", "error");
          await load();
          return;
        }
        toast("Anulowano — ta wiadomość nie zostanie wysłana.");
        await load();
      } finally {
        setBusy(null);
      }
    },
    [confirm, load, toast]
  );

  if (queue === null) return <p className="p-8 text-center text-sm text-muted opacity-60">Wczytuję…</p>;
  if (queue.length === 0) {
    return <p className="p-8 text-center text-sm text-muted opacity-60">Nic nie czeka w kolejce.</p>;
  }

  return (
    <div>
      <p className="border-b hairline px-4 py-2.5 text-[12px] text-muted">
        Godzina jest najwcześniejszym terminem, nie gwarantowanym — wysyłka rusza przy pierwszym wejściu w Pocztę po
        tej porze albo o 8:00 automatycznie.
      </p>
      <ul className="divide-y divide-[var(--hairline)]">
        {queue.map((q) => (
          <li key={q.id} className="px-4 py-3">
            <div className="flex items-center gap-2">
              {q.status === "sent" ? (
                <IconCheck size={13} className="shrink-0 text-muted" />
              ) : q.status === "failed" ? (
                <IconAlertTriangle size={13} className="shrink-0 text-brand-gold" />
              ) : (
                <IconClock size={13} className="shrink-0 text-muted" />
              )}
              <span className="min-w-0 flex-1 truncate text-[13px]">{q.subject || "(bez tematu)"}</span>
            </div>
            <p className="truncate text-[11px] text-muted">do {q.to_addr}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="shrink-0 rounded-full bg-[var(--hairline)] px-2 py-0.5 text-[12px] text-muted">
                {STATUS_LABEL[q.status]}
              </span>
              <span className="shrink-0 text-[11px] text-muted">
                {q.status === "sent" && q.sent_at ? formatPlDateTime(q.sent_at) : formatPlDateTime(q.send_at)}
              </span>
              {/* Anulować da się WYŁĄCZNIE to, co jeszcze czeka. Przy
                  'sending' mail może być już w powietrzu, przy 'sent' jest
                  u odbiorcy — przycisk, który wtedy nic nie robi, byłby
                  gorszy niż jego brak. */}
              {q.status === "queued" && (
                <button
                  onClick={() => void anuluj(q)}
                  disabled={busy === q.id}
                  className="shrink-0 rounded-full border hairline px-3 py-1.5 text-[12px] text-muted hover:text-[var(--fg)] disabled:opacity-50"
                >
                  <IconX size={12} className="mr-1 inline align-[-2px]" />
                  Anuluj
                </button>
              )}
            </div>
            {/* Powód niepowodzenia i ostrzeżenia pokazujemy WPROST przy
                pozycji. Ostrzeżenie znaczy „mail poszedł, ale coś obok się
                nie udało" — i nie wolno na nie reagować ponowną wysyłką. */}
            {q.error && <p className="mt-1.5 text-[11px] text-brand-gold">{q.error}</p>}
            {q.warnings && <p className="mt-1.5 text-[11px] text-muted">{q.warnings}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
