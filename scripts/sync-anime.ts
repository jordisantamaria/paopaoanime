/**
 * Standalone sync-anime script for GitHub Actions.
 * Mirrors the logic from src/app/api/cron/sync-anime/route.ts
 * but runs as a Node script without Vercel Function timeout limits.
 *
 * Usage: npx tsx scripts/sync-anime.ts [--step=1,2,3,4]
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and, isNotNull, inArray } from "drizzle-orm";
import { anime, animePlatforms } from "../src/lib/schema";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

// --- DB setup ---

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

// --- R2 setup ---

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});
const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME!;
const R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL!;

async function uploadImageToR2(key: string, imageUrl: string): Promise<string> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return `${R2_PUBLIC_URL}/${key}`;
  } catch {
    // Not found — proceed to upload
  }
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to fetch image: ${imageUrl} (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  await s3.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: buffer, ContentType: contentType }));
  return `${R2_PUBLIC_URL}/${key}`;
}

// --- Constants ---

const ANILIST_URL = "https://graphql.anilist.co";

const SEASON_MAP: Record<number, string> = {
  1: "WINTER", 2: "WINTER", 3: "WINTER",
  4: "SPRING", 5: "SPRING", 6: "SPRING",
  7: "SUMMER", 8: "SUMMER", 9: "SUMMER",
  10: "FALL", 11: "FALL", 12: "FALL",
};

const DAY_TO_NUMBER: Record<string, number> = {
  日: 0, 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6,
};

const SEASONAL_QUERY = `
query ($season: MediaSeason, $seasonYear: Int, $page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage currentPage }
    media(season: $season, seasonYear: $seasonYear, type: ANIME, sort: POPULARITY_DESC, countryOfOrigin: "JP") {
      id
      format
      title { native romaji english }
      coverImage { large extraLarge }
      bannerImage
      description(asHtml: false)
      genres
      episodes
      studios(isMain: true) { nodes { name } }
      startDate { year month day }
      nextAiringEpisode { episode airingAt }
      trailer { id site }
      status
    }
  }
}
`;

const BY_ID_QUERY = `
query ($ids: [Int]) {
  Page(page: 1, perPage: 50) {
    media(id_in: $ids, type: ANIME) {
      id
      format
      title { native romaji english }
      coverImage { large extraLarge }
      bannerImage
      description(asHtml: false)
      genres
      episodes
      studios(isMain: true) { nodes { name } }
      startDate { year month day }
      nextAiringEpisode { episode airingAt }
      trailer { id site }
      status
    }
  }
}
`;

// Long-running anime that AniList's seasonal query never returns (started in past seasons).
// Re-tagged with the current season slug each sync. Day/time overrides apply only on first insert.
const ALWAYS_INCLUDE_ANIME: { id: number; day?: string; time?: string }[] = [
  { id: 21, day: "日", time: "09:30" }, // ONE PIECE — Fuji TV, Sunday 09:30 JST
];

const AIRING_QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    episodes
    nextAiringEpisode { episode airingAt }
  }
}
`;

const EXTERNAL_LINKS_QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    externalLinks { site type }
  }
}
`;

/** Map AniList externalLinks site names to our platform IDs */
const ANILIST_SITE_TO_PLATFORM: Record<string, string> = {
  "Netflix": "netflix",
  "Amazon": "amazon",
  "Amazon Prime Video": "amazon",
  "Disney Plus": "disney",
  "ABEMA": "abema",
  "Abema": "abema",
  "DMM TV": "dmmtv",
  "U-NEXT": "unext",
  "d Anime Store": "danime",
  "dアニメストア": "danime",
};

// --- Helpers ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCurrentSeason(now: Date): { season: string; year: number; slug: string } {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const season = SEASON_MAP[month];
  return { season, year, slug: `${season.toLowerCase()}-${year}` };
}

