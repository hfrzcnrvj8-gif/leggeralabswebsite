import Link from "next/link";
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
    <footer className="relative border-t px-6 py-16 hairline">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 md:flex-row md:items-end md:justify-between">
        <div className="max-w-sm">
          <Link
            href={`/${lang}`}
            className="text-xl font-semibold tracking-tightest"
          >
            poltechnickx<span className="text-liquid">.</span>
          </Link>
          <p className="mt-4 text-sm text-muted">{dict.tagline}</p>
        </div>

        <div className="flex flex-col gap-4 text-sm md:items-end">
          <Link
            href={`/${lang}/privacy`}
            className="text-muted transition-colors hover:text-[var(--fg)]"
          >
            {dict.privacy}
          </Link>
          <p className="text-xs text-muted">{dict.madeIn}</p>
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-6xl border-t pt-6 text-xs text-muted hairline">
        © {year} poltechnickx. {dict.rights}
      </div>
    </footer>
  );
}
