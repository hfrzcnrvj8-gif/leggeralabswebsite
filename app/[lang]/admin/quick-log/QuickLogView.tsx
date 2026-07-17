"use client";

import { useState } from "react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { ContactMatch } from "@/app/api/contacts/lookup/route";
import {
  CONTACT_CHANNELS,
  CONTACT_CHANNEL_LABEL,
  CONTACT_DIRECTIONS,
  CONTACT_DIRECTION_LABEL,
  CALL_OUTCOMES,
  CALL_OUTCOME_LABEL,
  CALL_OUTCOME_CLASS,
} from "@/lib/contact";
import { IconClipboard, IconCheck } from "@tabler/icons-react";
import { CallOutcomeIcon } from "../icons";
import { PillPicker } from "../components";
import { useUI } from "../ui";
import { todayLocalISO } from "@/lib/dates";

type Step = "phone" | "matches" | "compose" | "done";

/**
 * Opcja A (docs/plany-modulow/03-kanaly-kontaktu.md) — mobilna "szybka
 * notatka": wklej numer → wybierz dopasowanego leada/klienta → zaloguj
 * kontakt, bez przewijania do konkretnego rekordu. Zapisuje przez te same
 * endpointy co panel leada/klienta (`/api/leads/:id/activity`,
 * `/api/clients/:id/activity`) — żadnej nowej logiki zapisu, tylko krótsza
 * ścieżka do niej.
 */
