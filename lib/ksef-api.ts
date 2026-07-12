// KSeF 2.0 — klient uwierzytelniania (Krok 3 Fazy 2). PIERWSZY moduł, który
// łączy się z siecią — ale wyłącznie z serwerami TESTOWYMI Ministerstwa
// Finansów. Twarda bramka niżej (assertTestOnly) sprawia, że produkcja jest
// technicznie nieosiągalna, dopóki właściciel świadomie jej nie odblokuje po
// rejestracji firmy (patrz PO_REJESTRACJI.md).
//
// Przepływ (token KSeF, bez podpisu kwalifikowanego — ścieżka dla testów), wg
// oficjalnej dokumentacji CIRFMF/ksef-docs:
//   1. GET  /security/public-key-certificates → klucz publiczny (KsefTokenEncryption)
//   2. POST /auth/challenge                    → { challenge, timestamp }
//   3. szyfrujemy `{token}|{timestamp}` RSA-OAEP SHA-256 → Base64
//   4. POST /auth/ksef-token                   → { referenceNumber, authenticationToken }
//   5. GET  /auth/{referenceNumber} (Bearer)   → status uwierzytelnienia
//   6. POST /auth/token/redeem (Bearer)        → { accessToken, refreshToken }
//
// Ten moduł NIE jest "use client" i używa node:crypto — importować tylko z
// route'ów serwerowych (runtime = "nodejs").

import crypto from "node:crypto";

export type KsefEnv = "test" | "prod";

/** Adresy bazowe API KSeF 2.0. Produkcyjny jest tu WYŁĄCZNIE jako stała — kod
 * go nie użyje, dopóki bramka na to nie pozwoli (patrz assertTestOnly). */
const KSEF_BASE_URLS: Record<KsefEnv, string> = {
  test: "https://api-test.ksef.mf.gov.pl/api/v2",
  prod: "https://api.ksef.mf.gov.pl/api/v2",
};

export type KsefConfig = {
  env: KsefEnv;
  baseUrl: string;
  token: string;
  /** NIP kontekstu (podmiot testowy) — na środowisku testowym NIE jest to NIP
   * właściciela: firma nie jest jeszcze zarejestrowana. */
  nip: string;
};

/**
 * BRAMKA BEZPIECZEŃSTWA. Rzuca czytelnym błędem przy każdej próbie użycia
 * środowiska produkcyjnego. Produkcję odblokuje się świadomie, osobnym krokiem
 * po rejestracji firmy — nigdy przypadkiem i nigdy automatem. Przez całą Fazę 2
 * po prostu NIE MA ścieżki, którą prawdziwa faktura mogłaby wyjść do urzędu.
 */
function assertTestOnly(env: KsefEnv): void {
  if (env !== "test") {
    throw new Error(
      "KSeF: tryb produkcyjny jest zablokowany. Faza 2 działa wyłącznie na środowisku testowym MF. " +
        "Produkcję można włączyć dopiero po rejestracji firmy (patrz PO_REJESTRACJI.md)."
    );
  }
}

/** Czyta konfigurację KSeF ze zmiennych środowiskowych i waliduje ją. Zwraca
 * czytelny komunikat, gdy czegoś brakuje — właściciel wie dokładnie, co
 * ustawić. Domyślnie i wyłącznie środowisko testowe. */
export function getKsefConfig(): KsefConfig {
  const env = (process.env.KSEF_ENV || "test") as KsefEnv;
  assertTestOnly(env);
  const token = process.env.KSEF_TEST_TOKEN || "";
  const nip = (process.env.KSEF_TEST_NIP || "").replace(/[^0-9]/g, "");
  const missing: string[] = [];
  if (!token) missing.push("KSEF_TEST_TOKEN (token wygenerowany w testowej aplikacji KSeF)");
  if (!nip) missing.push("KSEF_TEST_NIP (NIP podmiotu testowego)");
  if (missing.length) {
    throw new Error("KSeF: brak konfiguracji środowiska testowego — ustaw: " + missing.join(", ") + ".");
  }
  if (nip.length !== 10) throw new Error("KSeF: KSEF_TEST_NIP musi mieć 10 cyfr.");
  return { env, baseUrl: process.env.KSEF_BASE_URL || KSEF_BASE_URLS[env], token, nip };
}

type PublicKeyCertificate = {
  certificate?: string; // Base64 (DER) lub PEM
  publicKey?: string;
  usage?: string[];
};

/** Zamienia zwróconą wartość (PEM certyfikatu, PEM klucza lub gołe Base64 DER)
 * na obiekt klucza publicznego node:crypto. */
