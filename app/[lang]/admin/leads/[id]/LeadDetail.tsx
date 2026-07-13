"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { LeadDetailPanel } from "../LeadDetailPanel";

/** Cienki wrapper na LeadDetailPanel dla samodzielnej podstrony
 * /admin/leads/[id] — używany dla bezpośrednich linków/zakładek/nowych kart.
 * Główny przepływ w panelu (tablica/tabela) otwiera ten sam komponent jako
 * wysuwany "peek" panel bez przeładowania strony — patrz LeadsDashboard.tsx. */
export function LeadDetail({ id, lang }: { id: string; lang: Locale }) {
  const router = useRouter();
  return (
    <div className="w-full">
      <Link href={`/${lang}/admin/leads`} className="mb-3 inline-block text-sm text-muted hover:text-[var(--fg)]">
        ← Wróć do tablicy
      </Link>
      <LeadDetailPanel id={id} lang={lang} onDeleted={() => router.push(`/${lang}/admin/leads`)} />
    </div>
  );
}
