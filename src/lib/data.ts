import { AnimeEntry, DayOfWeek } from "./types";

function toSlug(entry: { titleRomaji?: string; title: string; anilistId?: number }): string {
  const base = entry.titleRomaji || entry.title;
  const slug = base
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  // If slug is empty (pure Japanese title, no romaji), use anilistId or hash
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

export function getAnimeData(): AnimeEntry[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = require("../../data/winter-2026.json");
  return raw.map((entry: Omit<AnimeEntry, "slug">) => ({
    ...entry,
    slug: toSlug(entry),
  }));
}

export const DAYS: DayOfWeek[] = ["月", "火", "水", "木", "金", "土", "日"];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  月: "月曜日",
  火: "火曜日",
  水: "水曜日",
  木: "木曜日",
  金: "金曜日",
  土: "土曜日",
  日: "日曜日",
};

export function getAnimeByDay(): Record<DayOfWeek, AnimeEntry[]> {
  const data = getAnimeData();
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

export function getAnimeBySlug(slug: string): AnimeEntry | undefined {
  return getAnimeData().find((a) => a.slug === slug);
}
