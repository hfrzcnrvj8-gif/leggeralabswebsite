import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { przebiegLowcy, podejrzanyPrzebieg, BUDZET_MS } from "@/lib/leadHunterRun";
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
async function wykonaj(zrodlo: "cron" | "panel", budzetMs = BUDZET_MS) {
  const start = Date.now();
  const w = await przebiegLowcy(start, budzetMs);
  const trwalo = Date.now() - start;

  // ── Co dokładnie melduje nadzorowi (Audyt 4) ──
  //
  // Nie melduje się WCALE, dopóki nie ma tokenu: automat, którego świadomie
  // jeszcze nie skonfigurowano, nie jest automatem, który padł. Ekran „Zdrowie
  // systemu" pokaże wtedy „nie odnotowano jeszcze żadnego przebiegu", co jest
  // prawdą, i nie wyśle alarmu.
  //
  // Przerwanie budżetem czasu albo limitem rejestru melduje się jako UDANE —
  // potok po to ma kursor, żeby dokończyć jutro. Alarm o tym co rano nauczyłby
  // ignorowania alarmów, a te mają zadziałać raz na rok.
  if (!w.nieskonfigurowany) {
    await odnotujPrzebieg("lowca", !w.awaria, w.przerwane, trwalo);
  }

  // Dzwoni TYLKO awaria — nie każde przerwanie. Wyczerpany budżet czasu jest
  // normalnym końcem dziennej porcji i widać go w panelu przy polowaniu;
  // powiadomienie o nim co rano byłoby fałszywym alarmem.
  if (w.awaria || w.nieskonfigurowany) {
    await notify({
      kind: "lead_hunt",
      title: "Łowca leadów nie zapolował",
      body: w.przerwane,
      // Bez `entity`/`entityId`: to zdarzenie nie dotyczy jednego rekordu.
      // Kliknięcie prowadzi do skrzynki kandydatów — rozstrzyga to `kind`
      // w `notificationHref()`.
      // Jeden wpis na dobę na ten sam problem — dwadzieścia identycznych
      // powiadomień to nie dwadzieścia razy więcej informacji.
      dedupeKey: `lowca:blad:${todayLocalISO()}`,
    });
  } else if (podejrzanyPrzebieg(w.wzbogaconych, w.bezKontaktu)) {
    // Detektor cichej zmiany po stronie rejestru. Klient CEIDG czyta pola
    // defensywnie, więc przemianowanie `telefon` nie dałoby żadnego błędu —
    // dostawalibyśmy same firmy „bez kontaktu" i braliśmy to za chudy dzień.
    // Nie jest to awaria automatu (nie alarmujemy nadzorem), ale jest to coś,
    // co właściciel MUSI zobaczyć, zanim odpisze kilkanaście przebiegów na
    // pech.
    await notify({
      kind: "lead_hunt",
      title: "Łowca: prawie żadna firma nie ma kontaktu",
      body: `${w.bezKontaktu} z ${w.wzbogaconych} sprawdzonych firm nie miało ani telefonu, ani e-maila, ani strony. Tak wygląda zmiana kształtu danych w CEIDG — warto zajrzeć do jednego kandydata i sprawdzić, czy pola nie przychodzą puste.`,
      dedupeKey: `lowca:bez-kontaktu:${todayLocalISO()}`,
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

/**
 * POST — „Poluj teraz" z panelu/apki. Przydaje się przy kalibracji wag;
 * domyślną drogą jest cron (decyzja właściciela: „ma działać samo").
 *
 * `budzetSekund` w ciele pozwala wołającemu poprosić o KRÓTSZĄ porcję.
 * Robi tak apka: Vercel nie umie w zadanie w tle, więc funkcja żyje dokładnie
 * tak długo, jak otwarte żądanie — a telefon nie ma trzymać połączenia przez
 * cztery minuty (i tak by go nie utrzymał: jego limit to 20 s na żądanie).
 * Kursor pamięta, gdzie skończyliśmy, więc krótka porcja niczego nie gubi.
 */
export async function POST(req: NextRequest) {
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
  // Widełki, nie dowolna liczba: poniżej 20 s przebieg nie zdąży nawet na
  // jedno wzbogacenie (odstęp CEIDG to 3,8 s), a powyżej BUDZET_MS wchodzimy
  // w limit funkcji Vercela i tracimy zapis kursora.
  const body = (await req.json().catch(() => null)) as { budzetSekund?: number } | null;
  const zadany = Number(body?.budzetSekund);
  const budzetMs = Number.isFinite(zadany)
    ? Math.min(BUDZET_MS, Math.max(20_000, Math.round(zadany * 1000)))
    : BUDZET_MS;

  return NextResponse.json(await wykonaj("panel", budzetMs));
}
