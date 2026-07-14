// Logika "akceptacji oferty" — dzielona przez dwie ścieżki wejścia:
// app/api/offers/[id]/accept (admin, w panelu) i
// app/api/offers/public/[token]/accept (klient, e-podpis, Faza I). Musi być
// identyczna dla obu — to kod krytyczny dla poprawności (ochrona przed
// podwójną akceptacją przy wyścigu), więc żyje w jednym miejscu.

import { randomUUID } from "node:crypto";
import { withTransaction, logClientEvent } from "./db";
import { getProjectTemplate, expandProjectTemplate } from "./projects";
import { isOfferExpired, type Offer } from "./offers";

export type AcceptOfferResult =
  | { ok: true; projectId: string; invoiceId: string }
  | { ok: false; status: number; error: string; expired?: boolean };

/** Sentinel do wymuszenia ROLLBACK-u z wewnątrz `withTransaction`, gdy
 * przegraliśmy wyścig o "claim" oferty — łapane niżej i zamieniane na zwykły
 * `AcceptOfferResult`, nie prawdziwy błąd. */
class OfferAlreadyAcceptedError extends Error {}

/** Tworzy PROJEKT (opcjonalnie z szablonu) i FAKTURĘ-szkic z pozycjami
 * skopiowanymi 1:1 z oferty, atomowo podpina oba do oferty ("claim" przez
 * `WHERE status != 'Zaakceptowana'` — chroni przed podwójnym kliknięciem/
 * dwoma kartami naraz) i loguje zdarzenie na osi klienta.
 *
 * Wszystkie zapisy idą w JEDNEJ transakcji SQL (`withTransaction`) — albo
 * przejdzie komplet (projekt + kamienie/zadania + faktura + pozycje +
 * oznaczenie oferty), albo nic (automatyczny ROLLBACK, także gdy przegramy
 * "claim" oferty — wtedy nie trzeba już ręcznie kasować osieroconego
 * projektu/faktury, cofa je sama transakcja). Bez tego awaria/wyścig w
 * środku zostawiały osierocone rekordy w bazie. */
