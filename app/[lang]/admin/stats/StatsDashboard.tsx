"use client";

import { formatMoney } from "@/lib/invoices";
import { stopienPilnosci, PILNOSC_TEXT } from "@/lib/kolorStanu";
import { odmienPl } from "@/lib/dates";

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
import { StanBledu } from "../StanPusty";
import { zglosWygasnieciesesji } from "../strazSesji";

type StatsData = {
  months: string[];
  firstResponse: { avgHours: number | null; trend: StatsTrendPoint[] };
  conversion: {
    totalLeads: number;
    convertedLeads: number;
    pct: number | null;
    trend: StatsTrendPoint[];
    bySource: { zrodlo: string; totalLeads: number; convertedLeads: number; pct: number | null }[];
  };
  projectHealth: { counts: Record<string, number>; total: number };
  /** „Papier przed pracą" — przeniesione z Pulpitu 2026-08-06.
   * `null`, gdy nie ma ani jednego projektu z klientem. */
  paperFirst: { rate: number; withContract: number; total: number } | null;
  dso: {
    avgDays: number | null;
    oldestOverdueDays: number | null;
    overdueCount: number;
    /** Reszta do zapłaty ze wszystkich faktur po terminie (PLN). */
    overdueAmount: number;
    trend: StatsTrendPoint[];
  };
  reviews: { closedProjectsCount: number; reviewsCollected: number; pct: number | null; avgClientRating: number | null };
  referral: { totalLeads: number; referralLeads: number; pct: number | null; nurtureAsksSent: number; trend: StatsTrendPoint[] };
  timeTracking: { totalHours: number; trend: StatsTrendPoint[] };
  /** Druga połowa bilansu (przegląd szwów, 2026-08-06). `?`, bo starsza
   *  odpowiedź serwera tego klucza nie ma — ekran ma wtedy milczeć, nie paść. */
  koszty?: {
    wOknie: number;
    przychodWOknie: number;
    zyskWOknie: number;
    bezKursu: number;
    trend: StatsTrendPoint[];
    zyskTrend: StatsTrendPoint[];
  };
  /** Pętla poprawy sita „Łowcy leadów" (Moduł 52) — patrz komentarz przy
   * kafelku niżej. */
  /** Runda 2 Modułu 57 — powody odrzucenia ofert. */
  offerLosses: {
    reasons: { powod: string; ile: number; kwota: number }[];
    total: number;
    totalKwota: number;
  };
  hunter: {
    byGrade: { ocena: string; wzietych: number; klientow: number; pct: number | null }[];
    topRejections: { powod: string; ile: number }[];
  };
};

function formatHours(h: number): string {
  if (h < 24) return `${Math.round(h)} godz.`;
  return `${(h / 24).toFixed(1)} dni`;
}

/**
 * `valueClass` nadpisuje gradient marki kolorem NIOSĄCYM ZNACZENIE (audyt
 * Faktur, 2026-07-31). Domyślnie zostaje `text-liquid`, czyli tożsamość bez
 * znaczenia — tak jest na wszystkich pozostałych kaflach i tak ma zostać.
 * Wyjątek dostaje tylko ten kafel, na którym „jak bardzo" jest osobnym
 * pytaniem: kwota zaległości, kolorowana rampą pilności liczoną z DATY,
 * nie ze słownika statusów.
 */
