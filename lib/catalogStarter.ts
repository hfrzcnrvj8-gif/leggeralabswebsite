/** Startowy katalog komponentów — „warsztatowa" biblioteka klocków, z których
 * właściciel składa oferty wdrożeń lokalnego LLM. Rozpisane na 3 Tiery, per
 * KONKRETNY komponent (producent + model + pojemność + spec), bo właściciel
 * kupuje CZĘŚCI — gotowcem jest dopiero to, co składa klientowi.
 *
 * WSIEWANE RAZ (bramka treści `catalog_starter` w `lib/db.ts`) — potem to
 * zwykłe wiersze `service_catalog`: właściciel edytuje/usuwa w panelu i apce,
 * kolejne deploye ich nie ruszają. Skasowanie wszystkich NIE przywróci ich.
 *
 * CENY: netto PLN, stan lipiec 2026 — rynek jest rozchwiany (niedobór
 * GDDR7/DRAM/NAND → skoki cen GPU, RAM i SSD), więc to WIDEŁKI do WERYFIKACJI
 * przy realnej wycenie u dostawcy, nie prawda wyryta w kamieniu (CLAUDE.md).
 * `koszt_zakupu` celowo pusty — właściciel wpisuje realny koszt zakupu, gdy ma
 * ofertę dostawcy; marża na sprzęcie bywa niska, prawdziwa siedzi w robociźnie
 * i serwisie. Konkretne modele to REKOMENDACJE (sprawdzone, dostępne w PL) —
 * w opisie zwykle jest „lub odpowiednik" i alternatywa.
 *
 * Prefiks „T1/T2/T3 ·" w nazwie (katalog grupuje po kategorii, nie po Tierze).
 */

export type StarterComponent = {
  nazwa: string;
  kategoria: string;
  cena_netto: number;
  cena_min: number;
  cena_max: number;
  jednostka?: string; // domyślnie "szt."
  opis: string;
};