function cleanDescription(desc: string | null): string | undefined {
  if (!desc) return undefined;
  return desc
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n\(Source:.*\)/, "")
    .trim();
}

function toSlug(entry: { titleRomaji?: string | null; title: string; anilistId?: number | null }): string {
  const base = entry.titleRomaji || entry.title;
  const slug = base
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug && entry.anilistId) return `anime-${entry.anilistId}`;
  if (!slug) return `anime-unknown`;
  return slug;
}

function formatStartDate(sd: { year: number; month: number; day: number }): string | null {
  if (!sd?.year) return null;
  const m = String(sd.month ?? 1).padStart(2, "0");
  const d = String(sd.day ?? 1).padStart(2, "0");
  return `${sd.year}-${m}-${d}`;
}

function getDayOfWeek(dateStr: string): string {
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const date = new Date(dateStr + "T00:00:00+09:00");
  return days[date.getDay()];
}

function calcRawEpisode(startDate: string, day: string, time: string | null, now: Date): number | null {
  const start = new Date(startDate + "T00:00:00+09:00");
  if (start > now) return null;
  const dayNum = DAY_TO_NUMBER[day];
  if (dayNum === undefined) return null;
  const [hours, minutes] = time ? time.split(":").map(Number) : [0, 0];
  const recent = new Date(now);
  recent.setHours(hours, minutes, 0, 0);
  const currentDayNum = recent.getDay();
  let diff = currentDayNum - dayNum;
  if (diff < 0) diff += 7;
  if (diff === 0 && recent > now) diff = 7;
  recent.setDate(recent.getDate() - diff);
  if (recent < start) return null;
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.floor((recent.getTime() - start.getTime()) / msPerWeek) + 1;
}

function normalize(t: string): string {
  return t
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/\s+/g, "")
    .replace(/[～〜~]/g, "")
    .replace(/[！!？?。、・「」『』【】（）()：:]/g, "")
    .replace(/TVアニメ/g, "")
    .replace(/第\d+期/g, "")
    .replace(/第\d+クール/g, "")
    .replace(/Season\d+/gi, "")
    .replace(/シーズン\d+/g, "")
    .replace(/編/g, "")
    .toLowerCase();
}

// --- Interfaces ---

interface AniListMedia {
  id: number;
  format: string;
  title: { native: string | null; romaji: string | null; english: string | null };
  coverImage: { large: string | null; extraLarge: string | null } | null;
  bannerImage: string | null;
  description: string | null;
  genres: string[];
  episodes: number | null;
  studios: { nodes: { name: string }[] };
  startDate: { year: number; month: number; day: number };
  nextAiringEpisode: { episode: number; airingAt: number } | null;
  trailer: { id: string; site: string } | null;
  status: string;
}

interface PlatformEntry {
  title: string;
  platform: string;
  day: string | null;
  time: string | null;
}

// --- Step 1: Fetch seasonal anime from AniList ---

async function fetchSeasonalAnime(season: string, year: number): Promise<AniListMedia[]> {
  const allMedia: AniListMedia[] = [];
  let page = 1;
  let hasNext = true;
  while (hasNext) {
    const res = await fetch(ANILIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: SEASONAL_QUERY, variables: { season, seasonYear: year, page } }),
    });
    if (!res.ok) throw new Error(`AniList error: ${res.status}`);
    const json = await res.json();
    const pageData = json.data?.Page;
    if (!pageData?.media) break;
    allMedia.push(...pageData.media);
    hasNext = pageData.pageInfo.hasNextPage;
    page++;
    await sleep(1500);
  }
  return allMedia.filter((m) => !m.genres?.includes("Hentai"));
}

async function fetchAnimeByIds(ids: number[]): Promise<AniListMedia[]> {
  if (ids.length === 0) return [];
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: BY_ID_QUERY, variables: { ids } }),
  });
  if (!res.ok) throw new Error(`AniList error: ${res.status}`);
  const json = await res.json();
  const media: AniListMedia[] = json.data?.Page?.media ?? [];
  return media.filter((m) => !m.genres?.includes("Hentai"));
}

