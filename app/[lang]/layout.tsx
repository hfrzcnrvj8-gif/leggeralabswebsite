import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import "../globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { i18n, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

export async function generateStaticParams() {
  return i18n.locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: { lang: Locale };
}): Promise<Metadata> {
  const dict = await getDictionary(params.lang);
  return {
    title: dict.meta.title,
    description: dict.meta.description,
    icons: {
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>◇</text></svg>",
    },
  };
}

export default function LangLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { lang: Locale };
}) {
  return (
    <html lang={params.lang} suppressHydrationWarning className={inter.variable}>
      <body className="font-sans antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
