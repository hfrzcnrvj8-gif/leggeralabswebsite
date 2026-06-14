# poltechnickx

Ultra-premium, minimalist marketing site for **poltechnickx** — an AI automation agency that deploys private, local LLMs and process automation for SMEs.

## Stack

- **Next.js 16** (App Router, React 19, Turbopack) — `npm audit` reports 0 vulnerabilities.
- **Tailwind CSS** — design tokens + glassmorphism / liquid-glass utilities in `app/globals.css`.
- **Framer Motion** — staggered reveals, parallax orbs, 3D-tilt Mac windows.
- **next-themes** — native dark mode with a seamless light toggle (`class` strategy).
- **i18n** — Polish (default), English, German via `[lang]` routing, `proxy.ts` locale detection, and JSON dictionaries.
- **Contact form** — client-validated form posting to a `/api/contact` route handler (Resend-ready).

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000  → redirects to /pl, /en or /de
npm run build    # production build (prerenders all locales)
```

## Structure

```
app/
  [lang]/
    layout.tsx        # <html lang>, font, ThemeProvider, metadata
    page.tsx          # landing page (composes sections)
    privacy/page.tsx  # GDPR / RODO / DSGVO policy (localized)
  globals.css         # theme variables + liquid-glass + glass utilities
components/           # Header, Hero, ProblemVision, Services, Showcase,
                      # MacWindow, CTA, Footer, ThemeToggle, LanguageSwitcher
i18n/
  config.ts           # locales + default
  get-dictionary.ts   # server-only dictionary loader
  types.ts            # Dictionary type (derived from en.json)
  dictionaries/       # pl.json · en.json · de.json
  api/contact/route.ts  # contact form submission handler
  icon.svg              # favicon / app icon (brand mark)
  robots.ts             # robots.txt
  sitemap.ts            # sitemap.xml (all locales, with hreflang alternates)
  [lang]/opengraph-image.tsx  # per-locale OG/social share image (next/og)
  [lang]/impressum/     # legal notice (DE Impressum) — fill in COMPANY block
  [lang]/not-found.tsx  # branded trilingual 404
lib/site.ts           # canonical site URL + OG locale map
proxy.ts              # locale detection + redirect (Next 16 proxy convention)
```

## SEO & metadata

- Per-locale `<title>`/`description`, canonical URLs and **hreflang** alternates
  (pl/en/de + `x-default`) are generated in `app/[lang]/layout.tsx`.
- **Open Graph / Twitter** tags plus a dynamic 1200×630 share image rendered
  per language via `next/og` (`app/[lang]/opengraph-image.tsx`).
- `sitemap.xml` and `robots.txt` are generated automatically.
- Set `NEXT_PUBLIC_SITE_URL` on the host so all absolute URLs (canonical, OG
  image, sitemap) point at your real domain.

## Legal: Impressum

`app/[lang]/impressum/page.tsx` is a skeleton legal-notice page (German
*Impressum* per § 5 DDG, also linked in PL/EN). Edit the single `COMPANY`
constant at the top of the file with your real details; delete the `register` /
`vat` lines if they don't apply. Have it (and the privacy pages) reviewed by
legal counsel before publishing.

## Contact form

The form in the contact section is client-validated (name, email, message —
company optional) and posts JSON to `app/api/contact/route.ts`, which
re-validates server-side and includes a hidden honeypot field for spam.

- **Out of the box:** with no env vars set, valid submissions are logged to the
  server console and return success — so the form is fully functional in dev.
- **To deliver real email:** copy `.env.example` to `.env.local` and set
  `RESEND_API_KEY` (plus optional `CONTACT_TO_EMAIL` / `CONTACT_FROM_EMAIL`).
  The handler then sends via the Resend API — no extra dependency required.

## Content & customization

- All copy lives in `i18n/dictionaries/*.json` — edit text per locale there.
- Brand colors and the liquid-glass gradient are defined in `tailwind.config.ts` and `app/globals.css`.
- **Showcase windows** in `components/Showcase.tsx` are placeholders. Drop a
  `<video>` or `<img>` as a child of `<MacWindow>` to replace the placeholder UI:

  ```tsx
  <MacWindow title="automation-demo.mp4">
    <video autoPlay muted loop playsInline className="h-full w-full object-cover">
      <source src="/demo.mp4" type="video/mp4" />
    </video>
  </MacWindow>
  ```

## Notes

- The privacy pages are GDPR/RODO/DSGVO **placeholder templates** — have them reviewed by legal counsel before publishing.
- A `postcss` override (`>=8.5.10`) is pinned in `package.json` to keep `npm audit` clean across transitive deps.
