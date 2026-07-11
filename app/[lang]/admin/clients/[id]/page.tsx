import type { Metadata } from "next";
import { isAuthed } from "@/lib/auth";
import type { Locale } from "@/i18n/config";
import { AppShell } from "../../AppShell";
import { LoginForm } from "../../leads/LoginForm";
import { ClientDetail } from "./ClientDetail";

export const metadata: Metadata = {
  title: "Klient — Leggera Labs",
  robots: { index: false, follow: false },
};

export default async function ClientDetailPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params;
  const authed = await isAuthed();

  return (
    <AppShell lang={lang as Locale}>
      {authed ? <ClientDetail id={id} lang={lang as Locale} /> : <LoginForm />}
    </AppShell>
  );
}
