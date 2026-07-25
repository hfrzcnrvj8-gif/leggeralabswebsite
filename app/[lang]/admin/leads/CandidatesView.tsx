"use client";

import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  IconRadar,
  IconTarget,
  IconCheck,
  IconX,
  IconPlus,
  IconChevronRight,
  IconAlertTriangle,
  IconSparkles,
  IconWorld,
  IconPhone,
  IconMail,
} from "@tabler/icons-react";
import { SPRING, EASE_LIQUID } from "@/lib/motion";
import { POWODY_ODRZUCENIA, POWODY_SITA, type Sygnal } from "@/lib/leadHunter";
import { Modal } from "../Modal";
import { Popover, MenuLabel, MenuRow } from "../Menu";
import { useUI } from "../ui";

/* ────────────────────────── typy z API ────────────────────────── */

export type Kandydat = {
  id: string;
  nazwa: string;
  nip: string;
  branza: string;
  ulica: string;
  kod: string;
  miasto: string;
  telefon: string;
  email: string;
  www: string;
  punkty: number;
  ocena: "A" | "B" | "C";
  sygnaly: Sygnal[] | string;
  stan: "nowy" | "wziety" | "odrzucony";
  powod_odrzucenia: string;
  lead_id: string | null;
  polowanie: string | null;
  data_rozpoczecia: string | null;
  status_vat: string | null;
};

export type Polowanie = {
  id: string;
  nazwa: string;
  pkd: string;
  wojewodztwo: string;
  powiat: string;
  miasto: string;
  aktywne: boolean;
  kursor: number;
  ostatni_przebieg: string | null;
  ostatni_wynik: string;
  znalezionych: number;
  przyjetych: number;
};

export type DaneLowcy = {
  candidates: Kandydat[];
  odsiew: { powod: string; ile: number }[];
  surowych: number;
  retencjaDni: number;
  ceidg: { skonfigurowany: boolean; srodowisko: string };
};

/* ────────────────────────── drobiazgi wizualne ────────────────────────── */

/** Ocena niesie znaczenie, więc niesie kolor — trzy szczeble jednej skali,
 * z palety marki, nie z generycznego Tailwinda (CLAUDE.md → Design system).
 * Świadomie BEZ czerwieni na „C": „C" to najsłabszy kandydat, nie awaria. */
const OCENA_CLASS: Record<string, string> = {
  A: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  B: "bg-brand-gold/15 text-brand-gold border-brand-gold/30",
  C: "bg-[var(--hairline)] text-muted border-transparent",
};

