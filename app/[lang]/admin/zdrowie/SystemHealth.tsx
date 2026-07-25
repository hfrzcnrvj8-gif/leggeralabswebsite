"use client";

// Zdrowie systemu (2026-07-25) — jeden ekran z odpowiedzią na pytanie „co się
// zepsuło i dlaczego".
//
// Powstał ze zgłoszenia właściciela: dzienny mail meldował „nie udało się
// odczytać stanu kopii zapasowych" i nic ponadto. Przyczyna była zapisana w
// bazie (`error_log.szczegoly`) od Audytu 4 i **nie czytało jej nic** — panel
// nie miał widoku błędów, a mail drukował wyłącznie stałe zdanie z kodu.
// Powstała tabela, która zna odpowiedź, i człowiek, który jej nie zna.
//
// Ten ekran świadomie łamie zasadę Pulpitu („milcz, gdy jest dobrze"). Pulpit
// jest ekranem codziennym i musi milczeć. Tutaj wchodzisz WTEDY, gdy coś
// poszło nie tak — a wtedy cisza jest bezużyteczna. Dlatego pokazujemy też
// stany zdrowe: „ostatnia kopia 6 godz. temu" to informacja, „(pusto)" nie.

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EASE_LIQUID, SPRING } from "@/lib/motion";
import {
  IconAlertTriangle,
  IconChevronRight,
  IconCircleCheck,
  IconRefresh,
  IconRobot,
} from "@tabler/icons-react";
import { parsePgTimestamp } from "@/lib/dates";
import { opisWieku, type BackupStan, type BackupRun } from "@/lib/backup";
import { wymagaUwagi, type AutomationRun, type StanAutomatu } from "@/lib/observability";
import type { WpisBledu } from "@/lib/errorLog";

type Dane = {
  kopie: BackupStan | null;
  kopieHistoria: BackupRun[];
  bladKopii: string | null;
  automaty: StanAutomatu[] | null;
  przebiegi: AutomationRun[] | null;
  bladAutomatow: string | null;
  bledy: WpisBledu[] | null;
  bladBledow: string | null;
};

/** Data + godzina ze znacznika Postgresa. NIE `formatPlDateTime()` — tamto
 * woła `new Date()` wprost, a Postgres zwraca „2026-07-25 19:34:26.273+01"
 * (spacja zamiast T, strefa bez dwukropka), z czego JS robi Invalid Date.
 * Ta sama pułapka wywróciła ocenę kopii 2026-07-20. */
function kiedy(znacznik: string | null | undefined): string {
  const d = parsePgTimestamp(znacznik);
  if (!d) return "—";
  return d.toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function wiekOd(znacznik: string): string {
  const d = parsePgTimestamp(znacznik);
  if (!d) return "—";
  return opisWieku((Date.now() - d.getTime()) / 3_600_000);
}

function rozmiar(bajtow: number | null): string {
  if (bajtow == null) return "";
  const mb = bajtow / 1_048_576;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bajtow / 1024)} kB`;
}

/** Jeden pas stanu: ikona + zdanie + opcjonalny powód.
 *
 * Kolor niesie znaczenie i tylko jedno: bursztyn = wymaga Twojej uwagi,
 * neutralny = w porządku. Świadomie BEZ czerwieni — panel używa jej wyłącznie
 * do akcji nieodwracalnych (kasowanie), więc czerwony pas przy „kopie są o
 * dzień stare" mówiłby o katastrofie tam, gdzie jest usterka. */
function Pas({ zle, tytul, powod, ikona }: { zle: boolean; tytul: string; powod?: string; ikona: React.ReactNode }) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg border p-3 ${
        zle ? "border-brand-gold/40 bg-brand-gold/[0.06]" : "hairline"
      }`}
    >
      <span className={`mt-px shrink-0 ${zle ? "text-brand-gold" : "text-muted"}`}>{ikona}</span>
      <div className="min-w-0">
        <div className="text-[13px]">{tytul}</div>
        {powod && <div className="mt-0.5 break-words text-[11px] text-muted">{powod}</div>}
      </div>
    </div>
  );
}

function Sekcja({ tytul, opis, children }: { tytul: string; opis: string; children: React.ReactNode }) {
  return (
    <section className="card-paper rounded-xl border hairline p-4">
      <div className="mb-3">
        <h2 className="text-[13px] font-medium">{tytul}</h2>
        <p className="text-[11px] text-muted">{opis}</p>
      </div>
      {children}
    </section>
  );
}

