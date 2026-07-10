import type { Metadata } from "next";
import { isAuthed } from "@/lib/auth";
import type { Locale } from "@/i18n/config";
import { AppShell } from "../AppShell";
import { LoginForm } from "../leads/LoginForm";
import { ProjectsDashboard } from "./ProjectsDashboard";

export const metadata: Metadata = {
  title: "Projekty — Leggera Labs",
  robots: { index: false, follow: false },
};

export default async function AdminProjectsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const authed = await isAuthed();

  return (
    <AppShell lang={lang as Locale}>
      {authed ? <ProjectsDashboard lang={lang as Locale} /> : <LoginForm />}
    </AppShell>
  );
}
