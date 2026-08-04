import { getSql } from "./db";
import { formatPlDate, odmienPl } from "./dates";
import { formatMoney } from "./invoices";
import { kluczPropozycji, kluczeOdrzucone, type RegulaPropozycji } from "./propozycje";
import { rozjazdySzkicowFaktur, warunkiProjektu } from "./warunkiObowiazujace";

/**
 * Kontrola spójności zaplecza — czy panel mówi prawdę o samym sobie.
 *
 * **Po co, skoro jest `error_log`.** Bo żadne ze znalezisk pierwszego przejścia
 * „na sucho" (`docs/PIERWSZE-PRZEJSCIE-NA-SUCHO.md`) nie rzuciło wyjątku.
 * Mail z „[Twoje imię]" wyszedł z kodem 200. Oferta bez wystawcy — 200. Klient
 * został „Prospektem" po opłaconej fakturze — też 200. Log wyjątków był i jest
 * pusty, a mimo to zaplecze kłamało.
 *
 * Czyli: „wiedzieć, co poszło nie tak" nie może znaczyć „logować wyjątki".
 * Musi znaczyć — sprawdzać twarde zdania o danych, które MUSZĄ być prawdziwe.
 *
 * ── Czym to NIE jest ───────────────────────────────────────────────────────
 * To nie jest walidacja przy zapisie (ta należy do tras) ani lista rzeczy do
 * zrobienia (ta jest na Pulpicie). To jest pytanie „czy stan bazy jest
 * wewnętrznie sprzeczny" — zadawane po fakcie, na żywych danych.
 *
 * ── Zasady pisania reguł ───────────────────────────────────────────────────
 * 1. **Zdanie twierdzące, po ludzku.** „Opłacona faktura ma klienta, który nie
 *    jest już prospektem" — nie „sprawdź status klienta". Ten plik jest
 *    zarazem opisem tego, co zaplecze ma robić.
 * 2. **Naruszenie musi wskazywać rekord**, nie tylko liczbę. Bez nazwy i linku
 *    właściciel nie ma jak zareagować, a wtedy ekran zamienia się w ozdobę.
 * 3. **Bez komentarzy `--` w środku sql``** — w tagged template nowe linie
 *    giną i `--` wycina resztę zapytania. Uczyliśmy się tego na własnej skórze
 *    (`sql-komentarz-tnie-zapytanie`).
 * 4. **Każda reguła osobno.** Jedna wywrócona nie może zabrać reszty — ta sama
 *    zasada, którą trasa /api/observability stosuje do swoich bloków.
 * 5. **„Poszło do klienta" to `wyslana_at`/`sent_at`, nie `share_token`.**
 *    Token bywa nadany albo unieważniony niezależnie od wysyłki, a dane z
 *    seeda mają status „Wysłana” bez tokenu. Pierwsza wersja tych reguł
 *    kluczowała po tokenie i milczała na wszystkim.
 */

/** Numer znaleziska z docs/PIERWSZE-PRZEJSCIE-NA-SUCHO.md, jeśli reguła
 *  pilnuje czegoś, co dziś jest znaną, NIENAPRAWIONĄ luką.
 *
 *  **Znacznik zdejmuje się razem z naprawą, reguła zostaje.** Po Fazie 1
 *  (`docs/PLAN-ZAPLECZE.md`) zeszły stąd B1, B3, B5 i B6, po Fazie 2 — A2
 *  (migawka obejmuje wystawcę), po Fazie 3 — **ostatnie trzy: C1, C3 i C4**
 *  — nie dlatego, że przestały nas obchodzić, tylko dlatego, że przestały być
 *  luką: te reguły stoją teraz jako czujki nad tym, co już działa. Lista,
 *  która tego nie odróżnia, starzeje się dokładnie tak, jak tabela Modułu 59
 *  (34 wskazania, 22 nieaktualne).
 *
 *  Lista jest dziś PUSTA i to jest wynik, nie przeoczenie. Mechanizm zostaje
 *  na następne znalezisko. */
export type Luka = string;

