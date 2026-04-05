import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import "./globals.css";
import { Header } from "@/components/header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://paopaoanime.com"),
  title: "PaoPaoAnime - 今期アニメの配信スケジュール",
  description:
    "今期のアニメがどのプラットフォームで何曜日の何時に配信されるかをまとめて確認。DMM TV・U-NEXT・dアニメストア・ABEMAなど複数サービスを網羅。",
  icons: {
    icon: "/logo.png",
  },
  openGraph: {
    title: "PaoPaoAnime - 今期アニメの配信スケジュール",
    description: "今期アニメ、いつ・どこで配信？パオパオでかんたん確認。DMM TV・U-NEXT・dアニメストア・ABEMA・Netflix・Disney+を網羅。",
    siteName: "PaoPaoAnime",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PaoPaoAnime - 今期アニメの配信スケジュール",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PaoPaoAnime - 今期アニメの配信スケジュール",
    description: "今期アニメ、いつ・どこで配信？パオパオでかんたん確認。",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-bg-primary text-text-primary`}
      >
        <SessionProvider>
        <div className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-6 w-full flex-1">{children}</main>
        <footer className="border-t border-border py-6">
          <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-text-muted">
            <span>© 2026 PaoPaoAnime</span>
            <div className="flex gap-4">
              <a href="/terms" className="hover:text-accent">利用規約</a>
              <a href="/privacy" className="hover:text-accent">プライバシーポリシー</a>
              <a href="/about" className="hover:text-accent">PaoPaoAnimeについて</a>
            </div>
          </div>
        </footer>
        </div>
        </SessionProvider>
      </body>
    </html>
  );
}