async function upsertAnimeFromAniList(
  media: AniListMedia[],
  seasonSlug: string,
  log: string[],
  overrides: Map<number, { day?: string; time?: string }> = new Map()
): Promise<{ added: number; updated: number }> {
  const existing = await db.select({ anilistId: anime.anilistId, slug: anime.slug, episodes: anime.episodes, season: anime.season })
    .from(anime).where(isNotNull(anime.anilistId));
  const existingMap = new Map(existing.map((e) => [e.anilistId, e]));
  let added = 0;
  let updated = 0;

  for (const m of media) {
    const ex = existingMap.get(m.id);
    if (ex) {
      const updates: Record<string, unknown> = {};
      if (m.episodes && m.episodes !== ex.episodes) updates.episodes = m.episodes;
      if (overrides.has(m.id) && ex.season !== seasonSlug) updates.season = seasonSlug;
      if (Object.keys(updates).length > 0) {
        updates.updatedAt = new Date();
        await db.update(anime).set(updates).where(eq(anime.anilistId, m.id));
        updated++;
        log.push(`UPDATED: ${m.title.native ?? m.title.romaji} (episodes: ${m.episodes})`);
      }
      continue;
    }
    const title = m.title.native || m.title.romaji || "Unknown";
    const startDateStr = formatStartDate(m.startDate);
    const override = overrides.get(m.id);
    const day = override?.day ?? (startDateStr ? getDayOfWeek(startDateStr) : null);
    const time = override?.time ?? null;
    const slug = toSlug({ titleRomaji: m.title.romaji, title, anilistId: m.id });
    const trailer = m.trailer?.site === "youtube" ? m.trailer.id : null;
    try {
      await db.insert(anime).values({
        slug, title, titleRomaji: m.title.romaji, titleEnglish: m.title.english,
        day, time, startDate: startDateStr, format: m.format, batchRelease: false,
        anilistId: m.id, image: m.coverImage?.extraLarge ?? m.coverImage?.large ?? null,
        banner: m.bannerImage, synopsis: cleanDescription(m.description), synopsisJa: null,
        genres: m.genres, episodes: m.episodes, studio: m.studios?.nodes?.[0]?.name ?? null,
        trailer, episodeStart: 1, episodeOffset: 0, pausedUntil: null,
        type: "見放題", season: seasonSlug,
      }).onConflictDoNothing();
      added++;
      log.push(`NEW: ${title} (${m.title.romaji})`);
    } catch {
      log.push(`ERROR inserting: ${title}`);
    }
  }
  return { added, updated };
}

// --- Step 2: Platform data from uzurea.net ---

const UZUREA_PLATFORM_MAP: Record<string, string> = {
  dmmtv: "dmmtv", d: "danime", abema: "abema", amazon: "amazon",
  unext: "unext", netflix: "netflix", disneyplus: "disney",
};

const DAY_JA_TO_DAY: Record<string, string> = {
  月: "月", 火: "火", 水: "水", 木: "木", 金: "金", 土: "土", 日: "日",
};

function getPlatformScheduleUrls(seasonName: string, year: string): { platform: string; url: string }[] {
  const month = { winter: "1", spring: "4", summer: "7", fall: "10" }[seasonName] ?? "4";
  return [
    { platform: "dmmtv", url: `https://uzurea.net/dmm-tv-${seasonName}-${year}-anime/` },
    { platform: "danime", url: `https://uzurea.net/d-animestore-anime-list-${seasonName}${year}/` },
    { platform: "abema", url: `https://uzurea.net/abema-${year}-${seasonName}-anime-list/` },
    { platform: "amazon", url: `https://uzurea.net/amazon-primevideo-${year}-${month}/` },
    { platform: "unext", url: `https://uzurea.net/u-next-${year}-${month}/` },
    { platform: "netflix", url: `https://uzurea.net/new-on-netflix-${year}-${month.padStart(2, "0")}/` },
    { platform: "disney", url: `https://uzurea.net/disneyplus-${month}-${year}/` },
  ];
}

