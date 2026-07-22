"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconCheck, IconPlus, IconTrash, IconPencil } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import { todayLocalISO } from "@/lib/dates";
import { FilterPills, FilterPillsBar } from "../FilterPills";
import { useUI, useRegisterActions } from "../ui";
import { ReminderDetail } from "./ReminderDetail";
import {
  REMINDER_LIST_COLORS,
  DEFAULT_LIST_COLOR,
  KropkaListy,
  ZnakPriorytetu,
  TerminPrzypomnienia,
  listDotClass,
  type Reminder,
  type ReminderList,
} from "./shared";

/** Pseudo-listy w pasku filtrów. Nie są wierszami w bazie, więc mają własne,
 * niekolidujące identyfikatory (UUID nigdy nie wygląda tak). */
const WSZYSTKIE = "__wszystkie__";
const BEZ_LISTY = "brak";

export function RemindersDashboard({ lang }: { lang: Locale }) {
  const { toast, confirm, prompt } = useUI();
  const [reminders, setReminders] = useState<Reminder[] | null>(null);
  const [lists, setLists] = useState<ReminderList[]>([]);
  const [bezListy, setBezListy] = useState(0);
  const [wybranaLista, setWybranaLista] = useState<string>(WSZYSTKIE);
  const [zUkonczonymi, setZUkonczonymi] = useState(false);
  const [nowy, setNowy] = useState("");
  const [otwarte, setOtwarte] = useState<string | null>(null);
  const poleNowego = useRef<HTMLInputElement>(null);

  const dzisISO = todayLocalISO();

  const wczytaj = useCallback(async () => {
    const q = new URLSearchParams();
    if (wybranaLista !== WSZYSTKIE) q.set("lista", wybranaLista);
    if (zUkonczonymi) q.set("ukonczone", "1");
    const [rRes, lRes] = await Promise.all([
      fetch(`/api/reminders?${q}`),
      fetch("/api/reminders/lists"),
    ]);
    if (rRes.status === 401 || lRes.status === 401) {
      window.location.reload();
      return;
    }
    const dane = (await rRes.json()) as { reminders: Reminder[] };
    const listy = (await lRes.json()) as { lists: ReminderList[]; bez_listy: number };
    setReminders(dane.reminders);
    setLists(listy.lists);
    setBezListy(listy.bez_listy);
  }, [wybranaLista, zUkonczonymi]);

  useEffect(() => {
    wczytaj();
  }, [wczytaj]);

  const dodaj = useCallback(async () => {
    const tytul = nowy.trim();
    if (!tytul) return;
    // Nowe przypomnienie dziedziczy AKTUALNIE oglądaną listę — dodawanie
    // w widoku „Praca" i lądowanie w „Bez listy" byłoby zaskoczeniem.
    const lista_id = wybranaLista === WSZYSTKIE || wybranaLista === BEZ_LISTY ? null : wybranaLista;
    const res = await fetch("/api/reminders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tytul, lista_id }),
    });
    if (!res.ok) {
      toast("Nie udało się dodać przypomnienia.");
      return;
    }
    setNowy("");
    await wczytaj();
    poleNowego.current?.focus();
  }, [nowy, wybranaLista, toast, wczytaj]);

  const patch = useCallback(
    async (id: string, pola: Record<string, unknown>) => {
      const res = await fetch(`/api/reminders/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(pola),
      });
      if (!res.ok) {
        toast("Nie udało się zapisać zmiany.");
        return;
      }
      await wczytaj();
    },
    [toast, wczytaj]
  );

  const usun = useCallback(
    async (r: Reminder) => {
      if (!(await confirm(`Usunąć „${r.tytul}”?`))) return;
      await fetch(`/api/reminders/${r.id}`, { method: "DELETE" });
      if (otwarte === r.id) setOtwarte(null);
      await wczytaj();
    },
    [confirm, otwarte, wczytaj]
  );

  const dodajListe = useCallback(async () => {
    const nazwa = await prompt("Nazwa nowej listy", { placeholder: "np. Księgowość" });
    if (!nazwa?.trim()) return;
    const res = await fetch("/api/reminders/lists", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nazwa: nazwa.trim(), kolor: kolorDlaNowej(lists.length) }),
    });
    if (!res.ok) {
      toast("Nie udało się założyć listy.");
      return;
    }
    await wczytaj();
  }, [prompt, lists.length, toast, wczytaj]);

  // `id: "add"` jest umowne — paleta poleceń wiąże z nim skrót „n" w każdym
  // module (CLAUDE.md). Tu „dodaj" znaczy „ustaw kursor w polu", bo formularza
  // nie ma: przypomnienie powstaje z samego tytułu.
  useRegisterActions(
    [
      { id: "add", label: "+ Dodaj przypomnienie", run: () => poleNowego.current?.focus() },
      { id: "add-list", label: "Nowa lista przypomnień", run: dodajListe },
    ],
    [dodajListe]
  );

  const pigulki = useMemo(
    () => [
      { id: WSZYSTKIE, label: "Wszystkie" },
      ...lists.map((l) => ({ id: l.id, label: `${l.nazwa}${l.liczba_nieukonczonych ? ` (${l.liczba_nieukonczonych})` : ""}` })),
      { id: BEZ_LISTY, label: `Bez listy${bezListy ? ` (${bezListy})` : ""}` },
    ],
    [lists, bezListy]
  );

  const otwarty = reminders?.find((r) => r.id === otwarte) ?? null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <h1 className="text-liquid text-2xl font-semibold">Przypomnienia</h1>
        <button onClick={dodajListe} className="text-[12px] text-muted hover:text-[var(--fg)]">
          + nowa lista
        </button>
      </header>

      <FilterPillsBar>
        <FilterPills
          value={wybranaLista}
          onChange={setWybranaLista}
          pills={pigulki}
          layoutId="reminders-lists"
        />
      </FilterPillsBar>

      {wybranaLista !== WSZYSTKIE && wybranaLista !== BEZ_LISTY && (
        <ZarzadzanieLista
          lista={lists.find((l) => l.id === wybranaLista)}
          onZmiana={wczytaj}
          onUsunieta={() => setWybranaLista(WSZYSTKIE)}
        />
      )}

      {/* Dodawanie na górze, nie na dole — to jest najczęstsza czynność
          w tym module i nie ma powodu, żeby po nią przewijać. */}
      <div className="card-paper mt-4 flex items-center gap-2 rounded-xl px-3 py-2">
        <IconPlus size={16} className="shrink-0 text-muted" />
        <input
          ref={poleNowego}
          value={nowy}
          onChange={(e) => setNowy(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") dodaj();
          }}
          placeholder="Co masz zrobić?"
          className="w-full bg-transparent text-[13.5px] text-[var(--fg)] placeholder:text-muted focus:outline-none"
        />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[12px] text-muted">
          {reminders === null ? "Wczytuję…" : `${reminders.filter((r) => !r.ukonczone).length} do zrobienia`}
        </span>
        <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-muted">
          <input
            type="checkbox"
            checked={zUkonczonymi}
            onChange={(e) => setZUkonczonymi(e.target.checked)}
            className="accent-brand-purple"
          />
          Pokaż ukończone
        </label>
      </div>

      <ul className="mt-2 divide-y divide-[var(--hairline)]">
        {reminders?.map((r) => (
          <li key={r.id} className="group flex items-start gap-3 py-2.5">
            <button
              onClick={() => patch(r.id, { ukonczone: !r.ukonczone })}
              aria-label={r.ukonczone ? "Cofnij odhaczenie" : "Odhacz"}
              className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors ${
                r.ukonczone
                  ? "border-brand-purple bg-brand-purple text-white"
                  : "border-[var(--hairline)] hover:border-brand-purple"
              }`}
            >
              {r.ukonczone && <IconCheck size={12} stroke={3} />}
            </button>

            <button onClick={() => setOtwarte(r.id)} className="min-w-0 flex-1 text-left">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <ZnakPriorytetu priorytet={r.priorytet} />
                <span className={`text-[13.5px] ${r.ukonczone ? "text-muted line-through" : "text-[var(--fg)]"}`}>
                  {r.tytul}
                </span>
                <TerminPrzypomnienia r={r} dzisISO={dzisISO} />
                {r.lista_nazwa && wybranaLista === WSZYSTKIE && (
                  <span className="flex items-center gap-1 text-[11.5px] text-muted">
                    <KropkaListy kolor={r.lista_kolor} />
                    {r.lista_nazwa}
                  </span>
                )}
              </span>
              {r.notatka && <span className="mt-0.5 block truncate text-[12px] text-muted">{r.notatka}</span>}
            </button>

            <button
              onClick={() => usun(r)}
              aria-label="Usuń"
              className="mt-0.5 shrink-0 text-muted opacity-0 transition-opacity hover:text-red-400 focus:opacity-100 group-hover:opacity-100"
            >
              <IconTrash size={15} />
            </button>
          </li>
        ))}
      </ul>

      {reminders !== null && reminders.length === 0 && (
        <p className="mt-6 text-center text-[13px] text-muted">
          {wybranaLista === WSZYSTKIE
            ? "Nic tu jeszcze nie ma. Wpisz coś w pole wyżej."
            : "Ta lista jest pusta."}
        </p>
      )}

      <ReminderDetail
        reminder={otwarty}
        lists={lists}
        onClose={() => setOtwarte(null)}
        onPatch={patch}
      />
    </div>
  );
}

