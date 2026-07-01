import { ImageResponse } from "next/og";
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
          fontFamily: "sans-serif",
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

        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", fontSize: 40 }}>
          <div style={{ position: "relative", display: "flex", width: 46, height: 46, marginRight: 18 }}>
            <span
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                display: "flex",
                fontWeight: 800,
                fontSize: 46,
                opacity: 0.35,
                backgroundImage: "linear-gradient(100deg, #7C3AED 0%, #E0A93B 100%)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              L
            </span>
            <span
              style={{
                position: "absolute",
                top: 7,
                left: 7,
                display: "flex",
                fontWeight: 800,
                fontSize: 46,
                backgroundImage: "linear-gradient(100deg, #7C3AED 0%, #E0A93B 100%)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              L
            </span>
          </div>
          <span
            style={{
              fontWeight: 700,
              letterSpacing: "-0.03em",
              backgroundImage: "linear-gradient(100deg, #7C3AED 0%, #E0A93B 100%)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Leggera Labs
          </span>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 84,
              fontWeight: 600,
              lineHeight: 1.0,
              letterSpacing: "-0.04em",
            }}
          >
            {line1}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 84,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-0.04em",
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
    { ...size }
  );
}
