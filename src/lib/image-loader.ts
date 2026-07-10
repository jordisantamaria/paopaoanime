import { parseR2ImageUrl, pickVariantWidth, variantKey } from "./image-variants";

/**
 * Custom `next/image` loader.
 *
 * Rewrites R2 cover/banner URLs to the pre-generated WebP variant that best fits
 * the requested width. Everything else (local assets, Google avatars, YouTube
 * thumbnails) is passed through untouched.
 *
 * Because the returned URL is absolute, Next.js skips `/_next/image` entirely.
 */
export default function r2ImageLoader({
  src,
  width,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  const parsed = parseR2ImageUrl(src);
  if (!parsed) return src;

  const { origin, kind, id } = parsed;
  return `${origin}/${variantKey(kind, id, pickVariantWidth(kind, width))}`;
}
