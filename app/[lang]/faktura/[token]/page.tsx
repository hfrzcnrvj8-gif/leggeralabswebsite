import type { Metadata } from "next";
import { InvoicePrint } from "../../admin/invoices/[id]/print/InvoicePrint";

export const metadata: Metadata = {
  title: "Faktura",
  robots: { index: false, follow: false },
};

/** Publiczny (bez logowania) podgląd faktury dla klienta — link wysyłany
 * mailem (patrz app/api/invoices/[id]/send, /remind). Token pełni rolę
 * hasła-w-linku; brak isAuthed() jest tu celowy. */
export default async function PublicInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <InvoicePrint token={token} />;
}
