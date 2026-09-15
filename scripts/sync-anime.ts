/**
 * The anime data pipeline. Runs on GitHub Actions (.github/workflows/sync-anime.yml,
 * Sundays 21:00 UTC) as a plain Node script, with no Vercel Function timeout to fit in.
 * This is the only implementation — a duplicate lived at
 * src/app/api/cron/sync-anime/route.ts until it drifted two fixes behind and was removed.
 *
 * Usage: npx tsx scripts/sync-anime.ts [--step=1,2,3,4,5] [--season=fall-2026]
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and, isNotNull, isNull, inArray } from "drizzle-orm";
import { anime, animePlatforms } from "../src/lib/schema";
import { uploadImageWithVariants, listExistingKeys } from "../src/lib/r2";
import { translateToJapanese, DeepLError } from "../src/lib/translate";
import {
  fetchSeasonFromAnimeSchedule,
  anilistIdFromEntry,
  coverUrl,
  isUnsetDate,
  type AnimeScheduleEntry,
} from "../src/lib/animeschedule";

// --- DB setup ---

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

// --- Constants ---

const ANILIST_URL = "https://graphql.anilist.co";

const SEASON_MAP: Record<number, string> = {
  1: "WINTER", 2: "WINTER", 3: "WINTER",
  4: "SPRING", 5: "SPRING", 6: "SPRING",
  7: "SUMMER", 8: "SUMMER", 9: "SUMMER",
  10: "FALL", 11: "FALL", 12: "FALL",
};

const SEASON_ORDER = ["WINTER", "SPRING", "SUMMER", "FALL"];

const SEASON_START_MONTH: Record<string, number> = {
  WINTER: 1, SPRING: 4, SUMMER: 7, FALL: 10,
};

// How early the upcoming season is pulled in alongside the current one. Japanese
// seasons premiere across the first ~10 days of their quarter and the cron only
// runs on Sundays, so the window has to cover several runs before the first
// premiere. 30 days gives 4-5 chances and AniList's listing is complete by then.
const LOOKAHEAD_DAYS = 30;

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

// AniList sits behind Cloudflare and rejects requests without a proper
// User-Agent with a 403 (this hits CI runner IPs hardest). Centralize the
// GraphQL calls so every request carries a User-Agent and retries transient
// failures (403 Cloudflare block, 429 rate limit, 5xx) with backoff.
const ANILIST_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 (compatible; PaoPaoAnime/1.0; +https://paopaoanime.com)",
} as const;

// Backoff schedule for a 403/5xx. The previous 2/4/6/8s ladder gave up after 20s,
// which only helps against a momentary blip; the real failures are AniList-side
// outages ("The AniList API has been temporarily disabled") lasting minutes.
const ANILIST_BACKOFF_MS = [15000, 45000, 90000, 180000];

/**
 * Circuit breaker. Steps 2b and 3 call AniList once per anime (hundreds of calls),
 * so paying the full backoff on each one would blow the job's 30-min budget for
 * nothing. Once a call has exhausted its retries against a server-side failure,
 * every later call short-circuits — callers already treat a non-ok response as
 * "skip this anime", and the run moves on to the steps that do not need AniList.
 */
let anilistDown = false;

/** Reason recorded when the breaker trips, for the run log. */
let anilistDownReason = "";

/** A response the breaker returns without hitting the network. */
function anilistUnavailableResponse(): Response {
  return new Response(null, { status: 503, statusText: "AniList circuit breaker open" });
}

// AniList returns its own error message in the JSON body (Cloudflare's block and
// AniList's "temporarily disabled" both surface as a 403), so read it for the log.
async function anilistErrorMessage(res: Response): Promise<string> {
  try {
    const json = await res.clone().json();
    const message = json?.errors?.[0]?.message;
    if (typeof message === "string" && message) return `${res.status}: ${message}`;
  } catch { /* body was not JSON */ }
  return `${res.status}: ${res.statusText || "no error message"}`;
}