function parseSchedulePage(html: string): { title: string; day: string | null; time: string | null }[] {
  const listMatch = html.match(/<ul[^>]*class="vc_monthly_list"[^>]*>([\s\S]*?)<\/ul>/i);
  if (!listMatch) return [];
  const items = listMatch[1].match(/<li>[\s\S]*?<\/li>/gi) ?? [];
  const results: { title: string; day: string | null; time: string | null }[] = [];
  for (const li of items) {
    const titleMatch = li.match(/<strong>(?:<a[^>]*>)?([\s\S]*?)(?:<\/a>)?\s*<\/strong>/i);
    if (!titleMatch) continue;
    const title = titleMatch[1].replace(/<[^>]+>/g, "").trim();
    if (!title) continue;
    const dayMatch = li.match(/（([月火水木金土日])）/);
    const day = dayMatch ? DAY_JA_TO_DAY[dayMatch[1]] ?? null : null;
    const timeMatch = li.match(/(\d{1,2}:\d{2})/);
    const time = timeMatch ? timeMatch[1] : null;
    results.push({ title, day, time });
  }
  return results;
}

async function fetchPlatformData(seasonSlug: string, log: string[]): Promise<PlatformEntry[]> {
  const [seasonName, year] = seasonSlug.split("-");
  const seasonJa: Record<string, string> = { winter: "冬", spring: "春", summer: "夏", fall: "秋" };
  const tagUrl = `https://uzurea.net/vc_tags/${year}年${seasonJa[seasonName]}アニメ/?posts_per_page=200`;
  const entries: PlatformEntry[] = [];

  let masterHtml: string | null = null;
  try {
    const res = await fetch(tagUrl, { headers: { "User-Agent": "Mozilla/5.0 (compatible; PaoPaoAnime/1.0)" } });
    if (res.ok) masterHtml = await res.text();
    else log.push(`Master page failed: ${res.status}`);
  } catch (err) {
    log.push(`Master page error: ${String(err)}`);
  }

  if (masterHtml) {
    const articles = masterHtml.match(/<article[^>]*>[\s\S]*?<\/article>/gi) ?? [];
    let animeCount = 0;
    for (const article of articles) {
      const titleMatch = article.match(/<a[^>]*class="[^"]*entry-title[^"]*"[^>]*><h2>([\s\S]*?)<\/h2><\/a>/i);
      if (!titleMatch) continue;
      const title = titleMatch[1].replace(/<[^>]+>/g, "").trim();
      if (!title) continue;
      const platformListMatch = article.match(/<ul[^>]*class="vc_distlist01[^"]*"[^>]*>([\s\S]*?)<\/ul>/i);
      if (!platformListMatch) continue;
      const platformItems = platformListMatch[1].match(/<li[^>]*class="([^"]*)"[^>]*>/gi) ?? [];
      for (const li of platformItems) {
        const classMatch = li.match(/class="([^"]*)"/i);
        if (!classMatch) continue;
        const platformId = UZUREA_PLATFORM_MAP[classMatch[1].trim()];
        if (platformId) {
          entries.push({ title, platform: platformId, day: null, time: null });
          animeCount++;
        }
      }
    }
    log.push(`Master: ${animeCount} platform entries from ${articles.length} articles`);
  }

  const scheduleUrls = getPlatformScheduleUrls(seasonName, year);
  const entryIndices = new Map<string, number[]>();
  for (let i = 0; i < entries.length; i++) {
    const norm = normalize(entries[i].title);
    const list = entryIndices.get(norm) ?? [];
    list.push(i);
    entryIndices.set(norm, list);
  }

  for (const { platform, url } of scheduleUrls) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; PaoPaoAnime/1.0)" } });
      if (!res.ok) { log.push(`Schedule ${platform}: ${res.status}`); continue; }
      const html = await res.text();
      const schedules = parseSchedulePage(html);
      let matched = 0;
      for (const sched of schedules) {
        const norm = normalize(sched.title);
        for (const [key, indices] of entryIndices) {
          if (key.includes(norm) || norm.includes(key)) {
            for (const idx of indices) {
              if (entries[idx].platform === platform && !entries[idx].day) {
                entries[idx].day = sched.day;
                entries[idx].time = sched.time;
                matched++;
              }
            }
          }
        }
      }
      log.push(`Schedule ${platform}: ${schedules.length} anime, ${matched} schedules matched`);
    } catch {
      log.push(`Schedule ${platform}: fetch error`);
    }
  }
  return entries;
}

