import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { anime, animePlatforms } from "@/lib/schema";
import { eq, and, isNotNull, sql } from "drizzle-orm";
import { uploadImageToR2 } from "@/lib/r2";

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

const PLATFORM_IDS = ["dmmtv", "danime", "abema", "amazon", "unext", "netflix", "disney"] as const;

// --- AniList Queries ---

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

const AIRING_QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    nextAiringEpisode { episode airingAt }
  }
}
`;

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

// --- Step 1: Fetch seasonal anime from AniList ---

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

async function fetchSeasonalAnime(season: string, year: number): Promise<AniListMedia[]> {
  const allMedia: AniListMedia[] = [];
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    const res = await fetch(ANILIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: SEASONAL_QUERY,
        variables: { season, seasonYear: year, page },
      }),
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

  // Filter out hentai
  return allMedia.filter((m) => !m.genres?.includes("Hentai"));
}

async function upsertAnimeFromAniList(
  media: AniListMedia[],
  seasonSlug: string,
  log: string[]
): Promise<number> {
  const existing = await db.select({ anilistId: anime.anilistId, slug: anime.slug })
    .from(anime)
    .where(isNotNull(anime.anilistId));
  const existingIds = new Set(existing.map((e) => e.anilistId));

  let added = 0;

  for (const m of media) {
    if (existingIds.has(m.id)) continue;

    const title = m.title.native || m.title.romaji || "Unknown";
    const startDateStr = formatStartDate(m.startDate);
    const day = startDateStr ? getDayOfWeek(startDateStr) : null;
    const slug = toSlug({ titleRomaji: m.title.romaji, title, anilistId: m.id });
    const trailer = m.trailer?.site === "youtube" ? m.trailer.id : null;

    try {
      await db.insert(anime).values({
        slug,
        title,
        titleRomaji: m.title.romaji,
        titleEnglish: m.title.english,
        day,
        time: null,
        startDate: startDateStr,
        format: m.format,
        batchRelease: false,
        anilistId: m.id,
        image: m.coverImage?.extraLarge ?? m.coverImage?.large ?? null,
        banner: m.bannerImage,
        synopsis: cleanDescription(m.description),
        synopsisJa: null,
        genres: m.genres,
        episodes: m.episodes,
        studio: m.studios?.nodes?.[0]?.name ?? null,
        trailer,
        episodeStart: 1,
        episodeOffset: 0,
        pausedUntil: null,
        type: "見放題",
        season: seasonSlug,
      }).onConflictDoNothing();
      added++;
      log.push(`NEW: ${title} (${m.title.romaji})`);
    } catch {
      log.push(`ERROR inserting: ${title}`);
    }
  }

  return added;
}

// --- Step 2: Extract platform data via LLM ---

interface PlatformEntry {
  title: string;
  platform: string;
  day: string | null;
  time: string | null;
}

async function fetchPlatformData(seasonSlug: string, log: string[]): Promise<PlatformEntry[]> {
  // Determine the animebb.jp URL for the current season
  const [seasonName, year] = seasonSlug.split("-");
  const seasonJa: Record<string, string> = {
    winter: "冬", spring: "春", summer: "夏", fall: "秋",
  };
  const searchTerm = `${year}年${seasonJa[seasonName]}アニメ 配信`;

  // Try animebb.jp — the cross-platform comparison page
  const animeBbUrl = `https://animebb.jp/${year}-${seasonName}-anime-streaming-services-animebb/`;

  let html: string;
  try {
    const res = await fetch(animeBbUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PaoPaoAnime/1.0)" },
    });
    if (!res.ok) {
      log.push(`Platform crawl failed: ${animeBbUrl} (${res.status})`);
      return [];
    }
    html = await res.text();
  } catch (err) {
    log.push(`Platform crawl error: ${String(err)}`);
    return [];
  }

  // Trim HTML to reduce tokens — keep only table/main content
  const bodyMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
    ?? html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const content = bodyMatch?.[1] ?? html.slice(0, 100000);

  // Strip script/style tags to reduce noise
  const cleaned = content
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "");

  const anthropic = new Anthropic();

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `以下のHTMLはアニメ配信サービス比較ページです。各アニメがどの配信プラットフォームで見られるかを抽出してください。

対象プラットフォーム: DMM TV (dmmtv), dアニメストア (danime), ABEMA (abema), Amazon Prime Video (amazon), U-NEXT (unext), Netflix (netflix), Disney+ (disney)

JSON配列で返してください。各エントリ:
{"title": "アニメタイトル", "platforms": ["dmmtv", "abema", "unext"]}

タイトルは日本語のまま。プラットフォームIDはカッコ内のIDを使用。配信されていないプラットフォームは含めない。

HTMLのみ参照し、推測しないでください。JSONのみ返してください、説明不要。

HTML:
${cleaned.slice(0, 80000)}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  // Parse JSON from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    log.push("LLM returned no parseable JSON for platforms");
    return [];
  }

  try {
    const parsed: { title: string; platforms: string[] }[] = JSON.parse(jsonMatch[0]);
    const entries: PlatformEntry[] = [];
    for (const item of parsed) {
      for (const platform of item.platforms) {
        if (PLATFORM_IDS.includes(platform as typeof PLATFORM_IDS[number])) {
          entries.push({ title: item.title, platform, day: null, time: null });
        }
      }
    }
    log.push(`LLM extracted ${parsed.length} anime with platform data`);
    return entries;
  } catch {
    log.push("Failed to parse LLM platform JSON");
    return [];
  }
}

function normalize(t: string): string {
  return t
    .replace(/\s+/g, "")
    .replace(/[～〜~]/g, "")
    .replace(/[！!？?。、・「」『』【】（）()]/g, "")
    .replace(/TVアニメ/g, "")
    .replace(/第\d+期/g, "")
    .replace(/第\d+クール/g, "")
    .replace(/Season\d+/gi, "")
    .replace(/シーズン\d+/g, "")
    .replace(/２/g, "2")
    .toLowerCase();
}

async function matchAndUpsertPlatforms(
  platformEntries: PlatformEntry[],
  log: string[]
): Promise<number> {
  const allAnime = await db.select({ slug: anime.slug, title: anime.title, titleRomaji: anime.titleRomaji })
    .from(anime);

  // Build normalized title index
  const titleIndex = new Map<string, string>(); // normalized → slug
  for (const a of allAnime) {
    titleIndex.set(normalize(a.title), a.slug);
    if (a.titleRomaji) {
      titleIndex.set(normalize(a.titleRomaji), a.slug);
    }
  }

  let matched = 0;

  for (const entry of platformEntries) {
    const norm = normalize(entry.title);
    let slug = titleIndex.get(norm);

    // Partial match fallback
    if (!slug) {
      for (const [key, s] of titleIndex) {
        if (key.includes(norm) || norm.includes(key)) {
          slug = s;
          break;
        }
      }
    }

    if (!slug) continue;

    try {
      await db.insert(animePlatforms).values({
        animeSlug: slug,
        platform: entry.platform,
        day: entry.day,
        time: entry.time,
      }).onConflictDoNothing();
      matched++;
    } catch {
      // Skip conflicts silently
    }
  }

  log.push(`Matched ${matched} platform entries to anime in DB`);
  return matched;
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

    const rawEpisode = calcRawEpisode(entry.startDate, entry.day, entry.time, now);
    if (rawEpisode === null) continue;

    const res = await fetch(ANILIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: AIRING_QUERY, variables: { id: entry.anilistId } }),
    });

    if (!res.ok) {
      if (res.status === 429) {
        await sleep(60000);
        i--;
        continue;
      }
      await sleep(1500);
      continue;
    }

    const json = await res.json();
    const next = json.data?.Media?.nextAiringEpisode;
    const updates: { episodeOffset?: number; pausedUntil?: string | null } = {};

    if (next) {
      const airingAt = new Date(next.airingAt * 1000);
      const daysUntilNext = (airingAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

      if (daysUntilNext > 9) {
        const pauseDate = airingAt.toISOString().slice(0, 10);
        if (entry.pausedUntil !== pauseDate) {
          updates.pausedUntil = pauseDate;
          log.push(`PAUSE: ${entry.title} until ${pauseDate}`);
        }
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
      if (entry.pausedUntil) {
        updates.pausedUntil = null;
        log.push(`FINISHED: ${entry.title} (cleared pause)`);
      }
      if (entry.episodeOffset && entry.episodeOffset !== 0) {
        updates.episodeOffset = 0;
        log.push(`FINISHED: ${entry.title} (cleared offset)`);
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.update(anime).set({ ...updates, updatedAt: new Date() }).where(eq(anime.id, entry.id));
      updated++;
    }

    await sleep(1500);
  }

  return updated;
}

// --- Step 4: Upload images to R2 ---

async function uploadImages(log: string[]): Promise<number> {
  const entries = await db.select({
    id: anime.id,
    anilistId: anime.anilistId,
    image: anime.image,
    banner: anime.banner,
  }).from(anime).where(isNotNull(anime.anilistId));

  const r2PublicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL;
  let uploaded = 0;

  for (const entry of entries) {
    if (!entry.anilistId) continue;

    // Upload cover if it's still an external URL
    if (entry.image && !entry.image.startsWith(r2PublicUrl!) && !entry.image.startsWith("/img/")) {
      try {
        const key = `cover/${entry.anilistId}.jpg`;
        const newUrl = await uploadImageToR2(key, entry.image);
        await db.update(anime).set({ image: newUrl, updatedAt: new Date() }).where(eq(anime.id, entry.id));
        uploaded++;
      } catch (err) {
        log.push(`IMG ERROR: cover for ${entry.anilistId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Upload banner if it's still an external URL
    if (entry.banner && !entry.banner.startsWith(r2PublicUrl!) && !entry.banner.startsWith("/img/")) {
      try {
        const key = `banner/${entry.anilistId}.jpg`;
        const newUrl = await uploadImageToR2(key, entry.banner);
        await db.update(anime).set({ banner: newUrl, updatedAt: new Date() }).where(eq(anime.id, entry.id));
        uploaded++;
      } catch (err) {
        log.push(`IMG ERROR: banner for ${entry.anilistId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return uploaded;
}

// --- Main handler ---

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Support ?step=1,2,3,4 to run specific steps (default: all)
  const url = new URL(request.url);
  const stepParam = url.searchParams.get("step");
  const steps = stepParam
    ? stepParam.split(",").map(Number)
    : [1, 2, 3, 4];

  const now = new Date();
  const { season, year, slug: seasonSlug } = getCurrentSeason(now);
  const log: string[] = [];
  const results: Record<string, unknown> = { season: seasonSlug, steps, timestamp: now.toISOString() };

  // Step 1: Fetch and upsert new anime from AniList
  if (steps.includes(1)) {
    log.push(`--- Step 1: Fetch ${season} ${year} from AniList ---`);
    const media = await fetchSeasonalAnime(season, year);
    log.push(`AniList returned ${media.length} anime`);
    const newAnime = await upsertAnimeFromAniList(media, seasonSlug, log);
    results.newAnime = newAnime;
  }

  // Step 2: Extract and match platform data
  if (steps.includes(2)) {
    log.push(`--- Step 2: Extract platform data ---`);
    const platformEntries = await fetchPlatformData(seasonSlug, log);
    const platformsMatched = await matchAndUpsertPlatforms(platformEntries, log);
    results.platformsMatched = platformsMatched;
  }

  // Step 3: Sync episode offsets
  if (steps.includes(3)) {
    log.push(`--- Step 3: Sync episodes ---`);
    const episodesUpdated = await syncEpisodes(log);
    results.episodesUpdated = episodesUpdated;
  }

  // Step 4: Upload images to R2
  if (steps.includes(4)) {
    log.push(`--- Step 4: Upload images to R2 ---`);
    const imagesUploaded = await uploadImages(log);
    results.imagesUploaded = imagesUploaded;
  }

  results.log = log;

  return NextResponse.json({ success: true, ...results });
}
