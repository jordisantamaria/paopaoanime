/**
 * Seeds the Genkai Anime (限界アニメ「松山あおい物語」) seasons.
 *
 * Special case: an indie YouTube-only anime by Matsuyama Aoi. It is NOT on AniList,
 * so the weekly sync (which only reads rows with anilist_id and iterates AniList
 * results) never touches these rows. One entry per season (S1–S5).
 *
 * Each entry is `hidden: true` — searchable and reachable by URL, but excluded from
 * the home/schedule listings. No streaming platform rows (so no YouTube filter).
 * `trailer` holds the YouTube video ID of each season's first episode.
 *
 * Idempotent: re-running upserts by slug.
 *
 * Usage: npx tsx --env-file=.env.local scripts/seed-genkai.ts
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { anime } from "../src/lib/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

const SYNOPSIS_EN =
  "Matsuyama Aoi dreamed of becoming an anison (anime song) singer. Unable to break " +
  "in the usual way, she made her own TV anime — directing, writing, designing the " +
  "characters, composing the theme song, and voicing the lead herself. It aired on " +
  "TV Saitama and is freely available on YouTube.";

const SYNOPSIS_JA =
  "アニソン歌手を夢見る松山あおいが、普通のやり方ではなれないならばと、監督・原作・" +
  "キャラクターデザイン・主題歌・主演声優のすべてを自ら務めて作り上げたオリジナルTV" +
  "アニメ。テレビ埼玉で放送され、YouTubeで全話無料公開されている。";

type SeasonSeed = { season: number; startDate: string; videoId: string };

// First-episode YouTube video IDs, provided per season.
const SEASONS: SeasonSeed[] = [
  { season: 1, startDate: "2019-10-05", videoId: "jcE-WdvE8tM" },
  { season: 2, startDate: "2021-07-03", videoId: "0kvQI2mGBmA" },
  { season: 3, startDate: "2021-10-02", videoId: "lSUHVGh3zOk" },
  { season: 4, startDate: "2022-10-01", videoId: "ZwDzFxFVN_I" },
  { season: 5, startDate: "2025-10-04", videoId: "-5A42Uj_whQ" },
];

async function main() {
  for (const s of SEASONS) {
    const slug = `genkai-anime-matsuyama-aoi-s${s.season}`;
    const values = {
      slug,
      title: `限界アニメ Season ${s.season}「松山あおい物語」`,
      titleRomaji: `Genkai Anime Season ${s.season}: Matsuyama Aoi Monogatari`,
      titleEnglish: `Genkai Anime Season ${s.season}: The Story of Matsuyama Aoi`,
      day: "土",
      time: null,
      startDate: s.startDate,
      format: "TV",
      batchRelease: true,
      anilistId: null,
      image: `https://img.youtube.com/vi/${s.videoId}/hqdefault.jpg`,
      banner: null,
      synopsis: SYNOPSIS_EN,
      synopsisJa: SYNOPSIS_JA,
      genres: ["Music", "Comedy"],
      episodes: 12,
      studio: null,
      trailer: s.videoId,
      episodeStart: 1,
      episodeOffset: 0,
      pausedUntil: null,
      type: "見放題",
      season: "youtube",
      hidden: true,
    };

    await db
      .insert(anime)
      .values(values)
      .onConflictDoUpdate({
        target: anime.slug,
        set: { ...values, updatedAt: new Date() },
      });

    console.log(`Upserted ${slug} (ep1: ${s.videoId})`);
  }
  console.log(`Done. ${SEASONS.length} Genkai Anime seasons seeded.`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
