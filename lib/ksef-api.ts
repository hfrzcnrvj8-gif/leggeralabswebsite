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

/** Szyfruje surowe bajty algorytmem RSA-OAEP (SHA-256, MGF1-SHA256) i zwraca
 * Base64 — jedyny algorytm asymetryczny, którego używa API KSeF 2.0 (zarówno
 * do tokena uwierzytelniającego, jak i do klucza symetrycznego sesji). */
function rsaEncryptToBase64(data: Buffer, key: crypto.KeyObject): string {
  const encrypted = crypto.publicEncrypt(
    { key, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
    data
  );
  return encrypted.toString("base64");
}

/** Szyfruje ciąg `{token}|{timestamp}` algorytmem RSA-OAEP (SHA-256, MGF1-
 * SHA256) i zwraca Base64 — dokładnie jak wymaga API KSeF 2.0. */
export function encryptKsefToken(token: string, timestampMs: number, key: crypto.KeyObject): string {
  return rsaEncryptToBase64(Buffer.from(`${token}|${timestampMs}`, "utf8"), key);
}

export type KsefAuthResult = {
  referenceNumber: string;
  accessToken: string;
  refreshToken: string;
  status: string;
};

/** Wyciąga surowy token z pola TokenInfo `{ token, validUntil }` zwracanego
 * przez API KSeF. Toleruje też goły string (odporność na drobne różnice). */
function readTokenInfo(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && typeof (v as { token?: unknown }).token === "string") {
    return (v as { token: string }).token;
  }
  return "";
}

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
  // API zwraca `timestampMs` (liczba ms) oraz `timestamp` (tekst ISO). Do
  // szyfrowania potrzebujemy milisekund — bierzemy timestampMs, a gdyby go
  // brakło, parsujemy ISO na ms.
  const rawTs = challengeRes.timestampMs ?? challengeRes.timestamp;
  const timestamp = typeof rawTs === "number" ? rawTs : Date.parse(String(rawTs));
  if (!challenge || !Number.isFinite(timestamp) || timestamp <= 0) {
    throw new Error("KSeF: niekompletna odpowiedź /auth/challenge.");
  }

  // 3–4: szyfrujemy token i wysyłamy żądanie uwierzytelnienia.
  const encryptedToken = encryptKsefToken(cfg.token, timestamp, key);
  const authRes = await postJson(`${cfg.baseUrl}/auth/ksef-token`, {
    challenge,
    contextIdentifier: { type: "nip", value: cfg.nip },
    encryptedToken,
  });
  const referenceNumber = String(authRes.referenceNumber || "");
  // authenticationToken to obiekt TokenInfo { token, validUntil } — bierzemy
  // samo `token` (tak samo accessToken/refreshToken niżej).
  const authenticationToken = readTokenInfo(authRes.authenticationToken);
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

  // 6: wymiana na właściwe tokeny operacyjne (też TokenInfo { token, ... }).
  const redeem = await postJson(`${cfg.baseUrl}/auth/token/redeem`, {}, authenticationToken);
  const accessToken = readTokenInfo(redeem.accessToken);
  const refreshToken = readTokenInfo(redeem.refreshToken);
  if (!accessToken) throw new Error("KSeF: /auth/token/redeem nie zwrócił accessToken.");

  return { referenceNumber, accessToken, refreshToken, status: statusText || "OK" };
}

// ===========================================================================
// Krok 4 — sesja interaktywna (online) + szyfrowana wysyłka faktury FA(3)
// ===========================================================================
//
// Przepływ sesji online wg OpenAPI KSeF 2.0 (środowisko testowe):
//   1. GET  /security/public-key-certificates → cert do szyfrowania klucza
//        symetrycznego (usage: SymmetricKeyEncryption) + jego publicKeyId
//   2. losujemy klucz AES-256 (32 B) i IV (16 B); klucz szyfrujemy RSA-OAEP
//   3. POST /sessions/online                  → otwarcie sesji (formCode FA(3)
//        + EncryptionInfo) → referenceNumber sesji
//   4. XML faktury szyfrujemy AES-256-CBC (PKCS#7) i wysyłamy z hashami:
//        POST /sessions/online/{ref}/invoices  → referenceNumber faktury
//   5. GET  /sessions/{ref}/invoices/{invRef}  → polling statusu → numer KSeF
//   6. GET  /sessions/{ref}/invoices/{invRef}/upo → UPO (best-effort)
//   7. POST /sessions/online/{ref}/close       → zamknięcie sesji
//
// Cała ścieżka przechodzi przez getKsefConfig/authenticateWithToken → bramka
// assertTestOnly gwarantuje, że nic nie wyjdzie na produkcję.

