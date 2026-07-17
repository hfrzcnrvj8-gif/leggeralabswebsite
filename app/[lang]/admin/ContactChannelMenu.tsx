"use client";

/**
 * Pozycje menu pod prawym przyciskiem na odznace kanału (Moduł 34).
 *
 * Jeden komponent dla Leadów i Klientów, Tablicy i Tabeli — czyli dla czterech
 * miejsc renderujących tę samą odznakę. Bez tego byłyby cztery kopie, które
 * rozjadą się przy pierwszej zmianie (dokładnie to stało się z odznaką kanału
 * przed Modułem 33).
 *
 * Zakres świadomie wąski: akcje kontaktowe, które da się wykonać BEZ wchodzenia
 * w profil — bo po to jest skrót na liście. Te same helpery co
 * `ContactQuickActions` w profilu (`waLink`/`linkedinLink` z `lib/contact.ts`),
 * więc numer/URL są normalizowane tak samo w obu miejscach.
 *
 * Pozycje pojawiają się TYLKO gdy jest czym je wykonać (jest telefon / e-mail /
 * LinkedIn) — puste menu z wyszarzonymi pozycjami byłoby gorsze niż brak menu.
 */

import { IconPhone, IconMail, IconBrandWhatsapp, IconBrandLinkedin } from "@tabler/icons-react";
import { ContextMenuItem, MenuLabel } from "./Menu";
import { waLink, linkedinLink } from "@/lib/contact";

export type ContactLike = {
  telefon?: string | null;
  email?: string | null;
  linkedin_url?: string | null;
};

/** Czy dla tego kontaktu menu ma cokolwiek do pokazania. Wołający używa tego,
 * żeby nie otwierać pustego menu (patrz komentarz w nagłówku). */
export function hasChannelActions(c: ContactLike): boolean {
  return Boolean(c.telefon?.trim() || c.email?.trim() || c.linkedin_url?.trim());
}

export function ContactChannelMenuItems({
  contact,
  close,
}: {
  contact: ContactLike;
  close: () => void;
}) {
  const telefon = contact.telefon?.trim() || "";
  const email = contact.email?.trim() || "";
  const wa = telefon ? waLink(telefon) : null;
  const li = contact.linkedin_url?.trim() ? linkedinLink(contact.linkedin_url) : null;

  const run = (fn: () => void) => {
    close();
    fn();
  };

  return (
    <>
      <MenuLabel>Skontaktuj się</MenuLabel>
      {telefon && (
        <ContextMenuItem
          icon={<IconPhone size={14} />}
          label="Zadzwoń"
          onClick={() => run(() => { window.location.href = `tel:${telefon}`; })}
        />
      )}
      {email && (
        <ContextMenuItem
          icon={<IconMail size={14} />}
          label="Napisz maila"
          onClick={() => run(() => { window.location.href = `mailto:${email}`; })}
        />
      )}
      {wa && (
        <ContextMenuItem
          icon={<IconBrandWhatsapp size={14} />}
          label="WhatsApp"
          onClick={() => run(() => window.open(wa, "_blank", "noopener"))}
        />
      )}
      {li && (
        <ContextMenuItem
          icon={<IconBrandLinkedin size={14} />}
          label="LinkedIn"
          onClick={() => run(() => window.open(li, "_blank", "noopener"))}
        />
      )}
    </>
  );
}
