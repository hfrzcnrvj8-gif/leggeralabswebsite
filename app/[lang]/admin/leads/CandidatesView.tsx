"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  IconTrash,
} from "@tabler/icons-react";
import { SPRING, EASE_LIQUID } from "@/lib/motion";
import { POWODY_ODRZUCENIA, POWODY_SITA, type Sygnal } from "@/lib/leadHunter";
import { Modal } from "../Modal";
import { Popover, MenuLabel, MenuRow } from "../Menu";
import { useUI, isTypingTarget } from "../ui";
import { SekcjaProfilu, WierszPola } from "../ProfileSection";

/** Pole formularza łowcy w wierszu profilu. `WierszPola` narzuca `input`-om
 *  wspólne wcięcie i rozmiar, więc zostaje sama ramka. */
const poleLowcyCls = "w-full rounded-lg border hairline bg-transparent py-1.5";

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

/** Wpis czarnej listy. Świadomie minimalny (NIP + znormalizowana nazwa +
 * powód) — nie trzymamy profilu firmy, której nie zamierzamy nic proponować. */
export type WpisCzarnejListy = {
  id: string;
  nip: string;
  nazwa_norm: string;
  powod: string;
  created_at: string;
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
  rozwiniete,
  onToggle,
  podKursorem,
  refKursora,
}: {
  k: Kandydat;
  onWez: (k: Kandydat) => void;
  onOdrzuc: (k: Kandydat, powod: string) => void;
  onZaczepka: (k: Kandydat) => void;
  zajety: boolean;
  /** Stan rozwinięcia trzyma RODZIC — inaczej skrót klawiaturowy (Enter) nie
   * miałby czego przełączyć: nie sięga do stanu pojedynczej karty. */
  rozwiniete: boolean;
  onToggle: () => void;
  /** Karta „pod kursorem" klawiatury (j/k). */
  podKursorem: boolean;
  refKursora?: (el: HTMLDivElement | null) => void;
}) {
  const sygnaly = sygnalyZ(k);
  const obsluzony = k.stan !== "nowy";

  return (
    <motion.div
      layout
      transition={SPRING}
      ref={podKursorem ? refKursora : undefined}
      className={`card-paper rounded-2xl border p-4 ${obsluzony ? "opacity-60" : ""} ${
        podKursorem ? "border-brand-accent" : "hairline"
      }`}
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
        onClick={onToggle}
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
  czarnaLista,
  search,
  onOdswiez,
  onOdswiezLeady,
  polujSygnal,
  nowePolowanieSygnal,
}: {
  dane: DaneLowcy | null;
  polowania: Polowanie[];
  czarnaLista: WpisCzarnejListy[];
  search: string;
  onOdswiez: () => Promise<void> | void;
  onOdswiezLeady: () => Promise<void> | void;
  /** Sygnały z palety poleceń (licznik, nie flaga — patrz LeadsDashboard). */
  polujSygnal: number;
  nowePolowanieSygnal: number;
}) {
  const { toast, confirm, choose } = useUI();
  const [zajety, setZajety] = useState(false);
  const [polujeSie, setPolujeSie] = useState(false);
  const [pokazC, setPokazC] = useState(false);
  const [pokazObsluzone, setPokazObsluzone] = useState(false);
  const [nowePolowanie, setNowePolowanie] = useState(false);
  const [pokazCzarna, setPokazCzarna] = useState(false);
  /** Ostatnie odrzucenie — dopóki tu siedzi, na górze listy stoi „Cofnij".
   * Odrzucenie robi się jednym ruchem, więc jego odwrócenie też musi być
   * jednym ruchem, i to od razu, a nie przez szukanie na czarnej liście. */
  const [ostatnioOdrzucony, setOstatnioOdrzucony] = useState<{ nazwa: string; blacklistId: string } | null>(null);
  const [edytowane, setEdytowane] = useState<Polowanie | null>(null);
  /** Który kandydat jest „pod kursorem" klawiatury. Skrzynka to ekran, na
   * którym robi się SERIĘ decyzji pod rząd — przy dwudziestu kandydatach
   * sięganie po mysz do każdego „Weź" jest tym, co odróżnia narzędzie od
   * formularza. Tabela leadów ma `j`/`k` od dawna; tu ich brakowało. */
  const [kursor, setKursor] = useState(0);
  const [rozwiniete, setRozwiniete] = useState<Set<string>>(new Set());
  const kursorRef = useRef<HTMLDivElement | null>(null);
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
        const d = (await res.json().catch(() => ({}))) as { error?: string; blacklistId?: string | null };
        if (!res.ok) {
          toast(d.error ?? "Nie udało się odrzucić kandydata.", "error");
          return;
        }
        if (d.blacklistId) setOstatnioOdrzucony({ nazwa: k.nazwa, blacklistId: d.blacklistId });
        await onOdswiez();
      } finally {
        setZajety(false);
      }
    },
    [confirm, toast, onOdswiez]
  );

  /** Zdejmuje z czarnej listy i — gdy wiersz kandydata jeszcze żyje — wraca go
   * do skrzynki. Samo zdjęcie z listy znaczy tylko „łowca ma prawo znaleźć tę
   * firmę ponownie", co przy retencji 30 dni bywa dopiero za kilka dni. */
  const przywroc = useCallback(
    async (blacklistId: string, zKandydatem: boolean) => {
      const res = await fetch(`/api/leads/blacklist/${blacklistId}${zKandydatem ? "?kandydat=1" : ""}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast("Nie udało się zdjąć firmy z czarnej listy.", "error");
        return;
      }
      const d = (await res.json().catch(() => ({}))) as { przywrocony?: boolean };
      setOstatnioOdrzucony(null);
      toast(
        d.przywrocony
          ? "Kandydat wrócił do skrzynki."
          : "Firma zdjęta z czarnej listy — łowca może ją znaleźć ponownie."
      );
      await onOdswiez();
    },
    [toast, onOdswiez]
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

  /** Zapis zmiany polowania. Serwer przy zmianie kryteriów (PKD/obszar) sam
   * zeruje kursor — inaczej nowa lista PKD zaczynałaby od strony 7 STAREGO
   * zapytania i po cichu pomijała pierwsze setki firm. */
  const zapiszPolowanie = useCallback(
    async (id: string, pola: Record<string, string>) => {
      const res = await fetch(`/api/leads/hunts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pola),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        toast(d.error ?? "Nie udało się zapisać polowania.", "error");
        return;
      }
      setEdytowane(null);
      await onOdswiez();
    },
    [toast, onOdswiez]
  );

  const usunPolowanie = useCallback(
    async (p: Polowanie) => {
      // Kandydaci z tego polowania ZOSTAJĄ w skrzynce — to, że przestajemy
      // szukać, nie znaczy, że znalezione firmy mają zniknąć. Mówimy to
      // wprost, bo bez tego kasowanie wyglądałoby groźniej, niż jest.
      const ok = await confirm(
        `Usunąć polowanie „${p.nazwa}”?\n\nZnalezieni już kandydaci zostają w skrzynce — znika tylko samo szukanie.`,
        { danger: true }
      );
      if (!ok) return;
      const res = await fetch(`/api/leads/hunts/${p.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast("Nie udało się usunąć polowania.", "error");
        return;
      }
      await onOdswiez();
    },
    [confirm, toast, onOdswiez]
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

  /** Odrzucenie z klawiatury musi zapytać o powód tak samo jak myszą — powód
   * jest jednym z dwóch liczników pętli poprawy sita, więc skrót, który by go
   * pomijał, po cichu psułby statystykę. */
  const odrzucZKlawiatury = useCallback(
    async (k: Kandydat) => {
      const powod = await choose(`Dlaczego odrzucasz „${k.nazwa}”?`, [
        ...POWODY_ODRZUCENIA.map((p) => ({ value: p, label: p, danger: true })),
      ]);
      if (powod) await odrzuc(k, powod);
    },
    [choose, odrzuc]
  );

  const przelaczRozwiniecie = useCallback((id: string) => {
    setRozwiniete((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  useEffect(() => {
    const widoczni = [...czolo, ...(pokazC ? ogon : [])];
    function onKey(e: KeyboardEvent) {
      // Nie przechwytujemy liter wpisywanych w wyszukiwarkę ani w formularze.
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!widoczni.length) return;

      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        setKursor((i) => Math.min(widoczni.length - 1, Math.max(0, i + (e.key === "j" ? 1 : -1))));
        return;
      }
      const k = widoczni[Math.min(kursor, widoczni.length - 1)];
      if (!k) return;
      if (e.key === "t") {
        e.preventDefault();
        void wez(k);
      } else if (e.key === "x") {
        e.preventDefault();
        void odrzucZKlawiatury(k);
      } else if (e.key === "Enter") {
        e.preventDefault();
        przelaczRozwiniecie(k.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [czolo, ogon, pokazC, kursor, wez, odrzucZKlawiatury, przelaczRozwiniecie]);

  // Kursor poza listą po przyjęciu/odrzuceniu ostatniej pozycji — cofamy go,
  // żeby `t` nie przestało nagle działać.
  useEffect(() => {
    const ile = czolo.length + (pokazC ? ogon.length : 0);
    if (kursor > 0 && kursor >= ile) setKursor(Math.max(0, ile - 1));
  }, [czolo.length, ogon.length, pokazC, kursor]);

  useEffect(() => {
    kursorRef.current?.scrollIntoView({ block: "nearest" });
  }, [kursor]);

  // Wywołania z palety poleceń. `> 0` pomija pierwsze renderowanie: bez tego
  // samo wejście w zakładkę odpalałoby polowanie.
  useEffect(() => {
    if (polujSygnal > 0) void polujTeraz();
    // Świadomie bez `polujTeraz` w zależnościach — chcemy reagować na SYGNAŁ,
    // a nie na każdą zmianę tożsamości funkcji.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polujSygnal]);

  useEffect(() => {
    if (nowePolowanieSygnal > 0) setNowePolowanie(true);
  }, [nowePolowanieSygnal]);

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

      {/* Odwrót od nieodwracalnej akcji, w zasięgu ręki. */}
      <AnimatePresence>
        {ostatnioOdrzucony && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: EASE_LIQUID }}
            className="flex flex-wrap items-center gap-2 rounded-xl border hairline bg-hairline/40 px-3 py-2 text-[12.5px]"
          >
            <span className="text-muted">
              Odrzucono <b className="text-[var(--fg)]">{ostatnioOdrzucony.nazwa}</b> — firma jest na czarnej liście.
            </span>
            <span className="flex-1" />
            <button
              onClick={() => przywroc(ostatnioOdrzucony.blacklistId, true)}
              className="rounded-full border hairline px-3 py-1 text-[12px] text-[var(--fg)] hover:bg-[var(--hairline)]"
            >
              Cofnij
            </button>
            <button onClick={() => setOstatnioOdrzucony(null)} className="rounded-md p-1 text-muted hover:text-[var(--fg)]">
              <IconX size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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
                {/* Kryteria kręci się w pierwszych tygodniach najczęściej —
                    do 2026-07-25 dało się polowanie tylko utworzyć i wyłączyć
                    (trasy PATCH/DELETE istniały, ale nic ich nie wołało). */}
                <button
                  onClick={() => setEdytowane(p)}
                  className="rounded-md px-2 py-0.5 text-[12px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]"
                >
                  Zmień
                </button>
                <button
                  onClick={() => usunPolowanie(p)}
                  className="rounded-md p-1 text-muted hover:text-red-400"
                  aria-label={`Usuń polowanie ${p.nazwa}`}
                >
                  <IconTrash size={14} />
                </button>
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
          {czolo.map((k, i) => (
            <KartaKandydata key={k.id} k={k} onWez={wez} onOdrzuc={odrzuc} onZaczepka={generujZaczepke} zajety={zajety}
              rozwiniete={rozwiniete.has(k.id)} onToggle={() => przelaczRozwiniecie(k.id)}
              podKursorem={i === kursor} refKursora={(el) => (kursorRef.current = el)} />
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
              {ogon.map((k, i) => (
                <KartaKandydata key={k.id} k={k} onWez={wez} onOdrzuc={odrzuc} onZaczepka={generujZaczepke} zajety={zajety}
                  rozwiniete={rozwiniete.has(k.id)} onToggle={() => przelaczRozwiniecie(k.id)}
                  podKursorem={czolo.length + i === kursor} refKursora={(el) => (kursorRef.current = el)} />
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
                <KartaKandydata key={k.id} k={k} onWez={wez} onOdrzuc={odrzuc} onZaczepka={generujZaczepke} zajety={zajety}
                  rozwiniete={rozwiniete.has(k.id)} onToggle={() => przelaczRozwiniecie(k.id)} podKursorem={false} />
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

      {/* ── Czarna lista ── raz odrzucony nie wraca, ale musi dać się zobaczyć
          i cofnąć. Nieodwracalna akcja bez podglądu i bez wyjścia to nie
          „ochrona przed pomyłką", tylko pomyłka na zawsze. */}
      {czarnaLista.length > 0 && (
        <div>
          <button
            onClick={() => setPokazCzarna((v) => !v)}
            className="flex items-center gap-1 text-[12.5px] text-muted hover:text-[var(--fg)]"
          >
            <motion.span animate={{ rotate: pokazCzarna ? 90 : 0 }} transition={{ duration: 0.18, ease: EASE_LIQUID }} className="inline-flex">
              <IconChevronRight size={14} />
            </motion.span>
            Czarna lista ({czarnaLista.length}) — firmy, których łowca już nie zaproponuje
          </button>
          {pokazCzarna && (
            <div className="card-paper mt-2 rounded-2xl border hairline p-4">
              <ul className="space-y-1 text-[12.5px]">
                {czarnaLista.map((w) => (
                  <li key={w.id} className="flex flex-wrap items-center gap-2 border-b hairline py-1.5 last:border-0">
                    <span className="min-w-0 flex-1 truncate">{w.nazwa_norm || "(bez nazwy)"}</span>
                    {w.nip && <span className="font-mono text-[11.5px] text-muted">NIP {w.nip}</span>}
                    <span className="rounded-full bg-[var(--hairline)] px-2 py-0.5 text-[11px] text-muted">{w.powod}</span>
                    <button
                      onClick={() => przywroc(w.id, true)}
                      className="rounded-md px-2 py-0.5 text-[12px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]"
                    >
                      Przywróć
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11.5px] text-muted">
                Trzymamy tu wyłącznie NIP, nazwę i powód — nie adres, nie kontakt. „Przywróć" pozwala łowcy znaleźć
                firmę ponownie; jeśli jej karta jeszcze nie wygasła, wraca do skrzynki od razu.
              </p>
            </div>
          )}
        </div>
      )}

      <NowePolowanieModal open={nowePolowanie} onClose={() => setNowePolowanie(false)} onSave={dodajPolowanie} />
      <EdycjaPolowaniaModal polowanie={edytowane} onClose={() => setEdytowane(null)} onSave={zapiszPolowanie} />

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

/* ────────────────────────── edycja polowania ────────────────────────── */

/** Zmiana kryteriów istniejącego polowania.
 *
 * Stan pól zaczyna od `useState` z wartości polowania, a komponent dostaje
 * `key={polowanie.id}` — bez tego drugie otwarcie okna dla INNEGO polowania
 * pokazywałoby dane pierwszego (`useState` czyta wartość początkową raz, przy
 * montowaniu; `.onAppear`/`useEffect` dosypujący ją później to ta sama pułapka,
 * co formularz kłamiący datą w apce). */
function EdycjaPolowaniaModal({
  polowanie,
  onClose,
  onSave,
}: {
  polowanie: Polowanie | null;
  onClose: () => void;
  onSave: (id: string, pola: Record<string, string>) => Promise<void>;
}) {
  return (
    <Modal open={Boolean(polowanie)} onClose={onClose} card="card-paper my-auto w-full max-w-lg rounded-2xl border hairline p-6">
      {polowanie && <FormularzPolowania key={polowanie.id} polowanie={polowanie} onClose={onClose} onSave={onSave} />}
    </Modal>
  );
}

function FormularzPolowania({
  polowanie,
  onClose,
  onSave,
}: {
  polowanie: Polowanie;
  onClose: () => void;
  onSave: (id: string, pola: Record<string, string>) => Promise<void>;
}) {
  const [nazwa, setNazwa] = useState(polowanie.nazwa);
  const [pkd, setPkd] = useState(polowanie.pkd);
  const [wojewodztwo, setWojewodztwo] = useState(polowanie.wojewodztwo);
  const [powiat, setPowiat] = useState(polowanie.powiat);
  const [miasto, setMiasto] = useState(polowanie.miasto);
  const [zapisuje, setZapisuje] = useState(false);

  return (
    <>
      <h2 className="text-lg font-semibold">Zmień polowanie</h2>
      <p className="mt-1 text-[12.5px] text-muted">
        Zmiana kodów PKD albo obszaru cofa polowanie na początek listy — inaczej szukałoby dalej od miejsca, w którym
        skończyło poprzednie kryteria, i pominęłoby pierwsze setki firm.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setZapisuje(true);
          try {
            await onSave(polowanie.id, { nazwa, pkd, wojewodztwo, powiat, miasto });
          } finally {
            setZapisuje(false);
          }
        }}
        className="mt-4 space-y-4 text-[13px]"
      >
        {/* Moduł 59, paczka F+ — te same wiersze, co w profilach rekordów. */}
        <SekcjaProfilu tytul="Kryteria">
          <WierszPola etykieta="Nazwa">
            <input value={nazwa} onChange={(e) => setNazwa(e.target.value)} className={poleLowcyCls} autoFocus />
          </WierszPola>
          <WierszPola etykieta="Kody PKD" title="Po przecinku, wystarczą pierwsze cyfry">
            <input value={pkd} onChange={(e) => setPkd(e.target.value)} className={`${poleLowcyCls} font-mono`} />
          </WierszPola>
          <WierszPola etykieta="Województwo">
            <input value={wojewodztwo} onChange={(e) => setWojewodztwo(e.target.value)} className={poleLowcyCls} />
          </WierszPola>
          <WierszPola etykieta="Powiat">
            <input value={powiat} onChange={(e) => setPowiat(e.target.value)} placeholder="dowolny" className={poleLowcyCls} />
          </WierszPola>
          <WierszPola etykieta="Miasto">
            <input value={miasto} onChange={(e) => setMiasto(e.target.value)} placeholder="dowolne" className={poleLowcyCls} />
          </WierszPola>
        </SekcjaProfilu>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-full border hairline px-4 py-1.5 text-[12.5px] text-muted">
            Anuluj
          </button>
          <button type="submit" disabled={!nazwa.trim() || zapisuje} className="btn-primary rounded-full px-4 py-1.5 text-[12.5px] disabled:opacity-50">
            {zapisuje ? "Zapisuję…" : "Zapisz"}
          </button>
        </div>
      </form>
    </>
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
        className="mt-4 space-y-4 text-[13px]"
      >
        <SekcjaProfilu tytul="Kryteria">
          <WierszPola etykieta="Nazwa" title="Tylko dla Ciebie — nie wychodzi na zewnątrz">
            <input
              value={nazwa}
              onChange={(e) => setNazwa(e.target.value)}
              placeholder="Biura rachunkowe — Mazowsze"
              className={poleLowcyCls}
              autoFocus
            />
          </WierszPola>
          <WierszPola etykieta="Kody PKD" title="Po przecinku, wystarczą pierwsze cyfry">
            <input value={pkd} onChange={(e) => setPkd(e.target.value)} className={`${poleLowcyCls} font-mono`} />
          </WierszPola>
          <WierszPola etykieta="Województwo">
            <input value={wojewodztwo} onChange={(e) => setWojewodztwo(e.target.value)} className={poleLowcyCls} />
          </WierszPola>
          <WierszPola etykieta="Powiat">
            <input value={powiat} onChange={(e) => setPowiat(e.target.value)} placeholder="dowolny" className={poleLowcyCls} />
          </WierszPola>
          <WierszPola etykieta="Miasto">
            <input value={miasto} onChange={(e) => setMiasto(e.target.value)} placeholder="dowolne" className={poleLowcyCls} />
          </WierszPola>
        </SekcjaProfilu>
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
