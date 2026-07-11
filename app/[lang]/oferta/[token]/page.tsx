import type { Metadata } from "next";
import { OfferPrint } from "../../admin/offers/[id]/print/OfferPrint";

export const metadata: Metadata = {
  title: "Oferta",
  robots: { index: false, follow: false },
};

/** Publiczny (bez logowania) podgląd oferty dla klienta — link wysyłany
 * mailem (patrz app/api/offers/[id]/send). Token pełni rolę hasła-w-linku;
 * brak isAuthed() jest tu celowy. Wzorem app/[lang]/faktura/[token]. */
export default async function PublicOfferPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <OfferPrint token={token} />;
}