/** Kod formularza FA(3) — musi zgadzać się z <KodFormularza> w generowanym XML
 * (patrz buildFA3Xml w lib/ksef.ts). */
const FA3_FORM_CODE = { systemCode: "FA (3)", schemaVersion: "1-0E", value: "FA" } as const;

/** Cert do szyfrowania klucza symetrycznego sesji (usage SymmetricKeyEncryption).
 * Zwraca też publicKeyId, którym API rozpozna, którego klucza użyliśmy. */
async function fetchSymmetricKeyEncryptionCert(
  baseUrl: string
): Promise<{ key: crypto.KeyObject; publicKeyId: string }> {
  const res = await fetch(`${baseUrl}/security/public-key-certificates`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`KSeF: nie udało się pobrać certyfikatów (HTTP ${res.status}).`);
  const data = (await res.json()) as PublicKeyCertificate[] | { certificates?: PublicKeyCertificate[] };
  const list = Array.isArray(data) ? data : data.certificates ?? [];
  const cert = list.find((c) => (c.usage || []).includes("SymmetricKeyEncryption"));
  if (!cert) throw new Error("KSeF: brak certyfikatu z przeznaczeniem SymmetricKeyEncryption.");
  return { key: toPublicKey(cert), publicKeyId: (cert as { publicKeyId?: string }).publicKeyId || "" };
}

/** SHA-256 danych zakodowany Base64 — format hashy wymagany przez API KSeF. */
function sha256Base64(data: Buffer): string {
  return crypto.createHash("sha256").update(data).digest("base64");
}

/** Materiał szyfrujący jednej sesji: losowy klucz AES-256 + IV. */
export type SessionCrypto = { aesKey: Buffer; iv: Buffer };

function newSessionCrypto(): SessionCrypto {
  return { aesKey: crypto.randomBytes(32), iv: crypto.randomBytes(16) };
}

/** Szyfruje XML faktury AES-256-CBC z dopełnianiem PKCS#7 (domyślne w node)
 * i zwraca komplet metadanych wymaganych przez SendInvoiceRequest. */
