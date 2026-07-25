import type { Metadata } from "next";
import { isAuthed } from "@/lib/auth";
import type { Locale } from "@/i18n/config";
import { AppShell } from "../AppShell";
import { LoginForm } from "../leads/LoginForm";
import { InstrukcjeView } from "./InstrukcjeView";

export const metadata: Metadata = {
  title: "Instrukcje — Leggera Labs",
  robots: { index: false, follow: false },
};

/** Podręcznik obsługi panelu (Moduł 53). Treść w `lib/instrukcje.ts` — ten
 * sam tekst pobiera apka przez `GET /api/instrukcje`. */
export default async function AdminInstrukcjePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const authed = await isAuthed();

  return (
    <AppShell lang={lang as Locale} authed={authed}>
      {authed ? <InstrukcjeView /> : <LoginForm />}
    </AppShell>
  );
}
