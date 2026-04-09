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

  // Calculate the first publication date on this platform
  // = first occurrence of `day` on or after startDate
  const firstPub = new Date(start);
  const startDayNum = firstPub.getDay();
  let daysUntilFirst = dayNum - startDayNum;
  if (daysUntilFirst < 0) daysUntilFirst += 7;
  firstPub.setDate(firstPub.getDate() + daysUntilFirst);
  firstPub.setHours(hours, minutes, 0, 0);

  if (firstPub > now) return null; // First episode not yet published on this platform

  // Find the most recent publication date
  const recent = new Date(now);
  recent.setHours(hours, minutes, 0, 0);

  const currentDayNum = recent.getDay();
  let diff = currentDayNum - dayNum;
  if (diff < 0) diff += 7;
  if (diff === 0 && recent > now) diff = 7;
  recent.setDate(recent.getDate() - diff);

  if (recent < firstPub) return null;

  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksSinceFirst = Math.floor(
    (recent.getTime() - firstPub.getTime()) / msPerWeek
  );
  const episode = weeksSinceFirst + episodeStart + episodeOffset;

  if (episode < 1) return null;

  return { episode, airedAt: recent };
}

export function getRecentEpisodes(
  animeList: AnimeEntry[],
  now: Date = new Date(),
  platformFilter?: string[],
  platformPreferences?: string[]
): RecentEpisode[] {
  const episodes: RecentEpisode[] = [];

  for (const anime of animeList) {
    const startDate = new Date(anime.startDate + "T00:00:00+09:00");
    if (startDate > now) continue;

    // Skip anime on pause
    if (anime.pausedUntil && new Date(anime.pausedUntil + "T00:00:00+09:00") > now) continue;

    // If platform filter is active, skip anime not on those platforms
    if (platformFilter && platformFilter.length > 0) {
      if (!anime.platforms.some((p) => platformFilter.includes(p))) continue;
    }

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

    // When filtering by platform, use only that platform's schedule.
    // When user has platform preferences, use the best-preferred platform's schedule.
    // Otherwise use all platforms and take the lowest (most conservative).
    let best: { episode: number; airedAt: Date } | null = null;

    const allStreams = (anime.streams ?? []).filter((s) => s.day);

    // Determine which streams to use based on filter/preferences
    let relevantStreams: typeof allStreams;
    let usePreferredMode = false;

    if (platformFilter && platformFilter.length > 0) {
      relevantStreams = allStreams.filter((s) => platformFilter.includes(s.platform));
    } else if (platformPreferences && platformPreferences.length > 0) {
      // Find the highest-priority preferred platform this anime is on
      const preferredStream = platformPreferences
        .map((pref) => allStreams.find((s) => s.platform === pref))
        .find((s) => s !== undefined);
      if (preferredStream) {
        relevantStreams = [preferredStream];
        usePreferredMode = true;
      } else {
        relevantStreams = allStreams;
      }
    } else {
      relevantStreams = allStreams;
    }

    if (relevantStreams.length > 0) {
      for (const stream of relevantStreams) {
        const result = calcEpisodeForSchedule(
          anime.startDate,
          stream.day,
          stream.time,
          episodeStart,
          episodeOffset,
          now
        );
        if (!result) continue;
        if (platformFilter && platformFilter.length > 0) {
          // With filter: take the highest among selected platforms
          if (!best || result.episode > best.episode) {
            best = result;
          }
        } else {
          // Without filter (or with preferences): take the lowest (conservative)
          if (!best || result.episode < best.episode) {
            best = result;
          }
        }
      }
    }

    // If preferred platform has no episode yet, fall back to any available stream
    if (!best && usePreferredMode && allStreams.length > 0) {
      for (const stream of allStreams) {
        const result = calcEpisodeForSchedule(
          anime.startDate,
          stream.day,
          stream.time,
          episodeStart,
          episodeOffset,
          now
        );
        if (!result) continue;
        if (!best || result.episode < best.episode) {
          best = result;
        }
      }
    }

    // Fallback to anime's main day/time only when NO platform filter is active
    if (!best && anime.day && (!platformFilter || platformFilter.length === 0)) {
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
