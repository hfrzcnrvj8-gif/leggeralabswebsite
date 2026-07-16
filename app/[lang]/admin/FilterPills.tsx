"use client";

// Pigułki filtrowania listy (zakładki „Do odpowiedzi”/„VIP” w Poczcie, tagi w
// Notatniku). Audyt wizualny 2026-07-16 (Moduł 21): każdy moduł malował stan
// aktywny inaczej — Poczta płaskim `--hairline`, Notatnik odwróconą bielą
// `--fg` — i żaden nie sięgał po gradient marki. Tu jest jeden wygląd,
// z akcentem purpura→złoto (`.pill-active`, globals.css).
//
// Rozmiar jest parametrem, bo Poczta ma pigułki nad listą (większe, 12 px),
// a Notatnik pod polem notatki (drobniejsze, 11 px) — to świadoma różnica
// gęstości, nie niespójność do wyrównania.
export function FilterPills<T extends string>({
  value,
  onChange,
  pills,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  pills: { id: T; label: string }[];
  size?: "sm" | "md";
}) {
  return (
    <>
      {pills.map((p) => (
        <button
          key={p.id}
          onClick={() => onChange(p.id)}
          className={`rounded-full transition-colors ${
            size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1 text-[12px]"
          } ${
            value === p.id
              ? "pill-active font-medium"
              : // Obramowanie przezroczyste, nie brak obramowania — `.pill-active`
                // ma 1 px ramki, więc bez tego pigułka skakałaby o piksel przy
                // każdym przełączeniu. Widoczny obrys na nieaktywnych dawał rząd
                // sześciu obwódek naraz (sprawdzone wzrokowo) — za dużo szumu.
                "border border-transparent text-muted hover:bg-[var(--hairline)]/40 hover:text-[var(--fg)]"
          }`}
        >
          {p.label}
        </button>
      ))}
    </>
  );
}
