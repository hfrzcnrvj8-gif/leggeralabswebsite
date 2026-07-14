import type { Metadata } from "next";
import { ContractPrint } from "../../admin/contracts/[id]/print/ContractPrint";

export const metadata: Metadata = {
  title: "Umowa",
  robots: { index: false, follow: false },
};

/** Publiczny (bez logowania) podgląd i podpis umowy — link wysyłany mailem
 * (patrz app/api/contracts/[id]/send). Token pełni rolę hasła-w-linku;
 * brak isAuthed() jest tu celowy. Wzorem app/[lang]/oferta/[token]. */
export default async function PublicContractPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ContractPrint token={token} />;
}
