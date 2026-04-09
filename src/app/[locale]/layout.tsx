import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import "../globals.css";
import { Header } from "@/components/header";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const isPreview = process.env.VERCEL_ENV === "preview";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  return {
    metadataBase: new URL("https://paopaoanime.com"),
    title: t("title"),
    description: t("description"),
    icons: { icon: "/logo.png" },
    ...(isPreview && { robots: { index: false, follow: false } }),
    alternates: {
      languages: { ja: "/", en: "/en" },
    },
    openGraph: {
      title: t("title"),
      description: t("ogDescription"),
      siteName: "PaoPaoAnime",
      type: "website",
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: t("title"),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("twitterDescription"),
      images: ["/og-image.png"],
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "ja" | "en")) {
    notFound();
  }

  setRequestLocale(locale);

  const [messages, t] = await Promise.all([
    getMessages(),
    getTranslations("footer"),
  ]);

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-bg-primary text-text-primary`}
      >
        <SessionProvider>
          <NextIntlClientProvider messages={messages}>
            <div className="flex min-h-screen flex-col">
              <Header />
              <main className="mx-auto max-w-6xl px-4 py-6 w-full flex-1">{children}</main>
              <footer className="border-t border-border py-6">
                <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-text-muted">
                  <div className="flex items-center gap-3">
                    <span>© 2026 PaoPaoAnime</span>
                    <LocaleSwitcher />
                  </div>
                  <div className="flex gap-4">
                    <Link href="/terms" className="hover:text-accent">{t("terms")}</Link>
                    <Link href="/privacy" className="hover:text-accent">{t("privacy")}</Link>
                    <Link href="/about" className="hover:text-accent">{t("about")}</Link>
                  </div>
                </div>
              </footer>
            </div>
          </NextIntlClientProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
