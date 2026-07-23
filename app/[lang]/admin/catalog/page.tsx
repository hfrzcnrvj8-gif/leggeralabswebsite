import type { Metadata } from "next";
import { isAuthed } from "@/lib/auth";
import type { Locale } from "@/i18n/config";
import { AppShell } from "../AppShell";
import { LoginForm } from "../leads/LoginForm";
import { CatalogDashboard } from "./CatalogDashboard";

export const metadata: Metadata = {
  title: "Katalog — Leggera Labs",
  robots: { index: false, follow: false },
};

export default async function AdminCatalogPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const authed = await isAuthed();

  return (
    <AppShell lang={lang as Locale} authed={authed}>
      {authed ? <CatalogDashboard /> : <LoginForm />}
    </AppShell>
  );
}
