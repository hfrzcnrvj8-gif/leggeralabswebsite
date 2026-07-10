"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Lead } from "@/lib/leads";
import { type Project, formatPlDate } from "@/lib/projects";
import type { HubEvent } from "@/lib/events";
import type { Note } from "@/lib/notes";
import { overdueReason } from "@/lib/leads";

type TodayData = {
  overdueLeads: Lead[];
  dueProjects: Project[];
  todayEvents: HubEvent[];
  recentNotes: Note[];
  counts: { leads: number; projects: number };
};

/** Pulpit dnia — jedno miejsce spinające wszystkie moduły: co dziś wymaga
 * działania (leady, projekty), co jest w kalendarzu, i ostatnie notatki.
 * To jest strona, od której zaczynasz każdy dzień pracy. */
export function DashboardHome({ lang }: { lang: Locale }) {
  const [data, setData] = useState<TodayData | null>(null);

  useEffect(() => {
    fetch("/api/hub/today")
      .then((res) => {
        if (res.status === 401) {
          window.location.reload();
          return null;
        }
        return res.json();
      })
      .then((d) => d && setData(d));
  }, []);

  if (!data) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-[var(--hairline)]" />
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-[var(--hairline)]" />
          ))}
        </div>
      </div>
    );
  }

  const totalActionable = data.overdueLeads.length + data.dueProjects.length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-xl font-semibold tracking-tight sm:text-2xl">
          Dzień dobry, <span className="text-liquid">Patryk</span>
        </h1>
        <p className="text-sm text-muted">
          {totalActionable === 0
            ? "Nic pilnego dziś nie czeka — dobry moment na rozwój, nie tylko gaszenie."
            : `${totalActionable} ${totalActionable === 1 ? "sprawa wymaga" : "spraw wymaga"} dziś działania.`}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card-paper rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-sm font-semibold">⚠ Leady wymagające działania</h2>
            <Link href={`/${lang}/admin/leads`} className="text-xs text-muted hover:text-[var(--fg)]">
              Zobacz wszystkie →
            </Link>
          </div>
          {data.overdueLeads.length === 0 ? (
            <p className="text-sm text-muted opacity-60">Nic — wszystko obsłużone.</p>
          ) : (
            <ul className="space-y-2">
              {data.overdueLeads.slice(0, 6).map((l) => (
                <li key={l.id} className="text-sm">
                  <Link href={`/${lang}/admin/leads/${l.id}`} className="font-medium hover:underline">
                    {l.firma}
                  </Link>
                  <span className="text-muted"> — {overdueReason(l)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-paper rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-sm font-semibold">⚠ Projekty z minionym terminem</h2>
            <Link href={`/${lang}/admin/projects`} className="text-xs text-muted hover:text-[var(--fg)]">
              Zobacz wszystkie →
            </Link>
          </div>
          {data.dueProjects.length === 0 ? (
            <p className="text-sm text-muted opacity-60">Nic — wszystko na czas.</p>
          ) : (
            <ul className="space-y-2">
              {data.dueProjects.slice(0, 6).map((p) => (
                <li key={p.id} className="text-sm">
                  <Link href={`/${lang}/admin/projects/${p.id}`} className="font-medium hover:underline">
                    {p.tytul}
                  </Link>
                  <span className="text-muted"> — termin {formatPlDate(p.termin)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-paper rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-sm font-semibold">Dziś w kalendarzu</h2>
            <Link href={`/${lang}/admin/calendar`} className="text-xs text-muted hover:text-[var(--fg)]">
              Otwórz kalendarz →
            </Link>
          </div>
          {data.todayEvents.length === 0 ? (
            <p className="text-sm text-muted opacity-60">🗓️ Brak wydarzeń na dziś.</p>
          ) : (
            <ul className="space-y-2">
              {data.todayEvents.map((e) => (
                <li key={e.id} className="text-sm">
                  {e.godzina && <span className="mr-1.5 text-muted">{e.godzina}</span>}
                  {e.tytul}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-paper rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-sm font-semibold">Ostatnie notatki</h2>
            <Link href={`/${lang}/admin/notes`} className="text-xs text-muted hover:text-[var(--fg)]">
              Otwórz notatnik →
            </Link>
          </div>
          {data.recentNotes.length === 0 ? (
            <p className="text-sm text-muted opacity-60">📝 Brak notatek.</p>
          ) : (
            <ul className="space-y-2">
              {data.recentNotes.map((n) => (
                <li key={n.id} className="text-sm">
                  <span className="font-medium">{n.tytul || "Bez tytułu"}</span>
                  {n.tresc && <span className="text-muted"> — {n.tresc.slice(0, 80)}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 text-xs text-muted">
        <span>W rejestrze: {data.counts.leads} leadów, {data.counts.projects} projektów.</span>
      </div>
    </div>
  );
}