export type Naruszenie = {
  /** Zdanie o KONKRETNYM rekordzie — z nazwą, nie z id. */
  opis: string;
  /** Dokąd kliknąć, żeby to naprawić. */
  link?: string;
  /** Rekord, którego dotyczy — potrzebny tylko regułom sparowanym
   *  z propozycją (patrz `propozycja` niżej). */
  rekordId?: string;
};

export type WynikReguly = {
  id: string;
  zdanie: string;
  /** Dlaczego to boli — jedno zdanie, dla kogoś, kto nie pamięta kontekstu. */
  dlaczego: string;
  luka?: Luka;
  /** "wysoka" = widzi to klient albo ma skutek prawny. */
  powaga: "wysoka" | "srednia";
  naruszenia: Naruszenie[];
  /** Reguła sama się wywróciła — nie mylić z „zero naruszeń". */
  blad?: string;
};

type Regula = Omit<WynikReguly, "naruszenia" | "blad"> & {
  zbierz: () => Promise<Naruszenie[]>;
  /**
   * Reguła propozycji pilnująca tego samego (Faza 3). Ustawiona = naruszenia,
   * które właściciel ŚWIADOMIE odrzucił („Nie teraz"), znikają z tego ekranu.
   *
   * Dlaczego tylko odrzucone, a nie też czekające: propozycja czekająca to
   * naprawdę sprzeczny stan — tyle że z jednoklikowym wyjściem na Pulpicie.
   * Odrzucona to rozstrzygnięta decyzja właściciela, a ekran, który świeci na
   * czerwono z powodu cudzej świadomej decyzji, uczy tylko ignorowania
   * czerwieni (ta sama lekcja, co przy dev-seedzie w Fazie 2).
   */
  propozycja?: RegulaPropozycji;
};

const tekst = (v: unknown, zapas = "(bez nazwy)"): string =>
  typeof v === "string" && v.trim() ? v.trim() : zapas;

