"use client";

import { useEffect, useState } from "react";
import { IconDeviceMobile, IconX } from "@tabler/icons-react";
import { Modal } from "./Modal";
import { useUI } from "./ui";

// Urządzenia zalogowane tokenem (Faza 1 aplikacji natywnej, 2026-07-19).
// Panel webowy loguje się ciasteczkiem i NIE pojawia się na tej liście —
// to wyłącznie klienci natywni (iPhone/iPad/Mac). Decyzja właściciela:
// tokeny per-urządzenie z możliwością odebrania — zgubiony telefon odcina
// się stąd, bez zmiany hasła.

type DeviceRow = {
  id: string;
  device_name: string;
  created_at: string;
  last_used_at: string;
  revoked_at: string | null;
};

function formatMoment(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pl-PL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function DevicesPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast, confirm } = useUI();
  const [devices, setDevices] = useState<DeviceRow[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setDevices(null);
    fetch("/api/admin/devices")
      .then((r) => r.json())
      .then((d) => setDevices(d.devices ?? []))
      .catch(() => setDevices([]));
  }, [open]);

  const revoke = async (device: DeviceRow) => {
    const ok = await confirm(`Odebrać dostęp urządzeniu „${device.device_name}"? Aplikacja na nim natychmiast się wyloguje.`, { danger: true });
    if (!ok) return;
    const res = await fetch(`/api/admin/devices/${device.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Nie udało się odebrać dostępu.", "error");
      return;
    }
    setDevices((prev) => prev?.map((d) => (d.id === device.id ? { ...d, revoked_at: new Date().toISOString() } : d)) ?? null);
    toast("Dostęp odebrany.");
  };

  return (
    <Modal open={open} onClose={onClose} card="card-paper mx-auto w-full max-w-lg rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Urządzenia</h2>
        <button onClick={onClose} className="flex items-center gap-1 rounded-full border hairline px-2.5 py-1 text-xs text-muted hover:text-[var(--fg)]">
          <IconX size={13} /> Zamknij
        </button>
      </div>
      <p className="mt-1 text-[12px] text-muted">
        Telefony i inne urządzenia zalogowane w aplikacji Leggera Hub. Zgubione urządzenie odetniesz tutaj — bez zmiany hasła.
      </p>

      <div className="mt-4 space-y-2">
        {devices === null && <div className="h-24 animate-pulse rounded-lg bg-[var(--hairline)]" />}
        {devices?.length === 0 && (
          <p className="rounded-lg border hairline px-3 py-4 text-center text-[12.5px] text-muted">
            Na razie pusto — urządzenie pojawi się tu po pierwszym zalogowaniu w aplikacji na iPhonie.
          </p>
        )}
        {devices?.map((d) => (
          <div key={d.id} className={`flex items-center gap-3 rounded-lg border hairline px-3 py-2.5 ${d.revoked_at ? "opacity-50" : ""}`}>
            <IconDeviceMobile size={18} className="shrink-0 text-muted" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] text-[var(--fg)]">{d.device_name}</div>
              <div className="text-[11px] text-muted">
                {d.revoked_at
                  ? `Dostęp odebrany ${formatMoment(d.revoked_at)}`
                  : `Ostatnio aktywne ${formatMoment(d.last_used_at)} · zalogowane ${formatMoment(d.created_at)}`}
              </div>
            </div>
            {!d.revoked_at && (
              <button
                onClick={() => revoke(d)}
                className="shrink-0 rounded-full border hairline px-2.5 py-1 text-[11.5px] text-red-400 hover:bg-red-400/10"
              >
                Odbierz dostęp
              </button>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
