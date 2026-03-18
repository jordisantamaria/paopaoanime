import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavLinks } from "@/components/nav-links";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PaoPaoAnime - 今期アニメの配信スケジュール",
  description:
    "今期のアニメがどのプラットフォームで何曜日の何時に配信されるかをまとめて確認。DMM TV・U-NEXT・dアニメストア・ABEMAなど複数サービスを網羅。",
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
        <header className="bg-nav text-white">
          <div className="mx-auto grid max-w-6xl grid-cols-3 items-center px-4 py-3">
            <a href="/" className="text-lg font-bold tracking-tight">
              PaoPaoAnime
            </a>
            <nav className="flex items-center justify-center gap-5">
              <NavLinks />
            </nav>
            <div className="flex justify-end">
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