function reguly(): Regula[] {
  const sql = getSql();
  return [
    {
      id: "oplacona-faktura-a-klient-prospekt",
      zdanie: "Klient z opłaconą fakturą nie jest już „Prospektem”",
      dlaczego:
        "Prospekt to ktoś, z kim jeszcze rozmawiam. Jeśli zapłacił fakturę, " +
        "to nie prospekt — a wszystkie liczby liczone po statusie kłamią.",
      powaga: "srednia",
      propozycja: "oplacony-klient-aktywny",
      zbierz: async () => {
        const r = await sql`
          SELECT c.id AS klient_id, c.nazwa, i.numer
          FROM invoices i JOIN clients c ON c.id = i.client_id
          WHERE i.status = 'Opłacona' AND c.status = 'Prospekt'
          ORDER BY i.updated_at DESC LIMIT 20;
        `;
        return r.map((w) => ({
          opis: `${tekst(w.nazwa)} zapłacił(a) ${tekst(w.numer, "fakturę")}, a nadal ma status „Prospekt”`,
          link: `/pl/admin/clients/${w.klient_id}`,
          rekordId: String(w.klient_id),
        }));
      },
    },
    {
      id: "projekt-z-opinia-niezamkniety",
      zdanie: "Projekt, o którym klient wystawił opinię, jest zamknięty",
      dlaczego:
        "Opinia przychodzi na końcu współpracy. Otwarty projekt po opinii " +
        "zawyża „w toku” i psuje wskaźnik zamkniętych projektów z opinią.",
      powaga: "srednia",
      propozycja: "opinia-zamyka-projekt",
      zbierz: async () => {
        const r = await sql`
          SELECT id, tytul, status FROM projects
          WHERE review_submitted_at IS NOT NULL AND status <> 'Wdrożone'
          ORDER BY review_submitted_at DESC LIMIT 20;
        `;
        return r.map((w) => ({
          opis: `„${tekst(w.tytul)}” ma opinię klienta, a status to „${tekst(w.status, "?")}”`,
          link: `/pl/admin/projects/${w.id}`,
          rekordId: String(w.id),
        }));
      },
    },
    {
      id: "wygrany-lead-z-przypomnieniem",
      zdanie: "Wygrany lead nie ma już zaplanowanego przypomnienia",
      dlaczego:
        "Po wygranej przypomnienie wskoczy do „Wymaga działania dziś” i każe " +
        "oddzwonić w sprawie, która jest już zamknięta.",
      powaga: "srednia",
      propozycja: "wygrany-lead-bez-przypomnienia",
      zbierz: async () => {
        const r = await sql`
          SELECT id, firma, next_followup, next_action FROM leads
          WHERE status = 'Zamknięte - sukces' AND next_followup IS NOT NULL
          ORDER BY next_followup ASC LIMIT 20;
        `;
        return r.map((w) => ({
          opis:
            `${tekst(w.firma)} — wygrany, a ma przypomnienie na ${tekst(w.next_followup, "?")}` +
            (tekst(w.next_action, "") ? `: „${tekst(w.next_action)}”` : ""),
          link: `/pl/admin/leads/${w.id}`,
          rekordId: String(w.id),
        }));
      },
    },
    {
      id: "wyslany-dokument-bez-wystawcy-w-migawce",
      zdanie: "Migawka wysłanego dokumentu zawiera dane wystawcy",
      dlaczego:
        "Migawka ma być tym, CO KLIENT ZOBACZYŁ. Jeśli nie obejmuje wystawcy, " +
        "zmiana nazwy firmy, NIP-u albo konta zmienia wstecz każdy dokument, " +
        "który klient wciąż może otworzyć. To jedyne z tych naruszeń, które ma " +
        "skutek prawny.",
      powaga: "wysoka",
      zbierz: async () => {
        const of = await sql`
          SELECT id, tytul FROM offers
          WHERE wyslana_at IS NOT NULL
            AND (migawka IS NULL OR NOT jsonb_exists(migawka, 'wystawca'))
          ORDER BY updated_at DESC LIMIT 20;
        `;
        const um = await sql`
          SELECT id, klient_nazwa FROM contracts
          WHERE sent_at IS NOT NULL
            AND (migawka IS NULL OR NOT jsonb_exists(migawka, 'wystawca'))
          ORDER BY updated_at DESC LIMIT 20;
        `;
        // Faktura dołączyła w Fazie 2 — i to ona jest tu najostrzejsza.
        // Migawkę dostaje przy WYSTAWIENIU (nadaniu numeru), nie przy
        // wysyłce: od numeru dokument jest niezmienny, a wysyłek bywa kilka.
        // Dlatego pytamy o `numer`, nie o ślad wysyłki.
        const fa = await sql`
          SELECT id, numer FROM invoices
          WHERE status <> 'Szkic' AND COALESCE(numer, '') <> ''
            AND (migawka IS NULL OR NOT jsonb_exists(migawka, 'wystawca'))
          ORDER BY updated_at DESC LIMIT 20;
        `;
        return [
          ...fa.map((w) => ({
            opis: `faktura ${tekst(w.numer, "(bez numeru)")} nie ma zamrożonych danych sprzedawcy`,
            link: `/pl/admin/invoices/${w.id}`,
          })),
          ...of.map((w) => ({
            opis: `oferta „${tekst(w.tytul)}” jest u klienta bez zamrożonych danych wystawcy`,
            link: `/pl/admin/offers/${w.id}`,
          })),
          ...um.map((w) => ({
            opis: `umowa dla ${tekst(w.klient_nazwa)} jest u klienta bez zamrożonych danych wystawcy`,
            link: `/pl/admin/contracts/${w.id}`,
          })),
        ];
      },
    },
    {
      id: "wyslana-oferta-bez-adresu-klienta",
      zdanie: "Dokument wysłany do klienta ma jego adres",
      dlaczego:
        "Adres jest na karcie klienta, ale nie przeszedł na dokument. Klient " +
        "dostaje ofertę zaadresowaną do samej nazwy firmy. Przepisanie robi " +
        "od Fazy 1 jedno miejsce (lib/przepisanie.ts) — ta reguła pilnuje, " +
        "żeby żadna droga go nie omijała.",
      powaga: "wysoka",
      zbierz: async () => {
        const r = await sql`
          SELECT id, tytul, klient_nazwa FROM offers
          WHERE wyslana_at IS NOT NULL
            AND (COALESCE(klient_ulica, '') = '' OR COALESCE(klient_miasto, '') = '')
          ORDER BY updated_at DESC LIMIT 20;
        `;
        return r.map((w) => ({
          opis: `oferta „${tekst(w.tytul)}” poszła do klienta bez adresu`,
          link: `/pl/admin/offers/${w.id}`,
        }));
      },
    },
    {
      id: "faktura-z-oferty-gubi-dane-nabywcy",
      zdanie: "Faktura z oferty ma te same dane nabywcy co oferta",
      dlaczego:
        "To jest czujka nad Fazą 1: szkic faktury powstaje przy akceptacji " +
        "oferty i ma być jej wierną odbitką. Gdy się odezwie, znaczy to, że " +
        "któraś droga znowu przepisuje dane po swojemu — dokładnie tak " +
        "zginął e-mail nabywcy (luka B2) na dokumencie, który się WYSYŁA mailem.",
      powaga: "wysoka",
      zbierz: async () => {
        const r = await sql`
          SELECT i.id, i.numer, o.tytul
          FROM invoices i JOIN offers o ON o.id = i.offer_id
          WHERE (COALESCE(o.klient_email, '') <> '' AND COALESCE(i.klient_email, '') = '')
             OR (COALESCE(o.klient_ulica, '') <> '' AND COALESCE(i.klient_ulica, '') = '')
             OR (COALESCE(o.klient_nip, '') <> '' AND COALESCE(i.klient_nip, '') = '')
          ORDER BY i.updated_at DESC LIMIT 20;
        `;
        return r.map((w) => ({
          opis: `${tekst(w.numer, "szkic faktury")} z oferty „${tekst(w.tytul)}” ma mniej danych nabywcy niż sama oferta`,
          link: `/pl/admin/invoices/${w.id}`,
        }));
      },
    },
    {
      id: "faktura-bez-umowy-mimo-podpisanej",
      zdanie: "Faktura zna umowę, która dotyczy tego samego zlecenia",
      dlaczego:
        "Faktura powstaje przy akceptacji oferty, umowa dopiero potem. Od " +
        "Fazy 1 generowanie umowy dopina ją wstecz do faktury z tej samej " +
        "oferty — ta reguła łapie wszystko, co przyszło inną drogą.",
      powaga: "srednia",
      zbierz: async () => {
        const r = await sql`
          SELECT i.id, i.numer, i.project_id
          FROM invoices i
          JOIN contracts ct ON ct.project_id = i.project_id AND ct.typ = 'umowa'
          WHERE i.contract_id IS NULL AND i.project_id IS NOT NULL
          ORDER BY i.updated_at DESC LIMIT 20;
        `;
        return r.map((w) => ({
          opis: `${tekst(w.numer, "szkic faktury")} nie wskazuje umowy, choć projekt ją ma`,
          link: `/pl/admin/invoices/${w.id}`,
        }));
      },
    },
    {
      id: "projekt-z-podpisana-umowa-bez-terminu",
      zdanie: "Projekt z podpisaną umową ma termin",
      dlaczego:
        "Umowa niesie termin realizacji, projekt bierze go przy podpisie " +
        "(Faza 1). Bez daty projekt nie pojawia się na osi czasu ani " +
        "w przypomnieniach o terminie.",
      powaga: "srednia",
      zbierz: async () => {
        const r = await sql`
          SELECT p.id, p.tytul
          FROM projects p
          JOIN contracts ct ON ct.project_id = p.id AND ct.typ = 'umowa'
          WHERE ct.status = 'Podpisana' AND p.termin IS NULL
          ORDER BY p.updated_at DESC LIMIT 20;
        `;
        return r.map((w) => ({
          opis: `„${tekst(w.tytul)}” ma podpisaną umowę i nie ma terminu`,
          link: `/pl/admin/projects/${w.id}`,
        }));
      },
    },
    {
      id: "termin-projektu-wg-obowiazujacej-umowy",
      zdanie: "Termin projektu zgadza się z obowiązującą umową",
      dlaczego:
        "Reguła obok („Projekt z podpisaną umową ma termin”) pyta o OBECNOŚĆ " +
        "daty, nie o jej zgodność — i dlatego przeszła przy trzech dokumentach " +
        "z trzema różnymi terminami (25.08 / 15.09 / 22.09). Od podpisu projekt " +
        "bierze termin z warunków obowiązujących; gdy się rozjeżdża, ktoś zmienił " +
        "go ręcznie albo aneks nie doszedł do projektu.",
      powaga: "wysoka",
      zbierz: async () => {
        // Zawężenie kandydatów w SQL — WARUNEK KONIECZNY, nie cała reguła.
        // Rozstrzyga dopiero `warunkiProjektu` (jedno źródło), ale pytanie
        // o nie kosztuje dwa zapytania na projekt, a `neon()` to jedno żądanie
        // HTTP na zapytanie (lekcja `bramka-migracji`). Bez aneksów obowiązuje
        // sama umowa, więc rozjazd wymaga wtedy różnicy dat — a gdy aneks
        // istnieje, pytamy zawsze, bo mógł przesunąć termin na ten z projektu.
        const projekty = await sql`
          SELECT DISTINCT p.id, p.tytul, p.termin
          FROM projects p
          JOIN contracts ct ON ct.project_id = p.id AND ct.typ = 'umowa' AND ct.status = 'Podpisana'
          WHERE p.termin IS NOT NULL
            AND (
              ct.termin_realizacji IS DISTINCT FROM p.termin
              OR EXISTS (
                SELECT 1 FROM contracts a
                WHERE a.parent_contract_id = ct.id AND a.typ = 'aneks' AND a.status = 'Podpisana'
              )
            )
          ORDER BY p.id LIMIT 20;
        `;
        const out: Naruszenie[] = [];
        for (const w of projekty) {
          const warunki = await warunkiProjektu(sql, String(w.id));
          const wgUmowy = warunki?.termin_realizacji ?? null;
          const wProjekcie = String(w.termin ?? "").slice(0, 10) || null;
          if (!wgUmowy || wgUmowy === wProjekcie) continue;
          out.push({
            opis:
              `„${tekst(w.tytul)}” ma termin ${formatPlDate(wProjekcie)}, ` +
              `a ${warunki!.zrodlo.opis} mówi ${formatPlDate(wgUmowy)}`,
            link: `/pl/admin/projects/${w.id}`,
          });
          if (out.length >= 20) break;
        }
        return out;
      },
    },
    {
      id: "kamienie-po-terminie-projektu",
      zdanie: "Kamienie milowe mieszczą się w terminie projektu",
      dlaczego:
        "Termin z umowy wygrywa z terminem z szablonu (decyzja właściciela, " +
        "2026-08-04), ale kamieni milowych nie przesuwamy po cichu — mogły być " +
        "uzgodnione z klientem. Zamiast tego mówimy wprost, że się nie mieszczą.",
      powaga: "srednia",
      zbierz: async () => {
        const r = await sql`
          SELECT p.id, p.tytul, p.termin, COUNT(m.id) AS ile, MAX(m.termin) AS ostatni
          FROM projects p
          JOIN project_milestones m ON m.project_id = p.id
          WHERE p.termin IS NOT NULL AND m.termin IS NOT NULL AND m.termin > p.termin
          GROUP BY p.id, p.tytul, p.termin
          ORDER BY p.updated_at DESC LIMIT 20;
        `;
        return r.map((w) => ({
          opis:
            `„${tekst(w.tytul)}” kończy się ${formatPlDate(String(w.termin).slice(0, 10))}, ` +
            `a ${Number(w.ile)} ` +
            odmienPl(Number(w.ile), "kamień milowy wypada", "kamienie milowe wypadają", "kamieni milowych wypada") +
            ` po tej dacie (ostatni ${formatPlDate(String(w.ostatni).slice(0, 10))})`,
          link: `/pl/admin/projects/${w.id}`,
        }));
      },
    },
    {
      id: "szkic-faktury-wg-obowiazujacych-warunkow",
      zdanie: "Kwota szkicu faktury zgadza się z obowiązującymi warunkami",
      dlaczego:
        "Podpisany aneks podniósł wynagrodzenie z 11 000 na 15 000 zł, a szkic " +
        "faktury dalej opiewał na 11 000 — i graf „SKĄD I DOKĄD” pokazywał obie " +
        "kwoty obok siebie, nie oznaczając tego jako problemu. Ta sama funkcja " +
        "co propozycja obok (lib/warunkiObowiazujace.ts), żeby ekran i podpowiedź " +
        "nie mogły się rozjechać.",
      powaga: "wysoka",
      propozycja: "faktura-wg-obowiazujacych-warunkow",
      zbierz: async () => {
        const rozjazdy = await rozjazdySzkicowFaktur(sql);
        return rozjazdy.map((r) => ({
          opis:
            `${tekst(r.numer, "szkic faktury")} dla ${tekst(r.klientNazwa)} opiewa na ` +
            `${formatMoney(r.netto, r.waluta)} netto, a ${r.warunki.zrodlo.opis} ustala ` +
            `${formatMoney(r.warunki.cena, r.waluta)}`,
          link: `/pl/admin/invoices/${r.invoiceId}`,
          rekordId: r.invoiceId,
        }));
      },
    },
    {
      id: "wystawiona-faktura-bez-numeru",
      zdanie: "Każda niebędąca szkicem faktura ma numer i datę wystawienia",
      dlaczego:
        "To integralność dokumentu księgowego. Ta reguła nie pilnuje żadnej " +
        "znanej luki — stoi tu jako czujka, bo gdyby kiedykolwiek się odezwała, " +
        "znaczyłoby to, że numeracja się rozjechała.",
      powaga: "wysoka",
      zbierz: async () => {
        const r = await sql`
          SELECT id, status, numer FROM invoices
          WHERE status <> 'Szkic'
            AND (numer IS NULL OR COALESCE(numer, '') = '' OR data_wystawienia IS NULL)
          ORDER BY updated_at DESC LIMIT 20;
        `;
        return r.map((w) => ({
          opis: `faktura w stanie „${tekst(w.status, "?")}” bez numeru albo bez daty wystawienia`,
          link: `/pl/admin/invoices/${w.id}`,
        }));
      },
    },
  ];
}

