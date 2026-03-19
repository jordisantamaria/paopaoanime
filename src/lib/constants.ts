import { AnimeFormat, DayOfWeek, PlatformId } from "./types";

// Ordered by number of anime (most → least)
export const PLATFORM_ORDER: PlatformId[] = [
  "dmmtv", "danime", "abema", "amazon", "unext", "netflix", "disney",
];

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

export const FORMAT_LABELS: Record<AnimeFormat, string> = {
  TV: "TV",
  TV_SHORT: "TV短編",
  MOVIE: "映画",
  OVA: "OVA",
  SPECIAL: "特別",
  ONA: "ONA",
  MUSIC: "MV",
};

export const NON_TV_FORMATS: AnimeFormat[] = ["MOVIE", "OVA", "SPECIAL", "MUSIC"];
