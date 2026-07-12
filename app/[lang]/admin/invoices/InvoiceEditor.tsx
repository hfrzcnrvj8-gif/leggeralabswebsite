"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  IconX,
  IconExternalLink,
  IconTrash,
  IconCheck,
  IconLoader2,
  IconSearch,
  IconCopy,
  IconGitBranch,
  IconMail,
  IconBellRinging,
  IconArrowUpRight,
  IconLock,
  IconBuildingBank,
  IconBookmark,
  IconBookmarkPlus,
  IconUsers,
} from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import {
  type Invoice,
  type InvoiceItem,
  type InvoicePayment,
  type CompanySettings,
  type CatalogItem,
  VAT_RATES,
  INVOICE_LANGS,
  INVOICE_LANG_LABEL,
  INVOICE_CURRENCIES,
  INVOICE_TYPES,
  INVOICE_TYPE_LABEL,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  addDaysISO,
  invoiceTotals,
  itemNetto,
  itemBrutto,
  formatMoney,
  totalPaid,
  isInvoiceOverdue,
} from "@/lib/invoices";
import { KSEF_STATUS_LABEL, KSEF_STATUS_CLASS, KSEF_TRYB_LABEL } from "@/lib/ksef";
import type { Client } from "@/lib/clients";
import { formatPlDate } from "@/lib/projects";
import { useUI } from "../ui";
import { DateField } from "../DatePicker";
import { Popover, MenuRow, PropertyMenu } from "../Menu";
import { ClientLinkChip } from "../components";

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
  // Po wystawieniu faktura jest dokumentem urzędowym — nie wolno jej edytować
  // (zmiany wyłącznie przez korektę). Ref trzyma aktualny stan blokady, żeby
  // funkcje zapisu mogły odmówić edycji nawet gdyby ominąć blokadę w UI.
  const lockedRef = useRef(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const savedTimer = useRef<number | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [showOdbiorca, setShowOdbiorca] = useState(false);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [korekty, setKorekty] = useState<{ id: string; numer: string | null; data_wystawienia: string | null }[]>([]);
  const [koryguje, setKoryguje] = useState<{ id: string; numer: string | null; data_wystawienia: string | null } | null>(null);
  const [nipLoading, setNipLoading] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [sending, setSending] = useState(false);
  const [ksefSending, setKsefSending] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [converting, setConverting] = useState(false);
  const [newPaymentKwota, setNewPaymentKwota] = useState("");
  const [newPaymentData, setNewPaymentData] = useState("");
  const [zaliczkoweOptions, setZaliczkoweOptions] = useState<{ id: string; numer: string | null; klient_nazwa: string; brutto: number }[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/invoices/${id}`);
    if (!res.ok) return;
    const data = (await res.json()) as {
      invoice: Invoice;
      items: InvoiceItem[];
      settings: CompanySettings;
      payments: InvoicePayment[];
      korekty: { id: string; numer: string | null; data_wystawienia: string | null }[];
      koryguje: { id: string; numer: string | null; data_wystawienia: string | null } | null;
    };
    setInvoice(data.invoice);
    setItems(data.items);
    setSettings(data.settings);
    setShowOdbiorca(Boolean(data.invoice.odbiorca_nazwa));
    setPayments(data.payments ?? []);
    setKorekty(data.korekty ?? []);
    setKoryguje(data.koryguje ?? null);
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
      // Zablokowana faktura: przepuszczamy tylko zmianę statusu (np. anulowanie)
      // oraz e-mail nabywcy (potrzebny do wysyłki/przypomnień po wystawieniu) —
      // resztę pól dokumentu odrzucamy, bo edycja treści idzie przez korektę.
      if (lockedRef.current && !("status" in patch) && !("klient_email" in patch)) return;
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

  const addItem = useCallback(
    async (prefill?: Partial<Pick<InvoiceItem, "nazwa" | "cena_netto" | "vat_stawka" | "jednostka" | "ilosc">>) => {
      if (lockedRef.current) return;
      const res = await fetch(`/api/invoices/${id}/items`, {
        method: "POST",
        headers: prefill ? { "Content-Type": "application/json" } : {},
        body: prefill ? JSON.stringify(prefill) : undefined,
      });
      if (res.ok) {
        const data = (await res.json()) as { items: InvoiceItem[] };
        setItems(data.items);
        onChange?.();
      }
    },
    [id, onChange]
  );

  // --- Katalog usług/produktów ---
  const loadCatalog = useCallback(async () => {
    const res = await fetch("/api/catalog");
    if (res.ok) setCatalog(((await res.json()) as { items: CatalogItem[] }).items);
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const addFromCatalog = useCallback(
    (c: CatalogItem) => addItem({ nazwa: c.nazwa, cena_netto: c.cena_netto, vat_stawka: c.vat_stawka, jednostka: c.jednostka }),
    [addItem]
  );

  const saveToCatalog = useCallback(
    async (it: InvoiceItem) => {
      if (!it.nazwa.trim()) {
        toast("Pozycja bez nazwy — nie zapiszę do katalogu.", "error");
        return;
      }
      const res = await fetch("/api/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nazwa: it.nazwa, cena_netto: it.cena_netto, vat_stawka: it.vat_stawka, jednostka: it.jednostka }),
      });
      if (res.ok) {
        setCatalog(((await res.json()) as { items: CatalogItem[] }).items);
        toast(`Zapisano „${it.nazwa}" do katalogu.`);
      } else {
        toast("Nie udało się zapisać do katalogu.", "error");
      }
    },
    [toast]
  );

  const deleteFromCatalog = useCallback(async (catId: string) => {
    setCatalog((prev) => prev.filter((c) => c.id !== catId));
    await fetch(`/api/catalog/${catId}`, { method: "DELETE" });
  }, []);

  // --- Klienci z bazy (do szybkiego wypełnienia nabywcy) ---
  useEffect(() => {
    fetch("/api/clients")
      .then((r) => (r.ok ? r.json() : { clients: [] }))
      .then((d) => setClients((d.clients ?? []) as Client[]))
      .catch(() => {});
  }, []);

  const pickClient = useCallback(
    (c: Client) => {
      // Kopiujemy dane klienta na pola nabywcy faktury (to niezależna migawka —
      // późniejsza zmiana karty klienta nie rusza już wystawionej faktury) i
      // podpinamy client_id, żeby działał link „→ Karta klienta".
      const patch: Partial<Invoice> = {
        client_id: c.id,
        klient_nazwa: c.nazwa ?? "",
        klient_nip: c.nip ?? "",
        klient_ulica: c.ulica ?? "",
        klient_kod: c.kod ?? "",
        klient_miasto: c.miasto ?? "",
        klient_kraj: c.kraj ?? "",
        klient_email: c.email ?? "",
      };
      setInvoice((prev) => (prev ? { ...prev, ...patch } : prev));
      patchInvoice(patch);
    },
    [patchInvoice]
  );

  const patchItem = useCallback(
    async (itemId: string, patch: Partial<InvoiceItem>) => {
      if (lockedRef.current) return;
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
      if (lockedRef.current) return;
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
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      toast(data.error ?? "Nie udało się usunąć.", "error");
    }
  }, [invoice, id, confirm, toast, onDeleted]);

  const cancelInvoice = useCallback(async () => {
    if (!invoice) return;
    const ok = await confirm(`Anulować fakturę ${invoice.numer ?? ""}? Numer zostanie zachowany.`, { danger: true });
    if (!ok) return;
    await patchInvoice({ status: "Anulowana" });
  }, [invoice, confirm, patchInvoice]);

  const lookupNip = useCallback(async () => {
    if (!invoice?.klient_nip) {
      toast("Wpisz najpierw NIP.", "error");
      return;
    }
    setNipLoading(true);
    const res = await fetch(`/api/mf/nip/${invoice.klient_nip.replace(/\D/g, "")}`);
    setNipLoading(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      toast(data.error ?? "Nie znaleziono podmiotu o tym NIP.", "error");
      return;
    }
    const { subject } = (await res.json()) as { subject: { nazwa: string; ulica: string; kod: string; miasto: string } };
    setInvoice((p) => (p ? { ...p, klient_nazwa: subject.nazwa, klient_ulica: subject.ulica, klient_kod: subject.kod, klient_miasto: subject.miasto } : p));
    await patchInvoice({ klient_nazwa: subject.nazwa, klient_ulica: subject.ulica, klient_kod: subject.kod, klient_miasto: subject.miasto });
    toast("Uzupełniono dane z Białej Listy MF.");
  }, [invoice?.klient_nip, patchInvoice, toast]);

  const duplicateInvoice = useCallback(async () => {
    setDuplicating(true);
    const res = await fetch(`/api/invoices/${id}/duplicate`, { method: "POST" });
    setDuplicating(false);
    if (res.ok) {
      toast("Utworzono duplikat jako nowy szkic.");
      onChange?.();
    } else {
      toast("Nie udało się zduplikować faktury.", "error");
    }
  }, [id, onChange, toast]);

  const convertToInvoice = useCallback(async () => {
    setConverting(true);
    const res = await fetch(`/api/invoices/${id}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ typ_dokumentu: "faktura" }),
    });
    setConverting(false);
    if (res.ok) {
      toast("Utworzono fakturę VAT jako nowy szkic na podstawie proformy.");
      onChange?.();
    } else {
      toast("Nie udało się przekształcić proformy w fakturę.", "error");
    }
  }, [id, onChange, toast]);

  const createCorrection = useCallback(async () => {
    setCorrecting(true);
    const res = await fetch(`/api/invoices/${id}/correct`, { method: "POST" });
    setCorrecting(false);
    if (res.ok) {
      toast("Utworzono korektę jako nowy szkic — edytuj pozycje do stanu po korekcie.");
      onChange?.();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      toast(data.error ?? "Nie udało się utworzyć korekty.", "error");
    }
  }, [id, onChange, toast]);

  const sendInvoiceEmail = useCallback(async () => {
    setSending(true);
    const res = await fetch(`/api/invoices/${id}/send`, { method: "POST" });
    setSending(false);
    if (res.ok) {
      toast("Wysłano e-mail z linkiem do faktury.");
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      toast(data.error ?? "Nie udało się wysłać maila.", "error");
    }
  }, [id, toast]);

  const sendToKsef = useCallback(async () => {
    const ok = await confirm(
      "Wysłać fakturę do KSeF na środowisko TESTOWE? To bezpieczne — faktura testowa nie ma mocy prawnej i nie idzie do prawdziwego urzędu."
    );
    if (!ok) return;
    setKsefSending(true);
    const res = await fetch(`/api/invoices/${id}/ksef/send`, { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      stage?: string;
      ksefNumber?: string | null;
      statusText?: string;
      error?: string;
      validation?: { errors: string[] };
    };
    setKsefSending(false);
    if (data.ok) {
      toast(`Przyjęto w KSeF — numer ${data.ksefNumber ?? "(brak)"}.`);
    } else if (data.stage === "walidacja") {
      toast(`Faktura nie przeszła walidacji: ${(data.validation?.errors ?? []).join(" ") || "sprawdź dane."}`, "error");
    } else {
      toast(`KSeF: ${data.error || data.statusText || "nie udało się wysłać (nieznany powód)."}`, "error");
    }
    await load();
    onChange?.();
  }, [id, confirm, toast, load, onChange]);

  const sendReminder = useCallback(async () => {
    setReminding(true);
    const res = await fetch(`/api/invoices/${id}/remind`, { method: "POST" });
    setReminding(false);
    if (res.ok) {
      toast("Wysłano przypomnienie o płatności.");
      await load();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      toast(data.error ?? "Nie udało się wysłać przypomnienia.", "error");
    }
  }, [id, load, toast]);

  const addPayment = useCallback(async () => {
    const kwota = Number(newPaymentKwota);
    if (!Number.isFinite(kwota) || kwota <= 0) {
      toast("Podaj poprawną kwotę wpłaty.", "error");
      return;
    }
    const res = await fetch(`/api/invoices/${id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kwota, data: newPaymentData || undefined }),
    });
    if (res.ok) {
      const data = (await res.json()) as { payments: InvoicePayment[]; status: Invoice["status"] };
      setPayments(data.payments);
      setNewPaymentKwota("");
      setNewPaymentData("");
      setInvoice((prev) => (prev && prev.status !== data.status ? { ...prev, status: data.status } : prev));
      toast(data.status === "Opłacona" ? "Zarejestrowano wpłatę — faktura oznaczona jako opłacona." : "Zarejestrowano wpłatę.");
      onChange?.();
    } else {
      toast("Nie udało się zapisać wpłaty.", "error");
    }
  }, [id, newPaymentKwota, newPaymentData, toast, onChange]);

  const deletePayment = useCallback(
    async (paymentId: string) => {
      setPayments((prev) => prev.filter((p) => p.id !== paymentId));
      await fetch(`/api/invoices/${id}/payments/${paymentId}`, { method: "DELETE" });
    },
    [id]
  );

  const loadZaliczkowe = useCallback(async () => {
    const res = await fetch("/api/invoices");
    if (!res.ok) return;
    const data = (await res.json()) as { invoices: (Invoice & { brutto: number })[] };
    const used = new Set(data.invoices.map((i) => i.rozlicza_zaliczke_id).filter(Boolean));
    setZaliczkoweOptions(
      data.invoices
        .filter((i) => i.typ_dokumentu === "zaliczkowa" && i.status !== "Szkic" && i.id !== id && !used.has(i.id))
        .map((i) => ({ id: i.id, numer: i.numer, klient_nazwa: i.klient_nazwa, brutto: i.brutto }))
    );
  }, [id]);

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
  // Blokada edycji wystawionego dokumentu. `lockCls` wygasza i wyłącza
  // kliknięcia w sekcjach z danymi faktury; e-mail nabywcy i akcje (płatności,
  // wysyłka, korekta, anulowanie) zostają aktywne poza tą blokadą.
  const locked = !isDraft;
  lockedRef.current = locked;
  const lockCls = locked ? "pointer-events-none opacity-60" : "";
  const vatPayer = settings?.vat_payer ?? true;
  const dueAmount = vatPayer ? totals.brutto : totals.netto;
  const paid = totalPaid(payments);
  const overdue = isInvoiceOverdue(invoice);

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs text-muted">
          Faktury / <span className="text-[var(--fg)]">{invoice.numer ?? "Szkic"}</span>
          <ClientLinkChip clientId={invoice.client_id} lang={lang} />
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

      {locked && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border hairline bg-[var(--hairline)]/40 px-3 py-2 text-[12px] text-muted">
          <IconLock size={14} className="shrink-0" />
          <span>
            Faktura wystawiona (<span className="font-medium text-[var(--fg)]">{invoice.numer}</span>) — dane są zablokowane, żeby nie zmienić dokumentu przez pomyłkę.
            Aby coś poprawić, użyj <span className="font-medium text-[var(--fg)]">„Wystaw korektę"</span>.
          </span>
        </div>
      )}

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        {/* Główna kolumna: klient + pozycje */}
        <div className="min-w-0 space-y-4">
          <div className="card-paper rounded-xl border hairline p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-[13px] font-medium">Nabywca</h2>
              {!locked && clients.length > 0 && (
                <Popover
                  width={320}
                  trigger={(open) => (
                    <button
                      onClick={open}
                      className="flex items-center gap-1 rounded-full border hairline px-2.5 py-1 text-[11px] text-muted hover:text-[var(--fg)]"
                      title="Wypełnij danymi zapisanego klienta z bazy"
                    >
                      <IconUsers size={12} /> Z bazy klientów
                    </button>
                  )}
                >
                  {(close) => (
                    <ClientPicker
                      clients={clients}
                      onPick={(c) => {
                        pickClient(c);
                        close();
                      }}
                    />
                  )}
                </Popover>
              )}
            </div>
            <div className={lockCls}>
            <input
              value={invoice.klient_nazwa}
              onChange={(e) => setInvoice((p) => (p ? { ...p, klient_nazwa: e.target.value } : p))}
              onBlur={(e) => patchInvoice({ klient_nazwa: e.target.value })}
              placeholder="Nazwa firmy / imię i nazwisko"
              className="mb-2 w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
            />
            <div className="mb-2 flex gap-1.5">
              <input
                value={invoice.klient_nip}
                onChange={(e) => setInvoice((p) => (p ? { ...p, klient_nip: e.target.value } : p))}
                onBlur={(e) => patchInvoice({ klient_nip: e.target.value })}
                placeholder="NIP"
                className="min-w-0 flex-1 rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
              />
              <button
                onClick={lookupNip}
                disabled={nipLoading}
                title="Uzupełnij nazwę i adres z Białej Listy MF po NIP"
                className="flex shrink-0 items-center gap-1 rounded-lg border hairline px-2.5 text-xs text-muted hover:text-[var(--fg)] disabled:opacity-50"
              >
                {nipLoading ? <IconLoader2 size={13} className="animate-spin" /> : <IconSearch size={13} />}
                Szukaj po NIP
              </button>
            </div>
            </div>
            <input
              value={invoice.klient_email}
              onChange={(e) => setInvoice((p) => (p ? { ...p, klient_email: e.target.value } : p))}
              onBlur={(e) => patchInvoice({ klient_email: e.target.value })}
              placeholder="E-mail nabywcy (do wysyłki faktury / przypomnień)"
              className="mb-2 w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
            />
            <div className={lockCls}>
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
          </div>

          <div className={`card-paper rounded-xl border hairline p-4 ${lockCls}`}>
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span>
                <span className="block text-[13px] font-medium">Inny odbiorca niż nabywca</span>
                <span className="block text-[11px] text-muted">Np. faktura na centralę, towar/usługa fizycznie dla oddziału.</span>
              </span>
              <input
                type="checkbox"
                checked={showOdbiorca}
                onChange={(e) => {
                  setShowOdbiorca(e.target.checked);
                  if (!e.target.checked) {
                    patchInvoice({ odbiorca_nazwa: "", odbiorca_ulica: "", odbiorca_kod: "", odbiorca_miasto: "", odbiorca_kraj: "" });
                  }
                }}
                className="h-4 w-4 cursor-pointer accent-[#7C3AED]"
              />
            </label>

            {showOdbiorca && (
              <div className="mt-3 border-t hairline pt-3">
                <input
                  value={invoice.odbiorca_nazwa}
                  onChange={(e) => setInvoice((p) => (p ? { ...p, odbiorca_nazwa: e.target.value } : p))}
                  onBlur={(e) => patchInvoice({ odbiorca_nazwa: e.target.value })}
                  placeholder="Nazwa odbiorcy"
                  className="mb-2 w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
                />
                <input
                  value={invoice.odbiorca_ulica}
                  onChange={(e) => setInvoice((p) => (p ? { ...p, odbiorca_ulica: e.target.value } : p))}
                  onBlur={(e) => patchInvoice({ odbiorca_ulica: e.target.value })}
                  placeholder="Ulica i numer"
                  className="mb-2 w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
                />
                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <input
                    value={invoice.odbiorca_kod}
                    onChange={(e) => setInvoice((p) => (p ? { ...p, odbiorca_kod: e.target.value } : p))}
                    onBlur={(e) => patchInvoice({ odbiorca_kod: e.target.value })}
                    placeholder="Kod pocztowy"
                    className="rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
                  />
                  <input
                    value={invoice.odbiorca_miasto}
                    onChange={(e) => setInvoice((p) => (p ? { ...p, odbiorca_miasto: e.target.value } : p))}
                    onBlur={(e) => patchInvoice({ odbiorca_miasto: e.target.value })}
                    placeholder="Miasto"
                    className="rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
                  />
                </div>
                <input
                  value={invoice.odbiorca_kraj}
                  onChange={(e) => setInvoice((p) => (p ? { ...p, odbiorca_kraj: e.target.value } : p))}
                  onBlur={(e) => patchInvoice({ odbiorca_kraj: e.target.value })}
                  placeholder="Kraj"
                  className="mt-2 w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
                />
              </div>
            )}
          </div>

          <div className={`card-paper rounded-xl border hairline p-4 ${lockCls}`}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[13px] font-medium">Pozycje</h2>
              <div className="flex items-center gap-1.5">
                <Popover
                  width={320}
                  trigger={(open) => (
                    <button
                      onClick={open}
                      className="flex items-center gap-1 rounded-full border hairline px-3 py-1 text-xs text-muted hover:text-[var(--fg)]"
                      title="Wstaw zapisaną pozycję z katalogu"
                    >
                      <IconBookmark size={13} /> Z katalogu
                    </button>
                  )}
                >
                  {(close) => (
                    <CatalogPicker
                      catalog={catalog}
                      onPick={(c) => {
                        addFromCatalog(c);
                        close();
                      }}
                      onDelete={deleteFromCatalog}
                    />
                  )}
                </Popover>
                <button onClick={() => addItem()} className="rounded-full border hairline px-3 py-1 text-xs">
                  + Pozycja
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted opacity-60">Brak pozycji — dodaj pierwszą.</p>
            ) : (
              <div className="space-y-1.5">
                <div className="flex gap-1.5 px-1 text-[10px] uppercase tracking-wide text-muted">
                  <span className="flex-1">Nazwa</span>
                  <span className="w-14 text-right">Ilość</span>
                  <span className="w-16 text-center">Jedn.</span>
                  <span className="w-24 text-right">Cena netto</span>
                  <span className="w-16 text-center">VAT</span>
                  <span className="w-24 text-right">Brutto</span>
                  <span className="w-11" />
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
                      className="w-14 rounded-md border hairline bg-transparent px-1.5 py-1 text-right text-[13px] text-[var(--fg)]"
                    />
                    <input
                      value={it.jednostka}
                      onChange={(e) => setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, jednostka: e.target.value } : x)))}
                      onBlur={(e) => patchItem(it.id, { jednostka: e.target.value })}
                      placeholder="szt."
                      className="w-16 rounded-md border hairline bg-transparent px-1.5 py-1 text-center text-[13px] text-[var(--fg)] placeholder:text-muted"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={it.cena_netto}
                      onChange={(e) => setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, cena_netto: Number(e.target.value) } : x)))}
                      onBlur={(e) => patchItem(it.id, { cena_netto: Number(e.target.value) })}
                      className="w-24 rounded-md border hairline bg-transparent px-1.5 py-1 text-right text-[13px] text-[var(--fg)]"
                    />
                    <div className="w-16 text-center">
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
                    <span className="w-24 text-right text-[13px] tabular-nums">{formatMoney(itemBrutto(it))}</span>
                    <div className="flex w-11 justify-end gap-1">
                      <button onClick={() => saveToCatalog(it)} className="flex text-muted hover:text-brand-purple" title="Zapisz tę pozycję do katalogu">
                        <IconBookmarkPlus size={13} />
                      </button>
                      <button onClick={() => deleteItem(it.id)} className="flex text-muted hover:text-red-400" title="Usuń pozycję">
                        <IconTrash size={13} />
                      </button>
                    </div>
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

          <div className={`card-paper rounded-xl border hairline p-4 ${lockCls}`}>
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
          <div className={`card-paper rounded-xl border hairline p-4 ${lockCls}`}>
            <h3 className="mb-2 text-[11px] uppercase tracking-wide text-muted">Dokument</h3>
            {koryguje ? (
              <p className="mb-2 rounded-lg bg-[var(--hairline)]/40 px-2.5 py-1.5 text-[11.5px] text-muted">
                Korekta faktury <span className="font-medium text-[var(--fg)]">{koryguje.numer ?? "…"}</span>
              </p>
            ) : (
              <Field label="Typ">
                <PropertyMenu
                  value={invoice.typ_dokumentu}
                  options={INVOICE_TYPES.map((t) => ({ value: t, label: INVOICE_TYPE_LABEL[t] }))}
                  onChange={(v) => patchInvoice({ typ_dokumentu: v })}
                  title="Typ dokumentu"
                  full
                >
                  <span className="text-[13px] text-[var(--fg)] hover:bg-[var(--hairline)] rounded-md px-1.5 py-1 -mx-1.5">
                    {INVOICE_TYPE_LABEL[invoice.typ_dokumentu]}
                  </span>
                </PropertyMenu>
              </Field>
            )}
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
            <Field label="Waluta">
              <PropertyMenu
                value={invoice.waluta || "PLN"}
                options={INVOICE_CURRENCIES.map((c) => ({ value: c, label: c }))}
                onChange={(v) => patchInvoice({ waluta: v })}
                title="Waluta faktury"
                full
              >
                <span className="text-[13px] text-[var(--fg)] hover:bg-[var(--hairline)] rounded-md px-1.5 py-1 -mx-1.5">
                  {invoice.waluta || "PLN"}
                </span>
              </PropertyMenu>
            </Field>
            <Field label="Zapłata">
              <PropertyMenu
                value={invoice.sposob_platnosci || "przelew"}
                options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))}
                onChange={(v) => patchInvoice({ sposob_platnosci: v as Invoice["sposob_platnosci"] })}
                title="Sposób zapłaty"
                full
              >
                <span className="text-[13px] text-[var(--fg)] hover:bg-[var(--hairline)] rounded-md px-1.5 py-1 -mx-1.5">
                  {PAYMENT_METHOD_LABEL[invoice.sposob_platnosci || "przelew"]}
                </span>
              </PropertyMenu>
            </Field>

            {koryguje && (
              <div className="mt-2">
                <textarea
                  value={invoice.przyczyna_korekty}
                  onChange={(e) => setInvoice((p) => (p ? { ...p, przyczyna_korekty: e.target.value } : p))}
                  onBlur={(e) => patchInvoice({ przyczyna_korekty: e.target.value })}
                  rows={2}
                  placeholder="Przyczyna korekty"
                  className="w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
                />
              </div>
            )}

            {invoice.typ_dokumentu === "faktura" && !koryguje && (
              <div className="mt-2">
                <Popover
                  width={260}
                  trigger={(open) => (
                    <button
                      onClick={(e) => {
                        loadZaliczkowe();
                        open(e);
                      }}
                      className="w-full rounded-lg border hairline px-2.5 py-1.5 text-left text-[12.5px] text-muted hover:text-[var(--fg)]"
                    >
                      {invoice.rozlicza_zaliczke_id ? `Rozlicza zaliczkę ✓` : "Rozlicza zaliczkę (opcjonalnie)"}
                    </button>
                  )}
                >
                  {(close) => (
                    <div>
                      {invoice.rozlicza_zaliczke_id && (
                        <MenuRow
                          label="— nie rozlicza żadnej —"
                          onClick={() => {
                            close();
                            patchInvoice({ rozlicza_zaliczke_id: null });
                          }}
                        />
                      )}
                      {zaliczkoweOptions == null ? (
                        <div className="px-2.5 py-1.5 text-[12px] text-muted">Wczytywanie…</div>
                      ) : zaliczkoweOptions.length === 0 ? (
                        <div className="px-2.5 py-1.5 text-[12px] text-muted">Brak nierozliczonych faktur zaliczkowych.</div>
                      ) : (
                        zaliczkoweOptions.map((z) => (
                          <MenuRow
                            key={z.id}
                            label={`${z.numer ?? "—"} — ${z.klient_nazwa} (${formatMoney(z.brutto)})`}
                            selected={invoice.rozlicza_zaliczke_id === z.id}
                            onClick={() => {
                              close();
                              patchInvoice({ rozlicza_zaliczke_id: z.id });
                            }}
                          />
                        ))
                      )}
                    </div>
                  )}
                </Popover>
              </div>
            )}
          </div>

          <div className={`card-paper rounded-xl border hairline p-4 ${lockCls}`}>
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
              {overdue && <span className="ml-1.5 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-400">po terminie</span>}
            </div>
          )}

          {!isDraft && (
            <div className="card-paper rounded-xl border hairline p-4">
              <h3 className="mb-2 text-[11px] uppercase tracking-wide text-muted">Płatności</h3>
              {payments.length > 0 && (
                <div className="mb-2 space-y-1">
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-[12.5px]">
                      <span className="text-muted">{formatPlDate(p.data)}</span>
                      <span className="tabular-nums">{formatMoney(p.kwota, invoice.waluta || "PLN")}</span>
                      <button onClick={() => deletePayment(p.id)} className="text-muted hover:text-red-400">
                        <IconX size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="mb-2 flex justify-between text-[12.5px] font-medium">
                <span>Zapłacono {formatMoney(paid, invoice.waluta || "PLN")}</span>
                <span className={paid >= dueAmount ? "text-emerald-400" : "text-muted"}>
                  pozostało {formatMoney(Math.max(0, dueAmount - paid), invoice.waluta || "PLN")}
                </span>
              </div>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  step="0.01"
                  value={newPaymentKwota}
                  onChange={(e) => setNewPaymentKwota(e.target.value)}
                  placeholder="Kwota"
                  className="min-w-0 flex-1 rounded-lg border hairline bg-transparent px-2 py-1 text-[12.5px] text-[var(--fg)] placeholder:text-muted"
                />
                <DateField value={newPaymentData} onChange={setNewPaymentData} placeholder="dziś" />
                <button onClick={addPayment} className="shrink-0 rounded-lg border hairline px-2.5 text-xs text-muted hover:text-[var(--fg)]">
                  + Wpłata
                </button>
              </div>
            </div>
          )}

          {!isDraft && invoice.typ_dokumentu === "faktura" && !koryguje && (
            <div className="card-paper rounded-xl border hairline p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[11px] uppercase tracking-wide text-muted">KSeF</h3>
                <span className="rounded-full bg-brand-gold/15 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-brand-gold">
                  Środowisko testowe
                </span>
              </div>
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${KSEF_STATUS_CLASS[invoice.ksef_status]}`}>
                  {KSEF_STATUS_LABEL[invoice.ksef_status]}
                </span>
                {invoice.ksef_tryb && (
                  <span className="rounded-full bg-[var(--hairline)] px-2 py-0.5 text-[11px] text-muted">
                    {KSEF_TRYB_LABEL[invoice.ksef_tryb]}
                  </span>
                )}
              </div>
              {invoice.ksef_numer && (
                <p className="mb-2 break-all text-[12px] text-muted">
                  Numer KSeF: <span className="font-medium text-[var(--fg)]">{invoice.ksef_numer}</span>
                </p>
              )}
              {invoice.ksef_blad && (
                <p className="mb-2 rounded-lg bg-red-500/10 px-2 py-1 text-[11.5px] text-red-400">{invoice.ksef_blad}</p>
              )}
              <button
                onClick={sendToKsef}
                disabled={ksefSending || invoice.ksef_status === "przyjeto"}
                className="flex w-full items-center justify-center gap-1.5 rounded-full border hairline px-3 py-1.5 text-xs text-muted hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {ksefSending ? <IconLoader2 size={13} className="animate-spin" /> : <IconBuildingBank size={13} />}
                {invoice.ksef_status === "przyjeto"
                  ? "Wysłano do KSeF ✓"
                  : invoice.ksef_status === "nie_wyslano"
                    ? "Wyślij do KSeF (test)"
                    : "Wyślij ponownie do KSeF"}
              </button>
            </div>
          )}

          {korekty.length > 0 && (
            <div className="card-paper rounded-xl border hairline p-4">
              <h3 className="mb-2 text-[11px] uppercase tracking-wide text-muted">Korekty</h3>
              {korekty.map((k) => (
                <div key={k.id} className="text-[12.5px] text-muted">
                  {k.numer ?? "(szkic)"}
                </div>
              ))}
            </div>
          )}

          {!isDraft && (
            <div className="space-y-1.5">
              <button
                onClick={sendInvoiceEmail}
                disabled={sending || !invoice.klient_email}
                title={invoice.klient_email ? "Wyślij link do faktury na e-mail nabywcy" : "Uzupełnij e-mail nabywcy"}
                className="flex w-full items-center justify-center gap-1.5 rounded-full border hairline px-3 py-1.5 text-xs text-muted hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? <IconLoader2 size={13} className="animate-spin" /> : <IconMail size={13} />}
                Wyślij mailem
              </button>
              {overdue && (
                <button
                  onClick={sendReminder}
                  disabled={reminding || !invoice.klient_email}
                  className="flex w-full items-center justify-center gap-1.5 rounded-full border hairline px-3 py-1.5 text-xs text-orange-400 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {reminding ? <IconLoader2 size={13} className="animate-spin" /> : <IconBellRinging size={13} />}
                  Wyślij przypomnienie
                </button>
              )}
              {!koryguje && (
                <button
                  onClick={createCorrection}
                  disabled={correcting}
                  className="flex w-full items-center justify-center gap-1.5 rounded-full border hairline px-3 py-1.5 text-xs text-muted hover:text-[var(--fg)] disabled:opacity-50"
                >
                  {correcting ? <IconLoader2 size={13} className="animate-spin" /> : <IconGitBranch size={13} />}
                  Wystaw korektę
                </button>
              )}
              {invoice.typ_dokumentu === "proforma" && (
                <button
                  onClick={convertToInvoice}
                  disabled={converting}
                  title="Utwórz prawdziwą fakturę VAT jako nowy szkic na podstawie tej proformy"
                  className="flex w-full items-center justify-center gap-1.5 rounded-full border hairline px-3 py-1.5 text-xs text-muted hover:text-[var(--fg)] disabled:opacity-50"
                >
                  {converting ? <IconLoader2 size={13} className="animate-spin" /> : <IconArrowUpRight size={13} />}
                  Przekształć w fakturę VAT
                </button>
              )}
            </div>
          )}

          <button
            onClick={duplicateInvoice}
            disabled={duplicating}
            className="flex w-full items-center justify-center gap-1.5 rounded-full border hairline px-3 py-1.5 text-xs text-muted hover:text-[var(--fg)] disabled:opacity-50"
          >
            {duplicating ? <IconLoader2 size={13} className="animate-spin" /> : <IconCopy size={13} />}
            Duplikuj fakturę
          </button>

          {isDraft ? (
            <button onClick={remove} className="w-full rounded-full border hairline px-3 py-1.5 text-xs text-red-400">
              Usuń fakturę
            </button>
          ) : (
            invoice.status !== "Anulowana" && (
              <button onClick={cancelInvoice} className="w-full rounded-full border hairline px-3 py-1.5 text-xs text-red-400">
                Anuluj fakturę
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function ClientPicker({ clients, onPick }: { clients: Client[]; onPick: (c: Client) => void }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? clients.filter((c) => `${c.nazwa} ${c.nip} ${c.miasto}`.toLowerCase().includes(needle))
    : clients;
  return (
    <div className="max-h-72 overflow-y-auto">
      <div className="p-1.5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Szukaj klienta (nazwa / NIP / miasto)…"
          autoFocus
          className="w-full rounded-md border hairline bg-transparent px-2 py-1 text-[12.5px] text-[var(--fg)] placeholder:text-muted"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="px-3 py-3 text-center text-[12px] text-muted">Brak dopasowań.</p>
      ) : (
        filtered.map((c) => (
          <button
            key={c.id}
            onClick={() => onPick(c)}
            className="flex w-full flex-col px-2.5 py-1.5 text-left hover:bg-[var(--hairline)]"
          >
            <span className="truncate text-[13px] text-[var(--fg)]">{c.nazwa || "(bez nazwy)"}</span>
            <span className="truncate text-[11px] text-muted">
              {[c.nip && `NIP ${c.nip}`, [c.kod, c.miasto].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}
            </span>
          </button>
        ))
      )}
    </div>
  );
}

function CatalogPicker({
  catalog,
  onPick,
  onDelete,
}: {
  catalog: CatalogItem[];
  onPick: (c: CatalogItem) => void;
  onDelete: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const filtered = needle ? catalog.filter((c) => c.nazwa.toLowerCase().includes(needle)) : catalog;
  return (
    <div className="max-h-72 overflow-y-auto">
      {catalog.length > 0 && (
        <div className="p-1.5">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Szukaj w katalogu…"
            autoFocus
            className="w-full rounded-md border hairline bg-transparent px-2 py-1 text-[12.5px] text-[var(--fg)] placeholder:text-muted"
          />
        </div>
      )}
      {catalog.length === 0 ? (
        <p className="px-3 py-4 text-center text-[12px] text-muted">
          Katalog jest pusty. Zapisz pozycję ikoną zakładki <IconBookmarkPlus size={12} className="inline" /> obok wiersza faktury, żeby móc ją stąd szybko wstawiać.
        </p>
      ) : filtered.length === 0 ? (
        <p className="px-3 py-3 text-center text-[12px] text-muted">Brak dopasowań.</p>
      ) : (
        filtered.map((c) => (
          <div key={c.id} className="group flex items-center gap-2 px-2.5 py-1.5 hover:bg-[var(--hairline)]">
            <button onClick={() => onPick(c)} className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[13px] text-[var(--fg)]">{c.nazwa}</span>
              <span className="block text-[11px] text-muted">
                {formatMoney(c.cena_netto)} / {c.jednostka} · VAT {c.vat_stawka === "zw" || c.vat_stawka === "np" ? c.vat_stawka : `${c.vat_stawka}%`}
              </span>
            </button>
            <button
              onClick={() => onDelete(c.id)}
              className="shrink-0 text-muted opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
              title="Usuń z katalogu"
            >
              <IconTrash size={13} />
            </button>
          </div>
        ))
      )}
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
