import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";
import { siteUrl } from "@/lib/site";

// Emits JSON-LD for richer search results (Organization + WebSite).
export function StructuredData({
  lang,
  dict,
}: {
  lang: Locale;
  dict: Dictionary;
}) {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "poltechnickx",
        url: siteUrl,
        description: dict.meta.description,
        logo: `${siteUrl}/icon.svg`,
        // Add your real profiles here once live:
        sameAs: [],
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: `${siteUrl}/${lang}`,
        name: "poltechnickx",
        description: dict.meta.description,
        inLanguage: lang,
        publisher: { "@id": `${siteUrl}/#organization` },
      },
      {
        "@type": "ProfessionalService",
        name: "poltechnickx",
        description: dict.meta.description,
        url: `${siteUrl}/${lang}`,
        areaServed: "EU",
        serviceType: [
          "Local LLM deployment",
          "Private AI",
          "Process automation",
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
