# poltechnickx

Ultra-premium, minimalist marketing site for **poltechnickx** — an AI automation agency that deploys private, local LLMs and process automation for SMEs.

## Stack

- **Next.js 14** (App Router, React 18) — kept on the latest patched 14.2.x line for React 18 compatibility.
- **Tailwind CSS** — design tokens + glassmorphism / liquid-glass utilities in `app/globals.css`.
- **Framer Motion** — staggered reveals, parallax orbs, 3D-tilt Mac windows.
- **next-themes** — native dark mode with a seamless light toggle (`class` strategy).
- **i18n** — Polish (default), English, German via `[lang]` routing, middleware locale detection, and JSON dictionaries.

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
middleware.ts         # locale detection + redirect
```

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
- `npm audit` flags advisories that only resolve by upgrading to Next 16 (a major, React-19 breaking change). This project intentionally targets React 18 / Next 14.2.x as specified.
