import type { Metadata } from "next";
import { isAuthed } from "@/lib/auth";
import { LoginForm } from "../../../leads/LoginForm";
import { InvoicePrint } from "./InvoicePrint";

export const metadata: Metadata = {
  title: "Faktura — wydruk",
  robots: { index: false, follow: false },
};

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authed = await isAuthed();
  if (!authed) {
    return (
      <div className="mx-auto max-w-md p-8">
        <LoginForm />
      </div>
    );
  }
  return <InvoicePrint id={id} />;
}
