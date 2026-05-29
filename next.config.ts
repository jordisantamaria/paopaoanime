import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Cloudflare R2 (anime covers/banners). Wildcard covers any bucket subdomain.
      { protocol: "https", hostname: "*.r2.dev" },
      // Google account avatars (auth).
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      // YouTube trailer thumbnail fallback.
      { protocol: "https", hostname: "img.youtube.com" },
    ],
  },
};

export default withNextIntl(nextConfig);
