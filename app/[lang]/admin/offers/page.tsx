import type { Metadata } from "next";
import { isAuthed } from "@/lib/auth";
import type { Locale } from "@/i18n/config";
import { AppShell } from "../AppShell";
import { LoginForm } from "../leads/LoginForm";
import { OffersDashboard } from "./OffersDashboard";

export const metadata: Metadata = {
  title: "Oferty — Leggera Labs",
  robots: { index: false, follow: false },
};

export default async function AdminOffersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const authed = await isAuthed();

  return (
    <AppShell lang={lang as Locale} authed={authed}>
      {authed ? <OffersDashboard lang={lang as Locale} /> : <LoginForm />}
    </AppShell>
  );
}