async function anilistFetch(
  query: string,
  variables: Record<string, unknown>,
): Promise<Response> {
  if (anilistDown) return anilistUnavailableResponse();

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(ANILIST_URL, {
      method: "POST",
      headers: ANILIST_HEADERS,
      body: JSON.stringify({ query, variables }),
    });
    if (res.ok) return res;

    // 403 (Cloudflare block or AniList disabled), 429 (rate limit) and 5xx are
    // transient — back off and retry.
    const retryable = res.status === 403 || res.status === 429 || res.status >= 500;
    if (retryable && attempt < ANILIST_BACKOFF_MS.length) {
      await sleep(res.status === 429 ? 60000 : ANILIST_BACKOFF_MS[attempt]);
      continue;
    }
    // Retries exhausted against a server-side failure: AniList is down, not just
    // this one query. 429 is excluded — that is our own request rate, and the next
    // anime may well succeed.
    if (retryable && res.status !== 429) {
      anilistDown = true;
      anilistDownReason = await anilistErrorMessage(res);
    }
    return res;
  }
}

// Anime seasons are a Japanese calendar concept and the runner is on UTC, so a
// Sunday-night cron (21:00 UTC) sits on the next JST day. Resolve the month in JST
// or the run on the last Sunday of a quarter would still ask for the old season.
function jstMonthYear(now: Date): { month: number; year: number } {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return { month: jst.getUTCMonth() + 1, year: jst.getUTCFullYear() };
}

function seasonInfo(season: string, year: number): SeasonInfo {
  return { season, year, slug: `${season.toLowerCase()}-${year}` };
}

function getCurrentSeason(now: Date): SeasonInfo {
  const { month, year } = jstMonthYear(now);
  return seasonInfo(SEASON_MAP[month], year);
}

function getNextSeason(current: SeasonInfo): SeasonInfo {
  const index = SEASON_ORDER.indexOf(current.season);
  const next = SEASON_ORDER[(index + 1) % SEASON_ORDER.length];
  // Only FALL -> WINTER crosses into the following year.
  return seasonInfo(next, next === "WINTER" ? current.year + 1 : current.year);
}

/** First day of a season, as JST midnight. */
function seasonStart(info: SeasonInfo): Date {
  const month = String(SEASON_START_MONTH[info.season]).padStart(2, "0");
  return new Date(`${info.year}-${month}-01T00:00:00+09:00`);
}

/**
 * Seasons to sync on this run: always the current one, plus the upcoming one once
 * it starts within LOOKAHEAD_DAYS.
 *
 * Without the lookahead the sync only ever asked AniList for the current calendar
 * season, so a season's titles could not enter the DB until the first Sunday run
 * after it had already begun -- days late, with the premieres missing from the site.
 * AniList publishes a season's listing weeks ahead, so we pull it early; entries
 * with a future startDate are filtered out of the listings until they premiere.
 */
function getSyncSeasons(now: Date): SeasonInfo[] {
  const current = getCurrentSeason(now);
  const next = getNextSeason(current);
  const daysUntilNext = (seasonStart(next).getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
  return daysUntilNext <= LOOKAHEAD_DAYS ? [current, next] : [current];
}

/** Parses a `--season=fall-2026,winter-2027` override into SeasonInfo entries. */
function parseSeasonArg(value: string): SeasonInfo[] {
  return value.split(",").map((raw) => {
    const [name, year] = raw.trim().toLowerCase().split("-");
    const season = name?.toUpperCase();
    if (!season || !SEASON_ORDER.includes(season) || !/^\d{4}$/.test(year ?? "")) {
      throw new Error(`Invalid --season value: "${raw}" (expected e.g. fall-2026)`);
    }
    return seasonInfo(season, Number(year));
  });
}

function cleanDescription(desc: string | null): string | undefined {
  if (!desc) return undefined;
  return desc
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n\(Source:.*\)/, "")
    .trim();
}

