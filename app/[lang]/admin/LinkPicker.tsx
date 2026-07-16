"use client";

// Moduł 22 — jeden picker powiązań na cały panel.
//
// Zastępuje trzy wzorce robiące to samo (ClientPickerButton w components.tsx,
// własne selecty PropTrigger w ProjectDetailPanel, surowy <select> w
// CalendarView) i dokłada to, czego nie było nigdzie: wybór LEADA. Ta sama
// dźwignia co Modal.tsx/ViewTabs.tsx w Module 21 — jedno zachowanie, jedna
// klawiatura, jeden wygląd.
//
// Picker to JEDNO pole = JEDNA odpowiedź na „czyj to rekord". Wyłączność
// wyboru siedzi w linkValueFor() (lib/links.ts), nie tutaj.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Popover, MenuLabel, MenuDivider } from "./Menu";
import { IconCheck } from "@tabler/icons-react";
import {
  LINK_KIND_EMOJI,
  LINK_KIND_LABEL,
  LINK_KIND_LABEL_PLURAL,
  linkValueFor,
  pickedTarget,
  type LinkKind,
  type LinkTarget,
  type LinkValue,
} from "@/lib/links";

export { linkValueFor, pickedTarget };
export type { LinkKind, LinkTarget, LinkValue };

/* ---------------------------------------------------------------- listy --- */

type RawClient = { id: string; nazwa: string; nip?: string; miasto?: string; email?: string };
type RawLead = { id: string; firma: string; osoba_kontaktowa?: string; email?: string; status?: string };
type RawProject = { id: string; tytul: string; status?: string };

// Cache na moduł, nie na komponent: w jednym widoku LinkPicker potrafi
// wystąpić kilkanaście razy (wiersz w tabeli), a przed tym modułem KAŻDY z
// siedmiu ekranów ciągnął /api/clients osobno. Odpowiedź to lista rekordów
// firmy jednoosobowej — bez sensu pobierać ją w kółko.
const cache = new Map<LinkKind, Promise<LinkTarget[]>>();
const listeners = new Set<() => void>();

function fetchKind(kind: LinkKind): Promise<LinkTarget[]> {
  const cached = cache.get(kind);
  if (cached) return cached;

  const url = { client: "/api/clients", lead: "/api/leads", project: "/api/projects" }[kind];
  const p = fetch(url)
    .then((r) => (r.ok ? r.json() : null))
    .then((d): LinkTarget[] => {
      if (!d) return [];
      if (kind === "client") {
        return (d.clients ?? []).map((c: RawClient) => ({
          kind: "client" as const,
          id: c.id,
          nazwa: c.nazwa || "(bez nazwy)",
          hint: [c.nip, c.miasto].filter(Boolean).join(" · ") || undefined,
          szukaj: `${c.nazwa ?? ""} ${c.nip ?? ""} ${c.miasto ?? ""} ${c.email ?? ""}`.toLowerCase(),
        }));
      }
      if (kind === "lead") {
        return (d.leads ?? []).map((l: RawLead) => ({
          kind: "lead" as const,
          id: l.id,
          nazwa: l.firma || "(bez nazwy)",
          hint: [l.osoba_kontaktowa, l.status].filter(Boolean).join(" · ") || undefined,
          szukaj: `${l.firma ?? ""} ${l.osoba_kontaktowa ?? ""} ${l.email ?? ""}`.toLowerCase(),
        }));
      }
      return (d.projects ?? []).map((p2: RawProject) => ({
        kind: "project" as const,
        id: p2.id,
        nazwa: p2.tytul || "(bez tytułu)",
        hint: p2.status || undefined,
        szukaj: `${p2.tytul ?? ""}`.toLowerCase(),
      }));
    })
    .catch(() => [] as LinkTarget[]);

  cache.set(kind, p);
  return p;
}

/** Wyrzuca cache list — zawołaj po utworzeniu/zmianie nazwy klienta czy leada,
 * żeby picker nie pokazywał nieaktualnej listy do końca sesji. */
export function invalidateLinkTargets(kind?: LinkKind) {
  if (kind) cache.delete(kind);
  else cache.clear();
  listeners.forEach((fn) => fn());
}

/** Pobiera (raz na sesję) listy rekordów, z którymi można się powiązać. */
export function useLinkTargets(kinds: LinkKind[]): LinkTarget[] {
  const key = kinds.join(",");
  const [targets, setTargets] = useState<LinkTarget[]>([]);
  const alive = useRef(true);

  const load = useCallback(() => {
    Promise.all(key.split(",").map((k) => fetchKind(k as LinkKind))).then((lists) => {
      if (alive.current) setTargets(lists.flat());
    });
  }, [key]);

  useEffect(() => {
    alive.current = true;
    load();
    listeners.add(load);
    return () => {
      alive.current = false;
      listeners.delete(load);
    };
  }, [load]);

  return targets;
}

/* --------------------------------------------------------------- picker --- */

/** Wiersz pozycji — własny, nie MenuRow z Menu.tsx: potrzebny drugi wiersz
 * (NIP/miasto) i emoji rodzaju, a MenuRow jest jednowierszowy i typowany pod
 * MenuOption. Kolory celowo te same co MenuRow, żeby oba menu wyglądały jak
 * jedno. */
