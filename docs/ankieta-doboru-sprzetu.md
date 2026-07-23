# Ankieta doboru sprzętu pod lokalny LLM (MŚP)

Pytania do zadania klientowi na spotkaniu wdrożeniowym + heurystyki, którymi
z odpowiedzi wyliczasz konfigurację **z bezpiecznym zapasem**. Interaktywna
wersja (przelicza sama): artefakt „Ankieta doboru sprzętu — lokalny LLM"
(claude.ai, prywatny). Ten plik to źródło prawdy dla logiki tamtego narzędzia.

> Wynik jest orientacyjny — punkt startowy wyceny, nie wiążąca specyfikacja.
> Potwierdź testem modelu na danych klienta i aktualną ofertą sprzętu (ceny
> w 2026 są rozchwiane).

## O co pytać

**1. Skala i użytkownicy**
- Ilu użytkowników łącznie?
- Ilu naraz w szczycie? *(napędza liczbę/moc GPU — nie „łącznie", tylko „naraz")*

**2. Model i zadania**
- Główne zadania: czat/asystent, kodowanie, RAG na dokumentach, długie dokumenty (długi kontekst), tłumaczenia?
- Priorytet: koszt/szybkość vs jakość/największy model? *(jakość → Q8 → 2× VRAM)*
- Rozmiar modelu, jeśli wiadomo: 7–8B / 13–14B / 32B / 70B / 120B+?
- Długość kontekstu: krótki (<4k) / średni (8–16k) / długi (32k+)? *(rośnie KV cache = VRAM)*

**3. Dane i RAG**
- Ile GB dokumentów trafi do bazy wiedzy (RAG)? *(0 = bez RAG)*
- Jak często się zmieniają (reindeks)?
- Kopie/retencja: bez kopii / kopie zapasowe / wersjonowanie + długa retencja?
- Spodziewany wzrost danych w 12–24 mies. (0/25/50/100%)?

**4. Niezawodność i dostęp**
- Tryb pracy: biurowa 8/5 / ważna / krytyczna 24/7? *(→ UPS online, redundancja, SLA)*
- Ile kosztuje godzina przestoju? *(uzasadnia redundancję i wyższy serwis)*
- Zdalny dostęp do modelu spoza firmy (VPN)?

**5. Warunki i zastane**
- Co klient już ma: serwer/stacja, NAS, sieć/switch, UPS? *(reużyj — odejmij z wyceny)*
- Gdzie stanie: szafa rack czy biuro? *(rack 4U vs cicha wieża)*
- Dostępna moc/gniazdo, klimatyzacja, tolerancja hałasu?

## Jak z tego liczyć (z zapasem)

**VRAM (GPU) — wąskie gardło.**
- Wagi modelu ≈ `params(B) × bajty/param`: Q4 ≈ 0,55; Q8 ≈ 1,05.
  (7B Q4 ≈ 4 GB · 14B Q4 ≈ 8 GB · 32B Q4 ≈ 18 GB · 70B Q4 ≈ 40 GB · 70B Q8 ≈ 74 GB · 120B Q4 ≈ 66 GB)
- Narzut: `× kontekst (krótki 1,05 / średni 1,2 / długi 1,5) × równoległość (1 + (naraz−1)×0,05, max 2,0) × 1,15`.
- Dobór karty: najmniejsza z **24 GB (RTX 5090 → T1)** / **48 GB (RTX 6000 Ada → T2)** / **96 GB (RTX PRO 6000 → T3)** ≥ policzone VRAM. Powyżej 96 GB → wiele kart (`ceil(VRAM/96)`), z uwagą o opóźnieniach multi-GPU.

**RAM systemowy:** `≥ 2× VRAM`, min 64 GB → zaokrąglij do 64/128/256/512 GB (≥256 = ECC RDIMM).

**Dysk NVMe (szybki):** `150 GB (system) + max(500 GB, wagi×3) (modele) + dane_RAG×1,5` → 1/2/4/8 TB.

**NAS (magazyn/kopie):** `usable = max(dane_RAG, 200) × retencja (kopie 2× / wersjonowanie 3×) × (1+wzrost)`;
`raw = usable / sprawność RAID (RAID1 0,5 / RAID5 0,75 / RAID6 0,66) / 0,8 (max 80% zapełnienia)`
→ dobierz zatoki (2/4/6) i pojemność dysku. Jeśli klient ma NAS — reużyj.

**UPS:** `pobór = TDP_karty × liczba + baza (T1 250 / T2 350 / T3 500) W`; `VA ≥ pobór/0,9 × 1,4`, zaokrąglij (1000/1500/2200/3000/6000). Krytyczne 24/7 → online (podwójna konwersja).

**Sieć:** 10 GbE serwer↔NAS, gdy dane_RAG ≥ 500 GB lub naraz ≥ 15 lub Tier 3; inaczej 1/2.5 GbE. VPN, gdy zdalny dostęp. *(Sieć nie przyspiesza tokenów — przyspiesza dane/RAG/kopie i daje bezpieczny dostęp.)*

**Równoległość:** jedna karta obsłuży kilku–kilkunastu lekkich użytkowników; przy spadku płynności dołóż GPU albo większą kartę.

## Mapa na Tiery (skrót)
| | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| Model | 7–14B (32B Q4) | 14–32B (70B Q4) | 70B+ (Q8) |
| Karta | RTX 5090 32 GB | RTX 6000 Ada 48 GB | RTX PRO 6000 96 GB (×N) |
| Użytkownicy | 1–5 | średnia firma | wielu, 24/7 |

Ceny do wyceny: seed katalogu `lib/catalogStarter.ts` (widełki do weryfikacji).
