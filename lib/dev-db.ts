/**
 * Lokalna baza deweloperska (PGlite = Postgres w WASM, w procesie).
 *
 * Używana WYŁĄCZNIE gdy NODE_ENV=development i brak connection stringa do
 * prawdziwej bazy — patrz getSql() w db.ts. Nigdy na produkcji. Dzięki temu
 * `npm run dev` daje w pełni działający panel z danymi bez podłączania Neona,
 * bez Vercel CLI i bez ryzyka tknięcia produkcyjnych danych. Mówi prawdziwym
 * SQL-em, więc wszystkie route'y i migracje (`CREATE TABLE IF NOT EXISTS`)
 * działają bez zmian.
 *
 * Adapter naśladuje sygnaturę taga neon-a: `sql\`SELECT ... ${x}\`` → Promise<
 * rows[]>. Daty (DATE/TIMESTAMP) zwracamy jako stringi, tak jak robi to
 * neonowy klient HTTP — inaczej `parseDate`/`formatPlDate` dostałyby obiekty
 * Date i się wywaliły.
 */
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { isInMigration } from "./migration-ctx";

type Row = Record<string, unknown>;
type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Row[]>;

let db: PGlite | null = null;
let seedPromise: Promise<void> | null = null;

function getDb(): PGlite {
  if (!db) {
    db = new PGlite({
      // Zwracaj daty jako surowe stringi (jak neon), nie obiekty Date.
      parsers: {
        1082: (v: string) => v, // date
        1114: (v: string) => v, // timestamp
        1184: (v: string) => v, // timestamptz
      },
    });
  }
  return db;
}

/** Surowe zapytanie do PGlite — bez czekania na seed. Używane wewnętrznie
 * przez seeder i przez publiczny tag po wykonaniu seeda. */
async function raw(text: string, params: unknown[]): Promise<Row[]> {
  const res = await getDb().query(text, params);
  return res.rows as Row[];
}

/** Zamienia tagged-template neon-a na sparametryzowane zapytanie Postgresa
 * ($1, $2, …), które rozumie PGlite. */
function buildQuery(strings: TemplateStringsArray, values: unknown[]): { text: string; params: unknown[] } {
  let text = "";
  strings.forEach((part, i) => {
    text += part;
    if (i < values.length) text += `$${i + 1}`;
  });
  return { text, params: values };
}

function isDDL(text: string): boolean {
  return /^\s*(CREATE|ALTER|DROP)\b/i.test(text);
}

const day = 86400000;
function iso(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * day).toISOString().slice(0, 10);
}

/** Wypełnia dev-bazę realistycznymi danymi RAZ — dopiero po tym, jak schemat
 * już istnieje (tworzą go migracje aplikacji przez getSql()). */
