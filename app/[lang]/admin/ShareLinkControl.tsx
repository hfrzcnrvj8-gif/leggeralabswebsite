"use client";

import { useState } from "react";
import { IconUnlink, IconRefresh, IconLoader2 } from "@tabler/icons-react";
import { useUI } from "./ui";
import { formatPlDate } from "@/lib/projects";
import type { ShareLinkKind } from "@/lib/shareLinks";

/** Moduł 40 — „Unieważnij link" / „Wygeneruj nowy" w panelu.
 *
 * Jeden komponent na pięć rodzajów publicznych linków (oferta, umowa/NDA,
 * faktura, wezwanie, formularz opinii), bo różnią się wyłącznie rodzajem
 * przekazywanym do trasy. Mieszka w korzeniu `admin/` z tego samego powodu co
 * `icons.tsx`: dzieli go kilka modułów naraz, więc żaden nie jest właścicielem.
 *
 * Nie renderuje nic, dopóki link nie istnieje (`hasToken === false`) — dopóki
 * właściciel nie kliknął „Wyślij mailem", nie ma czego unieważniać, a pusty
 * przycisk tylko myli.
 *
 * Unieważnienie NIE kasuje tokenu (patrz lib/shareLinks.ts) — dlatego po nim
 * widać datę, a nie „brak linku".
 */
export function ShareLinkControl({
  kind,
  id,
  hasToken,
  revokedAt,
  etykieta,
  onChanged,
}: {
  kind: ShareLinkKind;
  id: string;
  hasToken: boolean;
  revokedAt: string | null;
  /** Dopełnienie do zdania „Unieważnić link do …?" — np. „tej oferty". */
  etykieta: string;
  /** Wołane po udanej operacji; `url` tylko przy wygenerowaniu nowego linku. */
  onChanged: (revokedAt: string | null, url?: string) => void;
}) {
  const { confirm, toast } = useUI();
  const [busy, setBusy] = useState(false);

  if (!hasToken) return null;

  const run = async (action: "revoke" | "regenerate") => {
    if (action === "revoke") {
      const ok = await confirm(
        `Unieważnić link do ${etykieta}? Każdy, kto go ma — także osoba, której klient przesłał maila dalej — przestanie mieć dostęp. Nowy link można wygenerować później.`,
        { danger: true }
      );
      if (!ok) return;
    } else {
      const ok = await confirm(
        `Wygenerować nowy link do ${etykieta}? Poprzedni przestanie działać na zawsze. Nowy trzeba wysłać klientowi ponownie — sam z siebie nigdzie nie pójdzie.`
      );
      if (!ok) return;
    }
    setBusy(true);
    const res = await fetch(`/api/share-links/${kind}/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    const data = (await res.json().catch(() => ({}))) as { revokedAt?: string; url?: string; error?: string };
    if (!res.ok) {
      toast(data.error ?? "Nie udało się zmienić linku", "error");
      return;
    }
    if (action === "revoke") {
      toast("Link unieważniony");
      onChanged(data.revokedAt ?? new Date().toISOString());
    } else {
      toast("Nowy link gotowy — wyślij go klientowi");
      onChanged(null, data.url);
    }
  };

  if (revokedAt) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
          <IconUnlink size={13} />
          Link unieważniony {formatPlDate(revokedAt)}
        </div>
        <button
          onClick={() => run("regenerate")}
          disabled={busy}
          className="flex w-full items-center justify-center gap-1.5 rounded-full border hairline px-3 py-1.5 text-xs text-muted hover:text-[var(--fg)] disabled:opacity-50"
        >
          {busy ? <IconLoader2 size={13} className="animate-spin" /> : <IconRefresh size={13} />}
          Wygeneruj nowy link
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => run("revoke")}
      disabled={busy}
      title="Odbiera dostęp każdemu, kto ma ten link"
      className="flex w-full items-center justify-center gap-1.5 rounded-full border hairline px-3 py-1.5 text-xs text-muted hover:text-[var(--fg)] disabled:opacity-50"
    >
      {busy ? <IconLoader2 size={13} className="animate-spin" /> : <IconUnlink size={13} />}
      Unieważnij link
    </button>
  );
}