function LinkRow({
  target,
  selected,
  active,
  onPick,
}: {
  target: LinkTarget | null;
  selected: boolean;
  active: boolean;
  onPick: () => void;
}) {
  return (
    <button
      role="menuitemradio"
      aria-checked={selected}
      onClick={onPick}
      className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px] text-[#e9e9ea] hover:bg-[#232327] ${
        active ? "bg-[#232327]" : ""
      }`}
    >
      <span className="flex w-4 shrink-0 justify-center text-[12px]">
        {target ? LINK_KIND_EMOJI[target.kind] : "—"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{target ? target.nazwa : "brak powiązania"}</span>
        {target?.hint && <span className="block truncate text-[11px] text-[#8a8f98]">{target.hint}</span>}
      </span>
      {selected && <IconCheck size={14} className="shrink-0 text-[#8a8f98]" />}
    </button>
  );
}

/**
 * Pole „Powiązanie" — wybór jednego rekordu spośród `kinds`.
 *
 * @param kinds  Rodzaje do wyboru, w kolejności PIERWSZEŃSTWA (patrz
 *               pickedTarget). Zwykle `["client", "lead"]` dla osi kontaktu
 *               albo `["project"]` dla osi projektu.
 * @param value  Aktualne wartości kolumn rekordu.
 * @param onPick Dostaje gotowy `LinkValue` z już zastosowaną wyłącznością —
 *               wystarczy wysłać go PATCH-em.
 */
export function LinkPicker({
  kinds,
  value,
  onPick,
  targets: providedTargets,
  align = "left",
  disabled = false,
  placeholder = "— brak —",
  trigger,
}: {
  kinds: LinkKind[];
  value: LinkValue;
  onPick: (next: LinkValue, picked: LinkTarget | null) => void;
  /** Gotowa lista — gdy ekran i tak już ma pobranych klientów/leadów.
   * Pominięcie = picker pobiera sam (ze wspólnego cache). */
  targets?: LinkTarget[];
  align?: "left" | "right";
  disabled?: boolean;
  placeholder?: string;
  /** Własny wyzwalacz. Domyślnie pigułka z nazwą powiązanego rekordu. */
  trigger?: (picked: LinkTarget | null, open: () => void) => React.ReactNode;
}) {
  const fetched = useLinkTargets(providedTargets ? [] : kinds);
  const targets = providedTargets ?? fetched;
  const picked = pickedTarget(kinds, value, targets);

  if (disabled) {
    return (
      <span className="text-[12.5px] text-muted">{picked ? picked.nazwa : placeholder}</span>
    );
  }

  return (
    <Popover
      width={300}
      align={align}
      trigger={(open) =>
        trigger ? (
          trigger(picked, open)
        ) : (
          <button
            onClick={open}
            title={picked ? `${LINK_KIND_LABEL[picked.kind]}: ${picked.nazwa}` : "Powiąż z klientem lub leadem"}
            className="flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[12.5px] text-[var(--fg)] hover:bg-[var(--hairline)]"
          >
            {picked ? (
              <>
                <span className="text-[11px]">{LINK_KIND_EMOJI[picked.kind]}</span>
                <span className="truncate">{picked.nazwa}</span>
              </>
            ) : (
              <span className="text-muted">{placeholder}</span>
            )}
          </button>
        )
      }
    >
      {(close) => (
        <LinkPickerList
          kinds={kinds}
          targets={targets}
          picked={picked}
          onPick={(t) => {
            onPick(linkValueFor(kinds, t), t);
            close();
          }}
        />
      )}
    </Popover>
  );
}

function LinkPickerList({
  kinds,
  targets,
  picked,
  onPick,
}: {
  kinds: LinkKind[];
  targets: LinkTarget[];
  picked: LinkTarget | null;
  onPick: (t: LinkTarget | null) => void;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  const needle = q.trim().toLowerCase();
  const matches = useMemo(
    () => (needle ? targets.filter((t) => t.szukaj.includes(needle)) : targets),
    [targets, needle]
  );

  // Płaska lista w kolejności wyświetlania — po niej chodzą strzałki, żeby
  // klawiatura zgadzała się z tym, co widać (nagłówki sekcji przeskakuje).
  const flat = useMemo(() => {
    const list: (LinkTarget | null)[] = [null];
    for (const kind of kinds) list.push(...matches.filter((t) => t.kind === kind));
    return list;
  }, [kinds, matches]);

  useEffect(() => setActive(0), [needle]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active < flat.length) onPick(flat[active] ?? null);
    }
  };

  return (
    <div>
      <div className="p-1.5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          placeholder="Szukaj klienta lub leada…"
          autoFocus
          className="w-full rounded-md border hairline bg-transparent px-2 py-1 text-[12.5px] text-[var(--fg)] placeholder:text-muted"
        />
      </div>

      <div className="max-h-72 overflow-y-auto">
        <LinkRow
          target={null}
          selected={!picked}
          active={active === 0}
          onPick={() => onPick(null)}
        />

        {kinds.map((kind) => {
          const rows = matches.filter((t) => t.kind === kind);
          if (rows.length === 0) return null;
          return (
            <div key={kind}>
              <MenuDivider />
              <MenuLabel>{LINK_KIND_LABEL_PLURAL[kind]}</MenuLabel>
              {rows.map((t) => (
                <LinkRow
                  key={`${t.kind}:${t.id}`}
                  target={t}
                  selected={picked?.kind === t.kind && picked.id === t.id}
                  active={flat[active] === t}
                  onPick={() => onPick(t)}
                />
              ))}
            </div>
          );
        })}

        {matches.length === 0 && (
          <p className="px-3 py-3 text-center text-[12px] text-muted">Brak dopasowań.</p>
        )}
      </div>
    </div>
  );
}