/** Kolor nowej listy bierzemy po kolei z palety, zamiast pytać właściciela
 * przy zakładaniu — kolor da się zmienić jednym kliknięciem, a pytanie
 * o niego w chwili „chcę nową listę" jest tarciem nie na miejscu. */
function kolorDlaNowej(ile: number): string {
  return REMINDER_LIST_COLORS[ile % REMINDER_LIST_COLORS.length] ?? DEFAULT_LIST_COLOR;
}

function ZarzadzanieLista({
  lista,
  onZmiana,
  onUsunieta,
}: {
  lista: ReminderList | undefined;
  onZmiana: () => void;
  onUsunieta: () => void;
}) {
  const { confirm, prompt, toast } = useUI();
  if (!lista) return null;

  const zmienNazwe = async () => {
    const nazwa = await prompt("Nowa nazwa listy", { placeholder: lista.nazwa });
    if (!nazwa?.trim() || nazwa.trim() === lista.nazwa) return;
    await fetch(`/api/reminders/lists/${lista.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nazwa: nazwa.trim() }),
    });
    onZmiana();
  };

  const usunListe = async () => {
    const ile = lista.liczba_nieukonczonych ?? 0;
    // Mówimy WPROST, co się stanie z zawartością. „Usunąć listę?" bez tego
    // zdania każe zgadywać, czy przypomnienia znikną razem z nią.
    const tresc =
      ile > 0
        ? `Usunąć listę „${lista.nazwa}”? ${ile} przypomnień trafi do „Bez listy” — nie znikną.`
        : `Usunąć pustą listę „${lista.nazwa}”?`;
    if (!(await confirm(tresc))) return;
    const res = await fetch(`/api/reminders/lists/${lista.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Nie udało się usunąć listy.");
      return;
    }
    onUsunieta();
    onZmiana();
  };

  const zmienKolor = async (kolor: string) => {
    await fetch(`/api/reminders/lists/${lista.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kolor }),
    });
    onZmiana();
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-muted">
      <span>Lista „{lista.nazwa}”:</span>
      <button onClick={zmienNazwe} className="flex items-center gap-1 hover:text-[var(--fg)]">
        <IconPencil size={13} /> zmień nazwę
      </button>
      <span className="flex items-center gap-1">
        {REMINDER_LIST_COLORS.map((k) => (
          <button
            key={k}
            onClick={() => zmienKolor(k)}
            aria-label={`Kolor ${k}`}
            className={`h-3.5 w-3.5 rounded-full ${listDotClass(k)} ${
              lista.kolor === k ? "ring-2 ring-[var(--fg)] ring-offset-1 ring-offset-[var(--bg)]" : ""
            }`}
          />
        ))}
      </span>
      <button onClick={usunListe} className="hover:text-red-400">
        usuń listę
      </button>
    </div>
  );
}
