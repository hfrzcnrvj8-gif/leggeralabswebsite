import type { Metadata } from "next";
import { ContractPrint } from "../../admin/contracts/[id]/print/ContractPrint";

export const metadata: Metadata = {
  title: "NDA",
  robots: { index: false, follow: false },
};

/** Publiczna strona podpisu NDA — sam komponent (ContractPrint) jest
 * typ-świadomy i renderuje odpowiedni zestaw klauzul; osobny segment URL
 * (/nda/ zamiast /umowa/) tylko dla czytelności linku wysyłanego klientowi. */
export default async function PublicNdaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ContractPrint token={token} />;
}
