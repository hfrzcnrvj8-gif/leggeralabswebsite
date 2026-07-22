import type { Metadata } from "next";
import { isAuthed } from "@/lib/auth";
import type { Locale } from "@/i18n/config";
import { AppShell } from "../AppShell";
import { LoginForm } from "../leads/LoginForm";
import { ClientsDashboard } from "./ClientsDashboard";

export const metadata: Metadata = {
  title: "Klienci — Leggera Labs",
  robots: { index: false, follow: false },
};

export default async function AdminClientsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const authed = await isAuthed();

  return (
    <AppShell lang={lang as Locale} authed={authed}>
      {authed ? <ClientsDashboard lang={lang as Locale} /> : <LoginForm />}
    </AppShell>
  );
}
