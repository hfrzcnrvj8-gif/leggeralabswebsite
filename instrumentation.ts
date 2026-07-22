// Wyłapywanie błędów, których nie łapie żaden `catch` w kodzie
// (Audyt 4, ustalenie 4 — 2026-07-22).
//
// Next woła `onRequestError` przy KAŻDYM nieobsłużonym błędzie po stronie
// serwera: w renderowaniu strony, w Server Component, w trasie API, która
// wywróciła się poza swoim try/catch. Do tej pory takie błędy szły wyłącznie
// do logów Vercela — a te na planie Hobby żyją godziny.
//
// To jest sieć bezpieczeństwa POD 95 miejscami z `console.error`, nie ich
// zamiennik: łapie dokładnie to, czego nikt nie przewidział.

import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  // Instrumentacja startuje też w runtime edge, gdzie nie ma sterownika bazy.
  // Bez tej bramki import lib/db wywróciłby samo zgłaszanie błędu.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { zapiszBlad } = await import("./lib/errorLog");
    const { opisBledu } = await import("./lib/observability");

    // Ścieżka BEZ query stringa — parametry potrafią nieść adresy e-mail
    // i tokeny udostępniania (oferty/umowy chodzą po linkach z tokenem).
    // `oczyscTekst()` w zapiszBlad i tak by je przykrył, ale token nie jest
    // daną osobową i nie ma go czym wyłapać — więc ucinamy u źródła.
    const sciezka = (request.path || "").split("?")[0];

    await zapiszBlad({
      zakres: "nieobsłużony",
      komunikat: `${context.routeType} ${sciezka}: ${opisBledu(err)}`,
      szczegoly: err instanceof Error ? err.stack : err,
      // Klucz bez treści błędu, żeby ta sama padająca trasa rosła licznikiem
      // zamiast zapychać log wariantami tego samego komunikatu.
      klucz: `nieobsłużony:${context.routeType}:${sciezka}`,
    });
  } catch {
    // Zgłaszanie błędu nie może wywrócić obsługi błędu. Zostaje log Vercela.
  }
};
