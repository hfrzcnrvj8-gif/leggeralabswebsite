import type { Metadata } from "next";
import { isAuthed } from "@/lib/auth";
import type { Locale } from "@/i18n/config";
import { AppShell } from "../AppShell";
import { LoginForm } from "../leads/LoginForm";
import { QuickLogView } from "./QuickLogView";

export const metadata: Metadata = {
  title: "Szybka notatka — Leggera Labs",
  robots: { index: false, follow: false },
};

/** /admin/quick-log — Opcja A z docs/plany-modulow/03-kanaly-kontaktu.md:
 * lekka, mobilna strona do zalogowania kontaktu (głównie połączenia) zaraz
 * po zakończeniu rozmowy, bez przewijania do konkretnego leada/klienta.
 * Pomyślana pod dodanie do ekranu początkowego iPhone'a (Safari → Udostępnij
 * → Dodaj do ekranu początkowego) — wtedy otwiera się jak osobna apka,
 * korzystając z tej samej sesji logowania co reszta panelu. */
export default async function QuickLogPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const authed = await isAuthed();

  return (
    <AppShell lang={lang as Locale} authed={authed}>
      {authed ? <QuickLogView lang={lang as Locale} /> : <LoginForm />}
    </AppShell>
  );
}
