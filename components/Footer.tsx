import Link from "next/link";
import { Logo } from "./Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";
import { linkedinUrl } from "@/lib/site";

export function Footer({
  lang,
  dict,
}: {
  lang: Locale;
  dict: Dictionary["footer"];
}) {
  const year = new Date().getFullYear();
  return (
    <footer
      className="relative border-t px-6 py-16"
      style={{
        background: "var(--bg-invert)",
        color: "var(--fg-invert)",
        borderColor: "var(--hairline-invert)",
      }}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-10 md:flex-row md:items-end md:justify-between">
        <div className="max-w-sm">
          <Logo lang={lang} />
          <p className="mt-4 text-sm" style={{ color: "var(--fg-invert-muted)" }}>
            {dict.tagline}
          </p>
        </div>

        <div className="flex flex-col gap-4 text-sm md:items-end">
          <Link
            href={`/${lang}/privacy`}
            className="transition-opacity hover:opacity-70"
            style={{ color: "var(--fg-invert-muted)" }}
          >
            {dict.privacy}
          </Link>
          <Link
            href={`/${lang}/impressum`}
            className="transition-opacity hover:opacity-70"
            style={{ color: "var(--fg-invert-muted)" }}
          >
            {dict.impressum}
          </Link>
          <p className="text-xs" style={{ color: "var(--fg-invert-muted)" }}>
            {dict.madeIn}
          </p>
        </div>
      </div>

      {linkedinUrl && (
        <div className="mx-auto mt-8 flex max-w-6xl md:justify-end">
          <a
            href={linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full transition-opacity hover:opacity-70"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="url(#linkedin-gradient)" aria-hidden>
              <defs>
                <linearGradient id="linkedin-gradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#A78BFA" />
                  <stop offset="100%" stopColor="#E0A93B" />
                </linearGradient>
              </defs>
              <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.03-1.85-3.03-1.85 0-2.14 1.45-2.14 2.94v5.66H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z" />
            </svg>
          </a>
        </div>
      )}

      <div
        className="mx-auto mt-12 flex max-w-6xl flex-col-reverse items-start gap-4 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between"
        style={{ color: "var(--fg-invert-muted)", borderColor: "var(--hairline-invert)" }}
      >
        <p>© {year} Leggera Labs. {dict.rights}</p>
        <div className="flex items-center gap-2">
          <LanguageSwitcher current={lang} />
          <ThemeToggle />
        </div>
      </div>
    </footer>
  );
}