function encryptInvoiceXml(xml: string, sc: SessionCrypto) {
  const plain = Buffer.from(xml, "utf8");
  const cipher = crypto.createCipheriv("aes-256-cbc", sc.aesKey, sc.iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  return {
    invoiceHash: sha256Base64(plain),
    invoiceSize: plain.length,
    encryptedInvoiceHash: sha256Base64(encrypted),
    encryptedInvoiceSize: encrypted.length,
    encryptedInvoiceContent: encrypted.toString("base64"),
  };
}

export type KsefSendResult = {
  sessionReference: string;
  invoiceReference: string;
  /** Numer KSeF nadany po przyjęciu (null, gdy odrzucono). */
  ksefNumber: string | null;
  /** Kod statusu przetwarzania faktury (200 = sukces, ≥400 = błąd). */
  statusCode: number;
  statusText: string;
  /** UPO (XML) — urzędowe poświadczenie odbioru; null, gdy niedostępne. */
  upo: string | null;
  accepted: boolean;
};

/**
 * Pełna wysyłka JEDNEJ faktury FA(3) do KSeF przez sesję online (środowisko
 * TESTOWE). Sam otwiera sesję, szyfruje i wysyła dokument, odpytuje o status,
 * pobiera UPO i zamyka sesję. Zwraca czytelny wynik — numer KSeF albo powód
 * odrzucenia. NIE zapisuje niczego do bazy; to robi route.
 */
export async function sendInvoiceToKsef(cfg: KsefConfig, xml: string): Promise<KsefSendResult> {
  assertTestOnly(cfg.env);

  // Uwierzytelnienie → accessToken do dalszych, autoryzowanych operacji.
  const auth = await authenticateWithToken(cfg);
  const bearer = auth.accessToken;

  // Klucz sesji: losowy AES-256 zaszyfrowany kluczem publicznym MF.
  const { key: rsaKey, publicKeyId } = await fetchSymmetricKeyEncryptionCert(cfg.baseUrl);
  const sc = newSessionCrypto();
  const encryption: Record<string, string> = {
    encryptedSymmetricKey: rsaEncryptToBase64(sc.aesKey, rsaKey),
    initializationVector: sc.iv.toString("base64"),
  };
  if (publicKeyId) encryption.publicKeyId = publicKeyId;

  // 3: otwarcie sesji online.
  const openRes = await postJson(`${cfg.baseUrl}/sessions/online`, {
    formCode: FA3_FORM_CODE,
    encryption,
  }, bearer);
  const sessionReference = String(openRes.referenceNumber || "");
  if (!sessionReference) throw new Error("KSeF: /sessions/online nie zwrócił numeru referencyjnego sesji.");

  try {
    // 4: szyfrujemy i wysyłamy fakturę.
    const payload = encryptInvoiceXml(xml, sc);
    const sendRes = await postJson(`${cfg.baseUrl}/sessions/online/${sessionReference}/invoices`, payload, bearer);
    const invoiceReference = String(sendRes.referenceNumber || "");
    if (!invoiceReference) throw new Error("KSeF: wysyłka faktury nie zwróciła numeru referencyjnego.");

    // 5: polling statusu przetwarzania (100/150 = w toku, 200 = sukces, ≥400 = błąd).
    let statusCode = 0;
    let statusText = "";
    let ksefNumber: string | null = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      const res = await fetch(
        `${cfg.baseUrl}/sessions/${sessionReference}/invoices/${invoiceReference}`,
        { headers: { Accept: "application/json", Authorization: `Bearer ${bearer}` } }
      );
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const status = (json.status || {}) as Record<string, unknown>;
      statusCode = Number(status.code || 0);
      // description = ogólny opis kodu; details[] = konkretny powód (np. które
      // pole XML / reguła XSD zawiodła). Sklejamy oba, żeby błąd był czytelny.
      const details = Array.isArray(status.details) ? (status.details as unknown[]).map(String) : [];
      statusText = [String(status.description || ""), ...details].filter(Boolean).join(" — ");
      ksefNumber = (json.ksefNumber as string | null) ?? null;
      if (statusCode === 200) break;
      if (statusCode >= 400) break;
      await new Promise((r) => setTimeout(r, 1500));
    }

    const accepted = statusCode === 200;

    // 6: UPO faktury (best-effort — brak nie unieważnia przyjęcia).
    let upo: string | null = null;
    if (accepted) {
      try {
        const upoRes = await fetch(
          `${cfg.baseUrl}/sessions/${sessionReference}/invoices/${invoiceReference}/upo`,
          { headers: { Accept: "application/xml", Authorization: `Bearer ${bearer}` } }
        );
        if (upoRes.ok) upo = await upoRes.text();
      } catch {
        // UPO można dobrać później; nie przerywamy z tego powodu.
      }
    }

    return {
      sessionReference,
      invoiceReference,
      ksefNumber,
      statusCode,
      statusText: statusText || (accepted ? "Sukces" : `Kod ${statusCode}`),
      upo,
      accepted,
    };
  } finally {
    // 7: zamknięcie sesji — best-effort, żeby nie zostawiać otwartej sesji.
    try {
      await fetch(`${cfg.baseUrl}/sessions/online/${sessionReference}/close`, {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${bearer}` },
      });
    } catch {
      // Sesja i tak wygaśnie automatycznie; brak zamknięcia nie jest błędem krytycznym.
    }
  }
}
