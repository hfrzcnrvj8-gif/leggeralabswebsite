"use client";

import { useEffect, useState } from "react";
import { SekcjaProfilu, WierszPola } from "../ProfileSection";

const BRANZE = [
  "Kancelaria prawna",
  "Biuro rachunkowe",
  "Kancelaria notarialna",
  "Klinika stomatologiczna / prywatna",
  "Biuro nieruchomości",
  "Firma doradcza / consulting",
];

export function DiscoverPanel({
  open,
  onOpenChange,
  onDiscovered,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDiscovered: () => void;
}) {
  const [branza, setBranza] = useState(BRANZE[0]);
  const [lokalizacja, setLokalizacja] = useState("Warszawa Wilanów");
  const [ile, setIle] = useState(8);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/leads/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branza, lokalizacja, ile }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Coś poszło nie tak.");
        return;
      }
      setMessage(`Dodano ${data.added} nowych firm (pominięto ${data.skipped} duplikatów).`);
      onDiscovered();
    } catch {
      setError("Nie udało się połączyć z serwerem.");
    } finally {
      setLoading(false);
    }
  };

  // Komunikaty same znikają po chwili zamiast wisieć aż do kolejnej akcji.
  useEffect(() => {
    if (!message && !error) return;
    const t = window.setTimeout(() => {
      setMessage(null);
      setError(null);
    }, 6000);
    return () => window.clearTimeout(t);
  }, [message, error]);

  // Zamknięty panel nie rysuje NICZEGO.
  //
  // Do 2026-07-26 rysował tu własną pastylkę „Znajdź nowe leady", wiszącą nad
  // treścią na każdym widoku — a ta sama akcja siedzi w pasku ikon obok
  // eksportu i raportu (`ExpandingIconButton`) oraz w palecie poleceń. Dwa
  // wejścia do jednej funkcji, z czego jedno zajmowało wiersz nad Tablicą.
  // Zgłoszenie właściciela; wejściem zostaje ikona w pasku.
  if (!open) return null;

  return (
    <div className="card-paper w-full rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Znajdź nowe leady</h3>
        <button onClick={() => onOpenChange(false)} className="text-xs text-muted hover:text-[var(--fg)]">
          Zamknij
        </button>
      </div>
      {/* Moduł 59, paczka F+ — te same wiersze, co w profilach i pozostałych
          formularzach panelu (decyzja właściciela 2026-07-29). */}
      <SekcjaProfilu tytul="Czego szukać">
        <WierszPola etykieta="Branża">
          <select
            value={branza}
            onChange={(e) => setBranza(e.target.value)}
            className="rounded-lg border hairline bg-transparent px-2 py-1 text-[13px] text-[var(--fg)]"
          >
            {BRANZE.map((b) => (
              <option key={b} value={b} className="bg-[var(--bg-soft)] text-[var(--fg)]">
                {b}
              </option>
            ))}
          </select>
        </WierszPola>
        <WierszPola etykieta="Lokalizacja">
          <input
            value={lokalizacja}
            onChange={(e) => setLokalizacja(e.target.value)}
            className="w-full rounded-lg border hairline bg-transparent py-1 text-[var(--fg)]"
          />
        </WierszPola>
        <WierszPola etykieta="Ile firm" title="Najwyżej 15 na jedno wyszukanie">
          <input
            type="number"
            min={1}
            max={15}
            value={ile}
            onChange={(e) => setIle(Math.max(1, Math.min(15, Number(e.target.value) || 1)))}
            className="w-20 rounded-lg border hairline bg-transparent py-1 text-[var(--fg)]"
          />
          <span className="text-[12px] text-muted">max 15</span>
        </WierszPola>
      </SekcjaProfilu>
      <div className="mt-2 flex justify-end">
        <button
          onClick={run}
          disabled={loading}
          className="bg-[var(--fg)] text-[var(--bg)] hover:opacity-90 rounded-full px-4 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Szukam…" : "Szukaj"}
        </button>
      </div>
      {message && <p className="mt-2 text-xs text-emerald-400">{message}</p>}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <p className="mt-2 text-[11px] text-muted opacity-70">
        Dane pochodzą z OpenStreetMap (bez klucza API, bez modelu AI) — mogą być mniej kompletne niż z płatnych
        baz, ale nic tu nie jest "zmyślone".
      </p>
    </div>
  );
}
