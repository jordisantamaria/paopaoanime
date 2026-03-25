export type DayOfWeek = "月" | "火" | "水" | "木" | "金" | "土" | "日";

export type PlatformId = "dmmtv" | "netflix" | "abema" | "amazon" | "danime" | "disney" | "unext" | "theater";

export type AnimeFormat = "TV" | "TV_SHORT" | "MOVIE" | "OVA" | "SPECIAL" | "ONA" | "MUSIC";

export type AnimeEntry = {
  title: string;
  slug: string;
  day: DayOfWeek;
  time: string | null;
  startDate: string;
  type: "見放題" | "レンタル";
  platforms: PlatformId[];
  format?: AnimeFormat;
  anilistId?: number;
  image?: string;
  synopsis?: string;
  synopsisJa?: string;
  genres?: string[];
  episodes?: number;
  studio?: string;
  titleEnglish?: string;
  titleRomaji?: string;
  banner?: string;
  streams?: { platform: PlatformId; day: DayOfWeek; time: string | null }[];
  season?: string;
  trailer?: string;
  batchRelease?: boolean;
  episodeOffset?: number; // adjust episode count (e.g. -2 for skipped weeks)
  episodeStart?: number; // starting episode number for continuations (e.g. 25 for S3)
  pausedUntil?: string; // ISO date when anime resumes (e.g. "2026-04-03")
};

export type Platform = {
  id: PlatformId;
  name: string;
  color: string;
  url: string;
  searchUrl?: string;
};

export type Season = "winter" | "spring" | "summer" | "fall";
