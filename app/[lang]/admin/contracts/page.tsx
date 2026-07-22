import type { Metadata } from "next";
import { isAuthed } from "@/lib/auth";
import type { Locale } from "@/i18n/config";
import { AppShell } from "../AppShell";
import { LoginForm } from "../leads/LoginForm";
import { ContractsDashboard } from "./ContractsDashboard";

export const metadata: Metadata = {
  title: "Umowy — Leggera Labs",
  robots: { index: false, follow: false },
};

export default async function AdminContractsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const authed = await isAuthed();

  return (
    <AppShell lang={lang as Locale} authed={authed}>
      {authed ? <ContractsDashboard lang={lang as Locale} /> : <LoginForm />}
    </AppShell>
  );
}
