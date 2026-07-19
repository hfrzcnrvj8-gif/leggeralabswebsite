import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureLeadsSchema, ensureClientsSchema, ensureMailSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { formatCallDuration, CONTACT_CHANNEL_LABEL, type ContactChannel } from "@/lib/contact";

export const runtime = "nodejs";

/** Rodzaj wpisu w rejestrze — jeden strumień „co się działo", jak spis połączeń
 * w telefonie, tyle że łącznie dla poczty i ręcznie zalogowanych rozmów.
 *
 * **Komunikatorów tu nie ma i nie będzie.** iOS nie daje żadnej aplikacji
 * dostępu do WhatsAppa/Messengera/iMessage. W panelu „whatsapp"/„linkedin"
 * istnieją WYŁĄCZNIE jako etykieta kanału przy ręcznie zalogowanej rozmowie —
 * takie wpisy wpadają tu jako `contact` z odpowiednim `kanal`, ale nikt ich
 * nigdzie nie zaciąga automatycznie. */
export type ActivityKind = "mail-in" | "mail-out" | "call" | "call-missed" | "contact";

export type ActivityItem = {
  /** Syntetyczny, stabilny id (`mail-…`, `call-led-…`) — rejestr niczego nie
   * zapisuje, ale lista potrzebuje klucza, a apka klucza do dedupu przy
   * doczytywaniu kolejnej strony. */
  id: string;
  kind: ActivityKind;
  /** Pełny znacznik czasu, malejąco — kursor stronicowania idzie po nim. */
  kiedy: string;
  /** KTO — firma, klient albo adres nadawcy. */
  tytul: string;
  /** CZEGO dotyczyło — temat maila, treść wpisu, wynik połączenia. */
  podtytul: string;
  client_id: string | null;
  lead_id: string | null;
  /** Id wiadomości, jeśli wpis JEST mailem — apka otwiera po nim podgląd.
   * Dla telefonów i wpisów ręcznych `null`; wtedy wejście prowadzi do
   * leada/klienta. */
  mail_id: string | null;
  kanal: ContactChannel | null;
  kierunek: string | null;
  wynik: string | null;
};

/** Ile wpisów naraz. Rejestr jest historią wstecz — apka doczytuje kolejne
 * strony kursorem `before`, więc pojedyncza strona może być mała. */
const DOMYSLNY_LIMIT = 60;
const MAKS_LIMIT = 200;

/** Dolny próg strony. Kursor jest włączny (patrz niżej), więc ostatni wpis
 * powtarza się na następnej stronie — przy `limit=1` powtórka wypełniałaby
 * CAŁĄ stronę i kursor nie miałby jak ruszyć do przodu. Sprawdzone: pętla
 * bez końca, zawsze ten sam wpis. Dwa to najmniejsza wartość, przy której
 * strona zawsze ma miejsce na coś nowego. */
const MIN_LIMIT = 2;

/** Brak kursora = „od teraz wstecz". `infinity` zamiast gałęzi w SQL, żeby
 * każde zapytanie miało dokładnie jeden kształt. */
const BEZ_KURSORA = "infinity";

