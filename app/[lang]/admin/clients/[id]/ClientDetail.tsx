"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { ClientDetailPanel } from "../ClientDetailPanel";

/** Cienki wrapper na ClientDetailPanel dla samodzielnej podstrony
 * /admin/clients/[id] — wzorem LeadDetail.tsx. */
export function ClientDetail({ id, lang }: { id: string; lang: Locale }) {
  const router = useRouter();
  return (
    <div className="w-full">
      <Link href={`/${lang}/admin/clients`} className="mb-3 inline-block text-sm text-muted hover:text-[var(--fg)]">
        ← Wróć do tablicy
      </Link>
      <ClientDetailPanel id={id} lang={lang} onDeleted={() => router.push(`/${lang}/admin/clients`)} />
    </div>
  );
}