async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      // Schemat tworzą migracje aplikacji, ale seeder może odpalić się jako
      // pierwszy — więc na wszelki wypadek importujemy i uruchamiamy je tu.
      const { ensureLeadsSchema, ensureHubSchema, ensureClientsSchema, ensureMailSchema } = await import("./db");
      await ensureLeadsSchema();
      await ensureHubSchema();
      await ensureClientsSchema();
      await ensureMailSchema();

      const existing = await raw("SELECT COUNT(*)::int AS n FROM projects", []);
      if ((existing[0]?.n as number) > 0) return; // już zaseedowane

      // — Leady —
      const leadA = randomUUID();
      const leadB = randomUUID();
      await raw(
        `INSERT INTO leads (id, firma, osoba_kontaktowa, branza, telefon, email, www, miasto, zrodlo_kategoria, zrodlo, status, ostatni_kontakt, notatki)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13),($14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)`,
        [
          leadA, "Kancelaria Kowalski", "Marek Kowalski", "Prawo", "600100200", "biuro@kowalski.pl", "kowalski.pl", "Warszawa", "Polecenie", "", "Rozmowa umówiona", iso(-2), "Zainteresowani automatyzacją umów.",
          leadB, "Piekarnia Złoty Kłos", "", "Gastronomia", "500300400", "kontakt@zlotyklos.pl", "zlotyklos.pl", "Wilanów", "Formularz na stronie", "", "Nowe zgłoszenie ze strony", iso(-6), "",
        ]
      );

      // — Projekty (z datami i kamieniami milowymi — żeby oś czasu żyła) —
      const projects = [
        { tytul: "Website", zdrowie: "Na dobrej drodze", priorytet: "Wysoki", start: iso(-8), termin: iso(40), lead: leadA,
          milestones: [ ["Discovery", iso(2)], ["Design", iso(18)], ["Wdrożenie", iso(34)] ] },
        { tytul: "Leggera Source", zdrowie: "Zagrożony", priorytet: "Normalny", start: iso(-1), termin: iso(55), lead: null,
          milestones: [ ["MVP scraper", iso(14)], ["Integracja API", iso(38)] ] },
        { tytul: "Leggera Flow", zdrowie: "Na dobrej drodze", priorytet: "Niski", start: iso(20), termin: iso(70), lead: null,
          milestones: [ ["Model procesu", iso(35)] ] },
      ];
      for (let i = 0; i < projects.length; i++) {
        const p = projects[i];
        const pid = randomUUID();
        await raw(
          `INSERT INTO projects (id, tytul, opis, status, priorytet, zdrowie, start, termin, lead_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [pid, p.tytul, "Opis przykładowego projektu — dev seed.", "W trakcie", p.priorytet, p.zdrowie, p.start, p.termin, p.lead]
        );
        for (let m = 0; m < p.milestones.length; m++) {
          await raw(
            `INSERT INTO project_milestones (id, project_id, nazwa, termin, position) VALUES ($1,$2,$3,$4,$5)`,
            [randomUUID(), pid, p.milestones[m][0], p.milestones[m][1], m]
          );
        }
        // Parę zadań, żeby pasek postępu na kartach kanbana coś pokazywał.
        for (let t = 0; t < 4; t++) {
          await raw(
            `INSERT INTO project_tasks (id, project_id, text, done, position) VALUES ($1,$2,$3,$4,$5)`,
            [randomUUID(), pid, `Zadanie ${t + 1}`, t < 2, t]
          );
        }
      }

      // — Notatki —
      await raw(
        `INSERT INTO notes (id, tytul, tresc, tagi) VALUES ($1,$2,$3,$4),($5,$6,$7,$8)`,
        [
          randomUUID(), "Pomysł: newsletter", "Cotygodniowy mail z case studies.", "marketing, pomysł",
          randomUUID(), "Do przemyślenia: cennik", "Może pakiet founding partner?", "biznes",
        ]
      );

      // — Wydarzenia (dziś + w tym miesiącu) —
      await raw(
        `INSERT INTO events (id, tytul, data, godzina) VALUES ($1,$2,$3,$4),($5,$6,$7,$8)`,
        [
          randomUUID(), "Call z klientem", iso(0), "10:00",
          randomUUID(), "Demo produktu", iso(3), "14:30",
        ]
      );

      // — Klient (Moduł 4: bez klienta nie da się lokalnie sprawdzić
      //   dopasowania maila po adresie ani wpisu na osi kontaktu) —
      const clientA = randomUUID();
      await raw(
        `INSERT INTO clients (id, nazwa, osoba_kontaktowa, email, telefon, status, ostatni_kontakt)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [clientA, "Nordwind Studio", "Anna Nowak", "anna@nordwind.pl", "601202303", "Aktywny", iso(-3)]
      );

      // — Poczta (Moduł 4) —
      // Dev nie ma dostępu do skrzynki az.pl (IMAP żyje tylko na Vercelu z
      // env właściciela), więc realny sync symulujemy: wstawiamy wprost do
      // mail_messages to, co normalnie zapisałby lib/mailSync.ts. Cztery
      // wiersze pokrywają wszystkie ścieżki modułu: mail od KLIENTA (kanał
      // e-mail na osi kontaktu), od LEADA, z nieznanego adresu (kolejka
      // "Nieprzypisane" → "Utwórz leada") i newsletter (wyciszony szum).
      const mailClient = randomUUID();
      const mailLead = randomUUID();
      const mailUnknown = randomUUID();
      const mailNoise = randomUUID();
      // `thread_id` seedowany od razu jako własny `message_id` (self-rooted) —
      // reprezentuje stan "po backfillu" zamiast polegać na tym, że
      // backfillThreadIds() zdąży zadziałać przed pierwszym obejrzeniem w devie.
      await raw(
        `INSERT INTO mail_messages (id, uid, kierunek, client_id, lead_id, from_addr, from_name, to_addr, subject, body_text, message_id, thread_id, status, received_at)
         VALUES ($1,$2,'in',$3,NULL,$4,$5,$6,$7,$8,$9,$9,'nowy',now() - interval '2 hours'),
                ($10,$11,'in',NULL,$12,$13,$14,$15,$16,$17,$18,$18,'nowy',now() - interval '1 day'),
                ($19,$20,'in',NULL,NULL,$21,$22,$23,$24,$25,$26,$26,'nowy',now() - interval '3 hours'),
                ($27,$28,'in',NULL,NULL,$29,$30,$31,$32,$33,$34,$34,'zignorowany',now() - interval '5 hours')`,
        [
          mailClient, 101, clientA, "anna@nordwind.pl", "Anna Nowak", "kontakt@leggeralabs.pl",
          "Prośba o zmianę w panelu", "Cześć, czy dałoby się dodać eksport do CSV na liście zamówień?\n\nPozdrawiam,\nAnna", "<dev-client-1@nordwind.pl>",

          mailLead, 102, leadA, "biuro@kowalski.pl", "Marek Kowalski", "kontakt@leggeralabs.pl",
          "Re: Automatyzacja umów", "Dzień dobry, wracam do tematu — kiedy moglibyśmy porozmawiać?", "<dev-lead-1@kowalski.pl>",

          mailUnknown, 103, "zapytanie@nowafirma.pl", "Tomasz Wiśniewski", "kontakt@leggeralabs.pl",
          "Zapytanie o współpracę", "Dzień dobry, szukamy kogoś do automatyzacji obiegu faktur. Czy moglibyśmy porozmawiać?", "<dev-unknown-1@nowafirma.pl>",

          // Prawdziwy przypadek zgłoszony przez właściciela 2026-07-15:
          // "noreply" jest tu NA KOŃCU lokalnej części, przez co pierwsza
          // wersja filtra (startsWith) przepuściła go jako "do odpowiedzi".
          // Zostaje w seedzie jako regresja — ma na zawsze wpadać w "reklama".
          mailNoise, 104, "jobalerts-noreply@linkedin.com", "Alerty o ofertach pracy na LinkedIn", "kontakt@leggeralabs.pl",
          "„Konsultant systemu SAP”: SAP Systemanalytiker Banking Platform (m/w/d) i więcej",
          "Twój alert o ofertach pracy na stanowisko Konsultant systemu SAP\nNowe oferty pracy pasują do Twoich preferencji.",
          "<dev-noise-1@linkedin.com>",
        ]
      );

      // Screener nowych nadawców (Moduł 4, Etap 3) — dokładnie to, co
      // saveIncoming() (lib/mailSync.ts) zapisałby dla ŚWIEŻO
      // zsynchronizowanego maila kategorii 'oferta': sam wiersz w
      // mail_messages (kategoria świadomie NIE NULL, w odróżnieniu od
      // mailUnknown wyżej — ten reprezentuje pocztę sprzed wprowadzenia
      // kategorii) + wpis 'pending' w mail_senders. Bez tego drugiego wiersza
      // bramka nie miałaby czego pokazać w "Nowi nadawcy".
      const mailScreener = randomUUID();
      await raw(
        `INSERT INTO mail_messages (id, uid, kierunek, from_addr, from_name, to_addr, subject, body_text, message_id, thread_id, status, kategoria, received_at)
         VALUES ($1,106,'in',$2,$3,$4,$5,$6,$7,$7,'nowy','oferta',now() - interval '30 minutes')`,
        [
          mailScreener, "kontakt@nieznanafirma.pl", "Piotr Zieliński", "kontakt@leggeralabs.pl",
          "Zapytanie o wdrożenie",
          "Dzień dobry, natrafiłem na Państwa stronę i chciałbym zapytać o możliwość współpracy przy automatyzacji procesów.",
          "<dev-screener-1@nieznanafirma.pl>",
        ]
      );
      await raw(
        `INSERT INTO mail_senders (id, email, status) VALUES ($1,$2,'pending')`,
        [randomUUID(), "kontakt@nieznanafirma.pl"]
      );

      // Moduł 22 — DWIE wiadomości z tego samego, nieznanego adresu.
      //
      // Odwzorowuje lukę, dla której powstał ten moduł: klientka (Anna z
      // Nordwind Studio) pisze z prywatnej skrzynki, więc auto-dopasowanie
      // po równości adresu (findContactsByEmail) nie ma się o co zaczepić i
      // KAŻDA jej wiadomość ląduje w "Nieprzypisane". Dwie sztuki, bo dopiero
      // przy zaległości panel pyta "zapamiętać ten adres?" — przy jednej
      // wiadomości pytanie nie ma sensu i nie pada.
      const mailAliasA = randomUUID();
      const mailAliasB = randomUUID();
      await raw(
        `INSERT INTO mail_messages (id, uid, kierunek, from_addr, from_name, to_addr, subject, body_text, message_id, thread_id, status, kategoria, received_at)
         VALUES ($1,107,'in',$2,$3,$4,$5,$6,$7,$7,'nowy','rozmowa',now() - interval '3 hours')`,
        [
          mailAliasA, "anna.nowak.prywatnie@gmail.com", "Anna Nowak", "kontakt@leggeralabs.pl",
          "Pytanie z prywatnej skrzynki",
          "Cześć, piszę z prywatnego adresu, bo służbowa poczta mi dziś nie działa. Czy zdążymy z panelem na piątek?",
          "<dev-alias-1@gmail.com>",
        ]
      );
      await raw(
        `INSERT INTO mail_messages (id, uid, kierunek, from_addr, from_name, to_addr, subject, body_text, message_id, thread_id, status, kategoria, received_at)
         VALUES ($1,108,'in',$2,$3,$4,$5,$6,$7,$7,'nowy','rozmowa',now() - interval '2 hours')`,
        [
          mailAliasB, "anna.nowak.prywatnie@gmail.com", "Anna Nowak", "kontakt@leggeralabs.pl",
          "Jeszcze jedno pytanie",
          "I druga sprawa — czy fakturę wystawicie na koniec miesiąca, czy po odbiorze?",
          "<dev-alias-2@gmail.com>",
        ]
      );

      // Wątkowanie (Moduł 4, Etap 3) — druga połowa wątku "Re: Automatyzacja
      // umów": to, co WYSŁALIŚMY do Marka WCZEŚNIEJ (Wysłane), na co mailLead
      // (Odebrane) jest odpowiedzią. Jedyny sposób, żeby lokalnie sprawdzić
      // pasek wątku ROZPIĘTY MIĘDZY DWOMA FOLDERAMI (Wysłane + Odebrane) — bez
      // tego wiersza cross-folder thread strip nie miałby czego pokazać w devie.
      const mailLeadOriginal = randomUUID();
      await raw(
        `INSERT INTO mail_messages (id, uid, kierunek, folder, lead_id, from_addr, to_addr, subject, body_text, message_id, thread_id, status, received_at)
         VALUES ($1,100,'out','sent',$2,$3,$4,$5,$6,$7,$7,'obsłużony',now() - interval '2 days')`,
        [
          mailLeadOriginal, leadA, "kontakt@leggeralabs.pl", "biuro@kowalski.pl",
          "Automatyzacja umów",
          "Dzień dobry, przesyłam wstępną propozycję zakresu automatyzacji obiegu umów — dajcie znać, co Państwo o niej myślicie.",
          "<dev-lead-1-original@leggeralabs.pl>",
        ]
      );
      await raw(
        `UPDATE mail_messages SET in_reply_to = $1, refs = $1, thread_id = $1 WHERE id = $2`,
        ["<dev-lead-1-original@leggeralabs.pl>", mailLead]
      );

      // Wpisy na osi kontaktu — dokładnie to, co robi logMailOnTimeline()
      // przy realnym syncu (kanał e-mail, jak telefon z Modułu 3).
      await raw(
        `INSERT INTO client_activity (id, client_id, text, kanal, kierunek, mail_message_id) VALUES ($1,$2,$3,'email','przychodzacy',$4)`,
        [randomUUID(), clientA, "Prośba o zmianę w panelu — Cześć, czy dałoby się dodać eksport do CSV na liście zamówień?", mailClient]
      );
      await raw(
        `INSERT INTO lead_activity (id, lead_id, text, kanal, kierunek, mail_message_id) VALUES ($1,$2,$3,'email','przychodzacy',$4)`,
        [randomUUID(), leadA, "Re: Automatyzacja umów — Dzień dobry, wracam do tematu — kiedy moglibyśmy porozmawiać?", mailLead]
      );

      // Jedna wiadomość oflagowana jako "ważne" (04e runda 2) — bez tego nie
      // da się lokalnie zweryfikować gwiazdki w liście/podglądzie.
      await raw(`UPDATE mail_messages SET flagged = true WHERE id = $1`, [mailLead]);

      // HTML dla maila "reklamowego" — sprawdza renderowanie w izolowanej
      // ramce (lib/mailHtml.ts + MailBodyHtml.tsx). Zawiera CELOWO trzy
      // rzeczy, które MUSZĄ zostać wycięte przez odkażanie: <script>, atrybut
      // onerror= i link javascript:. Jeśli po zmianie w regułach zobaczysz w
      // panelu alert albo goły kod — to regresja bezpieczeństwa.
      await raw(
        `UPDATE mail_messages SET body_html = $1 WHERE id = $2`,
        [
          `<html><body style="font-family:sans-serif">
            <table width="600" cellpadding="8"><tr><td bgcolor="#0a66c2" style="color:#fff">
              <h2 style="margin:0">Alerty o ofertach pracy</h2></td></tr>
              <tr><td><p>Twój alert o ofertach pracy na stanowisko <b>Konsultant systemu SAP</b>.</p>
              <p><a href="https://www.linkedin.com/comm/jobs/view/4440064680/?trackingId=c9bGxz9ZszGOTqn4FoidKA%3D%3D&refId=5p%2FQ6kiuHC9hb15LfUiMWg%3D%3D&midToken=AQGsyEYTyg_tSw">Wyświetl ofertę pracy</a></p>
              <img src="https://www.linkedin.com/tracking-pixel.gif" width="1" height="1" onerror="alert('xss')">
              <p><a href="javascript:alert('xss')">Podejrzany link</a></p>
              <script>alert('xss')</script>
              </td></tr></table>
          </body></html>`,
          mailNoise,
        ]
      );

      // Mail z linkiem wypisu (Moduł 4e) — bez tego wiersza nie da się
      // lokalnie zweryfikować banera "Wiadomość z listy dystrybucyjnej",
      // PGlite nie ma dostępu do prawdziwych nagłówków IMAP. Osobny INSERT,
      // żeby nie renumerować placeholderów w tabeli czterowierszowej wyżej.
      const mailNewsletter = randomUUID();
      await raw(
        `INSERT INTO mail_messages (id, uid, kierunek, from_addr, from_name, to_addr, subject, body_text, message_id, thread_id, status, kategoria, list_unsubscribe, list_unsubscribe_url, received_at)
         VALUES ($1,105,'in',$2,$3,$4,$5,$6,$7,$7,'zignorowany','reklama',true,$8,now() - interval '6 hours')`,
        [
          mailNewsletter, "newsletter@przyklad.pl", "Przykładowy Newsletter", "kontakt@leggeralabs.pl",
          "Nowości w tym tygodniu",
          "Cześć! Oto najnowsze wiadomości i promocje z naszego sklepu.",
          "<dev-newsletter-1@przyklad.pl>",
          "https://example.com/unsubscribe?id=test",
        ]
      );

      // VIP (Moduł 4, Etap 3) — druga wiadomość od TEGO SAMEGO klienta
      // (clientA, status 'Aktywny' = VIP z automatu), ale już OBSŁUŻONA. Bez
      // tego wiersza nie da się odróżnić zakładki "VIP" (pokazuje WSZYSTKO
      // od VIP-a, niezależnie od statusu) od "Do odpowiedzi" — mailClient
      // wyżej ma i tak status='nowy' i jest widoczny wszędzie. UWAGA
      // architektoniczna: dosłowny przypadek z brifu ("VIP bije
      // kategoria='reklama'") jest NIEOSIĄGALNY dla dopasowanego klienta —
      // saveIncoming() zeruje dopasowanie PRZED klasyfikacją, gdy nadawca
      // jest szumem (patrz komentarz w lib/mailSync.ts), więc
      // kategoria='reklama' i client_id nigdy nie współistnieją. Realny
      // odpowiednik: właściciel odpisał/wyciszył — VIP i tak zostaje widoczny.
      const mailVip = randomUUID();
      await raw(
        `INSERT INTO mail_messages (id, uid, kierunek, client_id, from_addr, from_name, to_addr, subject, body_text, message_id, thread_id, status, handled_at, received_at)
         VALUES ($1,107,'in',$2,$3,$4,$5,$6,$7,$8,$8,'obsłużony',now() - interval '1 hour',now() - interval '4 hours')`,
        [
          mailVip, clientA, "anna@nordwind.pl", "Anna Nowak", "kontakt@leggeralabs.pl",
          "Re: Prośba o zmianę w panelu",
          "Dzięki za szybką odpowiedź, wszystko jasne!",
          "<dev-vip-1@nordwind.pl>",
        ]
      );

      // Snooze / Odłóż (Moduł 4, Etap 3) — jeden wiersz odłożony W PRZYSZŁOŚĆ
      // (musi zniknąć z "Do odpowiedzi"/"Nieprzypisane" i pokazać się w
      // "Uśpione"), drugi odłożony W PRZESZŁOŚĆ (termin minął — musi wrócić
      // SAM, bez żadnego crona, bo widoczność liczy się przy odczycie, patrz
      // lib/db.ts).
      const mailSnoozeFuture = randomUUID();
      const mailSnoozePast = randomUUID();
      await raw(
        `INSERT INTO mail_messages (id, uid, kierunek, from_addr, from_name, to_addr, subject, body_text, message_id, thread_id, status, snooze_until, received_at)
         VALUES ($1,108,'in',$2,$3,$4,$5,$6,$7,$7,'nowy', now() + interval '2 days', now() - interval '7 hours'),
                ($8,109,'in',$9,$10,$11,$12,$13,$14,$14,'nowy', now() - interval '1 hour', now() - interval '2 days')`,
        [
          mailSnoozeFuture, "biuro@innafirma.pl", "Kasia Zaręba", "kontakt@leggeralabs.pl",
          "Pytanie o wolny termin we wrześniu",
          "Dzień dobry, chciałabym zapytać o wolny termin — odezwę się bliżej, proszę odłożyć.",
          "<dev-snooze-future-1@innafirma.pl>",

          mailSnoozePast, "kontakt@budzik.pl", "Rafał Sowa", "kontakt@leggeralabs.pl",
          "Wracam do rozmowy",
          "Dzień dobry, wracam do wcześniejszej rozmowy — jest Pan/Pani dostępny/a w tym tygodniu?",
          "<dev-snooze-past-1@budzik.pl>",
        ]
      );

      // Nudge/Follow-up (Moduł 4f) — wątek BEZ odpowiedzi (musi pojawić się
      // w zakładce "Bez odpowiedzi" i w digescie) oraz wątek KONTROLNY, który
      // wygląda podobnie (mail wychodzący, cisza kilka dni), ale MA
      // odpowiedź — musi zostać wykluczony. Bez tej pary nie da się lokalnie
      // odróżnić poprawnego NOT EXISTS w getNudgeThreads() (lib/db.ts) od
      // przypadkowo zawsze-prawdziwego.
      const mailNudgeSent = randomUUID();
      await raw(
        `INSERT INTO mail_messages (id, uid, kierunek, folder, from_addr, to_addr, subject, body_text, message_id, thread_id, status, received_at)
         VALUES ($1,110,'out','sent',$2,$3,$4,$5,$6,$6,'obsłużony', now() - interval '8 days')`,
        [
          mailNudgeSent, "kontakt@leggeralabs.pl", "biuro@cisza.pl",
          "Oferta na wdrożenie automatyzacji",
          "Dzień dobry, w załączeniu przesyłam ofertę — czekam na odzew.",
          "<dev-nudge-sent-1@leggeralabs.pl>",
        ]
      );

      const mailNudgeControlSent = randomUUID();
      const mailNudgeControlReply = randomUUID();
      await raw(
        `INSERT INTO mail_messages (id, uid, kierunek, folder, from_addr, to_addr, subject, body_text, message_id, thread_id, status, received_at)
         VALUES ($1,111,'out','sent',$2,$3,$4,$5,$6,$6,'obsłużony', now() - interval '9 days')`,
        [
          mailNudgeControlSent, "kontakt@leggeralabs.pl", "biuro@odpowiada.pl",
          "Propozycja współpracy",
          "Dzień dobry, przesyłam propozycję współpracy — czekam na odpowiedź.",
          "<dev-nudge-control-1@leggeralabs.pl>",
        ]
      );
      await raw(
        `INSERT INTO mail_messages (id, uid, kierunek, folder, from_addr, to_addr, subject, body_text, message_id, in_reply_to, refs, thread_id, status, received_at)
         VALUES ($1,112,'in','inbox',$2,$3,$4,$5,$6,$7,$7,$7,'obsłużony', now() - interval '2 days')`,
        [
          mailNudgeControlReply, "biuro@odpowiada.pl", "kontakt@leggeralabs.pl",
          "Re: Propozycja współpracy",
          "Dzień dobry, dziękuję za propozycję — jesteśmy zainteresowani, umówmy rozmowę.",
          "<dev-nudge-control-2@odpowiada.pl>",
          "<dev-nudge-control-1@leggeralabs.pl>",
        ]
      );

      await raw(`UPDATE mail_state SET last_seen_uid = 112 WHERE id = 'default'`, []);
    })();
  }
  await seedPromise;
}

