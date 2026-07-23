/** Dobór sprzętu pod lokalny LLM — czysta heurystyka (bez Reacta), wspólna dla
 * strony panelu (`app/[lang]/admin/kalkulator`) i spójna z natywnym ekranem
 * apki (`KalkulatorDoboruView.swift`) oraz artefaktem web. Źródło reguł:
 * `docs/ankieta-doboru-sprzetu.md`. Widełki cen = katalog (`catalogStarter.ts`).
 *
 * Wynik jest ORIENTACYJNY, liczony z zapasem — punkt startowy wyceny, nie
 * wiążąca specyfikacja. Ceny to widełki 2026 do weryfikacji u dostawcy. */

export type Zadanie = "chat" | "kod" | "rag" | "dlugie" | "tlumaczenia";
export type Priorytet = "koszt" | "zrownowazony" | "jakosc";
export type Kontekst = "krotki" | "sredni" | "dlugi";
export type Retencja = "brak" | "kopie" | "wersje";
export type Uptime = "biuro" | "wazna" | "krytyczna";

export type Wejscie = {
  uzytkownicy: number;
  szczyt: number;
  zadania: Zadanie[];
  priorytet: Priorytet;
  /** null = Auto; inaczej 8/14/32/70/120 */
  rozmiarModelu: number | null;
  kontekst: Kontekst;
  ragGB: number;
  wzrost: number;
  retencja: Retencja;
  uptime: Uptime;
  vpn: boolean;
  maNas: boolean;
  maSiec: boolean;
  maUps: boolean;
};

export const DOMYSLNE_WEJSCIE: Wejscie = {
  uzytkownicy: 5,
  szczyt: 2,
  zadania: ["chat", "rag"],
  priorytet: "zrownowazony",
  rozmiarModelu: null,
  kontekst: "sredni",
  ragGB: 20,
  wzrost: 0.25,
  retencja: "kopie",
  uptime: "biuro",
  vpn: false,
  maNas: false,
  maSiec: false,
  maUps: false,
};

export type NotatkaTyp = "info" | "ostrzezenie" | "dobre";
export type Notatka = { typ: NotatkaTyp; tekst: string };

export type Rekomendacja = {
  tier: number;
  liczbaGpu: number;
  kartaNazwa: string;
  vramPotrzebne: number;
  vramMasz: number;
  params: number;
  quant: "Q4" | "Q8";
  ram: number;
  ssdTB: number;
  nas: string;
  ups: string;
  siec: string;
  kosztMin: number;
  kosztMax: number;
  serwisMin: number;
  serwisMax: number;
  opisWejscia: string;
  notatki: Notatka[];
};

type Para = [number, number];
const KARTY: Record<number, { nazwa: string; tdp: number; tier: number; cena: Para }> = {
  24: { nazwa: "RTX 5090 32 GB", tdp: 575, tier: 1, cena: [16000, 21000] },
  48: { nazwa: "RTX 6000 Ada 48 GB", tdp: 300, tier: 2, cena: [28000, 35000] },
  96: { nazwa: "RTX PRO 6000 96 GB", tdp: 600, tier: 3, cena: [50000, 68000] },
};
const RESZTA: Record<number, Para> = { 1: [6000, 10000], 2: [11000, 20000], 3: [30000, 55000] };
const UPS_CENA: Record<number, Para> = { 1: [1000, 1700], 2: [2000, 4200], 3: [4500, 12000] };
const ROBOCIZNA: Record<number, Para> = { 1: [3000, 8000], 2: [6000, 16000], 3: [15000, 45000] };
const SERWIS: Record<number, Para> = { 1: [400, 1000], 2: [1000, 2500], 3: [2500, 6000] };

const ZADANIE_KROTKA: Record<Zadanie, string> = {
  chat: "czat",
  kod: "kod",
  rag: "RAG",
  dlugie: "długie dokumenty",
  tlumaczenia: "tłumaczenia",
};

function wagiGB(p: number, q: "Q4" | "Q8"): number {
  return p * (q === "Q8" ? 1.05 : 0.55);
}

