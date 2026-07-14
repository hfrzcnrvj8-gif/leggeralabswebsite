"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { InvoiceEditor } from "../InvoiceEditor";

/** Cienki wrapper na InvoiceEditor dla samodzielnej podstrony
 * /admin/invoices/[id] — używany dla bezpośrednich linków/zakładek/nowych
 * kart (oś czasu klienta, Pulpit). Główny przepływ w panelu (tabela faktur)
 * otwiera ten sam edytor jako modal — patrz InvoicesDashboard.tsx. Karta
 * `card-paper` tutaj odtwarza dokładnie to, co tam robi wrapper modala,
 * bo InvoiceEditor sam w sobie nie ma żadnego zewnętrznego tła/obramowania. */
export function InvoiceDetail({ id, lang }: { id: string; lang: Locale }) {
  const router = useRouter();
  const backToList = () => router.push(`/${lang}/admin/invoices`);
  return (
    <div className="w-full">
      <Link href={`/${lang}/admin/invoices`} className="mb-3 inline-block text-sm text-muted hover:text-[var(--fg)]">
        ← Wróć do listy
      </Link>
      <div className="card-paper w-full max-w-7xl rounded-2xl border hairline p-5 sm:p-6">
        <InvoiceEditor
          id={id}
          lang={lang}
          onClose={backToList}
          onDeleted={backToList}
          onOpenInvoice={(rid) => router.push(`/${lang}/admin/invoices/${rid}`)}
        />
      </div>
    </div>
  );
}
