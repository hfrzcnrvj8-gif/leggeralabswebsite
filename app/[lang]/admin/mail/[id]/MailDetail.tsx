"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { MailDetailPanel } from "../MailDetailPanel";

/** Podstrona wiadomości — dla bezpośrednich linków (z osi kontaktu klienta,
 * z Pulpitu, z zakładek przeglądarki). Renderuje ten sam MailDetailPanel co
 * kolumna podglądu w zakładce Poczta, tylko w normalnym przepływie strony —
 * wzorzec z CLAUDE.md: profil rekordu ma i modal/kolumnę, i własny URL.
 *
 * Bez `max-w` (04d pkt 4) — pełna szerokość ekranu, margines tylko z
 * paddingu; czytelność akapitu pilnuje `max-w-[70ch]` w samym
 * MailDetailPanel.
 *
 * `configured` przekazujemy jako true: ta podstrona nie odpytuje o stan
 * skrzynki, a jedyny skutek to aktywny przycisk "Odpisz" — gdy skrzynki nie
 * ma, API i tak odmówi z czytelnym komunikatem, zamiast po cichu udawać. */
export function MailDetail({ id, lang }: { id: string; lang: Locale }) {
  const router = useRouter();

  return (
    <div className="w-full p-4 sm:p-6">
      <Link href={`/${lang}/admin/mail`} className="mb-3 inline-block text-[13px] text-muted hover:text-[var(--fg)]">
        ← Poczta
      </Link>
      <MailDetailPanel
        lang={lang}
        mailId={id}
        configured
        onClose={() => router.push(`/${lang}/admin/mail`)}
        onChanged={() => router.refresh()}
        // Pasek wątku (Moduł 4, Etap 3) — na samodzielnej podstronie "swap"
        // to prawdziwa nawigacja (inny URL), w odróżnieniu od setOpenId()
        // w MailDashboard.tsx, gdzie to tylko zmiana stanu w tej samej
        // kolumnie podglądu.
        onOpenThreadMessage={(siblingId) => router.push(`/${lang}/admin/mail/${siblingId}`)}
      />
    </div>
  );
}