async function matchAndUpsertPlatforms(platformEntries: PlatformEntry[], log: string[]): Promise<number> {
  const allAnime = await db.select({ slug: anime.slug, title: anime.title, titleRomaji: anime.titleRomaji }).from(anime);
  const titleIndex = new Map<string, string>();
  for (const a of allAnime) {
    titleIndex.set(normalize(a.title), a.slug);
    if (a.titleRomaji) titleIndex.set(normalize(a.titleRomaji), a.slug);
  }
  let matched = 0;
  for (const entry of platformEntries) {
    const norm = normalize(entry.title);
    let slug = titleIndex.get(norm);
    if (!slug) {
      for (const [key, s] of titleIndex) {
        if (key.includes(norm) || norm.includes(key)) { slug = s; break; }
      }
    }
    if (!slug) continue;
    try {
      const [existing] = await db.select({ id: animePlatforms.id, day: animePlatforms.day })
        .from(animePlatforms)
        .where(and(eq(animePlatforms.animeSlug, slug), eq(animePlatforms.platform, entry.platform)));
      if (!existing) {
        await db.insert(animePlatforms).values({ animeSlug: slug, platform: entry.platform, day: entry.day, time: entry.time });
        matched++;
      } else if (!existing.day && entry.day) {
        await db.update(animePlatforms).set({ day: entry.day, time: entry.time }).where(eq(animePlatforms.id, existing.id));
        matched++;
      }
    } catch { /* skip */ }
  }
  log.push(`Matched ${matched} platform entries to anime in DB`);
  return matched;
}

// --- Step 2b: AniList fallback for anime missing platforms ---

async function fillMissingPlatformsFromAniList(seasonSlug: string, log: string[]): Promise<number> {
  const seasonAnime = await db.select({ slug: anime.slug, title: anime.title, anilistId: anime.anilistId })
    .from(anime).where(eq(anime.season, seasonSlug));
  const allPlats = await db.select({ animeSlug: animePlatforms.animeSlug }).from(animePlatforms);
  const slugsWithPlatforms = new Set(allPlats.map((p) => p.animeSlug));
  const missing = seasonAnime.filter((a) => a.anilistId && !slugsWithPlatforms.has(a.slug));

  if (missing.length === 0) {
    log.push("AniList fallback: no anime missing platforms");
    return 0;
  }
  log.push(`AniList fallback: ${missing.length} anime missing platforms, querying externalLinks...`);

  let filled = 0;
  for (const entry of missing) {
    try {
      const res = await fetch(ANILIST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: EXTERNAL_LINKS_QUERY, variables: { id: entry.anilistId } }),
      });
      if (!res.ok) {
        if (res.status === 429) await sleep(60000);
        else await sleep(1500);
        continue;
      }
      const json = await res.json();
      const links = json.data?.Media?.externalLinks ?? [];
      const streamingLinks = links.filter((l: { type: string }) => l.type === "STREAMING");
      let addedForThis = 0;

      for (const link of streamingLinks) {
        const platformId = ANILIST_SITE_TO_PLATFORM[link.site];
        if (!platformId) continue;
        try {
          await db.insert(animePlatforms)
            .values({ animeSlug: entry.slug, platform: platformId, day: null, time: null })
            .onConflictDoNothing();
          addedForThis++;
        } catch { /* skip duplicates */ }
      }
      if (addedForThis > 0) {
        filled += addedForThis;
        log.push(`  AniList fallback: ${entry.title} → ${addedForThis} platforms added`);
      }
    } catch {
      log.push(`  AniList fallback error: ${entry.title}`);
    }
    await sleep(700);
  }
  log.push(`AniList fallback: ${filled} total platform entries added`);
  return filled;
}

