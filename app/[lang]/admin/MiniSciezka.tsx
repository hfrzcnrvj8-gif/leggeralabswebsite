"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import { SciezkaDokumentow, type WezelSciezki } from "./SciezkaDokumentow";

/**
 * Mini-mapa w profilu dokumentu: „z czego wynikasz i co z Ciebie poszło".
 *
 * **Po co.** Drzewko żyło wyłącznie na karcie klienta, więc pytanie, które pada
 * przy OTWARTYM dokumencie („czy do tej umowy jest już faktura?"), wymagało
 * wyjścia, znalezienia klienta i powrotu. Tu odpowiada w miejscu, w którym
 * pada — i tym samym komponentem, więc nie ma dwóch wyglądów tego samego.
 *
 * **Dociągane osobnym żądaniem, po otwarciu profilu.** Wątek wymaga zebrania
 * dokumentów całego klienta; doklejenie go do `GET` każdego dokumentu
 * kosztowałoby cztery zapytania przy każdym wejściu w edytor, także wtedy, gdy
 * nikt na mapę nie patrzy.
 *
 * **Milczy, gdy nie ma czego pokazać** (dokument bez powiązań) — jeden kafelek
 * z samym sobą nie jest mapą, tylko ozdobą.
 */
export function MiniSciezka({
  rodzaj,
  id,
  lang,
}: {
  rodzaj: "offer" | "contract" | "project" | "invoice";
  id: string;
  lang: Locale;
}) {
  const [wezly, setWezly] = useState<WezelSciezki[] | null>(null);

  useEffect(() => {
    let anulowane = false;
    setWezly(null);
    fetch(`/api/sciezka/${rodzaj}/${id}`)
      .then((r) => (r.ok ? r.json() : { wezly: [] }))
      .then((d: { wezly?: WezelSciezki[] }) => {
        if (!anulowane) setWezly(d.wezly ?? []);
      })
      .catch(() => {
        if (!anulowane) setWezly([]);
      });
    return () => {
      anulowane = true;
    };
  }, [rodzaj, id]);

  if (!wezly || wezly.length < 2) return null;

  return (
    <div className="mt-4">
      <h3 className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">Skąd i dokąd</h3>
      <SciezkaDokumentow wezly={wezly} lang={lang} aktywny={id} />
    </div>
  );
}
