// Wspólny, minimalny klient do lokalnej Ollamy (przez Tailscale Funnel) —
// wzorowany na lib/email.ts. Server-only, żadnych chmurowych API modeli.
// Model zawsze proponuje treść do zatwierdzenia przez właściciela — nigdy
// nie decyduje/wysyła/zapisuje nic sam (patrz CLAUDE.md).
//
// Panel MUSI działać dalej bez AI: każda funkcja tutaj łapie błędy/timeout
// i zwraca null zamiast rzucać — wołający decyduje, co pokazać w UI.

const DEFAULT_TIMEOUT_MS = 12_000;

function authHeaders(): Record<string, string> {
  const secret = process.env.OLLAMA_API_SECRET;
  return secret ? { Authorization: `Bearer ${secret}` } : {};
}

function baseUrl(): string | null {
  const url = process.env.OLLAMA_API_URL;
  return url ? url.replace(/\/+$/, "") : null;
}

/** Generuje odpowiedź modelu. Zwraca null przy braku konfiguracji, błędzie lub timeoucie. */
export async function ollamaGenerate(opts: {
  model: string;
  prompt: string;
  system?: string;
  timeoutMs?: number;
}): Promise<string | null> {
  const url = baseUrl();
  if (!url) {
    console.error("[ollamaGenerate] brak OLLAMA_API_URL w env — pomijam wywołanie");
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(`${url}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        model: opts.model,
        prompt: opts.prompt,
        ...(opts.system ? { system: opts.system } : {}),
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(`[ollamaGenerate] proxy zwrócił ${res.status}`);
      return null;
    }
    const data = (await res.json().catch(() => null)) as { response?: string } | null;
    return typeof data?.response === "string" ? data.response : null;
  } catch (err) {
    console.error("[ollamaGenerate] błąd wywołania", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Jak ollamaGenerate, ale dla modeli wizyjnych — obraz jako base64 (bez
 * prefiksu "data:...") w polu `images` (Ollama /api/generate). Używane np.
 * do OCR paragonów/faktur (Moduł 8) — model tylko proponuje, nigdy nie
 * zapisuje/decyduje sam. */
export async function ollamaGenerateWithImage(opts: {
  model: string;
  prompt: string;
  imageBase64: string;
  system?: string;
  timeoutMs?: number;
}): Promise<string | null> {
  const url = baseUrl();
  if (!url) {
    console.error("[ollamaGenerateWithImage] brak OLLAMA_API_URL w env — pomijam wywołanie");
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(`${url}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        model: opts.model,
        prompt: opts.prompt,
        images: [opts.imageBase64],
        ...(opts.system ? { system: opts.system } : {}),
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(`[ollamaGenerateWithImage] proxy zwrócił ${res.status}`);
      return null;
    }
    const data = (await res.json().catch(() => null)) as { response?: string } | null;
    return typeof data?.response === "string" ? data.response : null;
  } catch (err) {
    console.error("[ollamaGenerateWithImage] błąd wywołania", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Sprawdza dostępność proxy/Ollamy i listę modeli. Nigdy nie rzuca. */
export async function ollamaHealth(timeoutMs = 6_000): Promise<{ available: boolean; models: string[] }> {
  const url = baseUrl();
  if (!url) return { available: false, models: [] };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${url}/api/tags`, {
      headers: authHeaders(),
      signal: controller.signal,
    });
    if (!res.ok) return { available: false, models: [] };
    const data = (await res.json().catch(() => null)) as { models?: { name: string }[] } | null;
    const models = Array.isArray(data?.models) ? data.models.map((m) => m.name).filter(Boolean) : [];
    return { available: true, models };
  } catch (err) {
    console.error("[ollamaHealth] błąd wywołania", err);
    return { available: false, models: [] };
  } finally {
    clearTimeout(timer);
  }
}
