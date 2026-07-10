/**
 * Shared vocabulary for the pre-generated R2 image variants.
 *
 * Variants are built once at ingest time (see `r2.ts`) and served straight from
 * R2 by the custom Next.js image loader (see `image-loader.ts`), so images never
 * hit Vercel's `/_next/image` optimizer.
 *
 * This module must stay free of server-only imports: the loader bundles it into
 * the client.
 */

/**
 * Widths generated per image kind, ascending.
 *
 * Bounded by what AniList actually serves — covers arrive at ~500px wide and
 * banners at ~1900px, and upscaling past the source only inflates bytes.
 */
export const VARIANT_WIDTHS = {
  cover: [200, 400],
  banner: [640, 1280, 1920],
} as const;

export type ImageKind = keyof typeof VARIANT_WIDTHS;

const R2_IMAGE_PATTERN =
  /^(https:\/\/[^/]+\.r2\.dev)\/(cover|banner)\/([^/]+?)\.(?:jpe?g|png|webp)$/;

export type ParsedR2Image = {
  origin: string;
  kind: ImageKind;
  id: string;
};

/** Returns null for anything that isn't an original R2 cover/banner URL. */
export function parseR2ImageUrl(src: string): ParsedR2Image | null {
  const match = R2_IMAGE_PATTERN.exec(src);
  if (!match) return null;

  const [, origin, kind, id] = match;
  return { origin, kind: kind as ImageKind, id };
}

export function originalKey(kind: ImageKind, id: string): string {
  return `${kind}/${id}.jpg`;
}

export function variantKey(kind: ImageKind, id: string, width: number): string {
  return `${kind}/${id}-${width}.webp`;
}

/** Smallest generated width that still covers `requestedWidth`. */
export function pickVariantWidth(kind: ImageKind, requestedWidth: number): number {
  const widths = VARIANT_WIDTHS[kind];
  return widths.find((width) => width >= requestedWidth) ?? widths[widths.length - 1];
}
