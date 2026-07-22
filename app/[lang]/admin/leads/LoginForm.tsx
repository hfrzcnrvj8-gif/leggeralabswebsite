"use client";

import { useState } from "react";

// Logowanie do panelu. Od Modułu 41 (2026-07-22) dwuetapowe, gdy właściciel
// włączył drugi składnik: hasło → sześć cyfr z aplikacji.
//
// Drugi etap pojawia się WYŁĄCZNIE w odpowiedzi na `kod_wymagany: true`
// z serwera — panel nigdy nie zgaduje sam z siebie, czy 2FA jest włączone.
// To celowe: gdyby przeglądarka pytała o kod „bo tak jej się wydaje", pomyłka
// w tę stronę wyglądałaby jak zepsute logowanie, a w drugą — jak ochrona,
// której nie ma.

type Etap = "haslo" | "kod";

export function LoginForm() {
  const [etap, setEtap] = useState<Etap>("haslo");
  const [password, setPassword] = useState("");
  const [kod, setKod] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setBlad(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Hasło leci również w drugim kroku: serwer sprawdza je za każdym
        // razem od nowa, żeby między krokami nie powstawał żaden stan
        // pośredni („hasło już zaakceptowane"), który dałoby się wykorzystać.
        body: JSON.stringify(etap === "kod" ? { password, kod } : { password }),
      });
      if (res.ok) {
        window.location.reload();
        return;
      }
      const dane = (await res.json().catch(() => ({}))) as { error?: string; kod_wymagany?: boolean };
      if (dane.kod_wymagany) {
        // Pierwsze wejście w drugi etap: hasło było poprawne, więc nie
        // pokazujemy tego jako błędu.
        const pierwszeWejscie = etap === "haslo";
        setEtap("kod");
        setKod("");
        setBlad(pierwszeWejscie ? null : dane.error ?? "Kod się nie zgadza.");
      } else {
        setEtap("haslo");
        setBlad(dane.error && res.status === 429 ? dane.error : "Błędne hasło.");
      }
    } catch {
      setBlad("Brak połączenia z panelem.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-paper mx-auto mt-24 max-w-sm rounded-2xl border hairline p-8">
      <h1 className="text-lg font-semibold tracking-tight">Leggera Labs</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        {etap === "kod" ? "Drugi krok — kod z aplikacji." : "Dostęp tylko dla Leggera Labs."}
      </p>
      <form onSubmit={submit} className="space-y-3">
        {etap === "haslo" ? (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Hasło"
            autoFocus
            className="w-full rounded-lg border hairline bg-transparent px-4 py-3 text-sm text-[var(--fg)] outline-none transition-colors focus:border-[#4ea7fc]/60"
          />
        ) : (
          <>
            <input
              value={kod}
              onChange={(e) => setKod(e.target.value)}
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              className="w-full rounded-lg border hairline bg-transparent px-4 py-3 text-center text-lg tracking-[0.3em] text-[var(--fg)] outline-none transition-colors focus:border-[#4ea7fc]/60"
            />
            <p className="text-xs text-muted">
              Nie masz telefonu pod ręką? Wpisz tutaj jeden ze swoich kodów zapasowych z wydruku.
            </p>
          </>
        )}
        {blad && <p className="text-xs text-red-400">{blad}</p>}
        <button
          type="submit"
          disabled={loading || (etap === "haslo" ? !password : !kod)}
          className="w-full rounded-md bg-[var(--fg)] px-4 py-3 text-sm font-medium text-[var(--bg)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Sprawdzam…" : etap === "kod" ? "Potwierdź" : "Zaloguj"}
        </button>
        {etap === "kod" && (
          <button
            type="button"
            onClick={() => {
              setEtap("haslo");
              setPassword("");
              setKod("");
              setBlad(null);
            }}
            className="w-full text-center text-xs text-muted hover:text-[var(--fg)]"
          >
            Wróć do hasła
          </button>
        )}
      </form>
    </div>
  );
}