export function QuickLogView({ lang }: { lang: Locale }) {
  const { toast } = useUI();
  const [step, setStep] = useState<Step>("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [matches, setMatches] = useState<ContactMatch[]>([]);
  const [selected, setSelected] = useState<ContactMatch | null>(null);
  const [looking, setLooking] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [channel, setChannel] = useState("telefon");
  const [direction, setDirection] = useState("wychodzacy");
  const [outcome, setOutcome] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [durationSec, setDurationSec] = useState("");
  const [saving, setSaving] = useState(false);

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setPhoneInput(text.trim());
    } catch {
      toast("Nie udało się odczytać schowka — wklej numer ręcznie.", "error");
    }
  };

  const lookup = async () => {
    if (!phoneInput.trim()) return;
    setLooking(true);
    const res = await fetch(`/api/contacts/lookup?telefon=${encodeURIComponent(phoneInput.trim())}`);
    setLooking(false);
    if (!res.ok) {
      toast("Nie udało się wyszukać.", "error");
      return;
    }
    const data = (await res.json()) as { matches: ContactMatch[] };
    setMatches(data.matches);
    setStep("matches");
    if (data.matches.length === 1) {
      setSelected(data.matches[0]);
      setStep("compose");
    }
  };

  const reset = () => {
    setStep("phone");
    setPhoneInput("");
    setMatches([]);
    setSelected(null);
    setNoteText("");
    setChannel("telefon");
    setDirection("wychodzacy");
    setOutcome("");
    setDurationMin("");
    setDurationSec("");
  };

  const submit = async () => {
    if (!selected || !noteText.trim()) return;
    setSaving(true);
    const durationSecTotal = outcome === "odebrane" ? (Number(durationMin) || 0) * 60 + (Number(durationSec) || 0) : null;
    const endpoint = selected.type === "lead" ? `/api/leads/${selected.id}/activity` : `/api/clients/${selected.id}/activity`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: noteText.trim(),
        kanal: channel || null,
        kierunek: direction || null,
        wynik: outcome || null,
        czas_trwania_sek: durationSecTotal,
        ostatni_kontakt: todayLocalISO(),
      }),
    });
    setSaving(false);
    if (res.ok) {
      setStep("done");
      toast("Zapisano wpis.");
    } else {
      toast("Nie udało się zapisać wpisu.", "error");
    }
  };

  return (
    <div className="mx-auto max-w-md py-2">
      <h1 className="mb-4 text-lg font-semibold">Szybka notatka</h1>

      {step === "phone" && (
        <div className="space-y-3">
          <p className="text-sm text-muted">Wklej numer telefonu, żeby znaleźć leada albo klienta.</p>
          <input
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
            inputMode="tel"
            placeholder="np. 600 100 200"
            className="w-full rounded-xl border hairline bg-transparent px-3 py-3 text-base text-[var(--fg)] placeholder:text-muted"
          />
          <div className="flex gap-2">
            <button
              onClick={pasteFromClipboard}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full border hairline px-3 text-sm text-[var(--fg)] hover:bg-[var(--hairline)]"
            >
              <IconClipboard size={15} /> Wklej ze schowka
            </button>
            <button
              onClick={lookup}
              disabled={looking || !phoneInput.trim()}
              className="min-h-[44px] flex-1 rounded-full bg-[var(--fg)] px-3 text-sm font-semibold text-[var(--bg)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {looking ? "Szukam…" : "Szukaj"}
            </button>
          </div>
        </div>
      )}

      {step === "matches" && (
        <div className="space-y-2">
          <button onClick={() => setStep("phone")} className="mb-1 text-xs text-muted hover:text-[var(--fg)]">
            ← Zmień numer
          </button>
          {matches.length === 0 ? (
            <p className="text-sm text-muted">
              Nie znaleziono leada ani klienta z tym numerem. Dodaj kontakt ręcznie w{" "}
              <Link href={`/${lang}/admin/leads`} className="underline">
                Leadach
              </Link>
              , a potem wróć tutaj.
            </p>
          ) : (
            matches.map((m) => (
              <button
                key={`${m.type}:${m.id}`}
                onClick={() => {
                  setSelected(m);
                  setStep("compose");
                }}
                className="flex min-h-[44px] w-full items-center justify-between rounded-xl border hairline px-3 py-2 text-left text-sm hover:bg-[var(--hairline)]"
              >
                <span>{m.nazwa}</span>
                <span className="text-[11px] text-muted">{m.type === "lead" ? "Lead" : "Klient"}</span>
              </button>
            ))
          )}
        </div>
      )}

      {step === "compose" && selected && (
        <div className="space-y-3">
          <button onClick={() => setStep(matches.length > 1 ? "matches" : "phone")} className="text-xs text-muted hover:text-[var(--fg)]">
            ← Zmień
          </button>
          <div className="rounded-xl border hairline p-3">
            <div className="text-[11px] text-muted">{selected.type === "lead" ? "Lead" : "Klient"}</div>
            <div className="text-base font-medium">{selected.nazwa}</div>
          </div>

          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Co się wydarzyło? (użyj mikrofonu na klawiaturze, żeby podyktować)"
            rows={3}
            autoFocus
            className="w-full rounded-xl border hairline bg-transparent px-3 py-2 text-base text-[var(--fg)] placeholder:text-muted"
          />

          <div className="flex flex-wrap items-center gap-2">
            <PillPicker
              value={channel ? CONTACT_CHANNEL_LABEL[channel as keyof typeof CONTACT_CHANNEL_LABEL] : ""}
              options={CONTACT_CHANNELS.map((c) => CONTACT_CHANNEL_LABEL[c])}
              onChange={(label) => {
                const found = CONTACT_CHANNELS.find((c) => CONTACT_CHANNEL_LABEL[c] === label);
                setChannel(found ?? "");
              }}
              placeholder="Kanał — wybierz"
              title="Jakim kanałem?"
            />
            <div className="flex overflow-hidden rounded-full border hairline text-[11px]">
              {CONTACT_DIRECTIONS.map((dir) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => setDirection(dir)}
                  className={`min-h-[36px] px-3 ${
                    direction === dir ? "bg-[var(--fg)] text-[var(--bg)]" : "text-muted hover:bg-[var(--hairline)]"
                  }`}
                >
                  {CONTACT_DIRECTION_LABEL[dir]}
                </button>
              ))}
            </div>
          </div>

          {channel === "telefon" && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex overflow-hidden rounded-full border hairline text-[11px]">
                {CALL_OUTCOMES.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setOutcome(o)}
                    className={`flex min-h-[36px] items-center gap-1 px-3 ${
                      outcome === o ? `${CALL_OUTCOME_CLASS[o]} font-medium` : "text-muted hover:bg-[var(--hairline)]"
                    }`}
                  >
                    <CallOutcomeIcon kind={o} size={14} />
                    {CALL_OUTCOME_LABEL[o]}
                  </button>
                ))}
              </div>
              {outcome === "odebrane" && (
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <input
                    type="number"
                    min={0}
                    value={durationMin}
                    onChange={(e) => setDurationMin(e.target.value)}
                    placeholder="0"
                    className="w-14 rounded-md border hairline bg-transparent px-2 py-2 text-center text-base text-[var(--fg)]"
                  />
                  min
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={durationSec}
                    onChange={(e) => setDurationSec(e.target.value)}
                    placeholder="0"
                    className="w-14 rounded-md border hairline bg-transparent px-2 py-2 text-center text-base text-[var(--fg)]"
                  />
                  s
                </div>
              )}
            </div>
          )}

          <button
            onClick={submit}
            disabled={saving || !noteText.trim()}
            className="min-h-[48px] w-full rounded-full bg-[var(--fg)] text-base font-semibold text-[var(--bg)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Zapisuję…" : "Zapisz wpis"}
          </button>
        </div>
      )}

      {step === "done" && selected && (
        <div className="space-y-4 text-center">
          <p className="flex items-center justify-center gap-1.5 text-sm text-muted"><IconCheck size={15} className="text-emerald-400" />Zapisano wpis dla {selected.nazwa}.</p>
          <button
            onClick={reset}
            className="min-h-[48px] w-full rounded-full border hairline text-base font-medium text-[var(--fg)] hover:bg-[var(--hairline)]"
          >
            Zaloguj kolejny kontakt
          </button>
        </div>
      )}
    </div>
  );
}
