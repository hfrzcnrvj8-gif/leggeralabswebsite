import Link from "next/link";
import { Logo } from "./Logo";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";

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

      <div
        className="mx-auto mt-12 max-w-6xl border-t pt-6 text-xs"
        style={{ color: "var(--fg-invert-muted)", borderColor: "var(--hairline-invert)" }}
      >
        © {year} Leggera Labs. {dict.rights}
      </div>
    </footer>
  );
}
