import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import {
  VARIANT_WIDTHS,
  originalKey,
  variantKey,
  type ImageKind,
} from "./image-variants";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME!;
const PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL!;

/**
 * Keys are content-addressed by AniList id and never rewritten in place, so the
 * stored objects can be treated as immutable.
 */
const CACHE_CONTROL = "public, max-age=31536000, immutable";

async function existsOnR2(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Every key currently in the bucket, in as few round trips as the page size allows.
 *
 * The sync mirrors ~430 anime and asks about the original plus every variant width
 * of both cover and banner, which is thousands of HEAD requests per run — the bulk
 * of the job's wall clock, and what pushed the 2026-09-13 run past its 30-minute
 * timeout. Pass the result as `existing` to `uploadImageWithVariants` and those
 * become set lookups.
 */
export async function listExistingKeys(): Promise<Set<string>> {
  const keys = new Set<string>();
  let token: string | undefined;
  do {
    const res = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: token }));
    for (const obj of res.Contents ?? []) if (obj.Key) keys.add(obj.Key);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function put(key: string, body: Buffer, contentType: string): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: CACHE_CONTROL,
    })
  );
}

async function fetchImage(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${url} (${res.status})`);

  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    contentType: res.headers.get("content-type") ?? "image/jpeg",
  };
}

export type UploadResult = {
  /** Public URL of the original; what gets stored in the database. */
  url: string;
  /** Objects actually written to R2 this call (original plus variants). */
  uploadedObjects: number;
};

/**
 * Mirrors a source image to R2 and makes sure every width in `VARIANT_WIDTHS`
 * exists alongside it as WebP. The loader derives variant URLs from the returned
 * original URL, so only that one needs persisting.
 *
 * Idempotent per object: the original and each variant are uploaded only when
 * missing, so a re-run backfills variants for images mirrored before this
 * existed without re-downloading anything it already has.
 */
export async function uploadImageWithVariants(
  kind: ImageKind,
  id: string,
  sourceUrl: string,
  existing?: Set<string>
): Promise<UploadResult> {
  const key = originalKey(kind, id);
  const publicUrl = `${PUBLIC_URL}/${key}`;
  // With a pre-listed key set this costs nothing; without one it falls back to a
  // HEAD per key, which is what a single ad-hoc call wants.
  const has = (k: string) => (existing ? Promise.resolve(existing.has(k)) : existsOnR2(k));

  let original: Buffer | null = null;
  let uploadedObjects = 0;

  if (!(await has(key))) {
    const fetched = await fetchImage(sourceUrl);
    original = fetched.buffer;
    await put(key, fetched.buffer, fetched.contentType);
    existing?.add(key);
    uploadedObjects++;
  }

  const missingWidths: number[] = [];
  for (const width of VARIANT_WIDTHS[kind]) {
    if (!(await has(variantKey(kind, id, width)))) missingWidths.push(width);
  }
  if (missingWidths.length === 0) return { url: publicUrl, uploadedObjects };

  // Already mirrored on a previous run — pull the original back to resize it.
  original ??= (await fetchImage(publicUrl)).buffer;

  for (const width of missingWidths) {
    const resized = await sharp(original)
      .resize(width, null, { withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    const vKey = variantKey(kind, id, width);
    await put(vKey, resized, "image/webp");
    existing?.add(vKey);
    uploadedObjects++;
  }

  return { url: publicUrl, uploadedObjects };
}
