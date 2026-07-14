"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { OfferEditor } from "../OfferEditor";

/** Cienki wrapper na OfferEditor dla samodzielnej podstrony /admin/offers/[id]
 * — wzorem InvoiceDetail.tsx. Karta `card-paper` odtwarza dokładnie to, co w
 * OffersDashboard.tsx robi wrapper modala. */
export function OfferDetail({ id, lang }: { id: string; lang: Locale }) {
  const router = useRouter();
  const backToList = () => router.push(`/${lang}/admin/offers`);
  return (
    <div className="w-full">
      <Link href={`/${lang}/admin/offers`} className="mb-3 inline-block text-sm text-muted hover:text-[var(--fg)]">
        ← Wróć do listy
      </Link>
      <div className="card-paper w-full max-w-3xl rounded-2xl border hairline p-5 sm:p-6">
        <OfferEditor id={id} lang={lang} onClose={backToList} onDeleted={backToList} />
      </div>
    </div>
  );
}
