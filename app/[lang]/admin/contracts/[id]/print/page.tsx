import type { Metadata } from "next";
import { isAuthed } from "@/lib/auth";
import { LoginForm } from "../../../leads/LoginForm";
import { ContractPrint } from "./ContractPrint";

export const metadata: Metadata = {
  title: "Umowa — wydruk",
  robots: { index: false, follow: false },
};

export default async function ContractPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authed = await isAuthed();
  if (!authed) {
    return (
      <div className="mx-auto max-w-md p-8">
        <LoginForm />
      </div>
    );
  }
  return <ContractPrint id={id} />;
}