export async function acceptOffer(
  offer: Offer,
  items: { nazwa: string; ilosc: number; jednostka: string; cena: number }[],
  opts: {
    template?: string;
    /** Admin może świadomie zaakceptować przeterminowaną ofertę po
     * potwierdzeniu (body.confirmExpired) — publiczna ścieżka klienta nigdy
     * tego nie ustawia, żeby nie dało się "ożywić" starej oferty linkiem. */
    allowExpired?: boolean;
    /** Ustawione = klient podpisał się sam przez /oferta/[token]. Puste =
     * zaakceptowano ręcznie w panelu. */
    acceptedByName?: string | null;
    acceptedIp?: string | null;
    acceptedUserAgent?: string | null;
  }
): Promise<AcceptOfferResult> {
  if (offer.status === "Zaakceptowana") {
    return { ok: false, status: 400, error: "Oferta jest już zaakceptowana." };
  }
  if (isOfferExpired(offer) && !opts.allowExpired) {
    return { ok: false, status: 409, error: "Oferta jest przeterminowana (minęła data ważności).", expired: true };
  }
  if (items.length === 0) {
    return { ok: false, status: 400, error: "Oferta bez pozycji — dodaj co najmniej jedną pozycję." };
  }

  const templateId = opts.template?.trim() ? opts.template : undefined;
  const template = templateId ? getProjectTemplate(templateId) : undefined;
  const tytulProjektu = offer.tytul || offer.klient_nazwa || "Projekt z oferty";
  const leadId = offer.lead_id;
  const clientId = offer.client_id;

  try {
    return await withTransaction(async (sql) => {
      const projectId = randomUUID();
      if (template) {
        const exp = expandProjectTemplate(template);
        await sql`
          INSERT INTO projects (id, tytul, opis, status, priorytet, start, termin, lead_id, client_id)
          VALUES (${projectId}, ${tytulProjektu.slice(0, 300)}, ${exp.opis}, 'Pomysł', 'Normalny', ${exp.start}, ${exp.termin}, ${leadId}, ${clientId});
        `;
        let mPos = 0;
        for (const m of exp.milestones) {
          const milestoneId = randomUUID();
          await sql`
            INSERT INTO project_milestones (id, project_id, nazwa, termin, position)
            VALUES (${milestoneId}, ${projectId}, ${m.nazwa.slice(0, 200)}, ${m.termin}, ${mPos});
          `;
          let tPos = 0;
          for (const taskText of m.tasks) {
            await sql`
              INSERT INTO project_tasks (id, project_id, text, position, milestone_id)
              VALUES (${randomUUID()}, ${projectId}, ${taskText.slice(0, 1000)}, ${tPos}, ${milestoneId});
            `;
            tPos += 1;
          }
          mPos += 1;
        }
      } else {
        await sql`
          INSERT INTO projects (id, tytul, status, priorytet, lead_id, client_id)
          VALUES (${projectId}, ${tytulProjektu.slice(0, 300)}, 'Pomysł', 'Normalny', ${leadId}, ${clientId});
        `;
      }

      const invoiceId = randomUUID();
      await sql`
        INSERT INTO invoices (
          id, lead_id, project_id, client_id, klient_nazwa, klient_nip, klient_adres,
          klient_ulica, klient_kod, klient_miasto, klient_kraj
        )
        VALUES (
          ${invoiceId}, ${leadId}, ${projectId}, ${clientId}, ${offer.klient_nazwa}, ${offer.klient_nip}, ${offer.klient_adres},
          ${offer.klient_ulica ?? ""}, ${offer.klient_kod ?? ""}, ${offer.klient_miasto ?? ""}, ${offer.klient_kraj ?? ""}
        );
      `;
      let pos = 0;
      for (const it of items) {
        await sql`
          INSERT INTO invoice_items (id, invoice_id, nazwa, ilosc, jednostka, cena_netto, vat_stawka, position)
          VALUES (${randomUUID()}, ${invoiceId}, ${it.nazwa}, ${it.ilosc}, ${it.jednostka}, ${it.cena}, '23', ${pos});
        `;
        pos += 1;
      }

      const claimed = await sql`
        UPDATE offers SET
          status = 'Zaakceptowana',
          project_id = ${projectId},
          invoice_id = ${invoiceId},
          accepted_at = now(),
          accepted_by_name = ${opts.acceptedByName ?? null},
          accepted_ip = ${opts.acceptedIp ?? null},
          accepted_user_agent = ${opts.acceptedUserAgent ?? null},
          updated_at = now()
        WHERE id = ${offer.id} AND status != 'Zaakceptowana'
        RETURNING id;
      `;
      if (claimed.length === 0) {
        // Przegraliśmy wyścig — ktoś inny zaakceptował tę ofertę w
        // międzyczasie. Rzuć, żeby ROLLBACK cofnął projekt/fakturę powyżej.
        throw new OfferAlreadyAcceptedError();
      }

      // Lead „domknął się sukcesem" — oferta zamieniła się w projekt+fakturę.
      // Bez tego lead wisiałby dalej jako otwarty na tablicy kanban i w liście
      // „wymaga działania" na pulpicie, mimo że jest już płacącym klientem.
      // Nie nadpisujemy leada już oznaczonego jako odrzucony/zamknięty (mało
      // prawdopodobne, ale gdyby ktoś ręcznie zamknął leada przed akceptacją).
      if (leadId) {
        await sql`
          UPDATE leads SET status = 'Zamknięte - sukces', updated_at = now()
          WHERE id = ${leadId} AND status NOT IN ('Zamknięte - sukces', 'Odrzucone / brak zainteresowania');
        `;
      }

      await logClientEvent(sql, clientId, "offer_accepted", `Zaakceptowano ofertę „${tytulProjektu}” — utworzono projekt i fakturę`, null, offer.id);

      return { ok: true, projectId, invoiceId };
    });
  } catch (err) {
    if (err instanceof OfferAlreadyAcceptedError) {
      return { ok: false, status: 409, error: "Oferta została już zaakceptowana (w innej karcie/kliknięciu)." };
    }
    throw err;
  }
}
