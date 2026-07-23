"use client";

import { useMemo, useState } from "react";
import {
  dobierz,
  DOMYSLNE_WEJSCIE,
  type Wejscie,
  type Zadanie,
  type Priorytet,
  type Kontekst,
  type Retencja,
  type Uptime,
  type NotatkaTyp,
} from "@/lib/dobor";

const ZADANIA: { id: Zadanie; label: string }[] = [
  { id: "chat", label: "Czat / asystent" },
  { id: "kod", label: "Kodowanie" },
  { id: "rag", label: "RAG na dokumentach" },
  { id: "dlugie", label: "Długie dokumenty" },
  { id: "tlumaczenia", label: "Tłumaczenia" },
];
const PRIORYTETY: { id: Priorytet; label: string }[] = [
  { id: "koszt", label: "Koszt / szybkość" },
  { id: "zrownowazony", label: "Zrównoważony" },
  { id: "jakosc", label: "Jakość / największy" },
];
const MODELE: { v: number | null; label: string }[] = [
  { v: null, label: "Auto (dobierz)" },
  { v: 8, label: "7–8B" },
  { v: 14, label: "13–14B" },
  { v: 32, label: "32B" },
  { v: 70, label: "70B" },
  { v: 120, label: "120B+" },
];
const KONTEKSTY: { v: Kontekst; label: string }[] = [
  { v: "krotki", label: "Krótki (< 4k)" },
  { v: "sredni", label: "Średni (8–16k)" },
  { v: "dlugi", label: "Długi (32k+)" },
];
const RETENCJE: { v: Retencja; label: string }[] = [
  { v: "brak", label: "Bez kopii" },
  { v: "kopie", label: "Kopie zapasowe" },
  { v: "wersje", label: "Wersjonowanie + retencja" },
];
const WZROSTY: { v: number; label: string }[] = [
  { v: 0, label: "Bez wzrostu" },
  { v: 0.25, label: "+25%" },
  { v: 0.5, label: "+50%" },
  { v: 1, label: "+100%" },
];
const UPTIMY: { v: Uptime; label: string }[] = [
  { v: "biuro", label: "Biurowa (8/5)" },
  { v: "wazna", label: "Ważna" },
  { v: "krytyczna", label: "Krytyczna (24/7)" },
];

const GRAD = "linear-gradient(105deg,#6d28d9 0%,#8a4bd6 42%,#b47a22 100%)";
const DOT: Record<NotatkaTyp, string> = { info: "bg-brand-cyan", ostrzezenie: "bg-brand-gold", dobre: "bg-emerald-400" };

const inputCls =
  "w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-[13px] text-[var(--fg)] focus:border-brand-purple focus:outline-none";

function fmt(n: number) {
  return n.toLocaleString("pl-PL");
}

