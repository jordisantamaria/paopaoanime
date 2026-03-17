import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "アニメスケジュール JP - 配信スケジュール",
  description:
    "日本の配信プラットフォームのアニメ週間スケジュール。DMM TV、Netflix、ABEMAなどの配信時間を確認できます。",
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
        <header className="bg-bg-secondary border-b border-border">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <a href="/" className="text-lg font-bold tracking-tight">
              アニメスケジュール<span className="text-accent">.</span>jp
            </a>
            <span className="rounded bg-bg-primary px-2 py-1 text-xs text-text-muted border border-border">
              2026年冬
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