export function dobierz(w: Wejscie): Rekomendacja {
  const uzytk = Math.max(1, w.uzytkownicy || 1);
  const szczyt = Math.max(1, Math.min(w.szczyt || 1, uzytk));
  const ragGB = Math.max(0, w.ragGB || 0);

  // model + kwantyzacja
  const quant: "Q4" | "Q8" = w.priorytet === "jakosc" ? "Q8" : "Q4";
  let params: number;
  if (w.rozmiarModelu != null) {
    params = w.rozmiarModelu;
  } else {
    params = w.priorytet === "koszt" ? 14 : w.priorytet === "jakosc" ? 70 : 32;
    if (w.zadania.includes("dlugie") && params < 32) params = 32;
    if (w.zadania.includes("kod") && params < 14) params = 14;
    if (szczyt >= 20 && params < 70) params = 70;
  }

  // VRAM z zapasem
  const ctxF = w.kontekst === "krotki" ? 1.05 : w.kontekst === "dlugi" ? 1.5 : 1.2;
  const concF = Math.min(1 + (szczyt - 1) * 0.05, 2.0);
  const vram = wagiGB(params, quant) * ctxF * concF * 1.15;

  // karta + liczba
  let cardKey = 96;
  let count = 1;
  for (const size of [24, 48, 96]) {
    if (vram <= size) {
      cardKey = size;
      break;
    }
  }
  if (vram > 96) {
    cardKey = 96;
    count = Math.ceil(vram / 96);
  }
  const karta = KARTY[cardKey];
  const totalVram = cardKey * count;
  const tier = karta.tier;

  // RAM ≥ 2× VRAM
  const ramNeed = Math.max(64, totalVram * 2);
  const ram = [64, 128, 256, 512].find((r) => r >= ramNeed) ?? 512;

  // SSD (szybki NVMe)
  const ssdGB = 150 + Math.max(500, wagiGB(params, quant) * 3) + Math.max(ragGB * 1.5, ragGB > 0 ? 100 : 0);
  const ssd = [1, 2, 4, 8].find((t) => t * 1000 >= ssdGB) ?? 8;

  // NAS
  let nas: string;
  let nasCena: Para = [0, 0];
  const chceNas = w.retencja !== "brak" || ragGB > 0;
  if (!chceNas) {
    nas = "opcjonalny — brak RAG i kopii";
  } else if (w.maNas) {
    nas = "reużyj istniejący NAS klienta";
  } else {
    const retF = w.retencja === "wersje" ? 3 : w.retencja === "kopie" ? 2 : 1;
    const usable = Math.max(ragGB, 200) * retF * (1 + w.wzrost);
    let bays: number, raidEff: number, raid: string;
    if (usable <= 4000) {
      bays = 2;
      raidEff = 0.5;
      raid = "RAID1";
    } else if (usable <= 16000) {
      bays = 4;
      raidEff = 0.75;
      raid = "RAID5";
    } else {
      bays = 6;
      raidEff = 0.66;
      raid = "RAID6";
    }
    const rawGB = usable / raidEff / 0.8;
    const driveTB = [4, 8, 12, 16, 20].find((d) => d * bays * 1000 >= rawGB) ?? 20;
    nas = `${bays}-bay · ${bays}× ${driveTB} TB (${raid})`;
    const driveCena = driveTB <= 4 ? 500 : driveTB <= 8 ? 1050 : driveTB <= 12 ? 1300 : 1600;
    const box: Para = bays <= 2 ? [1300, 2000] : bays <= 4 ? [2800, 4200] : [4000, 8000];
    nasCena = [box[0] + bays * driveCena * 0.85, box[1] + bays * driveCena * 1.15];
  }

  // Sieć
  const szybka = ragGB >= 500 || szczyt >= 15 || tier === 3;
  let siec: string;
  let siecCena: Para;
  if (w.maSiec) {
    siec = "reużyj sieć klienta" + (szybka ? " + karta 10 GbE w serwerze" : "");
    siecCena = szybka ? [250, 700] : [0, 0];
  } else if (szybka) {
    siec = "switch 10 GbE + karta 10 GbE (serwer↔NAS)";
    siecCena = [1400, 4500];
  } else {
    siec = "switch zarządzalny 1/2.5 GbE";
    siecCena = [500, 1500];
  }
  if (w.vpn) {
    siec += " · brama VPN";
    siecCena = [siecCena[0] + 900, siecCena[1] + 2500];
  }

  // UPS
  const contW = karta.tdp * count + (tier === 1 ? 250 : tier === 2 ? 350 : 500);
  const upsVA = Math.ceil((contW / 0.9) * 1.4 / 500) * 500;
  const online = w.uptime === "krytyczna";
  let upsCena = UPS_CENA[tier].slice() as Para;
  if (online && tier < 3) upsCena = [upsCena[0] * 1.6, upsCena[1] * 1.6];
  const ups = `${upsVA} VA · ${online ? "online (24/7)" : "line-interactive"}`;

  // koszt
  const kosztMin = karta.cena[0] * count + RESZTA[tier][0] + upsCena[0] + nasCena[0] + siecCena[0] + ROBOCIZNA[tier][0];
  const kosztMax = karta.cena[1] * count + RESZTA[tier][1] + upsCena[1] + nasCena[1] + siecCena[1] + ROBOCIZNA[tier][1];

  // notatki
  const notatki: Notatka[] = [];
  notatki.push({
    typ: "info",
    tekst: `VRAM to wąskie gardło: ${params}B w ${quant} ≈ ${Math.round(wagiGB(params, quant))} GB wag; z kontekstem i ${szczyt} równoczesnymi doliczam zapas → ${Math.ceil(vram)} GB.`,
  });
  if (count > 1)
    notatki.push({
      typ: "ostrzezenie",
      tekst: `Model nie mieści się na jednej karcie — ${count}× GPU. Multi-GPU dokłada opóźnień; rozważ większą kartę lub niższą kwantyzację.`,
    });
  if (szczyt >= 15)
    notatki.push({
      typ: "ostrzezenie",
      tekst: `Duża równoległość (${szczyt} naraz) — przy spadku płynności dołóż GPU. Jeden układ obsłuży kilku–kilkunastu lekkich użytkowników.`,
    });
  if (params >= 70 && quant === "Q8")
    notatki.push({
      typ: "info",
      tekst: "Q8 podwaja VRAM względem Q4 — jeśli jakość Q4 wystarczy, zejdziesz o klasę karty niżej i taniej.",
    });
  const ma = [w.maNas ? "NAS" : null, w.maSiec ? "sieć" : null, w.maUps ? "UPS" : null].filter(Boolean);
  if (ma.length) notatki.push({ typ: "dobre", tekst: `Do reużycia u klienta: ${ma.join(", ")} — odejmij z wyceny.` });
  if (w.uptime === "krytyczna")
    notatki.push({
      typ: "info",
      tekst: "Praca 24/7 — UPS online (podwójna konwersja), rozważ redundancję zasilania i wyższy serwis (SLA).",
    });
  if (ragGB === 0 && w.zadania.includes("rag"))
    notatki.push({ typ: "ostrzezenie", tekst: "Zaznaczono RAG, ale 0 GB danych — podaj ilość dokumentów, żeby policzyć NAS i dysk." });

  const zad = (["chat", "kod", "rag", "dlugie", "tlumaczenia"] as Zadanie[])
    .filter((z) => w.zadania.includes(z))
    .map((z) => ZADANIE_KROTKA[z]);
  const opisWejscia = `${zad.length ? zad.join(", ") : "ogólne"} · ${szczyt} naraz z ${uzytk} os.`;

  return {
    tier,
    liczbaGpu: count,
    kartaNazwa: karta.nazwa,
    vramPotrzebne: Math.ceil(vram),
    vramMasz: totalVram,
    params,
    quant,
    ram,
    ssdTB: ssd,
    nas,
    ups,
    siec,
    kosztMin,
    kosztMax,
    serwisMin: SERWIS[tier][0],
    serwisMax: SERWIS[tier][1],
    opisWejscia,
    notatki,
  };
}