/**
 * GET /api/activity — REJESTR wiadomości i rozmów: jeden strumień z trzech
 * źródeł (`mail_messages`, `lead_activity`, `client_activity`), posortowany
 * malejąco po dacie i stronicowany kursorem.
 *
 * Powstał pod aplikację natywną (`docs/natywna-aplikacja/03-brief-rejestr-
 * kalendarz.md`), bo trasy zbiorczej dla logów kontaktu NIE BYŁO — każde
 * zapytanie do `lead_activity`/`client_activity` filtruje po jednym rekordzie,
 * więc apka musiałaby odpytać każdy lead i każdego klienta osobno.
 *
 * Bliski krewny: `GET /api/events/deadlines`, który scala te same tabele bez
 * filtra po rekordzie. Kształt zapytań jest stamtąd; **logika zakresu nie** —
 * deadline'y są nakładką na kalendarz w oknie miesiąca, rejestr jest historią
 * wstecz.
 *
 * Parametry:
 * - `kind` — lista rodzajów po przecinku (`mail-in,call-missed`); brak = wszystko
 * - `before` — kursor: zwracamy wpisy nie młodsze niż ten znacznik czasu
 * - `limit` — 1..200, domyślnie 60
 *
 * **Kursor jest WŁĄCZNY (`<=`), nie wyłączny.** Kilka wpisów potrafi mieć
 * identyczny znacznik czasu (mail zsynchronizowany paczką, dwa wpisy dopisane
 * w tej samej sekundzie). Przy `<` granica strony wypadająca dokładnie między
 * takimi wpisami kasowałaby ten drugi — bezpowrotnie i bez żadnego objawu.
 * Cena jest niższa: ostatni wpis strony powtarza się na początku następnej,
 * a wołający odsiewa go po `id`. Apka i tak dedupuje przy doczytywaniu.
 *
 * Admin-only.
 */
