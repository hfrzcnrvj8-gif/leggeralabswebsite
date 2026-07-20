// Wspólny, minimalny klient Resend — bez "use client", tylko server-side.
// Wzorowany 1:1 na wcześniejszym wywołaniu w app/api/leads/notify/route.ts,
// wydzielony żeby nie duplikować tego samego fetcha w każdym miejscu, które
// wysyła maile (raport dzienny, wysyłka faktury, przypomnienia, cykliczne).

export async function sendEmail(params: { to: string; subject: string; text: string; html?: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  // Dev bez klucza: wypisujemy maila do konsoli zamiast rzucać błędem.
  //
  // `RESEND_API_KEY` żyje wyłącznie w env Vercela, więc lokalnie KAŻDA trasa
  // wysyłająca maila kończyła się błędem 500 — w tym dzienny raport, którego
  // przez to nie dało się w ogóle obejrzeć przed wdrożeniem. Treść raportu to
  // jedyne miejsce, gdzie widać, czy nowe sekcje są sensownie sformułowane.
  //
  // Ten sam duch co dev-login i baza PGlite (lib/dev-db.ts): lokalnie ma dać
  // się pracować bez sekretów produkcyjnych. Na produkcji klucz JEST, więc
  // ta gałąź nigdy się nie wykona — a gdyby zniknął, dalej rzucamy błędem,
  // zamiast po cichu udawać wysyłkę.
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.log(
        [
          "",
          "─── MAIL (dev — NIE wysłany, brak RESEND_API_KEY) ───",
          `Do: ${params.to}`,
          `Temat: ${params.subject}`,
          "",
          params.text,
          "─────────────────────────────────────────────────────",
          "",
        ].join("\n")
      );
      return;
    }
    throw new Error("Brak RESEND_API_KEY — dodaj klucz Resend w zmiennych środowiskowych, żeby maile mogły się wysyłać.");
  }
  const from = process.env.RESEND_FROM || "Leggera Labs <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [params.to], subject: params.subject, text: params.text, ...(params.html ? { html: params.html } : {}) }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Resend zwrócił błąd ${res.status}: ${errText.slice(0, 300)}`);
  }
}