// --- Step 3: Sync episodes ---

async function syncEpisodes(log: string[]): Promise<number> {
  const now = new Date();
  const airingAnime = await db.select().from(anime)
    .where(and(isNotNull(anime.anilistId), eq(anime.batchRelease, false)));
  let updated = 0;

  for (let i = 0; i < airingAnime.length; i++) {
    const entry = airingAnime[i];
    if (!entry.day || !entry.startDate || !entry.anilistId) continue;
    if (entry.episodes) {
      const weeksNeeded = entry.episodes + 2;
      const start = new Date(entry.startDate + "T00:00:00+09:00");
      const endEstimate = new Date(start.getTime() + weeksNeeded * 7 * 24 * 60 * 60 * 1000);
      if (now > endEstimate) continue;
    }
    const rawEpisode = calcRawEpisode(entry.startDate, entry.day, entry.time, now);
    if (rawEpisode === null) continue;

    const res = await fetch(ANILIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: AIRING_QUERY, variables: { id: entry.anilistId } }),
    });
    if (!res.ok) {
      if (res.status === 429) { await sleep(60000); i--; continue; }
      await sleep(1500);
      continue;
    }
    const json = await res.json();
    const mediaData = json.data?.Media;
    const next = mediaData?.nextAiringEpisode;
    const updates: { episodeOffset?: number; pausedUntil?: string | null; episodes?: number } = {};

    if (mediaData?.episodes && mediaData.episodes !== entry.episodes) {
      updates.episodes = mediaData.episodes;
      log.push(`EPISODES: ${entry.title} ${entry.episodes ?? "null"} → ${mediaData.episodes}`);
    }
    if (next) {
      const airingAt = new Date(next.airingAt * 1000);
      const daysUntilNext = (airingAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (daysUntilNext > 9) {
        const pauseDate = airingAt.toISOString().slice(0, 10);
        if (entry.pausedUntil !== pauseDate) { updates.pausedUntil = pauseDate; log.push(`PAUSE: ${entry.title} until ${pauseDate}`); }
      } else if (entry.pausedUntil) {
        updates.pausedUntil = null;
        log.push(`RESUME: ${entry.title}`);
      }
      const actualEpisode = next.episode - 1;
      const neededOffset = actualEpisode - rawEpisode;
      if (neededOffset !== (entry.episodeOffset ?? 0)) {
        updates.episodeOffset = neededOffset;
        log.push(`OFFSET: ${entry.title} ${entry.episodeOffset ?? 0} → ${neededOffset}`);
      }
    } else {
      if (entry.pausedUntil) { updates.pausedUntil = null; log.push(`FINISHED: ${entry.title} (cleared pause)`); }
      if (entry.episodeOffset && entry.episodeOffset !== 0) { updates.episodeOffset = 0; log.push(`FINISHED: ${entry.title} (cleared offset)`); }
    }
    if (Object.keys(updates).length > 0) {
      await db.update(anime).set({ ...updates, updatedAt: new Date() }).where(eq(anime.id, entry.id));
      updated++;
    }
    await sleep(700);
  }
  return updated;
}

// --- Step 4: Upload images to R2 ---

