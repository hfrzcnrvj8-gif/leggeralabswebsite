/**
 * Sonda 401 — sprawdza, czy każdy uchwyt HTTP w `app/api` odmawia dostępu
 * bez ciastka sesji. Powstała w etapie 2 planu domknięcia (Audyt 1B,
 * `docs/AUDYT-1B-PRZYROST.md`, 2026-08-06).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PO CO OSOBNE NARZĘDZIE, SKORO JEST GREP
 *
 * Bo grep w tej sprawie skłamał już DWA RAZY:
 *
 *  1. **Grep po PLIKU** (Audyt 1, 2026-07-22) — plik miewa cztery uchwyty
 *     i jedno `isAuthed()`. Naliczył 9 tras tam, gdzie było ich 16.
 *  2. **Grep po UCHWYCIE** (rekonesans do etapu 2, 2026-08-06) — naprawiona
 *     metoda, ten sam wynik. Ochrona bywa O JEDNO WYWOŁANIE DALEJ:
 *     `POST /api/invoices/[id]/ksef/send` deleguje do `runSend()` i to tam
 *     stoi `isAuthed()`. Wyszło 21 „dziur", z których żadna nie była dziurą.
 *
 * Żadna analiza tekstu źródła tego nie rozstrzygnie, bo ochrona może siedzieć
 * dowolnie głęboko w drzewie wywołań. **Rozstrzyga wyłącznie pomiar na żywej
 * trasie.** To narzędzie nie czyta kodu — strzela i patrzy na kod odpowiedzi.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * JAK URUCHOMIĆ
 *
 *   1. w `.env.local` ustaw `DEV_ADMIN_BYPASS=0`
 *   2. zrestartuj `npm run dev`  (zmienne czyta się przy starcie)
 *   3. `npx tsx scripts/sonda-401.ts`
 *   4. PRZYWRÓĆ `DEV_ADMIN_BYPASS=1` — bez tego nie zobaczysz panelu
 *      lokalnie ani nie przejdzie `npm run przejscie`
 *
 * Kroku 1–2 nie da się pominąć: przy włączonym bypassie `isAuthed()` zwraca
 * `true` dla wszystkiego i sonda pokazałaby komplet zieleni. Dlatego zaczyna
 * od SAMOSPRAWDZENIA (patrz `samosprawdzenie()`) i odmawia biegu, gdy wykryje
 * bypass — narzędzie, które potrafi cicho skłamać, jest gorsze niż jego brak.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const BAZA = process.env.SONDA_BAZA ?? "http://localhost:3000";
const KORZEN = process.cwd();
const API = join(KORZEN, "app/api");

/** Trasa, o której wiadomo na pewno, że wymaga logowania. Służy wyłącznie do
 *  samosprawdzenia — gdyby kiedyś przestała istnieć, sonda ma o tym krzyknąć,
 *  a nie po cichu założyć, że wszystko gra. */
const TRASA_KONTROLNA = "/api/leads";

type Uchwyt = { plik: string; metoda: string; url: string };

function przejdz(katalog: string, wynik: string[] = []): string[] {
  for (const wpis of readdirSync(katalog)) {
    const sciezka = join(katalog, wpis);
    if (statSync(sciezka).isDirectory()) przejdz(sciezka, wynik);
    else if (wpis === "route.ts") wynik.push(sciezka);
  }
  return wynik;
}

/** Podstawienie za segment dynamiczny. Identyfikatory celowo nieistniejące:
 *  trasa chroniona ma odmówić ZANIM zajrzy do bazy, więc `999999` wystarcza. */
function podstaw(segment: string): string {
  const m = segment.match(/^\[(?:\.\.\.)?(.+)\]$/);
  if (!m) return segment;
  const nazwa = m[1];
  if (/token/i.test(nazwa)) return "sonda-token-nieistniejacy";
  if (/kind|rodzaj/i.test(nazwa)) return "offer";
  if (/lang/i.test(nazwa)) return "pl";
  return "999999";
}

export function zbierzUchwyty(): Uchwyt[] {
  const uchwyty: Uchwyt[] = [];
  for (const plik of przejdz(API).sort()) {
    const zrodlo = readFileSync(plik, "utf8");
    const segmenty = relative(API, plik).replace(/\/route\.ts$/, "").split("/").filter(Boolean);
    const url = "/api/" + segmenty.map(podstaw).join("/");
    for (const m of zrodlo.matchAll(/^export\s+(?:async\s+)?function\s+(GET|POST|PATCH|PUT|DELETE)\b/gm)) {
      uchwyty.push({ plik: relative(KORZEN, plik), metoda: m[1], url });
    }
  }
  return uchwyty;
}

