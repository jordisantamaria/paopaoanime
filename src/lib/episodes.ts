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

function calcEpisodeForSchedule(
  startDate: string,
  day: DayOfWeek,
  time: string | null,
  episodeStart: number,
  episodeOffset: number,
  now: Date
): { episode: number; airedAt: Date } | null {
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
  const weeksSinceStart = Math.floor(
    (recent.getTime() - start.getTime()) / msPerWeek
  );
  const episode = weeksSinceStart + episodeStart + episodeOffset;

  if (episode < 1) return null;

  return { episode, airedAt: recent };
}

export function getRecentEpisodes(
  animeList: AnimeEntry[],
  now: Date = new Date()
): RecentEpisode[] {
  const episodes: RecentEpisode[] = [];

  for (const anime of animeList) {
    const startDate = new Date(anime.startDate + "T00:00:00+09:00");
    if (startDate > now) continue;

    // Skip anime on pause
    if (anime.pausedUntil && new Date(anime.pausedUntil + "T00:00:00+09:00") > now) continue;

    // Batch releases (e.g. Netflix drops): all episodes available from startDate
    if (anime.batchRelease) {
      episodes.push({
        anime,
        episode: anime.episodes ?? 1,
        airedAt: startDate,
      });
      continue;
    }

    const episodeStart = anime.episodeStart ?? 1;
    const episodeOffset = anime.episodeOffset ?? 0;

    // Calculate episode per platform schedule, take the LOWEST among those that
    // have already published at least one episode. Platforms that haven't published
    // yet (result is null) are ignored — we show what's available, not what isn't.
    let best: { episode: number; airedAt: Date } | null = null;

    const platformSchedules = (anime.streams ?? []).filter((s) => s.day);
    if (platformSchedules.length > 0) {
      for (const stream of platformSchedules) {
        const result = calcEpisodeForSchedule(
          anime.startDate,
          stream.day,
          stream.time,
          episodeStart,
          episodeOffset,
          now
        );
        if (!result) continue; // Platform hasn't published yet — skip
        if (!best || result.episode < best.episode) {
          best = result;
        }
      }
    }

    // Fallback to anime's main day/time (TV broadcast) if no platform schedules
    if (!best && anime.day) {
      best = calcEpisodeForSchedule(
        anime.startDate,
        anime.day,
        anime.time,
        episodeStart,
        episodeOffset,
        now
      );
    }

    if (!best) continue;

    // Cap at max episodes
    const maxEpisode = anime.episodes
      ? anime.episodes + episodeStart - 1
      : null;
    if (maxEpisode && best.episode > maxEpisode) continue;

    episodes.push({ anime, episode: best.episode, airedAt: best.airedAt });
  }

  // Sort by most recent first
  episodes.sort((a, b) => b.airedAt.getTime() - a.airedAt.getTime());

  return episodes;
}
