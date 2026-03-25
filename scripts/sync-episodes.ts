import fs from "fs";
import path from "path";

/**
 * Syncs episodeOffset for all anime using AniList's nextAiringEpisode.
 * Compares our calculated episode number with AniList's actual number
 * and sets episodeOffset to correct any drift (skipped weeks, etc).
 *
 * Usage: npx tsx scripts/sync-episodes.ts [filename]
 * Example: npx tsx scripts/sync-episodes.ts winter-2026
 */

const DATA_DIR = path.join(__dirname, "..", "data");
const ANILIST_URL = "https://graphql.anilist.co";

const QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    nextAiringEpisode {
      episode
      airingAt
    }
  }
}
`;

const DAY_TO_NUMBER: Record<string, number> = {
  日: 0, 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6,
};

function calcEpisode(anime: any, now: Date): number | null {
  const startDate = new Date(anime.startDate + "T00:00:00+09:00");
  if (startDate > now) return null;
  if (anime.batchRelease) return null;

  const dayNum = DAY_TO_NUMBER[anime.day];
  if (dayNum === undefined) return null;

  const [hours, minutes] = anime.time
    ? anime.time.split(":").map(Number)
    : [0, 0];

  const recent = new Date(now);
  recent.setHours(hours, minutes, 0, 0);

  const currentDayNum = recent.getDay();
  let diff = currentDayNum - dayNum;
  if (diff < 0) diff += 7;
  if (diff === 0 && recent > now) diff = 7;
  recent.setDate(recent.getDate() - diff);

  if (recent < startDate) return null;

  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksSinceStart = Math.floor(
    (recent.getTime() - startDate.getTime()) / msPerWeek
  );
  return weeksSinceStart + 1; // raw episode without offset or episodeStart
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const file = process.argv[2] ?? "winter-2026";
  const filepath = path.join(DATA_DIR, `${file}.json`);
  const data = JSON.parse(fs.readFileSync(filepath, "utf-8"));

  const now = new Date();
  const airing = data.filter(
    (e: any) => e.anilistId && !e.batchRelease
  );

  console.log(`Syncing episodes for ${airing.length} anime...\n`);

  let updated = 0;

  for (let i = 0; i < airing.length; i++) {
    const anime = airing[i];
    const ourEpisode = calcEpisode(anime, now);
    if (ourEpisode === null) continue;

    const res = await fetch(ANILIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { id: anime.anilistId } }),
    });

    if (!res.ok) {
      if (res.status === 429) {
        console.log(`  Rate limited, waiting 60s...`);
        await sleep(60000);
        i--; // retry
        continue;
      }
      console.log(`  [${i + 1}] ${anime.title} -> Error: ${res.status}`);
      await sleep(1500);
      continue;
    }

    const json = await res.json();
    const next = json.data?.Media?.nextAiringEpisode;

    if (next) {
      // Detect pause: if next episode airs more than 9 days from now, anime is on break
      const airingAt = new Date(next.airingAt * 1000);
      const daysUntilNext = (airingAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

      if (daysUntilNext > 9) {
        const pauseDate = airingAt.toISOString().slice(0, 10);
        if (anime.pausedUntil !== pauseDate) {
          anime.pausedUntil = pauseDate;
          updated++;
          console.log(
            `  [${i + 1}] ${anime.title}: paused until ${pauseDate} (${Math.round(daysUntilNext)}d away)`
          );
        }
      } else if (anime.pausedUntil) {
        delete anime.pausedUntil;
        updated++;
        console.log(`  [${i + 1}] ${anime.title}: resumed (removed pausedUntil)`);
      }

      // nextAiringEpisode.episode is per-season (e.g. S3 ep 12)
      // So current per-season episode = next - 1
      // Our raw calc is weeksSinceStart + 1 (no episodeStart, no offset)
      // We need offset so that: rawEpisode + offset = per-season episode
      const actualEpisode = next.episode - 1;
      const neededOffset = actualEpisode - ourEpisode;

      if (neededOffset !== (anime.episodeOffset ?? 0)) {
        const old = anime.episodeOffset ?? 0;
        anime.episodeOffset = neededOffset === 0 ? undefined : neededOffset;
        updated++;
        console.log(
          `  [${i + 1}] ${anime.title}: offset ${old} -> ${neededOffset} (our: ${ourEpisode}, actual: ${actualEpisode})`
        );
      }
    } else {
      // No next episode = finished airing, remove offset and pause
      if (anime.pausedUntil) {
        delete anime.pausedUntil;
        updated++;
        console.log(`  [${i + 1}] ${anime.title}: removed pausedUntil (finished)`);
      }
      if (anime.episodeOffset) {
        delete anime.episodeOffset;
        updated++;
        console.log(`  [${i + 1}] ${anime.title}: removed offset (finished)`);
      }
    }

    await sleep(1500);
  }

  // Clean up undefined fields
  for (const anime of data) {
    if (anime.episodeOffset === undefined || anime.episodeOffset === 0) {
      delete anime.episodeOffset;
    }
    if (anime.pausedUntil === undefined) {
      delete anime.pausedUntil;
    }
  }

  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`\nDone! Updated ${updated} entries.`);
}

main().catch(console.error);
