import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { przebiegLowcy } from "@/lib/leadHunterRun";
import { ceidgSkonfigurowany, ceidgSrodowisko } from "@/lib/ceidg";
import { notify } from "@/lib/notificationLog";
import { odnotujPrzebieg } from "@/lib/errorLog";
import { todayLocalISO } from "@/lib/dates";

export const runtime = "nodejs";
// Twardy stop potoku to 240 s (BUDZET_MS) — tu dajemy 300 s, czyli maksimum
// planu Hobby (Audyt 5). Różnica to zapas na zapis kursora i podsumowania.
export const maxDuration = 300;

/** Jeden przebieg „Łowcy leadów" (Moduł 52) — wspólny dla cronu i przycisku.
 *
 * Powiadomienie w Centrum powstaje TYLKO wtedy, gdy jest o czym mówić:
 * wpis „dołożono 0 kandydatów" codziennie o świcie nauczyłby właściciela
 * ignorować dzwonek, a wtedy przestałby zauważać także te dni, w których coś
 * naprawdę przyszło. Awarię (zły token, wyczerpany limit) meldujemy zawsze —
 * cichy automat to ustalenie 3 z Audytu 4. */
async function wykonaj(zrodlo: "cron" | "panel") {
  const start = Date.now();
  const w = await przebiegLowcy(start);
  const trwalo = Date.now() - start;

  await odnotujPrzebieg("lowca", !w.przerwane, w.przerwane, trwalo);

  if (w.przerwane) {
    await notify({
      kind: "lead_hunt",
      title: "Łowca leadów przerwał polowanie",
      body: w.przerwane,
      // Bez `entity`/`entityId`: to zdarzenie nie dotyczy jednego rekordu.
      // Kliknięcie prowadzi do skrzynki kandydatów — rozstrzyga to `kind`
      // w `notificationHref()`.
      // Jeden wpis na dobę na ten sam problem — dwadzieścia identycznych
      // powiadomień to nie dwadzieścia razy więcej informacji.
      dedupeKey: `lowca:blad:${todayLocalISO()}`,
    });
  } else if (w.nowych > 0) {
    await notify({
      kind: "lead_hunt",
      title: `Łowca dołożył ${w.nowych} ${w.nowych === 1 ? "kandydata" : "kandydatów"}`,
      body: `${w.ocenA} z oceną A · odsiano ${w.odsianych} · zebrano ${w.zebranych} z rejestru`,
      dedupeKey: `lowca:${todayLocalISO()}:${zrodlo}`,
    });
  }

  return { ...w, trwaloMs: trwalo, srodowisko: ceidgSrodowisko() };
}

/**
 * GET — wywołanie z crona Vercela (`vercel.json`). Wymaga nagłówka
 * `Authorization: Bearer <CRON_SECRET>`, tak jak dzienny raport. Fail-closed:
 * brak sekretu w env = trasa zamknięta, nie cicho publiczna.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[GET /api/leads/hunt/run] CRON_SECRET nie jest ustawiony w env — endpoint zablokowany.");
    return NextResponse.json({ error: "CRON_SECRET nie jest skonfigurowany w env Vercela." }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await wykonaj("cron"));
}

/** POST — „Poluj teraz" z panelu/apki. Przydaje się przy kalibracji wag;
 * domyślną drogą jest cron (decyzja właściciela: „ma działać samo"). */
export async function POST() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ceidgSkonfigurowany()) {
    return NextResponse.json(
      {
        error:
          "Brak tokenu CEIDG. Załóż konto na Biznes.gov.pl, zarejestruj się na dane.biznes.gov.pl i wpisz klucz jako CEIDG_TOKEN w zmiennych środowiskowych Vercela.",
      },
      { status: 400 }
    );
  }
  return NextResponse.json(await wykonaj("panel"));
}
