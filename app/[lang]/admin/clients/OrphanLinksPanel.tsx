"use client";

// Moduł 30 — „Powiąż wstecz": jednorazowy porządek po rekordach, które
// powstały przed naprawą przecieków `client_id`.
//
// Osobny panel, nie automat: Claude nie ma dostępu do produkcyjnej bazy
// (CLAUDE.md), a nawet gdyby miał, dopasowanie po nazwie/NIP-ie to poszlaka,
// nie dowód. Każdą propozycję zatwierdza właściciel osobno. Świadomie BEZ
// „powiąż wszystkie" — hurtowy guzik zamieniłby tę decyzję w klepnięcie.

import { useCallback, useEffect, useState } from "react";
import { IconRefresh } from "@tabler/icons-react";
import { useUI } from "../ui";
import { LinkPicker, invalidateLinkTargets } from "../LinkPicker";
import type { LinkTarget } from "@/lib/links";

type Orphan = {
  rodzaj: "offer" | "invoice";
  id: string;
  etykieta: string;
  klient_nazwa: string;
  klient_nip: string;
  propozycja: { clientId: string; clientNazwa: string; pewnosc: "nip" | "nazwa" } | null;
};

type ClientRow = { id: string; nazwa: string; nip: string };

const RODZAJ_LABEL: Record<Orphan["rodzaj"], string> = { offer: "Oferta", invoice: "Faktura" };

export function OrphanLinksPanel({ onClose }: { onClose: () => void }) {
  const { toast } = useUI();
  const [orphans, setOrphans] = useState<Orphan[] | null>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/links/orphans");
    if (!res.ok) {
      toast("Nie udało się wczytać listy.", "error");
      return;
    }
    const d = (await res.json()) as { orphans: Orphan[]; clients: ClientRow[] };
    setOrphans(d.orphans);
    setClients(d.clients);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const link = useCallback(
    async (o: Orphan, clientId: string, clientNazwa: string) => {
      setBusyId(o.id);
      const res = await fetch("/api/links/orphans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rodzaj: o.rodzaj, id: o.id, client_id: clientId }),
      });
      setBusyId(null);
      if (!res.ok) {
        toast("Nie udało się powiązać.", "error");
        return;
      }
      // Zdejmujemy wiersz lokalnie zamiast przeładowywać całą listę — inaczej
      // przy dłuższej liście wszystko podskakuje po każdym kliknięciu.
      setOrphans((prev) => prev?.filter((x) => !(x.id === o.id && x.rodzaj === o.rodzaj)) ?? prev);
      invalidateLinkTargets();
      toast(`Powiązano z klientem „${clientNazwa}".`);
    },
    [toast]
  );

  const targets: LinkTarget[] = clients.map((c) => ({
    kind: "client" as const,
    id: c.id,
    nazwa: c.nazwa || "(bez nazwy)",
    hint: c.nip ? `NIP ${c.nip}` : undefined,
    szukaj: `${c.nazwa ?? ""} ${c.nip ?? ""}`.toLowerCase(),
  }));

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[14px] font-medium text-[var(--fg)]">Powiąż wstecz</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="flex items-center gap-1 rounded-full border hairline px-2.5 py-1 text-[11px] text-muted hover:text-[var(--fg)]"
          >
            <IconRefresh size={12} /> Odśwież
          </button>
          <button
            onClick={onClose}
            className="rounded-full border hairline px-2.5 py-1 text-[11px] text-muted hover:text-[var(--fg)]"
          >
            Zamknij
          </button>
        </div>
      </div>

      <p className="mt-1 text-[12px] text-muted">
        Oferty i faktury bez powiązanego klienta — nie widać ich na karcie klienta ani na jego osi czasu, a
        projekt z takiej oferty nie dostanie kontaktu retencyjnego. Propozycje poniżej opierają się na
        zgodnej nazwie albo NIP-ie; nic nie dzieje się samo, każdą zatwierdzasz Ty.
      </p>

      {orphans === null ? (
        <p className="mt-4 text-center text-[12px] text-muted">Wczytywanie…</p>
      ) : orphans.length === 0 ? (
        <p className="mt-6 text-center text-[12.5px] text-muted">
          Wszystkie oferty i faktury mają powiązanego klienta. Nie ma tu nic do zrobienia.
        </p>
      ) : (
        <div className="mt-3 space-y-1.5">
          {orphans.map((o) => (
            <div
              key={`${o.rodzaj}:${o.id}`}
              className="flex items-center gap-3 rounded-lg border hairline px-3 py-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-[var(--fg)]">
                  <span className="text-muted">{RODZAJ_LABEL[o.rodzaj]}:</span> {o.etykieta}
                </span>
                <span className="block truncate text-[11px] text-muted">
                  {[o.klient_nazwa || "(bez nazwy nabywcy)", o.klient_nip && `NIP ${o.klient_nip}`]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>

              {o.propozycja ? (
                <button
                  disabled={busyId === o.id}
                  onClick={() => link(o, o.propozycja!.clientId, o.propozycja!.clientNazwa)}
                  className="shrink-0 rounded-full border hairline px-2.5 py-1 text-[11px] text-[var(--fg)] hover:bg-[var(--hairline)] disabled:opacity-50"
                  title={
                    o.propozycja.pewnosc === "nip"
                      ? "Zgodny NIP — dopasowanie pewne"
                      : "Zgodna nazwa firmy, ale bez NIP-u — sprawdź, czy to na pewno ten klient"
                  }
                >
                  Powiąż z „{o.propozycja.clientNazwa}"
                  {o.propozycja.pewnosc === "nazwa" && <span className="ml-1 text-muted">(wg nazwy)</span>}
                </button>
              ) : (
                <span className="shrink-0 text-[11px] text-muted">brak propozycji</span>
              )}

              <LinkPicker
                kinds={["client"]}
                targets={targets}
                value={{ client_id: null }}
                align="right"
                placeholder="wybierz…"
                onPick={(_next, picked) => {
                  if (picked) link(o, picked.id, picked.nazwa);
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