/** Wiersz błędu — przyczyna schowana pod rozwinięciem.
 *
 * `komunikat` jest zdaniem wpisanym przez nas w kodzie i zawsze brzmi tak
 * samo; dopiero `szczegoly` mówią, CO się stało. Rozwijane, bo pełny tekst
 * potrafi mieć 2000 znaków, a lista ma dawać się przejrzeć wzrokiem. */
function WierszBledu({ b }: { b: WpisBledu }) {
  const [otwarty, setOtwarty] = useState(false);
  return (
    <div className="border-b hairline py-2 last:border-b-0">
      <button
        type="button"
        onClick={() => setOtwarty((v) => !v)}
        className="flex w-full items-start gap-2 text-left"
        disabled={!b.szczegoly}
      >
        <motion.span
          animate={{ rotate: otwarty ? 90 : 0 }}
          transition={{ duration: 0.18, ease: EASE_LIQUID }}
          className={`mt-0.5 shrink-0 ${b.szczegoly ? "text-muted" : "opacity-0"}`}
        >
          <IconChevronRight size={13} />
        </motion.span>
        <span className="min-w-0 flex-1">
          <span className="text-[11px] text-muted">[{b.zakres}]</span>{" "}
          <span className="text-[13px]">{b.komunikat}</span>
          {b.ile > 1 && <span className="ml-1 text-[11px] text-brand-gold">{b.ile}×</span>}
        </span>
        <span className="shrink-0 text-[11px] text-muted">{kiedy(b.created_at)}</span>
      </button>
      <AnimatePresence initial={false}>
        {otwarty && b.szczegoly && (
          <motion.pre
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE_LIQUID }}
            className="overflow-hidden whitespace-pre-wrap break-words pl-5 pt-1 text-[11px] text-muted"
          >
            {b.szczegoly}
            {b.ile > 1 && `\n\nPierwszy raz: ${kiedy(b.pierwszy_raz)}`}
          </motion.pre>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SystemHealth() {
  const [dane, setDane] = useState<Dane | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [odswieza, setOdswieza] = useState(false);

  const wczytaj = useCallback(async () => {
    setOdswieza(true);
    try {
      const res = await fetch("/api/observability");
      if (res.status === 401) {
        window.location.reload();
        return;
      }
      if (!res.ok) throw new Error(`Serwer zwrócił błąd ${res.status}.`);
      setDane(await res.json());
      setBlad(null);
    } catch (e) {
      setBlad(e instanceof Error ? e.message : "Nie udało się wczytać stanu systemu.");
    } finally {
      setOdswieza(false);
    }
  }, []);

  useEffect(() => {
    void wczytaj();
  }, [wczytaj]);

  if (blad && !dane) {
    return (
      <div className="-mx-4 p-6 sm:-mx-6">
        <p className="text-sm text-brand-gold">{blad}</p>
      </div>
    );
  }

  if (!dane) {
    return (
      <div className="-mx-4 flex flex-1 flex-col sm:-mx-6 md:min-h-0">
        <div className="grid gap-3 px-4 pt-4 sm:px-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-[var(--hairline)]" />
          ))}
        </div>
      </div>
    );
  }

  const bledy = dane.bledy ?? [];
  const automaty = dane.automaty ?? [];

  return (
    <div className="-mx-4 sm:-mx-6">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b hairline px-4 sm:px-6" style={{ height: "44px" }}>
        <span className="truncate text-[13px] text-muted">
          Zdrowie systemu — czy automaty chodzą, czy kopie się robią i co dokładnie się nie udało.
        </span>
        <button
          type="button"
          onClick={() => void wczytaj()}
          className="flex shrink-0 items-center gap-1.5 text-[12px] text-muted transition-colors hover:text-[var(--fg)]"
          style={{ transitionTimingFunction: "var(--ease-liquid)" }}
        >
          <IconRefresh size={14} className={odswieza ? "animate-spin" : ""} />
          Odśwież
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING}
        className="grid gap-3 px-4 py-4 sm:px-6 lg:grid-cols-2"
      >
        <Sekcja tytul="Kopie zapasowe bazy" opis="Meldunki ze skryptu na NAS-ie — jeden na dobę.">
          {dane.bladKopii ? (
            <Pas zle tytul="Nie udało się odczytać stanu kopii." powod={dane.bladKopii} ikona={<IconAlertTriangle size={15} />} />
          ) : dane.kopie ? (
            <Pas
              zle={dane.kopie.stan !== "ok"}
              tytul={dane.kopie.opis}
              powod={dane.kopie.stan === "blad" ? dane.kopie.powod : undefined}
              ikona={dane.kopie.stan === "ok" ? <IconCircleCheck size={15} /> : <IconAlertTriangle size={15} />}
            />
          ) : null}

          {dane.kopieHistoria.length > 0 && (
            <div className="mt-3 space-y-1">
              {dane.kopieHistoria.slice(0, 7).map((r) => (
                <div key={r.id} className="flex items-baseline gap-2 text-[11px]">
                  <span className={r.ok ? "text-muted" : "text-brand-gold"}>{r.ok ? "✓" : "✕"}</span>
                  <span className="shrink-0 text-muted">{kiedy(r.created_at)}</span>
                  <span className="min-w-0 flex-1 truncate text-muted">
                    {r.ok
                      ? [r.host, r.tabel ? `${r.tabel} tabel` : "", rozmiar(r.rozmiar_bajtow), r.trwalo_sekund ? `${r.trwalo_sekund} s` : ""]
                          .filter(Boolean)
                          .join(" · ")
                      : r.powod || "bez powodu"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Sekcja>

        <Sekcja tytul="Automaty" opis="Procesy chodzące bez patrzenia — każdy melduje po swoim przebiegu.">
          {dane.bladAutomatow ? (
            <Pas zle tytul="Nie udało się odczytać stanu automatów." powod={dane.bladAutomatow} ikona={<IconAlertTriangle size={15} />} />
          ) : (
            <div className="space-y-2">
              {automaty.map((s) => (
                <Pas
                  key={s.automat.klucz}
                  zle={wymagaUwagi(s)}
                  tytul={s.opis}
                  // Przy awarii mówimy też, CO przestaje działać. Sama nazwa
                  // automatu nic nie znaczy dla kogoś, kto nie pisał kodu.
                  powod={s.stan === "blad" ? `${s.powod} — ${s.automat.skutek}` : wymagaUwagi(s) ? s.automat.skutek : undefined}
                  ikona={wymagaUwagi(s) ? <IconAlertTriangle size={15} /> : <IconRobot size={15} />}
                />
              ))}
            </div>
          )}
        </Sekcja>

        <Sekcja tytul="Ostatnie błędy" opis="Kliknij wiersz, żeby zobaczyć przyczynę techniczną.">
          {dane.bladBledow ? (
            <Pas zle tytul="Nie udało się odczytać dziennika błędów." powod={dane.bladBledow} ikona={<IconAlertTriangle size={15} />} />
          ) : bledy.length === 0 ? (
            <p className="text-[12px] text-muted">Pusto — panel nie zapisał żadnego błędu.</p>
          ) : (
            <div>
              {bledy.map((b) => (
                <WierszBledu key={b.id} b={b} />
              ))}
            </div>
          )}
        </Sekcja>

        <Sekcja tytul="Ostatnie przebiegi" opis="Surowe meldunki automatów — od najnowszego.">
          {dane.przebiegi && dane.przebiegi.length > 0 ? (
            <div className="space-y-1">
              {dane.przebiegi.slice(0, 20).map((p) => (
                <div key={p.id} className="flex items-baseline gap-2 text-[11px]">
                  <span className={p.ok ? "text-muted" : "text-brand-gold"}>{p.ok ? "✓" : "✕"}</span>
                  <span className="shrink-0 text-muted">{kiedy(p.created_at)}</span>
                  <span className="shrink-0">{p.klucz}</span>
                  <span className="min-w-0 flex-1 truncate text-muted">
                    {p.powod || (p.trwalo_ms != null ? `${(p.trwalo_ms / 1000).toFixed(1)} s` : "")}
                  </span>
                  <span className="shrink-0 text-muted">{wiekOd(p.created_at)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-muted">Brak meldunków.</p>
          )}
        </Sekcja>
      </motion.div>
    </div>
  );
}