async function strzel(u: Uchwyt): Promise<{ status: number | string; tresc: string }> {
  const przerwij = new AbortController();
  const budzik = setTimeout(() => przerwij.abort(), 20000);
  try {
    const res = await fetch(BAZA + u.url, {
      method: u.metoda,
      headers: u.metoda === "GET" || u.metoda === "DELETE" ? {} : { "content-type": "application/json" },
      body: u.metoda === "GET" || u.metoda === "DELETE" ? undefined : "{}",
      signal: przerwij.signal,
      redirect: "manual",
    });
    return { status: res.status, tresc: (await res.text()).slice(0, 160).replace(/\s+/g, " ") };
  } catch (e) {
    const blad = e as Error;
    return { status: blad.name === "AbortError" ? "PRZETERMINOWANE" : "BŁĄD", tresc: blad.message.slice(0, 120) };
  } finally {
    clearTimeout(budzik);
  }
}

/**
 * Odmawia biegu, gdy sonda nie mogłaby powiedzieć prawdy.
 *
 * Dwa powody odmowy i oba są ciche, jeśli ich nie sprawdzić: serwer nie stoi
 * (wtedy WSZYSTKO wygląda na zepsute) albo dev-bypass jest włączony (wtedy
 * wszystko wygląda na otwarte, a sonda melduje komplet zieleni na 401 —
 * najgorszy możliwy wynik, bo fałszywie uspokaja).
 */
async function samosprawdzenie(): Promise<void> {
  let status: number;
  try {
    const res = await fetch(BAZA + TRASA_KONTROLNA, { signal: AbortSignal.timeout(120000) });
    status = res.status;
  } catch {
    console.error(`✗ Nie ma z czym rozmawiać pod ${BAZA}. Uruchom najpierw \`npm run dev\`.`);
    process.exit(2);
  }
  if (status === 200) {
    console.error(
      `✗ ${TRASA_KONTROLNA} oddaje 200 bez ciastka — czyli DEV_ADMIN_BYPASS jest WŁĄCZONY.\n` +
        `  Sonda pokazałaby, że wszystko jest chronione, i by SKŁAMAŁA.\n` +
        `  Ustaw DEV_ADMIN_BYPASS=0 w .env.local, zrestartuj \`npm run dev\` i uruchom ponownie.\n` +
        `  Po skończeniu przywróć =1 (wymaga go \`npm run przejscie\`).`
    );
    process.exit(2);
  }
  if (status !== 401) {
    console.error(
      `✗ Trasa kontrolna ${TRASA_KONTROLNA} oddała ${status}, a miała oddać 401.\n` +
        `  Albo przestała istnieć, albo przestała być chroniona — w obu wypadkach\n` +
        `  sonda nie ma na czym oprzeć wyniku. Sprawdź to ręcznie.`
    );
    process.exit(2);
  }
  console.log(`✓ samosprawdzenie: ${TRASA_KONTROLNA} → 401, dev-bypass wyłączony\n`);
}

async function main() {
  await samosprawdzenie();
  const uchwyty = zbierzUchwyty();
  console.log(`Sonduję ${uchwyty.length} uchwytów HTTP bez ciastka sesji…\n`);

  const nie401: (Uchwyt & { status: number | string; tresc: string })[] = [];
  for (const u of uchwyty) {
    const w = await strzel(u);
    if (w.status !== 401) nie401.push({ ...u, ...w });
  }

  console.log(`${uchwyty.length - nie401.length} z ${uchwyty.length} uchwytów odmawia dostępu (401).\n`);
  if (nie401.length === 0) {
    console.log("Żaden uchwyt nie odpowiedział inaczej niż 401.");
    return;
  }

  console.log(`Uchwyty odpowiadające inaczej niż 401 (${nie401.length}) — KAŻDY wymaga`);
  console.log(`rozstrzygnięcia „publiczny świadomie, bo…" w docs/AUDYT-1B-PRZYROST.md:\n`);
  for (const w of nie401) {
    console.log(`  ${String(w.status).padEnd(6)} ${w.metoda.padEnd(6)} ${w.url}`);
    console.log(`         ${w.plik}`);
    console.log(`         ${w.tresc}\n`);
  }
  console.log(
    "Nie-401 NIE znaczy „dziura” — publiczne dokumenty, formularz kontaktowy,\n" +
      "crony i webhook mają być otwarte. Znaczy: ten uchwyt musi mieć w wyniku\n" +
      "audytu wpisany mechanizm, który pilnuje go zamiast isAuthed()."
  );
}

main();
