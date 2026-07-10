import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // `sharp` is a native binary used by the R2 ingest; keep it out of the bundle.
  serverExternalPackages: ["sharp"],
  images: {
    // Covers and banners are resized to WebP at ingest time and served straight
    // from R2, so nothing reaches Vercel's optimizer and no transformations are
    // billed against the team's shared quota. See `src/lib/image-loader.ts`.
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    // Mirror the widths generated in `src/lib/image-variants.ts`, so the srcset
    // Next.js builds maps onto real objects instead of collapsing duplicates.
    imageSizes: [200, 400],
    deviceSizes: [640, 1280, 1920],
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
