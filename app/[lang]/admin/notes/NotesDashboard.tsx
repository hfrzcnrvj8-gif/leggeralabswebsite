"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconPin, IconPinFilled, IconArchive, IconArchiveOff } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import { formatPlDate } from "@/lib/projects";
import { EditableText, EditableTextarea } from "../components";
import { FilterPills, FilterPillsBar } from "../FilterPills";
import { LinkPicker, type LinkValue } from "../LinkPicker";
import { Modal } from "../Modal";
import { useUI, useRegisterActions } from "../ui";
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
  const [newText, setNewText] = useState("");
  const [newLink, setNewLink] = useState<LinkValue>({});
  const [tab, setTab] = useState<NoteTab>("all");
  const [tagFilter, setTagFilter] = useState("");
  const [linkFilter, setLinkFilter] = useState<LinkValue>({});
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const newTextRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/notes");
    if (res.status === 401) {
      window.location.reload();
      return;
    }
    const data = (await res.json()) as { notes: Note[] };
    setNotes(data.notes);
  }, []);

  useEffect(() => {
    load();
    const saved = window.localStorage.getItem("leggera_notes_tag_filter");
    if (saved) setTagFilter(saved);
  }, [load]);

  useEffect(() => {
    window.localStorage.setItem("leggera_notes_tag_filter", tagFilter);
  }, [tagFilter]);

  const { patch, togglePin, setArchived, promote, schedule } = useNoteActions(load);

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

  if (!notes) {
    return <div className="h-48 animate-pulse rounded-2xl bg-[var(--hairline)]" />;
  }

  // Licznik w nagłówku pomija archiwalne — „Notatnik · 12" ma znaczyć „tyle
  // masz na biurku", a nie „tyle wierszy jest w bazie".
  const activeCount = notes.filter((n) => !n.archived_at).length;

  return (
    <div className="-mx-4 sm:-mx-6">
      <div className="flex items-center gap-2 border-b hairline px-4 sm:px-6" style={{ height: "44px" }}>
        <span className="text-[13px] text-muted">Notatnik · {activeCount}</span>
        <span className="flex-1" />
        {/* Filtr po kliencie/leadzie — wzorem Kalendarza, ale przez wspólny
            LinkPicker (Moduł 22) zamiast surowego <select>. */}
        <LinkPicker
          kinds={["client", "lead"]}
          value={linkFilter}
          onPick={(next) => setLinkFilter(next)}
          align="right"
          placeholder="Wszyscy"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Szukaj…"
          title="Szuka w tytule, treści, tagach i logu"
          className="w-40 rounded-md bg-transparent px-2 py-1 text-[12.5px] text-[var(--fg)] placeholder:text-muted"
        />
      </div>

      <div className="px-4 py-4 sm:px-6">
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
          <p className="text-sm text-muted opacity-60">
            {tab === "archived"
              ? "Archiwum jest puste."
              : notes.length === 0
                ? "Brak notatek — dodaj pierwszą powyżej."
                : "Nic nie pasuje do tych filtrów."}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((n) => (
              <div key={n.id} className="card-paper rounded-2xl p-4">
                <div className="flex items-start gap-1.5">
                  <button
                    onClick={() => togglePin(n)}
                    title={n.pinned ? "Odepnij" : "Przypnij na górze listy"}
                    className="shrink-0 text-[13px] transition-opacity"
                    style={{ opacity: n.pinned ? 1 : 0.3 }}
                  >
                    {n.pinned ? <IconPinFilled size={14} /> : <IconPin size={14} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <EditableText value={n.tytul} onSave={(v) => patch(n.id, { tytul: v })} />
                  </div>
                  <button
                    onClick={() => setOpenId(n.id)}
                    title="Otwórz profil notatki"
                    aria-label="Otwórz profil notatki"
                    className="shrink-0 text-[11px] text-muted hover:text-[var(--fg)]"
                  >
                    ⤢
                  </button>
                </div>

                <div className="mt-1 text-sm">
                  <EditableTextarea value={n.tresc} onSave={(v) => patch(n.id, { tresc: v })} />
                </div>

                <div className="mt-2">
                  <input
                    key={n.id}
                    defaultValue={n.tagi}
                    onBlur={(e) => patch(n.id, { tagi: e.target.value })}
                    placeholder="tagi, po przecinku"
                    className="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-[11px] text-muted placeholder:text-muted/60 hover:border-[var(--hairline)] focus:border-[#4ea7fc]/60 focus:outline-none"
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
                      className="rounded-md border hairline px-2.5 py-1 text-[11px] text-[#4ea7fc]"
                    >
                      → Przekuj w projekt
                    </button>
                  )}
                  <NoteScheduleForm note={n} onSchedule={(d, g) => schedule(n, d, g)} />
                  <span className="flex-1" />
                  <button
                    onClick={() => setArchived(n, !n.archived_at)}
                    title={n.archived_at ? "Przywróć na biurko" : "Do archiwum"}
                    aria-label={n.archived_at ? "Przywróć na biurko" : "Do archiwum"}
                    className="shrink-0 text-muted hover:text-[var(--fg)]"
                  >
                    {n.archived_at ? <IconArchiveOff size={14} /> : <IconArchive size={14} />}
                  </button>
                </div>

                <p className="mt-2 text-[10.5px] text-muted opacity-60">
                  {formatPlDate(n.updated_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

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
