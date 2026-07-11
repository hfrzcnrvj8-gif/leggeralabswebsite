"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconX, IconExternalLink, IconTrash, IconCheck, IconLoader2 } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import {
  type Invoice,
  type InvoiceItem,
  type CompanySettings,
  VAT_RATES,
  INVOICE_LANGS,
  INVOICE_LANG_LABEL,
  addDaysISO,
  invoiceTotals,
  itemNetto,
  itemBrutto,
  formatMoney,
} from "@/lib/invoices";
import { useUI } from "../ui";
import { DateField } from "../DatePicker";
import { PropertyMenu } from "../Menu";

export function InvoiceEditor({
  id,
  lang,
  onClose,
  onChange,
  onDeleted,
}: {
  id: string;
  lang: Locale;
  onClose: () => void;
  onChange?: () => void;
  onDeleted?: (id: string) => void;
}) {
  const { toast, confirm } = useUI();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const savedTimer = useRef<number | null>(null);
  const [issuing, setIssuing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/invoices/${id}`);
    if (!res.ok) return;
    const data = (await res.json()) as { invoice: Invoice; items: InvoiceItem[]; settings: CompanySettings };
    setInvoice(data.invoice);
    setItems(data.items);
    setSettings(data.settings);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const flashSaved = useCallback(() => {
    setSaveState("saved");
    if (savedTimer.current) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaveState("idle"), 1500);
  }, []);

  const patchInvoice = useCallback(
    async (patch: Partial<Invoice>) => {
      setInvoice((prev) => (prev ? { ...prev, ...patch } : prev));
      setSaveState("saving");
      const res = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
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

  const addItem = useCallback(async () => {
    const res = await fetch(`/api/invoices/${id}/items`, { method: "POST" });
    if (res.ok) {
      const data = (await res.json()) as { items: InvoiceItem[] };
      setItems(data.items);
      onChange?.();
    }
  }, [id, onChange]);

  const patchItem = useCallback(
    async (itemId: string, patch: Partial<InvoiceItem>) => {
      setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, ...patch } : it)));
      setSaveState("saving");
      const res = await fetch(`/api/invoices/${id}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        flashSaved();
        onChange?.();
      } else {
        setSaveState("idle");
      }
    },
    [id, flashSaved, onChange]
  );

  const deleteItem = useCallback(
    async (itemId: string) => {
      setItems((prev) => prev.filter((it) => it.id !== itemId));
      await fetch(`/api/invoices/${id}/items/${itemId}`, { method: "DELETE" });
      onChange?.();
    },
    [id, onChange]
  );

  const issue = useCallback(async () => {
    setIssuing(true);
    const res = await fetch(`/api/invoices/${id}/issue`, { method: "POST" });
    setIssuing(false);
    if (res.ok) {
      const { numer } = (await res.json()) as { numer: string };
      toast(`Wystawiono fakturę ${numer}.`);
      await load();
      onChange?.();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      toast(data.error ?? "Nie udało się wystawić faktury.", "error");
    }
  }, [id, load, onChange, toast]);

  const remove = useCallback(async () => {
    if (!invoice) return;
    const ok = await confirm(`Usunąć fakturę ${invoice.numer ?? "(szkic)"}?`, { danger: true });
    if (!ok) return;
    const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast("Faktura usunięta.");
      onDeleted?.(id);
    }
  }, [invoice, id, confirm, toast, onDeleted]);

  if (!invoice) {
    return (
      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">Faktura</span>
          <button onClick={onClose} className="rounded-full border hairline px-2.5 py-1 text-xs text-muted">
            <IconX size={13} />
          </button>
        </div>
        <div className="mt-6 h-40 animate-pulse rounded-lg bg-[var(--hairline)]" />
      </div>
    );
  }

  const totals = invoiceTotals(items);
  const isDraft = invoice.status === "Szkic";
  const vatPayer = settings?.vat_payer ?? true;

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">
          Faktury / <span className="text-[var(--fg)]">{invoice.numer ?? "Szkic"}</span>
        </span>
        <div className="flex items-center gap-3">
          <SaveIndicator state={saveState} />
          {invoice.numer && (
            <a
              href={`/${lang}/admin/invoices/${id}/print`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-full border hairline px-2.5 py-1 text-xs text-muted hover:text-[var(--fg)]"
            >
              <IconExternalLink size={13} /> Podgląd
            </a>
          )}
          <button onClick={onClose} className="flex items-center gap-1 rounded-full border hairline px-2.5 py-1 text-xs text-muted hover:text-[var(--fg)]">
            <IconX size={13} /> Zamknij
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        {/* Główna kolumna: klient + pozycje */}
        <div className="min-w-0 space-y-4">
          <div className="card-paper rounded-xl border hairline p-4">
            <h2 className="mb-2 text-[13px] font-medium">Nabywca</h2>
            <input
              value={invoice.klient_nazwa}
              onChange={(e) => setInvoice((p) => (p ? { ...p, klient_nazwa: e.target.value } : p))}
              onBlur={(e) => patchInvoice({ klient_nazwa: e.target.value })}
              placeholder="Nazwa firmy / imię i nazwisko"
              className="mb-2 w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
            />
            <input
              value={invoice.klient_nip}
              onChange={(e) => setInvoice((p) => (p ? { ...p, klient_nip: e.target.value } : p))}
              onBlur={(e) => patchInvoice({ klient_nip: e.target.value })}
              placeholder="NIP"
              className="mb-2 w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
            />
            <input
              value={invoice.klient_ulica}
              onChange={(e) => setInvoice((p) => (p ? { ...p, klient_ulica: e.target.value } : p))}
              onBlur={(e) => patchInvoice({ klient_ulica: e.target.value })}
              placeholder="Ulica i numer"
              className="mb-2 w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
            />
            <div className="grid grid-cols-[100px_1fr] gap-2">
              <input
                value={invoice.klient_kod}
                onChange={(e) => setInvoice((p) => (p ? { ...p, klient_kod: e.target.value } : p))}
                onBlur={(e) => patchInvoice({ klient_kod: e.target.value })}
                placeholder="Kod pocztowy"
                className="rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
              />
              <input
                value={invoice.klient_miasto}
                onChange={(e) => setInvoice((p) => (p ? { ...p, klient_miasto: e.target.value } : p))}
                onBlur={(e) => patchInvoice({ klient_miasto: e.target.value })}
                placeholder="Miasto"
                className="rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
              />
            </div>
            <input
              value={invoice.klient_kraj}
              onChange={(e) => setInvoice((p) => (p ? { ...p, klient_kraj: e.target.value } : p))}
              onBlur={(e) => patchInvoice({ klient_kraj: e.target.value })}
              placeholder="Kraj (dla klientów zagranicznych)"
              className="mt-2 w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
            />
            {invoice.klient_adres && !invoice.klient_ulica && !invoice.klient_miasto && (
              <p className="mt-2 whitespace-pre-line rounded-lg bg-[var(--hairline)]/40 px-2.5 py-1.5 text-[11px] text-muted">
                Stary adres (sprzed rozbicia na pola): {invoice.klient_adres}
              </p>
            )}
          </div>

          <div className="card-paper rounded-xl border hairline p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[13px] font-medium">Pozycje</h2>
              <button onClick={addItem} className="rounded-full border hairline px-3 py-1 text-xs">
                + Pozycja
              </button>
            </div>

            {items.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted opacity-60">Brak pozycji — dodaj pierwszą.</p>
            ) : (
              <div className="space-y-1.5">
                <div className="flex gap-1.5 px-1 text-[10px] uppercase tracking-wide text-muted">
                  <span className="flex-1">Nazwa</span>
                  <span className="w-12 text-right">Ilość</span>
                  <span className="w-20 text-right">Cena netto</span>
                  <span className="w-14 text-center">VAT</span>
                  <span className="w-20 text-right">Brutto</span>
                  <span className="w-5" />
                </div>
                {items.map((it) => (
                  <div key={it.id} className="flex items-center gap-1.5">
                    <input
                      value={it.nazwa}
                      onChange={(e) => setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, nazwa: e.target.value } : x)))}
                      onBlur={(e) => patchItem(it.id, { nazwa: e.target.value })}
                      placeholder="Nazwa usługi / towaru"
                      className="min-w-0 flex-1 rounded-md border hairline bg-transparent px-2 py-1 text-[13px] text-[var(--fg)] placeholder:text-muted"
                    />
                    <input
                      type="number"
                      value={it.ilosc}
                      onChange={(e) => setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, ilosc: Number(e.target.value) } : x)))}
                      onBlur={(e) => patchItem(it.id, { ilosc: Number(e.target.value) })}
                      className="w-12 rounded-md border hairline bg-transparent px-1.5 py-1 text-right text-[13px] text-[var(--fg)]"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={it.cena_netto}
                      onChange={(e) => setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, cena_netto: Number(e.target.value) } : x)))}
                      onBlur={(e) => patchItem(it.id, { cena_netto: Number(e.target.value) })}
                      className="w-20 rounded-md border hairline bg-transparent px-1.5 py-1 text-right text-[13px] text-[var(--fg)]"
                    />
                    <div className="w-14 text-center">
                      <PropertyMenu
                        value={it.vat_stawka}
                        options={VAT_RATES.map((r) => ({ value: r, label: r === "zw" || r === "np" ? r : `${r}%` }))}
                        onChange={(v) => patchItem(it.id, { vat_stawka: v })}
                        title="Stawka VAT"
                      >
                        <span className="rounded-md border hairline px-2 py-1 text-[12px] text-[var(--fg)]">
                          {it.vat_stawka === "zw" || it.vat_stawka === "np" ? it.vat_stawka : `${it.vat_stawka}%`}
                        </span>
                      </PropertyMenu>
                    </div>
                    <span className="w-20 text-right text-[13px] tabular-nums">{formatMoney(itemBrutto(it))}</span>
                    <button onClick={() => deleteItem(it.id)} className="flex w-5 justify-center text-muted hover:text-red-400" title="Usuń pozycję">
                      <IconTrash size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Podsumowanie */}
            <div className="mt-3 flex flex-col items-end gap-0.5 border-t hairline pt-3 text-[13px]">
              <div className="flex w-48 justify-between text-muted">
                <span>Netto</span>
                <span className="tabular-nums text-[var(--fg)]">{formatMoney(totals.netto)}</span>
              </div>
              {vatPayer && (
                <div className="flex w-48 justify-between text-muted">
                  <span>VAT</span>
                  <span className="tabular-nums text-[var(--fg)]">{formatMoney(totals.vat)}</span>
                </div>
              )}
              <div className="flex w-48 justify-between font-semibold">
                <span>Do zapłaty</span>
                <span className="tabular-nums text-[var(--fg)]">{formatMoney(vatPayer ? totals.brutto : totals.netto)}</span>
              </div>
            </div>
          </div>

          <div className="card-paper rounded-xl border hairline p-4">
            <h2 className="mb-2 text-[13px] font-medium">Uwagi</h2>
            <textarea
              value={invoice.uwagi}
              onChange={(e) => setInvoice((p) => (p ? { ...p, uwagi: e.target.value } : p))}
              onBlur={(e) => patchInvoice({ uwagi: e.target.value })}
              rows={2}
              placeholder="np. Dziękuję za współpracę. Płatność przelewem."
              className="w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
            />
          </div>
        </div>

        {/* Boczny pasek: daty, status, akcje */}
        <div className="space-y-4">
          <div className="card-paper rounded-xl border hairline p-4">
            <h3 className="mb-2 text-[11px] uppercase tracking-wide text-muted">Dokument</h3>
            <Field label="Język">
              <PropertyMenu
                value={invoice.jezyk}
                options={INVOICE_LANGS.map((l) => ({ value: l, label: `${l.toUpperCase()} — ${INVOICE_LANG_LABEL[l]}` }))}
                onChange={(v) => patchInvoice({ jezyk: v })}
                title="Język wydruku faktury"
                full
              >
                <span className="text-[13px] text-[var(--fg)] hover:bg-[var(--hairline)] rounded-md px-1.5 py-1 -mx-1.5">
                  {invoice.jezyk.toUpperCase()} — {INVOICE_LANG_LABEL[invoice.jezyk]}
                </span>
              </PropertyMenu>
            </Field>
          </div>

          <div className="card-paper rounded-xl border hairline p-4">
            <h3 className="mb-2 text-[11px] uppercase tracking-wide text-muted">Daty</h3>
            <Field label="Wystawienia">
              <DateField value={invoice.data_wystawienia ?? ""} onChange={(v) => patchInvoice({ data_wystawienia: v || null })} placeholder="—" />
            </Field>
            <Field label="Sprzedaży">
              <DateField value={invoice.data_sprzedazy ?? ""} onChange={(v) => patchInvoice({ data_sprzedazy: v || null })} placeholder="—" />
            </Field>
            <Field label="Termin płat.">
              <DateField value={invoice.termin_platnosci ?? ""} onChange={(v) => patchInvoice({ termin_platnosci: v || null })} placeholder="—" />
            </Field>
            <div className="mt-1.5 flex gap-1.5 pl-[104px]">
              {[7, 14, 30].map((days) => (
                <button
                  key={days}
                  onClick={() => patchInvoice({ termin_platnosci: addDaysISO(invoice.data_wystawienia, days) })}
                  className="rounded-full border hairline px-2 py-0.5 text-[11px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]"
                  title={`Ustaw termin na ${days} dni od daty wystawienia (lub od dziś, jeśli nie ustawiono)`}
                >
                  {days} dni
                </button>
              ))}
            </div>
          </div>

          {isDraft ? (
            <button
              onClick={issue}
              disabled={issuing || items.length === 0}
              className="btn-primary flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {issuing ? <IconLoader2 size={15} className="animate-spin" /> : <IconCheck size={15} />}
              Wystaw fakturę
            </button>
          ) : (
            <div className="card-paper rounded-xl border hairline p-3 text-center text-[12px] text-muted">
              Wystawiona jako <span className="font-medium text-[var(--fg)]">{invoice.numer}</span>
            </div>
          )}

          <button onClick={remove} className="w-full rounded-full border hairline px-3 py-1.5 text-xs text-red-400">
            Usuń fakturę
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="w-24 shrink-0 text-[12.5px] text-muted">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
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
