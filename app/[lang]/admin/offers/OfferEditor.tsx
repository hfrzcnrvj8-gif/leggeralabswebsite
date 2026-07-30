"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconPlus, IconSquare, IconSquareCheck, IconX, IconTrash, IconCheck, IconLoader2, IconChevronDown, IconChevronUp, IconExternalLink, IconMail, IconCopy, IconVersions, IconLink, IconSearch, IconLayoutGrid, IconBox } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import {
  type Offer,
  type OfferItem,
  type OfferSection,
  OFFER_LANGS,
  OFFER_LANG_LABEL,
  OFFER_STATUSES,
  OFFER_STATUS_CLASS,
  OFFER_CURRENCIES,
  SEKCJE_STARTOWE,
  WAZNOSC_SKROTY,
  DEFAULT_OFFER_CURRENCY,
  isOfferExpired,
  rejectReasonLabel,
  offerTotal,
  offerOptionalRest,
  obliczZwrot,
  itemKwota,
} from "@/lib/offers";
import { CONTRACT_STATUS_CLASS } from "@/lib/contracts";
import { SekcjaProfilu, WierszPola } from "../ProfileSection";
import { Modal } from "../Modal";
import { OknoOdrzucenia } from "./RejectDialog";
import { type OfferTemplate, templateTotal } from "@/lib/offerTemplates";
import { formatMoney, type CatalogItem } from "@/lib/invoices";
import { hasPriceRange } from "@/lib/catalog";
import { CatalogCategoryIcon } from "../icons";
import { PROJECT_TEMPLATES, formatPlDate } from "@/lib/projects";
import { formatPlDateTime, todayLocalISO, daysBetweenISO } from "@/lib/dates";
import { addDaysISO } from "@/lib/documents";
import { useUI } from "../ui";
import { DateField } from "../DatePicker";
import { Popover, MenuRow, MenuDivider, MenuLabel, PropertyMenu, useContextMenu, ContextMenu, ContextMenuItem } from "../Menu";
import { Tooltip } from "../Tooltip";
import { ClientLinkChip, ClientLinkPicker, LinkHint } from "../components";
import { ShareLinkControl } from "../ShareLinkControl";
import { invalidateLinkTargets } from "../LinkPicker";
import { MiniSciezka } from "../MiniSciezka";
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
  const { toast, confirm, prompt } = useUI();
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
  /** Prawy przycisk na bloku treści (zgłoszenie właściciela 2026-07-27:
   * „w takich miejscach aż się prosi o menu pod prawym"). Wszystko, co tu
   * jest, da się też zrobić widocznymi ikonami — menu jest skrótem, nie
   * jedyną drogą. */
  const ctxSekcji = useContextMenu<{ sekcja: OfferSection; i: number }>();
  /** Umowa wygenerowana z tej oferty — `null`, dopóki jej nie ma. Przychodzi
   * z `GET /api/offers/:id`, żeby karta WIEDZIAŁA, że dokument już istnieje
   * (patrz komentarz przy tej trasie). */
  const [contract, setContract] = useState<{ id: string; status: string } | null>(null);
  /** Okno „dlaczego odrzucona" — status zmienia się dopiero po wyborze powodu. */
  const [rejectOpen, setRejectOpen] = useState(false);
  const [versioning, setVersioning] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [copyingLink, setCopyingLink] = useState(false);
  /** Bloki treści oferty — „Kontekst", „Zakres prac", „Harmonogram". */
  const [sections, setSections] = useState<OfferSection[]>([]);

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
    const data = (await res.json()) as {
      offer: Offer;
      items: OfferItem[];
      sections: OfferSection[];
      contract: { id: string; status: string } | null;
    };
    setOffer(data.offer);
    setItems(data.items);
    setSections(data.sections ?? []);
    setContract(data.contract ?? null);
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

  // Katalog komponentów (Moduł 47) — wczytany raz, do składania oferty z
  // klocków. Cena bazowa (`cena_netto`) i jednostka wpadają na pozycję; koszt
  // zakupu/marża z katalogu tu NIE wchodzą (pozycja to niezależna kopia).
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  useEffect(() => {
    let anulowane = false;
    fetch("/api/catalog")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => {
        if (!anulowane) setCatalog((d as { items: CatalogItem[] }).items ?? []);
      })
      .catch(() => {});
    return () => {
      anulowane = true;
    };
  }, []);

  const addFromCatalog = useCallback(
    async (c: CatalogItem) => {
      const res = await fetch(`/api/offers/${id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nazwa: c.nazwa, cena: c.cena_netto, jednostka: c.jednostka }),
      });
      if (!res.ok) {
        toast("Nie udało się wstawić z katalogu.", "error");
        return;
      }
      const data = (await res.json()) as { items: OfferItem[] };
      setItems(data.items);
      onChange?.();
    },
    [id, onChange, toast]
  );

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
      const data = (await res.json()) as { items: OfferItem[]; sections: OfferSection[]; offer: Offer };
      setItems(data.items);
      setSections(data.sections ?? []);
      setOffer(data.offer);
      onChange?.();
      toast("Wstawiono pozycje z szablonu.");
    },
    [id, toast, onChange]
  );

  const addSection = useCallback(
    async (tytul = "", tresc = "") => {
      const res = await fetch(`/api/offers/${id}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tytul, tresc }),
      });
      if (!res.ok) {
        toast("Nie udało się dodać sekcji.", "error");
        return;
      }
      const data = (await res.json()) as { sections: OfferSection[] };
      setSections(data.sections);
    },
    [id, toast]
  );

  const patchSection = useCallback(
    async (sectionId: string, patch: Partial<OfferSection>) => {
      setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)));
      setSaveState("saving");
      const res = await fetch(`/api/offers/${id}/sections/${sectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) flashSaved();
      else setSaveState("idle");
    },
    [id, flashSaved]
  );

  const deleteSection = useCallback(
    async (sectionId: string) => {
      setSections((prev) => prev.filter((s) => s.id !== sectionId));
      await fetch(`/api/offers/${id}/sections/${sectionId}`, { method: "DELETE" });
    },
    [id]
  );

  /** Zamiana miejscami z sąsiadem. Strzałki zamiast przeciągania — sekcji jest
   * kilka, a przeciąganie w modalu walczy z przewijaniem karty. */
  const moveSection = useCallback(
    async (index: number, kierunek: -1 | 1) => {
      const cel = index + kierunek;
      if (cel < 0 || cel >= sections.length) return;
      const a = sections[index];
      const b = sections[cel];
      const next = [...sections];
      next[index] = b;
      next[cel] = a;
      setSections(next.map((s, i) => ({ ...s, position: i })));
      await Promise.all([
        fetch(`/api/offers/${id}/sections/${a.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position: cel }),
        }),
        fetch(`/api/offers/${id}/sections/${b.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position: index }),
        }),
      ]);
    },
    [id, sections]
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

  /** Zamiana pozycji miejscami — strzałki, nie przeciąganie (ten sam powód
   * co przy sekcjach: przeciąganie w modalu walczy z przewijaniem karty).
   * Kolejność pozycji jest treścią oferty: klient czyta ją z góry na dół,
   * a najdroższa rzecz rzadko ma stać na końcu. */
  const moveItem = useCallback(
    async (index: number, kierunek: -1 | 1) => {
      const cel = index + kierunek;
      if (cel < 0 || cel >= items.length) return;
      const a = items[index];
      const b = items[cel];
      const next = [...items];
      next[index] = b;
      next[cel] = a;
      setItems(next.map((it, i) => ({ ...it, position: i })));
      await Promise.all([
        fetch(`/api/offers/${id}/items/${a.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position: cel }),
        }),
        fetch(`/api/offers/${id}/items/${b.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position: index }),
        }),
      ]);
      onChange?.();
    },
    [id, items, onChange]
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

  /** Zmiana statusu z profilu. Do Modułu 57 status dało się ruszyć WYŁĄCZNIE
   * z listy — profil nie pokazywał go nawet do odczytu. „Odrzucona" idzie
   * przez osobne okno, bo bez powodu odrzucenie nie zostawia nic, z czego
   * dałoby się kiedyś wyczytać, na czym przegrywamy. */
  const changeStatus = useCallback(
    async (status: string) => {
      if (status === "Odrzucona") {
        setRejectOpen(true);
        return;
      }
      await patchOffer({ status: status as Offer["status"] });
    },
    [patchOffer]
  );

  const rejectOffer = useCallback(
    async (powod: string, komentarz: string) => {
      setRejectOpen(false);
      setOffer((p) =>
        p ? { ...p, status: "Odrzucona", powod_odrzucenia: powod, komentarz_odrzucenia: komentarz } : p
      );
      setSaveState("saving");
      const res = await fetch(`/api/offers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Odrzucona", powod_odrzucenia: powod, komentarz_odrzucenia: komentarz }),
      });
      if (!res.ok) {
        setSaveState("idle");
        toast("Nie udało się zapisać.", "error");
        return;
      }
      flashSaved();
      onChange?.();
      await load();
    },
    [id, flashSaved, onChange, toast, load]
  );

  /** Nowa WERSJA oferty (runda 2 Modułu 57) — w odróżnieniu od duplikatu
   * zostaje powiązana z poprzedniczką, a ta wypada z liczników. */
  const newVersion = useCallback(async () => {
    const ok = await confirm(
      "Zrobić nową wersję tej oferty? Obecna zostanie oznaczona jako zastąpiona (wypadnie ze skuteczności i z pipeline'u), a Ty dostaniesz jej kopię jako świeży szkic.",
      {}
    );
    if (!ok) return;
    setVersioning(true);
    const res = await fetch(`/api/offers/${id}/version`, { method: "POST" });
    setVersioning(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      toast(data.error ?? "Nie udało się utworzyć wersji.", "error");
      return;
    }
    const data = (await res.json()) as { id: string; wersja: number };
    toast(`Utworzono wersję ${data.wersja}.`);
    onChange?.();
    window.location.href = `/${lang}/admin/offers/${data.id}`;
  }, [id, lang, confirm, toast, onChange]);

  /** „Zapisz tę ofertę jako szablon" — pozycje, sekcje i uwagi lądują
   * w bibliotece szablonów (otwarte pytanie z briefu Modułu 20). */
  const saveAsTemplate = useCallback(async () => {
    const nazwa = await prompt("Nazwa szablonu", { placeholder: offer?.tytul || "np. Wdrożenie automatyzacji" });
    if (!nazwa || !nazwa.trim()) return;
    setSavingTemplate(true);
    const res = await fetch("/api/offer-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nazwa: nazwa.trim(), from_offer_id: id }),
    });
    setSavingTemplate(false);
    if (!res.ok) {
      toast("Nie udało się zapisać szablonu.", "error");
      return;
    }
    const lista = await fetch("/api/offer-templates").then((r) => (r.ok ? r.json() : { templates: [] }));
    setTemplates((lista.templates ?? []) as OfferTemplate[]);
    toast(`Zapisano szablon „${nazwa.trim()}".`);
  }, [id, offer?.tytul, prompt, toast]);

  /** „Kopiuj link dla klienta" — adres publicznej strony oferty, ten sam,
   * który idzie mailem. Do 2026-07-27 nie dało się go zdobyć inaczej niż
   * wysyłając maila z panelu: token powstawał dopiero przy wysyłce, a jedyna
   * trasa („wygeneruj nowy") UNIEWAŻNIAŁA poprzedni. Kto chciał wkleić link do
   * własnej wiadomości albo na czacie, nie miał czego skopiować. */
  const copyClientLink = useCallback(async () => {
    // Szkic NIE jest widoczny pod publicznym linkiem (patrz
    // `app/api/offers/public/[token]` — `status != 'Szkic'`), więc skopiowanie
    // adresu szkicu daje klientowi „nie znaleziono oferty". Pierwsza wersja
    // tylko ostrzegała PO skopiowaniu — i właściciel i tak wkleił martwy link
    // (zgłoszenie 2026-07-27). Teraz pytamy PRZED, a zgoda od razu zdejmuje
    // przyczynę: status „Wysłana" znaczy dokładnie „poszła do klienta", więc
    // ręczne wysłanie linku jest tym samym zdarzeniem co wysyłka mailem.
    if (offer?.status === "Szkic") {
      const ok = await confirm(
        "Ta oferta jest szkicem, a szkiców publiczny link nie pokazuje — klient zobaczyłby „nie znaleziono oferty”. Oznaczyć ją jako wysłaną i skopiować działający link?"
      );
      if (!ok) return;
      await patchOffer({ status: "Wysłana" });
    }
    setCopyingLink(true);
    const res = await fetch(`/api/share-links/offer/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ensure" }),
    });
    setCopyingLink(false);
    if (!res.ok) {
      toast("Nie udało się przygotować linku.", "error");
      return;
    }
    const data = (await res.json()) as { url: string; revokedAt: string | null };
    setOffer((p) => (p ? { ...p, share_token: p.share_token ?? "utworzony" } : p));
    if (data.revokedAt) {
      toast("Ten link jest unieważniony — wygeneruj nowy poniżej, zanim go wyślesz.", "error");
      return;
    }
    // `navigator.clipboard` potrafi CICHO odmówić (brak zgody, kontekst bez
    // HTTPS) — wtedy pokazujemy adres do ręcznego skopiowania zamiast udawać
    // sukces (ta sama pułapka co przy kodach zapasowych TOTP, Moduł 41).
    try {
      await navigator.clipboard.writeText(data.url);
      toast("Link dla klienta skopiowany.");
    } catch {
      await prompt("Skopiuj link ręcznie (Cmd/Ctrl+C):", { placeholder: data.url });
    }
  }, [id, offer?.status, confirm, patchOffer, prompt, toast]);

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
      // Serwer dedupuje (POST /api/contracts oddaje istniejącą umowę zamiast
      // robić drugą) — komunikat nie może więc twierdzić, że coś powstało,
      // skoro drugie kliknięcie tylko otwiera to, co już było.
      toast(contract ? "Umowa dla tej oferty już istnieje — otwieram ją." : "Wygenerowano umowę z oferty.");
      setContract((prev) => prev ?? { id: data.id, status: "Szkic" });
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
  // Ile klient może jeszcze dołożyć, klikając pozycje opcjonalne — potencjał
  // oferty widoczny obok jej dzisiejszej kwoty.
  const dodatki = offerOptionalRest(items);
  const accepted = offer.status === "Zaakceptowana";
  // Lista malowała przeterminowaną ofertę na czerwono, a profil pokazywał tę
  // samą datę na biało i świecił przyciskiem „Akceptuj ofertę" — dwa ekrany,
  // dwie różne odpowiedzi na pytanie „czy ta oferta jeszcze żyje".
  const expired = isOfferExpired(offer);
  const waluta = offer.waluta || DEFAULT_OFFER_CURRENCY;
  const powodOdrzucenia = rejectReasonLabel(offer.powod_odrzucenia ?? "", offer.komentarz_odrzucenia ?? "");
  // Treść wysłanej oferty jest zamknięta (decyzja właściciela 2026-07-27) —
  // regułę egzekwuje serwer (lib/blokadaDokumentu.ts), a edytor ma o niej
  // MÓWIĆ, zamiast pozwalać pisać w pola, które i tak odbiją się od trasy.
  const zablokowana = offer.status !== "Szkic";
  const dniDoWaznosci = offer.wazna_do ? daysBetweenISO(todayLocalISO(), offer.wazna_do) : null;
  const zwrot = obliczZwrot(offer, total);

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
        <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
          Oferty / <span className="text-[var(--fg)]">{offer.tytul || "(bez tytułu)"}</span>
          <ClientLinkChip clientId={offer.client_id} lang={lang} />
          <PropertyMenu
            value={offer.status}
            options={OFFER_STATUSES.map((s) => ({ value: s, label: s }))}
            onChange={changeStatus}
            title="Zmień status oferty"
          >
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${OFFER_STATUS_CLASS[offer.status] ?? ""}`}>
              {offer.status}
            </span>
          </PropertyMenu>
          {expired && (
            <span className="rounded-full bg-brand-gold/15 px-2.5 py-1 text-[11px] font-medium text-brand-gold">
              po terminie ważności
            </span>
          )}
          {offer.wersja > 1 && (
            <a
              href={offer.parent_offer_id ? `/${lang}/admin/offers/${offer.parent_offer_id}` : undefined}
              title="Zobacz poprzednią wersję"
              className="rounded-full bg-[var(--hairline)] px-2.5 py-1 text-[11px] font-medium text-muted hover:text-[var(--fg)]"
            >
              wersja {offer.wersja}
            </a>
          )}
          {offer.superseded_at && (
            <span className="rounded-full bg-[var(--hairline)] px-2.5 py-1 text-[11px] font-medium text-muted">
              zastąpiona nowszą wersją
            </span>
          )}
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

      {/* Karta ma stałą wysokość 85vh od `lg`, a kolumny przewijają się
          OSOBNO — ten sam wzorzec co profil klienta (Moduł 54, krok 6).
          Bez tego pełna szerokość dawała bardzo długą stronę, w której akcje
          po prawej uciekały poza ekran przy dłuższej liście pozycji. */}
      <MiniSciezka rodzaj="offer" id={id} lang={lang} />

      <div className="mt-4 grid gap-5 lg:h-[calc(85vh-88px)] lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Na bardzo szerokim ekranie kolumna treści dzieli się na dwie:
            dane klienta stoją obok treści i cennika, zamiast rozciągać pola
            formularza na tysiąc pikseli. Poniżej `2xl` układ jest jak dotąd. */}
        <div className="min-w-0 lg:h-full lg:overflow-y-auto lg:pr-2">
          <div className="space-y-4 2xl:grid 2xl:grid-cols-[minmax(340px,420px)_minmax(0,1fr)] 2xl:items-start 2xl:gap-5 2xl:space-y-0">
          <div className="space-y-4">
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
            {zablokowana && (
              <div className="mb-3 rounded-xl border border-brand-gold/40 bg-brand-gold/10 px-3 py-2 text-[12px] text-brand-gold">
                {accepted
                  ? "Oferta zaakceptowana — powstały z niej projekt i faktura, więc treść jest zamknięta na stałe."
                  : "Oferta jest u klienta pod tym samym linkiem, więc treści nie da się już zmienić. Potrzebujesz poprawki? Zrób nową wersję — poprzednia zostanie oznaczona jako zastąpiona."}
              </div>
            )}
            {/* Etykieta po lewej, wartość po prawej (Moduł 54, krok 6). Wcześniej
                było tu siedem pól rozpoznawalnych WYŁĄCZNIE po placeholderze —
                a placeholder znika, gdy pole ma treść, więc wypełniona oferta
                była stosem nieopisanych linijek. */}
            <SekcjaProfilu tytul="Dokument" className="mb-3">
              <WierszPola etykieta="Tytuł">
                <PoleTekstowe
                  value={offer.tytul}
                  onLocal={(v) => setOffer((p) => (p ? { ...p, tytul: v } : p))}
                  onSave={(v) => patchOffer({ tytul: v })}
                  placeholder="np. Oferta — wdrożenie asystenta AI"
                  disabled={zablokowana}
                />
              </WierszPola>
            </SekcjaProfilu>
            <SekcjaProfilu tytul="Klient">
              <WierszPola etykieta="Nazwa">
                <PoleTekstowe
                  value={offer.klient_nazwa}
                  onLocal={(v) => setOffer((p) => (p ? { ...p, klient_nazwa: v } : p))}
                  onSave={(v) => patchOffer({ klient_nazwa: v })}
                  placeholder="Nazwa firmy"
                  disabled={zablokowana}
                />
              </WierszPola>
              <WierszPola
                etykieta="NIP"
                title="Polski NIP → Biała Lista MF; numer z prefiksem kraju UE (np. DE, IE) → VIES"
                sufiks={
                  <button
                    onClick={lookupNip}
                    disabled={nipLoading}
                    title="Pobierz dane po NIP / VAT-UE"
                    className="flex shrink-0 items-center gap-1 rounded-md border hairline px-2 py-1 text-[11px] text-muted hover:text-[var(--fg)] disabled:opacity-50"
                  >
                    {nipLoading ? <IconLoader2 size={12} className="animate-spin" /> : <IconSearch size={12} />}
                    Szukaj
                  </button>
                }
              >
                <PoleTekstowe
                  value={offer.klient_nip}
                  onLocal={(v) => setOffer((p) => (p ? { ...p, klient_nip: v } : p))}
                  onSave={(v) => patchOffer({ klient_nip: v })}
                  placeholder="np. DE123456789"
                  disabled={zablokowana}
                />
              </WierszPola>
              <WierszPola etykieta="Email" title="Adres, na który idzie link do oferty">
                <PoleTekstowe
                  value={offer.klient_email}
                  onLocal={(v) => setOffer((p) => (p ? { ...p, klient_email: v } : p))}
                  onSave={(v) => patchOffer({ klient_email: v })}
                  placeholder="do wysyłki oferty"
                  disabled={zablokowana}
                />
              </WierszPola>
              <WierszPola etykieta="Ulica">
                <PoleTekstowe
                  value={offer.klient_ulica}
                  onLocal={(v) => setOffer((p) => (p ? { ...p, klient_ulica: v } : p))}
                  onSave={(v) => patchOffer({ klient_ulica: v })}
                  placeholder="ulica i numer"
                  disabled={zablokowana}
                />
              </WierszPola>
              <WierszPola etykieta="Kod / Miasto">
                <PoleTekstowe
                  value={offer.klient_kod}
                  onLocal={(v) => setOffer((p) => (p ? { ...p, klient_kod: v } : p))}
                  onSave={(v) => patchOffer({ klient_kod: v })}
                  placeholder="00-000"
                  className="w-[86px] shrink-0"
                  disabled={zablokowana}
                />
                <PoleTekstowe
                  value={offer.klient_miasto}
                  onLocal={(v) => setOffer((p) => (p ? { ...p, klient_miasto: v } : p))}
                  onSave={(v) => patchOffer({ klient_miasto: v })}
                  placeholder="miasto"
                  disabled={zablokowana}
                />
              </WierszPola>
              <WierszPola etykieta="Kraj" title="Wypełnij dla klienta zagranicznego — stąd bierze się stawka VAT szkicu faktury po akceptacji">
                <PoleTekstowe
                  value={offer.klient_kraj}
                  onLocal={(v) => setOffer((p) => (p ? { ...p, klient_kraj: v } : p))}
                  onSave={(v) => patchOffer({ klient_kraj: v })}
                  placeholder="pusty = Polska"
                  disabled={zablokowana}
                />
              </WierszPola>
            </SekcjaProfilu>
            {offer.klient_adres && !offer.klient_ulica && !offer.klient_miasto && (
              <p className="mt-2 whitespace-pre-line rounded-lg bg-hairline/40 px-2.5 py-1.5 text-[11px] text-muted">
                Stary adres (sprzed rozbicia na pola): {offer.klient_adres}
              </p>
            )}
          </div>

          </div>

          <div className="space-y-4">
          {/* Bloki treści (runda 2 Modułu 57). Stoją NAD pozycjami, bo klient
              ma najpierw przeczytać, co dostaje, a dopiero potem zobaczyć cenę
              — tak układają ofertę PandaDoc, Proposify i Qwilr. */}
          <div className="card-paper rounded-xl border hairline p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-[13px] font-medium">Treść oferty</h2>
              <div className={`flex items-center gap-1.5 ${zablokowana ? "hidden" : ""}`}>
                <Popover
                  align="right"
                  width={220}
                  trigger={(open) => (
                    <button onClick={open} className="rounded-full border hairline px-3 py-1 text-xs text-muted hover:text-[var(--fg)]">
                      + Gotowa sekcja
                    </button>
                  )}
                >
                  {(close) => (
                    <div>
                      {/* Podpowiedź stoi TU, w panelu — nie w treści, która
                          idzie do klienta. */}
                      {SEKCJE_STARTOWE.map((sekcja: { tytul: string; tresc: string; podpowiedz: string }) => (
                        <button
                          key={sekcja.tytul}
                          onClick={() => {
                            close();
                            addSection(sekcja.tytul, sekcja.tresc);
                          }}
                          className="block w-full px-2.5 py-1.5 text-left hover:bg-[var(--hairline)]"
                        >
                          <span className="block text-[13px] text-[var(--fg)]">{sekcja.tytul}</span>
                          <span className="mt-0.5 block text-[11px] leading-snug text-muted">{sekcja.podpowiedz}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </Popover>
                <button onClick={() => addSection()} className="rounded-full border hairline px-3 py-1 text-xs">
                  + Pusta
                </button>
              </div>
            </div>
            {sections.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted opacity-70">
                Bez sekcji oferta jest samym cennikiem. Dodaj „Kontekst” albo „Zakres prac”, żeby klient
                wiedział, co kupuje, zanim spojrzy na kwotę.
              </p>
            ) : (
              <div className="space-y-2">
                {sections.map((sekcja, i) => (
                  <div
                    key={sekcja.id}
                    onContextMenu={(e) => ctxSekcji.openAt(e, { sekcja, i })}
                    className="card-inset rounded-lg p-2.5"
                  >
                    <div className="mb-1 flex items-center gap-1.5">
                      <input
                        value={sekcja.tytul}
                        onChange={(e) => setSections((prev) => prev.map((x) => (x.id === sekcja.id ? { ...x, tytul: e.target.value } : x)))}
                        onBlur={(e) => patchSection(sekcja.id, { tytul: e.target.value })}
                        placeholder="Nagłówek sekcji"
                        className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[13px] font-medium text-[var(--fg)] placeholder:text-muted hover:border-[var(--hairline)] focus:border-[var(--hairline)] focus:outline-none"
                      />
                      <button onClick={() => moveSection(i, -1)} disabled={i === 0} className="text-muted disabled:opacity-30" title="W górę">
                        <IconChevronUp size={13} />
                      </button>
                      <button onClick={() => moveSection(i, 1)} disabled={i === sections.length - 1} className="text-muted disabled:opacity-30" title="W dół">
                        <IconChevronDown size={13} />
                      </button>
                      <button onClick={() => deleteSection(sekcja.id)} className="text-muted hover:text-red-400" title="Usuń sekcję">
                        <IconTrash size={13} />
                      </button>
                    </div>
                    <textarea
                      value={sekcja.tresc}
                      onChange={(e) => setSections((prev) => prev.map((x) => (x.id === sekcja.id ? { ...x, tresc: e.target.value } : x)))}
                      onBlur={(e) => patchSection(sekcja.id, { tresc: e.target.value })}
                      rows={3}
                      placeholder="Treść, którą przeczyta klient."
                      className="w-full rounded-md border hairline bg-transparent px-2 py-1.5 text-[12.5px] text-[var(--fg)] placeholder:text-muted"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card-paper rounded-xl border hairline p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[13px] font-medium">Pozycje</h2>
              <div className="flex items-center gap-1.5">
                {!zablokowana && templates.length > 0 && (
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
                {!zablokowana && catalog.length > 0 && (
                  <Popover
                    align="right"
                    width={300}
                    trigger={(open) => (
                      <button
                        onClick={open}
                        className="flex items-center gap-1 rounded-full border hairline px-3 py-1 text-xs text-muted hover:text-[var(--fg)]"
                      >
                        <IconBox size={13} /> Z katalogu
                      </button>
                    )}
                  >
                    {(close) => (
                      <OfferCatalogPickerBody
                        catalog={catalog}
                        onPick={(c) => {
                          close();
                          addFromCatalog(c);
                        }}
                      />
                    )}
                  </Popover>
                )}
                {!zablokowana && (
                  <button onClick={addItem} className="rounded-full border hairline px-3 py-1 text-xs">
                    + Pozycja
                  </button>
                )}
              </div>
            </div>

            {items.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted opacity-60">Brak pozycji — dodaj pierwszą.</p>
            ) : (
              <div className="space-y-1.5">
                <div className="flex gap-1.5 px-1 text-[10px] uppercase tracking-wide text-muted">
                  <span className="w-4 shrink-0" />
                  <span className="flex-1">Nazwa</span>
                  <span className="w-12 text-right">Ilość</span>
                  <span className="w-24 text-right">Cena</span>
                  <span className="w-24 text-right">Kwota</span>
                  <Tooltip label="Pozycja do wyboru przez klienta">
                    <span className="w-5 text-center">?</span>
                  </Tooltip>
                  <span className="w-5" />
                </div>
                {items.map((it, i) => (
                  <div key={it.id} className="flex items-center gap-1.5">
                    <span className="flex w-4 shrink-0 flex-col">
                      <button
                        onClick={() => moveItem(i, -1)}
                        disabled={i === 0}
                        title="W górę"
                        className="text-muted hover:text-[var(--fg)] disabled:opacity-25"
                      >
                        <IconChevronUp size={11} />
                      </button>
                      <button
                        onClick={() => moveItem(i, 1)}
                        disabled={i === items.length - 1}
                        title="W dół"
                        className="text-muted hover:text-[var(--fg)] disabled:opacity-25"
                      >
                        <IconChevronDown size={11} />
                      </button>
                    </span>
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
                    <span
                      className={`w-24 text-right text-[13px] tabular-nums ${
                        it.opcjonalna && !it.wybrana ? "text-muted line-through opacity-60" : ""
                      }`}
                    >
                      {formatMoney(itemKwota(it), waluta)}
                    </span>
                    {/* „Do wyboru" — klient odhacza tę pozycję sam na stronie
                        z ofertą (runda 2 Modułu 57). Pozwala sprzedać wariant
                        bez pisania drugiej oferty. */}
                    <button
                      onClick={() => patchItem(it.id, { opcjonalna: !it.opcjonalna, wybrana: false })}
                      title={it.opcjonalna ? "Pozycja do wyboru przez klienta — kliknij, żeby uczynić ją obowiązkową" : "Uczyń pozycją do wyboru przez klienta"}
                      className={`flex w-5 justify-center ${it.opcjonalna ? "text-brand-cyan" : "text-muted hover:text-[var(--fg)]"}`}
                    >
                      {it.opcjonalna ? <IconSquareCheck size={13} /> : <IconSquare size={13} />}
                    </button>
                    <button onClick={() => deleteItem(it.id)} className="flex w-5 justify-center text-muted hover:text-red-400" title="Usuń pozycję">
                      <IconTrash size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 flex flex-col items-end gap-0.5 border-t hairline pt-3 text-[13px]">
              <div className="flex w-56 justify-between font-semibold">
                <span>Kwota oferty</span>
                <span className="tabular-nums text-[var(--fg)]">{formatMoney(total, waluta)}</span>
              </div>
              {dodatki > 0 && (
                <div className="flex w-56 justify-between text-[11.5px] text-muted">
                  <span>Dodatki do wyboru</span>
                  <span className="tabular-nums">+ {formatMoney(dodatki, waluta)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="card-paper rounded-xl border hairline p-4">
            <h2 className="mb-2 text-[13px] font-medium">Uwagi</h2>
            <textarea
              value={offer.uwagi}
              onChange={(e) => setOffer((p) => (p ? { ...p, uwagi: e.target.value } : p))}
              onBlur={(e) => patchOffer({ uwagi: e.target.value })}
              rows={2}
              disabled={zablokowana}
              placeholder="np. Zakres, warunki płatności, uwagi dla klienta."
              className="w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
            />
          </div>
          </div>
          </div>
        </div>

        <div className="space-y-4 lg:h-full lg:overflow-y-auto lg:pr-1">
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
            <Field label="Waluta">
              <PropertyMenu
                value={waluta}
                options={OFFER_CURRENCIES.map((c) => ({ value: c, label: c }))}
                onChange={(v) => patchOffer({ waluta: v as Offer["waluta"] })}
                title="Waluta oferty — przeniesie się na fakturę po akceptacji"
                full
              >
                <span className="text-[13px] text-[var(--fg)] hover:bg-[var(--hairline)] rounded-md px-1.5 py-1 -mx-1.5">
                  {waluta}
                </span>
              </PropertyMenu>
            </Field>
          </div>

          <div className="card-paper rounded-xl border hairline p-4">
            <h3 className="mb-2 text-[11px] uppercase tracking-wide text-muted">Ważność</h3>
            <Field label="Ważna do">
              <DateField
                value={offer.wazna_do ?? ""}
                onChange={(v) => patchOffer({ wazna_do: v || null })}
                placeholder="bez terminu"
              />
            </Field>
            {/* Gotowe okresy. Datę ważności ustawia się przy KAŻDEJ ofercie,
                zawsze jako „dziś + tydzień/dwa" — wybieranie jej z koła dat
                było najczęstszym drobnym tarciem w tym module (zgłoszenie
                właściciela). Liczone od DZIŚ, nie od daty wystawienia: oferta
                bywa wysyłana kilka dni po napisaniu. */}
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {WAZNOSC_SKROTY.map((dni: number) => {
                const cel = addDaysISO(null, dni);
                const aktywny = offer.wazna_do === cel;
                return (
                  <button
                    key={dni}
                    onClick={() => patchOffer({ wazna_do: aktywny ? null : cel })}
                    title={`Ważna do ${formatPlDate(cel)}`}
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
                      aktywny
                        ? "border-brand-purple/60 bg-brand-purple/10 text-[var(--fg)]"
                        : "hairline text-muted hover:text-[var(--fg)]"
                    }`}
                  >
                    {dni} dni
                  </button>
                );
              })}
              {offer.wazna_do && (
                <button
                  onClick={() => patchOffer({ wazna_do: null })}
                  className="rounded-full border hairline px-2.5 py-0.5 text-[11px] text-muted hover:text-[var(--fg)]"
                >
                  Wyczyść
                </button>
              )}
            </div>
            {offer.wazna_do && !expired && (
              <p className="mt-1.5 text-[11px] text-muted">
                {dniDoWaznosci === 0
                  ? "Wygasa dziś."
                  : dniDoWaznosci === 1
                    ? "Wygasa jutro."
                    : `Wygasa za ${dniDoWaznosci} dni.`}
              </p>
            )}
            {expired && (
              <p className="mt-2 rounded-lg bg-brand-gold/10 px-2.5 py-1.5 text-[11px] text-brand-gold">
                Termin ważności minął, a oferta wciąż jest otwarta. Przedłuż datę albo zamknij ją statusem
                „Wygasła” — do tego czasu liczy się do pipeline’u jak żywa.
              </p>
            )}
          </div>

          {/* Ślad otwarcia (runda 2 Modułu 57) — odpowiedź na pytanie, które
              przed tą rundą nie miało gdzie paść: „czy on to w ogóle
              przeczytał". Pokazujemy dopiero po wysłaniu; przy szkicu nie ma
              o czym mówić. */}
          {offer.status !== "Szkic" && (
            <div className="card-paper rounded-xl border hairline p-4">
              <h3 className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">Klient</h3>
              {offer.otwarta_at ? (
                <>
                  <p className="text-[12.5px] text-[var(--fg)]">
                    Otworzył ofertę {offer.liczba_otwarc}×
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    pierwszy raz {formatPlDateTime(offer.otwarta_at)}
                    {offer.ostatnio_otwarta_at && offer.liczba_otwarc > 1
                      ? `, ostatnio ${formatPlDateTime(offer.ostatnio_otwarta_at)}`
                      : ""}
                  </p>
                </>
              ) : (
                <p className="text-[12.5px] text-muted">
                  Jeszcze nie otworzył linku z ofertą.
                </p>
              )}
              {offer.przypomniano_at && (
                <p className="mt-1 text-[11px] text-muted">
                  Przypomniano {formatPlDateTime(offer.przypomniano_at)}
                </p>
              )}
            </div>
          )}

          {/* Wyliczenie zwrotu (runda 3). Dwie liczby, resztę liczy dokument —
              i mówi klientowi wprost, że to szacunek. Puste = blok nie
              pojawia się na ofercie w ogóle. */}
          <div className="card-paper rounded-xl border hairline p-4">
            <h3 className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">Zwrot dla klienta</h3>
            <Field label="Godzin / mies.">
              <input
                type="number"
                min={0}
                value={offer.roi_godziny || ""}
                onChange={(e) => setOffer((p) => (p ? { ...p, roi_godziny: Number(e.target.value) } : p))}
                onBlur={(e) => patchOffer({ roi_godziny: Number(e.target.value) || 0 })}
                placeholder="0"
                className="w-20 rounded-md border hairline bg-transparent px-1.5 py-1 text-right text-[13px] text-[var(--fg)]"
              />
            </Field>
            <Field label="Stawka / h">
              <input
                type="number"
                min={0}
                step="0.01"
                value={offer.roi_stawka || ""}
                onChange={(e) => setOffer((p) => (p ? { ...p, roi_stawka: Number(e.target.value) } : p))}
                onBlur={(e) => patchOffer({ roi_stawka: Number(e.target.value) || 0 })}
                placeholder="0"
                className="w-24 rounded-md border hairline bg-transparent px-1.5 py-1 text-right text-[13px] text-[var(--fg)]"
              />
            </Field>
            {zwrot ? (
              <p className="mt-1.5 rounded-lg bg-hairline/40 px-2.5 py-1.5 text-[11px] text-muted">
                Na dokumencie: oszczędność {formatMoney(zwrot.oszczednoscMiesiac, waluta)}/mies., zwrot po{" "}
                {zwrot.miesiecyDoZwrotu} mies.
              </p>
            ) : (
              <p className="mt-1.5 text-[11px] text-muted opacity-70">
                Puste — blok zwrotu nie pojawi się na ofercie. Wpisz czas, który wdrożenie realnie oszczędza, i koszt
                godziny po stronie klienta.
              </p>
            )}
          </div>

          {offer.status === "Odrzucona" && (
            <div className="card-paper rounded-xl border hairline p-4">
              <h3 className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">Odrzucona</h3>
              <p className="text-[12.5px] text-[var(--fg)]">{powodOdrzucenia || "Bez podanego powodu."}</p>
              {offer.odrzucona_at && (
                <p className="mt-0.5 text-[11px] text-muted">{formatPlDate(offer.odrzucona_at)}</p>
              )}
            </div>
          )}

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
              {/* Idempotencja bez widocznego śladu to połowa roboty (ustalenie
                  z NDA na leadzie, Moduł 51): serwer i tak nie zrobi drugiej
                  umowy, ale do dziś karta mówiła „Wygeneruj" także wtedy, gdy
                  umowa leżała już podpisana. */}
              {contract ? (
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted">
                    Umowa
                    <span className={`rounded-full px-2 py-0.5 font-medium ${CONTRACT_STATUS_CLASS[contract.status] ?? ""}`}>
                      {contract.status}
                    </span>
                  </div>
                  <a
                    href={`/${lang}/admin/contracts/${contract.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border hairline px-3 py-2 text-sm font-medium text-[var(--fg)] hover:bg-[var(--hairline)]"
                  >
                    <IconExternalLink size={14} /> Otwórz umowę
                  </a>
                </div>
              ) : (
                <button
                  onClick={generateContract}
                  disabled={generatingContract}
                  className="btn-primary mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generatingContract ? <IconLoader2 size={15} className="animate-spin" /> : null}
                  Wygeneruj umowę
                </button>
              )}
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
            onClick={copyClientLink}
            disabled={copyingLink}
            title="Skopiuj adres strony, którą zobaczy klient — ten sam, który idzie mailem"
            className="flex w-full items-center justify-center gap-1.5 rounded-full border hairline px-3 py-1.5 text-xs text-muted hover:text-[var(--fg)] disabled:opacity-50"
          >
            {copyingLink ? <IconLoader2 size={13} className="animate-spin" /> : <IconLink size={13} />}
            Kopiuj link dla klienta
          </button>

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

          {/* Wersja ≠ duplikat: wersja zastępuje, duplikat mnoży. Przy ofercie
              zaakceptowanej wersja nie ma sensu (serwer ją odrzuci), więc jej
              tu nie pokazujemy. */}
          <button
            onClick={saveAsTemplate}
            disabled={savingTemplate}
            title="Zapisz pozycje, sekcje i uwagi tej oferty jako szablon do kolejnych ofert"
            className="flex w-full items-center justify-center gap-1.5 rounded-full border hairline px-3 py-1.5 text-xs text-muted hover:text-[var(--fg)] disabled:opacity-50"
          >
            {savingTemplate ? <IconLoader2 size={13} className="animate-spin" /> : <IconLayoutGrid size={13} />}
            Zapisz jako szablon
          </button>

          {!accepted && (
            <button
              onClick={newVersion}
              disabled={versioning}
              title="Klient poprosił o zmianę — zrób wersję 2 zamiast drugiej, niepowiązanej oferty"
              className="flex w-full items-center justify-center gap-1.5 rounded-full border hairline px-3 py-1.5 text-xs text-muted hover:text-[var(--fg)] disabled:opacity-50"
            >
              {versioning ? <IconLoader2 size={13} className="animate-spin" /> : <IconVersions size={13} />}
              Nowa wersja oferty
            </button>
          )}

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

      <ContextMenu ctl={ctxSekcji} width={230}>
        {({ sekcja, i }, close) => (
          <>
            <ContextMenuItem
              icon={<IconPlus size={14} />}
              label="Dodaj sekcję pod spodem"
              onClick={() => {
                close();
                addSection();
              }}
            />
            <ContextMenuItem
              icon={<IconCopy size={14} />}
              label="Powiel tę sekcję"
              onClick={() => {
                close();
                addSection(sekcja.tytul, sekcja.tresc);
              }}
            />
            <MenuDivider />
            <ContextMenuItem
              icon={<IconChevronUp size={14} />}
              label="Wyżej"
              disabled={i === 0}
              onClick={() => {
                close();
                moveSection(i, -1);
              }}
            />
            <ContextMenuItem
              icon={<IconChevronDown size={14} />}
              label="Niżej"
              disabled={i === sections.length - 1}
              onClick={() => {
                close();
                moveSection(i, 1);
              }}
            />
            <MenuDivider />
            <ContextMenuItem
              icon={<IconTrash size={14} />}
              label="Usuń sekcję"
              danger
              onClick={() => {
                close();
                deleteSection(sekcja.id);
              }}
            />
          </>
        )}
      </ContextMenu>

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        z={95}
        card="card-paper my-auto w-full max-w-md rounded-2xl border hairline p-5"
      >
        <OknoOdrzucenia onCancel={() => setRejectOpen(false)} onConfirm={rejectOffer} />
      </Modal>
    </div>
  );
}

/** Pole tekstowe wiersza profilu: lokalny stan w trakcie pisania, zapis na
 * `blur` — ta sama obsługa powtarzała się w siedmiu polach danych klienta.
 * Obramowanie pojawia się dopiero pod kursorem/przy edycji, żeby wypełniona
 * karta czytała się jak wizytówka, a nie jak formularz. */
function PoleTekstowe({
  value,
  onLocal,
  onSave,
  placeholder,
  className = "",
  disabled = false,
}: {
  value: string;
  onLocal: (v: string) => void;
  onSave: (v: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <input
      value={value ?? ""}
      onChange={(e) => onLocal(e.target.value)}
      onBlur={(e) => onSave(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`min-w-0 flex-1 rounded-md border border-transparent bg-transparent py-1 text-[var(--fg)] placeholder:text-muted hover:border-[var(--hairline)] focus:border-[var(--hairline)] focus:outline-none ${className}`}
    />
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

/** Wyszukiwarka komponentów katalogu w popoverze „Z katalogu" oferty. Pokazuje
 * cenę bazową (tę wstawi na pozycję) + ewentualne widełki. Koszt zakupu/marża
 * NIE są tu widoczne — to picker do składania oferty dla klienta, nie ekran
 * zarządzania katalogiem. */
function OfferCatalogPickerBody({ catalog, onPick }: { catalog: CatalogItem[]; onPick: (c: CatalogItem) => void }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const filtered = needle ? catalog.filter((c) => c.nazwa.toLowerCase().includes(needle)) : catalog;
  return (
    <div className="max-h-80 overflow-y-auto">
      <div className="p-1.5">
        <div className="flex items-center gap-1.5 rounded-md border hairline px-2 py-1">
          <IconSearch size={13} className="shrink-0 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Szukaj komponentu…"
            autoFocus
            className="w-full bg-transparent text-[12.5px] text-[var(--fg)] placeholder:text-muted focus:outline-none"
          />
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="px-3 py-3 text-center text-[12px] text-muted">Brak dopasowań.</p>
      ) : (
        filtered.map((c) => (
          <button
            key={c.id}
            onClick={() => onPick(c)}
            className="flex w-full items-start gap-2 px-2.5 py-1.5 text-left hover:bg-[var(--hairline)]"
          >
            <CatalogCategoryIcon kind={c.kategoria} size={14} className="mt-0.5 shrink-0 text-muted" />
            <span className="min-w-0">
              <span className="block truncate text-[13px] text-[var(--fg)]">{c.nazwa}</span>
              <span className="block text-[11px] text-muted">
                {formatMoney(c.cena_netto)} / {c.jednostka}
                {hasPriceRange(c.cena_min, c.cena_max) && (
                  <span className="text-brand-cyan"> · {formatMoney(c.cena_min as number)}–{formatMoney(c.cena_max as number)}</span>
                )}
              </span>
            </span>
          </button>
        ))
      )}
    </div>
  );
}
