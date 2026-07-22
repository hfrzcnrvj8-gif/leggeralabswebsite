import type { Metadata } from "next";
import { isAuthed } from "@/lib/auth";
import type { Locale } from "@/i18n/config";
import { AppShell } from "../AppShell";
import { LoginForm } from "./LoginForm";
import { LeadsDashboard } from "./LeadsDashboard";

export const metadata: Metadata = {
  title: "Rejestr leadów — Leggera Labs",
  robots: { index: false, follow: false },
};

export default async function AdminLeadsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const authed = await isAuthed();

  return (
    <AppShell lang={lang as Locale} authed={authed}>
      {authed ? <LeadsDashboard lang={lang as Locale} /> : <LoginForm />}
    </AppShell>
  );
}
