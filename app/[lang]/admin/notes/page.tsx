import type { Metadata } from "next";
import { isAuthed } from "@/lib/auth";
import type { Locale } from "@/i18n/config";
import { AppShell } from "../AppShell";
import { LoginForm } from "../leads/LoginForm";
import { NotesDashboard } from "./NotesDashboard";

export const metadata: Metadata = {
  title: "Notatnik — Leggera Labs",
  robots: { index: false, follow: false },
};

export default async function AdminNotesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const authed = await isAuthed();

  return (
    <AppShell lang={lang as Locale}>
      {authed ? <NotesDashboard lang={lang as Locale} /> : <LoginForm />}
    </AppShell>
  );
}
