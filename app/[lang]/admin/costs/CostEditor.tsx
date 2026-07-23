"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  IconX,
  IconTrash,
  IconCheck,
  IconLoader2,
  IconPaperclip,
  IconExternalLink,
  IconUpload,
  IconCamera,
  IconCopy,
  IconSearch,
  IconAlertTriangleFilled,
} from "@tabler/icons-react";
import {
  type Cost,
  type PaymentMethod,
  COST_CATEGORIES,
  VAT_RATES,
  ATTACHMENT_MIME_TYPES,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  PAYMENT_METHOD_CLASS,
  AMORTYZACJA_PROG_NETTO,
  VAT_ODLICZENIE_OPTIONS,
  VAT_ODLICZENIE_LABEL,
  costBrutto,
  vatDoOdliczenia,
  formatMoney,
} from "@/lib/costs";
import { lookupSupplierByNip, normalizeAccountNumber } from "@/lib/vies";
import { useUI } from "../ui";
import { DateField } from "../DatePicker";
import { Popover, MenuRow, PropertyMenu } from "../Menu";
import { LinkPicker } from "../LinkPicker";
import { StatusTag, PaymentMethodIcon } from "./shared";

type ProjectOption = { id: string; tytul: string };

export function CostEditor({
  id,
  onClose,
  onChange,
  onDeleted,
  onBusyChange,
}: {
  id: string;
  onClose: () => void;
  onChange?: () => void;
  onDeleted?: (id: string) => void;
  /** Informuje rodzica, że trwa odczyt AI — okno nie powinno się dać
   * przypadkiem zamknąć kliknięciem w tło, dopóki zapytanie nie skończy. */
  onBusyChange?: (busy: boolean) => void;
}) {
  const { toast, confirm } = useUI();
  const [cost, setCost] = useState<Cost | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const savedTimer = useRef<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [nipLoading, setNipLoading] = useState(false);
  /** Numery kont z Białej Listy MF dla ostatnio wyszukanego NIP-u dostawcy —
   * `null` dopóki nie zrobiono wyszukiwania (wtedy nie pokazujemy żadnej
   * oceny zgodności konta, bo nie mamy z czym porównać). */
  const [supplierAccounts, setSupplierAccounts] = useState<string[] | null>(null);
  /** Dwie miękkie, w pełni deterministyczne podpowiedzi liczone z historii
   * kosztów tego samego dostawcy (NIP) — zero AI, patrz CLAUDE.md. */
  const [hints, setHints] = useState<{
    duplicate: { id: string; dostawca_nazwa: string; kwota_brutto: number; data_wydatku: string } | null;
    suggestion: { kategoria: string; project_id: string | null; project_tytul: string | null } | null;
  } | null>(null);
  /** Numer konta własnej firmy (ustawienia sprzedawcy) — do ostrzeżenia,
   * gdy ktoś przez pomyłkę wpisze własne konto jako konto dostawcy. `null`
   * dopóki ustawienia się nie wczytają albo firma nie ma ustawionego konta. */
  const [companyKonto, setCompanyKonto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  /** Pola, których zmiana ma sens do ponownego sprawdzenia duplikatu/podpowiedzi
   * kategorii — reszta (opis, status, metoda płatności…) nie wpływa na wynik. */
  const HINT_TRIGGER_KEYS = ["dostawca_nip", "kwota_netto", "vat_stawka", "data_wydatku"];

  const refreshHints = useCallback(async (c: Cost) => {
    const nipDigits = c.dostawca_nip.replace(/\D/g, "");
    if (nipDigits.length !== 10 || !c.data_wydatku) {
      setHints(null);
      return;
    }
    const brutto = costBrutto(c.kwota_netto, c.vat_stawka);
    const params = new URLSearchParams({ nip: nipDigits, excludeId: c.id, kwota: String(brutto), data: c.data_wydatku });
    const res = await fetch(`/api/costs/hints?${params.toString()}`);
    if (!res.ok) return;
    setHints(await res.json());
  }, []);

  const load = useCallback(async () => {
    const [costRes, projectsRes, settingsRes] = await Promise.all([
      fetch(`/api/costs/${id}`),
      fetch("/api/projects"),
      fetch("/api/settings"),
    ]);
    if (!costRes.ok) return;
    const data = (await costRes.json()) as { cost: Cost };
    setCost(data.cost);
    refreshHints(data.cost);
    if (projectsRes.ok) {
      const pdata = (await projectsRes.json()) as { projects: ProjectOption[] };
      setProjects(pdata.projects);
    }
    if (settingsRes.ok) {
      const sdata = (await settingsRes.json()) as { settings: { konto?: string } | null };
      setCompanyKonto(sdata.settings?.konto?.trim() || null);
    }
  }, [id, refreshHints]);

  useEffect(() => {
    load();
  }, [load]);

  const flashSaved = useCallback(() => {
    setSaveState("saved");
    if (savedTimer.current) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaveState("idle"), 1500);
  }, []);

  const patch = useCallback(
    async (body: Partial<Cost> & Record<string, unknown>) => {
      setCost((prev) => (prev ? { ...prev, ...body } : prev));
      setSaveState("saving");
      const res = await fetch(`/api/costs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        flashSaved();
        onChange?.();
        // Kwota netto/VAT/status mogą przeliczyć brutto/data_platnosci po
        // stronie serwera — dociągnij świeży stan zamiast zgadywać lokalnie.
        const fresh = await fetch(`/api/costs/${id}`);
        if (fresh.ok) {
          const data = (await fresh.json()) as { cost: Cost };
          setCost(data.cost);
          if (Object.keys(body).some((k) => HINT_TRIGGER_KEYS.includes(k))) refreshHints(data.cost);
        }
      } else {
        setSaveState("idle");
        toast("Nie udało się zapisać.", "error");
      }
    },
    [id, flashSaved, onChange, toast, refreshHints]
  );

  const lookupSupplier = useCallback(async () => {
    if (!cost) return;
    setNipLoading(true);
    const r = await lookupSupplierByNip(cost.dostawca_nip);
    setNipLoading(false);
    if (!r.ok) {
      toast(r.message, "error");
      return;
    }
    setSupplierAccounts(r.numeryKont);
    if (r.dostawca_nazwa) await patch({ dostawca_nazwa: r.dostawca_nazwa });
    toast(r.message);
  }, [cost, patch, toast]);

  const remove = useCallback(async () => {
    const ok = await confirm(`Usunąć koszt „${cost?.dostawca_nazwa || "bez nazwy dostawcy"}”?`, { danger: true });
    if (!ok) return;
    const res = await fetch(`/api/costs/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Nie udało się usunąć.", "error");
      return;
    }
    toast("Koszt usunięty.");
    onDeleted?.(id);
  }, [id, cost, confirm, toast, onDeleted]);

  const uploadAttachment = useCallback(
    async (file: File) => {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/costs/${id}/attachment`, { method: "POST", body: formData });
      setUploading(false);
      if (res.ok) {
        const data = (await res.json()) as { zalacznik_nazwa: string; zalacznik_typ: string };
        setCost((prev) => (prev ? { ...prev, zalacznik_nazwa: data.zalacznik_nazwa, zalacznik_typ: data.zalacznik_typ } : prev));
        toast("Załącznik zapisany.");
        onChange?.();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast(data.error ?? "Nie udało się wgrać pliku.", "error");
      }
    },
    [id, toast, onChange]
  );

  const readWithOcr = useCallback(async () => {
    setOcrLoading(true);
    onBusyChange?.(true);
    toast("Odczytuję załącznik przez model AI — to może potrwać do minuty…");
    try {
      const res = await fetch(`/api/costs/${id}/ocr`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        suggestion?: {
          dostawca_nazwa: string;
          dostawca_nip: string;
          numer_faktury: string;
          dostawca_konto: string;
          kwota_netto: number | null;
          vat_stawka: string | null;
          data_wydatku: string;
          data_platnosci: string;
          opis: string;
          kategoria: string | null;
        };
        error?: string;
      };
      if (!res.ok || !data.suggestion) {
        toast(data.error ?? "Nie udało się odczytać załącznika. Wpisz dane ręcznie.", "error");
        return;
      }
      const s = data.suggestion;
      const patchBody: Record<string, unknown> = {};
      if (s.dostawca_nazwa) patchBody.dostawca_nazwa = s.dostawca_nazwa;
      if (s.dostawca_nip) patchBody.dostawca_nip = s.dostawca_nip;
      if (s.numer_faktury) patchBody.numer_faktury = s.numer_faktury;
      // Numer konta dostawcy tylko gdy jeszcze puste — to pole steruje
      // przelewem, nie nadpisujemy cicho czegoś, co właściciel już sprawdził.
      if (s.dostawca_konto && !cost?.dostawca_konto) patchBody.dostawca_konto = s.dostawca_konto;
      if (s.kwota_netto != null) patchBody.kwota_netto = s.kwota_netto;
      if (s.vat_stawka) patchBody.vat_stawka = s.vat_stawka;
      if (s.data_wydatku) patchBody.data_wydatku = s.data_wydatku;
      if (s.data_platnosci) patchBody.data_platnosci = s.data_platnosci;
      if (s.opis) patchBody.opis = s.opis;
      // Tylko gdy kategoria jest dziś nieustawiona ("Inne") — nie nadpisuj
      // cicho świadomego wyboru właściciela z wcześniejszego zapisu (ta sama
      // zasada widoczności co podpowiedź z historii NIP-u niżej).
      if (s.kategoria && cost?.kategoria === "Inne") patchBody.kategoria = s.kategoria;
      if (Object.keys(patchBody).length === 0) {
        toast("Model nie rozpoznał żadnych pól — wpisz dane ręcznie.", "error");
        return;
      }
      await patch(patchBody);
      toast("Odczytano załącznik — sprawdź i popraw dane przed zapisem.");
    } finally {
      setOcrLoading(false);
      onBusyChange?.(false);
    }
  }, [id, toast, patch, onBusyChange, cost]);

  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);

  const removeAttachment = useCallback(async () => {
    const ok = await confirm("Usunąć załącznik?", { danger: true });
    if (!ok) return;
    const res = await fetch(`/api/costs/${id}/attachment`, { method: "DELETE" });
    if (res.ok) {
      setCost((prev) => (prev ? { ...prev, zalacznik_nazwa: "", zalacznik_typ: "" } : prev));
      onChange?.();
    } else {
      toast("Nie udało się usunąć załącznika.", "error");
    }
  }, [id, confirm, toast, onChange]);

  if (!cost) {
    return (
      <div className="flex items-center justify-center p-10">
        <IconLoader2 className="animate-spin text-muted" size={22} />
      </div>
    );
  }

  const projectLabel = projects.find((p) => p.id === cost.project_id)?.tytul ?? "Brak";

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <StatusTag status={cost.status} onChange={(v) => patch({ status: v as Cost["status"] })} />
          <PropertyMenu
            value={(cost.metoda_platnosci as PaymentMethod) ?? ""}
            options={[
              { value: "" as PaymentMethod, label: "Brak" },
              ...PAYMENT_METHODS.map((m) => ({
                value: m,
                label: PAYMENT_METHOD_LABEL[m],
                icon: <PaymentMethodIcon method={m} size={14} />,
              })),
            ]}
            onChange={(v) => patch({ metoda_platnosci: v || null })}
            title="Zmień metodę płatności"
          >
            <span
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                cost.metoda_platnosci ? PAYMENT_METHOD_CLASS[cost.metoda_platnosci as PaymentMethod] ?? "bg-[var(--hairline)] text-muted" : "bg-[var(--hairline)] text-muted"
              }`}
            >
              {cost.metoda_platnosci ? (
                <>
                  <PaymentMethodIcon method={cost.metoda_platnosci as PaymentMethod} size={12} />
                  {PAYMENT_METHOD_LABEL[cost.metoda_platnosci as PaymentMethod] ?? cost.metoda_platnosci}
                </>
              ) : (
                "Metoda płatności: —"
              )}
            </span>
          </PropertyMenu>
          {cost.ksef_numer && (
            <span
              className="rounded-md bg-brand-cyan/15 px-1.5 py-0.5 text-[10.5px] font-medium text-brand-cyan"
              title={`Faktura pobrana z KSeF — numer ${cost.ksef_numer}`}
            >
              z KSeF{cost.ksef_tryb === "test" ? " (test)" : ""}
            </span>
          )}
          {saveState === "saving" && <IconLoader2 className="animate-spin text-muted" size={14} />}
          {saveState === "saved" && <IconCheck className="text-emerald-400" size={14} />}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={remove} className="flex text-muted hover:text-red-400" title="Usuń koszt">
            <IconTrash size={16} />
          </button>
          <button onClick={onClose} className="flex text-muted hover:text-[var(--fg)]" title="Zamknij">
            <IconX size={18} />
          </button>
        </div>
      </div>

      {hints?.duplicate && (
        <div className="mb-3 flex items-start gap-2 rounded-md bg-amber-400/10 px-2.5 py-2 text-[11.5px] text-amber-400">
          <IconAlertTriangleFilled size={14} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            Podobny koszt już istnieje: „{hints.duplicate.dostawca_nazwa || "bez nazwy"}”, {formatMoney(hints.duplicate.kwota_brutto)},{" "}
            {hints.duplicate.data_wydatku} — ten sam dostawca, kwota i data (±3 dni). Sprawdź, czy to nie duplikat.
          </div>
          <button
            onClick={() => {
              patch({ duplikat_potwierdzony: true });
              setHints((h) => (h ? { ...h, duplicate: null } : h));
            }}
            className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-amber-400 hover:bg-amber-400/15"
          >
            To nie duplikat
          </button>
        </div>
      )}
      {hints?.suggestion && (cost.kategoria === "Inne" || !cost.project_id) && (
        <div className="mb-3 flex items-center gap-2 rounded-md bg-[var(--hairline)] px-2.5 py-2 text-[11.5px] text-muted">
          <span className="flex-1">
            Poprzedni koszt tego dostawcy: kategoria „{hints.suggestion.kategoria}”
            {hints.suggestion.project_tytul ? `, projekt „${hints.suggestion.project_tytul}”` : ""}.
          </span>
          <button
            onClick={() => {
              patch({ kategoria: hints.suggestion!.kategoria, project_id: hints.suggestion!.project_id });
              setHints((h) => (h ? { ...h, suggestion: null } : h));
            }}
            className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-brand-purple hover:bg-brand-purple/15"
          >
            Zastosuj
          </button>
        </div>
      )}

      <div key={cost.updated_at} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* key={cost.updated_at}: pola tekstowe niżej są nieskontrolowane
         * (defaultValue), żeby nie gubić kursora przy pisaniu — ale to
         * znaczy, że nie odświeżają się same, gdy wartość zmienia się
         * programowo (np. po OCR), tylko przy ponownym montowaniu. Klucz
         * na updated_at wymusza remount po każdym patchu z zewnątrz. */}
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Dostawca</span>
          <input
            defaultValue={cost.dostawca_nazwa}
            onBlur={(e) => e.target.value !== cost.dostawca_nazwa && patch({ dostawca_nazwa: e.target.value })}
            className="w-full rounded-md border hairline bg-transparent px-2.5 py-1.5 text-[13px] text-[var(--fg)] outline-none focus:border-brand-purple/60"
            placeholder="Nazwa dostawcy"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">NIP dostawcy</span>
          <div className="flex items-center gap-1.5">
            <input
              defaultValue={cost.dostawca_nip}
              onBlur={(e) => e.target.value !== cost.dostawca_nip && patch({ dostawca_nip: e.target.value })}
              className="w-full rounded-md border hairline bg-transparent px-2.5 py-1.5 text-[13px] text-[var(--fg)] outline-none focus:border-brand-purple/60"
              placeholder="opcjonalnie"
            />
            <button
              onClick={lookupSupplier}
              disabled={nipLoading || !cost.dostawca_nip}
              title="Polski NIP → Biała Lista MF (nazwa + numery kont); numer z prefiksem kraju UE → VIES"
              className="flex shrink-0 items-center gap-1 rounded-md border hairline px-2 py-1.5 text-[12px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {nipLoading ? <IconLoader2 size={13} className="animate-spin" /> : <IconSearch size={13} />}
            </button>
          </div>
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Numer faktury</span>
          <input
            defaultValue={cost.numer_faktury}
            onBlur={(e) => e.target.value !== cost.numer_faktury && patch({ numer_faktury: e.target.value })}
            className="w-full rounded-md border hairline bg-transparent px-2.5 py-1.5 text-[13px] text-[var(--fg)] outline-none focus:border-brand-purple/60"
            placeholder="np. FV/123/2026"
          />
        </label>

        <label className="col-span-full block sm:col-span-1">
          <span className="mb-1 block text-[11px] text-muted">Numer konta dostawcy</span>
          <div className="flex items-center gap-1.5">
            <input
              defaultValue={cost.dostawca_konto}
              onBlur={(e) => e.target.value !== cost.dostawca_konto && patch({ dostawca_konto: e.target.value.replace(/\s+/g, " ").trim() })}
              className="w-full rounded-md border hairline bg-transparent px-2.5 py-1.5 text-[13px] text-[var(--fg)] outline-none focus:border-brand-purple/60"
              placeholder="PL00 0000 0000 0000 0000 0000 0000"
            />
            <button
              onClick={async () => {
                const brutto = formatMoney(costBrutto(cost.kwota_netto, cost.vat_stawka));
                const tytul = [cost.numer_faktury, cost.dostawca_nazwa].filter(Boolean).join(" — ") || cost.opis || "Płatność";
                const text = `Numer konta: ${cost.dostawca_konto}\nKwota: ${brutto}\nTytuł: ${tytul}`;
                await navigator.clipboard.writeText(text);
                toast("Skopiowano dane do przelewu.");
              }}
              disabled={!cost.dostawca_konto}
              className="flex shrink-0 items-center gap-1 rounded-md border hairline px-2 py-1.5 text-[12px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-40"
              title="Kopiuj numer konta, kwotę i tytuł do schowka"
            >
              <IconCopy size={13} /> Kopiuj
            </button>
          </div>
          {companyKonto && cost.dostawca_konto && normalizeAccountNumber(companyKonto) === normalizeAccountNumber(cost.dostawca_konto) ? (
            <p className="mt-1 flex items-center gap-1 text-[10.5px] text-amber-400">
              <IconAlertTriangleFilled size={12} /> To wygląda na numer konta Twojej własnej firmy — sprawdź, czy nie pomyliłeś się z kontem dostawcy.
            </p>
          ) : supplierAccounts !== null && cost.dostawca_konto && (
            supplierAccounts.length === 0 ? (
              <p className="mt-1 text-[10.5px] text-muted">Biała Lista MF nie zwróciła numerów kont dla tego NIP-u.</p>
            ) : supplierAccounts.some((a) => normalizeAccountNumber(a) === normalizeAccountNumber(cost.dostawca_konto)) ? (
              <p className="mt-1 flex items-center gap-1 text-[10.5px] text-emerald-400">
                <IconCheck size={12} /> Zgodny z Białą Listą MF.
              </p>
            ) : (
              <p className="mt-1 flex items-center gap-1 text-[10.5px] text-amber-400">
                <IconAlertTriangleFilled size={12} /> Numer NIE widnieje w Białej Liście dla tego NIP-u — przelew &gt;15 000 zł na to konto może oznaczać utratę prawa do zaliczenia w koszty.
              </p>
            )
          )}
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Kategoria</span>
          <Popover
            align="left"
            width={200}
            trigger={(open) => (
              <button
                onClick={open}
                className="flex w-full items-center justify-between rounded-md border hairline px-2.5 py-1.5 text-left text-[13px] text-[var(--fg)] hover:bg-[var(--hairline)]"
              >
                {cost.kategoria}
              </button>
            )}
          >
            {(close) => (
              <div>
                {COST_CATEGORIES.map((k) => (
                  <MenuRow key={k} label={k} selected={cost.kategoria === k} onClick={() => { patch({ kategoria: k }); close(); }} />
                ))}
              </div>
            )}
          </Popover>
        </label>

        {/* Moduł 22 — koszt „na rzecz" konkretnego klienta/leada, niezależnie
            od projektu. Osobno od pola Projekt niżej: nie każdy koszt klienta
            ma projekt (np. licencja kupiona pod jedno wdrożenie), a dotąd
            klient dało się wywnioskować TYLKO przez projekt. */}
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Klient / lead</span>
          <LinkPicker
            kinds={["client", "lead"]}
            value={{ client_id: cost.client_id, lead_id: cost.lead_id }}
            onPick={(next) => patch(next)}
            trigger={(picked, open) => (
              <button
                onClick={open}
                className="flex w-full items-center justify-between rounded-md border hairline px-2.5 py-1.5 text-left text-[13px] text-[var(--fg)] hover:bg-[var(--hairline)]"
              >
                {picked ? picked.nazwa : <span className="text-muted">Brak</span>}
              </button>
            )}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Projekt</span>
          <Popover
            align="left"
            width={240}
            trigger={(open) => (
              <button
                onClick={open}
                className="flex w-full items-center justify-between rounded-md border hairline px-2.5 py-1.5 text-left text-[13px] text-[var(--fg)] hover:bg-[var(--hairline)]"
              >
                {projectLabel}
              </button>
            )}
          >
            {(close) => (
              <div className="max-h-64 overflow-y-auto">
                <MenuRow label="Brak" selected={!cost.project_id} onClick={() => { patch({ project_id: null }); close(); }} />
                {projects.map((p) => (
                  <MenuRow key={p.id} label={p.tytul} selected={cost.project_id === p.id} onClick={() => { patch({ project_id: p.id }); close(); }} />
                ))}
              </div>
            )}
          </Popover>
        </label>

        {cost.kategoria === "Sprzęt" && cost.kwota_netto >= AMORTYZACJA_PROG_NETTO && (
          <p className="col-span-full flex items-start gap-1.5 rounded-md bg-amber-400/10 px-2.5 py-1.5 text-[11.5px] text-amber-400">
            <IconAlertTriangleFilled size={13} className="mt-0.5 shrink-0" />
            Kwota netto ≥ {formatMoney(AMORTYZACJA_PROG_NETTO)} przy kategorii „Sprzęt” — to może wymagać amortyzacji zamiast jednorazowego wrzucenia w koszty. Skonsultuj z księgową.
          </p>
        )}

        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Kwota netto</span>
          <input
            type="number"
            step="0.01"
            defaultValue={cost.kwota_netto}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v !== cost.kwota_netto) patch({ kwota_netto: v });
            }}
            className="w-full rounded-md border hairline bg-transparent px-2.5 py-1.5 text-[13px] text-[var(--fg)] outline-none focus:border-brand-purple/60"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Stawka VAT</span>
          <Popover
            align="left"
            width={140}
            trigger={(open) => (
              <button
                onClick={open}
                className="flex w-full items-center justify-between rounded-md border hairline px-2.5 py-1.5 text-left text-[13px] text-[var(--fg)] hover:bg-[var(--hairline)]"
              >
                {cost.vat_stawka === "zw" || cost.vat_stawka === "np" ? cost.vat_stawka : `${cost.vat_stawka}%`}
              </button>
            )}
          >
            {(close) => (
              <div>
                {VAT_RATES.map((r) => (
                  <MenuRow key={r} label={r === "zw" || r === "np" ? r : `${r}%`} selected={cost.vat_stawka === r} onClick={() => { patch({ vat_stawka: r }); close(); }} />
                ))}
              </div>
            )}
          </Popover>
        </label>

        <div className="block">
          <span className="mb-1 block text-[11px] text-muted">Kwota brutto</span>
          <div className="px-2.5 py-1.5 text-[13px] font-medium text-[var(--fg)]">{formatMoney(costBrutto(cost.kwota_netto, cost.vat_stawka))}</div>
        </div>

        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">% odliczenia VAT</span>
          <Popover
            align="left"
            width={260}
            trigger={(open) => (
              <button
                onClick={open}
                className="flex w-full items-center justify-between rounded-md border hairline px-2.5 py-1.5 text-left text-[13px] text-[var(--fg)] hover:bg-[var(--hairline)]"
              >
                {cost.vat_odliczenie_procent}%
              </button>
            )}
          >
            {(close) => (
              <div>
                {VAT_ODLICZENIE_OPTIONS.map((p) => (
                  <MenuRow key={p} label={VAT_ODLICZENIE_LABEL[p]} selected={cost.vat_odliczenie_procent === p} onClick={() => { patch({ vat_odliczenie_procent: p }); close(); }} />
                ))}
              </div>
            )}
          </Popover>
        </label>
        <div className="block">
          <span className="mb-1 block text-[11px] text-muted">VAT do odliczenia</span>
          <div className="px-2.5 py-1.5 text-[13px] font-medium text-[var(--fg)]">
            {formatMoney(vatDoOdliczenia(cost.kwota_netto, cost.vat_stawka, cost.vat_odliczenie_procent))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Data wystawienia (wydatku)</span>
          <DateField value={cost.data_wydatku ?? ""} onChange={(v) => patch({ data_wydatku: v })} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Data wpływu faktury</span>
          <DateField value={cost.data_wplywu ?? ""} onChange={(v) => patch({ data_wplywu: v })} placeholder="Jeśli inna niż wystawienia" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Data płatności</span>
          <DateField value={cost.data_platnosci ?? ""} onChange={(v) => patch({ data_platnosci: v })} placeholder="Ustaw datę" />
        </label>

        <label className="col-span-full block">
          <span className="mb-1 block text-[11px] text-muted">Opis</span>
          <textarea
            defaultValue={cost.opis}
            onBlur={(e) => e.target.value !== cost.opis && patch({ opis: e.target.value })}
            rows={3}
            className="w-full resize-none rounded-md border hairline bg-transparent px-2.5 py-1.5 text-[13px] text-[var(--fg)] outline-none focus:border-brand-purple/60"
            placeholder="Notatka o wydatku…"
          />
        </label>

        <div className="col-span-full">
          <span className="mb-1 block text-[11px] text-muted">Załącznik (skan / PDF faktury)</span>
          {cost.zalacznik_nazwa ? (
            <div className="flex items-center gap-2 rounded-md border hairline px-2.5 py-1.5 text-[13px]">
              <IconPaperclip size={14} className="shrink-0 text-muted" />
              <a
                href={`/api/costs/${id}/attachment`}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate text-[var(--fg)] hover:underline"
                title="Otwórz załącznik w nowej karcie"
              >
                {cost.zalacznik_nazwa}
              </a>
              <IconExternalLink size={12} className="shrink-0 text-muted" />
              <button
                onClick={readWithOcr}
                disabled={ocrLoading}
                className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-50"
                title="Odczytaj dane z załącznika modelem AI (propozycja do sprawdzenia)"
              >
                {ocrLoading ? <IconLoader2 size={14} className="animate-spin" /> : <IconCamera size={14} />}
                {ocrLoading ? "Odczytuję…" : "Odczytaj z załącznika"}
              </button>
              <button onClick={removeAttachment} className="shrink-0 text-muted hover:text-red-400" title="Usuń załącznik">
                <IconTrash size={14} />
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 rounded-md border hairline px-2.5 py-1.5 text-[13px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? <IconLoader2 size={14} className="animate-spin" /> : <IconUpload size={14} />}
                {uploading ? "Wgrywanie…" : "Wgraj skan / PDF (max 8 MB)"}
              </button>
              <button
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 rounded-md border hairline px-2.5 py-1.5 text-[13px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-50"
                title="Na telefonie od razu otwiera aparat"
              >
                <IconCamera size={14} /> Zrób zdjęcie
              </button>
            </div>
          )}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadAttachment(file);
              e.target.value = "";
            }}
            className="hidden"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept={ATTACHMENT_MIME_TYPES.join(",")}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadAttachment(file);
              e.target.value = "";
            }}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
}
