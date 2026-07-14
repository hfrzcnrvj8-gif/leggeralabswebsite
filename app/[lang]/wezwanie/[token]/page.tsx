import type { Metadata } from "next";
import { DunningPrint } from "../../admin/invoices/[id]/wezwanie/print/DunningPrint";

export const metadata: Metadata = {
  title: "Wezwanie do zapłaty",
  robots: { index: false, follow: false },
};

/** Publiczny (bez logowania) podgląd formalnego wezwania do zapłaty —
 * link wysyłany mailem (patrz sendOverdueInvoiceReminders w
 * app/api/leads/notify/route.ts i app/api/invoices/[id]/remind). Token
 * pełni rolę hasła-w-linku, osobny od share_token samej faktury; brak
 * isAuthed() jest tu celowy — wzorem app/[lang]/umowa/[token]. */
export default async function PublicDunningPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <DunningPrint token={token} />;
}
