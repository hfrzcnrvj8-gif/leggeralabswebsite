"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { ContractEditor } from "../ContractEditor";

/** Cienki wrapper na ContractEditor dla samodzielnej podstrony
 * /admin/contracts/[id] — używany dla bezpośrednich linków/zakładek/nowych
 * kart. Wzorem app/[lang]/admin/leads/[id]/LeadDetail.tsx. */
export function ContractDetail({ id, lang }: { id: string; lang: Locale }) {
  const router = useRouter();
  return (
    <div className="w-full">
      <Link href={`/${lang}/admin/contracts`} className="mb-3 inline-block text-sm text-muted hover:text-[var(--fg)]">
        ← Wróć do listy
      </Link>
      <ContractEditor id={id} lang={lang} onDeleted={() => router.push(`/${lang}/admin/contracts`)} />
    </div>
  );
}
