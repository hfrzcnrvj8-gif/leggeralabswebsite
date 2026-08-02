"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconX, IconCheck, IconLoader2, IconExternalLink, IconMail, IconReceipt } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import {
  type Contract,
  CONTRACT_REJECT_REASONS,
  CONTRACT_STATUSES,
  CONTRACT_STATUS_CLASS,
  CONTRACT_TYP_LABEL,
  clausesDokumentu,
  LEGAL_PLACEHOLDER_NOTE,
  POLE_ANEKSU_LABEL,
  CONTRACT_STALE_DAYS,
  CONTRACT_SZABLONY,
  CONTRACT_SZABLON_LABEL,
  CONTRACT_SZABLON_OPIS,
  contractReference,
  contractSilenceDays,
  powodOdnowienia,
  umowaDoOdnowienia,
  roznicaAneksu,
} from "@/lib/contracts";
import { rejectReasonLabel } from "@/lib/offers";
import { formatPlDate } from "@/lib/projects";
import { todayLocalISO } from "@/lib/dates";
import { DOC_LANGS, DOC_LANG_LABEL } from "@/lib/documents";
import { formatMoney, INVOICE_CURRENCIES } from "@/lib/invoices";
import { useUI } from "../ui";
import { PasekBramki, useWysylkaZBramka } from "../BramkaWysylki";
import type { WynikBramki } from "@/lib/bramkaWysylki";
import { DateField } from "../DatePicker";
import { ClientLinkChip, EditableText } from "../components";
import { PropertyMenu } from "../Menu";
import { LinkPicker } from "../LinkPicker";
import { DocLinkPicker } from "../DocLinkPicker";
import { MiniSciezka } from "../MiniSciezka";
import { ShareLinkControl } from "../ShareLinkControl";
import { SekcjaProfilu, WierszPola } from "../ProfileSection";
import { Modal } from "../Modal";
import { OknoOdrzucenia } from "../RejectDialog";

