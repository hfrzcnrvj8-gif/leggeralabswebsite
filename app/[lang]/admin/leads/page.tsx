import type { Metadata } from "next";
import { isAuthed } from "@/lib/auth";
import type { Locale } from "@/i18n/config";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
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
    <main className="relative min-h-screen">
      <div
        className="orb pointer-events-none fixed -top-40 left-1/2 -z-10 h-[40vw] w-[40vw] max-h-[500px] max-w-[500px] -translate-x-1/2 rounded-full opacity-20"
        aria-hidden
      />
      <header className="mx-auto flex max-w-[1800px] items-center justify-between px-4 pt-6 sm:px-6">
        <Logo lang={lang as Locale} />
        <ThemeToggle />
      </header>
      <div className="mx-auto max-w-[1800px] px-4 py-8 sm:px-6">
        {authed ? <LeadsDashboard /> : <LoginForm />}
      </div>
    </main>
  );
}
