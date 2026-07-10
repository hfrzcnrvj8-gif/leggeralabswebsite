"use client";

import {
  type Lead,
  STATUSES,
  STATUS_CLASS,
  daysSince,
  isOverdue,
  EditableText,
  EditableTextarea,
} from "./shared";

export function TableView({
  leads,
  onUpdate,
  onDelete,
}: {
  leads: Lead[];
  onUpdate: (id: string, field: string, value: string) => void;
  onDelete: (id: string, firma: string) => void;
}) {
  return (
    <div className="card-paper overflow-x-auto rounded-2xl">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b hairline bg-[var(--hairline)] text-left uppercase tracking-wide text-muted">
            <th className="p-2">Firma</th>
            <th className="p-2">Branża</th>
            <th className="p-2">Kontakt</th>
            <th className="p-2">Źródło</th>
            <th className="p-2">Status</th>
            <th className="p-2">Ostatni kontakt</th>
            <th className="p-2">Dni</th>
            <th className="p-2">Notatki</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const d = daysSince(lead.ostatni_kontakt);
            const overdueRow = isOverdue(lead);
            return (
              <tr
                key={lead.id}
                className={`border-b hairline align-top ${overdueRow ? "bg-orange-500/[0.06]" : ""}`}
              >
                <td className="p-2">
                  <EditableText value={lead.firma} onSave={(v) => onUpdate(lead.id, "firma", v)} />
                </td>
                <td className="p-2">
                  <EditableText value={lead.branza} onSave={(v) => onUpdate(lead.id, "branza", v)} />
                </td>
                <td className="p-2">
                  <EditableText value={lead.kontakt} onSave={(v) => onUpdate(lead.id, "kontakt", v)} />
                </td>
                <td className="p-2">
                  <EditableText value={lead.zrodlo} onSave={(v) => onUpdate(lead.id, "zrodlo", v)} />
                </td>
                <td className="p-2">
                  <select
                    value={lead.status}
                    onChange={(e) => onUpdate(lead.id, "status", e.target.value)}
                    className="mb-1 w-full rounded-lg border border-transparent bg-transparent text-xs text-[var(--fg)] hover:border-[var(--hairline)] focus:border-brand-cyan/60 focus:outline-none"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s} className="bg-[var(--bg-soft)] text-[var(--fg)]">
                        {s}
                      </option>
                    ))}
                  </select>
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CLASS[lead.status] ?? ""}`}
                  >
                    {lead.status}
                  </span>
                </td>
                <td className="p-2">
                  <input
                    type="date"
                    value={lead.ostatni_kontakt ?? ""}
                    onChange={(e) => onUpdate(lead.id, "ostatni_kontakt", e.target.value)}
                    className="rounded-lg border border-transparent bg-transparent text-xs text-[var(--fg)] hover:border-[var(--hairline)] focus:border-brand-cyan/60 focus:outline-none"
                  />
                </td>
                <td className="p-2">
                  {d === null ? (
                    "—"
                  ) : (
                    <span className={overdueRow ? "font-semibold text-orange-400" : "text-muted"}>{d} dni</span>
                  )}
                </td>
                <td className="p-2">
                  <EditableTextarea value={lead.notatki} onSave={(v) => onUpdate(lead.id, "notatki", v)} />
                </td>
                <td className="p-2">
                  <button
                    onClick={() => onDelete(lead.id, lead.firma)}
                    className="text-muted hover:text-red-400"
                    title="Usuń"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
