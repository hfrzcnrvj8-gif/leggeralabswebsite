"use client";

import { useCallback, useEffect, useState } from "react";
import { Popover, MenuRow } from "./Menu";
import { offerReference, type Offer } from "@/lib/offers";
import { contractReference, CONTRACT_TYP_LABEL, type Contract } from "@/lib/contracts";

/**
 * Wybór dokumentu-ŹRÓDŁA: „ta faktura wynika z tej umowy", „ta umowa z tej
 * oferty".
 *
 * **Po co osobny komponent zamiast `LinkPicker`.** Tamten obsługuje wyłącznie
 * klienta, leada i projekt (`lib/links.ts` → `LinkKind`) i jest WYŁĄCZNY
 * w obrębie swoich rodzajów: wybór jednego czyści pozostałe. Tu relacja jest
 * inna — faktura może wynikać naraz z oferty i z umowy, a jedno nie unieważnia
 * drugiego. Dopisanie tego do `LinkKind` zmieniłoby zachowanie pickera
 * w czterech innych modułach.
 *
 * **Dlaczego to w ogóle powstało** (2026-07-27): ścieżka dokumentów na karcie
 * klienta rysuje się z JAWNYCH powiązań, a te wypełniają się automatycznie
 * tylko przy nowych dokumentach (umowa z oferty, zaliczka z umowy). Wszystko,
 * co powstało wcześniej albo ręcznie, było nie do połączenia — łańcuch pokazywał
 * osobne, samotne wątki i nie dało się tego naprawić z panelu.
 *
 * Lista jest **zawężona do tego samego klienta**, bo powiązanie dokumentu
 * z cudzą ofertą to nie funkcja, tylko pomyłka.
 */
export function DocLinkPicker({
  rodzaj,
  clientId,
  value,
  onPick,
  disabled,
}: {
  rodzaj: "offer" | "contract";
  clientId: string | null;
  value: string | null;
  onPick: (id: string | null) => void;
  disabled?: boolean;
}) {
  const [items, setItems] = useState<{ id: string; label: string; status: string }[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(rodzaj === "offer" ? "/api/offers" : "/api/contracts");
    if (!res.ok) {
      setItems([]);
      return;
    }
    const data = (await res.json()) as { offers?: Offer[]; contracts?: Contract[] };
    if (rodzaj === "offer") {
      setItems(
        (data.offers ?? [])
          .filter((o) => !clientId || o.client_id === clientId)
          .map((o) => ({ id: o.id, label: `${offerReference(o)} — ${o.tytul || "(bez tytułu)"}`, status: o.status }))
      );
      return;
    }
    setItems(
      (data.contracts ?? [])
        .filter((c) => (!clientId || c.client_id === clientId) && c.typ !== "aneks")
        .map((c) => ({
          id: c.id,
          label: `${contractReference(c)} — ${CONTRACT_TYP_LABEL[c.typ] ?? "Umowa"}`,
          status: c.status,
        }))
    );
  }, [rodzaj, clientId]);

  // Dociągamy dopiero przy otwarciu — profil dokumentu nie ma płacić dwóch
  // żądań za picker, którego zwykle nikt nie otwiera.
  useEffect(() => {
    if (items === null && value) void load();
  }, [items, value, load]);

  const wybrany = items?.find((i) => i.id === value);
  const etykieta = value ? (wybrany ? wybrany.label.split(" — ")[0] : "wybrany") : "— brak —";

  return (
    <Popover
      align="right"
      width={320}
      trigger={(open) => (
        <button
          onClick={() => {
            if (disabled) return;
            void load();
            open();
          }}
          disabled={disabled}
          className="rounded-md px-1.5 py-0.5 -mx-1.5 text-[13px] text-[var(--fg)] hover:bg-[var(--hairline)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {etykieta}
        </button>
      )}
    >
      {(close) => (
        <div className="max-h-72 overflow-y-auto">
          <MenuRow
            label="— brak —"
            selected={!value}
            onClick={() => {
              onPick(null);
              close();
            }}
          />
          {items === null && <div className="px-3 py-2 text-[12px] text-muted">Wczytywanie…</div>}
          {items !== null && items.length === 0 && (
            <div className="px-3 py-2 text-[12px] text-muted">
              {clientId
                ? `Ten klient nie ma jeszcze ${rodzaj === "offer" ? "żadnej oferty" : "żadnej umowy"}.`
                : "Najpierw przypnij dokument do klienta."}
            </div>
          )}
          {items?.map((i) => (
            <MenuRow
              key={i.id}
              label={`${i.label} · ${i.status}`}
              selected={value === i.id}
              onClick={() => {
                onPick(i.id);
                close();
              }}
            />
          ))}
        </div>
      )}
    </Popover>
  );
}
