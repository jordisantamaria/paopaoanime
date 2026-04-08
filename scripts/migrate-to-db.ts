import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/lib/schema";

// Load env vars from .env.local (no dotenv dependency)
const envPath = path.join(__dirname, "..", ".env.local");
for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx);
  const val = trimmed.slice(eqIdx + 1).replace(/^"|"$/g, "");
  if (!process.env[key]) process.env[key] = val;
}

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

const DATA_DIR = path.join(__dirname, "..", "data");

function toSlug(entry: { titleRomaji?: string; title: string; anilistId?: number }): string {
  const base = entry.titleRomaji || entry.title;
  const slug = base
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug && entry.anilistId) return `anime-${entry.anilistId}`;
  if (!slug) return `anime-${Math.abs(hashCode(entry.title))}`;
  return slug;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash;
}

async function main() {
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  console.log(`Found ${files.length} season files: ${files.join(", ")}\n`);

  let totalAnime = 0;
  let totalPlatforms = 0;
  const seen = new Set<string>();

  for (const file of files) {
    const season = file.replace(".json", "");
    const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
    console.log(`Processing ${file}: ${raw.length} entries`);

    for (const entry of raw) {
      const slug = toSlug(entry);
      if (seen.has(slug)) {
        console.log(`  SKIP duplicate slug: ${slug}`);
        continue;
      }
      seen.add(slug);

      // Insert anime
      const [inserted] = await db.insert(schema.anime).values({
        slug,
        title: entry.title,
        titleRomaji: entry.titleRomaji ?? null,
        titleEnglish: entry.titleEnglish ?? null,
        day: entry.day ?? null,
        time: entry.time ?? null,
        startDate: entry.startDate ?? null,
        format: entry.format ?? null,
        batchRelease: entry.batchRelease ?? false,
        anilistId: entry.anilistId ?? null,
        image: entry.image ?? null,
        banner: entry.banner ?? null,
        synopsis: entry.synopsis ?? null,
        synopsisJa: entry.synopsisJa ?? null,
        genres: entry.genres ?? null,
        episodes: entry.episodes ?? null,
        studio: entry.studio ?? null,
        trailer: entry.trailer ?? null,
        episodeStart: entry.episodeStart ?? 1,
        episodeOffset: entry.episodeOffset ?? 0,
        pausedUntil: entry.pausedUntil ?? null,
        type: entry.type ?? "見放題",
        season,
      }).onConflictDoNothing().returning({ id: schema.anime.id });

      if (!inserted) {
        console.log(`  SKIP conflict: ${slug}`);
        continue;
      }
      totalAnime++;

      // Insert platforms from streams array (has per-platform schedule)
      if (entry.streams?.length) {
        for (const stream of entry.streams) {
          await db.insert(schema.animePlatforms).values({
            animeSlug: slug,
            platform: stream.platform,
            day: stream.day ?? null,
            time: stream.time ?? null,
          }).onConflictDoNothing();
          totalPlatforms++;
        }
      } else if (entry.platforms?.length) {
        // Fallback: use platforms array without schedule
        for (const platform of entry.platforms) {
          await db.insert(schema.animePlatforms).values({
            animeSlug: slug,
            platform,
            day: null,
            time: null,
          }).onConflictDoNothing();
          totalPlatforms++;
        }
      }
    }
  }

  console.log(`\nDone! Inserted ${totalAnime} anime + ${totalPlatforms} platform entries.`);
}

main().catch(console.error);