async function uploadImages(log: string[]): Promise<number> {
  const entries = await db.select({ id: anime.id, anilistId: anime.anilistId, image: anime.image, banner: anime.banner })
    .from(anime).where(isNotNull(anime.anilistId));
  let uploaded = 0;

  for (const entry of entries) {
    if (!entry.anilistId) continue;
    const isOnR2 = (url: string) => url.startsWith(R2_PUBLIC_URL);

    if (entry.image && !isOnR2(entry.image)) {
      try {
        const key = `cover/${entry.anilistId}.jpg`;
        const sourceUrl = entry.image.startsWith("/")
          ? `https://s3.anilist.co/media/anime/cover/large/b${entry.anilistId}.jpg`
          : entry.image;
        const newUrl = await uploadImageToR2(key, sourceUrl);
        await db.update(anime).set({ image: newUrl, updatedAt: new Date() }).where(eq(anime.id, entry.id));
        uploaded++;
      } catch (err) {
        log.push(`IMG ERROR: cover for ${entry.anilistId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (entry.banner && !isOnR2(entry.banner)) {
      try {
        const key = `banner/${entry.anilistId}.jpg`;
        const sourceUrl = entry.banner.startsWith("/")
          ? `https://s3.anilist.co/media/anime/banner/${entry.anilistId}.jpg`
          : entry.banner;
        const newUrl = await uploadImageToR2(key, sourceUrl);
        await db.update(anime).set({ banner: newUrl, updatedAt: new Date() }).where(eq(anime.id, entry.id));
        uploaded++;
      } catch (err) {
        log.push(`IMG ERROR: banner for ${entry.anilistId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  return uploaded;
}

// --- Main ---

async function main() {
  const stepArg = process.argv.find((a) => a.startsWith("--step="));
  const steps = stepArg ? stepArg.replace("--step=", "").split(",").map(Number) : [1, 2, 3, 4];

  const now = new Date();
  const { season, year, slug: seasonSlug } = getCurrentSeason(now);
  const log: string[] = [];
  const results: Record<string, unknown> = { season: seasonSlug, steps, timestamp: now.toISOString() };

  if (steps.includes(1)) {
    log.push(`--- Step 1: Fetch ${season} ${year} from AniList ---`);
    const seasonalMedia = await fetchSeasonalAnime(season, year);
    log.push(`AniList seasonal returned ${seasonalMedia.length} anime`);

    const extraIds = ALWAYS_INCLUDE_ANIME.map((e) => e.id)
      .filter((id) => !seasonalMedia.some((m) => m.id === id));
    const extraMedia = await fetchAnimeByIds(extraIds);
    log.push(`AniList always-include returned ${extraMedia.length} anime`);

    const overrides = new Map(ALWAYS_INCLUDE_ANIME.map((e) => [e.id, { day: e.day, time: e.time }]));
    const media = [...seasonalMedia, ...extraMedia];
    const { added, updated } = await upsertAnimeFromAniList(media, seasonSlug, log, overrides);
    results.newAnime = added;
    results.metadataUpdated = updated;
  }

  if (steps.includes(2)) {
    log.push(`--- Step 2: Extract platform data ---`);
    const platformEntries = await fetchPlatformData(seasonSlug, log);
    const platformsMatched = await matchAndUpsertPlatforms(platformEntries, log);
    results.platformsMatched = platformsMatched;

    log.push(`--- Step 2b: AniList fallback for missing platforms ---`);
    const fallbackFilled = await fillMissingPlatformsFromAniList(seasonSlug, log);
    results.platformsFallback = fallbackFilled;
  }

  if (steps.includes(3)) {
    log.push(`--- Step 3: Sync episodes ---`);
    const episodesUpdated = await syncEpisodes(log);
    results.episodesUpdated = episodesUpdated;
  }

  if (steps.includes(4)) {
    log.push(`--- Step 4: Upload images to R2 ---`);
    const imagesUploaded = await uploadImages(log);
    results.imagesUploaded = imagesUploaded;
  }

  console.log(JSON.stringify({ success: true, ...results, log }, null, 2));
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
