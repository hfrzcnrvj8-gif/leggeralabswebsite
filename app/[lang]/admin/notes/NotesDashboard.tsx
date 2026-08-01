"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconPin,
  IconPinFilled,
  IconArchive,
  IconArchiveOff,
  IconNotes,
  IconPlus,
  IconArrowsMaximize,
  IconFolderPlus,
  IconTrash,
} from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import { formatPlDate } from "@/lib/projects";
import { EditableText, EditableTextarea } from "../components";
import { Tooltip } from "../Tooltip";
import { FilterPills, FilterPillsBar } from "../FilterPills";
import { LinkPicker, type LinkValue } from "../LinkPicker";
import { Modal } from "../Modal";
import { ContextMenu, ContextMenuItem, MenuDivider, useContextMenu } from "../Menu";
import { useUI, useRegisterActions } from "../ui";
import { StanListy, StanBledu } from "../StanPusty";
import { useSkrotyListy } from "../klawiatura";
import { PoleSzukania } from "../PoleSzukania";
import { ExpandingIconButton } from "../ExpandingIconButton";
import { pobierzJSON, komunikatBledu } from "../dane";
import { NoteDetailPanel } from "./NoteDetailPanel";
import {
  matchesTab,
  noteHaystack,
  noteLinkValue,
  NOTE_TABS,
  NoteBadges,
  NoteScheduleForm,
  parseTags,
  useNoteActions,
  type Note,
  type NoteTab,
} from "./shared";