function OcenaPigulka({ ocena, punkty }: { ocena: string; punkty: number }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${OCENA_CLASS[ocena] ?? OCENA_CLASS.C}`}>
      {ocena}
      <span className="font-normal opacity-70">{punkty} pkt</span>
    </span>
  );
}

/** JSONB wraca z Postgresa obiektem, a z dev-bazy (PGlite) potrafi wrócić
 * stringiem — różnica, której `tsc` nie widzi, bo po obu stronach jest `any`
 * z bazy. Jedno miejsce, w którym to rozstrzygamy. */
function sygnalyZ(k: Kandydat): Sygnal[] {
  if (Array.isArray(k.sygnaly)) return k.sygnaly;
  try {
    return JSON.parse(typeof k.sygnaly === "string" ? k.sygnaly : "[]") as Sygnal[];
  } catch {
    return [];
  }
}

/* ────────────────────────── karta kandydata ────────────────────────── */

function KartaKandydata({
  k,
  onWez,
  onOdrzuc,
  onZaczepka,
  zajety,
}: {
  k: Kandydat;
  onWez: (k: Kandydat) => void;
  onOdrzuc: (k: Kandydat, powod: string) => void;
  onZaczepka: (k: Kandydat) => void;
  zajety: boolean;
}) {
  const [rozwiniete, setRozwiniete] = useState(false);
  const sygnaly = sygnalyZ(k);
  const obsluzony = k.stan !== "nowy";

  return (
    <motion.div
      layout
      transition={SPRING}
      className={`card-paper rounded-2xl border hairline p-4 ${obsluzony ? "opacity-60" : ""}`}
    >
      <div className="flex flex-wrap items-start gap-2">
        <OcenaPigulka ocena={k.ocena} punkty={k.punkty} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-[var(--fg)]">{k.nazwa}</div>
          <div className="mt-0.5 truncate text-[12px] text-muted">
            {[k.branza, k.miasto, k.nip && `NIP ${k.nip}`].filter(Boolean).join(" · ")}
          </div>
        </div>
        {!obsluzony && (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={() => onWez(k)}
              disabled={zajety}
              className="btn-primary flex items-center gap-1 rounded-full px-3 py-1 text-[12px] disabled:opacity-50"
            >
              <IconCheck size={13} /> Weź
            </button>
            <Popover
              align="right"
              width={220}
              trigger={(open) => (
                <button
                  onClick={open}
                  disabled={zajety}
                  className="flex items-center gap-1 rounded-full border hairline px-3 py-1 text-[12px] text-muted hover:text-[var(--fg)] disabled:opacity-50"
                >
                  <IconX size={13} /> Odrzuć
                </button>
              )}
            >
              {(close) => (
                <div>
                  {/* Powód z zamkniętej listy, nie z wolnego tekstu — wolnego
                      tekstu nie da się policzyć, a to właśnie te powody są
                      drugim licznikiem pętli poprawy sita. */}
                  <MenuLabel>Dlaczego odrzucasz?</MenuLabel>
                  {POWODY_ODRZUCENIA.map((p) => (
                    <MenuRow
                      key={p}
                      label={p}
                      onClick={() => {
                        close();
                        onOdrzuc(k, p);
                      }}
                    />
                  ))}
                </div>
              )}
            </Popover>
          </div>
        )}
        {k.stan === "wziety" && (
          <button
            onClick={() => onZaczepka(k)}
            className="flex shrink-0 items-center gap-1 rounded-full border hairline px-3 py-1 text-[12px] text-muted hover:text-[var(--fg)]"
          >
            <IconSparkles size={13} /> Zaczepka
          </button>
        )}
        {k.stan === "odrzucony" && (
          <span className="shrink-0 rounded-full bg-[var(--hairline)] px-2 py-0.5 text-[11px] text-muted">
            Odrzucony: {k.powod_odrzucenia || "—"}
          </span>
        )}
      </div>

      {/* Drogi kontaktu — te same trzy, co na liście leadów (Moduł 5). */}
      {(k.telefon || k.email || k.www) && (
        <div className="mt-3 flex flex-wrap gap-1.5 text-[12px]">
          {k.telefon && (
            <a href={`tel:${k.telefon.replace(/\s/g, "")}`} className="flex items-center gap-1 rounded-full border hairline px-2.5 py-1 text-muted hover:text-[var(--fg)]">
              <IconPhone size={12} /> {k.telefon}
            </a>
          )}
          {k.email && (
            <a href={`mailto:${k.email}`} className="flex items-center gap-1 rounded-full border hairline px-2.5 py-1 text-muted hover:text-[var(--fg)]">
              <IconMail size={12} /> {k.email}
            </a>
          )}
          {k.www && (
            <a
              href={/^https?:\/\//i.test(k.www) ? k.www : `https://${k.www}`}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center gap-1 rounded-full border hairline px-2.5 py-1 text-muted hover:text-[var(--fg)]"
            >
              <IconWorld size={12} /> {k.www.replace(/^https?:\/\//i, "")}
            </a>
          )}
        </div>
      )}

      {/* „Dlaczego" — bez tego sortowanie jest czarną skrzynką, której nikt
          nie zaufa, a sortowanie, któremu się nie wierzy, jest bezwartościowe. */}
      <button
        onClick={() => setRozwiniete((v) => !v)}
        className="mt-3 flex items-center gap-1 text-[12px] text-muted hover:text-[var(--fg)]"
      >
        <motion.span animate={{ rotate: rozwiniete ? 90 : 0 }} transition={{ duration: 0.18, ease: EASE_LIQUID }} className="inline-flex">
          <IconChevronRight size={13} />
        </motion.span>
        Dlaczego {k.ocena} ({sygnaly.length} {sygnaly.length === 1 ? "sygnał" : "sygnałów"})
      </button>
      <AnimatePresence initial={false}>
        {rozwiniete && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE_LIQUID }}
            className="overflow-hidden text-[12.5px]"
          >
            {[...sygnaly]
              .sort((a, b) => b.punkty - a.punkty)
              .map((s) => (
                <li key={s.kod} className="flex items-baseline gap-2 border-b hairline py-1 last:border-0">
                  <span className={`w-10 shrink-0 text-right font-mono text-[11.5px] ${s.punkty > 0 ? "text-emerald-400" : "text-orange-400"}`}>
                    {s.punkty > 0 ? "+" : ""}
                    {s.punkty}
                  </span>
                  <span className="text-muted">{s.opis}</span>
                </li>
              ))}
            {k.polowanie && <li className="pt-2 text-[11.5px] text-muted">Polowanie: {k.polowanie}</li>}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ────────────────────────── widok ────────────────────────── */

