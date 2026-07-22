"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconX, IconTrash, IconCheck, IconLoader2, IconChevronDown, IconExternalLink, IconMail, IconCopy, IconSearch, IconLayoutGrid } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import { type Offer, type OfferItem, OFFER_LANGS, OFFER_LANG_LABEL, offerTotal, itemKwota } from "@/lib/offers";
import { type OfferTemplate, templateTotal } from "@/lib/offerTemplates";
import { formatMoney } from "@/lib/invoices";
import { PROJECT_TEMPLATES, formatPlDate } from "@/lib/projects";
import { useUI } from "../ui";
import { DateField } from "../DatePicker";
import { Popover, MenuRow, MenuDivider, MenuLabel, PropertyMenu } from "../Menu";
import { ClientLinkChip, ClientLinkPicker, LinkHint } from "../components";
import { ShareLinkControl } from "../ShareLinkControl";
import { invalidateLinkTargets } from "../LinkPicker";
import { UNLINKED_CLIENT_HINT, clientLinkStatus, clientMismatchHint } from "@/lib/links";
import type { Client } from "@/lib/clients";
import { lookupClientByNip } from "@/lib/vies";

export function OfferEditor({
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
  const [offer, setOffer] = useState<Offer | null>(null);
  const [items, setItems] = useState<OfferItem[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const savedTimer = useRef<number | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [sending, setSending] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [nipLoading, setNipLoading] = useState(false);
  const [generatingContract, setGeneratingContract] = useState(false);
  const [templates, setTemplates] = useState<OfferTemplate[]>([]);
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => (r.ok ? r.json() : { clients: [] }))
      .then((d) => setClients((d.clients ?? []) as Client[]))
      .catch(() => {});
    fetch("/api/offer-templates")
      .then((r) => (r.ok ? r.json() : { templates: [] }))
      .then((d) => setTemplates((d.templates ?? []) as OfferTemplate[]))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    const res = await fetch(`/api/offers/${id}`);
    if (!res.ok) return;
    const data = (await res.json()) as { offer: Offer; items: OfferItem[] };
    setOffer(data.offer);
    setItems(data.items);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const flashSaved = useCallback(() => {
    setSaveState("saved");
    if (savedTimer.current) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaveState("idle"), 1500);
  }, []);

  const patchOffer = useCallback(
    async (patch: Partial<Offer>) => {
      setOffer((prev) => (prev ? { ...prev, ...patch } : prev));
      setSaveState("saving");
      const res = await fetch(`/api/offers/${id}`, {
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

  const pickClient = useCallback(
    (c: Client | null) => {
      // Jak w InvoiceEditor: dane klienta lądują na ofercie jako migawka, a
      // client_id jako powiązanie (patrz lib/links.ts). „— brak powiązania —"
      // zdejmuje tylko client_id, treści oferty nie rusza.
      if (!c) {
        setOffer((prev) => (prev ? { ...prev, client_id: null } : prev));
        patchOffer({ client_id: null });
        return;
      }
      const patch: Partial<Offer> = {
        client_id: c.id,
        klient_nazwa: c.nazwa ?? "",
        klient_nip: c.nip ?? "",
        klient_ulica: c.ulica ?? "",
        klient_kod: c.kod ?? "",
        klient_miasto: c.miasto ?? "",
        klient_kraj: c.kraj ?? "",
        klient_email: c.email ?? "",
      };
      setOffer((prev) => (prev ? { ...prev, ...patch } : prev));
      patchOffer(patch);
    },
    [patchOffer]
  );

  /** „Załóż klienta z danych nabywcy" — patrz InvoiceEditor. Bez tego picker
   * na pustej bazie klientów nie ma dokąd prowadzić. */
  const createClientFromBuyer = useCallback(async () => {
    const src = offer;
    if (!src) return;
    const nazwa = (src.klient_nazwa ?? "").trim();
    if (!nazwa) {
      toast("Najpierw wpisz nazwę klienta — z pustych danych nie ma czego zakładać.", "error");
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
    invalidateLinkTargets("client");
    setOffer((prev) => (prev ? { ...prev, client_id: newClientId } : prev));
    patchOffer({ client_id: newClientId });
    toast(`Założono klienta „${nazwa}" i podpięto do oferty.`);
  }, [offer, patchOffer, toast]);

  const lookupNip = useCallback(async () => {
    setNipLoading(true);
    const r = await lookupClientByNip(offer?.klient_nip ?? "");
    setNipLoading(false);
    if (!r.ok) {
      toast(r.message, "error");
      return;
    }
    setOffer((p) => (p ? { ...p, ...r.fields } : p));
    await patchOffer(r.fields);
    toast(r.message);
  }, [offer?.klient_nip, patchOffer, toast]);

  const addItem = useCallback(async () => {
    const res = await fetch(`/api/offers/${id}/items`, { method: "POST" });
    if (res.ok) {
      const data = (await res.json()) as { items: OfferItem[] };
      setItems(data.items);
      onChange?.();
    }
  }, [id, onChange]);

  const applyTemplate = useCallback(
    async (templateId: string) => {
      setApplyingTemplate(true);
      const res = await fetch(`/api/offers/${id}/apply-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: templateId }),
      });
      setApplyingTemplate(false);
      if (!res.ok) {
        toast("Nie udało się wstawić szablonu.", "error");
        return;
      }
      const data = (await res.json()) as { items: OfferItem[]; offer: Offer };
      setItems(data.items);
      setOffer(data.offer);
      onChange?.();
      toast("Wstawiono pozycje z szablonu.");
    },
    [id, toast, onChange]
  );

  const patchItem = useCallback(
    async (itemId: string, patch: Partial<OfferItem>) => {
      setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, ...patch } : it)));
      setSaveState("saving");
      const res = await fetch(`/api/offers/${id}/items/${itemId}`, {
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
      await fetch(`/api/offers/${id}/items/${itemId}`, { method: "DELETE" });
      onChange?.();
    },
    [id, onChange]
  );

  const accept = useCallback(
    async (template?: string, confirmExpired?: boolean) => {
      setAccepting(true);
      const res = await fetch(`/api/offers/${id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(template ? { template } : {}), ...(confirmExpired ? { confirmExpired: true } : {}) }),
      });
      setAccepting(false);
      if (res.ok) {
        toast("Zaakceptowano — utworzono projekt i fakturę.");
        await load();
        onChange?.();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string; expired?: boolean };
      if (res.status === 409 && data.expired) {
        const ok = await confirm("Ta oferta jest przeterminowana (minęła data ważności). Zaakceptować mimo to?", { danger: true });
        if (ok) await accept(template, true);
        return;
      }
      toast(data.error ?? "Nie udało się zaakceptować oferty.", "error");
    },
    [id, load, onChange, toast, confirm]
  );

  const remove = useCallback(async () => {
    if (!offer) return;
    const ok = await confirm(`Usunąć ofertę "${offer.tytul || "(bez tytułu)"}"?`, { danger: true });
    if (!ok) return;
    const res = await fetch(`/api/offers/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast("Oferta usunięta.");
      onDeleted?.(id);
    }
  }, [offer, id, confirm, toast, onDeleted]);

  const duplicateOffer = useCallback(async () => {
    setDuplicating(true);
    const res = await fetch(`/api/offers/${id}/duplicate`, { method: "POST" });
    setDuplicating(false);
    if (res.ok) {
      toast("Utworzono duplikat jako nowy szkic.");
      onChange?.();
    } else {
      toast("Nie udało się zduplikować oferty.", "error");
    }
  }, [id, onChange, toast]);

  const generateContract = useCallback(async () => {
    setGeneratingContract(true);
    const res = await fetch("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ typ: "umowa", offer_id: id }),
    });
    setGeneratingContract(false);
    if (res.ok) {
      const data = (await res.json()) as { id: string };
      toast("Wygenerowano umowę z oferty.");
      window.open(`/${lang}/admin/contracts/${data.id}`, "_blank");
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      toast(data.error ?? "Nie udało się wygenerować umowy.", "error");
    }
  }, [id, lang, toast]);

  const sendOfferEmail = useCallback(async () => {
    setSending(true);
    const res = await fetch(`/api/offers/${id}/send`, { method: "POST" });
    setSending(false);
    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as { status?: string; shareToken?: string };
      toast("Oferta wysłana mailem.");
      setOffer((p) =>
        p
          ? {
              ...p,
              ...(data.status ? { status: data.status as Offer["status"] } : {}),
              // Token dopiero co powstał (albo już był) — bez tego przycisk
              // „Unieważnij link" pojawiłby się dopiero po przeładowaniu.
              share_token: data.shareToken ?? p.share_token,
            }
          : p
      );
      onChange?.();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      toast(data.error ?? "Nie udało się wysłać oferty.", "error");
    }
  }, [id, toast, onChange]);

  if (!offer) {
    return (
      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">Oferta</span>
          <button onClick={onClose} className="rounded-full border hairline px-2.5 py-1 text-xs text-muted">
            <IconX size={13} />
          </button>
        </div>
        <div className="mt-6 h-40 animate-pulse rounded-lg bg-[var(--hairline)]" />
      </div>
    );
  }

  const total = offerTotal(items);
  const accepted = offer.status === "Zaakceptowana";

  // Moduł 30 — miękka podpowiedź o powiązaniu (patrz lib/links.ts). Na ofercie
  // waży to więcej niż na fakturze: to z niej lib/offerAccept.ts przepisuje
  // client_id na projekt i fakturę, więc oferta bez klienta rozsiewa brak
  // powiązania na całą dalszą drogę.
  const linkedClient = clients.find((c) => c.id === offer.client_id) ?? null;
  const linkStatus = clientLinkStatus(
    { client_id: offer.client_id, klient_nazwa: offer.klient_nazwa, klient_nip: offer.klient_nip },
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
          Oferty / <span className="text-[var(--fg)]">{offer.tytul || "(bez tytułu)"}</span>
          <ClientLinkChip clientId={offer.client_id} lang={lang} />
        </span>
        <div className="flex items-center gap-3">
          <SaveIndicator state={saveState} />
          <a
            href={`/${lang}/admin/offers/${id}/print`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-full border hairline px-2.5 py-1 text-xs text-muted hover:text-[var(--fg)]"
          >
            <IconExternalLink size={13} /> Podgląd
          </a>
          <button onClick={onClose} className="flex items-center gap-1 rounded-full border hairline px-2.5 py-1 text-xs text-muted hover:text-[var(--fg)]">
            <IconX size={13} /> Zamknij
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 space-y-4">
          <div className="card-paper rounded-xl border hairline p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-[13px] font-medium">Oferta</h2>
              <ClientLinkPicker
                clients={clients}
                clientId={offer.client_id}
                onPick={pickClient}
                onCreate={createClientFromBuyer}
              />
            </div>
            {linkHint && <LinkHint text={linkHint} />}
            <input
              value={offer.tytul}
              onChange={(e) => setOffer((p) => (p ? { ...p, tytul: e.target.value } : p))}
              onBlur={(e) => patchOffer({ tytul: e.target.value })}
              placeholder="Tytuł oferty"
              className="mb-2 w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
            />
            <input
              value={offer.klient_nazwa}
              onChange={(e) => setOffer((p) => (p ? { ...p, klient_nazwa: e.target.value } : p))}
              onBlur={(e) => patchOffer({ klient_nazwa: e.target.value })}
              placeholder="Nazwa klienta / firmy"
              className="mb-2 w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
            />
            <div className="mb-2 flex gap-1.5">
              <input
                value={offer.klient_nip}
                onChange={(e) => setOffer((p) => (p ? { ...p, klient_nip: e.target.value } : p))}
                onBlur={(e) => patchOffer({ klient_nip: e.target.value })}
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
            <input
              value={offer.klient_email}
              onChange={(e) => setOffer((p) => (p ? { ...p, klient_email: e.target.value } : p))}
              onBlur={(e) => patchOffer({ klient_email: e.target.value })}
              placeholder="E-mail klienta (do wysyłki oferty)"
              className="mb-2 w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
            />
            <input
              value={offer.klient_ulica}
              onChange={(e) => setOffer((p) => (p ? { ...p, klient_ulica: e.target.value } : p))}
              onBlur={(e) => patchOffer({ klient_ulica: e.target.value })}
              placeholder="Ulica i numer"
              className="mb-2 w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
            />
            <div className="grid grid-cols-[100px_1fr] gap-2">
              <input
                value={offer.klient_kod}
                onChange={(e) => setOffer((p) => (p ? { ...p, klient_kod: e.target.value } : p))}
                onBlur={(e) => patchOffer({ klient_kod: e.target.value })}
                placeholder="Kod pocztowy"
                className="rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
              />
              <input
                value={offer.klient_miasto}
                onChange={(e) => setOffer((p) => (p ? { ...p, klient_miasto: e.target.value } : p))}
                onBlur={(e) => patchOffer({ klient_miasto: e.target.value })}
                placeholder="Miasto"
                className="rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
              />
            </div>
            <input
              value={offer.klient_kraj}
              onChange={(e) => setOffer((p) => (p ? { ...p, klient_kraj: e.target.value } : p))}
              onBlur={(e) => patchOffer({ klient_kraj: e.target.value })}
              placeholder="Kraj (dla klientów zagranicznych)"
              className="mt-2 w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
            />
            {offer.klient_adres && !offer.klient_ulica && !offer.klient_miasto && (
              <p className="mt-2 whitespace-pre-line rounded-lg bg-[var(--hairline)]/40 px-2.5 py-1.5 text-[11px] text-muted">
                Stary adres (sprzed rozbicia na pola): {offer.klient_adres}
              </p>
            )}
          </div>

          <div className="card-paper rounded-xl border hairline p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[13px] font-medium">Pozycje</h2>
              <div className="flex items-center gap-1.5">
                {templates.length > 0 && (
                  <Popover
                    align="right"
                    width={260}
                    trigger={(open) => (
                      <button
                        onClick={open}
                        disabled={applyingTemplate}
                        className="flex items-center gap-1 rounded-full border hairline px-3 py-1 text-xs text-muted hover:text-[var(--fg)] disabled:opacity-50"
                      >
                        {applyingTemplate ? <IconLoader2 size={13} className="animate-spin" /> : <IconLayoutGrid size={13} />}
                        Wstaw z szablonu
                      </button>
                    )}
                  >
                    {(close) => (
                      <div>
                        {templates.map((t) => (
                          <MenuRow
                            key={t.id}
                            label={`${t.nazwa || "(bez nazwy)"} — ${formatMoney(templateTotal(t.pozycje))}`}
                            onClick={() => {
                              close();
                              applyTemplate(t.id);
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </Popover>
                )}
                <button onClick={addItem} className="rounded-full border hairline px-3 py-1 text-xs">
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
                  <span className="w-12 text-right">Ilość</span>
                  <span className="w-24 text-right">Cena</span>
                  <span className="w-24 text-right">Kwota</span>
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
                      value={it.cena}
                      onChange={(e) => setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, cena: Number(e.target.value) } : x)))}
                      onBlur={(e) => patchItem(it.id, { cena: Number(e.target.value) })}
                      className="w-24 rounded-md border hairline bg-transparent px-1.5 py-1 text-right text-[13px] text-[var(--fg)]"
                    />
                    <span className="w-24 text-right text-[13px] tabular-nums">{formatMoney(itemKwota(it))}</span>
                    <button onClick={() => deleteItem(it.id)} className="flex w-5 justify-center text-muted hover:text-red-400" title="Usuń pozycję">
                      <IconTrash size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 flex flex-col items-end gap-0.5 border-t hairline pt-3 text-[13px]">
              <div className="flex w-48 justify-between font-semibold">
                <span>Kwota oferty</span>
                <span className="tabular-nums text-[var(--fg)]">{formatMoney(total)}</span>
              </div>
            </div>
          </div>

          <div className="card-paper rounded-xl border hairline p-4">
            <h2 className="mb-2 text-[13px] font-medium">Uwagi</h2>
            <textarea
              value={offer.uwagi}
              onChange={(e) => setOffer((p) => (p ? { ...p, uwagi: e.target.value } : p))}
              onBlur={(e) => patchOffer({ uwagi: e.target.value })}
              rows={2}
              placeholder="np. Zakres, warunki płatności, uwagi dla klienta."
              className="w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="card-paper rounded-xl border hairline p-4">
            <h3 className="mb-2 text-[11px] uppercase tracking-wide text-muted">Dokument</h3>
            <Field label="Język">
              <PropertyMenu
                value={offer.jezyk}
                options={OFFER_LANGS.map((l) => ({ value: l, label: `${l.toUpperCase()} — ${OFFER_LANG_LABEL[l]}` }))}
                onChange={(v) => patchOffer({ jezyk: v })}
                title="Język wydruku oferty"
                full
              >
                <span className="text-[13px] text-[var(--fg)] hover:bg-[var(--hairline)] rounded-md px-1.5 py-1 -mx-1.5">
                  {offer.jezyk.toUpperCase()} — {OFFER_LANG_LABEL[offer.jezyk]}
                </span>
              </PropertyMenu>
            </Field>
          </div>

          <div className="card-paper rounded-xl border hairline p-4">
            <h3 className="mb-2 text-[11px] uppercase tracking-wide text-muted">Ważność</h3>
            <Field label="Ważna do">
              <DateField value={offer.wazna_do ?? ""} onChange={(v) => patchOffer({ wazna_do: v || null })} placeholder="—" />
            </Field>
          </div>

          {accepted ? (
            <div className="card-paper rounded-xl border hairline p-3 text-center text-[12px] text-muted">
              Zaakceptowana
              {offer.project_id && (
                <>
                  {" "}
                  —{" "}
                  <a href={`/${lang}/admin/projects/${offer.project_id}`} className="text-[var(--fg)] underline">
                    projekt
                  </a>
                </>
              )}
              {offer.invoice_id && (
                <>
                  {" "}
                  ·{" "}
                  <a href={`/${lang}/admin/invoices`} className="text-[var(--fg)] underline">
                    faktura
                  </a>
                </>
              )}
              {offer.accepted_by_name && (
                <div className="mt-1 text-[11px] text-muted">
                  Zaakceptowano samodzielnie przez klienta: {offer.accepted_by_name}, {formatPlDate(offer.accepted_at)}
                </div>
              )}
              <button
                onClick={generateContract}
                disabled={generatingContract}
                className="btn-primary mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generatingContract ? <IconLoader2 size={15} className="animate-spin" /> : null}
                Wygeneruj umowę
              </button>
            </div>
          ) : (
            <Popover
              width={248}
              trigger={(open) => (
                <button
                  onClick={open}
                  disabled={accepting || items.length === 0}
                  className="btn-primary flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {accepting ? <IconLoader2 size={15} className="animate-spin" /> : <IconCheck size={15} />}
                  Akceptuj ofertę
                  <IconChevronDown size={14} className="opacity-70" />
                </button>
              )}
            >
              {(close) => (
                <div>
                  <MenuRow
                    label="Bez projektu — tylko faktura"
                    onClick={() => {
                      close();
                      accept();
                    }}
                  />
                  <MenuDivider />
                  <MenuLabel>Utwórz projekt z szablonu</MenuLabel>
                  {PROJECT_TEMPLATES.map((t) => (
                    <MenuRow
                      key={t.id}
                      icon={<span className="text-[13px] leading-none">{t.emoji}</span>}
                      label={t.name}
                      onClick={() => {
                        close();
                        accept(t.id);
                      }}
                    />
                  ))}
                </div>
              )}
            </Popover>
          )}

          <button
            onClick={sendOfferEmail}
            disabled={sending || !offer.klient_email}
            title={offer.klient_email ? "Wyślij link do oferty na e-mail klienta" : "Uzupełnij e-mail klienta"}
            className="flex w-full items-center justify-center gap-1.5 rounded-full border hairline px-3 py-1.5 text-xs text-muted hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? <IconLoader2 size={13} className="animate-spin" /> : <IconMail size={13} />}
            Wyślij mailem
          </button>

          <ShareLinkControl
            kind="offer"
            id={id}
            hasToken={!!offer.share_token}
            revokedAt={offer.share_revoked_at}
            etykieta="tej oferty"
            onChanged={(revokedAt) => setOffer((p) => (p ? { ...p, share_revoked_at: revokedAt } : p))}
          />

          <button
            onClick={duplicateOffer}
            disabled={duplicating}
            className="flex w-full items-center justify-center gap-1.5 rounded-full border hairline px-3 py-1.5 text-xs text-muted hover:text-[var(--fg)] disabled:opacity-50"
          >
            {duplicating ? <IconLoader2 size={13} className="animate-spin" /> : <IconCopy size={13} />}
            Duplikuj ofertę
          </button>

          <button onClick={remove} className="w-full rounded-full border hairline px-3 py-1.5 text-xs text-red-400">
            Usuń ofertę
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
