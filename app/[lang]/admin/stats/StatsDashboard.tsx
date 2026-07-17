"use client";

// Statystyki (Moduł 18) — wskaźniki zdrowia biznesu z mapy drogi klienta
// (docs/plany-modulow/00-mapa-drogi-klienta.md, sekcja "Jak sprawdzić, że
// CAŁY system działa jak należy"): czas do 1. odpowiedzi, konwersja
// lead→klient, zdrowie projektów, DSO + wiek zaległości, % opinii,
// % poleceń. Wyłącznie agregacje SQL nad danymi, które już istnieją — zero
// AI, zero nowych tabel. Nagłówkowe liczby liczone OD POCZĄTKU działalności
// (decyzja właściciela), wykresy trendu pokazują ostatnie 12 miesięcy.

import { useEffect, useState } from "react";
import { PROJECT_HEALTHS, PROJECT_HEALTH_CLASS } from "@/lib/projects";
import type { StatsTrendPoint } from "@/lib/stats";
import { TrendChart } from "./TrendChart";

type StatsData = {
  months: string[];
  firstResponse: { avgHours: number | null; trend: StatsTrendPoint[] };
  conversion: { totalLeads: number; convertedLeads: number; pct: number | null; trend: StatsTrendPoint[] };
  projectHealth: { counts: Record<string, number>; total: number };
  dso: { avgDays: number | null; oldestOverdueDays: number | null; overdueCount: number; trend: StatsTrendPoint[] };
  reviews: { closedProjectsCount: number; reviewsCollected: number; pct: number | null; avgClientRating: number | null };
  referral: { totalLeads: number; referralLeads: number; pct: number | null; nurtureAsksSent: number; trend: StatsTrendPoint[] };
  timeTracking: { totalHours: number; trend: StatsTrendPoint[] };
};

function formatHours(h: number): string {
  if (h < 24) return `${Math.round(h)} godz.`;
  return `${(h / 24).toFixed(1)} dni`;
}

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="card-paper rounded-xl border hairline p-4">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="mt-1 text-liquid text-lg font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

function ChartCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="card-paper rounded-xl border hairline p-4">
      <div className="mb-2">
        <h2 className="text-[13px] font-medium">{title}</h2>
        {sub && <p className="text-[11px] text-muted">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

export function StatsDashboard() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => {
        if (res.status === 401) {
          window.location.reload();
          return null;
        }
        if (!res.ok) throw new Error(`Serwer zwrócił błąd ${res.status}.`);
        return res.json();
      })
      .then((d) => d && setData(d))
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Nie udało się wczytać statystyk."));
  }, []);

  if (loadError) {
    return (
      <div className="-mx-4 p-6 sm:-mx-6">
        <p className="text-sm text-red-400">{loadError}</p>
      </div>
    );
  }

  if (!data) {
    return (
      // `flex flex-1 flex-col md:min-h-0` (Moduł 35) — przekazuje wysokość okna w dół.
    <div className="-mx-4 flex flex-1 flex-col sm:-mx-6 md:min-h-0">
        <div className="grid grid-cols-2 gap-3 px-4 pt-4 sm:px-6 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-[var(--hairline)]" />
          ))}
        </div>
      </div>
    );
  }

  const healthTotal = data.projectHealth.total;

  return (
    <div className="-mx-4 sm:-mx-6">
      <div className="flex shrink-0 items-center border-b hairline px-4 sm:px-6" style={{ height: "44px" }}>
        <span className="text-[13px] text-muted">
          Statystyki — wskaźniki zdrowia biznesu, liczone od początku działalności.
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 pt-4 sm:px-6 lg:grid-cols-3">
        <StatCard
          label="Czas do 1. odpowiedzi (śr.)"
          value={data.firstResponse.avgHours != null ? formatHours(data.firstResponse.avgHours) : "—"}
          sub="od zgłoszenia leada do pierwszego wychodzącego kontaktu"
        />
        <StatCard
          label="Konwersja lead → klient"
          value={data.conversion.pct != null ? `${data.conversion.pct}%` : "—"}
          sub={`${data.conversion.convertedLeads}/${data.conversion.totalLeads} leadów`}
        />
        <StatCard
          label="DSO (śr. dni do zapłaty)"
          value={data.dso.avgDays != null ? `${data.dso.avgDays} dni` : "—"}
          sub={
            data.dso.oldestOverdueDays != null
              ? `najstarsza zaległość: ${data.dso.oldestOverdueDays} dni (${data.dso.overdueCount} ${
                  data.dso.overdueCount === 1 ? "faktura" : "faktur"
                })`
              : "brak zaległych faktur"
          }
        />
        <StatCard
          label="Opinie klientów"
          value={data.reviews.avgClientRating != null ? `★ ${data.reviews.avgClientRating.toFixed(1)}/5` : "—"}
          sub={`${data.reviews.reviewsCollected}/${data.reviews.closedProjectsCount} zamkniętych projektów z opinią${
            data.reviews.pct != null ? ` (${data.reviews.pct}%)` : ""
          }`}
        />
        <StatCard
          label="Leady z polecenia"
          value={data.referral.pct != null ? `${data.referral.pct}%` : "—"}
          sub={`${data.referral.referralLeads}/${data.referral.totalLeads} leadów · ${data.referral.nurtureAsksSent} razy zapytaliśmy`}
        />
        <StatCard
          label="Godziny pracy (łącznie)"
          value={data.timeTracking.totalHours > 0 ? `${data.timeTracking.totalHours} godz.` : "—"}
          sub="suma zalogowanego czasu, wszystkie projekty"
        />
        <div className="card-paper rounded-xl border hairline p-4">
          <div className="text-[11px] text-muted">Zdrowie projektów</div>
          <div className="mt-1.5 space-y-1">
            {PROJECT_HEALTHS.map((h) => {
              const n = data.projectHealth.counts[h] ?? 0;
              const pct = healthTotal > 0 ? Math.round((n / healthTotal) * 100) : 0;
              return (
                <div key={h} className="flex items-center gap-2 text-[11px]">
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 ${PROJECT_HEALTH_CLASS[h]}`}>{h}</span>
                  <span className="ml-auto tabular-nums text-muted">
                    {n} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-4 px-4 py-4 sm:px-6 lg:grid-cols-2">
        <ChartCard title="Czas do 1. odpowiedzi" sub="średnia godzin, wg miesiąca zgłoszenia leada">
          <TrendChart points={data.firstResponse.trend} formatValue={(v) => formatHours(v)} />
        </ChartCard>
        <ChartCard title="Konwersja lead → klient" sub="% leadów z danego miesiąca, które dziś mają klienta">
          <TrendChart points={data.conversion.trend} formatValue={(v) => `${v}%`} />
        </ChartCard>
        <ChartCard title="DSO" sub="średnia dni od wystawienia do zapłaty, wg miesiąca wystawienia faktury">
          <TrendChart points={data.dso.trend} formatValue={(v) => `${v} dni`} />
        </ChartCard>
        <ChartCard title="Leady z polecenia" sub="% leadów z danego miesiąca ze źródła „Polecenie”">
          <TrendChart points={data.referral.trend} formatValue={(v) => `${v}%`} />
        </ChartCard>
        <ChartCard title="Godziny pracy" sub="suma zalogowanego czasu, wg miesiąca wykonania pracy (wszystkie projekty)">
          <TrendChart points={data.timeTracking.trend} formatValue={(v) => `${v} godz.`} />
        </ChartCard>
      </div>
    </div>
  );
}
