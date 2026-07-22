"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconX, IconCheck, IconLoader2, IconExternalLink, IconMail } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import {
  type Contract,
  CONTRACT_TYP_LABEL,
  CONTRACT_CLAUSES,
  NDA_CLAUSES,
  LEGAL_PLACEHOLDER_NOTE,
} from "@/lib/contracts";
import { DOC_LANGS, DOC_LANG_LABEL } from "@/lib/documents";
import { formatMoney } from "@/lib/invoices";
import { useUI } from "../ui";
import { DateField } from "../DatePicker";
import { ClientLinkChip } from "../components";
import { PropertyMenu } from "../Menu";
import { LinkPicker } from "../LinkPicker";
import { ShareLinkControl } from "../ShareLinkControl";

export function ContractEditor({
  id,
  lang,
  onClose,
  onChange,
  onDeleted,
}: {
  id: string;
  lang: Locale;
  onClose?: () => void;
  onChange?: () => void;
  onDeleted?: (id: string) => void;
}) {
  const { toast, confirm } = useUI();
  const [contract, setContract] = useState<Contract | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const savedTimer = useRef<number | null>(null);
  const [sending, setSending] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/contracts/${id}`);
    if (!res.ok) return;
    const data = (await res.json()) as { contract: Contract };
    setContract(data.contract);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const flashSaved = useCallback(() => {
    setSaveState("saved");
    if (savedTimer.current) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaveState("idle"), 1500);
  }, []);

  const patch = useCallback(
    async (p: Partial<Contract>) => {
      setContract((prev) => (prev ? { ...prev, ...p } : prev));
      setSaveState("saving");
      const res = await fetch(`/api/contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      if (res.ok) {
        flashSaved();
        onChange?.();
      } else {
        setSaveState("idle");
        toast("Nie udało się zapisać.", "error");
      }
    },
    [id, flashSaved, onChange, toast]
  );

  const send = useCallback(async () => {
    setSending(true);
    const res = await fetch(`/api/contracts/${id}/send`, { method: "POST" });
    setSending(false);
    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as { status?: string; shareToken?: string };
      toast("Wysłano mailem.");
      // share_token dopisujemy od razu, żeby „Unieważnij link" (Moduł 40)
      // pojawił się bez przeładowania edytora.
      setContract((p) =>
        p
          ? {
              ...p,
              ...(data.status ? { status: data.status as Contract["status"] } : {}),
              share_token: data.shareToken ?? p.share_token,
            }
          : p
      );
      onChange?.();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      toast(data.error ?? "Nie udało się wysłać.", "error");
    }
  }, [id, toast, onChange]);

  const markSigned = useCallback(async () => {
    const ok = await confirm("Oznaczyć jako podpisaną (np. podpis papierowy poza panelem)?");
    if (!ok) return;
    setAccepting(true);
    const res = await fetch(`/api/contracts/${id}/accept`, { method: "POST" });
    setAccepting(false);
    if (res.ok) {
      toast("Oznaczono jako podpisaną.");
      await load();
      onChange?.();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      toast(data.error ?? "Nie udało się zapisać.", "error");
    }
  }, [id, confirm, toast, load, onChange]);

  const remove = useCallback(async () => {
    if (!contract) return;
    const ok = await confirm(`Usunąć dokument "${contract.klient_nazwa || "(bez nazwy)"}"?`, { danger: true });
    if (!ok) return;
    const res = await fetch(`/api/contracts/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast("Dokument usunięty.");
      onDeleted?.(id);
    }
  }, [contract, id, confirm, toast, onDeleted]);

  if (!contract) {
    return (
      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">Dokument</span>
          {onClose && (
            <button onClick={onClose} className="rounded-full border hairline px-2.5 py-1 text-xs text-muted">
              <IconX size={13} />
            </button>
          )}
        </div>
        <div className="mt-6 h-40 animate-pulse rounded-lg bg-[var(--hairline)]" />
      </div>
    );
  }

  const isUmowa = contract.typ === "umowa";
  const clauses = isUmowa ? CONTRACT_CLAUSES : NDA_CLAUSES;
  const signed = contract.status === "Podpisana";

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs text-muted">
          {CONTRACT_TYP_LABEL[contract.typ]} / <span className="text-[var(--fg)]">{contract.klient_nazwa || "(bez nazwy)"}</span>
          {/* Moduł 22 — powiązanie było chipem TYLKO do odczytu, a PATCH nie
              przyjmował żadnej z czterech kolumn `*_id`: umowę przypiętą do
              złego klienta dało się naprawić wyłącznie usuwając ją i tworząc
              od nowa. Chip-link zostaje obok, bo prowadzi na kartę klienta —
              picker tylko zmienia powiązanie. */}
          <LinkPicker
            kinds={["client", "lead"]}
            value={{ client_id: contract.client_id, lead_id: contract.lead_id }}
            onPick={(next) => patch(next)}
          />
          <ClientLinkChip clientId={contract.client_id} lang={lang} />
          {/* Moduł 31 — OSOBNY picker, świadomie NIE dopisany do `kinds` wyżej.
              `linkValueFor()` jest wyłączne w obrębie `kinds` (lib/links.ts:93),
              więc kinds={["client","lead","project"]} zerowałoby `client_id`
              umowy przy wyborze projektu — a na `client_id` wisi karta klienta
              i oś czasu. To dwie różne osie: klient/lead odpowiada "czyj to
              rekord", projekt "czego dotyczy". Do Modułu 31 tego pola nie było
              wcale: serwer przyjmował `project_id` (api/contracts/[id]:46), ale
              żaden ekran go nie wysyłał, więc umowa dostawała projekt WYŁĄCZNIE
              dziedzicząc go z oferty — i bramka startu projektu (api/projects/
              [id]:141) była nie do przejścia dla projektu założonego ręcznie. */}
          {isUmowa && (
            <span className="flex items-center gap-1 text-muted">
              <span className="text-[11px] uppercase tracking-wide opacity-70">Projekt</span>
              <LinkPicker
                kinds={["project"]}
                value={{ project_id: contract.project_id }}
                onPick={(next) => patch(next)}
              />
            </span>
          )}
        </span>
        <div className="flex items-center gap-3">
          <SaveIndicator state={saveState} />
          <a
            href={`/${lang}/admin/contracts/${id}/print`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-full border hairline px-2.5 py-1 text-xs text-muted hover:text-[var(--fg)]"
          >
            <IconExternalLink size={13} /> Podgląd
          </a>
          {onClose && (
            <button onClick={onClose} className="flex items-center gap-1 rounded-full border hairline px-2.5 py-1 text-xs text-muted hover:text-[var(--fg)]">
              <IconX size={13} /> Zamknij
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] leading-relaxed text-amber-500">
        ⚠ {LEGAL_PLACEHOLDER_NOTE}
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 space-y-4">
          <div className="card-paper rounded-xl border hairline p-4">
            <h2 className="mb-2 text-[13px] font-medium">Druga strona</h2>
            <input
              value={contract.klient_nazwa}
              onChange={(e) => setContract((p) => (p ? { ...p, klient_nazwa: e.target.value } : p))}
              onBlur={(e) => patch({ klient_nazwa: e.target.value })}
              placeholder="Nazwa klienta / firmy"
              className="mb-2 w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
            />
            <input
              value={contract.klient_nip}
              onChange={(e) => setContract((p) => (p ? { ...p, klient_nip: e.target.value } : p))}
              onBlur={(e) => patch({ klient_nip: e.target.value })}
              placeholder="NIP"
              className="mb-2 w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
            />
            <input
              value={contract.klient_email}
              onChange={(e) => setContract((p) => (p ? { ...p, klient_email: e.target.value } : p))}
              onBlur={(e) => patch({ klient_email: e.target.value })}
              placeholder="E-mail (do wysyłki)"
              className="mb-2 w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
            />
            <input
              value={contract.klient_ulica}
              onChange={(e) => setContract((p) => (p ? { ...p, klient_ulica: e.target.value } : p))}
              onBlur={(e) => patch({ klient_ulica: e.target.value })}
              placeholder="Ulica i numer"
              className="mb-2 w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
            />
            <div className="grid grid-cols-[100px_1fr] gap-2">
              <input
                value={contract.klient_kod}
                onChange={(e) => setContract((p) => (p ? { ...p, klient_kod: e.target.value } : p))}
                onBlur={(e) => patch({ klient_kod: e.target.value })}
                placeholder="Kod pocztowy"
                className="rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
              />
              <input
                value={contract.klient_miasto}
                onChange={(e) => setContract((p) => (p ? { ...p, klient_miasto: e.target.value } : p))}
                onBlur={(e) => patch({ klient_miasto: e.target.value })}
                placeholder="Miasto"
                className="rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
              />
            </div>
          </div>

          {isUmowa && (
            <div className="card-paper rounded-xl border hairline p-4">
              <h2 className="mb-2 text-[13px] font-medium">Przedmiot umowy (zakres prac)</h2>
              <textarea
                value={contract.zakres_prac}
                onChange={(e) => setContract((p) => (p ? { ...p, zakres_prac: e.target.value } : p))}
                onBlur={(e) => patch({ zakres_prac: e.target.value })}
                rows={5}
                placeholder="Skopiowane z pozycji zaakceptowanej oferty — dopracuj sformułowania."
                className="w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
              />
            </div>
          )}

          <div className="card-paper rounded-xl border hairline p-4">
            <h2 className="mb-2 text-[13px] font-medium">Stałe klauzule ({CONTRACT_TYP_LABEL[contract.typ]})</h2>
            <div className="space-y-3">
              {clauses.map((c) => (
                <div key={c.title}>
                  <div className="text-[11.5px] font-semibold uppercase tracking-wide text-muted">{c.title}</div>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--fg)] opacity-80">{c.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card-paper rounded-xl border hairline p-4">
            <h2 className="mb-2 text-[13px] font-medium">Uwagi</h2>
            <textarea
              value={contract.uwagi}
              onChange={(e) => setContract((p) => (p ? { ...p, uwagi: e.target.value } : p))}
              onBlur={(e) => patch({ uwagi: e.target.value })}
              rows={2}
              placeholder="Dodatkowe ustalenia."
              className="w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="card-paper rounded-xl border hairline p-4">
            <h3 className="mb-2 text-[11px] uppercase tracking-wide text-muted">Dokument</h3>
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] text-muted">Język wydruku</span>
              <PropertyMenu
                value={contract.jezyk}
                options={DOC_LANGS.map((l) => ({ value: l, label: `${l.toUpperCase()} — ${DOC_LANG_LABEL[l]}` }))}
                onChange={(v) => patch({ jezyk: v })}
                title="Język wydruku dokumentu"
                full
              >
                <span className="rounded-md px-1.5 py-1 -mx-1.5 text-[13px] text-[var(--fg)] hover:bg-[var(--hairline)]">
                  {contract.jezyk.toUpperCase()} — {DOC_LANG_LABEL[contract.jezyk]}
                </span>
              </PropertyMenu>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted opacity-70">
              Dotyczy tylko nagłówków/przycisków wydruku — treść klauzul jest dziś tylko po polsku (patrz notatka wyżej).
            </p>
          </div>

          {isUmowa && (
            <div className="card-paper rounded-xl border hairline p-4">
              <h3 className="mb-2 text-[11px] uppercase tracking-wide text-muted">Wynagrodzenie</h3>
              <div className="flex items-center gap-2 py-0.5">
                <span className="w-20 shrink-0 text-[12.5px] text-muted">Kwota</span>
                <input
                  type="number"
                  step="0.01"
                  value={contract.cena}
                  onChange={(e) => setContract((p) => (p ? { ...p, cena: Number(e.target.value) } : p))}
                  onBlur={(e) => patch({ cena: Number(e.target.value) })}
                  className="w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-right text-sm text-[var(--fg)]"
                />
              </div>
              <p className="mt-1 text-right text-[11px] text-muted">{formatMoney(contract.cena)}</p>
              <div className="mt-2 flex items-center gap-2 py-0.5">
                <span className="w-20 shrink-0 text-[12.5px] text-muted">Termin</span>
                <DateField value={contract.termin_realizacji ?? ""} onChange={(v) => patch({ termin_realizacji: v || null })} placeholder="—" />
              </div>
            </div>
          )}

          {signed ? (
            <div className="card-paper rounded-xl border hairline p-3 text-center text-[12px] text-muted">
              Podpisana
              {contract.accepted_by_name && (
                <div className="mt-1 text-[11px] text-muted">Podpisał/-a: {contract.accepted_by_name}</div>
              )}
            </div>
          ) : (
            <button
              onClick={markSigned}
              disabled={accepting}
              className="btn-primary flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {accepting ? <IconLoader2 size={15} className="animate-spin" /> : <IconCheck size={15} />}
              Oznacz jako podpisaną
            </button>
          )}

          <button
            onClick={send}
            disabled={sending || !contract.klient_email}
            title={contract.klient_email ? "Wyślij link do podpisu na e-mail" : "Uzupełnij e-mail"}
            className="flex w-full items-center justify-center gap-1.5 rounded-full border hairline px-3 py-1.5 text-xs text-muted hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? <IconLoader2 size={13} className="animate-spin" /> : <IconMail size={13} />}
            Wyślij mailem
          </button>

          <ShareLinkControl
            kind="contract"
            id={id}
            hasToken={!!contract.share_token}
            revokedAt={contract.share_revoked_at}
            etykieta={contract.typ === "nda" ? "tego NDA" : "tej umowy"}
            onChanged={(revokedAt) => setContract((p) => (p ? { ...p, share_revoked_at: revokedAt } : p))}
          />

          <button onClick={remove} className="w-full rounded-full border hairline px-3 py-1.5 text-xs text-red-400">
            Usuń dokument
          </button>
        </div>
      </div>
    </div>
  );
}

function SaveIndicator({ state }: { state: "idle" | "saving" | "saved" }) {
  return (
    <span
      className={`flex items-center gap-1.5 text-[11px] transition-opacity duration-300 ${
        state === "idle" ? "opacity-0" : "opacity-100"
      } ${state === "saved" ? "text-emerald-400" : "text-muted"}`}
    >
      {state === "saving" ? (
        <>
          <IconLoader2 size={12} className="animate-spin" /> Zapisywanie…
        </>
      ) : (
        <>
          <IconCheck size={12} /> Zapisano
        </>
      )}
    </span>
  );
}
