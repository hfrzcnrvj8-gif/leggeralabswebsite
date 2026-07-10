import type { Locale } from "@/i18n/config";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

/** Shared header/background chrome for every /admin/leads page. */
export function AdminChrome({
  lang,
  children,
}: {
  lang: Locale;
  children: React.ReactNode;
}) {
  return (
    <main className="relative min-h-screen">
      <div
        className="orb pointer-events-none fixed -top-40 left-1/2 -z-10 h-[40vw] w-[40vw] max-h-[500px] max-w-[500px] -translate-x-1/2 rounded-full opacity-20"
        aria-hidden
      />
      <header className="mx-auto flex max-w-[1800px] items-center justify-between px-4 pt-6 sm:px-6">
        <Logo lang={lang} />
        <ThemeToggle />
      </header>
      <div className="mx-auto max-w-[1800px] px-4 py-8 sm:px-6">{children}</div>
    </main>
  );
}
