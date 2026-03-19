import { AnimeEntry, DayOfWeek } from "./types";

const DAY_TO_NUMBER: Record<DayOfWeek, number> = {
  日: 0,
  月: 1,
  火: 2,
  水: 3,
  木: 4,
  金: 5,
  土: 6,
};

export type RecentEpisode = {
  anime: AnimeEntry;
  episode: number;
  airedAt: Date;
};

export function getRecentEpisodes(
  animeList: AnimeEntry[],
  now: Date = new Date()
): RecentEpisode[] {
  const episodes: RecentEpisode[] = [];

  for (const anime of animeList) {
    const startDate = new Date(anime.startDate + "T00:00:00+09:00");
    if (startDate > now) continue;

    // Batch releases (e.g. Netflix drops): all episodes available from startDate
    if (anime.batchRelease) {
      episodes.push({
        anime,
        episode: anime.episodes ?? 1,
        airedAt: startDate,
      });
      continue;
    }

    const dayNum = DAY_TO_NUMBER[anime.day];
    const [hours, minutes] = anime.time
      ? anime.time.split(":").map(Number)
      : [0, 0];

    // Find the most recent air date for this anime
    // Walk back from today to find the last occurrence of this weekday
    const recent = new Date(now);
    recent.setHours(hours, minutes, 0, 0);

    const currentDayNum = recent.getDay();
    let diff = currentDayNum - dayNum;
    if (diff < 0) diff += 7;
    // If same day but hasn't aired yet, go back a week
    if (diff === 0 && recent > now) diff = 7;

    recent.setDate(recent.getDate() - diff);

    // Don't include if before start date
    if (recent < startDate) continue;

    // Calculate episode number
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weeksSinceStart = Math.floor(
      (recent.getTime() - startDate.getTime()) / msPerWeek
    );
    const episode = weeksSinceStart + 1;

    if (episode < 1) continue;
    // Skip if anime has finished
    if (anime.episodes && episode > anime.episodes) continue;

    episodes.push({ anime, episode, airedAt: recent });
  }

  // Sort by most recent first
  episodes.sort((a, b) => b.airedAt.getTime() - a.airedAt.getTime());

  return episodes;
}
