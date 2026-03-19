import "server-only";
import { AnimeEntry, DayOfWeek } from "./types";
import { DAYS, NON_TV_FORMATS } from "./constants";

function toSlug(entry: {
  titleRomaji?: string;
  title: string;
  anilistId?: number;
}): string {
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

function loadAllSeasons(): AnimeEntry[] {
  // Dynamic require to avoid bundling fs in client
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path");

  const dataDir = path.join(process.cwd(), "data");
  const files = fs.readdirSync(dataDir).filter((f: string) => f.endsWith(".json"));

  const allEntries: AnimeEntry[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf-8"));
    const season = file.replace(".json", "");

    for (const entry of raw) {
      const withSlug = { ...entry, slug: toSlug(entry), season };
      if (!seen.has(withSlug.slug)) {
        seen.add(withSlug.slug);
        allEntries.push(withSlug);
      }
    }
  }

  return allEntries;
}

export function getAnimeData(): AnimeEntry[] {
  return loadAllSeasons();
}

export { DAYS } from "./constants";
export { DAY_LABELS } from "./constants";

/** Returns true if the anime doesn't follow a weekly schedule */
function isNonWeekly(anime: AnimeEntry): boolean {
  if (anime.batchRelease) return true;
  return !!anime.format && NON_TV_FORMATS.includes(anime.format);
}

export function getAnimeByDay(): Record<DayOfWeek, AnimeEntry[]> {
  const data = getAnimeData().filter((a) => !isNonWeekly(a));
  const byDay = Object.fromEntries(
    DAYS.map((day) => [day, [] as AnimeEntry[]])
  ) as Record<DayOfWeek, AnimeEntry[]>;

  for (const anime of data) {
    byDay[anime.day].push(anime);
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

export function getNonWeeklyAnime(): AnimeEntry[] {
  return getAnimeData()
    .filter(isNonWeekly)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export function getAnimeBySlug(slug: string): AnimeEntry | undefined {
  return getAnimeData().find((a) => a.slug === slug);
}
