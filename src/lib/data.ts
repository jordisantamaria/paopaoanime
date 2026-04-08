import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { anime, animePlatforms } from "./schema";
import { AnimeEntry, DayOfWeek, PlatformId } from "./types";
import { DAYS, NON_TV_FORMATS, PLATFORM_ORDER } from "./constants";

export { DAYS } from "./constants";
export { DAY_LABELS } from "./constants";

function sortByPlatformOrder<T extends { platform: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ia = PLATFORM_ORDER.indexOf(a.platform as PlatformId);
    const ib = PLATFORM_ORDER.indexOf(b.platform as PlatformId);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

function rowToAnimeEntry(
  row: typeof anime.$inferSelect,
  platforms: (typeof animePlatforms.$inferSelect)[]
): AnimeEntry {
  const sorted = sortByPlatformOrder(platforms);
  return {
    title: row.title,
    slug: row.slug,
    day: row.day as DayOfWeek,
    time: row.time,
    startDate: row.startDate ?? "",
    type: row.type as "見放題" | "レンタル",
    platforms: sorted.map((p) => p.platform as PlatformId),
    format: row.format as AnimeEntry["format"],
    anilistId: row.anilistId ?? undefined,
    image: row.image ?? undefined,
    synopsis: row.synopsis ?? undefined,
    synopsisJa: row.synopsisJa ?? undefined,
    genres: row.genres ?? undefined,
    episodes: row.episodes ?? undefined,
    studio: row.studio ?? undefined,
    titleEnglish: row.titleEnglish ?? undefined,
    titleRomaji: row.titleRomaji ?? undefined,
    banner: row.banner ?? undefined,
    streams: sorted.map((p) => ({
      platform: p.platform as PlatformId,
      day: p.day as DayOfWeek,
      time: p.time,
    })),
    season: row.season,
    trailer: row.trailer ?? undefined,
    batchRelease: row.batchRelease ?? undefined,
    episodeOffset: row.episodeOffset ?? undefined,
    episodeStart: row.episodeStart ?? undefined,
    pausedUntil: row.pausedUntil ?? undefined,
  };
}

export async function getAnimeData(): Promise<AnimeEntry[]> {
  const allAnime = await db.select().from(anime);
  const allPlatforms = await db.select().from(animePlatforms);

  const platformsBySlug = new Map<string, (typeof animePlatforms.$inferSelect)[]>();
  for (const p of allPlatforms) {
    const list = platformsBySlug.get(p.animeSlug) ?? [];
    list.push(p);
    platformsBySlug.set(p.animeSlug, list);
  }

  return allAnime.map((row) =>
    rowToAnimeEntry(row, platformsBySlug.get(row.slug) ?? [])
  );
}

function isNonWeekly(anime: AnimeEntry): boolean {
  if (anime.batchRelease) return true;
  return !!anime.format && NON_TV_FORMATS.includes(anime.format);
}

export async function getAnimeByDay(): Promise<Record<DayOfWeek, AnimeEntry[]>> {
  const data = (await getAnimeData()).filter((a) => !isNonWeekly(a));
  const byDay = Object.fromEntries(
    DAYS.map((day) => [day, [] as AnimeEntry[]])
  ) as Record<DayOfWeek, AnimeEntry[]>;

  for (const a of data) {
    byDay[a.day]?.push(a);
  }

  for (const day of DAYS) {
    byDay[day].sort((a, b) => {
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    });
  }

  return byDay;
}

export async function getNonWeeklyAnime(): Promise<AnimeEntry[]> {
  const data = await getAnimeData();
  return data
    .filter(isNonWeekly)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export async function getAnimeBySlug(slug: string): Promise<AnimeEntry | undefined> {
  const [row] = await db.select().from(anime).where(eq(anime.slug, slug));
  if (!row) return undefined;

  const platforms = await db
    .select()
    .from(animePlatforms)
    .where(eq(animePlatforms.animeSlug, slug));

  return rowToAnimeEntry(row, platforms);
}
