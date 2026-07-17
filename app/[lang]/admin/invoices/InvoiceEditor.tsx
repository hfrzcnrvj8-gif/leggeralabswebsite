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
} from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import {
  type Invoice,
  type InvoiceItem,
  type InvoicePayment,
  type InvoiceReminder,
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
  INVOICE_STATUS_CLASS,
  totalPaid,
  isInvoiceOverdue,
  itemDiscountAmount,
  unitBrutto,
  nettoFromUnitBrutto,
  daysOverdue,
  reminderLevelForDays,
  REMINDER_LEVEL_LABEL,
} from "@/lib/invoices";
import { KSEF_STATUS_LABEL, KSEF_STATUS_CLASS, KSEF_TRYB_LABEL, KOREKTA_TYPY, KOREKTA_TYP_LABEL } from "@/lib/ksef";
import type { Client } from "@/lib/clients";
import { lookupClientByNip } from "@/lib/vies";
import { formatPlDate } from "@/lib/projects";
import { useUI } from "../ui";
import { DateField } from "../DatePicker";
import { Popover, MenuRow, PropertyMenu } from "../Menu";
import { ClientLinkChip, ClientLinkPicker, LinkHint } from "../components";
import { invalidateLinkTargets } from "../LinkPicker";
import { UNLINKED_CLIENT_HINT, clientLinkStatus, clientMismatchHint } from "@/lib/links";

