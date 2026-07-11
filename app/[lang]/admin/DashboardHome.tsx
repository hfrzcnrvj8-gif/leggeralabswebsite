"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Lead } from "@/lib/leads";
import { type Project, formatPlDate } from "@/lib/projects";
import type { HubEvent } from "@/lib/events";
import type { Note } from "@/lib/notes";
import { overdueReason } from "@/lib/leads";
import { useUI } from "./ui";

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
  const { toast, confirm } = useUI();
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

  const markLeadHandled = async (id: string) => {
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Przypomnienie wysłane", ostatni_kontakt: new Date().toISOString().slice(0, 10) }),
    });
    if (!res.ok) {
      toast("Nie udało się zapisać zmiany.", "error");
      return;
    }
    setData((prev) => (prev ? { ...prev, overdueLeads: prev.overdueLeads.filter((l) => l.id !== id) } : prev));
    toast("Lead oznaczony jako obsłużony.");
  };

  const markProjectDone = async (id: string, tytul: string) => {
    const ok = await confirm(`Oznaczyć "${tytul}" jako wdrożone?`);
    if (!ok) return;
    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Wdrożone" }),
    });
    if (!res.ok) {
      toast("Nie udało się zapisać zmiany.", "error");
      return;
    }
    setData((prev) => (prev ? { ...prev, dueProjects: prev.dueProjects.filter((p) => p.id !== id) } : prev));
    toast("Projekt oznaczony jako wdrożony.");
  };

  const removeEvent = async (id: string) => {
    const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Nie udało się usunąć wydarzenia.", "error");
      return;
    }
    setData((prev) => (prev ? { ...prev, todayEvents: prev.todayEvents.filter((e) => e.id !== id) } : prev));
  };

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
    <div className="-mx-4 sm:-mx-6">
      <div className="flex items-center border-b hairline px-4 sm:px-6" style={{ height: "44px" }}>
        <span className="text-[13px] text-muted">
          {totalActionable === 0
            ? "Pulpit — nic pilnego dziś nie czeka."
            : `Pulpit — ${totalActionable} ${totalActionable === 1 ? "sprawa wymaga" : "spraw wymaga"} dziś działania.`}
        </span>
      </div>

      <div className="grid gap-4 px-4 py-4 sm:px-6 lg:grid-cols-2">
        <section className="card-paper rounded-xl border hairline p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-medium">Leady wymagające działania</h2>
            <Link href={`/${lang}/admin/leads`} className="text-xs text-muted hover:text-[var(--fg)]">
              Zobacz wszystkie →
            </Link>
          </div>
          {data.overdueLeads.length === 0 ? (
            <p className="text-sm text-muted opacity-60">Nic — wszystko obsłużone.</p>
          ) : (
            <ul className="space-y-2">
              {data.overdueLeads.slice(0, 6).map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    <Link href={`/${lang}/admin/leads/${l.id}`} className="font-medium hover:underline">
                      {l.firma}
                    </Link>
                    <span className="text-muted"> — {overdueReason(l)}</span>
                  </span>
                  <button
                    onClick={() => markLeadHandled(l.id)}
                    className="shrink-0 rounded-full border border-orange-500/40 px-2 py-0.5 text-[11px] text-orange-400"
                  >
                    Obsłużone
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-paper rounded-xl border hairline p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-medium">Projekty z minionym terminem</h2>
            <Link href={`/${lang}/admin/projects`} className="text-xs text-muted hover:text-[var(--fg)]">
              Zobacz wszystkie →
            </Link>
          </div>
          {data.dueProjects.length === 0 ? (
            <p className="text-sm text-muted opacity-60">Nic — wszystko na czas.</p>
          ) : (
            <ul className="space-y-2">
              {data.dueProjects.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    <Link href={`/${lang}/admin/projects/${p.id}`} className="font-medium hover:underline">
                      {p.tytul}
                    </Link>
                    <span className="text-muted"> — termin {formatPlDate(p.termin)}</span>
                  </span>
                  <button
                    onClick={() => markProjectDone(p.id, p.tytul)}
                    className="shrink-0 rounded-full border border-orange-500/40 px-2 py-0.5 text-[11px] text-orange-400"
                  >
                    Wdrożone
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-paper rounded-xl border hairline p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-medium">Dziś w kalendarzu</h2>
            <Link href={`/${lang}/admin/calendar`} className="text-xs text-muted hover:text-[var(--fg)]">
              Otwórz kalendarz →
            </Link>
          </div>
          {data.todayEvents.length === 0 ? (
            <p className="text-sm text-muted opacity-60">🗓️ Brak wydarzeń na dziś.</p>
          ) : (
            <ul className="space-y-2">
              {data.todayEvents.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {e.godzina && <span className="mr-1.5 text-muted">{e.godzina}</span>}
                    {e.tytul}
                  </span>
                  <button
                    onClick={() => removeEvent(e.id)}
                    className="shrink-0 text-muted hover:text-red-400"
                    aria-label={`Usuń ${e.tytul}`}
                    title="Usuń"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-paper rounded-xl border hairline p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-medium">Ostatnie notatki</h2>
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

      <div className="flex flex-wrap gap-2 px-4 pb-4 text-xs text-muted sm:px-6">
        <span>W rejestrze: {data.counts.leads} leadów, {data.counts.projects} projektów.</span>
      </div>
    </div>
  );
}