export function CandidatesView({
  dane,
  polowania,
  search,
  onOdswiez,
  onOdswiezLeady,
}: {
  dane: DaneLowcy | null;
  polowania: Polowanie[];
  search: string;
  onOdswiez: () => Promise<void> | void;
  onOdswiezLeady: () => Promise<void> | void;
}) {
  const { toast, confirm } = useUI();
  const [zajety, setZajety] = useState(false);
  const [polujeSie, setPolujeSie] = useState(false);
  const [pokazC, setPokazC] = useState(false);
  const [pokazObsluzone, setPokazObsluzone] = useState(false);
  const [nowePolowanie, setNowePolowanie] = useState(false);
  const [zaczepka, setZaczepka] = useState<{ kandydat: Kandydat; tekst: string; laduje: boolean } | null>(null);

  const kandydaci = useMemo(() => {
    const q = search.trim().toLowerCase();
    const lista = dane?.candidates ?? [];
    if (!q) return lista;
    return lista.filter((k) =>
      [k.nazwa, k.branza, k.miasto, k.nip, k.email, k.www].some((p) => (p ?? "").toLowerCase().includes(q))
    );
  }, [dane, search]);

  const nowi = kandydaci.filter((k) => k.stan === "nowy");
  const czolo = nowi.filter((k) => k.ocena !== "C");
  const ogon = nowi.filter((k) => k.ocena === "C");
  const obsluzeni = kandydaci.filter((k) => k.stan !== "nowy");

  const polujTeraz = useCallback(async () => {
    setPolujeSie(true);
    try {
      const res = await fetch("/api/leads/hunt/run", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; nowych?: number; ocenA?: number; odsianych?: number; przerwane?: string };
      if (!res.ok) {
        toast(data.error ?? "Nie udało się przeprowadzić polowania.", "error");
        return;
      }
      if (data.przerwane) toast(data.przerwane, "error");
      else toast(`Dołożono ${data.nowych ?? 0} kandydatów (${data.ocenA ?? 0}× A), odsiano ${data.odsianych ?? 0}.`);
      await onOdswiez();
    } finally {
      setPolujeSie(false);
    }
  }, [toast, onOdswiez]);

  const wez = useCallback(
    async (k: Kandydat) => {
      setZajety(true);
      try {
        const res = await fetch(`/api/leads/candidates/${k.id}/take`, { method: "POST" });
        if (!res.ok) {
          const d = (await res.json().catch(() => ({}))) as { error?: string };
          toast(d.error ?? "Nie udało się utworzyć leada.", "error");
          return;
        }
        toast(`„${k.nazwa}" trafił do rejestru leadów jako „Do kontaktu".`);
        // Rejestr leadów też się zmienił — bez tego zakładka Tablica
        // pokazywałaby stan sprzed przyjęcia aż do przeładowania strony.
        await Promise.all([onOdswiez(), onOdswiezLeady()]);
      } finally {
        setZajety(false);
      }
    },
    [toast, onOdswiez, onOdswiezLeady]
  );

  const odrzuc = useCallback(
    async (k: Kandydat, powod: string) => {
      // Odrzucenie dopisuje NIP na czarną listę — raz odrzucony nie wraca,
      // także w kolejnych polowaniach. To jest nieodwracalne z poziomu panelu,
      // więc pytamy.
      const ok = await confirm(
        `Odrzucić „${k.nazwa}”?\n\nPowód: ${powod}.\nFirma trafi na czarną listę i łowca nie zaproponuje jej ponownie.`,
        { danger: true }
      );
      if (!ok) return;
      setZajety(true);
      try {
        const res = await fetch(`/api/leads/candidates/${k.id}/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ powod }),
        });
        if (!res.ok) {
          const d = (await res.json().catch(() => ({}))) as { error?: string };
          toast(d.error ?? "Nie udało się odrzucić kandydata.", "error");
          return;
        }
        await onOdswiez();
      } finally {
        setZajety(false);
      }
    },
    [confirm, toast, onOdswiez]
  );

  const generujZaczepke = useCallback(
    async (k: Kandydat) => {
      setZaczepka({ kandydat: k, tekst: "", laduje: true });
      const res = await fetch(`/api/leads/candidates/${k.id}/hook`, { method: "POST" });
      const d = (await res.json().catch(() => ({}))) as { zaczepka?: string; error?: string };
      if (!res.ok) {
        toast(d.error ?? "Nie udało się wygenerować zaczepki.", "error");
        setZaczepka(null);
        return;
      }
      setZaczepka({ kandydat: k, tekst: d.zaczepka ?? "", laduje: false });
    },
    [toast]
  );

  /** Zapis zaczepki dopisuje ją do notatki leada — dopiero na kliknięcie
   * właściciela. Model proponuje, człowiek zatwierdza (CLAUDE.md). */
  const zapiszZaczepke = useCallback(async () => {
    if (!zaczepka?.kandydat.lead_id) return;
    const res = await fetch(`/api/leads/${zaczepka.kandydat.lead_id}`);
    const d = (await res.json().catch(() => ({}))) as { lead?: { notatki?: string } };
    const stare = d.lead?.notatki ?? "";
    const nowe = `${stare}${stare ? "\n\n" : ""}Zaczepka: ${zaczepka.tekst.trim()}`;
    const zapis = await fetch(`/api/leads/${zaczepka.kandydat.lead_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notatki: nowe }),
    });
    if (!zapis.ok) {
      toast("Nie udało się dopisać zaczepki do notatki leada.", "error");
      return;
    }
    toast("Zaczepka dopisana do notatki leada.");
    setZaczepka(null);
    await onOdswiezLeady();
  }, [zaczepka, toast, onOdswiezLeady]);

  const dodajPolowanie = useCallback(
    async (form: { nazwa: string; pkd: string; wojewodztwo: string; powiat: string; miasto: string }) => {
      const res = await fetch("/api/leads/hunts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        toast(d.error ?? "Nie udało się zapisać polowania.", "error");
        return;
      }
      setNowePolowanie(false);
      await onOdswiez();
    },
    [toast, onOdswiez]
  );

  const przelaczPolowanie = useCallback(
    async (p: Polowanie) => {
      await fetch(`/api/leads/hunts/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktywne: !p.aktywne }),
      });
      await onOdswiez();
    },
    [onOdswiez]
  );

  if (!dane) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-[var(--hairline)]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Bez tokenu nic nie zapoluje. Panel ma to POWIEDZIEĆ, a nie pokazywać
          pustą listę bez wyjaśnienia — to jedyna rzecz w tym module po stronie
          właściciela. */}
      {!dane.ceidg.skonfigurowany && (
        <div className="flex items-start gap-2 rounded-xl border border-orange-500/30 bg-orange-500/[0.05] p-3 text-[12.5px]">
          <IconAlertTriangle size={16} className="mt-0.5 shrink-0 text-orange-400" />
          <div>
            <b className="text-orange-400">Łowca nie ma klucza do rejestru CEIDG.</b> Załóż konto na Biznes.gov.pl,
            zarejestruj się na <span className="font-mono">dane.biznes.gov.pl</span>, a przysłany mailem klucz wpisz w
            Vercelu jako zmienną <span className="font-mono">CEIDG_TOKEN</span>. Do tego czasu sito, skrzynka i
            polowania działają, ale nie mają skąd brać firm.
          </div>
        </div>
      )}
      {dane.ceidg.skonfigurowany && dane.ceidg.srodowisko === "test" && (
        <div className="rounded-xl border border-brand-cyan/30 bg-brand-cyan/[0.05] p-3 text-[12.5px] text-brand-cyan">
          Łowca pyta <b>środowisko testowe</b> CEIDG (<span className="font-mono">CEIDG_ENV=test</span>) — wyniki są
          próbne. Usuń tę zmienną w Vercelu, żeby polować na prawdziwym rejestrze.
        </div>
      )}

      {/* ── Polowania ── */}
      <div className="card-paper rounded-2xl border hairline p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <IconRadar size={16} className="text-brand-purple" />
          <h2 className="text-[13px] font-semibold">Polowania</h2>
          <span className="flex-1" />
          <button
            onClick={polujTeraz}
            disabled={polujeSie || !dane.ceidg.skonfigurowany}
            className="flex items-center gap-1 rounded-full border hairline px-3 py-1 text-[12px] text-muted hover:text-[var(--fg)] disabled:opacity-50"
          >
            <IconTarget size={13} /> {polujeSie ? "Poluję…" : "Poluj teraz"}
          </button>
          <button
            onClick={() => setNowePolowanie(true)}
            className="flex items-center gap-1 rounded-full border hairline px-3 py-1 text-[12px] text-muted hover:text-[var(--fg)]"
          >
            <IconPlus size={13} /> Nowe polowanie
          </button>
        </div>

        {polowania.length === 0 ? (
          <p className="text-[12.5px] text-muted">
            Nie ma jeszcze żadnego polowania. Polowanie definiuje się raz („biura rachunkowe, Mazowsze") i chodzi w tle
            — codziennie o 4:00 dokłada porcję kandydatów do tej skrzynki.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {polowania.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 border-b hairline py-1.5 text-[12.5px] last:border-0">
                <button
                  onClick={() => przelaczPolowanie(p)}
                  className={`h-2 w-2 shrink-0 rounded-full ${p.aktywne ? "bg-emerald-500" : "bg-[var(--hairline)]"}`}
                  aria-label={p.aktywne ? "Wyłącz polowanie" : "Włącz polowanie"}
                />
                <span className="font-medium">{p.nazwa}</span>
                <span className="text-muted">
                  {[p.pkd && `PKD ${p.pkd}`, p.wojewodztwo, p.powiat, p.miasto].filter(Boolean).join(" · ")}
                </span>
                <span className="flex-1" />
                <span className="text-muted">
                  znalezionych {p.znalezionych} · przyjętych {p.przyjetych}
                </span>
                {p.ostatni_wynik && <span className="text-muted opacity-70">· {p.ostatni_wynik}</span>}
              </li>
            ))}
          </ul>
        )}

        {dane.surowych > 0 && (
          // Bez tej linijki przebieg przerwany budżetem czasu wygląda
          // identycznie jak przebieg, który nic nie znalazł.
          <p className="mt-2 text-[12px] text-muted">
            {dane.surowych} firm czeka na wzbogacenie — łowca dokończy je w kolejnym przebiegu (limit rejestru CEIDG
            pozwala na ok. 60 zapytań dziennie).
          </p>
        )}
      </div>

      {/* ── Skrzynka ── */}
      {czolo.length === 0 && ogon.length === 0 ? (
        <div className="card-paper rounded-2xl border hairline p-8 text-center">
          <IconRadar size={28} className="mx-auto mb-2 text-muted opacity-50" />
          <p className="text-[13px] font-medium">Skrzynka jest pusta.</p>
          <p className="mt-1 text-[12.5px] text-muted">
            {polowania.some((p) => p.aktywne)
              ? "Łowca poluje codziennie o 4:00 rano. Możesz też kliknąć „Poluj teraz” powyżej."
              : "Włącz albo dodaj polowanie, żeby łowca miał czego szukać."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {czolo.map((k) => (
            <KartaKandydata key={k.id} k={k} onWez={wez} onOdrzuc={odrzuc} onZaczepka={generujZaczepke} zajety={zajety} />
          ))}
        </div>
      )}

      {/* „C" jest WIDOCZNE, tylko na końcu i zwinięte — ukrycie zamieniłoby
          sito w czarną skrzynkę, a właściciel ma widzieć, co odsiewa. */}
      {ogon.length > 0 && (
        <div>
          <button
            onClick={() => setPokazC((v) => !v)}
            className="flex items-center gap-1 text-[12.5px] text-muted hover:text-[var(--fg)]"
          >
            <motion.span animate={{ rotate: pokazC ? 90 : 0 }} transition={{ duration: 0.18, ease: EASE_LIQUID }} className="inline-flex">
              <IconChevronRight size={14} />
            </motion.span>
            Słabsi kandydaci — ocena C ({ogon.length})
          </button>
          {pokazC && (
            <div className="mt-2 space-y-2">
              {ogon.map((k) => (
                <KartaKandydata key={k.id} k={k} onWez={wez} onOdrzuc={odrzuc} onZaczepka={generujZaczepke} zajety={zajety} />
              ))}
            </div>
          )}
        </div>
      )}

      {obsluzeni.length > 0 && (
        <div>
          <button
            onClick={() => setPokazObsluzone((v) => !v)}
            className="flex items-center gap-1 text-[12.5px] text-muted hover:text-[var(--fg)]"
          >
            <motion.span animate={{ rotate: pokazObsluzone ? 90 : 0 }} transition={{ duration: 0.18, ease: EASE_LIQUID }} className="inline-flex">
              <IconChevronRight size={14} />
            </motion.span>
            Już obsłużone ({obsluzeni.length})
          </button>
          {pokazObsluzone && (
            <div className="mt-2 space-y-2">
              {obsluzeni.map((k) => (
                <KartaKandydata key={k.id} k={k} onWez={wez} onOdrzuc={odrzuc} onZaczepka={generujZaczepke} zajety={zajety} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Co odsiewa sito ── drugi licznik pętli poprawy. */}
      {dane.odsiew.length > 0 && (
        <div className="card-paper rounded-2xl border hairline p-4">
          <h2 className="mb-2 text-[13px] font-semibold">Co sito odrzuciło samo (90 dni)</h2>
          <ul className="space-y-1 text-[12.5px]">
            {dane.odsiew.map((o) => (
              <li key={o.powod} className="flex items-baseline justify-between gap-3 border-b hairline py-1 last:border-0">
                <span className="text-muted">{POWODY_SITA[o.powod] ?? o.powod}</span>
                <span className="font-mono text-[11.5px]">{o.ile}×</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11.5px] text-muted">
            Jeśli jeden powód wybija się ponad resztę, to znak, że pokrętło sita jest źle ustawione — progi i wagi
            siedzą w jednym pliku (<span className="font-mono">lib/leadHunter.ts</span>). Nieprzyjęci kandydaci znikają
            po {dane.retencjaDni} dniach.
          </p>
        </div>
      )}

      <NowePolowanieModal open={nowePolowanie} onClose={() => setNowePolowanie(false)} onSave={dodajPolowanie} />

      {/* Zaczepka z lokalnego modelu — PROPOZYCJA do poprawienia i ręcznego
          zapisania, wzorem Modułów 7/8/48–50. */}
      <Modal
        open={Boolean(zaczepka)}
        onClose={() => setZaczepka(null)}
        z={95}
        card="card-paper my-auto w-full max-w-xl rounded-2xl border hairline p-6"
      >
        <h2 className="text-lg font-semibold">Zaczepka do pierwszego kontaktu</h2>
        <p className="mt-1 text-[12.5px] text-muted">
          Lokalny model przeczytał stronę firmy {zaczepka?.kandydat.nazwa} i proponuje jedno zdanie. Popraw je i
          zdecyduj sam, czy trafi do notatki leada.
        </p>
        {zaczepka?.laduje ? (
          <div className="mt-4 h-24 animate-pulse rounded-xl bg-[var(--hairline)]" />
        ) : (
          <textarea
            value={zaczepka?.tekst ?? ""}
            onChange={(e) => setZaczepka((z) => (z ? { ...z, tekst: e.target.value } : z))}
            rows={4}
            className="mt-4 w-full rounded-xl border hairline bg-transparent p-3 text-[13px]"
          />
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setZaczepka(null)} className="rounded-full border hairline px-4 py-1.5 text-[12.5px] text-muted">
            Zamknij
          </button>
          <button
            onClick={zapiszZaczepke}
            disabled={zaczepka?.laduje || !zaczepka?.tekst.trim()}
            className="btn-primary rounded-full px-4 py-1.5 text-[12.5px] disabled:opacity-50"
          >
            Dopisz do notatki leada
          </button>
        </div>
      </Modal>
    </div>
  );
}

/* ────────────────────────── nowe polowanie ────────────────────────── */

function NowePolowanieModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (f: { nazwa: string; pkd: string; wojewodztwo: string; powiat: string; miasto: string }) => Promise<void>;
}) {
  const [nazwa, setNazwa] = useState("");
  // Domyślki z decyzji właściciela: obszar Mazowsze, pięć kodów rdzenia.
  // To PUNKT STARTOWY i pokrętło, nie ustalenie na zawsze.
  const [pkd, setPkd] = useState("6920,6910,862,683,7022");
  const [wojewodztwo, setWojewodztwo] = useState("MAZOWIECKIE");
  const [powiat, setPowiat] = useState("");
  const [miasto, setMiasto] = useState("");
  const [zapisuje, setZapisuje] = useState(false);

  return (
    <Modal open={open} onClose={onClose} card="card-paper my-auto w-full max-w-lg rounded-2xl border hairline p-6">
      <h2 className="text-lg font-semibold">Nowe polowanie</h2>
      <p className="mt-1 text-[12.5px] text-muted">
        Definiujesz je raz, a łowca chodzi z nim w tle miesiącami — codziennie bierze kolejną porcję firm z rejestru
        CEIDG i przepuszcza je przez sito.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setZapisuje(true);
          try {
            await onSave({ nazwa, pkd, wojewodztwo, powiat, miasto });
          } finally {
            setZapisuje(false);
          }
        }}
        className="mt-4 space-y-3 text-[13px]"
      >
        <label className="block">
          <span className="text-[12px] text-muted">Nazwa (tylko dla Ciebie)</span>
          <input
            value={nazwa}
            onChange={(e) => setNazwa(e.target.value)}
            placeholder="Biura rachunkowe — Mazowsze"
            className="mt-1 w-full rounded-lg border hairline bg-transparent px-3 py-2"
            autoFocus
          />
        </label>
        <label className="block">
          <span className="text-[12px] text-muted">Kody PKD (po przecinku, wystarczą pierwsze cyfry)</span>
          <input value={pkd} onChange={(e) => setPkd(e.target.value)} className="mt-1 w-full rounded-lg border hairline bg-transparent px-3 py-2 font-mono text-[12.5px]" />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-[12px] text-muted">Województwo</span>
            <input value={wojewodztwo} onChange={(e) => setWojewodztwo(e.target.value)} className="mt-1 w-full rounded-lg border hairline bg-transparent px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-[12px] text-muted">Powiat</span>
            <input value={powiat} onChange={(e) => setPowiat(e.target.value)} placeholder="dowolny" className="mt-1 w-full rounded-lg border hairline bg-transparent px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-[12px] text-muted">Miasto</span>
            <input value={miasto} onChange={(e) => setMiasto(e.target.value)} placeholder="dowolne" className="mt-1 w-full rounded-lg border hairline bg-transparent px-3 py-2" />
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-full border hairline px-4 py-1.5 text-[12.5px] text-muted">
            Anuluj
          </button>
          <button type="submit" disabled={!nazwa.trim() || zapisuje} className="btn-primary rounded-full px-4 py-1.5 text-[12.5px] disabled:opacity-50">
            {zapisuje ? "Zapisuję…" : "Dodaj polowanie"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
