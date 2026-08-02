"use client";

/**
 * Propozycje — „panel proponuje, właściciel zatwierdza" (Faza 3).
 *
 * Jedna sekcja, wpięta w DWA miejsca: na Pulpicie (wszystkie propozycje,
 * `modul` pusty) i w module, którego dotyczą (Projekty/Leady/Klienci,
 * `modul` ustawiony). Nowego modułu świadomie NIE ma — propozycja to sprawa
 * do zrobienia dziś, więc mieszka tam, gdzie właściciel patrzy na sprawy
 * do zrobienia.
 *
 * ── Dlaczego kolor jest neutralny ─────────────────────────────────────────
 * Reszta „Wymaga działania dziś" jest pomarańczowa, bo mówi o zaległości.
 * Propozycja nie jest zaległa — panel zauważył skutek zdarzenia i pyta.
 * Wg słownika koloru (kolor niesie STAN i PILNOŚĆ, rodzaj niesie IKONA)
 * pomarańczowy tutaj kłamałby. Stąd cyjan marki na akcji i sama krawędź
 * `hairline` na „Nie teraz".
 *
 * Logika reguł nie mieszka tutaj, tylko w `lib/propozycje.ts` — panel wyłącznie
 * pokazuje zdanie i odsyła decyzję.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { IconBulb } from "@tabler/icons-react";
import { SPRING, TWEEN_EXIT } from "@/lib/motion";
import type { Locale } from "@/i18n/config";
import type { ModulPropozycji, Propozycja, StanPropozycji } from "@/lib/propozycje";
import { useUI } from "./ui";

type Props = {
  lang: Locale;
  /** Pusty = wszystkie (Pulpit). Ustawiony = tylko ten moduł. */
  modul?: ModulPropozycji;
  /** Pulpit przelicza po decyzji swój licznik „wymaga działania dziś". */
  onZmiana?: () => void;
  /** Na Pulpicie sekcja ma własną płytę; w module bywa wstawiona w cudzą. */
  bezPlyty?: boolean;
  /**
   * Stan wzięty z `/api/hub/today` — Pulpit i tak go pobiera, żeby policzyć
   * kafel „Wymaga działania dziś". Bez tego ekran pytałby o to samo dwa razy
   * i licznik przeskakiwałby po doładowaniu. Po pierwszej decyzji komponent
   * odświeża się już sam.
   */
  wstepne?: StanPropozycji;
};

export function Propozycje({ lang, modul, onZmiana, bezPlyty, wstepne }: Props) {
  const { toast } = useUI();
  const [propozycje, setPropozycje] = useState<Propozycja[] | null>(wstepne?.propozycje ?? null);
  const [odrzuconych, setOdrzuconych] = useState(wstepne?.odrzuconych ?? 0);
  const [pracuje, setPracuje] = useState<string | null>(null);
  const maWstepne = wstepne != null;

  const wczytaj = useCallback(async () => {
    const res = await fetch(`/api/hub/propozycje${modul ? `?modul=${modul}` : ""}`);
    if (!res.ok) {
      setPropozycje([]);
      return;
    }
    const d = (await res.json()) as StanPropozycji;
    setPropozycje(d.propozycje);
    setOdrzuconych(d.odrzuconych);
  }, [modul]);

  useEffect(() => {
    if (maWstepne) return;
    void wczytaj();
  }, [wczytaj, maWstepne]);

  const decyduj = async (p: Propozycja, decyzja: "zrob" | "odrzuc") => {
    const klucz = `${p.regula}:${p.rekordId}`;
    setPracuje(klucz);
    const res = await fetch("/api/hub/propozycje", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regula: p.regula, rekordId: p.rekordId, decyzja }),
    });
    const d = (await res.json().catch(() => ({}))) as { komunikat?: string; error?: string };
    setPracuje(null);

    if (!res.ok) {
      // 409 = stan zmienił się w międzyczasie. Lista i tak musi się odświeżyć,
      // inaczej właściciel klika w propozycję, której już nie ma.
      toast(d.error ?? "Nie udało się zapisać decyzji.", "error");
      await wczytaj();
      onZmiana?.();
      return;
    }
    toast(d.komunikat ?? "Zapisano.");
    await wczytaj();
    onZmiana?.();
  };

  const przywrocWszystkie = async () => {
    const res = await fetch("/api/hub/propozycje?odrzucone=1");
    if (!res.ok) return;
    const d = (await res.json()) as { odrzucone?: { regula: string; rekordId: string }[] };
    for (const o of d.odrzucone ?? []) {
      await fetch("/api/hub/propozycje", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regula: o.regula, rekordId: o.rekordId, decyzja: "przywroc" }),
      });
    }
    toast("Odłożone propozycje wróciły na listę.");
    await wczytaj();
    onZmiana?.();
  };

  // Nic do pokazania i nic odłożonego — sekcja znika zupełnie. Pulpit jest
  // ekranem „co dziś zrobić", nie tablicą kontrolną: pusta sekcja „Propozycje:
  // brak" uczyłaby wyłącznie przewijania (ta sama zasada co przy kopiach
  // zapasowych i automatach wyżej na Pulpicie).
  if (!propozycje || (propozycje.length === 0 && odrzuconych === 0)) return null;

  const tresc = (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[13px] font-medium">
          <IconBulb size={14} className="text-brand-cyan" />
          Propozycje
        </h2>
        {odrzuconych > 0 && (
          <button onClick={przywrocWszystkie} className="text-xs text-muted hover:text-[var(--fg)]">
            Odłożone ({odrzuconych}) — przywróć
          </button>
        )}
      </div>

      {propozycje.length === 0 ? (
        <p className="text-sm text-muted opacity-60">
          Nic nowego — {odrzuconych === 1 ? "jedna propozycja jest" : `${odrzuconych} propozycje są`} odłożone.
        </p>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {propozycje.map((p) => {
              const klucz = `${p.regula}:${p.rekordId}`;
              const zajete = pracuje === klucz;
              return (
                <motion.li
                  key={klucz}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: TWEEN_EXIT }}
                  transition={SPRING}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <Link href={`/${lang}${p.link.replace(/^\/pl/, "")}`} className="min-w-0 hover:underline">
                    {p.zdanie}
                  </Link>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => decyduj(p, "zrob")}
                      disabled={zajete}
                      className="rounded-full border border-brand-cyan/40 px-2 py-0.5 text-[11px] text-brand-cyan disabled:opacity-50"
                    >
                      {p.akcja}
                    </button>
                    <button
                      onClick={() => decyduj(p, "odrzuc")}
                      disabled={zajete}
                      className="rounded-full border hairline px-2 py-0.5 text-[11px] text-muted hover:text-[var(--fg)] disabled:opacity-50"
                      title="Nie teraz — ta propozycja już nie wróci (można ją przywrócić)"
                    >
                      Nie teraz
                    </button>
                  </span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </>
  );

  if (bezPlyty) return <div>{tresc}</div>;
  return <section className="plyta-sekcji rounded-xl p-4">{tresc}</section>;
}