type AneksWiersz = { id: string; aneks_nr: number; status: string; cena: number; waluta: string; created_at: string };
type MatkaWiersz = { id: string; typ: string; status: string; klient_nazwa: string; created_at: string };

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
  // Bramka wysyłki (Faza 2) — pasek liczy SERWER przy odczycie dokumentu:
  // dane wystawcy siedzą w osobnej tabeli, do której edytor nie sięgał.
  const [bramka, setBramka] = useState<WynikBramki | null>(null);
  const { wyslij, oknoBramki } = useWysylkaZBramka();
  const [contract, setContract] = useState<Contract | null>(null);
  /** Rodzina dokumentu z `GET /api/contracts/:id` — aneksy tej umowy albo
   * umowa-matka tego aneksu. Do audytu Modułu 11 obie strony tego powiązania
   * były w profilu niewidoczne. */
  const [aneksy, setAneksy] = useState<AneksWiersz[]>([]);
  const [matka, setMatka] = useState<MatkaWiersz | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const savedTimer = useRef<number | null>(null);
  const [sending, setSending] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [zaliczkaWTrakcie, setZaliczkaWTrakcie] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/contracts/${id}`);
    if (!res.ok) return;
    const data = (await res.json()) as {
      contract: Contract;
      aneksy?: AneksWiersz[];
      matka?: MatkaWiersz | null;
      bramka?: WynikBramki;
    };
    setContract(data.contract);
    setAneksy(data.aneksy ?? []);
    setMatka(data.matka ?? null);
    setBramka(data.bramka ?? null);
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
    // Bramka wysyłki (Faza 2) — `wyslij` sam pokazuje listę zastrzeżeń
    // i powtarza żądanie po „Wyślij mimo to".
    const res = await wyslij(`/api/contracts/${id}/send`);
    setSending(false);
    if (res.ok) {
      const data = res.dane as { status?: string; shareToken?: string };
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
    } else if (!res.anulowane) {
      toast(res.dane.error ?? "Nie udało się wysłać.", "error");
    }
  }, [id, toast, onChange, wyslij]);

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

  /** Zmiana statusu z profilu — 1:1 z listą (patrz ContractsDashboard):
   * „Podpisana" idzie trasą `/accept`, „Odrzucona" najpierw pyta o powód. */
  const zapiszStatus = useCallback(
    async (status: string, powod?: string, komentarz?: string) => {
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
        return;
      }
      await load();
      onChange?.();
    },
    [id, toast, load, onChange]
  );

  const zmienStatus = useCallback(
    (status: string) => {
      if (status === "Odrzucona") {
        setRejectOpen(true);
        return;
      }
      void zapiszStatus(status);
    },
    [zapiszStatus]
  );

  /** Sporządź aneks — ta sama trasa, co przycisk na liście. W profilu jest
   * potrzebny bardziej: to TU właściciel dostaje 409 „Zmiana wymaga aneksu",
   * kiedy próbuje poprawić podpisaną umowę. */
  const sporzadzAneks = useCallback(async () => {
    const res = await fetch(`/api/contracts/${id}/aneks`, { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as { id?: string; aneks_nr?: number; error?: string };
    if (!res.ok || !data.id) {
      toast(data.error ?? "Nie udało się sporządzić aneksu.", "error");
      return;
    }
    window.location.href = `/${lang}/admin/contracts/${data.id}`;
  }, [id, lang, toast]);

  /** Przypomnienie o podpisie — treść pisze serwer (`/remind`), tak jak przy
   * ofertach. Panel nie ma własnego szablonu maila. */
  const przypomnij = useCallback(async () => {
    setReminding(true);
    const res = await fetch(`/api/contracts/${id}/remind`, { method: "POST" });
    setReminding(false);
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      toast(data.error ?? "Nie udało się wysłać przypomnienia.", "error");
      return;
    }
    toast("Przypomnienie wysłane.");
    await load();
  }, [id, toast, load]);

  /** Podpis po naszej stronie — osobno od „Oznacz jako podpisaną" (tamto mówi
   * o DRUGIEJ stronie i zamyka dokument). Imię bierze serwer z ustawień firmy. */
  const podpiszNaszaStrona = useCallback(async () => {
    const res = await fetch(`/api/contracts/${id}/podpis-nasz`, { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as { error?: string; osoba?: string };
    if (!res.ok) {
      toast(data.error ?? "Nie udało się zapisać podpisu.", "error");
      return;
    }
    toast(`Podpis odnotowany: ${data.osoba ?? ""}`.trim());
    await load();
    onChange?.();
  }, [id, toast, load, onChange]);

  const cofnijNaszPodpis = useCallback(async () => {
    const res = await fetch(`/api/contracts/${id}/podpis-nasz`, { method: "DELETE" });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      toast(data.error ?? "Nie udało się cofnąć.", "error");
      return;
    }
    await load();
  }, [id, toast, load]);

  /** Szkic faktury zaliczkowej z tej umowy. Drugie kliknięcie otwiera
   * istniejącą fakturę zamiast wystawiać drugą (dedupe po stronie trasy). */
  const wystawZaliczke = useCallback(async () => {
    setZaliczkaWTrakcie(true);
    const res = await fetch(`/api/contracts/${id}/faktura-zaliczkowa`, { method: "POST" });
    setZaliczkaWTrakcie(false);
    const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string; existing?: boolean; kwota?: number };
    if (!res.ok || !data.id) {
      toast(data.error ?? "Nie udało się wystawić faktury.", "error");
      return;
    }
    toast(data.existing ? "Zaliczka do tej umowy już istnieje — otwieram ją." : "Szkic faktury zaliczkowej gotowy.");
    window.open(`/${lang}/admin/invoices/${data.id}`, "_blank");
  }, [id, lang, toast]);

  const remove = useCallback(async () => {
    if (!contract) return;
    const ok = await confirm(`Usunąć dokument "${contract.klient_nazwa || "(bez nazwy)"}"?`, { danger: true });
    if (!ok) return;
    const res = await fetch(`/api/contracts/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast("Dokument usunięty.");
      onDeleted?.(id);
      return;
    }
    // Od audytu Modułu 11 trasa potrafi ODMÓWIĆ (dokument podpisany albo ma
    // aneksy) — jej zdanie tłumaczy dlaczego, więc pokazujemy je dosłownie.
    // Wcześniej przycisk po prostu nic nie robił.
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    toast(data.error ?? "Nie udało się usunąć.", "error");
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
  const isAneks = contract.typ === "aneks";
  const isDpa = contract.typ === "dpa";
  const clauses = clausesDokumentu(contract.typ, contract.szablon);
  const signed = contract.status === "Podpisana";

  // Aneks edytuje DOKŁADNIE te same warunki co umowa (zakres, kwota, termin) —
  // tyle że jego treścią jest RÓŻNICA wobec umowy-matki, nie same wartości.
  // Stąd wspólny warunek na pola i osobny panel „co zmienia ten aneks" niżej.
  const edytowalneWarunki = isUmowa || isAneks;
  const poprzednie = contract.poprzednie ?? null;
  const zmianyAneksu = isAneks && poprzednie ? roznicaAneksu(poprzednie, contract) : [];
  // Ta sama funkcja, którą liczy Pulpit i dzienny mail — jedna definicja
  // „ciszy" na trzy ekrany (lib/contracts.ts).
  const cisza = contractSilenceDays(contract);

  /** Wartość pola w tabeli „było → jest" — kwota z walutą, data po polsku,
   * tekst jak jest. Panel pokazywał tu surowe „2026-09-30" i gołą liczbę,
   * mimo że wydruk (ContractPrint) formatuje oba od początku — a CLAUDE.md
   * mówi wprost: nigdy surowego ISO z bazy (audyt Modułu 11). */
  const wartoscZmiany = (pole: string, v: string | number | null) => {
    if (v === null || v === "") return "—";
    if (pole === "cena") return formatMoney(Number(v), contract.waluta || "PLN");
    if (pole === "termin_realizacji") return formatPlDate(String(v).slice(0, 10));
    return String(v);
  };

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
              {/* Z KTÓREJ OFERTY (2026-07-27) — umowa wygenerowana z oferty ma
                  to pole wypełnione od początku, ale umowa wolnostojąca nie
                  miała jak go dostać, więc wypadała ze ścieżki dokumentów na
                  karcie klienta. */}
              <span className="text-[11px] uppercase tracking-wide opacity-70">Z oferty</span>
              <DocLinkPicker
                rodzaj="offer"
                clientId={contract.client_id}
                value={contract.offer_id}
                onPick={(v) => patch({ offer_id: v })}
                disabled={signed}
              />
            </span>
          )}
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

      {/* PASEK STANU — do audytu Modułu 11 profil w ogóle nie mówił, w jakim
          stanie jest dokument: umowa wysłana wyglądała jak szkic i świeciła
          przyciskiem „Oznacz jako podpisaną". Ta sama wada co w Ofertach
          (runda 6, punkt 1). Pigułka jest klikalna — status zmienia się
          z profilu, nie tylko z listy. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PropertyMenu
          value={contract.status}
          options={CONTRACT_STATUSES.map((s) => ({ value: s, label: s }))}
          onChange={(v) => zmienStatus(v)}
          title="Zmień status dokumentu"
        >
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${CONTRACT_STATUS_CLASS[contract.status] ?? ""}`}>
            {contract.status}
          </span>
        </PropertyMenu>
        <span className="text-[11.5px] text-muted">{contractReference(contract)}</span>
        {/* „Czas przypomnieć" dopiero po progu ciszy (CONTRACT_STALE_DAYS) —
            inaczej dokument wysłany przed chwilą krzyczał „cisza od 0 dni,
            czas przypomnieć", czyli uczył ignorować własny sygnał. */}
        {cisza != null && (
          <span className={cisza >= CONTRACT_STALE_DAYS ? "text-[11.5px] text-brand-gold" : "text-[11.5px] text-muted"}>
            {cisza === 0
              ? "wysłana dziś"
              : `cisza od ${cisza} ${cisza === 1 ? "dnia" : "dni"}${cisza >= CONTRACT_STALE_DAYS ? " — czas przypomnieć" : ""}`}
          </span>
        )}
        {signed && contract.accepted_at && (
          <span className="text-[11.5px] text-emerald-400">
            podpisano {formatPlDate(String(contract.accepted_at).slice(0, 10))}
            {contract.accepted_by_name ? ` — ${contract.accepted_by_name}` : " (ręcznie, bez e-podpisu)"}
          </span>
        )}
        {/* Ślad otwarcia (2026-07-27) — po wysyłce dokumentu panel przestał
            być ślepy: „wysłane i nieotwarte" to inna sytuacja niż „czyta
            trzeci raz". Automaty się nie liczą (lib/publicVisit.ts). */}
        {contract.liczba_otwarc > 0 ? (
          <span className="text-[11.5px] text-brand-cyan">
            otwarta {contract.liczba_otwarc}×
            {contract.ostatnio_otwarta_at ? `, ostatnio ${formatPlDate(String(contract.ostatnio_otwarta_at).slice(0, 10))}` : ""}
          </span>
        ) : contract.status === "Wysłana" ? (
          <span className="text-[11.5px] text-muted">jeszcze nieotwarta</span>
        ) : null}
        {contract.przypomniano_at && (
          <span className="text-[11.5px] text-muted">
            przypomniano {formatPlDate(String(contract.przypomniano_at).slice(0, 10))}
          </span>
        )}
        {isUmowa && umowaDoOdnowienia(contract, todayLocalISO()) && (
          <span className="text-[11.5px] text-brand-gold">{powodOdnowienia(contract, todayLocalISO())}</span>
        )}
        {contract.status === "Odrzucona" && (
          <span className="text-[11.5px] text-muted">
            {rejectReasonLabel(contract.powod_odrzucenia ?? "", contract.komentarz_odrzucenia ?? "") ||
              "bez podanego powodu"}
          </span>
        )}
      </div>

      <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] leading-relaxed text-amber-500">
        ⚠ {LEGAL_PLACEHOLDER_NOTE}
      </div>

      {/* Umowa-matka aneksu i aneksy umowy — dwie strony tego samego
          powiązania. Bez tego umowa nie mówiła, że jej warunki zmienił już
          aneks (a to jest jedyna rzecz, którą trzeba wiedzieć przed
          rozmową o niej). */}
      {matka && (
        <div className="mt-3 rounded-lg border hairline card-inset px-3 py-2 text-[12px]">
          <span className="text-muted">Aneks do umowy </span>
          <a href={`/${lang}/admin/contracts/${matka.id}`} className="text-[var(--fg)] underline decoration-[var(--hairline)] hover:decoration-current">
            {matka.klient_nazwa || "(bez nazwy)"} — {contractReference({ id: matka.id, typ: "umowa", created_at: matka.created_at })}
          </a>
        </div>
      )}
      {aneksy.length > 0 && (
        <div className="mt-3 rounded-lg border hairline card-inset px-3 py-2">
          <h3 className="text-[11px] uppercase tracking-wide text-muted">Aneksy do tej umowy</h3>
          <ul className="mt-1.5 space-y-1">
            {aneksy.map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-[12.5px]">
                <a href={`/${lang}/admin/contracts/${a.id}`} className="text-[var(--fg)] underline decoration-[var(--hairline)] hover:decoration-current">
                  Aneks nr {a.aneks_nr}
                </a>
                <span className={`rounded-full px-2 py-0.5 text-[10.5px] ${CONTRACT_STATUS_CLASS[a.status] ?? ""}`}>{a.status}</span>
                <span className="text-muted">{formatMoney(Number(a.cena), a.waluta || "PLN")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* CO ZMIENIA TEN ANEKS — jedyna informacja, której nie da się wyczytać
          z pól niżej. Pola pokazują wartości DOCELOWE, a treścią aneksu jest
          różnica: bez tego panelu właściciel patrzy na coś nie do odróżnienia
          od drugiej umowy i nie wie, czy jego zmiana w ogóle weszła.
          Pusta lista jest tu ostrzeżeniem, nie brakiem — trasa wysyłki
          odmówi wysłania aneksu bez zmian. */}
      {isAneks && poprzednie && (
        <div className="mt-3 rounded-lg border hairline card-inset px-3 py-2.5">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[11px] uppercase tracking-wide text-muted">Co zmienia ten aneks</h3>
            <span className="text-[11px] text-muted">
              do umowy {poprzednie.reference}
            </span>
          </div>
          {zmianyAneksu.length === 0 ? (
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-brand-gold">
              Na razie nic. Zmień zakres, kwotę, walutę albo termin — dopóki wszystko zgadza się
              z umową, aneks nie ma treści i nie da się go wysłać.
            </p>
          ) : (
            <ul className="mt-1.5 space-y-1">
              {zmianyAneksu.map((z) => (
                <li key={z.pole} className="flex flex-wrap items-baseline gap-x-2 text-[12.5px]">
                  <span className="text-muted">{POLE_ANEKSU_LABEL.pl[z.pole]}:</span>
                  <span className="text-muted line-through decoration-[var(--hairline)]">
                    {wartoscZmiany(z.pole, z.bylo)}
                  </span>
                  <span className="text-muted">→</span>
                  <span className="font-medium text-[var(--fg)]">{wartoscZmiany(z.pole, z.jest)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <MiniSciezka rodzaj="contract" id={id} lang={lang} />

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 space-y-4">
          {/* Etykietowane wiersze zamiast nagich inputów z placeholderem
              (wzorzec z Modułu 54/57): placeholder znika, gdy pole ma treść,
              więc wypełniona wizytówka była kolumną wartości bez nazw — nie
              dało się odróżnić NIP-u od kodu pocztowego bez czyszczenia pola. */}
          <SekcjaProfilu tytul="Druga strona">
            <WierszPola etykieta="Nazwa">
              <EditableText value={contract.klient_nazwa} onSave={(v) => patch({ klient_nazwa: v })} placeholder="Firma / osoba" readOnly={signed} />
            </WierszPola>
            <WierszPola etykieta="NIP">
              <EditableText value={contract.klient_nip} onSave={(v) => patch({ klient_nip: v })} placeholder="—" readOnly={signed} />
            </WierszPola>
            <WierszPola etykieta="E-mail" title="Adres, na który idzie link do podpisu">
              <EditableText value={contract.klient_email} onSave={(v) => patch({ klient_email: v })} placeholder="—" readOnly={signed} />
            </WierszPola>
            <WierszPola etykieta="Ulica">
              <EditableText value={contract.klient_ulica} onSave={(v) => patch({ klient_ulica: v })} placeholder="—" readOnly={signed} />
            </WierszPola>
            <WierszPola etykieta="Kod i miasto">
              <EditableText value={contract.klient_kod} onSave={(v) => patch({ klient_kod: v })} placeholder="—" readOnly={signed} />
              <EditableText value={contract.klient_miasto} onSave={(v) => patch({ klient_miasto: v })} placeholder="—" readOnly={signed} />
            </WierszPola>
            {/* Kraj był w bazie i na wydruku (clientAddressLines), ale NIE
                w panelu: umowa dla klienta spoza Polski dziedziczyła go
                z oferty albo zostawała pusta na zawsze (audyt Modułu 11). */}
            <WierszPola etykieta="Kraj" title="Puste = Polska. Widoczne na wydruku dokumentu.">
              <EditableText value={contract.klient_kraj} onSave={(v) => patch({ klient_kraj: v })} placeholder="—" readOnly={signed} />
            </WierszPola>
          </SekcjaProfilu>

          {edytowalneWarunki && (
            <div className="card-paper rounded-xl border hairline p-4">
              <h2 className="mb-2 text-[13px] font-medium">Przedmiot umowy (zakres prac)</h2>
              {/* Pole zablokowane MUSI powiedzieć, dlaczego nie da się w nim
                  pisać, i dokąd iść dalej (zgłoszenie właściciela 2026-07-27:
                  „mam nieklikalne pole i nie mogę nic dodać"). Samo
                  `readOnly` wygląda jak usterka — zwłaszcza gdy pole jest
                  puste, bo wtedy widać wyłącznie szary placeholder. */}
              {signed ? (
                <>
                  <div className="whitespace-pre-line rounded-lg card-inset px-2.5 py-2 text-sm text-[var(--fg)]">
                    {contract.zakres_prac || <span className="text-muted">(nie wpisano zakresu)</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-muted">
                    <span>Dokument jest podpisany — treści nie zmieniamy.</span>
                    {contract.typ === "umowa" && (
                      <button
                        onClick={sporzadzAneks}
                        className="rounded-full border hairline px-2.5 py-0.5 text-[11.5px] text-[var(--fg)] hover:bg-[var(--hairline)]"
                      >
                        Sporządź aneks
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <textarea
                  value={contract.zakres_prac}
                  onChange={(e) => setContract((p) => (p ? { ...p, zakres_prac: e.target.value } : p))}
                  onBlur={(e) => patch({ zakres_prac: e.target.value })}
                  rows={5}
                  placeholder="Skopiowane z pozycji zaakceptowanej oferty — dopracuj sformułowania."
                  className="w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
                />
              )}
            </div>
          )}

          {/* DPA — trzy pola, których art. 28 ust. 3 RODO wymaga KONKRETNIE
              dla danego powierzenia. Puste = dokument niekompletny, więc
              mówimy to wprost zamiast drukować „—". */}
          {isDpa && (
            <SekcjaProfilu tytul="Co powierzamy (wymagane przez RODO)">
              <WierszPola etykieta="Rodzaj danych" title="Np. imię i nazwisko, e-mail, telefon, dane z faktur">
                <EditableText
                  value={contract.dpa_kategorie_danych}
                  onSave={(v) => patch({ dpa_kategorie_danych: v })}
                  placeholder="np. imię i nazwisko, adres e-mail, treść korespondencji"
                  readOnly={signed}
                />
              </WierszPola>
              <WierszPola etykieta="Czyje dane" title="Kategorie osób, których dane dotyczą">
                <EditableText
                  value={contract.dpa_kategorie_osob}
                  onSave={(v) => patch({ dpa_kategorie_osob: v })}
                  placeholder="np. klienci Zamawiającego, jego pracownicy"
                  readOnly={signed}
                />
              </WierszPola>
              <WierszPola etykieta="Podprocesorzy" title="Dalsze podmioty przetwarzające — puste znaczy „żadnych”">
                <EditableText
                  value={contract.dpa_podprocesorzy}
                  onSave={(v) => patch({ dpa_podprocesorzy: v })}
                  placeholder="puste = nie korzystam z żadnych"
                  readOnly={signed}
                />
              </WierszPola>
            </SekcjaProfilu>
          )}

          {/* Aneks nie powtarza klauzul — obowiązują dalej z umowy-matki,
              a przedruk sugerowałby, że aneks je zastępuje (tak samo na
              wydruku, patrz ContractPrint.tsx). */}
          {!isAneks && (
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
          )}

          <div className="card-paper rounded-xl border hairline p-4">
            <h2 className="mb-2 text-[13px] font-medium">Uwagi</h2>
            <textarea
              value={contract.uwagi}
              onChange={(e) => setContract((p) => (p ? { ...p, uwagi: e.target.value } : p))}
              onBlur={(e) => patch({ uwagi: e.target.value })}
              readOnly={signed}
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

          {/* RODZAJ UMOWY (2026-07-27) — szablon wybiera zestaw stałych
              klauzul, nie pisze nowej treści prawnej. Trzy rodzaje wynikają
              z tego, co właściciel realnie sprzedaje. NDA i aneks go nie mają. */}
          {isUmowa && (
            <div className="card-paper rounded-xl border hairline p-4">
              <h3 className="mb-2 text-[11px] uppercase tracking-wide text-muted">Rodzaj umowy</h3>
              <PropertyMenu
                value={contract.szablon || "wdrozeniowa"}
                options={CONTRACT_SZABLONY.map((v) => ({ value: v, label: CONTRACT_SZABLON_LABEL[v] }))}
                onChange={(v) => patch({ szablon: v })}
                title="Rodzaj umowy — decyduje, które stałe klauzule wchodzą na dokument"
                full
              >
                <span className="block rounded-md -mx-1.5 px-1.5 py-1 text-[13px] text-[var(--fg)] hover:bg-[var(--hairline)]">
                  {CONTRACT_SZABLON_LABEL[(contract.szablon || "wdrozeniowa") as keyof typeof CONTRACT_SZABLON_LABEL]}
                </span>
              </PropertyMenu>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted opacity-70">
                {CONTRACT_SZABLON_OPIS[(contract.szablon || "wdrozeniowa") as keyof typeof CONTRACT_SZABLON_OPIS]}
              </p>
            </div>
          )}

          {/* OKRES OBOWIĄZYWANIA — co innego niż termin realizacji (koniec
              pracy). Bez tego umowa utrzymaniowa odnawiała się albo wygasała
              bez niczyjej wiedzy; Pulpit odzywa się od terminu WYPOWIEDZENIA,
              nie od daty końca. */}
          {isUmowa && (
            <div className="card-paper rounded-xl border hairline p-4">
              <h3 className="mb-2 text-[11px] uppercase tracking-wide text-muted">Obowiązywanie</h3>
              <div className="flex items-center gap-2 py-0.5">
                <span className="w-24 shrink-0 text-[12.5px] text-muted">Od</span>
                {signed ? (
                  <span className="text-[13px] text-[var(--fg)]">
                    {contract.obowiazuje_od ? formatPlDate(String(contract.obowiazuje_od).slice(0, 10)) : "—"}
                  </span>
                ) : (
                  <DateField value={contract.obowiazuje_od ?? ""} onChange={(v) => patch({ obowiazuje_od: v || null })} placeholder="—" />
                )}
              </div>
              <div className="mt-2 flex items-center gap-2 py-0.5">
                <span className="w-24 shrink-0 text-[12.5px] text-muted">Do</span>
                {signed ? (
                  <span className="text-[13px] text-[var(--fg)]">
                    {contract.obowiazuje_do ? formatPlDate(String(contract.obowiazuje_do).slice(0, 10)) : "—"}
                  </span>
                ) : (
                  <DateField value={contract.obowiazuje_do ?? ""} onChange={(v) => patch({ obowiazuje_do: v || null })} placeholder="—" />
                )}
              </div>
              <label className="mt-2 flex items-center gap-2 py-0.5 text-[12.5px] text-muted">
                <input
                  type="checkbox"
                  checked={!!contract.odnawialna}
                  disabled={signed}
                  onChange={(e) => patch({ odnawialna: e.target.checked })}
                  className="h-3.5 w-3.5 accent-[#7C3AED]"
                />
                Przedłuża się sama (odnawialna)
              </label>
              {contract.odnawialna && (
                <div className="mt-2 flex items-center gap-2 py-0.5">
                  <span className="w-24 shrink-0 text-[12.5px] text-muted">Wypowiedzenie</span>
                  {signed ? (
                    <span className="text-[13px] text-[var(--fg)]">{contract.wypowiedzenie_dni || 0} dni</span>
                  ) : (
                    <input
                      type="number"
                      min={0}
                      max={365}
                      value={contract.wypowiedzenie_dni ?? 0}
                      onChange={(e) => setContract((p) => (p ? { ...p, wypowiedzenie_dni: Number(e.target.value) } : p))}
                      onBlur={(e) => patch({ wypowiedzenie_dni: Number(e.target.value) })}
                      className="w-20 rounded-lg border hairline bg-transparent px-2.5 py-1 text-right text-sm text-[var(--fg)]"
                    />
                  )}
                  <span className="text-[11.5px] text-muted">dni</span>
                </div>
              )}
              {contract.obowiazuje_do && (
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted opacity-80">
                  {contract.status === "Podpisana"
                    ? powodOdnowienia(contract, todayLocalISO())
                    : "Panel przypomni o końcu umowy dopiero po jej podpisaniu."}
                </p>
              )}
            </div>
          )}

          {edytowalneWarunki && (
            <div className="card-paper rounded-xl border hairline p-4">
              <h3 className="mb-2 text-[11px] uppercase tracking-wide text-muted">Wynagrodzenie</h3>
              {/* Po podpisie warunki są tylko do odczytu — trasa i tak odmówi
                  (409), a pole, które wygląda na edytowalne i odbija się
                  o serwer, obiecuje coś, czego nie da się zrobić (audyt
                  Modułu 11). Zmiana idzie aneksem, przycisk jest niżej. */}
              {signed ? (
                <dl className="space-y-1.5 text-[13px]">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-[12.5px] text-muted">Kwota</dt>
                    <dd className="text-[var(--fg)]">{formatMoney(contract.cena, contract.waluta || "PLN")}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-[12.5px] text-muted">Termin</dt>
                    <dd className="text-[var(--fg)]">
                      {contract.termin_realizacji ? formatPlDate(String(contract.termin_realizacji).slice(0, 10)) : "—"}
                    </dd>
                  </div>
                </dl>
              ) : (
                <>

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
              {/* Waluta w formatowaniu, nie domyślne „zł" (audyt Modułu 11):
                  umowa na 6 000 EUR pokazywała tu „6 000,00 zł", bo wywołanie
                  szło bez drugiego argumentu. Wydruk liczył poprawnie —
                  rozjeżdżał się właśnie ten podgląd. */}
              <p className="mt-1 text-right text-[11px] text-muted">
                {formatMoney(contract.cena, contract.waluta || "PLN")}
              </p>
              {/* Waluty nie dało się w panelu ustawić WCALE: umowa z oferty
                  w EUR powstawała w PLN (POST nie kopiował kolumny), a edytor
                  nie miał pickera. Oba końce naprawione. */}
              <div className="mt-2 flex items-center gap-2 py-0.5">
                <span className="w-20 shrink-0 text-[12.5px] text-muted">Waluta</span>
                <PropertyMenu
                  value={contract.waluta || "PLN"}
                  options={INVOICE_CURRENCIES.map((c) => ({ value: c, label: c }))}
                  onChange={(v) => patch({ waluta: v })}
                  title="Waluta wynagrodzenia — widoczna na wydruku"
                  full
                >
                  <span className="rounded-md -mx-1.5 px-1.5 py-1 text-[13px] text-[var(--fg)] hover:bg-[var(--hairline)]">
                    {contract.waluta || "PLN"}
                  </span>
                </PropertyMenu>
              </div>
              <div className="mt-2 flex items-center gap-2 py-0.5">
                <span className="w-20 shrink-0 text-[12.5px] text-muted">Termin</span>
                <DateField
                  value={contract.termin_realizacji ?? ""}
                  onChange={(v) => patch({ termin_realizacji: v || null })}
                  placeholder="—"
                />
              </div>
                </>
              )}
            </div>
          )}

          {/* PŁATNOŚĆ ETAPAMI (2026-07-27) — domyślna klauzula mówi „faktura po
              zakończeniu prac, 14 dni", czyli jednoosobowa firma finansuje
              klienta przez cały projekt. Zaliczka i harmonogram drukują się na
              dokumencie tylko wtedy, gdy są wypełnione. */}
          {isUmowa && (
            <div className="card-paper rounded-xl border hairline p-4">
              <h3 className="mb-2 text-[11px] uppercase tracking-wide text-muted">Płatność</h3>
              <div className="flex items-center gap-2 py-0.5">
                <span className="w-24 shrink-0 text-[12.5px] text-muted">Zaliczka</span>
                {signed ? (
                  <span className="text-[13px] text-[var(--fg)]">{contract.zaliczka_procent || 0}%</span>
                ) : (
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={contract.zaliczka_procent ?? 0}
                    onChange={(e) => setContract((p) => (p ? { ...p, zaliczka_procent: Number(e.target.value) } : p))}
                    onBlur={(e) => patch({ zaliczka_procent: Number(e.target.value) })}
                    className="w-20 rounded-lg border hairline bg-transparent px-2.5 py-1 text-right text-sm text-[var(--fg)]"
                  />
                )}
                <span className="text-[11.5px] text-muted">%</span>
              </div>
              {contract.zaliczka_procent > 0 && contract.cena > 0 && (
                <p className="mt-1 text-right text-[11px] text-muted">
                  {formatMoney((contract.cena * contract.zaliczka_procent) / 100, contract.waluta || "PLN")} z góry
                </p>
              )}
              {/* Faktura zaliczkowa wprost z umowy — kwotę liczy serwer
                  z pola wyżej, żeby nie przepisywać jej ręcznie do modułu
                  Faktury (tam literówka wychodzi dopiero u klienta).
                  Widoczna dopiero po podpisie: przed nim to prośba o przelew
                  pod dokument, którego druga strona nie zaakceptowała. */}
              {signed && contract.zaliczka_procent > 0 && contract.cena > 0 && (
                <button
                  onClick={wystawZaliczke}
                  disabled={zaliczkaWTrakcie}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full border hairline px-3 py-1.5 text-xs text-[var(--fg)] hover:bg-[var(--hairline)] disabled:opacity-50"
                >
                  {zaliczkaWTrakcie ? <IconLoader2 size={13} className="animate-spin" /> : <IconReceipt size={13} />}
                  Wystaw fakturę zaliczkową
                </button>
              )}
              <textarea
                value={contract.platnosci_opis}
                onChange={(e) => setContract((p) => (p ? { ...p, platnosci_opis: e.target.value } : p))}
                onBlur={(e) => patch({ platnosci_opis: e.target.value })}
                readOnly={signed}
                rows={3}
                placeholder="Harmonogram: np. 50% po odbiorze etapu 1, reszta po wdrożeniu produkcyjnym."
                className="mt-2 w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-[13px] text-[var(--fg)] placeholder:text-muted"
              />
            </div>
          )}

          {/* PODPIS PO NASZEJ STRONIE (2026-07-27) — dokument miał dotąd jedną
              rubrykę (klienta), a nasza była domyślna i pusta. Umowa jest
              dwustronna; wszystkie narzędzia do e-podpisu prowadzą obie strony.
              Kolejności nie wymuszamy — bywa różna. */}
          <div className="card-paper rounded-xl border hairline p-4">
              <h3 className="mb-2 text-[11px] uppercase tracking-wide text-muted">Podpis po naszej stronie</h3>
              {contract.podpis_nasz_at ? (
                <div className="text-[12.5px] text-[var(--fg)]">
                  {contract.podpis_nasz_osoba || "—"}
                  <div className="text-[11px] text-muted">
                    {formatPlDate(String(contract.podpis_nasz_at).slice(0, 10))}
                  </div>
                  {!signed && (
                    <button onClick={cofnijNaszPodpis} className="mt-2 text-[11px] text-muted underline hover:text-[var(--fg)]">
                      Cofnij podpis
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <button
                    onClick={podpiszNaszaStrona}
                    className="w-full rounded-full border hairline px-3 py-1.5 text-xs text-[var(--fg)] hover:bg-[var(--hairline)]"
                  >
                    Podpisz po naszej stronie
                  </button>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted opacity-70">
                    Imię bierzemy z ustawień firmy („Podpisuje umowy"). Rubryka pojawi się na wydruku obok podpisu drugiej strony.
                  </p>
                </>
              )}
          </div>

          {signed ? (
            <div className="card-paper space-y-2 rounded-xl border hairline p-3 text-center text-[12px] text-muted">
              <div>
                Podpisano{contract.accepted_at ? ` ${formatPlDate(String(contract.accepted_at).slice(0, 10))}` : ""}
                {contract.accepted_by_name ? (
                  <div className="mt-1 text-[11px]">
                    Podpisał/-a: {contract.accepted_by_name}
                    {contract.accepted_by_role ? ` — ${contract.accepted_by_role}` : ""}
                  </div>
                ) : (
                  <div className="mt-1 text-[11px]">Oznaczone ręcznie (bez e-podpisu)</div>
                )}
              </div>
              {/* JEDYNA droga wyjścia z podpisanej umowy — dotąd stała
                  wyłącznie na liście, a komunikat blokady („Zmiana wymaga
                  aneksu") dostaje się właśnie tutaj, przy próbie edycji. */}
              {isUmowa && (
                <button
                  onClick={sporzadzAneks}
                  className="w-full rounded-full border hairline px-3 py-1.5 text-xs text-[var(--fg)] hover:bg-[var(--hairline)]"
                >
                  Sporządź aneks
                </button>
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

          {/* Zamkniętego dokumentu nie wysyłamy „do podpisu" — trasa odmawia
              (409) od audytu Modułu 11, więc przycisk byłby obietnicą bez
              pokrycia. Apka ukrywała go tak samo od dawna. */}
          {!signed && contract.status !== "Odrzucona" && (
          <>
          {/* Bramka wysyłki (Faza 2) — lista braków stoi PRZY przycisku, nie
              w komunikacie po kliknięciu. Przycisk zostaje aktywny mimo
              blokad: odmawia trasa, a okno wymienia wszystkie powody naraz.
              Wcześniej stał tu `disabled` na samym braku e-maila — jedna
              reguła z ośmiu, których ten dokument wymaga. */}
          <PasekBramki bramka={bramka} />
          <button
            onClick={send}
            disabled={sending}
            title="Wyślij link do podpisu na e-mail"
            className="flex w-full items-center justify-center gap-1.5 rounded-full border hairline px-3 py-1.5 text-xs text-muted hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? <IconLoader2 size={13} className="animate-spin" /> : <IconMail size={13} />}
            Wyślij mailem
          </button>
          </>
          )}

          {/* Przypomnienie — tylko dla dokumentu, który realnie czeka na
              podpis. Trasa i tak odmówi w innych stanach (409), ale przycisk,
              który zawsze widać, uczy klikać na oślep. */}
          {contract.status === "Wysłana" && (
            <button
              onClick={przypomnij}
              disabled={reminding || !contract.klient_email}
              title={contract.klient_email ? "Uprzejme przypomnienie o podpisie" : "Uzupełnij e-mail"}
              className="flex w-full items-center justify-center gap-1.5 rounded-full border border-brand-cyan/40 px-3 py-1.5 text-xs text-brand-cyan disabled:cursor-not-allowed disabled:opacity-50"
            >
              {reminding ? <IconLoader2 size={13} className="animate-spin" /> : <IconMail size={13} />}
              Przypomnij o podpisie
            </button>
          )}

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

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        z={95}
        card="card-paper my-auto w-full max-w-md rounded-2xl border hairline p-5"
      >
        <OknoOdrzucenia
          tytul="Dokument nie został podpisany — dlaczego?"
          opis="Zapisze się na osi czasu klienta. To jedyne miejsce, z którego da się kiedyś odczytać, na których zapisach umowy realnie się rozchodzicie."
          powody={CONTRACT_REJECT_REASONS}
          placeholder="Własnymi słowami (opcjonalnie) — np. „nie zgodzili się na przeniesienie praw dopiero po zapłacie”."
          onCancel={() => setRejectOpen(false)}
          onConfirm={(powod, komentarz) => {
            setRejectOpen(false);
            void zapiszStatus("Odrzucona", powod, komentarz);
          }}
        />
      </Modal>

      {oknoBramki}
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
