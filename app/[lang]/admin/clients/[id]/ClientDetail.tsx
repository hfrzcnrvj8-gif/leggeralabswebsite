"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { ClientDetailPanel } from "../ClientDetailPanel";

/** Cienki wrapper na ClientDetailPanel dla samodzielnej podstrony
 * /admin/clients/[id] — wzorem LeadDetail.tsx. */
export function ClientDetail({ id, lang }: { id: string; lang: Locale }) {
  const router = useRouter();
  // "Wróć do poczty" (04e runda 3, zgłoszone przez właściciela) — klik w tag
  // klienta z Poczty dokleja `?from=mail`; MailDashboard.tsx zapamiętał w
  // localStorage DOKŁADNIE gdzie był (folder/filtry/otwarta wiadomość), więc
  // ten link wraca tam, nie na ogólną listę Poczty.
  const fromMail = useSearchParams().get("from") === "mail";
  return (
    <div className="w-full">
      <Link href={fromMail ? `/${lang}/admin/mail` : `/${lang}/admin/clients`} className="mb-3 inline-block text-sm text-muted hover:text-[var(--fg)]">
        {fromMail ? "← Wróć do poczty" : "← Wróć do tablicy"}
      </Link>
      <ClientDetailPanel id={id} lang={lang} onDeleted={() => router.push(`/${lang}/admin/clients`)} />
    </div>
  );
}
