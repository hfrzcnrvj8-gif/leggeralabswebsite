import type { Metadata } from "next";
import { isAuthed } from "@/lib/auth";
import type { Locale } from "@/i18n/config";
import { AppShell } from "../AppShell";
import { LoginForm } from "../leads/LoginForm";
import { KalkulatorDashboard } from "./KalkulatorDashboard";

export const metadata: Metadata = {
  title: "Kalkulator doboru — Leggera Labs",
  robots: { index: false, follow: false },
};

export default async function AdminKalkulatorPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const authed = await isAuthed();

  return (
    <AppShell lang={lang as Locale} authed={authed}>
      {authed ? <KalkulatorDashboard /> : <LoginForm />}
    </AppShell>
  );
}
