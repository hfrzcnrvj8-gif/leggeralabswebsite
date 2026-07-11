// Kurs NBP dla VAT na fakturach w walucie obcej — ustawa o VAT wymaga, żeby
// kwota VAT na fakturze w walucie obcej była dodatkowo wyrażona w PLN wg
// średniego kursu NBP (tabela A) z dnia poprzedzającego dzień wystawienia.
// Bez "use client" — używane tylko server-side (route handlery), zwykły
// fetch do publicznego, bezpłatnego, bezkluczowego API NBP.

export type NbpRate = { kurs: number; data: string; tabela: string };

/** Pobiera średni kurs NBP (tabela A) danej waluty dla dnia poprzedzającego
 * `issueDateISO`. NBP publikuje kursy tylko w dni robocze — jeśli dzień
 * poprzedzający wypada w weekend/święto, cofa się dzień po dniu (do 10 prób)
 * aż znajdzie ostatnią opublikowaną notę. Zwraca `null` (nie rzuca), gdy się
 * nie uda — wywołujący ma świadomie failować "otwarcie" (nie blokować
 * wystawienia faktury z powodu niedostępności zewnętrznego API). */
export async function fetchNbpRateBeforeDate(currency: string, issueDateISO: string): Promise<NbpRate | null> {
  if (currency === "PLN") return null;
  const base = new Date(`${issueDateISO.slice(0, 10)}T00:00:00Z`);
  for (let back = 1; back <= 10; back++) {
    const d = new Date(base.getTime() - back * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    try {
      const res = await fetch(`https://api.nbp.pl/api/exchangerates/rates/A/${currency}/${dateStr}/?format=json`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.status === 404) continue; // dzień niepublikowany (weekend/święto) — cofnij się dalej
      if (!res.ok) return null;
      const data = (await res.json()) as { table: string; rates: { mid: number; effectiveDate: string }[] };
      const rate = data.rates?.[0];
      if (!rate) return null;
      return { kurs: rate.mid, data: rate.effectiveDate, tabela: data.table };
    } catch {
      return null; // sieć/timeout — nie blokuj wystawienia faktury
    }
  }
  return null;
}