/** Publiczny tag — zgodny sygnaturą z klientem neon-a. */
export function getDevSql(): Sql {
  const tag: Sql = async (strings, ...values) => {
    const { text, params } = buildQuery(strings, values);
    // Migracje omijają seed, żeby nie było zakleszczenia: seeder sam wywołuje
    // migracje, a te wracają tutaj. `isDDL` łapie CREATE/ALTER/DROP;
    // `isInMigration()` — pozostałe zapytania migracji (INSERT-y singletonów
    // typu company_settings/mail_state), których po treści SQL-a nie da się
    // bezpiecznie odróżnić od runtime'u. Patrz lib/migration-ctx.ts.
    if (isDDL(text) || isInMigration()) return raw(text, params);
    await ensureSeeded();
    return raw(text, params);
  };
  return tag;
}

/** Odpowiednik `withTransaction()` z db.ts, ale na PGlite — używa wbudowanej
 * `db.transaction()` (prawdziwy BEGIN/COMMIT/ROLLBACK, PGlite to realny
 * silnik Postgresa w WASM, nie atrapa). */
export async function withDevTransaction<T>(fn: (sql: Sql) => Promise<T>): Promise<T> {
  await ensureSeeded();
  return getDb().transaction(async (tx) => {
    const txSql: Sql = async (strings, ...values) => {
      const { text, params } = buildQuery(strings, values);
      const res = await tx.query(text, params);
      return res.rows as Row[];
    };
    return fn(txSql);
  });
}
