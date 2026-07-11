"use client";

import { useState } from "react";

export function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      window.location.reload();
    } else {
      setError(true);
    }
  };

  return (
    <div className="card-paper mx-auto mt-24 max-w-sm rounded-2xl border hairline p-8">
      <h1 className="text-lg font-semibold tracking-tight">Leggera Labs</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Dostęp tylko dla Leggera Labs.</p>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Hasło"
          autoFocus
          className="w-full rounded-lg border hairline bg-transparent px-4 py-3 text-sm text-[var(--fg)] outline-none transition-colors focus:border-[#4ea7fc]/60"
        />
        {error && <p className="text-xs text-red-400">Błędne hasło.</p>}
        <button
          type="submit"
          disabled={loading || !password}
          className="w-full rounded-md bg-[var(--fg)] px-4 py-3 text-sm font-medium text-[var(--bg)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Sprawdzam…" : "Zaloguj"}
        </button>
      </form>
    </div>
  );
}