function StatCard({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="card-paper rounded-xl border hairline p-4">
      <div className="text-[11px] text-muted">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${valueClass ?? "text-liquid"}`}>{value}</div>
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
          // Sesja wygasła: NIE przeładowujemy (etap 3). Przeładowanie kasowało
          // niezapisany formularz bez ostrzeżenia — pasek ze `strazSesji.ts`
          // mówi, co się stało, i pozwala zalogować się bez opuszczania ekranu.
          zglosWygasnieciesesji();
          return null;
        }
        if (!res.ok) throw new Error(`Serwer zwrócił błąd ${res.status}.`);
        return res.json();
      })
      .then((d) => d && setData(d))
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Nie udało się wczytać statystyk."));
  }, []);

  if (loadError) {
    // Do paczki E był tu goły czerwony akapit — bez ikony i bez drogi wyjścia.
    // Czerwień w tym panelu jest zarezerwowana dla akcji niszczącej (kat. 1),
    // a nieudane wczytanie nie niszczy niczego, tylko wymaga powtórzenia.
    return (
      <div className="-mx-4 p-6 sm:-mx-6">
        <div className="card-paper rounded-2xl">
          <StanBledu blad={loadError} onPonow={() => window.location.reload()} />
        </div>
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
              ? `najstarsza zaległość: ${data.dso.oldestOverdueDays} dni (${data.dso.overdueCount} ${odmienPl(
                  data.dso.overdueCount,
                  "faktura",
                  "faktury",
                  "faktur"
                )})`
              : "brak zaległych faktur"
          }
        />
        {/* Zaległości KWOTĄ, nie liczbą faktur (audyt Faktur, 2026-07-31).
            Kafel DSO obok mówi „ile dni" i „ile faktur" — a pytanie, po które
            właściciel tu zagląda, brzmi „ile mi wiszą". Dane były liczone
            w trasie od zawsze i wyrzucane. Kolor z rampy pilności: dopóki
            najstarsza zaległość mieści się w progu zaniedbania, to pomarańcz,
            a nie czerwień — czerwień znaczy „obietnica zerwana". */}
        <StatCard
          label="Zaległości (kwota)"
          value={formatMoney(data.dso.overdueAmount)}
          valueClass={
            data.dso.overdueAmount > 0 ? PILNOSC_TEXT[stopienPilnosci(data.dso.oldestOverdueDays)] : undefined
          }
          sub={
            data.dso.overdueCount > 0
              ? `${data.dso.overdueCount} ${odmienPl(data.dso.overdueCount, "faktura", "faktury", "faktur")} po terminie — tylko złotówki`
              : "wszystko zapłacone w terminie"
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
        {/* „Papier przed pracą" (Moduł 31, cel 100%) — przeprowadzone z Pulpitu
            2026-08-06. Miejsce jest tu, bo to wskaźnik trzymania wzorca pracy,
            a nie liczba wymagająca dziś reakcji. Liczone TYLKO po projektach
            klienckich: projekt wewnętrzny nie ma z kim podpisać umowy, więc
            wliczanie go zaniżałoby wskaźnik na stałe. */}
        <StatCard
          label="Papier przed pracą"
          value={data.paperFirst ? `${Math.round(data.paperFirst.rate * 100)}%` : "—"}
          // ŚWIADOMIE NIE `PILNOSC_TEXT` — tamta rampa mówi „ile dni po
          // terminie", a tu żaden termin nie minął: to praca u klienta bez
          // podpisanej umowy. Kolor marki zamiast generycznego `amber-500`,
          // którego ten kafel używał na Pulpicie (paleta z `tailwind.config.ts`).
          valueClass={data.paperFirst && data.paperFirst.rate < 1 ? "text-brand-orange" : undefined}
          sub={
            data.paperFirst
              ? `${data.paperFirst.withContract}/${data.paperFirst.total} projektów klienckich z podpisaną umową`
              : "brak projektów z klientem — nie ma czego mierzyć"
          }
        />
        {/* Przegląd szwów (2026-08-06). Do tego dnia ten ekran mówił wyłącznie,
            ile firma SPRZEDAŁA. Zysk stoi obok kosztów celowo — sama suma
            wydatków bez przychodu obok nie odpowiada na żadne pytanie.
            Kolor: zysk ujemny to jedyny stan, który tu naprawdę „się pali". */}
        {data.koszty && (
          <StatCard
            label="Koszty (12 mies.)"
            value={formatMoney(data.koszty.wOknie)}
            sub={
              data.koszty.bezKursu > 0
                ? `bez ${data.koszty.bezKursu} ${odmienPl(data.koszty.bezKursu, "kosztu", "kosztów", "kosztów")} w obcej walucie — brak kursu`
                : "netto, po kursie z wpisu"
            }
          />
        )}
        {data.koszty && (
          <div className="card-paper rounded-xl border hairline p-4">
            <div className="text-[11px] text-muted">Zysk (12 mies.)</div>
            <div
              className={`mt-1 text-lg font-semibold ${
                data.koszty.zyskWOknie < 0 ? "text-brand-red-soft" : "text-[var(--fg)]"
              }`}
            >
              {formatMoney(data.koszty.zyskWOknie)}
            </div>
            <div className="mt-0.5 text-[11px] text-muted">
              {formatMoney(data.koszty.przychodWOknie)} przychodu − {formatMoney(data.koszty.wOknie)} kosztów · tylko złotówki
            </div>
          </div>
        )}
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
        {data.koszty && (
          <ChartCard title="Koszty" sub="suma netto wg miesiąca wydatku, po kursie z wpisu">
            <TrendChart points={data.koszty.trend} formatValue={(v) => formatMoney(v)} />
          </ChartCard>
        )}
        {data.koszty && (
          <ChartCard title="Zysk" sub="przychód minus koszty, wg miesiąca — tylko złotówki">
            <TrendChart points={data.koszty.zyskTrend} formatValue={(v) => formatMoney(v)} />
          </ChartCard>
        )}
        {/* Nie tylko "ile leadów wpada" z danego źródła (kafel "Leady z
            polecenia" wyżej) — które źródło faktycznie ZAMIENIA SIĘ w
            klienta. Luka odnotowana w mapie drogi klienta, Etap 1. */}
        <ChartCard title="Konwersja per źródło" sub="które źródło leada faktycznie zamienia się w klienta, nie tylko generuje leady">
          {data.conversion.bySource.length === 0 ? (
            <p className="text-sm text-muted opacity-60">Brak leadów.</p>
          ) : (
            <div className="space-y-1.5">
              {data.conversion.bySource.map((s) => (
                <div key={s.zrodlo} className="flex items-center gap-2 text-[12px]">
                  <span className="min-w-0 flex-1 truncate">{s.zrodlo}</span>
                  <span className="tabular-nums text-muted">
                    {s.convertedLeads}/{s.totalLeads}
                  </span>
                  <span className="w-12 shrink-0 text-right tabular-nums font-medium">
                    {s.pct != null ? `${s.pct}%` : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
        {/* Łowca leadów (Moduł 52) — to jest CAŁA jego pętla uczenia się, bez
            grama AI: dwie liczby, po których widać, które pokrętło sita
            (`lib/leadHunter.ts`) przekręcić. Jeśli „A" nie konwertuje lepiej
            niż „B", wagi są źle rozłożone; jeśli jeden powód odrzucenia
            dominuje, źle stoi próg wieku albo lista PKD. */}
        <ChartCard
          title="Łowca leadów — czy ocena coś znaczy"
          sub="konwersja przyjętych kandydatów na klientów, wg oceny nadanej przez sito"
        >
          {data.hunter.byGrade.every((g) => g.wzietych === 0) ? (
            <p className="text-sm text-muted opacity-60">
              Żaden kandydat łowcy nie trafił jeszcze do rejestru leadów — nie ma czego porównywać.
            </p>
          ) : (
            <div className="space-y-1.5">
              {data.hunter.byGrade.map((g) => (
                <div key={g.ocena} className="flex items-center gap-2 text-[12px]">
                  <span className="min-w-0 flex-1">Ocena {g.ocena}</span>
                  <span className="tabular-nums text-muted">
                    {g.klientow}/{g.wzietych}
                  </span>
                  <span className="w-12 shrink-0 text-right font-medium tabular-nums">
                    {g.pct != null ? `${g.pct}%` : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
          {data.hunter.topRejections.length > 0 && (
            <div className="mt-3 border-t hairline pt-2">
              <div className="mb-1 text-[11px] text-muted">Najczęstsze powody odrzucenia</div>
              {data.hunter.topRejections.map((r) => (
                <div key={r.powod} className="flex items-center gap-2 text-[12px]">
                  <span className="min-w-0 flex-1 truncate">{r.powod}</span>
                  <span className="shrink-0 tabular-nums text-muted">{r.ile}×</span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
        {/* „Na czym przegrywamy" (runda 2 Modułu 57). Powody zbierają się przy
            każdym odrzuceniu oferty — to jedyne miejsce, w którym zamieniają
            się w liczbę. Kwota obok liczby, bo pięć drobnych ofert przegranych
            na cenie znaczy co innego niż jedna duża. */}
        <ChartCard
          title="Dlaczego przegrywamy oferty"
          sub="powody odrzucenia zapisane przy zmianie statusu; bez ofert zastąpionych nowszą wersją"
        >
          {data.offerLosses.reasons.length === 0 ? (
            <p className="text-sm text-muted opacity-60">
              Żadna oferta nie została jeszcze odrzucona — albo odrzucenia zapisano bez powodu. Powód
              pyta się sam przy ustawianiu statusu „Odrzucona”.
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                {data.offerLosses.reasons.map((r) => (
                  <div key={r.powod} className="flex items-center gap-2 text-[12px]">
                    <span className="min-w-0 flex-1 truncate">{r.powod}</span>
                    <span className="shrink-0 tabular-nums text-muted">{formatMoney(r.kwota)}</span>
                    <span className="w-10 shrink-0 text-right font-medium tabular-nums">{r.ile}×</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 border-t hairline pt-2 text-[11px] text-muted">
                Razem {data.offerLosses.total} przegranych ofert na {formatMoney(data.offerLosses.totalKwota)}.
              </div>
            </>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