export function NotesDashboard({ lang }: { lang: Locale }) {
  const { toast } = useUI();
  const [notes, setNotes] = useState<Note[] | null>(null);
  // Trzeci wariant pustego stanu (paczka E) — patrz komentarz w LeadsDashboard.
  const [blad, setBlad] = useState<string | null>(null);
  const [newText, setNewText] = useState("");
  const [newLink, setNewLink] = useState<LinkValue>({});
  const [tab, setTab] = useState<NoteTab>("all");
  const [tagFilter, setTagFilter] = useState("");
  const [linkFilter, setLinkFilter] = useState<LinkValue>({});
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const newTextRef = useRef<HTMLTextAreaElement>(null);
  const szukajRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await pobierzJSON<{ notes: Note[] }>("/api/notes");
      setNotes(data.notes);
      setBlad(null);
    } catch (e) {
      setBlad(komunikatBledu(e));
    }
  }, []);

  useEffect(() => {
    load();
    const saved = window.localStorage.getItem("leggera_notes_tag_filter");
    if (saved) setTagFilter(saved);
  }, [load]);

  useEffect(() => {
    window.localStorage.setItem("leggera_notes_tag_filter", tagFilter);
  }, [tagFilter]);

  const { patch, togglePin, setArchived, remove, promote, schedule } = useNoteActions(load);
  const ctl = useContextMenu<Note>();

  const addNote = async () => {
    if (!newText.trim()) return;
    const [firstLine, ...rest] = newText.trim().split("\n");
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tytul: firstLine.slice(0, 120),
        tresc: rest.join("\n") || firstLine,
        ...newLink,
      }),
    });
    if (res.ok) {
      setNewText("");
      setNewLink({});
      load();
    } else {
      toast("Nie udało się zapisać notatki.", "error");
    }
  };

  const allTags = useMemo(() => {
    const set = new Set<string>();
    (notes ?? []).forEach((n) => parseTags(n.tagi).forEach((t) => set.add(t)));
    return [...set];
  }, [notes]);

  const filtered = useMemo(() => {
    let list = (notes ?? []).filter((n) => matchesTab(n, tab));
    if (tagFilter) list = list.filter((n) => parseTags(n.tagi).includes(tagFilter));
    if (linkFilter.client_id) list = list.filter((n) => n.client_id === linkFilter.client_id);
    if (linkFilter.lead_id) list = list.filter((n) => n.lead_id === linkFilter.lead_id);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((n) => noteHaystack(n).includes(q));
    }
    return list;
  }, [notes, tab, tagFilter, linkFilter, search]);

  useRegisterActions(
    [{ id: "add", label: "+ Nowa notatka", hint: "N", run: () => newTextRef.current?.focus() }],
    []
  );

  // „/", j/k i Enter — wspólny hook (Moduł 59, paczka C). Kursor chodzi po
  // kartach w kolejności siatki (rzędami), Enter otwiera profil notatki.
  const { wiersz } = useSkrotyListy({
    elementy: filtered,
    otworz: (n) => setOpenId(n.id),
    szukajRef,
    wyczyscSzukanie: () => setSearch(""),
    aktywne: !openId,
  });

  if (!notes) {
    // Szkielet TYLKO wtedy, gdy naprawdę czekamy — przy awarii pulsował
    // w nieskończoność (paczka E).
    if (blad) {
      return (
        <div className="card-paper rounded-2xl">
          <StanBledu blad={blad} onPonow={load} />
        </div>
      );
    }
    return <div className="h-48 animate-pulse rounded-2xl bg-[var(--hairline)]" />;
  }

  // Licznik w nagłówku pomija archiwalne — „Notatnik · 12" ma znaczyć „tyle
  // masz na biurku", a nie „tyle wierszy jest w bazie".
  const activeCount = notes.filter((n) => !n.archived_at).length;

  /* Słowa pustego stanu dobrane do PRAWDZIWEJ przyczyny, nie do zakładki.
   * Audyt 2026-08-02: „Archiwum" + fraza bez trafień pisało „Archiwum jest
   * puste — nic jeszcze nie schowałeś z biurka", mając w archiwum wpisy;
   * jeden zestaw słów obsługiwał dwie różne przyczyny. To trzeci raz z rzędu
   * ten sam błąd (Poczta, Przypomnienia), więc rozdzielamy przyczyny wprost:
   * o pustym archiwum wolno mówić TYLKO wtedy, gdy archiwum jest jedynym
   * zawężeniem. */
  const szukaLubFiltruje = !!search || !!tagFilter || !!linkFilter.client_id || !!linkFilter.lead_id;
  const powodPustki = (() => {
    if (tab === "archived" && !szukaLubFiltruje) {
      return {
        tytul: "Archiwum jest puste",
        opis: "Nic jeszcze nie schowałeś z biurka — notatki lądują tu dopiero po zarchiwizowaniu.",
      };
    }
    if (tab === "pinned" && !szukaLubFiltruje) {
      return {
        tytul: "Nic nie jest przypięte",
        opis: "Przypnij notatkę pinezką na karcie, a wyląduje tutaj i na górze listy.",
      };
    }
    if (search) {
      return {
        tytul: `Nic nie pasuje do „${search}"`,
        opis:
          tab === "archived"
            ? "Szukamy tylko w archiwum — przełącz na zakładkę Wszystkie, żeby przejrzeć całość."
            : "Szukanie obejmuje tytuł, treść, tagi i log notatki.",
      };
    }
    return {
      tytul: "Nic nie pasuje do tych filtrów",
      opis: "Notatki są, ale żadna nie spełnia zaznaczonych warunków.",
    };
  })();

  return (
    // `flex flex-1 flex-col md:min-h-0` (Moduł 35) — przekazuje wysokość okna w dół.
    <div className="-mx-4 flex flex-1 flex-col sm:-mx-6 md:min-h-0">
      <div className="flex shrink-0 items-center gap-2 border-b hairline px-4 sm:px-6" style={{ height: "44px" }}>
        <span className="text-[13px] text-muted">Notatnik · {activeCount}</span>
        <PoleSzukania ref={szukajRef} value={search} onChange={setSearch} podpowiedz="Szuka w tytule, treści, tagach i logu notatki" />
        {/* Filtr po kliencie/leadzie — wzorem Kalendarza, ale przez wspólny
            LinkPicker (Moduł 22) zamiast surowego <select>. */}
        <LinkPicker
          kinds={["client", "lead"]}
          value={linkFilter}
          onPick={(next) => setLinkFilter(next)}
          align="right"
          placeholder="Wszyscy"
        />
        {/* Moduł 59, paczka G — „+" w tym samym rogu, co w każdym innym module.
            Notatnik dodaje przez pole na górze treści, więc „+" nie otwiera
            okna, tylko ustawia w nim kursor: dokładnie to, co robi już
            `Cmd+K → + Nowa notatka`. Bez tego jedyna droga do dodawania
            prowadziła przez zauważenie pola w treści (kategoria 5). */}
        <ExpandingIconButton
          label="Nowa notatka"
          icon={<IconPlus size={16} />}
          onClick={() => newTextRef.current?.focus()}
        />
      </div>

      <div className="flex flex-1 flex-col px-4 py-4 sm:px-6 md:min-h-0">
        <div className="card-paper mb-6 rounded-xl border hairline p-4">
          <textarea
            ref={newTextRef}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                addNote();
              }
            }}
            placeholder="Nowy pomysł / notatka… pierwsza linia stanie się tytułem. (Cmd+Enter, by zapisać)"
            rows={3}
            className="w-full rounded-lg border hairline bg-transparent px-3 py-2 text-sm text-[var(--fg)] placeholder:text-muted"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <LinkPicker
              kinds={["client", "lead"]}
              value={newLink}
              onPick={(next) => setNewLink(next)}
              align="right"
              placeholder="— powiąż —"
            />
            <button
              onClick={addNote}
              disabled={!newText.trim()}
              className="rounded-md border hairline px-3 py-1.5 text-[12.5px] font-medium text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Zapisz notatkę
            </button>
          </div>
        </div>

        {/* Dwa rzędy pigułek, nie jeden: stan (zakładka) i tag to niezależne
            osie — da się chcieć „przypięte z tagiem marketing".
            Każdy rząd MUSI mieć własny `layoutId` — oba są na ekranie naraz,
            więc wspólny sprawiłby, że podświetlenie przelatuje z zakładek do
            tagów (patrz komentarz w FilterPills.tsx). */}
        <div className="mb-3 flex">
          <FilterPillsBar>
            <FilterPills value={tab} onChange={setTab} size="sm" pills={NOTE_TABS} layoutId="notes-tab-pill" />
          </FilterPillsBar>
        </div>

        {allTags.length > 0 && (
          // Tagi świadomie BEZ szkła: siedzą pod polem notatki, a `.glass` na
          // karcie robiłby z nich drugą kartę na karcie. Szkło dostaje rząd
          // zakładek (chrome listy), nie ten.
          <div className="mb-4 flex flex-wrap gap-1.5">
            <FilterPills
              value={tagFilter}
              onChange={setTagFilter}
              size="sm"
              layoutId="notes-tag-pill"
              pills={[{ id: "", label: "Wszystkie tagi" }, ...allTags.map((t) => ({ id: t, label: t }))]}
            />
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="card-paper rounded-2xl">
            <StanListy
              blad={blad}
              onPonow={load}
              // „Archiwum" to zakładka, czyli też filtr — puste archiwum nie
              // znaczy „nie masz notatek", tylko „nic tu nie odłożyłeś".
              filtrAktywny={tab !== "all" || !!tagFilter || !!search || !!linkFilter.client_id || !!linkFilter.lead_id}
              onWyczyscFiltr={() => { setTab("all"); setTagFilter(""); setLinkFilter({}); setSearch(""); }}
              filtrTytul={powodPustki.tytul}
              filtrOpis={powodPustki.opis}
              ikona={IconNotes}
              tytul="Notatnik jest pusty"
              opis="Notatnik jest miejscem na to, co pada w rozmowie, zanim stanie się leadem, zadaniem albo wydarzeniem — bez niego ustalenia zostają wyłącznie w głowie."
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((n, i) => (
              // Menu pod prawym przyciskiem — ten sam `useContextMenu`, co
              // w pozostałych modułach. Notatnik był po Module 66 jednym
              // z dwóch ostatnich ekranów bez niego (audyt 2026-08-02).
              <div key={n.id} onContextMenu={(e) => ctl.openAt(e, n)} {...wiersz(i, "card-paper rounded-2xl p-4")}>
                <div className="flex items-start gap-1.5">
                  {/* Akcje karty notatki: dymek, nie pigułka. Karta to inna
                      powierzchnia niż pasek/wiersz tabeli — pinezka siedzi przy
                      lewej krawędzi (pigułka rozsuwałaby się w lewo poza kartę),
                      a „⤢" to znak typograficzny, nie ikona Tablera. */}
                  {/* Trafienie 26 px, ikona dalej 14 px. Zmierzone w audycie
                      Notatnika 2026-08-02: pinezka i archiwum miały 14×14,
                      a „⤢" aż 6×17 — poniżej progu 24×24 z WCAG 2.5.8.
                      `-m-1.5` cofa `p-1.5`, więc układ karty się nie rusza
                      (ten sam zabieg, co przy Przypomnieniach). */}
                  <Tooltip label={n.pinned ? "Odepnij" : "Przypnij na górze listy"}>
                    <button
                      onClick={() => togglePin(n)}
                      aria-label={n.pinned ? "Odepnij" : "Przypnij na górze listy"}
                      className="-m-1.5 flex shrink-0 items-center justify-center p-1.5 text-[13px] transition-opacity"
                      style={{ opacity: n.pinned ? 1 : 0.3 }}
                    >
                      {n.pinned ? <IconPinFilled size={14} /> : <IconPin size={14} />}
                    </button>
                  </Tooltip>
                  <div className="min-w-0 flex-1">
                    <EditableText value={n.tytul} onSave={(v) => patch(n.id, { tytul: v })} />
                  </div>
                  <Tooltip label="Otwórz profil notatki">
                    <button
                      onClick={() => setOpenId(n.id)}
                      aria-label="Otwórz profil notatki"
                      // Znak „⤢" jest wąski (6 px), więc samo `p-1.5` nie
                      // wystarcza do progu — trafienie dostaje jawne 24×24.
                      className="-m-1.5 flex h-6 w-6 shrink-0 items-center justify-center text-[11px] text-muted hover:text-[var(--fg)]"
                    >
                      ⤢
                    </button>
                  </Tooltip>
                </div>

                {/* Sufit wysokości TYLKO na karcie — długa notatka przewija
                    się wewnątrz pola zamiast rozpychać kafelek na kilka
                    ekranów. Pełną treść widać w profilu („⤢"), gdzie limitu
                    nie ma, bo tam czyta się jedną notatkę. */}
                <div className="mt-1 text-sm">
                  <EditableTextarea value={n.tresc} onSave={(v) => patch(n.id, { tresc: v })} maxWysokosc={240} />
                </div>

                <div className="mt-2">
                  <input
                    key={n.id}
                    defaultValue={n.tagi}
                    onBlur={(e) => patch(n.id, { tagi: e.target.value })}
                    placeholder="tagi, po przecinku"
                    className="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-[11px] text-muted placeholder:text-muted/60 hover:border-[var(--hairline)] focus:border-zaznaczenie/60 focus:outline-none"
                  />
                </div>

                <div className="mt-1.5">
                  <LinkPicker
                    kinds={["client", "lead"]}
                    value={noteLinkValue(n)}
                    onPick={(next) => patch(n.id, next)}
                  />
                </div>

                <NoteBadges note={n} lang={lang} />

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {!n.project_id && (
                    <button
                      onClick={() => promote(n, lang)}
                      className="rounded-md border hairline px-2.5 py-1 text-[11px] text-[var(--zaznaczenie)]"
                    >
                      → Przekuj w projekt
                    </button>
                  )}
                  <NoteScheduleForm note={n} onSchedule={(d, g) => schedule(n, d, g)} />
                  <span className="flex-1" />
                  <Tooltip label={n.archived_at ? "Przywróć na biurko" : "Do archiwum"}>
                    <button
                      onClick={() => setArchived(n, !n.archived_at)}
                      aria-label={n.archived_at ? "Przywróć na biurko" : "Do archiwum"}
                      className="-m-1.5 flex shrink-0 items-center justify-center p-1.5 text-muted hover:text-[var(--fg)]"
                    >
                      {n.archived_at ? <IconArchiveOff size={14} /> : <IconArchive size={14} />}
                    </button>
                  </Tooltip>
                </div>

                <p className="mt-2 text-[10.5px] text-muted opacity-60">
                  {formatPlDate(n.updated_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <ContextMenu ctl={ctl}>
        {(n, close) => (
          <>
            <ContextMenuItem
              icon={<IconArrowsMaximize size={14} />}
              label="Otwórz profil"
              onClick={() => { setOpenId(n.id); close(); }}
            />
            <ContextMenuItem
              icon={n.pinned ? <IconPinFilled size={14} /> : <IconPin size={14} />}
              label={n.pinned ? "Odepnij" : "Przypnij na górze"}
              onClick={() => { togglePin(n); close(); }}
            />
            {!n.project_id && (
              <ContextMenuItem
                icon={<IconFolderPlus size={14} />}
                label="Przekuj w projekt"
                onClick={() => { promote(n, lang); close(); }}
              />
            )}
            <MenuDivider />
            <ContextMenuItem
              icon={n.archived_at ? <IconArchiveOff size={14} /> : <IconArchive size={14} />}
              label={n.archived_at ? "Przywróć na biurko" : "Do archiwum"}
              onClick={() => { setArchived(n, !n.archived_at); close(); }}
            />
            {/* „Usuń trwale" tylko z archiwum — ta sama zasada, co w profilu
                (decyzja właściciela 2026-07-17: archiwum główne, usuwanie
                w tle), więc menu nie otwiera drogi na skróty. */}
            {n.archived_at && (
              <ContextMenuItem
                icon={<IconTrash size={14} />}
                label="Usuń trwale"
                danger
                onClick={() => { remove(n); close(); }}
              />
            )}
          </>
        )}
      </ContextMenu>

      {/* Profil rekordu = wyśrodkowany modal (CLAUDE.md). Notatka jest gęsta,
          ale krótka, więc bierze węższy limit niż Leady/Klienci. */}
      <Modal open={!!openId} onClose={() => setOpenId(null)} card="my-auto w-full max-w-3xl">
        {openId && (
          <NoteDetailPanel
            id={openId}
            lang={lang}
            onChanged={load}
            onClose={() => setOpenId(null)}
          />
        )}
      </Modal>
    </div>
  );
}