export const STARTER_CATALOG: StarterComponent[] = [
  // ── TIER 1 — mała firma (1–5 os.), RAG, modele 7–14B · stacja AM5 ──────────
  { nazwa: "T1 · GPU — Gigabyte RTX 5090 Windforce OC 32 GB", kategoria: "gpu", cena_netto: 18000, cena_min: 16000, cena_max: 21000,
    opis: "GeForce RTX 5090, 32 GB GDDR7, PCIe 5.0. Pod modele 7–14B (Q4–Q8), RAG dla 1–5 osób; uciągnie 32B w Q4. Wersje 3-wentylatorowe (Gigabyte Windforce / ASUS TUF / MSI Ventus) — chłodne, ciche. Serce zestawu." },
  { nazwa: "T1 · CPU — AMD Ryzen 9 9900X (12C/24T)", kategoria: "compute", cena_netto: 2000, cena_min: 1700, cena_max: 2600,
    opis: "Zen 5, socket AM5, 12 rdzeni/24 wątki, 120 W. Inferencja jest GPU-bound — CPU obsługuje I/O, embeddingi i RAG. Tańsza alternatywa: Ryzen 7 9700X." },
  { nazwa: "T1 · Płyta główna — MSI MAG X670E Tomahawk WiFi", kategoria: "compute", cena_netto: 1300, cena_min: 1100, cena_max: 2600,
    opis: "AM5 X670E ATX, PCIe 5.0 x16 pod GPU, PCIe 5.0 M.2, 4× DDR5, 2.5G LAN, mocne VRM pod pracę ciągłą. Wyżej: ASUS ProArt X670E-Creator (2× 10G LAN)." },
  { nazwa: "T1 · RAM — Kingston Fury Beast 64 GB (2×32) DDR5-6000", kategoria: "compute", cena_netto: 1200, cena_min: 1000, cena_max: 1800,
    opis: "64 GB DDR5-6000 CL36. Zapas ≥ 2× VRAM na cache modeli i indeks RAG. Odpowiednik: G.Skill Ripjaws S5. DRAM drożeje w 2026." },
  { nazwa: "T1 · Dysk NVMe — Samsung 990 Pro 2 TB (z radiatorem)", kategoria: "storage", cena_netto: 800, cena_min: 650, cena_max: 1200,
    opis: "PCIe 4.0, 7450 MB/s, chłodny i trwały (TLC). System + wagi modeli. Odpowiednik: WD Black SN850X 2 TB. NAND w górę w 2026." },
  { nazwa: "T1 · Zasilacz — Seasonic Prime TX-1000 (1000 W Titanium)", kategoria: "compute", cena_netto: 800, cena_min: 700, cena_max: 1300,
    opis: "1000 W 80+ Titanium, cichy, zapas pod skoki poboru RTX 5090. Odpowiednik: Corsair RM1000x / be quiet! Dark Power 13." },
  { nazwa: "T1 · Obudowa + chłodzenie — Fractal Define 7 + Arctic Liquid Freezer III 280", kategoria: "compute", cena_netto: 900, cena_min: 800, cena_max: 1500,
    opis: "Wyciszona obudowa + AiO 280 (lub top-air Noctua NH-D15 G2). Przepływ powietrza pod stałe obciążenie GPU." },
  { nazwa: "T1 · UPS — APC Smart-UPS SMT1500I (1500 VA / 1000 W)", kategoria: "zasilanie", cena_netto: 1200, cena_min: 1000, cena_max: 1700,
    opis: "Line-interactive, sinus czysty, LCD, zarządzalny. Podtrzymanie na bezpieczne zamknięcie przy zaniku prądu. Odpowiednik: Eaton 5P 1550i." },
  { nazwa: "T1 · NAS — UGREEN NASync DXP2800 (2-bay)", kategoria: "storage", cena_netto: 1500, cena_min: 1300, cena_max: 2000,
    opis: "2-zatokowy, 2.5G LAN, slot NVMe. Bierze DOWOLNE dyski SATA (Synology blokuje weryfikacją). Ten sam ekosystem, co Twój Ugreen do kopii. Klient często ma własny." },
  { nazwa: "T1 · Dyski HDD — 2× WD Red Plus 4 TB (CMR)", kategoria: "storage", cena_netto: 1000, cena_min: 800, cena_max: 1300,
    opis: "Para WD Red Plus 4 TB (WD40EFPX, CMR, klasa NAS 24/7) do lustra RAID1. Odpowiednik: Seagate IronWolf 4 TB. Cena za 2 szt." },
  { nazwa: "T1 · Sieć — switch 8-port PoE zarządzalny (UniFi USW-Lite-8-PoE)", kategoria: "siec", cena_netto: 800, cena_min: 500, cena_max: 1500,
    opis: "Zarządzalny, PoE pod AP/kamery. Odpowiednik: MikroTik CRS310. Klient często ma własną sieć — wtedy pomijasz." },
  { nazwa: "T1 · Robocizna — montaż + wdrożenie", kategoria: "robocizna", cena_netto: 5000, cena_min: 3000, cena_max: 8000, jednostka: "usł.",
    opis: "Złożenie, instalacja OS + Ollama, wdrożenie RAG na danych klienta, testy." },
  { nazwa: "T1 · Serwis — utrzymanie miesięczne", kategoria: "serwis", cena_netto: 600, cena_min: 400, cena_max: 1000, jednostka: "mies.",
    opis: "Aktualizacje modeli, monitoring, wsparcie. Powtarzalny przychód." },

  // ── TIER 2 — średnia firma, większa równoległość, modele 14–32B ────────────
  { nazwa: "T2 · GPU — PNY NVIDIA RTX 6000 Ada 48 GB", kategoria: "gpu", cena_netto: 31000, cena_min: 28000, cena_max: 35000,
    opis: "48 GB GDDR6 ECC, karta pro (Ada Lovelace) do pracy ciągłej 24/7. 14–32B na luzie, 70B w Q4. Sprzedawana głównie przez PNY. Alternatywa: 2× RTX 5090 (64 GB, ale multi-GPU dokłada opóźnień)." },
  { nazwa: "T2 · CPU — AMD Ryzen 9 9950X (16C/32T)", kategoria: "compute", cena_netto: 3000, cena_min: 2500, cena_max: 4000,
    opis: "Zen 5, AM5, 16 rdzeni. Przy dużej równoległości/2 GPU rozważ Threadripper 7960X (24C, więcej linii PCIe)." },
  { nazwa: "T2 · Płyta główna — ASUS ProArt X670E-Creator WiFi", kategoria: "compute", cena_netto: 2400, cena_min: 2000, cena_max: 4500,
    opis: "X670E z 2× 10G LAN, PCIe 5.0 x16 + M.2. Dla Threadripper: ASUS Pro WS TRX50-SAGE (RDIMM ECC, 4× PCIe 5.0 x16)." },
  { nazwa: "T2 · RAM — G.Skill Trident Z5 128 GB (4×32) DDR5-5600", kategoria: "compute", cena_netto: 2800, cena_min: 2400, cena_max: 4800,
    opis: "128 GB pod wiele modeli naraz i indeks RAG. Na TRX50: ECC RDIMM (Kingston Server Premier). DRAM drożeje." },
  { nazwa: "T2 · Dysk NVMe — Samsung 990 Pro 4 TB + 2 TB na modele", kategoria: "storage", cena_netto: 1800, cena_min: 1300, cena_max: 2600,
    opis: "System (2 TB) + biblioteka modeli/embeddingów (4 TB), oba Gen4, chłodne. Cena za komplet." },
  { nazwa: "T2 · Zasilacz — Corsair HX1500i (1500 W Platinum)", kategoria: "compute", cena_netto: 1200, cena_min: 1100, cena_max: 1900,
    opis: "1500 W 80+ Platinum z cyfrowym monitoringiem. Zapas pod kartę pro i ewentualne 2. GPU. Odpowiednik: Seasonic Prime PX-1600." },
  { nazwa: "T2 · Obudowa + chłodzenie — Fractal Define 7 XL + Arctic Liquid Freezer III 360", kategoria: "compute", cena_netto: 1400, cena_min: 1100, cena_max: 2200,
    opis: "Duża wyciszona obudowa, AiO 360; miejsce na 2 karty. Dla Threadripper: chłodzenie Noctua NH-U14S TR5-SP6." },
  { nazwa: "T2 · UPS — Eaton 5PX 2200 RT2U (2200 VA / 1980 W, rack)", kategoria: "zasilanie", cena_netto: 2800, cena_min: 2000, cena_max: 4200,
    opis: "Rack/tower 2U, sinus, zarządzalny (karta NETWORK-M2). Chroni serwer i NAS. Odpowiednik online: APC Smart-UPS SRT2200." },
  { nazwa: "T2 · NAS — UGREEN NASync DXP4800 Plus (4-bay, 10GbE)", kategoria: "storage", cena_netto: 3200, cena_min: 2800, cena_max: 4200,
    opis: "4-zatokowy, wbudowane 10GbE, 2× NVMe (cache). Bierze dowolne dyski. Odpowiednik: Synology DS925+ (ale z blokadą dysków). Enclosure — dyski osobno." },
  { nazwa: "T2 · Dyski HDD — 4× Seagate IronWolf Pro 8 TB (CMR, 7200)", kategoria: "storage", cena_netto: 4200, cena_min: 3600, cena_max: 5200,
    opis: "4× IronWolf Pro 8 TB (ST8000NT001, CMR, 7200 RPM, klasa enterprise/NAS). ≈ 24 TB użytkowe w RAID5. Odpowiednik: WD Red Pro 8 TB. Cena za 4 szt." },
  { nazwa: "T2 · Sieć — switch 24-port PoE (UniFi USW-Pro-24-PoE) + brama", kategoria: "siec", cena_netto: 3000, cena_min: 1500, cena_max: 4500,
    opis: "24-port zarządzalny PoE + brama/firewall (UniFi UXG-Pro / MikroTik). Odpowiednik switcha: MikroTik CRS326." },
  { nazwa: "T2 · Robocizna — montaż + wdrożenie + integracja", kategoria: "robocizna", cena_netto: 10000, cena_min: 6000, cena_max: 16000, jednostka: "usł.",
    opis: "Złożenie, wdrożenie modeli, integracja z systemami klienta (API/RAG), testy." },
  { nazwa: "T2 · Serwis — utrzymanie z SLA", kategoria: "serwis", cena_netto: 1500, cena_min: 1000, cena_max: 2500, jednostka: "mies.",
    opis: "Wyższy priorytet reakcji, monitoring, aktualizacje." },

  // ── TIER 3 — większa firma, wielu użytkowników, modele 70B+ · serwer rack ──
  { nazwa: "T3 · GPU — NVIDIA RTX PRO 6000 Blackwell 96 GB (PNY)", kategoria: "gpu", cena_netto: 56000, cena_min: 50000, cena_max: 68000,
    opis: "96 GB GDDR7 ECC — 70B w Q8 z zapasem, 120B w Q4. Największa pamięć na jednej karcie (bez NVLink). Server Edition (pasywna) do racka, Workstation Edition (aktywna) do wieży. Alternatywa: 2× RTX 6000 Ada (96 GB łącznie)." },
  { nazwa: "T3 · CPU — AMD Ryzen Threadripper PRO 7975WX (32C/64T)", kategoria: "compute", cena_netto: 15000, cena_min: 9000, cena_max: 25000,
    opis: "32 rdzenie, 128 linii PCIe 5.0 pod wiele GPU i równoległość. Taniej: 7965WX (24C). Więcej: 7995WX (96C) lub EPYC 9354." },
  { nazwa: "T3 · Płyta główna — ASUS Pro WS WRX90E-SAGE SE (sTR5)", kategoria: "compute", cena_netto: 6000, cena_min: 4500, cena_max: 7500,
    opis: "WRX90, 7× PCIe 5.0 x16, 8× DDR5 ECC RDIMM (8-kanał), 2× 10G + 2.5G LAN, IPMI. Klasa serwerowa pod wiele GPU." },
  { nazwa: "T3 · RAM — 256 GB (8×32) DDR5-5600 ECC RDIMM", kategoria: "compute", cena_netto: 9000, cena_min: 6000, cena_max: 18000,
    opis: "8-kanałowo, ECC RDIMM (Kingston Server Premier / Micron / Samsung). Rozbudowa do 512 GB. Zapas pod wiele modeli, wielu użytkowników i duże indeksy RAG." },
  { nazwa: "T3 · Dysk NVMe — 2× Crucial T705 4 TB Gen5 (RAID1) + magazyn", kategoria: "storage", cena_netto: 5000, cena_min: 3500, cena_max: 9000,
    opis: "2× Gen5 (do ~14 GB/s, WYMAGA radiatora/chłodzenia) w lustrze pod modele. Odpowiednik: Samsung 9100 Pro. Pojemny magazyn danych — na NAS (osobno)." },
  { nazwa: "T3 · Zasilanie serwera — redundantne 2× 1600 W (CRPS)", kategoria: "compute", cena_netto: 3500, cena_min: 2500, cena_max: 6000,
    opis: "Redundancja (wymiana bez wyłączania) w obudowie rack (FSP/Supermicro CRPS). W wariancie wieżowym: pojedynczy Seasonic Prime PX-2200 (2200 W Titanium)." },
  { nazwa: "T3 · Obudowa — rack 4U GPU (SilverStone RM44 / Supermicro)", kategoria: "compute", cena_netto: 4000, cena_min: 2500, cena_max: 8000,
    opis: "4U pod wiele GPU z serwerowym przepływem powietrza. Gdy stoi w biurze, nie w szafie — duża wieża Fractal Define 7 XL." },
  { nazwa: "T3 · UPS — Eaton 9PX 3000 RT2U online (double-conversion)", kategoria: "zasilanie", cena_netto: 6000, cena_min: 4500, cena_max: 12000,
    opis: "Podwójna konwersja (najczystsze zasilanie), rack, karta sieciowa. Do 6000 VA. Chroni cały serwer + sieć. Odpowiednik: APC Smart-UPS SRT." },
  { nazwa: "T3 · NAS — UGREEN NASync DXP6800 Pro (6-bay, 10GbE)", kategoria: "storage", cena_netto: 5500, cena_min: 4000, cena_max: 8000,
    opis: "6 zatok (lub DXP8800 Plus, 8-bay), 10GbE, pod RAID6 i wielu użytkowników. Odpowiednik: Synology DS1825+. Enclosure — dyski osobno." },
  { nazwa: "T3 · Dyski HDD — 6× Seagate IronWolf Pro 16 TB (CMR, RAID6)", kategoria: "storage", cena_netto: 9000, cena_min: 7000, cena_max: 12000,
    opis: "6× IronWolf Pro 16 TB (ST16000NT001, CMR, 7200, enterprise) → ≈ 64 TB użytkowe w RAID6 (2 dyski redundancji). Odpowiednik: WD Red Pro / Exos 16 TB. Cena za 6 szt." },
  { nazwa: "T3 · Sieć — switch 10 GbE (MikroTik CRS312) + firewall/UTM", kategoria: "siec", cena_netto: 5000, cena_min: 3500, cena_max: 9000,
    opis: "10 GbE pod przepływ danych do modeli; brama UTM z filtrowaniem i VPN (UniFi UXG-Pro / Fortinet FortiGate). " },
  { nazwa: "T3 · Robocizna — serwer + klaster + szkolenie", kategoria: "robocizna", cena_netto: 25000, cena_min: 15000, cena_max: 45000, jednostka: "usł.",
    opis: "Montaż serwera, wdrożenie, integracje, szkolenie zespołu klienta." },
  { nazwa: "T3 · Serwis — SLA premium", kategoria: "serwis", cena_netto: 3500, cena_min: 2500, cena_max: 6000, jednostka: "mies.",
    opis: "Najwyższy priorytet reakcji, monitoring, aktualizacje, przeglądy." },

  // ── Sieć — karty i urządzenia (opcje/boostery, cross-tier) ────────────────
  // WAŻNE: szybka sieć NIE przyspiesza inferencji (to robi GPU, a tokeny to
  // mały tekst). Przyspiesza DANE: dostęp do NAS/RAG, ładowanie modeli, kopie,
  // wielu użytkowników naraz — oraz daje bezpieczny zdalny dostęp (VPN).
  { nazwa: "Sieć · Karta 10 GbE — TP-Link TX401 (RJ45)", kategoria: "siec", cena_netto: 450, cena_min: 250, cena_max: 700,
    opis: "Dokładka 10GbE do płyty z 2.5G (np. Tier 1) — szybki link stacja↔NAS/RAG. Miedź (Cat6A), prosty montaż. Nie przyspiesza tokenów, przyspiesza dostęp do danych." },
  { nazwa: "Sieć · Karta 25 GbE — Intel E810-XXVDA2 (SFP28, RDMA)", kategoria: "siec", cena_netto: 2200, cena_min: 1500, cena_max: 3500,
    opis: "2× SFP28, RDMA (iWARP/RoCEv2). Gdy 10G nasyca się przy storage/RAG albo wielu użytkownikach. Odpowiednik: Mellanox ConnectX-4 Lx. Data plane, nie inferencja." },
  { nazwa: "Sieć · Karta 100 GbE — NVIDIA ConnectX-6 (RDMA/RoCE)", kategoria: "siec", cena_netto: 5000, cena_min: 2500, cena_max: 9000,
    opis: "Pod KLASTER wielowęzłowy i ciężki data plane (Tier 3). RDMA/RoCE. Dla pojedynczego serwera zwykle zbędna — sens dopiero przy skalowaniu na wiele maszyn." },
  { nazwa: "Sieć · Router/brama VPN — MikroTik RB5009 / UniFi UXG-Pro", kategoria: "siec", cena_netto: 1200, cena_min: 900, cena_max: 2500,
    opis: "Segmentacja VLAN (izolacja serwera AI od reszty biura), VPN pod bezpieczny zdalny dostęp do modelu spoza firmy, QoS. RB5009 ma 10G SFP+. To realnie „poprawia osiągi u klienta”: bezpiecznie i szybko dowozi ruch do serwera." },
  { nazwa: "Sieć · Firewall UTM — Fortinet FortiGate (klasa biznes)", kategoria: "siec", cena_netto: 3000, cena_min: 1800, cena_max: 8000,
    opis: "Dla klientów z wymogami bezpieczeństwa/compliance (RODO): IPS, filtrowanie, VPN site-to-site, logi. FortiGate 40F/70G + licencja subskrypcyjna (odnowienie roczne — dopisz osobno)." },
  { nazwa: "Sieć · Switch 10 GbE agregujący — MikroTik CRS312 / UniFi Aggregation", kategoria: "siec", cena_netto: 1500, cena_min: 900, cena_max: 3000,
    opis: "Agregacja 10GbE: serwer + NAS + kluczowe stacje na szybkim rdzeniu, reszta biura na 1/2.5G. Najprostszy realny booster wydajności pracy z danymi/RAG." },

  // ── ASUS ProArt — spójna linia workstation (preferencja właściciela) ──────
  { nazwa: "ProArt · GPU RTX 5090 32 GB (ASUS ProArt OC)", kategoria: "gpu", cena_netto: 18500, cena_min: 16000, cena_max: 22000,
    opis: "RTX 5090 32 GB w wersji ProArt: stonowany design workstation, mocne 3-wentylatorowe chłodzenie, dobra jakość wykonania. Wydajność jak inne 5090 — dopłacasz za design/chłodzenie/markę. (Do zestawów 2-GPU lepsze karty pro blower: RTX 6000 Ada / PRO 6000.)" },
  { nazwa: "ProArt · Płyta B650-Creator", kategoria: "compute", cena_netto: 1200, cena_min: 1000, cena_max: 1500,
    opis: "Tańsza płyta z serii ProArt (B650): 2× 2.5G LAN, USB4, solidne VRM, stonowany wygląd. Dobra cena/jakość, gdy nie potrzebujesz 10G na pokładzie (wtedy ProArt X670E-Creator albo osobna karta 10G)." },
  { nazwa: "ProArt · Obudowa PA602", kategoria: "compute", cena_netto: 750, cena_min: 600, cena_max: 950,
    opis: "Obudowa workstation z bardzo dobrym przepływem powietrza (siatka z przodu), cicha, dużo miejsca na chłodzenie i długie karty. Świetna cena/jakość pod stację 24/7." },

  // ── Ubiquiti UniFi — spójny ekosystem sieciowy (preferencja właściciela) ──
  { nazwa: "UniFi · Brama UDM-Pro (router + firewall + VPN)", kategoria: "siec", cena_netto: 2200, cena_min: 1800, cena_max: 2800,
    opis: "All-in-one Ubiquiti: router, firewall, VPN (zdalny dostęp do modelu), kontroler sieci, opcjonalnie NVR. Prosty w zarządzaniu (jeden panel UniFi). Alternatywa dla RB5009/FortiGate tam, gdzie liczy się jeden ekosystem." },
  { nazwa: "UniFi · Switch Pro Max 24 PoE (uplink 10GbE)", kategoria: "siec", cena_netto: 3500, cena_min: 2500, cena_max: 5000,
    opis: "Zarządzalny switch UniFi z uplinkami 10GbE (SFP+) i PoE++ pod AP/kamery. Rdzeń sieci klienta w jednym ekosystemie z bramą i AP. Serwer/NAS na 10G, biuro na 1/2.5G." },
  { nazwa: "UniFi · Access Point U7 Pro (WiFi 7)", kategoria: "siec", cena_netto: 800, cena_min: 600, cena_max: 1200,
    opis: "Punkt dostępowy WiFi 7 dla stacji bezprzewodowych. Serwer zawsze po kablu — AP jest dla użytkowników. Spójny z bramą i switchem UniFi." },

  // ── Alternatywy-gotowce (Mac): dla klienta ceniącego ciszę/mały box ───────
  { nazwa: "Alt · Mac mini M4 Pro (do 64 GB)", kategoria: "compute", cena_netto: 7000, cena_min: 5000, cena_max: 10000,
    opis: "Najtańsze wejście w lokalny LLM (gotowiec): mały, cichy, tani. M4 Pro, do 64 GB pamięci zunifikowanej — modele 7–14B, 32B w Q4. Świetny na dowód wartości (PoC) i małe wdrożenia; słabszy niż Studio (mniej pasma pamięci, brak konfiguracji > 64 GB)." },
  { nazwa: "Alt · Mac Studio M4 Max 64 GB", kategoria: "compute", cena_netto: 12000, cena_min: 10000, cena_max: 16000,
    opis: "Gotowiec (nie składasz z części) dla T1/T2: cichy, mały, 64 GB pamięci zunifikowanej (do ~32B). Uwaga: Apple wycofał 256/512 GB w 2026 (niedobór DRAM)." },
  { nazwa: "Alt · Mac Studio M3 Ultra 96 GB", kategoria: "compute", cena_netto: 21000, cena_min: 19000, cena_max: 24000,
    opis: "Gotowiec pod 70B (Q8) w cichym boxie — najmocniejszy desktop Apple. Alternatywa dla serwera GPU tam, gdzie liczy się cisza/miejsce. (M4 Ultra nie powstał.)" },
];
