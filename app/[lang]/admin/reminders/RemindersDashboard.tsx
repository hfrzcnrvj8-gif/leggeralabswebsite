"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconCheck, IconPlus, IconTrash, IconPencil, IconFlag, IconFlagFilled } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import { todayLocalISO } from "@/lib/dates";
import { FilterPills, FilterPillsBar } from "../FilterPills";
import { useUI, useRegisterActions } from "../ui";
import { ReminderDetail } from "./ReminderDetail";
import { SeriaTag } from "../CyklPicker";
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

  // Szukamy TAKŻE w podzadaniach — inaczej kliknięcie w podzadanie otwierałoby
  // pusty modal, bo lista najwyższego poziomu go nie zawiera.
  const wszystkie = reminders?.flatMap((r) => [r, ...(r.podzadania ?? [])]) ?? [];
  const otwarty = wszystkie.find((r) => r.id === otwarte) ?? null;

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
          {reminders === null ? "Wczytuję…" : `${wszystkie.filter((r) => !r.ukonczone).length} do zrobienia`}
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
          <li key={r.id} className="py-1">
            <WierszPrzypomnienia
              r={r}
              dzisISO={dzisISO}
              pokazListe={wybranaLista === WSZYSTKIE}
              onOtworz={() => setOtwarte(r.id)}
              onPatch={patch}
              onUsun={usun}
            />
            {/* Podzadania z wcięciem — zagnieżdżenie robi API (`podzadania`),
                panel je tylko rysuje. Płaska lista pokazywałaby „Kupić farbę"
                obok „Remont" bez żadnego związku. */}
            {r.podzadania?.length ? (
              <ul className="ml-8 mt-1 space-y-1 border-l border-[var(--hairline)] pl-3">
                {r.podzadania.map((s) => (
                  <li key={s.id}>
                    <WierszPrzypomnienia
                      r={s}
                      dzisISO={dzisISO}
                      pokazListe={false}
                      onOtworz={() => setOtwarte(s.id)}
                      onPatch={patch}
                      onUsun={usun}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
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

/** Jeden wiersz — używany i dla pozycji najwyższego poziomu, i dla podzadań.
 * Ten sam komponent, żeby podzadanie nie zaczęło się z czasem zachowywać
 * inaczej niż zadanie (u Apple'a to dokładnie ta sama rzecz, tylko z wcięciem). */
function WierszPrzypomnienia({
  r,
  dzisISO,
  pokazListe,
  onOtworz,
  onPatch,
  onUsun,
}: {
  r: Reminder;
  dzisISO: string;
  pokazListe: boolean;
  onOtworz: () => void;
  onPatch: (id: string, pola: Record<string, unknown>) => void;
  onUsun: (r: Reminder) => void;
}) {
  return (
    <div className="group flex items-start gap-3 py-1.5">
      <button
        onClick={() => onPatch(r.id, { ukonczone: !r.ukonczone })}
        aria-label={r.ukonczone ? "Cofnij odhaczenie" : "Odhacz"}
        className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors ${
          r.ukonczone
            ? "border-brand-purple bg-brand-purple text-white"
            : "border-[var(--hairline)] hover:border-brand-purple"
        }`}
      >
        {r.ukonczone && <IconCheck size={12} stroke={3} />}
      </button>

      <button onClick={onOtworz} className="min-w-0 flex-1 text-left">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <ZnakPriorytetu priorytet={r.priorytet} />
          <span className={`text-[13.5px] ${r.ukonczone ? "text-muted line-through" : "text-[var(--fg)]"}`}>
            {r.tytul}
          </span>
          <TerminPrzypomnienia r={r} dzisISO={dzisISO} />
          {/* Bez tej pigułki odhaczenie wygląda jak błąd: zadanie „znika"
              i natychmiast wraca z inną datą. Z nią widać, że taka jest
              umowa. */}
          <SeriaTag cykl={r.powtarzanie} />
          {/* Miejsce pokazujemy TYLKO wtedy, gdy da się z niego zrobić
              geofence. Sama nazwa bez współrzędnych wygląda jak obietnica
              powiadomienia, której nikt nie dotrzyma. */}
          {r.lokalizacja && r.lokalizacja_lat != null && (
            <span className="text-[11.5px] text-brand-cyan">
              {r.przy_wyjsciu ? "przy wyjściu: " : "na miejscu: "}
              {r.lokalizacja}
            </span>
          )}
          {pokazListe && r.lista_nazwa && (
            <span className="flex items-center gap-1 text-[11.5px] text-muted">
              <KropkaListy kolor={r.lista_kolor} />
              {r.lista_nazwa}
            </span>
          )}
        </span>
        {r.notatka && <span className="mt-0.5 block truncate text-[12px] text-muted">{r.notatka}</span>}
      </button>

      <button
        onClick={() => onPatch(r.id, { flaga: !r.flaga })}
        aria-label={r.flaga ? "Zdejmij flagę" : "Oznacz flagą"}
        className={`mt-0.5 shrink-0 transition-opacity ${
          r.flaga ? "text-brand-gold opacity-100" : "text-muted opacity-0 hover:text-brand-gold focus:opacity-100 group-hover:opacity-100"
        }`}
      >
        {r.flaga ? <IconFlagFilled size={15} /> : <IconFlag size={15} />}
      </button>

      <button
        onClick={() => onUsun(r)}
        aria-label="Usuń"
        className="mt-0.5 shrink-0 text-muted opacity-0 transition-opacity hover:text-red-400 focus:opacity-100 group-hover:opacity-100"
      >
        <IconTrash size={15} />
      </button>
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