// AniList usually returns English descriptions, but some titles only have a
// Japanese one. Feeding Japanese into DeepL's EN→JA translation degrades it, so
// the translate step skips synopses that are already Japanese.
function isJapanese(text: string): boolean {
  return /[぀-ヿ㐀-䶿一-鿿]/.test(text);
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

// `dateStr` is already a JST calendar date, so no zone conversion should happen:
// parse it as UTC midnight and read the UTC weekday. Building it at JST midnight
// and calling the local `getDay()` made the answer depend on the machine — JST
// midnight is 15:00 UTC the day before, so the UTC CI runner stored every anime
// one weekday early while a JST laptop stored it correctly.
function getDayOfWeek(dateStr: string): string {
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return days[new Date(dateStr + "T00:00:00Z").getUTCDay()];
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// Broadcast days and times are Japanese. Reading and writing the date fields with
// the local accessors (`setHours`/`getDay`/`getDate`) made this depend on the
// machine's timezone: on the UTC runner the JST broadcast time was applied as if it
// were UTC, a 9-hour skew that can move the computed episode by a whole week.
// Shifting the instant by +9h and using the UTC accessors is explicit JST, and gives
// the same answer everywhere.
function calcRawEpisode(startDate: string, day: string, time: string | null, now: Date): number | null {
  const start = new Date(startDate + "T00:00:00+09:00");
  if (start > now) return null;
  const dayNum = DAY_TO_NUMBER[day];
  if (dayNum === undefined) return null;
  const [hours, minutes] = time ? time.split(":").map(Number) : [0, 0];

  const jstNow = new Date(now.getTime() + JST_OFFSET_MS);
  const slot = new Date(jstNow.getTime());
  slot.setUTCHours(hours, minutes, 0, 0);
  let diff = slot.getUTCDay() - dayNum;
  if (diff < 0) diff += 7;
  if (diff === 0 && slot > jstNow) diff = 7;
  slot.setUTCDate(slot.getUTCDate() - diff);

  const airedAt = new Date(slot.getTime() - JST_OFFSET_MS);
  if (airedAt < start) return null;
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.floor((airedAt.getTime() - start.getTime()) / msPerWeek) + 1;
}

// Unicode roman numerals (U+2160–U+216B / U+2170–U+217B) so that, e.g.,
// uzurea's "actⅡ" matches AniList's ASCII "actII". The chōonpu "ー" is left
// untouched — it is a real katakana long-vowel mark, not a dash.
const ROMAN_NUMERAL_MAP: Record<string, string> = {
  "Ⅰ": "i", "Ⅱ": "ii", "Ⅲ": "iii", "Ⅳ": "iv", "Ⅴ": "v", "Ⅵ": "vi",
  "Ⅶ": "vii", "Ⅷ": "viii", "Ⅸ": "ix", "Ⅹ": "x", "Ⅺ": "xi", "Ⅻ": "xii",
  "ⅰ": "i", "ⅱ": "ii", "ⅲ": "iii", "ⅳ": "iv", "ⅴ": "v", "ⅵ": "vi",
  "ⅶ": "vii", "ⅷ": "viii", "ⅸ": "ix", "ⅹ": "x", "ⅺ": "xi", "ⅻ": "xii",
};

function normalize(t: string): string {
  return t
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[Ⅰ-Ⅻⅰ-ⅻ]/g, (c) => ROMAN_NUMERAL_MAP[c] ?? c)
    .replace(/\s+/g, "")
    .replace(/[～〜~]/g, "")
    .replace(/[-‐‑‒–—―−]/g, "")
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

interface SeasonInfo {
  season: string;
  year: number;
  /** DB `anime.season` value, e.g. "fall-2026". */
  slug: string;
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
    const res = await anilistFetch(SEASONAL_QUERY, { season, seasonYear: year, page });
    if (!res.ok) throw new Error(`AniList error: ${await anilistErrorMessage(res)}`);
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
  const res = await anilistFetch(BY_ID_QUERY, { ids });
  if (!res.ok) throw new Error(`AniList error: ${await anilistErrorMessage(res)}`);
  const json = await res.json();
  const media: AniListMedia[] = json.data?.Page?.media ?? [];
  return media.filter((m) => !m.genres?.includes("Hentai"));
}

// --- Step 1 fallback: AnimeSchedule.net ---

// AnimeSchedule's media type names -> AniList's `format` vocabulary, which is what
// the DB column and NON_TV_FORMATS already speak.
const ANIMESCHEDULE_FORMAT: Record<string, string> = {
  "tv": "TV",
  "tv short": "TV_SHORT",
  "movie": "MOVIE",
  "ova": "OVA",
  "ona": "ONA",
  "special": "SPECIAL",
  "music": "MUSIC",
};

/**
 * Maps an AnimeSchedule entry onto the AniList shape so the rest of Step 1 is
 * unchanged. Returns null for entries we cannot key: without an AniList id the
 * row could not be reconciled when AniList comes back, and would duplicate.
 *
 * Deliberately absent: `description` and `bannerImage` (AnimeSchedule has no
 * synopsis and no banner) and `nextAiringEpisode`. Those stay empty until AniList
 * returns and `backfillFromAniList` fills them in.
 */
function animeScheduleToMedia(entry: AnimeScheduleEntry): AniListMedia | null {
  const anilistId = anilistIdFromEntry(entry);
  if (!anilistId) return null;

  const romaji = entry.names?.romaji ?? entry.title ?? null;
  const native = entry.names?.native ?? null;
  if (!romaji && !native) return null;

  const premier = isUnsetDate(entry.premier) ? null : entry.premier!;
  const parsed = premier ? new Date(premier) : null;
  const startDate = parsed
    ? { year: parsed.getUTCFullYear(), month: parsed.getUTCMonth() + 1, day: parsed.getUTCDate() }
    : { year: 0, month: 0, day: 0 };

  const mediaType = entry.mediaTypes?.[0]?.name?.toLowerCase() ?? "";
  const cover = coverUrl(entry);

  return {
    id: anilistId,
    format: ANIMESCHEDULE_FORMAT[mediaType] ?? "TV",
    title: { native, romaji, english: entry.names?.english ?? null },
    coverImage: cover ? { large: cover, extraLarge: cover } : null,
    bannerImage: null,
    description: null,
    genres: (entry.genres ?? []).map((g) => g.name),
    episodes: entry.episodes && entry.episodes > 0 ? entry.episodes : null,
    studios: { nodes: (entry.studios ?? []).map((st) => ({ name: st.name })) },
    startDate,
    nextAiringEpisode: null,
    trailer: null,
    status: entry.status ?? "",
  };
}

/**
 * Seasonal listing from AnimeSchedule, mapped to the AniList shape.
 *
 * Note on scheduling: the API also carries `jpnTime`, but checked against
 * currently-airing shows its weekday did not agree with `premier` (e.g. a title
 * premiering on a Saturday carrying a Tuesday `jpnTime`), so it is not used. `day`
 * is derived from the premiere date exactly as on the AniList path, and the real
 * per-platform schedule keeps coming from uzurea in Step 2.
 */
async function fetchSeasonalFromAnimeSchedule(
  seasonSlug: string,
  log: string[],
): Promise<AniListMedia[]> {
  const entries = await fetchSeasonFromAnimeSchedule(seasonSlug);
  const media: AniListMedia[] = [];
  let skipped = 0;
  for (const entry of entries) {
    const mapped = animeScheduleToMedia(entry);
    if (mapped) media.push(mapped);
    else skipped++;
  }
  log.push(
    `AnimeSchedule returned ${entries.length} anime for ${seasonSlug}` +
      (skipped ? `, ${skipped} skipped (no AniList id to key them by)` : "")
  );
  // Same adult-content exclusion the AniList path applies.
  return media.filter((m) => !m.genres?.some((g) => /^(hentai|erotica)$/i.test(g)));
}

async function upsertAnimeFromAniList(
  media: AniListMedia[],
  seasonSlug: string,
  log: string[],
  overrides: Map<number, { day?: string; time?: string }> = new Map()
): Promise<{ added: number; updated: number }> {
  const existing = await db.select({
    anilistId: anime.anilistId, slug: anime.slug, episodes: anime.episodes, season: anime.season,
    synopsis: anime.synopsis, banner: anime.banner, image: anime.image, trailer: anime.trailer,
    studio: anime.studio, genres: anime.genres, startDate: anime.startDate, day: anime.day,
    titleRomaji: anime.titleRomaji, titleEnglish: anime.titleEnglish,
  }).from(anime).where(isNotNull(anime.anilistId));
  const existingMap = new Map(existing.map((e) => [e.anilistId, e]));
  let added = 0;
  let updated = 0;

  for (const m of media) {
    const ex = existingMap.get(m.id);
    if (ex) {
      const updates: Record<string, unknown> = {};
      if (m.episodes && m.episodes !== ex.episodes) updates.episodes = m.episodes;
      if (overrides.has(m.id) && ex.season !== seasonSlug) updates.season = seasonSlug;

      // Backfill only. A row created from the AnimeSchedule fallback has no
      // synopsis, banner or trailer, and may have no premiere date yet; this fills
      // those in once a source that has them shows up (normally AniList coming back
      // from an outage). It never overwrites a value that is already there, so
      // manual corrections and per-platform overrides survive untouched.
      const fill = (column: string, current: unknown, incoming: unknown) => {
        const isEmpty = current === null || current === undefined || current === "" ||
          (Array.isArray(current) && current.length === 0);
        const hasValue = incoming !== null && incoming !== undefined && incoming !== "" &&
          !(Array.isArray(incoming) && incoming.length === 0);
        if (isEmpty && hasValue) updates[column] = incoming;
      };
      fill("synopsis", ex.synopsis, cleanDescription(m.description));
      fill("banner", ex.banner, m.bannerImage);
      fill("image", ex.image, m.coverImage?.extraLarge ?? m.coverImage?.large);
      fill("trailer", ex.trailer, m.trailer?.site === "youtube" ? m.trailer.id : null);
      fill("studio", ex.studio, m.studios?.nodes?.[0]?.name);
      fill("genres", ex.genres, m.genres);
      fill("titleRomaji", ex.titleRomaji, m.title.romaji);
      fill("titleEnglish", ex.titleEnglish, m.title.english);
      const incomingStart = formatStartDate(m.startDate);
      fill("startDate", ex.startDate, incomingStart);
      // `day` is only derived when the row has no day at all — a manual or
      // uzurea-sourced weekday must not be recomputed from the premiere date.
      if (!ex.day && incomingStart) fill("day", ex.day, getDayOfWeek(incomingStart));

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = new Date();
        await db.update(anime).set(updates).where(eq(anime.anilistId, m.id));
        updated++;
        const fields = Object.keys(updates).filter((k) => k !== "updatedAt").join(", ");
        log.push(`UPDATED: ${m.title.native ?? m.title.romaji} (${fields})`);
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
      const res = await anilistFetch(EXTERNAL_LINKS_QUERY, { id: entry.anilistId });
      if (!res.ok) {
        if (anilistDown) {
          log.push(`AniList fallback: aborted, AniList unavailable (${anilistDownReason})`);
          break;
        }
        await sleep(1500);
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

    const res = await anilistFetch(AIRING_QUERY, { id: entry.anilistId });
    if (!res.ok) {
      if (anilistDown) {
        log.push(`Step 3: aborted, AniList unavailable (${anilistDownReason})`);
        break;
      }
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
  // One bucket listing instead of a HEAD per key: with ~430 anime and several
  // variant widths for cover and banner, the per-key checks were thousands of
  // round trips and the single largest cost of the run.
  const existingKeys = await listExistingKeys();
  log.push(`Step 4: ${existingKeys.size} objects already on R2, ${entries.length} anime to check`);
  let uploaded = 0;

  for (const entry of entries) {
    if (!entry.anilistId) continue;
    const anilistId = entry.anilistId;

    // Runs even for images already on R2: the call is a no-op once every variant
    // exists, and backfills the ones mirrored before variants were introduced.
    if (entry.image) {
      try {
        const sourceUrl = entry.image.startsWith("/")
          ? `https://s3.anilist.co/media/anime/cover/large/b${anilistId}.jpg`
          : entry.image;
        const { url, uploadedObjects } = await uploadImageWithVariants("cover", String(anilistId), sourceUrl, existingKeys);
        if (url !== entry.image) {
          await db.update(anime).set({ image: url, updatedAt: new Date() }).where(eq(anime.id, entry.id));
        }
        uploaded += uploadedObjects;
      } catch (err) {
        log.push(`IMG ERROR: cover for ${anilistId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (entry.banner) {
      try {
        const sourceUrl = entry.banner.startsWith("/")
          ? `https://s3.anilist.co/media/anime/banner/${anilistId}.jpg`
          : entry.banner;
        const { url, uploadedObjects } = await uploadImageWithVariants("banner", String(anilistId), sourceUrl, existingKeys);
        if (url !== entry.banner) {
          await db.update(anime).set({ banner: url, updatedAt: new Date() }).where(eq(anime.id, entry.id));
        }
        uploaded += uploadedObjects;
      } catch (err) {
        log.push(`IMG ERROR: banner for ${anilistId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  return uploaded;
}

// --- Step 5: Translate synopses to Japanese (DeepL) ---

// Idempotent: translates every anime with an English synopsis but no Japanese one.
// Covers both newly inserted anime and the backfill of pre-existing rows.
async function translateSynopses(log: string[]): Promise<number> {
  if (!process.env.DEEPL_API_KEY) {
    log.push("Step 5: DEEPL_API_KEY not set, skipping synopsis translation");
    return 0;
  }

  const pending = await db
    .select({ id: anime.id, title: anime.title, synopsis: anime.synopsis })
    .from(anime)
    .where(and(isNotNull(anime.synopsis), isNull(anime.synopsisJa)));

  log.push(`Step 5: ${pending.length} synopses pending translation`);

  let translated = 0;
  for (const entry of pending) {
    if (!entry.synopsis) continue;
    // Synopsis is already Japanese (AniList had no English): use it verbatim
    // instead of running EN→JA, which would corrupt it.
    if (isJapanese(entry.synopsis)) {
      await db.update(anime)
        .set({ synopsisJa: entry.synopsis, updatedAt: new Date() })
        .where(eq(anime.id, entry.id));
      translated++;
      log.push(`KEPT JA: ${entry.title}`);
      continue;
    }
    try {
      const ja = await translateToJapanese(entry.synopsis);
      await db.update(anime)
        .set({ synopsisJa: ja, updatedAt: new Date() })
        .where(eq(anime.id, entry.id));
      translated++;
      log.push(`TRANSLATED: ${entry.title}`);
    } catch (err) {
      // 456 = quota exceeded, 429 = rate limited: stop, retry next run.
      if (err instanceof DeepLError && (err.status === 456 || err.status === 429)) {
        log.push(`DeepL limit hit (${err.status}), stopping translation step`);
        break;
      }
      log.push(`TRANSLATE ERROR: ${entry.title}: ${err instanceof Error ? err.message : String(err)}`);
    }
    await sleep(500);
  }

  log.push(`Step 5: ${translated} synopses translated`);
  return translated;
}

// --- Main ---

async function main() {
  const stepArg = process.argv.find((a) => a.startsWith("--step="));
  const steps = stepArg ? stepArg.replace("--step=", "").split(",").map(Number) : [1, 2, 3, 4, 5];
  const seasonArg = process.argv.find((a) => a.startsWith("--season="));

  const now = new Date();
  const syncSeasons = seasonArg
    ? parseSeasonArg(seasonArg.replace("--season=", ""))
    : getSyncSeasons(now);
  // ALWAYS_INCLUDE_ANIME is re-tagged with the season it is currently airing in.
  // A lookahead season has not started, so it must never claim those entries.
  const airingSlug = getCurrentSeason(now).slug;

  const log: string[] = [];
  const errors: string[] = [];
  // Steps that produced data, but through a fallback source rather than the
  // primary one. Not a failure — the data is there — but worth surfacing.
  const degraded: string[] = [];
  const bySeason: Record<string, Record<string, unknown>> = {};
  const results: Record<string, unknown> = {
    seasons: syncSeasons.map((s) => s.slug),
    steps,
    timestamp: now.toISOString(),
  };

  // Every step reads from a different source (AniList, uzurea, R2, DeepL). One
  // source being down must not cost us the work the others can still do, so a
  // failing step is recorded and the run continues; the exit code at the end
  // still marks the run as failed.
  // The JSON result only lands at the very end, so a run killed by the job timeout
  // used to print nothing at all and left no clue where it had got to. These lines
  // go out as they happen, and stay in the Actions log even when the run is killed.
  function progress(line: string): void {
    const mins = ((Date.now() - now.getTime()) / 60000).toFixed(1);
    console.error(`[+${mins}m] ${line}`);
  }

  async function runStep(name: string, fn: () => Promise<void>): Promise<void> {
    progress(`${name} started`);
    try {
      await fn();
      progress(`${name} finished`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${name}: ${message}`);
      log.push(`!!! ${name} FAILED: ${message}`);
      progress(`${name} FAILED: ${message}`);
    }
  }

  function seasonResults(slug: string): Record<string, unknown> {
    bySeason[slug] ??= {};
    return bySeason[slug];
  }

  if (steps.includes(1)) {
    for (const info of syncSeasons) {
      await runStep(`Step 1 (${info.slug})`, async () => {
        const lookahead = info.slug === airingSlug ? "" : " [lookahead]";
        log.push(`--- Step 1: Fetch ${info.season} ${info.year}${lookahead} ---`);

        let source = "anilist";
        let seasonalMedia: AniListMedia[];
        try {
          seasonalMedia = await fetchSeasonalAnime(info.season, info.year);
          log.push(`AniList seasonal returned ${seasonalMedia.length} anime`);
        } catch (err) {
          // Step 1 is the only step that can create anime rows, so an AniList
          // outage would otherwise mean a whole season never enters the DB. Fall
          // back rather than fail: the rows land keyed by the same anilistId, and
          // the fields AnimeSchedule has no answer for (synopsis, banner, trailer)
          // are backfilled by upsertAnimeFromAniList on a later run.
          const reason = err instanceof Error ? err.message : String(err);
          log.push(`AniList unavailable (${reason}) — falling back to AnimeSchedule.net`);
          seasonalMedia = await fetchSeasonalFromAnimeSchedule(info.slug, log);
          source = "animeschedule";
          degraded.push(`Step 1 (${info.slug}) used AnimeSchedule.net: ${reason}`);
        }

        const media = [...seasonalMedia];
        const overrides = new Map<number, { day?: string; time?: string }>();
        if (info.slug === airingSlug) {
          const extraIds = ALWAYS_INCLUDE_ANIME.map((e) => e.id)
            .filter((id) => !seasonalMedia.some((m) => m.id === id));
          // Always-include titles are AniList-only lookups; skip them when it is down
          // rather than fail the step that just succeeded through the fallback.
          if (source === "anilist") {
            const extraMedia = await fetchAnimeByIds(extraIds);
            log.push(`AniList always-include returned ${extraMedia.length} anime`);
            media.push(...extraMedia);
          } else if (extraIds.length > 0) {
            log.push(`Skipping ${extraIds.length} always-include anime: AniList is down`);
          }
          for (const e of ALWAYS_INCLUDE_ANIME) overrides.set(e.id, { day: e.day, time: e.time });
        }

        const { added, updated } = await upsertAnimeFromAniList(media, info.slug, log, overrides);
        Object.assign(seasonResults(info.slug), { source, newAnime: added, metadataUpdated: updated });
      });
    }
  }

  if (steps.includes(2)) {
    for (const info of syncSeasons) {
      await runStep(`Step 2 (${info.slug})`, async () => {
        log.push(`--- Step 2: Extract platform data (${info.slug}) ---`);
        const platformEntries = await fetchPlatformData(info.slug, log);
        const platformsMatched = await matchAndUpsertPlatforms(platformEntries, log);
        seasonResults(info.slug).platformsMatched = platformsMatched;
      });

      await runStep(`Step 2b (${info.slug})`, async () => {
        log.push(`--- Step 2b: AniList fallback for missing platforms (${info.slug}) ---`);
        const fallbackFilled = await fillMissingPlatformsFromAniList(info.slug, log);
        seasonResults(info.slug).platformsFallback = fallbackFilled;
      });
    }
  }

  if (steps.includes(3)) {
    await runStep("Step 3", async () => {
      log.push(`--- Step 3: Sync episodes ---`);
      results.episodesUpdated = await syncEpisodes(log);
    });
  }

  if (steps.includes(4)) {
    await runStep("Step 4", async () => {
      log.push(`--- Step 4: Upload images to R2 ---`);
      results.imagesUploaded = await uploadImages(log);
    });
  }

  if (steps.includes(5)) {
    await runStep("Step 5", async () => {
      log.push(`--- Step 5: Translate synopses (DeepL) ---`);
      results.synopsesTranslated = await translateSynopses(log);
    });
  }

  if (anilistDown) log.push(`AniList was unavailable during this run (${anilistDownReason})`);

  const success = errors.length === 0;
  if (degraded.length > 0) log.push(`Run completed in degraded mode: ${degraded.join("; ")}`);
  console.log(JSON.stringify({ success, degraded, ...results, bySeason, errors, log }, null, 2));
  // A partial run is still a failed run: keep the workflow red so the failure is
  // visible, even though the steps that could run did run.
  if (!success) process.exit(1);
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
