import type { Metadata } from "next";
import { isAuthed } from "@/lib/auth";
import type { Locale } from "@/i18n/config";
import { AppShell } from "../../AppShell";
import { LoginForm } from "../../leads/LoginForm";
import { ContractDetail } from "./ContractDetail";

export const metadata: Metadata = {
  title: "Umowa — Leggera Labs",
  robots: { index: false, follow: false },
};

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  const authed = await isAuthed();

  return (
    <AppShell lang={lang as Locale}>
      {authed ? <ContractDetail id={id} lang={lang as Locale} /> : <LoginForm />}
    </AppShell>
  );
}