export async function GET(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await ensureLeadsSchema();
  await ensureClientsSchema();
  await ensureMailSchema();
  const sql = getSql();

  const params = req.nextUrl.searchParams;

  const limitRaw = Number(params.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0
    ? Math.min(Math.max(Math.round(limitRaw), MIN_LIMIT), MAKS_LIMIT)
    : DOMYSLNY_LIMIT;

  // Kursor przepuszczamy tylko w rozpoznanym kształcie — surowy string trafia
  // do rzutowania `::timestamptz`, a niepoprawny wysadziłby całe zapytanie
  // zamiast po prostu nie zawęzić wyniku.
  const beforeRaw = (params.get("before") || "").trim();
  const before = /^\d{4}-\d{2}-\d{2}([ T].*)?$/.test(beforeRaw) ? beforeRaw : BEZ_KURSORA;

  const kindRaw = (params.get("kind") || "").trim();
  const wybrane = new Set(kindRaw ? kindRaw.split(",").map((k) => k.trim()).filter(Boolean) : []);
  const chce = (k: ActivityKind): boolean => wybrane.size === 0 || wybrane.has(k);

  // Każde źródło pobiera własne `limit` najświeższych wpisów; scalenie i
  // przycięcie do `limit` daje dokładnie tę samą listę, co jedno wielkie
  // sortowanie — bo z każdego źródła mamy z zapasem tyle, ile może się
  // zmieścić na stronie.
  const [maile, telefonyLeadow, telefonyKlientow, kontaktyLeadow, kontaktyKlientow] = await Promise.all([
    chce("mail-in") || chce("mail-out")
      ? (sql`
          SELECT id, kierunek, subject, from_name, from_addr, to_addr, received_at, client_id, lead_id
          FROM mail_messages
          WHERE received_at <= ${before}::timestamptz
            AND folder <> 'trash'
            AND (${chce("mail-in")} OR kierunek <> 'in')
            AND (${chce("mail-out")} OR kierunek = 'in')
          ORDER BY received_at DESC
          LIMIT ${limit};
        ` as unknown as Promise<
          {
            id: string; kierunek: string; subject: string; from_name: string; from_addr: string;
            to_addr: string; received_at: string; client_id: string | null; lead_id: string | null;
          }[]
        >)
      : Promise.resolve([]),

    // Telefony — `wynik` rozdziela odebrane od nieodebranych, dokładnie jak
    // w spisie połączeń. Filtr siedzi w SQL, nie po scaleniu: inaczej strona
    // „tylko nieodebrane" wracałaby prawie pusta, bo limit zjadłyby odebrane.
    chce("call") || chce("call-missed")
      ? (sql`
          SELECT a.id, a.text, a.wynik, a.kierunek, a.czas_trwania_sek, a.created_at,
                 l.id AS lead_id, l.firma, l.client_id
          FROM lead_activity a JOIN leads l ON l.id = a.lead_id
          WHERE a.kanal = 'telefon' AND a.created_at <= ${before}::timestamptz
            AND (${chce("call-missed")} OR a.wynik IS DISTINCT FROM 'nieodebrane')
            AND (${chce("call")} OR a.wynik = 'nieodebrane')
          ORDER BY a.created_at DESC
          LIMIT ${limit};
        ` as unknown as Promise<
          {
            id: string; text: string | null; wynik: string | null; kierunek: string | null;
            czas_trwania_sek: number | null; created_at: string; lead_id: string;
            firma: string; client_id: string | null;
          }[]
        >)
      : Promise.resolve([]),

    chce("call") || chce("call-missed")
      ? (sql`
          SELECT a.id, a.text, a.wynik, a.kierunek, a.czas_trwania_sek, a.created_at,
                 c.id AS client_id, c.nazwa
          FROM client_activity a JOIN clients c ON c.id = a.client_id
          WHERE a.kanal = 'telefon' AND a.created_at <= ${before}::timestamptz
            AND (${chce("call-missed")} OR a.wynik IS DISTINCT FROM 'nieodebrane')
            AND (${chce("call")} OR a.wynik = 'nieodebrane')
          ORDER BY a.created_at DESC
          LIMIT ${limit};
        ` as unknown as Promise<
          {
            id: string; text: string | null; wynik: string | null; kierunek: string | null;
            czas_trwania_sek: number | null; created_at: string; client_id: string; nazwa: string;
          }[]
        >)
      : Promise.resolve([]),

    // Reszta osi kontaktu (spotkania, WhatsApp, LinkedIn, notatki z rozmowy).
    //
    // `mail_message_id IS NULL` to NIE jest optymalizacja — bez tego każdy mail
    // przypięty do leada/klienta pojawiłby się w rejestrze DWA RAZY: raz jako
    // `mail-in`/`mail-out` z `mail_messages`, raz jako wpis na osi, który
    // panel dopisuje przy przypięciu.
    chce("contact")
      ? (sql`
          SELECT a.id, a.text, a.kanal, a.kierunek, a.created_at,
                 l.id AS lead_id, l.firma, l.client_id
          FROM lead_activity a JOIN leads l ON l.id = a.lead_id
          WHERE a.kanal IS NOT NULL AND a.kanal <> 'telefon'
            AND a.mail_message_id IS NULL
            AND a.created_at <= ${before}::timestamptz
          ORDER BY a.created_at DESC
          LIMIT ${limit};
        ` as unknown as Promise<
          {
            id: string; text: string | null; kanal: string; kierunek: string | null;
            created_at: string; lead_id: string; firma: string; client_id: string | null;
          }[]
        >)
      : Promise.resolve([]),

    chce("contact")
      ? (sql`
          SELECT a.id, a.text, a.kanal, a.kierunek, a.created_at,
                 c.id AS client_id, c.nazwa
          FROM client_activity a JOIN clients c ON c.id = a.client_id
          WHERE a.kanal IS NOT NULL AND a.kanal <> 'telefon'
            AND a.mail_message_id IS NULL
            AND a.created_at <= ${before}::timestamptz
          ORDER BY a.created_at DESC
          LIMIT ${limit};
        ` as unknown as Promise<
          {
            id: string; text: string | null; kanal: string; kierunek: string | null;
            created_at: string; client_id: string; nazwa: string;
          }[]
        >)
      : Promise.resolve([]),
  ]);

  /** Podtytuł telefonu — to samo, co niesie wiersz na osi w panelu: wynik plus
   * czas trwania, gdy znany. Wpisana ręcznie treść wygrywa, bo właściciel
   * napisał ją po to, żeby ją widzieć. */
  const podtytulTelefonu = (text: string | null, wynik: string | null, sek: number | null): string => {
    const notatka = (text || "").trim();
    if (notatka) return notatka;
    const stan = wynik === "nieodebrane" ? "Nieodebrane" : "Odebrane";
    return sek != null ? `${stan} · ${formatCallDuration(sek)}` : stan;
  };

  const etykietaKanalu = (kanal: string): string =>
    CONTACT_CHANNEL_LABEL[kanal as ContactChannel] ?? kanal;

  const wpisy: ActivityItem[] = [
    ...maile.map((m) => {
      const przychodzacy = m.kierunek === "in";
      return {
        id: `mail-${m.id}`,
        kind: (przychodzacy ? "mail-in" : "mail-out") as ActivityKind,
        kiedy: String(m.received_at),
        tytul: (przychodzacy ? m.from_name || m.from_addr : m.to_addr) || "(nieznany adres)",
        podtytul: (m.subject || "").trim() || "(bez tematu)",
        client_id: m.client_id,
        lead_id: m.lead_id,
        mail_id: m.id,
        kanal: "email" as ContactChannel,
        kierunek: przychodzacy ? "przychodzacy" : "wychodzacy",
        wynik: null,
      };
    }),
    ...telefonyLeadow.map((a) => ({
      id: `call-led-${a.id}`,
      kind: (a.wynik === "nieodebrane" ? "call-missed" : "call") as ActivityKind,
      kiedy: String(a.created_at),
      tytul: a.firma,
      podtytul: podtytulTelefonu(a.text, a.wynik, a.czas_trwania_sek),
      client_id: a.client_id,
      lead_id: a.lead_id,
      mail_id: null,
      kanal: "telefon" as ContactChannel,
      kierunek: a.kierunek,
      wynik: a.wynik,
    })),
    ...telefonyKlientow.map((a) => ({
      id: `call-cli-${a.id}`,
      kind: (a.wynik === "nieodebrane" ? "call-missed" : "call") as ActivityKind,
      kiedy: String(a.created_at),
      tytul: a.nazwa,
      podtytul: podtytulTelefonu(a.text, a.wynik, a.czas_trwania_sek),
      client_id: a.client_id,
      lead_id: null,
      mail_id: null,
      kanal: "telefon" as ContactChannel,
      kierunek: a.kierunek,
      wynik: a.wynik,
    })),
    ...kontaktyLeadow.map((a) => ({
      id: `act-led-${a.id}`,
      kind: "contact" as ActivityKind,
      kiedy: String(a.created_at),
      tytul: a.firma,
      podtytul: (a.text || "").trim() || etykietaKanalu(a.kanal),
      client_id: a.client_id,
      lead_id: a.lead_id,
      mail_id: null,
      kanal: a.kanal as ContactChannel,
      kierunek: a.kierunek,
      wynik: null,
    })),
    ...kontaktyKlientow.map((a) => ({
      id: `act-cli-${a.id}`,
      kind: "contact" as ActivityKind,
      kiedy: String(a.created_at),
      tytul: a.nazwa,
      podtytul: (a.text || "").trim() || etykietaKanalu(a.kanal),
      client_id: a.client_id,
      lead_id: null,
      mail_id: null,
      kanal: a.kanal as ContactChannel,
      kierunek: a.kierunek,
      wynik: null,
    })),
  ];

  wpisy.sort((a, b) => (a.kiedy < b.kiedy ? 1 : a.kiedy > b.kiedy ? -1 : 0));
  const strona = wpisy.slice(0, limit);

  // Kursor następnej strony liczymy z PEŁNEJ listy, nie z przyciętej — gdyby
  // wszystkie źródła oddały komplet, ostatni wpis strony jest tym, od którego
  // ma ruszyć następne żądanie. `null` = nie ma już nic starszego.
  const wiecej = wpisy.length > strona.length || strona.length === limit;
  const nastepnyKursor = wiecej && strona.length > 0 ? strona[strona.length - 1].kiedy : null;

  return NextResponse.json({ activity: strona, next: nastepnyKursor });
}
