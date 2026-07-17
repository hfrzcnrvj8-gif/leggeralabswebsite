"use client";

// Moduł 30 — „dla kogo jest ten dokument?" na starcie Oferty/Faktury.
//
// Do tego modułu „+ Nowa oferta"/„+ Nowa faktura" wysyłały `body: "{}"` i
// tworzyły rekord bez żadnego powiązania. Ponieważ panel nie ma ani jednego
// innego miejsca, z którego dałoby się utworzyć ofertę Z LEADA (sprawdzone
// gretem 2026-07-17), oznaczało to, że KAŻDA oferta i faktura rodziła się z
// `client_id = NULL` — a na tej kolumnie wisi karta klienta, oś czasu i
// kontakt retencyjny. Gałąź „załóż klienta z leada" w POST /api/offers była
// przez to martwa: nie istniał wołający, który podałby jej `lead_id`.
//
// Dialog jest MIĘKKI: „Na razie bez powiązania" to pełnoprawny wybór, nie
// kara. Zasada panelu to podpowiedzi, nie bramki (CLAUDE.md) — chodzi o to,
// żeby powiązanie było domyślną drogą, a nie o to, żeby zmusić do niego.
//
// Modal, nie popover przy przycisku, bo tworzenie idzie też z palety poleceń
// (skrót „n", useRegisterActions) — tam nie ma do czego się zakotwiczyć.

import { useEffect, useMemo, useState } from "react";
import { IconUsers } from "@tabler/icons-react";
import { Modal } from "./Modal";
import { MenuLabel, MenuDivider } from "./Menu";
import { useLinkTargets, invalidateLinkTargets } from "./LinkPicker";
import { LINK_KIND_LABEL_PLURAL, type LinkKind, type LinkTarget, type LinkValue } from "@/lib/links";
import { LinkKindIcon } from "./icons";
import { useUI } from "./ui";

const KINDS: LinkKind[] = ["client", "lead"];

/** Co dialog zwraca do wołającego — gotowe ciało POST-a.
 *
 * `{}` (pominięcie) tworzy dokument bez powiązania, dokładnie jak przed
 * Modułem 30. `{ lead_id }` uruchamia w POST /api/offers awans leada na
 * klienta; `{ client_id }` podpina istniejącego. */
export type NewDocumentLink = LinkValue;

export function NewDocumentDialog({
  open,
  onClose,
  onPick,
  tytul,
  opis,
  leadNote,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (link: NewDocumentLink) => void;
  tytul: string;
  opis: string;
  /** Dopisek przy leadach. Podaje go tylko Oferta („założy klienta"), bo tylko
   * POST /api/offers awansuje leada na klienta. Faktura tego świadomie nie
   * robi — awans to rola PIERWSZEJ OFERTY (lib/clients.ts) — więc nie może
   * tego obiecywać w interfejsie. */
  leadNote?: string;
}) {
  const { toast, prompt } = useUI();
  const targets = useLinkTargets(open ? KINDS : []);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  // Świeże otwarcie zaczyna od pustej wyszukiwarki — inaczej dialog pamięta
  // frazę z poprzedniego dokumentu i „nie ma nikogo na liście".
  useEffect(() => {
    if (open) setQ("");
  }, [open]);

  const needle = q.trim().toLowerCase();
  const matches = useMemo(
    () => (needle ? targets.filter((t) => t.szukaj.includes(needle)) : targets),
    [targets, needle]
  );

  const pickTarget = (t: LinkTarget) =>
    onPick(t.kind === "client" ? { client_id: t.id } : { lead_id: t.id });

  /** Nowy klient wpisany z ręki — na świeżym panelu to jedyna droga, bo
   * i lista klientów, i lista leadów są puste. */
  const createClient = async () => {
    const nazwa = (await prompt("Nazwa firmy nowego klienta:", { placeholder: "np. Kowalski Sp. z o.o." }))?.trim();
    if (!nazwa) return;
    setBusy(true);
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nazwa }),
    });
    setBusy(false);
    if (!res.ok) {
      toast("Nie udało się założyć klienta.", "error");
      return;
    }
    const { id } = (await res.json()) as { id: string };
    invalidateLinkTargets("client");
    onPick({ client_id: id });
  };

  return (
    <Modal open={open} onClose={onClose} card="card-paper my-auto w-full max-w-lg rounded-2xl border hairline p-4">
      <h2 className="text-[14px] font-medium text-[var(--fg)]">{tytul}</h2>
      <p className="mt-1 text-[12px] text-muted">{opis}</p>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Szukaj klienta lub leada…"
        autoFocus
        className="mt-3 w-full rounded-md border hairline bg-transparent px-2.5 py-1.5 text-[12.5px] text-[var(--fg)] placeholder:text-muted"
      />

      <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border hairline">
        {KINDS.map((kind) => {
          const rows = matches.filter((t) => t.kind === kind);
          if (rows.length === 0) return null;
          return (
            <div key={kind}>
              <MenuLabel>{LINK_KIND_LABEL_PLURAL[kind]}</MenuLabel>
              {rows.map((t) => (
                <button
                  key={`${t.kind}:${t.id}`}
                  onClick={() => pickTarget(t)}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-[var(--hairline)]"
                >
                  <span className="flex w-4 shrink-0 justify-center text-muted">
                    <LinkKindIcon kind={t.kind} size={13} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-[var(--fg)]">{t.nazwa}</span>
                    {t.hint && <span className="block truncate text-[11px] text-muted">{t.hint}</span>}
                  </span>
                  {t.kind === "lead" && leadNote && (
                    <span className="shrink-0 text-[10.5px] text-muted">{leadNote}</span>
                  )}
                </button>
              ))}
            </div>
          );
        })}

        {matches.length === 0 && (
          <p className="px-3 py-4 text-center text-[12px] text-muted">
            {targets.length === 0
              ? "Nie masz jeszcze żadnych klientów ani leadów."
              : "Brak dopasowań."}
          </p>
        )}
      </div>

      <MenuDivider />

      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          onClick={createClient}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12.5px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)] disabled:opacity-50"
        >
          <IconUsers size={13} /> Załóż nowego klienta
        </button>
        <button
          onClick={() => onPick({})}
          className="rounded-md px-2 py-1.5 text-[12.5px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]"
          title="Dokument powstanie bez powiązania — możesz je dodać później w edytorze"
        >
          Na razie bez powiązania
        </button>
      </div>
    </Modal>
  );
}
