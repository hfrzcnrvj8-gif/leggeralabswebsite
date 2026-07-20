"use client";

// Faza 8 (2026-07-20) — ekran „Subskrypcje": masówka pogrupowana po nadawcy.
//
// Najtańsza funkcja modułu i największy zysk: dane leżą w bazie od Modułu 4
// (`list_unsubscribe_url` z nagłówka RFC 2369), brakowało tylko ekranu.
//
// Osobny plik, a nie kolejna gałąź w MailDashboard.tsx (1300 linii) — ten
// widok ma własne dane, własne akcje i nic nie dzieli z listą wiadomości poza
// miejscem w interfejsie.
import { useCallback, useEffect, useState } from "react";
import { IconExternalLink, IconTrash, IconMailOff } from "@tabler/icons-react";
import { useUI } from "../ui";
import { type MailSubscription } from "./shared";

export function SubscriptionsView({ onChanged }: { onChanged: () => void | Promise<void> }) {
  const { toast, confirm } = useUI();
  const [subs, setSubs] = useState<MailSubscription[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/mail/subscriptions");
    if (!res.ok) {
      toast("Nie udało się wczytać listy subskrypcji.", "error");
      return;
    }
    const data = await res.json();
    setSubs(Array.isArray(data.subscriptions) ? data.subscriptions : []);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Posprzątanie po nadawcy — kasuje TYLKO roboczą kopię w panelu.
   *
   * Pytamy o potwierdzenie, bo to operacja masowa, i mówimy wprost, że
   * oryginały zostają na serwerze pocztowym: bez tego zdania właściciel
   * mógłby uznać, że panel wyczyścił mu skrzynkę, i zdziwić się w Outlooku. */
  const wyczysc = useCallback(
    async (s: MailSubscription) => {
      const ok = await confirm(
        `Usunąć ${s.ile} wiadomości od ${s.from_name || s.from_addr}? Znikną z panelu, ale na serwerze pocztowym zostają — panel trzyma tylko roboczą kopię, więc przy kolejnej synchronizacji mogą wrócić, jeśli nie wypiszesz się z listy.`,
        { danger: true }
      );
      if (!ok) return;

      setBusy(s.from_addr);
      try {
        const res = await fetch(`/api/mail/subscriptions?from=${encodeURIComponent(s.from_addr)}`, { method: "DELETE" });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          toast(data?.error || "Nie udało się usunąć wiadomości.", "error");
          return;
        }
        toast(`Usunięto ${data.usuniete} wiadomości.`);
        await load();
        await onChanged();
      } finally {
        setBusy(null);
      }
    },
    [confirm, load, onChanged, toast]
  );

  if (subs === null) return <p className="p-8 text-center text-sm text-muted opacity-60">Wczytuję…</p>;
  if (subs.length === 0) {
    return <p className="p-8 text-center text-sm text-muted opacity-60">Żadnych list dystrybucyjnych — skrzynka czysta.</p>;
  }

  return (
    <div>
      <p className="border-b hairline px-4 py-2.5 text-[12px] text-muted">
        Nadawcy masowi, od najgłośniejszego. „Wypisz się” otwiera stronę nadawcy; „Usuń” sprząta tylko panel.
      </p>
      <ul className="divide-y divide-[var(--hairline)]">
        {/* Dwie linie, nie jedna. Kolumna listy w Poczcie jest wąska (siedzi
            między folderami a podglądem), więc wiersz jednoliniowy ściskał
            nazwę nadawcy do „Skle…" — czyli kasował JEDYNĄ informację, po
            której właściciel ma tu kogokolwiek rozpoznać. Zmierzone na
            zrzucie, nie założone. */}
        {subs.map((s) => (
          <li key={s.from_addr} className="px-4 py-3">
            <p className="truncate text-[13px]">{s.from_name || s.from_addr}</p>
            <p className="truncate text-[11px] text-muted">{s.from_addr}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="shrink-0 rounded-full bg-[var(--hairline)] px-2 py-0.5 text-[12px] text-muted">
                {s.ile} {s.ile === 1 ? "wiadomość" : "wiadomości"}
              </span>
              {/* Linku wypisania bywa brak — nie każdy nadawca podaje
                  List-Unsubscribe. Wtedy pokazujemy wyszarzoną informację
                  zamiast przycisku prowadzącego donikąd. */}
              {s.unsubscribe_url ? (
                <a
                  href={s.unsubscribe_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-full border hairline px-3 py-1.5 text-[12px] text-muted hover:text-[var(--fg)]"
                >
                  <IconExternalLink size={12} className="mr-1 inline align-[-2px]" />
                  Wypisz się
                </a>
              ) : (
                <span
                  className="shrink-0 rounded-full border hairline px-3 py-1.5 text-[12px] text-muted opacity-50"
                  title="Ten nadawca nie podał adresu wypisania w nagłówkach wiadomości."
                >
                  <IconMailOff size={12} className="mr-1 inline align-[-2px]" />
                  Brak wypisu
                </span>
              )}
              <button
                onClick={() => void wyczysc(s)}
                disabled={busy === s.from_addr}
                className="shrink-0 rounded-full border hairline px-3 py-1.5 text-[12px] text-muted hover:text-[var(--fg)] disabled:opacity-50"
              >
                <IconTrash size={12} className="mr-1 inline align-[-2px]" />
                Usuń
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