function toPublicKey(cert: PublicKeyCertificate): crypto.KeyObject {
  const raw = (cert.certificate || cert.publicKey || "").trim();
  if (!raw) throw new Error("KSeF: certyfikat szyfrujący nie zawiera klucza.");
  if (raw.includes("BEGIN CERTIFICATE")) return crypto.createPublicKey(raw);
  if (raw.includes("BEGIN PUBLIC KEY")) return crypto.createPublicKey(raw);
  // Gołe Base64 — traktuj jako DER certyfikatu X.509.
  const pem = `-----BEGIN CERTIFICATE-----\n${raw.replace(/(.{64})/g, "$1\n")}\n-----END CERTIFICATE-----\n`;
  return crypto.createPublicKey(pem);
}

/** Pobiera z API klucz publiczny przeznaczony do szyfrowania tokena KSeF
 * (usage zawiera "KsefTokenEncryption"). */
export async function fetchTokenEncryptionKey(baseUrl: string): Promise<crypto.KeyObject> {
  const res = await fetch(`${baseUrl}/security/public-key-certificates`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`KSeF: nie udało się pobrać certyfikatów (HTTP ${res.status}).`);
  const data = (await res.json()) as PublicKeyCertificate[] | { certificates?: PublicKeyCertificate[] };
  const list = Array.isArray(data) ? data : data.certificates ?? [];
  const cert = list.find((c) => (c.usage || []).includes("KsefTokenEncryption"));
  if (!cert) throw new Error("KSeF: brak certyfikatu z przeznaczeniem KsefTokenEncryption.");
  return toPublicKey(cert);
}

/** Szyfruje ciąg `{token}|{timestamp}` algorytmem RSA-OAEP (SHA-256, MGF1-
 * SHA256) i zwraca Base64 — dokładnie jak wymaga API KSeF 2.0. */
export function encryptKsefToken(token: string, timestampMs: number, key: crypto.KeyObject): string {
  const plaintext = Buffer.from(`${token}|${timestampMs}`, "utf8");
  const encrypted = crypto.publicEncrypt(
    { key, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
    plaintext
  );
  return encrypted.toString("base64");
}

export type KsefAuthResult = {
  referenceNumber: string;
  accessToken: string;
  refreshToken: string;
  status: string;
};

async function postJson(url: string, body: unknown, bearer?: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!res.ok) {
    const msg = (json.message || json.error || text || `HTTP ${res.status}`) as string;
    throw new Error(`KSeF: ${msg}`);
  }
  return json;
}

/**
 * Pełne uwierzytelnienie tokenem KSeF na środowisku TESTOWYM. Zwraca
 * accessToken/refreshToken do dalszych operacji (wysyłka faktur w Kroku 4).
 * Bramka assertTestOnly wywoła się przez getKsefConfig przed jakimkolwiek
 * ruchem sieciowym.
 */
export async function authenticateWithToken(cfg: KsefConfig): Promise<KsefAuthResult> {
  assertTestOnly(cfg.env);

  // 1–2: klucz publiczny + challenge.
  const key = await fetchTokenEncryptionKey(cfg.baseUrl);
  const challengeRes = await postJson(`${cfg.baseUrl}/auth/challenge`, {});
  const challenge = String(challengeRes.challenge || "");
  const timestamp = Number(challengeRes.timestamp || challengeRes.timestampMs || 0);
  if (!challenge || !timestamp) throw new Error("KSeF: niekompletna odpowiedź /auth/challenge.");

  // 3–4: szyfrujemy token i wysyłamy żądanie uwierzytelnienia.
  const encryptedToken = encryptKsefToken(cfg.token, timestamp, key);
  const authRes = await postJson(`${cfg.baseUrl}/auth/ksef-token`, {
    challenge,
    contextIdentifier: { type: "nip", value: cfg.nip },
    encryptedToken,
  });
  const referenceNumber = String(authRes.referenceNumber || "");
  const authenticationToken = String(authRes.authenticationToken || "");
  if (!referenceNumber || !authenticationToken) {
    throw new Error("KSeF: niekompletna odpowiedź /auth/ksef-token.");
  }

  // 5: odpytujemy o status aż do sukcesu (lub błędu / limitu prób).
  let statusText = "";
  for (let attempt = 0; attempt < 10; attempt++) {
    const res = await fetch(`${cfg.baseUrl}/auth/${referenceNumber}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${authenticationToken}` },
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const status = (json.status || {}) as Record<string, unknown>;
    const code = Number(status.code || 0);
    statusText = String(status.description || "");
    if (code === 200) break; // uwierzytelnienie zakończone sukcesem
    if (code >= 400) throw new Error(`KSeF: uwierzytelnienie odrzucone — ${statusText || code}.`);
    await new Promise((r) => setTimeout(r, 1500));
  }

  // 6: wymiana na właściwe tokeny operacyjne.
  const redeem = await postJson(`${cfg.baseUrl}/auth/token/redeem`, {}, authenticationToken);
  const accessToken = String(redeem.accessToken || "");
  const refreshToken = String(redeem.refreshToken || "");
  if (!accessToken) throw new Error("KSeF: /auth/token/redeem nie zwrócił accessToken.");

  return { referenceNumber, accessToken, refreshToken, status: statusText || "OK" };
}