export type StanSpojnosci = {
  reguly: WynikReguly[];
  /** Ile reguł ma choć jedno naruszenie. */
  naruszonych: number;
  /** Suma naruszeń — do jednej liczby na ekranie. */
  naruszenRazem: number;
};

/**
 * Uruchamia wszystkie reguły. Każda w osobnym try/catch: reguła, która sama
 * się wywróci, nie może zabrać pozostałych ani całego ekranu.
 */
export async function sprawdzSpojnosc(): Promise<StanSpojnosci> {
  // Świadome „Nie teraz" właściciela — patrz `propozycja` przy regule.
  const odrzucone = await kluczeOdrzucone();

  const wyniki = await Promise.all(
    reguly().map(async (r): Promise<WynikReguly> => {
      const { zbierz, propozycja, ...opis } = r;
      try {
        const naruszenia = await zbierz();
        return {
          ...opis,
          naruszenia: propozycja
            ? naruszenia.filter((n) => !n.rekordId || !odrzucone.has(kluczPropozycji(propozycja, n.rekordId)))
            : naruszenia,
        };
      } catch (e) {
        console.error(`[spójność] reguła ${r.id}`, e);
        return {
          ...opis,
          naruszenia: [],
          blad: e instanceof Error ? e.message : String(e),
        };
      }
    })
  );

  return {
    reguly: wyniki,
    naruszonych: wyniki.filter((w) => w.naruszenia.length > 0).length,
    naruszenRazem: wyniki.reduce((s, w) => s + w.naruszenia.length, 0),
  };
}