export function KalkulatorDashboard() {
  const [w, setW] = useState<Wejscie>(DOMYSLNE_WEJSCIE);
  const rek = useMemo(() => dobierz(w), [w]);
  const set = <K extends keyof Wejscie>(k: K, v: Wejscie[K]) => setW((p) => ({ ...p, [k]: v }));
  const toggleZadanie = (z: Zadanie) =>
    setW((p) => ({ ...p, zadania: p.zadania.includes(z) ? p.zadania.filter((x) => x !== z) : [...p.zadania, z] }));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <header className="mb-1">
        <h1 className="text-liquid text-2xl font-semibold">Kalkulator doboru</h1>
      </header>
      <p className="mb-5 max-w-2xl text-[12.5px] text-muted">
        Wpisz odpowiedzi klienta — panel przelicza na żywo rekomendowany Tier, VRAM, RAM, dyski, UPS i sieć z bezpiecznym
        zapasem oraz orientacyjny koszt. To punkt wyjścia do wyceny, nie wiążąca specyfikacja.
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        {/* ── Ankieta ── */}
        <div className="space-y-4">
          <Sekcja tytul="Skala i użytkownicy">
            <div className="grid grid-cols-2 gap-3">
              <Pole label="Użytkownicy łącznie">
                <input type="number" min={1} max={1000} value={w.uzytkownicy}
                  onChange={(e) => set("uzytkownicy", Math.max(1, +e.target.value || 1))} className={inputCls} />
              </Pole>
              <Pole label="Szczyt równoczesnych" hint="Napędza liczbę/moc GPU.">
                <input type="number" min={1} max={500} value={w.szczyt}
                  onChange={(e) => set("szczyt", Math.max(1, +e.target.value || 1))} className={inputCls} />
              </Pole>
            </div>
          </Sekcja>

          <Sekcja tytul="Model i zadania">
            <Pole label="Główne zadania">
              <div className="flex flex-wrap gap-2">
                {ZADANIA.map((z) => (
                  <Chip key={z.id} aktywny={w.zadania.includes(z.id)} onClick={() => toggleZadanie(z.id)}>
                    {z.label}
                  </Chip>
                ))}
              </div>
            </Pole>
            <Pole label="Priorytet" hint="Jakość zwykle znaczy większy model i Q8 — więcej VRAM.">
              <div className="inline-flex flex-wrap gap-1 rounded-lg border hairline p-1">
                {PRIORYTETY.map((p) => (
                  <button key={p.id} onClick={() => set("priorytet", p.id)}
                    className={`rounded-md px-3 py-1.5 text-[12.5px] transition-colors ${
                      w.priorytet === p.id ? "bg-brand-purple/15 font-medium text-brand-purple" : "text-muted hover:text-[var(--fg)]"
                    }`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </Pole>
            <div className="grid grid-cols-2 gap-3">
              <Pole label="Rozmiar modelu">
                <select value={w.rozmiarModelu ?? "auto"}
                  onChange={(e) => set("rozmiarModelu", e.target.value === "auto" ? null : +e.target.value)} className={inputCls}>
                  {MODELE.map((m) => (
                    <option key={m.label} value={m.v ?? "auto"}>{m.label}</option>
                  ))}
                </select>
              </Pole>
              <Pole label="Długość kontekstu">
                <select value={w.kontekst} onChange={(e) => set("kontekst", e.target.value as Kontekst)} className={inputCls}>
                  {KONTEKSTY.map((k) => (
                    <option key={k.v} value={k.v}>{k.label}</option>
                  ))}
                </select>
              </Pole>
            </div>
          </Sekcja>

          <Sekcja tytul="Dane i RAG">
            <div className="grid grid-cols-2 gap-3">
              <Pole label="Dane do RAG (GB)" hint="0 = bez RAG.">
                <input type="number" min={0} value={w.ragGB}
                  onChange={(e) => set("ragGB", Math.max(0, +e.target.value || 0))} className={inputCls} />
              </Pole>
              <Pole label="Wzrost 12–24 mies.">
                <select value={w.wzrost} onChange={(e) => set("wzrost", +e.target.value)} className={inputCls}>
                  {WZROSTY.map((g) => (
                    <option key={g.v} value={g.v}>{g.label}</option>
                  ))}
                </select>
              </Pole>
            </div>
            <Pole label="Kopie i retencja">
              <select value={w.retencja} onChange={(e) => set("retencja", e.target.value as Retencja)} className={inputCls}>
                {RETENCJE.map((r) => (
                  <option key={r.v} value={r.v}>{r.label}</option>
                ))}
              </select>
            </Pole>
          </Sekcja>

          <Sekcja tytul="Niezawodność i dostęp">
            <Pole label="Tryb pracy / krytyczność">
              <select value={w.uptime} onChange={(e) => set("uptime", e.target.value as Uptime)} className={inputCls}>
                {UPTIMY.map((u) => (
                  <option key={u.v} value={u.v}>{u.label}</option>
                ))}
              </select>
            </Pole>
            <div className="mt-1 flex flex-wrap gap-2">
              <Chip aktywny={w.vpn} onClick={() => set("vpn", !w.vpn)}>Zdalny dostęp (VPN)</Chip>
            </div>
          </Sekcja>

          <Sekcja tytul="Co klient już ma (reużycie)">
            <div className="flex flex-wrap gap-2">
              <Chip aktywny={w.maNas} onClick={() => set("maNas", !w.maNas)}>NAS</Chip>
              <Chip aktywny={w.maSiec} onClick={() => set("maSiec", !w.maSiec)}>Sieć / switch</Chip>
              <Chip aktywny={w.maUps} onClick={() => set("maUps", !w.maUps)}>UPS</Chip>
            </div>
          </Sekcja>
        </div>

        {/* ── Wynik ── */}
        <aside className="lg:sticky lg:top-6">
          <div className="card-paper overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ background: GRAD }}>
              <span className="font-mono text-[12px] font-semibold uppercase tracking-wider text-white/85">Rekomendacja</span>
              <span className="rounded-full border border-white/40 bg-white/20 px-3 py-1 font-mono text-[12px] font-bold text-white backdrop-blur">
                Tier {rek.tier}
                {rek.liczbaGpu > 1 ? ` · ${rek.liczbaGpu}× GPU` : ""}
              </span>
            </div>

            <div className="space-y-4 p-4">
              <div>
                <div className="text-[18px] font-bold text-[var(--fg)]">
                  Model {rek.params}B · {rek.quant}
                </div>
                <div className="text-[12px] text-muted">{rek.opisWejscia}</div>
              </div>

              <div className="divide-y divide-[var(--hairline)]">
                <Spec k="GPU / VRAM" v={`${rek.liczbaGpu > 1 ? `${rek.liczbaGpu}× ` : ""}${rek.kartaNazwa}`}
                  pod={`${rek.vramPotrzebne} GB z zapasem · masz ${rek.vramMasz} GB`} />
                <Spec k="RAM" v={`${rek.ram} GB DDR5${rek.ram >= 256 ? " ECC RDIMM" : ""}`} />
                <Spec k="Dysk NVMe" v={`${rek.ssdTB} TB`} pod="system + modele + baza RAG" />
                <Spec k="NAS + dyski" v={rek.nas} />
                <Spec k="UPS" v={rek.ups} />
                <Spec k="Sieć" v={rek.siec} />
              </div>

              <div className="rounded-xl border border-brand-gold/30 bg-brand-gold/10 p-3">
                <div className="font-mono text-[11px] font-semibold uppercase tracking-wide text-brand-gold">
                  Orientacyjny koszt — sprzęt + wdrożenie
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-liquid font-mono text-[22px] font-bold">
                    {Math.round(rek.kosztMin / 1000)}–{Math.round(rek.kosztMax / 1000)} tys. zł
                  </span>
                  <span className="text-[13px] text-muted">netto</span>
                </div>
                <div className="mt-0.5 text-[12px] text-muted">
                  + serwis {fmt(rek.serwisMin)}–{fmt(rek.serwisMax)} zł/mies
                </div>
              </div>

              <div className="space-y-2">
                {rek.notatki.map((n, i) => (
                  <div key={i} className="flex items-start gap-2 text-[12px] text-muted">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${DOT[n.typ]}`} />
                    <span>{n.tekst}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="border-t hairline bg-[var(--hairline)]/20 px-4 py-3 text-[11.5px] text-muted">
              Wynik orientacyjny, liczony z zapasem. Ceny to widełki na lipiec 2026 — zweryfikuj u dostawcy i potwierdź
              testem modelu na danych klienta.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Sekcja({ tytul, children }: { tytul: string; children: React.ReactNode }) {
  return (
    <section className="card-paper rounded-xl p-4">
      <h2 className="mb-3 font-mono text-[11px] font-medium uppercase tracking-wider text-muted">{tytul}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Pole({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-0.5 block text-[11px] text-muted opacity-70">{hint}</span>}
    </label>
  );
}

function Chip({ aktywny, onClick, children }: { aktywny: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[12.5px] transition-colors ${
        aktywny ? "border-brand-purple bg-brand-purple/10 font-medium text-brand-purple" : "hairline text-muted hover:text-[var(--fg)]"
      }`}
    >
      {children}
    </button>
  );
}

function Spec({ k, v, pod }: { k: string; v: string; pod?: string }) {
  return (
    <div className="flex items-baseline gap-3 py-2.5">
      <span className="w-24 shrink-0 font-mono text-[11.5px] text-muted">{k}</span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold text-[var(--fg)]">{v}</span>
        {pod && <span className="mt-0.5 block text-[11.5px] text-muted">{pod}</span>}
      </span>
    </div>
  );
}