export function InvoiceEditor({
  id,
  lang,
  onClose,
  onChange,
  onDeleted,
  onOpenInvoice,
}: {
  id: string;
  lang: Locale;
  onClose: () => void;
  onChange?: () => void;
  onDeleted?: (id: string) => void;
  /** Przeskok do powiązanej faktury (oryginał ↔ korekta) bez zamykania modalu. */
  onOpenInvoice?: (id: string) => void;
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
  const [reminders, setReminders] = useState<InvoiceReminder[]>([]);
  const [korekty, setKorekty] = useState<{ id: string; numer: string | null; data_wystawienia: string | null; status?: string }[]>([]);
  const [koryguje, setKoryguje] = useState<{ id: string; numer: string | null; data_wystawienia: string | null; brutto?: number; status?: string } | null>(null);
  // Zaliczka rozliczana TĄ fakturą (gdy invoice.rozlicza_zaliczke_id ustawione,
  // czyli ta faktura jest ROZLICZENIOWA/ROZ) — do wyliczenia kwoty pozostałej
  // do zapłaty (patrz dueAmount niżej) i pokazania jej właścicielowi.
  const [zaliczka, setZaliczka] = useState<{
    id: string;
    numer: string | null;
    status?: string;
    ksef_status?: string;
    ksef_numer?: string | null;
    brutto: number;
  } | null>(null);
  const [nipLoading, setNipLoading] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [sending, setSending] = useState(false);
  const [ksefSending, setKsefSending] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [converting, setConverting] = useState(false);
  const [newPaymentKwota, setNewPaymentKwota] = useState("");
  const [newPaymentData, setNewPaymentData] = useState("");
  // Gdy faktura ma włączone `ceny_brutto`, pole ceny w wierszu pokazuje/
  // przyjmuje kwotę brutto — surowy tekst trzymamy tu do czasu onBlur (blur
  // przelicza na netto i wywołuje patchItem), żeby nie "skakać" po zaokrągleniu
  // przy każdym znaku wpisywanym w polu.
  const [bruttoDrafts, setBruttoDrafts] = useState<Record<string, string>>({});
  const [paidNow, setPaidNow] = useState(false);
  const [zaliczkoweOptions, setZaliczkoweOptions] = useState<{ id: string; numer: string | null; klient_nazwa: string; brutto: number }[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/invoices/${id}`);
    if (!res.ok) return;
    const data = (await res.json()) as {
      invoice: Invoice;
      items: InvoiceItem[];
      settings: CompanySettings;
      payments: InvoicePayment[];
      reminders: InvoiceReminder[];
      korekty: { id: string; numer: string | null; data_wystawienia: string | null; status?: string }[];
      koryguje: { id: string; numer: string | null; data_wystawienia: string | null; brutto?: number; status?: string } | null;
      zaliczka: { id: string; numer: string | null; status?: string; ksef_status?: string; ksef_numer?: string | null; brutto: number } | null;
    };
    setInvoice(data.invoice);
    setItems(data.items);
    setSettings(data.settings);
    setShowOdbiorca(Boolean(data.invoice.odbiorca_nazwa));
    setPayments(data.payments ?? []);
    setReminders(data.reminders ?? []);
    setKorekty(data.korekty ?? []);
    setKoryguje(data.koryguje ?? null);
    setZaliczka(data.zaliczka ?? null);
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
    (c: Client | null) => {
      // Kopiujemy dane klienta na pola nabywcy faktury (to niezależna migawka —
      // późniejsza zmiana karty klienta nie rusza już wystawionej faktury) i
      // podpinamy client_id, żeby działał link „→ Karta klienta".
      // „— brak powiązania —" zdejmuje TYLKO client_id: raz wpisanych danych
      // nabywcy nie kasujemy, bo to treść dokumentu, nie powiązanie.
      if (!c) {
        setInvoice((prev) => (prev ? { ...prev, client_id: null } : prev));
        patchInvoice({ client_id: null });
        return;
      }
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

  /** „Załóż klienta z danych nabywcy" — droga wyjścia, gdy nabywcy nie ma
   * jeszcze w bazie (na świeżym panelu: nie ma nikogo). Zakłada klienta z
   * tego, co już wpisane w dokumencie, i od razu go podpina. */
  const createClientFromBuyer = useCallback(async () => {
    const src = invoice;
    if (!src) return;
    const nazwa = (src.klient_nazwa ?? "").trim();
    if (!nazwa) {
      toast("Najpierw wpisz nazwę nabywcy — z pustych danych nie ma czego zakładać.", "error");
      return;
    }
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nazwa,
        nip: src.klient_nip ?? "",
        ulica: src.klient_ulica ?? "",
        kod: src.klient_kod ?? "",
        miasto: src.klient_miasto ?? "",
        kraj: src.klient_kraj ?? "",
        email: src.klient_email ?? "",
      }),
    });
    if (!res.ok) {
      toast("Nie udało się założyć klienta.", "error");
      return;
    }
    const { id: newClientId } = (await res.json()) as { id: string };
    const created = (await fetch("/api/clients").then((r) => (r.ok ? r.json() : { clients: [] }))) as {
      clients: Client[];
    };
    setClients(created.clients ?? []);
    invalidateLinkTargets("client"); // wspólny cache LinkPickera na innych ekranach
    setInvoice((prev) => (prev ? { ...prev, client_id: newClientId } : prev));
    patchInvoice({ client_id: newClientId });
    toast(`Założono klienta „${nazwa}" i podpięto do faktury.`);
  }, [invoice, patchInvoice, toast]);

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
    if (res.ok) {
      const { numer } = (await res.json()) as { numer: string };
      // "Zapłacono od razu" — sprzedaż gotówkowa: jeden klik zamiast osobnego
      // wejścia do sekcji Płatności po wystawieniu, żeby dopisać tę samą kwotę.
      if (paidNow) {
        const kwota = (settings?.vat_payer ?? true) ? invoiceTotals(items).brutto : invoiceTotals(items).netto;
        if (kwota > 0) {
          await fetch(`/api/invoices/${id}/payments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kwota }),
          });
        }
      }
      setIssuing(false);
      toast(`Wystawiono fakturę ${numer}${paidNow ? " — oznaczona jako opłacona." : "."}`);
      await load();
      onChange?.();
    } else {
      setIssuing(false);
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      toast(data.error ?? "Nie udało się wystawić faktury.", "error");
    }
  }, [id, load, onChange, toast, paidNow, items, settings]);

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
    setNipLoading(true);
    const r = await lookupClientByNip(invoice?.klient_nip ?? "");
    setNipLoading(false);
    if (!r.ok) {
      toast(r.message, "error");
      return;
    }
    setInvoice((p) => (p ? { ...p, ...r.fields } : p));
    await patchInvoice(r.fields);
    toast(r.message);
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
      const data = (await res.json().catch(() => ({}))) as { level?: number };
      toast(data.level === 3 ? "Wysłano formalne wezwanie do zapłaty." : `Wysłano przypomnienie (${REMINDER_LEVEL_LABEL[data.level ?? 1]?.toLowerCase() ?? "poziom " + data.level}).`);
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
        .filter(
          (i) => i.typ_dokumentu === "zaliczkowa" && i.status !== "Szkic" && i.status !== "Anulowana" && i.id !== id && !used.has(i.id)
        )
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
  // Faktura ROZLICZENIOWA (rozlicza_zaliczke_id ustawione): klient już
  // zapłacił zaliczkę osobno (przy wysyłce zaliczkowej) — kwota do zebrania
  // TĄ fakturą to pełna wartość MINUS już rozliczona zaliczka (FA(3) P_15,
  // patrz lib/ksef.ts). Bez tego faktura nigdy nie domknęłaby się wpłatami.
  const zaliczkaBrutto = invoice.rozlicza_zaliczke_id && zaliczka ? zaliczka.brutto : 0;
  const dueAmount = Math.max(0, (vatPayer ? totals.brutto : totals.netto) - zaliczkaBrutto);
  const paid = totalPaid(payments);
  const overdue = isInvoiceOverdue(invoice);

  // Moduł 30 — miękka podpowiedź o powiązaniu. Liczona z tego samego stanu, co
  // widok, więc znika sama, gdy tylko wybierzesz klienta z pickera.
  const linkedClient = clients.find((c) => c.id === invoice.client_id) ?? null;
  const linkStatus = clientLinkStatus(
    { client_id: invoice.client_id, klient_nazwa: invoice.klient_nazwa, klient_nip: invoice.klient_nip },
    linkedClient ? { nazwa: linkedClient.nazwa ?? "", nip: linkedClient.nip ?? "" } : null
  );
  const linkHint =
    linkStatus === "unlinked"
      ? UNLINKED_CLIENT_HINT
      : linkStatus === "mismatch"
        ? clientMismatchHint(linkedClient?.nazwa ?? "")
        : null;

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
              {!locked && (
                <ClientLinkPicker
                  clients={clients}
                  clientId={invoice.client_id}
                  onPick={pickClient}
                  onCreate={createClientFromBuyer}
                />
              )}
            </div>
            {!locked && linkHint && <LinkHint text={linkHint} />}
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
                placeholder="NIP lub VAT-UE (np. DE123456789)"
                className="min-w-0 flex-1 rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
              />
              <button
                onClick={lookupNip}
                disabled={nipLoading}
                title="Polski NIP → Biała Lista MF; numer z prefiksem kraju UE (np. DE, IE) → VIES"
                className="flex shrink-0 items-center gap-1 rounded-lg border hairline px-2.5 text-xs text-muted hover:text-[var(--fg)] disabled:opacity-50"
              >
                {nipLoading ? <IconLoader2 size={13} className="animate-spin" /> : <IconSearch size={13} />}
                Szukaj po NIP / VAT-UE
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
                <button
                  onClick={() => {
                    setBruttoDrafts({});
                    patchInvoice({ ceny_brutto: !invoice.ceny_brutto });
                  }}
                  title="Przełącz, czy pole ceny w wierszach przyjmuje kwotę netto czy brutto (na fakturze zawsze pokazujemy obie)"
                  className="rounded-full border hairline px-3 py-1 text-xs text-muted hover:text-[var(--fg)]"
                >
                  Wpisuję ceny: <span className="font-medium text-[var(--fg)]">{invoice.ceny_brutto ? "brutto" : "netto"}</span>
                </button>
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

            {koryguje && isDraft && (
              <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-400/10 px-3 py-2 text-[11.5px] leading-relaxed text-amber-600 dark:text-amber-400">
                <p className="mb-1 font-medium">Jak działa korekta</p>
                <p className="text-[var(--fg)]/80">
                  Popraw pozycje tak, jak faktura <span className="font-medium">powinna wyglądać po zmianie</span> (stan
                  docelowy). Usługę niewykonaną <span className="font-medium">usuń</span> (<IconTrash size={12} className="inline align-[-2px]" />). Aby zmniejszyć ilość lub cenę —
                  wpisz nową, <span className="font-medium">dodatnią</span> wartość. Nie wpisuj ilości ujemnej ani{" "}
                  <span className="font-medium">0</span>. System sam policzy różnicę względem faktury pierwotnej{" "}
                  <span className="font-medium">{koryguje.numer ?? "…"}</span> i wyśle ją do KSeF.
                </p>
                {typeof koryguje.brutto === "number" && (
                  <p className="mt-1.5 text-[var(--fg)]">
                    Pierwotnie{" "}
                    <span className="tabular-nums">{formatMoney(koryguje.brutto, invoice.waluta || "PLN")}</span> → po korekcie{" "}
                    <span className="tabular-nums">{formatMoney(totals.brutto, invoice.waluta || "PLN")}</span> ={" "}
                    <span className="font-semibold tabular-nums">
                      {totals.brutto - koryguje.brutto >= 0 ? "+" : ""}
                      {formatMoney(totals.brutto - koryguje.brutto, invoice.waluta || "PLN")}
                    </span>{" "}
                    <span className="text-muted">(różnica do KSeF)</span>
                  </p>
                )}
              </div>
            )}

            {items.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted opacity-60">Brak pozycji — dodaj pierwszą.</p>
            ) : (
              <div className="space-y-1.5">
                <div className="flex gap-1.5 px-1 text-[10px] uppercase tracking-wide text-muted">
                  <span className="flex-1">Nazwa</span>
                  <span className="w-14 text-right">Ilość</span>
                  <span className="w-16 text-center">Jedn.</span>
                  <span className="w-24 text-right">{invoice.ceny_brutto ? "Cena brutto" : "Cena netto"}</span>
                  <span className="w-14 text-center">Rabat</span>
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
                    {invoice.ceny_brutto ? (
                      <input
                        type="number"
                        step="0.01"
                        value={bruttoDrafts[it.id] ?? unitBrutto(it)}
                        onChange={(e) => setBruttoDrafts((prev) => ({ ...prev, [it.id]: e.target.value }))}
                        onBlur={(e) => {
                          const netto = nettoFromUnitBrutto(Number(e.target.value) || 0, it.vat_stawka);
                          patchItem(it.id, { cena_netto: netto });
                          setBruttoDrafts((prev) => {
                            const next = { ...prev };
                            delete next[it.id];
                            return next;
                          });
                        }}
                        title={`Cena netto: ${formatMoney(it.cena_netto, invoice.waluta || "PLN")}`}
                        className="w-24 rounded-md border hairline bg-transparent px-1.5 py-1 text-right text-[13px] text-[var(--fg)]"
                      />
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        value={it.cena_netto}
                        onChange={(e) => setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, cena_netto: Number(e.target.value) } : x)))}
                        onBlur={(e) => patchItem(it.id, { cena_netto: Number(e.target.value) })}
                        className="w-24 rounded-md border hairline bg-transparent px-1.5 py-1 text-right text-[13px] text-[var(--fg)]"
                      />
                    )}
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={it.rabat_procent || ""}
                      onChange={(e) => setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, rabat_procent: Number(e.target.value) } : x)))}
                      onBlur={(e) => patchItem(it.id, { rabat_procent: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                      placeholder="0"
                      title={it.rabat_procent ? `Rabat ${it.rabat_procent}% = -${formatMoney(itemDiscountAmount(it), invoice.waluta || "PLN")}` : "Rabat %"}
                      className="w-14 rounded-md border hairline bg-transparent px-1.5 py-1 text-right text-[13px] text-[var(--fg)] placeholder:text-muted"
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
                    <span className="w-24 text-right text-[13px] tabular-nums">{formatMoney(itemBrutto(it), invoice.waluta || "PLN")}</span>
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
                <span className="tabular-nums text-[var(--fg)]">{formatMoney(totals.netto, invoice.waluta || "PLN")}</span>
              </div>
              {vatPayer && (
                <div className="flex w-48 justify-between text-muted">
                  <span>VAT</span>
                  <span className="tabular-nums text-[var(--fg)]">{formatMoney(totals.vat, invoice.waluta || "PLN")}</span>
                </div>
              )}
              <div className="flex w-48 justify-between font-semibold">
                <span>{invoice.rozlicza_zaliczke_id ? "Wartość zamówienia" : "Do zapłaty"}</span>
                <span className="tabular-nums text-[var(--fg)]">{formatMoney(vatPayer ? totals.brutto : totals.netto, invoice.waluta || "PLN")}</span>
              </div>
              {invoice.rozlicza_zaliczke_id && (
                <>
                  <div className="flex w-48 justify-between text-muted">
                    <span>Zaliczka {zaliczka?.numer ?? "…"}</span>
                    <span className="tabular-nums">-{formatMoney(zaliczkaBrutto, invoice.waluta || "PLN")}</span>
                  </div>
                  <div className="flex w-48 justify-between font-semibold">
                    <span>Do zapłaty</span>
                    <span className="tabular-nums text-[var(--fg)]">{formatMoney(dueAmount, invoice.waluta || "PLN")}</span>
                  </div>
                </>
              )}
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
              <button
                type="button"
                onClick={() => onOpenInvoice?.(koryguje.id)}
                disabled={!onOpenInvoice}
                title={onOpenInvoice ? "Otwórz fakturę pierwotną" : undefined}
                className="mb-2 flex w-full items-center justify-between gap-2 rounded-lg bg-[var(--hairline)]/40 px-2.5 py-1.5 text-[11.5px] text-muted enabled:hover:bg-[var(--hairline)] disabled:cursor-default"
              >
                <span>
                  Korekta faktury <span className="font-medium text-[var(--fg)]">{koryguje.numer ?? "…"}</span>
                </span>
                {koryguje.status && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${INVOICE_STATUS_CLASS[koryguje.status] ?? ""}`}>
                    {koryguje.status}
                  </span>
                )}
              </button>
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
              <div className="mt-2 space-y-2">
                <textarea
                  value={invoice.przyczyna_korekty}
                  onChange={(e) => setInvoice((p) => (p ? { ...p, przyczyna_korekty: e.target.value } : p))}
                  onBlur={(e) => patchInvoice({ przyczyna_korekty: e.target.value })}
                  rows={2}
                  placeholder="Przyczyna korekty (wymagana przez KSeF)"
                  className="w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
                />
                <Field label="Typ korekty (KSeF)">
                  <PropertyMenu
                    value={invoice.typ_korekty || "1"}
                    options={KOREKTA_TYPY.map((t) => ({ value: t, label: KOREKTA_TYP_LABEL[t] }))}
                    onChange={(v) => patchInvoice({ typ_korekty: v })}
                    title="Typ skutku korekty w ewidencji VAT"
                    full
                  >
                    <span className="text-[13px] text-[var(--fg)] hover:bg-[var(--hairline)] rounded-md px-1.5 py-1 -mx-1.5">
                      {KOREKTA_TYP_LABEL[(invoice.typ_korekty || "1") as (typeof KOREKTA_TYPY)[number]] ?? invoice.typ_korekty}
                    </span>
                  </PropertyMenu>
                </Field>
              </div>
            )}

            {invoice.typ_dokumentu === "zaliczkowa" && (
              <div className="mt-2 space-y-2">
                <Field label="Zamówienie">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={invoice.zamowienie_wartosc ?? ""}
                    onChange={(e) =>
                      setInvoice((p) => (p ? { ...p, zamowienie_wartosc: e.target.value === "" ? null : Number(e.target.value) } : p))
                    }
                    onBlur={(e) => patchInvoice({ zamowienie_wartosc: e.target.value === "" ? null : Number(e.target.value) })}
                    placeholder="Wartość zamówienia brutto"
                    className="w-full bg-transparent text-[13px] text-[var(--fg)] placeholder:text-muted outline-none"
                  />
                </Field>
                <textarea
                  value={invoice.zamowienie_opis}
                  onChange={(e) => setInvoice((p) => (p ? { ...p, zamowienie_opis: e.target.value } : p))}
                  onBlur={(e) => patchInvoice({ zamowienie_opis: e.target.value })}
                  rows={2}
                  placeholder='Opis zamówienia/umowy (np. "Wdrożenie systemu CRM") — zalecane dla KSeF, całość widoczna dopiero na fakturze rozliczeniowej'
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
                      {invoice.rozlicza_zaliczke_id ? `Rozlicza zaliczkę ${zaliczka?.numer ?? "✓"}` : "Rozlicza zaliczkę (opcjonalnie)"}
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
                            setZaliczka(null);
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
                              // Ustaw od razu z danych już dostępnych w pickerze — bez
                              // tego banner "Do zapłaty" pokazywałby zaliczkę -0,00 zł
                              // (przestarzałe dane) do czasu ponownego otwarcia edytora.
                              setZaliczka({ id: z.id, numer: z.numer, brutto: z.brutto });
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
            <div className="space-y-1.5">
              <label className="flex cursor-pointer items-center gap-2 px-1 text-[12px] text-muted">
                <input
                  type="checkbox"
                  checked={paidNow}
                  onChange={(e) => setPaidNow(e.target.checked)}
                  className="h-3.5 w-3.5 cursor-pointer accent-[#7C3AED]"
                />
                Zapłacono od razu (gotówka)
              </label>
              {invoice.koryguje_id && !invoice.przyczyna_korekty.trim() && (
                <p className="px-1 text-[11px] text-amber-500">
                  Podaj przyczynę korekty (wymagana do wystawienia i wysyłki do KSeF).
                </p>
              )}
              <button
                onClick={issue}
                disabled={issuing || items.length === 0 || (!!invoice.koryguje_id && !invoice.przyczyna_korekty.trim())}
                className="btn-primary flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                {issuing ? <IconLoader2 size={15} className="animate-spin" /> : <IconCheck size={15} />}
                Wystaw fakturę
              </button>
            </div>
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

          {!isDraft && (overdue || reminders.length > 0) && (
            <div className="card-paper rounded-xl border hairline p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[11px] uppercase tracking-wide text-muted">Windykacja</h3>
                {invoice.reminder_level > 0 && (
                  <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[11px] font-medium text-orange-400">
                    {REMINDER_LEVEL_LABEL[invoice.reminder_level] ?? `Poziom ${invoice.reminder_level}`}
                  </span>
                )}
              </div>
              {reminders.length > 0 ? (
                <div className="mb-2 space-y-1">
                  {reminders.map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-[12.5px]">
                      <span className="text-muted">{REMINDER_LEVEL_LABEL[r.level] ?? `Poziom ${r.level}`}</span>
                      <span className="tabular-nums text-muted">{formatPlDate(r.sent_at)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mb-2 text-[12px] text-muted">Jeszcze nic nie wysłano.</p>
              )}
              {invoice.wezwanie_wystawiono_at && (
                <a
                  href={`/${lang}/admin/invoices/${id}/wezwanie/print`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-full border hairline px-3 py-1.5 text-xs text-muted hover:text-[var(--fg)]"
                >
                  <IconExternalLink size={13} /> Podgląd wezwania do zapłaty
                </a>
              )}
            </div>
          )}

          {!isDraft && (invoice.typ_dokumentu === "faktura" || invoice.typ_dokumentu === "zaliczkowa") && (
            <div className="card-paper rounded-xl border hairline p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[11px] uppercase tracking-wide text-muted">
                  KSeF
                  {koryguje ? " — korekta" : invoice.typ_dokumentu === "zaliczkowa" ? " — zaliczkowa" : invoice.rozlicza_zaliczke_id ? " — rozliczeniowa" : ""}
                </h3>
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
              <h3 className="mb-2 text-[11px] uppercase tracking-wide text-muted">Korekty tej faktury</h3>
              <div className="space-y-1">
                {korekty.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => onOpenInvoice?.(k.id)}
                    disabled={!onOpenInvoice}
                    title={onOpenInvoice ? "Otwórz korektę" : undefined}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-[12.5px] text-[var(--fg)] enabled:hover:bg-[var(--hairline)] disabled:cursor-default"
                  >
                    <span>{k.numer ?? "(szkic)"}</span>
                    {k.status && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${INVOICE_STATUS_CLASS[k.status] ?? ""}`}>
                        {k.status}
                      </span>
                    )}
                  </button>
                ))}
              </div>
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
                  {(() => {
                    const nextLevel = Math.max(1, reminderLevelForDays(daysOverdue(invoice))) as 1 | 2 | 3;
                    if (invoice.reminder_level >= 3) return "Wyślij wezwanie ponownie";
                    if (nextLevel === 3) return "Wyślij wezwanie do zapłaty";
                    return `Wyślij przypomnienie (${REMINDER_LEVEL_LABEL[nextLevel]?.toLowerCase()})`;
                  })()}
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
