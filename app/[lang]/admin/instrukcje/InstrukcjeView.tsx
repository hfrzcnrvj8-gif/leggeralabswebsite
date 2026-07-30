"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconChevronRight, IconBook, IconRobot, IconAlertTriangle, IconKeyboard } from "@tabler/icons-react";
import { EASE_LIQUID } from "@/lib/motion";
import { WSTEP, MODULY, type ModulInstrukcji, type PunktInstrukcji } from "@/lib/instrukcje";

/**
 * Instrukcje obsługi — dwa poziomy w jednym tekście (decyzja właściciela
 * 2026-07-26).
 *
 * Pierwsza warstwa („Jak używać") jest ROZWINIĘTA od startu: ktoś, kto widzi
 * panel pierwszy raz, ma czytać, a nie klikać. Druga („Co dzieje się samo",
 * „Na co uważać", „Skróty") jest zwinięta — to odpowiedzi na pytania, które
 * pojawiają się później, a rozwinięte od razu zamieniłyby stronę w ścianę.
 *
 * Treść mieszka w `lib/instrukcje.ts`, nie tutaj: tę samą listę pobiera apka
 * przez `GET /api/instrukcje`, więc jedna zmiana obsługuje wszystkie
 * urządzenia.
 */
export function InstrukcjeView() {
  const [otwarty, setOtwarty] = useState<string>(MODULY[0]?.id ?? "");

  return (
    <div className="mx-auto w-full max-w-4xl pb-10">
      <header className="mb-6">
        <h1 className="text-liquid text-2xl font-semibold">{WSTEP.tytul}</h1>
        <div className="mt-3 space-y-2 text-[13.5px] leading-relaxed text-muted">
          {WSTEP.akapity.map((a, i) => (
            <p key={i}>{a}</p>
          ))}
        </div>
        <p className="mt-3 rounded-xl border hairline bg-hairline/30 p-3 text-[12.5px] text-muted">
          {WSTEP.stan}
        </p>
      </header>

      {/* Spis treści — przy dwóch modułach zbędny, ale rośnie razem z listą
          i nie chcemy dokładać go dopiero wtedy, gdy zrobi się nieczytelnie. */}
      <nav className="mb-6 flex flex-wrap gap-2">
        {MODULY.map((m) => (
          <button
            key={m.id}
            onClick={() => setOtwarty(m.id)}
            className={`rounded-full border px-3 py-1 text-[12.5px] transition-colors ${
              otwarty === m.id ? "border-brand-accent text-[var(--fg)]" : "hairline text-muted hover:text-[var(--fg)]"
            }`}
          >
            {m.nazwa}
          </button>
        ))}
      </nav>

      <div className="space-y-4">
        {MODULY.map((m) => (
          <SekcjaModulu key={m.id} modul={m} otwarty={otwarty === m.id} onOtworz={() => setOtwarty(m.id)} />
        ))}
      </div>
    </div>
  );
}

function SekcjaModulu({
  modul,
  otwarty,
  onOtworz,
}: {
  modul: ModulInstrukcji;
  otwarty: boolean;
  onOtworz: () => void;
}) {
  return (
    <section id={modul.id} className="card-paper rounded-2xl border hairline p-5">
      <button onClick={onOtworz} className="flex w-full items-start gap-2 text-left">
        {/* Neutralna, nie fioletowa (Moduł 59, zgłoszenie właściciela). Ta ikona
            nie mówi ani o stanie, ani o rodzaju — powtarza to, co obok stoi
            słowem. Kolor marki na niej robił drugi akcent na ekranie, który ma
            już jeden: gradientowy nagłówek wyżej. */}
        <IconBook size={18} className="mt-0.5 shrink-0 text-muted" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">{modul.nazwa}</span>
          <span className="mt-0.5 block text-[13px] text-muted">{modul.poCoTo}</span>
        </span>
      </button>

      {otwarty && (
        <div className="mt-4 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Fakt etykieta="Gdzie to znajdziesz" tekst={modul.gdzie} />
            <Fakt etykieta="Kiedy po to sięgasz" tekst={modul.kiedy} />
          </div>

          {/* PIERWSZA warstwa — zawsze widoczna. */}
          <div>
            <h3 className="mb-2 text-[13px] font-semibold">Jak używać</h3>
            <ol className="space-y-3">
              {modul.kroki.map((k) => (
                <li key={k.tytul}>
                  <p className="text-[13.5px] font-medium">{k.tytul}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{k.opis}</p>
                </li>
              ))}
            </ol>
          </div>

          {/* DRUGA warstwa — zwinięta. */}
          <Zwijana
            tytul="Co dzieje się samo"
            ikona={<IconRobot size={15} />}
            podpis="Automaty, terminy i reguły — czyli dlaczego coś pojawiło się bez Twojego udziału."
            punkty={modul.automaty}
          />
          <Zwijana
            tytul="Na co uważać"
            ikona={<IconAlertTriangle size={15} />}
            podpis="Rzeczy, które mylą albo są nieodwracalne."
            punkty={modul.pulapki}
          />
          {modul.skroty.length > 0 && (
            <Zwijana
              tytul="Skróty i gesty"
              ikona={<IconKeyboard size={15} />}
              podpis="Klawiatura na desktopie, przesunięcia palcem na telefonie."
              punkty={modul.skroty}
            />
          )}
        </div>
      )}
    </section>
  );
}

function Fakt({ etykieta, tekst }: { etykieta: string; tekst: string }) {
  return (
    <div className="rounded-xl border hairline p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted">{etykieta}</div>
      <div className="mt-1 text-[13px]">{tekst}</div>
    </div>
  );
}

function Zwijana({
  tytul,
  podpis,
  ikona,
  punkty,
}: {
  tytul: string;
  podpis: string;
  ikona: React.ReactNode;
  punkty: PunktInstrukcji[];
}) {
  const [otwarte, setOtwarte] = useState(false);
  if (punkty.length === 0) return null;

  return (
    <div className="rounded-xl border hairline">
      <button onClick={() => setOtwarte((v) => !v)} className="flex w-full items-center gap-2 p-3 text-left">
        <motion.span
          animate={{ rotate: otwarte ? 90 : 0 }}
          transition={{ duration: 0.18, ease: EASE_LIQUID }}
          className="inline-flex text-muted"
        >
          <IconChevronRight size={14} />
        </motion.span>
        <span className="text-muted">{ikona}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium">{tytul}</span>
          {!otwarte && <span className="block text-[12px] text-muted">{podpis}</span>}
        </span>
        <span className="shrink-0 text-[11.5px] text-muted">{punkty.length}</span>
      </button>
      <AnimatePresence initial={false}>
        {otwarte && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE_LIQUID }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t hairline p-3">
              {punkty.map((p) => (
                <div key={p.tytul}>
                  <p className="text-[13px] font-medium">{p.tytul}</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{p.opis}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
