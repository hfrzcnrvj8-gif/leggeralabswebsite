"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconPlus,
  IconX,
  IconExternalLink,
  IconFileText,
  IconFilePlus,
  IconSearch,
  IconMail,
  IconBell,
  IconLink,
  IconSignature,
  IconThumbDown,
  IconTrash,
} from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import {
  type Contract,
  contractReference,
  contractSilenceDays,
  CONTRACT_REJECT_REASONS,
  CONTRACT_STATUSES,
  CONTRACT_STATUS_CLASS,
  CONTRACT_TYP_LABEL,
} from "@/lib/contracts";
import { formatMoney } from "@/lib/invoices";
import { useUI, useRegisterActions } from "../ui";
import { Popover, MenuRow, MenuDivider, PropertyMenu, useContextMenu, ContextMenu, ContextMenuItem } from "../Menu";
import { ExpandingIconButton } from "../ExpandingIconButton";
import { ContractEditor } from "./ContractEditor";
import { Modal } from "../Modal";
import { OknoOdrzucenia } from "../RejectDialog";

export function ContractsDashboard({ lang }: { lang: Locale }) {
  const { toast, confirm, prompt } = useUI();
  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  /** Menu pod prawym przyciskiem myszy (zgłoszenie właściciela 2026-07-27) —
   * Oferty mają je od Modułu 57, Umowy nie miały żadnego: prawy przycisk
   * otwierał menu przeglądarki. Wszystko, co tu jest, da się zrobić też
   * widocznym przyciskiem albo w profilu — to skrót, nie jedyna droga. */
  const ctx = useContextMenu<Contract>();
  const [szukaj, setSzukaj] = useState("");
  const szukajRef = useRef<HTMLInputElement>(null);
  const [kursor, setKursor] = useState(0);
  /** Rozmiar rejestru po stronie serwera — bez tego ostrzeżenie o sufcie
   * (patrz SUFIT_UMOW w api/contracts) nie miałoby czego porównać. */
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch("/api/contracts");
    if (res.status === 401) {
      window.location.reload();
      return;
    }
    const data = (await res.json()) as { contracts: Contract[]; total?: number };
    setContracts(data.contracts);
    setTotal(data.total ?? data.contracts.length);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createDraft = useCallback(
    async (typ: "umowa" | "nda") => {
      const nazwa = await prompt("Nazwa drugiej strony (firma / osoba) — możesz zostawić puste, np. tylko do podglądu szablonu:", {
        placeholder: "np. Kancelaria X sp. z o.o.",
      });
      if (nazwa === null) return;
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typ, klient_nazwa: nazwa }),
      });
      if (!res.ok) {
        toast(`Nie udało się utworzyć dokumentu (${CONTRACT_TYP_LABEL[typ]}).`, "error");
        return;
      }
      const { id } = (await res.json()) as { id: string };
      await load();
      setOpenId(id);
    },
    [prompt, toast, load]
  );

  const createNda = useCallback(() => createDraft("nda"), [createDraft]);
  const createUmowa = useCallback(() => createDraft("umowa"), [createDraft]);

  /** Sporządź aneks do podpisanej umowy i od razu otwórz go do edycji.
   *
   * Aneks startuje z warunkami umowy-matki, więc otwarcie edytora jest tu
   * całym sensem akcji: właściciel ma zmienić to jedno pole, po które sięgnął.
   * Bez tego dostałby na liście drugi wiersz „Aneks nr 1" wyglądający
   * identycznie jak umowa i musiał zgadywać, co dalej. */
  const createAneks = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/contracts/${id}/aneks`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { id?: string; aneks_nr?: number; error?: string };
      if (!res.ok || !data.id) {
        toast(data.error ?? "Nie udało się sporządzić aneksu.", "error");
        return;
      }
      await load();
      setOpenId(data.id);
      toast(`Aneks nr ${data.aneks_nr} — zmień to, co ma się zmienić, i wyślij do podpisu.`);
    },
    [toast, load]
  );

  const deleteContract = useCallback(
    async (id: string, nazwa: string) => {
      const ok = await confirm(`Usunąć dokument "${nazwa || "(bez nazwy)"}"?`, { danger: true });
      if (!ok) return;
      const res = await fetch(`/api/contracts/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast("Nie udało się usunąć.", "error");
        return;
      }
      setContracts((prev) => prev?.filter((c) => c.id !== id) ?? prev);
      toast("Dokument usunięty.");
    },
    [confirm, toast]
  );

  /** Zmiana statusu z pigułki na liście.
   *
   * „Podpisana" idzie INNĄ trasą (`/accept`) — podpis to `accepted_at`, nie
   * etykieta, a `PATCH` od audytu Modułu 11 odmawia ustawienia tej wartości
   * (patrz blokadaStatusuUmowy). Bez tego rozgałęzienia pigułka pokazywałaby
   * status, którego serwer nie zapisał.
   *
   * Komunikat serwera pokazujemy dosłownie — to on tłumaczy, dlaczego
   * podpisanego dokumentu nie cofa się statusem. */
  const updateStatus = useCallback(
    async (id: string, status: string, powod?: string, komentarz?: string) => {
      const poprzednie = contracts?.find((c) => c.id === id)?.status;
      setContracts((prev) => prev?.map((c) => (c.id === id ? { ...c, status: status as Contract["status"] } : c)) ?? prev);
      const res =
        status === "Podpisana"
          ? await fetch(`/api/contracts/${id}/accept`, { method: "POST" })
          : await fetch(`/api/contracts/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                status,
                ...(powod ? { powod_odrzucenia: powod, komentarz_odrzucenia: komentarz ?? "" } : {}),
              }),
            });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast(data.error ?? "Nie udało się zapisać.", "error");
        // Cofamy podgląd — inaczej lista pokazuje status, którego nie ma w bazie.
        if (poprzednie) {
          setContracts((prev) => prev?.map((c) => (c.id === id ? { ...c, status: poprzednie } : c)) ?? prev);
        }
        return;
      }
      if (status === "Podpisana") await load();
    },
    [contracts, toast, load]
  );

  /** „Odrzucona" nigdy nie zapisuje się bez pytania o powód — tym samym oknem,
   * co w profilu dokumentu (patrz OknoOdrzucenia). Inaczej powód zapisywałby
   * się tylko wtedy, gdy właściciel akurat wszedł w profil. */
  const zmienStatus = useCallback(
    async (id: string, status: string) => {
      if (status === "Odrzucona") {
        setRejectFor(id);
        return;
      }
      await updateStatus(id, status);
    },
    [updateStatus]
  );

  /** Wysyłka mailem — ta sama trasa co w profilu. */
  const wyslijDokument = useCallback(
    async (c: Contract) => {
      const res = await fetch(`/api/contracts/${c.id}/send`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast(data.error ?? "Nie udało się wysłać.", "error");
        return;
      }
      toast("Wysłano mailem.");
      await load();
    },
    [toast, load]
  );

  const przypomnij = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/contracts/${id}/remind`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast(data.error ?? "Nie udało się wysłać przypomnienia.", "error");
        return;
      }
      toast("Przypomnienie wysłane.");
      await load();
    },
    [toast, load]
  );

  /** Link dla drugiej strony — wzorem Ofert. Szkicu publiczna strona nie
   * pokazuje (trasa odrzuca `status = 'Szkic'`), więc pytamy PRZED
   * skopiowaniem, zamiast dawać link prowadzący do „nie znaleziono". */
  const kopiujLink = useCallback(
    async (c: Contract) => {
      if (c.status === "Szkic") {
        toast("To szkic — publiczna strona go nie pokazuje. Wyślij dokument, wtedy link zacznie działać.", "error");
        return;
      }
      const res = await fetch(`/api/share-links/contract/${c.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ensure" }),
      });
      if (!res.ok) {
        toast("Nie udało się przygotować linku.", "error");
        return;
      }
      const data = (await res.json()) as { url: string; revokedAt: string | null };
      if (data.revokedAt) {
        toast("Ten link jest unieważniony — wygeneruj nowy w profilu dokumentu.", "error");
        return;
      }
      try {
        await navigator.clipboard.writeText(data.url);
        toast("Link dla drugiej strony skopiowany.");
      } catch {
        await prompt("Skopiuj link ręcznie (Cmd/Ctrl+C):", { placeholder: data.url });
      }
    },
    [toast, prompt]
  );

  useRegisterActions(
    [
      { id: "add", label: "+ Nowa umowa", hint: "N", run: createUmowa },
      { id: "add-nda", label: "+ Nowe NDA", run: createNda },
    ],
    [createUmowa, createNda]
  );

  const rows = useMemo(() => {
    let list = contracts ?? [];
    if (filterStatus) list = list.filter((c) => c.status === filterStatus);
    const igla = szukaj.trim().toLowerCase();
    if (igla) {
      list = list.filter(
        (c) =>
          (c.klient_nazwa ?? "").toLowerCase().includes(igla) ||
          (c.zakres_prac ?? "").toLowerCase().includes(igla) ||
          contractReference(c).toLowerCase().includes(igla)
      );
    }
    return list;
  }, [contracts, filterStatus, szukaj]);

  // Kursor nie może wskazywać poza przefiltrowaną listę — inaczej Enter
  // otwierałby dokument, którego nie widać (1:1 z Ofertami).
  useEffect(() => {
    setKursor((k) => Math.min(k, Math.max(0, rows.length - 1)));
  }, [rows.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cel = e.target as HTMLElement | null;
      const wPolu = !!cel && (cel.tagName === "INPUT" || cel.tagName === "TEXTAREA" || cel.isContentEditable);
      if (e.key === "Escape" && wPolu && cel === szukajRef.current) {
        setSzukaj("");
        szukajRef.current?.blur();
        return;
      }
      if (wPolu || e.metaKey || e.ctrlKey || e.altKey) return;
      if (openId || rejectFor) return;
      if (e.key === "/") {
        e.preventDefault();
        szukajRef.current?.focus();
      } else if (e.key === "j") {
        setKursor((k) => Math.min(k + 1, Math.max(0, rows.length - 1)));
      } else if (e.key === "k") {
        setKursor((k) => Math.max(k - 1, 0));
      } else if (e.key === "Enter") {
        const cel = rows[kursor];
        if (cel) setOpenId(cel.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, kursor, openId, rejectFor]);

  if (!contracts) {
    return (
      <div className="space-y-3 p-4 sm:p-6">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-[var(--hairline)]" />
        <div className="h-64 animate-pulse rounded-2xl bg-[var(--hairline)]" />
      </div>
    );
  }

  const statusOpts = CONTRACT_STATUSES.map((s) => ({ value: s, label: s }));

  return (
    // `flex flex-1 flex-col md:min-h-0` (Moduł 35) — przekazuje wysokość okna w dół.
    <div className="-mx-4 flex flex-1 flex-col sm:-mx-6 md:min-h-0">
      <div className="flex shrink-0 items-center gap-1 border-b hairline px-4 sm:px-6" style={{ height: "44px" }}>
        <span className="text-[13px] font-medium text-[var(--fg)]">Umowy</span>
        <div className="ml-3 flex min-w-0 flex-1 items-center gap-1.5 text-muted">
          <IconSearch size={13} className="shrink-0" />
          <input
            ref={szukajRef}
            value={szukaj}
            onChange={(e) => setSzukaj(e.target.value)}
            placeholder="Szukaj po stronie, zakresie lub numerze   /"
            className="min-w-0 max-w-[300px] flex-1 bg-transparent text-[12.5px] text-[var(--fg)] placeholder:text-muted focus:outline-none"
          />
        </div>
        <Popover
          align="right"
          width={220}
          trigger={(open) => (
            <button onClick={open} className="flex h-6 items-center rounded-md px-2 text-[12.5px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]">
              {filterStatus || "Status: wszystkie"}
            </button>
          )}
        >
          {(close) => (
            <div>
              <MenuRow label="Wszystkie" selected={!filterStatus} onClick={() => { setFilterStatus(""); close(); }} />
              {CONTRACT_STATUSES.map((s) => (
                <MenuRow key={s} label={s} selected={filterStatus === s} onClick={() => { setFilterStatus(s); close(); }} />
              ))}
            </div>
          )}
        </Popover>
        <Popover
          align="right"
          width={180}
          trigger={(open, isOpen) => (
            <ExpandingIconButton label="Nowy dokument" icon={<IconPlus size={16} />} onClick={open} active={isOpen} />
          )}
        >
          {(close) => (
            <div>
              <MenuRow label="+ Nowa umowa" onClick={() => { close(); createUmowa(); }} />
              <MenuRow label="+ Nowe NDA" onClick={() => { close(); createNda(); }} />
            </div>
          )}
        </Popover>
      </div>

      <div className="flex flex-1 flex-col px-4 py-4 sm:px-6 md:min-h-0">
        <p className="mb-4 max-w-2xl text-[12.5px] text-muted">
          Umowy zwykle powstają automatycznie z zaakceptowanej oferty (przycisk „Wygeneruj umowę” w edytorze oferty),
          NDA zwykle przyciskiem „Wyślij NDA” w profilu leada — ale przyciskiem + powyżej możesz utworzyć wolnostojący
          szkic każdego z nich w dowolnej chwili, np. żeby podejrzeć szablon klauzul.
        </p>

        {contracts.length > 0 && total > contracts.length && (
          <div className="mb-3 rounded-xl border border-brand-gold/40 bg-brand-gold/10 px-3 py-2 text-[12px] text-brand-gold">
            Widzisz {contracts.length} z {total} dokumentów — reszta jest w bazie, ale nie na tej liście.
            Powiedz o tym Claude’owi: czas na stronicowanie.
          </div>
        )}

        {rows.length === 0 ? (
          <div className="card-paper rounded-2xl p-10 text-center text-sm text-muted">
            <IconContractEmpty />
            {/* Pusty stan mówi, czego brakuje i co to zmienia (ustalenie A1) —
                „Brak dokumentów." nie tłumaczyło, po co tu wchodzić. */}
            {szukaj.trim() || filterStatus ? (
              <>
                <p className="mt-2">Nic nie pasuje do tego, czego szukasz.</p>
                <button
                  onClick={() => { setSzukaj(""); setFilterStatus(""); }}
                  className="mt-2 rounded-full border hairline px-3 py-1 text-xs text-[var(--fg)]"
                >
                  Wyczyść filtry
                </button>
              </>
            ) : (
              <>
                <p className="mt-2 text-[var(--fg)]">Nie ma jeszcze żadnej umowy ani NDA.</p>
                <p className="mx-auto mt-1 max-w-md text-[12.5px]">
                  Podpisana umowa to jedyna rzecz, która odblokowuje start projektu z klientem
                  („papier przed pracą”). NDA idzie wcześniej — przed rozmową, w której padną
                  szczegóły cudzych systemów.
                </p>
                <button onClick={createUmowa} className="btn-primary mt-3 rounded-full px-4 py-1.5 text-xs font-semibold">
                  + Nowa umowa
                </button>
              </>
            )}
          </div>
        ) : (
          // `flex-1` + `overflow-auto` (Moduł 35): tabela sięga dołu okna i przewija
          // się w środku, zamiast kończyć się na ostatnim wierszu.
          <div className="card-paper flex-1 overflow-auto rounded-2xl md:min-h-0">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b hairline text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="p-2.5 font-medium">Typ</th>
                  <th className="p-2.5 font-medium">Druga strona</th>
                  <th className="p-2.5 text-right font-medium">Kwota</th>
                  <th className="p-2.5 font-medium">Status</th>
                  <th className="p-2.5 font-medium">Stan</th>
                  <th className="p-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c, i) => (
                  <tr
                    key={c.id}
                    onClick={() => setOpenId(c.id)}
                    onContextMenu={(e) => ctx.openAt(e, c)}
                    className={`cursor-pointer border-b hairline transition-colors hover:bg-[var(--hairline)]/40 ${
                      i === kursor ? "ring-1 ring-inset ring-brand-purple/50" : ""
                    }`}
                  >
                    <td className="p-2.5 font-medium text-[var(--fg)]">
                      {CONTRACT_TYP_LABEL[c.typ]}
                      {c.typ === "aneks" && <span className="ml-1 text-muted">nr {c.aneks_nr}</span>}
                      {/* Do KTÓREJ umowy — dwa aneksy tej samej firmy były na
                          liście nie do odróżnienia (audyt Modułu 11). */}
                      {c.typ === "aneks" && c.poprzednie && (
                        <div className="text-[11px] font-normal text-muted">do {c.poprzednie.reference}</div>
                      )}
                    </td>
                    <td className="p-2.5">{c.klient_nazwa || <span className="text-muted opacity-60">— brak —</span>}</td>
                    {/* Aneks też ma kwotę — to zwykle właśnie ona się w nim zmienia. */}
                    <td className="p-2.5 text-right tabular-nums">
                      {c.typ === "nda" ? "—" : formatMoney(c.cena, c.waluta || "PLN")}
                    </td>
                    <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                      <PropertyMenu value={c.status} options={statusOpts} onChange={(v) => zmienStatus(c.id, v)} title="Zmień status">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${CONTRACT_STATUS_CLASS[c.status] ?? ""}`}>
                          {c.status}
                        </span>
                      </PropertyMenu>
                    </td>
                    {/* „Cisza od N dni" liczona tą samą funkcją, co Pulpit
                        i dzienny mail — dotąd moduł Umowy był jedynym
                        miejscem, które o niej nie mówiło. */}
                    <td className="p-2.5 text-[12px] text-muted">
                      {(() => {
                        const dni = contractSilenceDays(c);
                        if (dni == null) return <span className="opacity-50">—</span>;
                        return (
                          <span className={dni >= 7 ? "text-brand-gold" : ""}>
                            cisza od {dni} {dni === 1 ? "dnia" : "dni"}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Jedyna droga wyjścia z podpisanej umowy — patrz
                            lib/blokadaDokumentu.ts, które właśnie po aneks
                            odsyła. Pokazujemy TYLKO tam, gdzie trasa go zrobi:
                            umowa (nie NDA, nie inny aneks) i podpisana. */}
                        {c.typ === "umowa" && c.status === "Podpisana" && (
                          <ExpandingIconButton
                            label="Sporządź aneks"
                            icon={<IconFilePlus size={15} />}
                            onClick={() => createAneks(c.id)}
                          />
                        )}
                        <ExpandingIconButton
                          label="Podgląd / wydruk"
                          icon={<IconExternalLink size={15} />}
                          href={`/${lang}/admin/contracts/${c.id}/print`}
                          newTab
                        />
                        <ExpandingIconButton
                          label="Usuń"
                          icon={<IconX size={15} />}
                          onClick={() => deleteContract(c.id, c.klient_nazwa)}
                          tone="danger"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={!!openId}
        onClose={() => setOpenId(null)}
        card="card-paper my-auto w-full max-w-5xl rounded-2xl border hairline p-5 sm:p-6"
      >
        {openId && (
          <ContractEditor
            id={openId}
            lang={lang}
            onClose={() => setOpenId(null)}
            onChange={load}
            onDeleted={(id) => {
              setContracts((prev) => prev?.filter((c) => c.id !== id) ?? prev);
              setOpenId(null);
            }}
          />
        )}
      </Modal>

      <ContextMenu ctl={ctx} width={240}>
        {(c, close) => (
          <>
            <ContextMenuItem
              icon={<IconFileText size={14} />}
              label="Otwórz dokument"
              onClick={() => {
                close();
                setOpenId(c.id);
              }}
            />
            <ContextMenuItem
              icon={<IconExternalLink size={14} />}
              label="Podgląd / wydruk"
              onClick={() => {
                close();
                window.open(`/${lang}/admin/contracts/${c.id}/print`, "_blank");
              }}
            />
            <ContextMenuItem
              icon={<IconLink size={14} />}
              label="Kopiuj link dla drugiej strony"
              onClick={() => {
                close();
                kopiujLink(c);
              }}
            />
            <MenuDivider />
            <ContextMenuItem
              icon={<IconMail size={14} />}
              label={c.status === "Szkic" ? "Wyślij do podpisu" : "Wyślij ponownie"}
              disabled={!c.klient_email || c.status === "Podpisana" || c.status === "Odrzucona"}
              onClick={() => {
                close();
                wyslijDokument(c);
              }}
            />
            <ContextMenuItem
              icon={<IconBell size={14} />}
              label="Przypomnij o podpisie"
              disabled={c.status !== "Wysłana" || !c.klient_email}
              onClick={() => {
                close();
                przypomnij(c.id);
              }}
            />
            <MenuDivider />
            <ContextMenuItem
              icon={<IconSignature size={14} />}
              label="Oznacz jako podpisaną"
              disabled={c.status === "Podpisana"}
              onClick={() => {
                close();
                updateStatus(c.id, "Podpisana");
              }}
            />
            <ContextMenuItem
              icon={<IconThumbDown size={14} />}
              label="Nie podpisali…"
              disabled={c.status === "Odrzucona" || c.status === "Podpisana"}
              onClick={() => {
                close();
                setRejectFor(c.id);
              }}
            />
            {/* Aneks tylko tam, gdzie trasa go zrobi: podpisana UMOWA
                (nie NDA, nie inny aneks) — patrz api/contracts/[id]/aneks. */}
            {c.typ === "umowa" && c.status === "Podpisana" && (
              <ContextMenuItem
                icon={<IconFilePlus size={14} />}
                label="Sporządź aneks"
                onClick={() => {
                  close();
                  createAneks(c.id);
                }}
              />
            )}
            <MenuDivider />
            <ContextMenuItem
              icon={<IconTrash size={14} />}
              label="Usuń dokument"
              danger
              onClick={() => {
                close();
                deleteContract(c.id, c.klient_nazwa);
              }}
            />
          </>
        )}
      </ContextMenu>

      <Modal
        open={!!rejectFor}
        onClose={() => setRejectFor(null)}
        z={95}
        card="card-paper my-auto w-full max-w-md rounded-2xl border hairline p-5"
      >
        {rejectFor && (
          <OknoOdrzucenia
            tytul="Dokument nie został podpisany — dlaczego?"
            opis="Zapisze się na osi czasu klienta. To jedyne miejsce, z którego da się kiedyś odczytać, na których zapisach umowy realnie się rozchodzicie."
            powody={CONTRACT_REJECT_REASONS}
            placeholder="Własnymi słowami (opcjonalnie) — np. „nie zgodzili się na przeniesienie praw dopiero po zapłacie”."
            onCancel={() => setRejectFor(null)}
            onConfirm={(powod, komentarz) => {
              const id = rejectFor;
              setRejectFor(null);
              updateStatus(id, "Odrzucona", powod, komentarz);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function IconContractEmpty() {
  return (
    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--hairline)] text-muted">
      <IconFileText size={20} />
    </div>
  );
}
