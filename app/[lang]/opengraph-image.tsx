import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getDictionary } from "@/i18n/get-dictionary";
import { i18n, type Locale } from "@/i18n/config";

export const alt = "Leggera Labs — Private Local AI & Automation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return i18n.locales.map((lang) => ({ lang }));
}

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale);
  const [line1, line2] = dict.hero.titleLines;

  const fontsDir = join(process.cwd(), "app", "[lang]", "opengraph-fonts");
  const [interBold, frauncesSemiBold] = await Promise.all([
    readFile(join(fontsDir, "Inter-Bold.ttf")),
    readFile(join(fontsDir, "Fraunces-SemiBold.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background: "#0A0A0A",
          color: "#F5F5F7",
          fontFamily: "Inter",
          position: "relative",
        }}
      >
        {/* Liquid-glass orb */}
        <div
          style={{
            position: "absolute",
            top: "180px",
            right: "-120px",
            width: "640px",
            height: "640px",
            borderRadius: "9999px",
            background:
              "radial-gradient(circle at 30% 30%, rgba(124,58,237,0.85), rgba(232,93,158,0.5) 45%, rgba(224,169,59,0.4) 75%, transparent 100%)",
            filter: "blur(40px)",
          }}
        />

        {/* Wordmark — same treatment as the on-site Logo component: ONE
            continuous gradient shared across the whole "L EGGERA L ABS"
            phrase (applied once, on the wrapping element below, not
            per-word — a per-word gradient would restart 0%→100% inside
            each word instead of continuing where the previous one left
            off). "EGGERA" and "ABS" have no color of their own, so they
            inherit the parent's clipped gradient; the two L's override
            it with their own flat color. Trailing "." is cyan. */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            fontFamily: "Inter",
            fontSize: 40,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "6px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: "Inter",
              fontWeight: 700,
              backgroundImage:
                "linear-gradient(100deg, #7C3AED 0%, #E0A93B 65%, #FFF7E8 100%)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            <span style={{ display: "flex", fontFamily: "Inter", fontWeight: 700, color: "#7C3AED" }}>
              L
            </span>
            <span style={{ display: "flex", fontFamily: "Inter", fontWeight: 700 }}>
              EGGERA&nbsp;
            </span>
            <span style={{ display: "flex", fontFamily: "Inter", fontWeight: 700, color: "#E0A93B" }}>
              L
            </span>
            <span style={{ display: "flex", fontFamily: "Inter", fontWeight: 700 }}>
              ABS
            </span>
          </div>
          <span style={{ display: "flex", fontFamily: "Inter", fontWeight: 700, color: "#22D3EE" }}>
            .
          </span>
        </div>

        {/* Headline — same serif (Fraunces) used for the on-site H1 */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontFamily: "Fraunces",
              fontSize: 84,
              fontWeight: 600,
              lineHeight: 1.0,
              letterSpacing: "-0.02em",
            }}
          >
            {line1}
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Fraunces",
              fontSize: 84,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              backgroundImage:
                "linear-gradient(120deg, #a78bfa, #e0a93b 65%, #fff7e8)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {line2}
          </div>
        </div>

        {/* Tagline */}
        <div style={{ display: "flex", fontSize: 30, color: "#9A9AA3" }}>
          {dict.problem.title}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Inter", data: interBold, weight: 700, style: "normal" },
        {
          name: "Fraunces",
          data: frauncesSemiBold,
          weight: 600,
          style: "normal",
        },
      ],
    }
  );
}
