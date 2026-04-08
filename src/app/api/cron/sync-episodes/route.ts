import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { anime } from "@/lib/schema";
import { eq, isNotNull, and, sql } from "drizzle-orm";

const ANILIST_URL = "https://graphql.anilist.co";

const ANILIST_QUERY = `
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

function calcRawEpisode(
  startDate: string,
  day: string,
  time: string | null,
  now: Date
): number | null {
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
  return weeksSinceStart + 1;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const airingAnime = await db
    .select()
    .from(anime)
    .where(
      and(
        isNotNull(anime.anilistId),
        eq(anime.batchRelease, false)
      )
    );

  const results: string[] = [];
  let updated = 0;

  for (let i = 0; i < airingAnime.length; i++) {
    const entry = airingAnime[i];
    if (!entry.day || !entry.startDate || !entry.anilistId) continue;

    const rawEpisode = calcRawEpisode(entry.startDate, entry.day, entry.time, now);
    if (rawEpisode === null) continue;

    const res = await fetch(ANILIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: ANILIST_QUERY,
        variables: { id: entry.anilistId },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) {
        results.push(`${entry.title}: rate limited, waiting 60s`);
        await sleep(60000);
        i--;
        continue;
      }
      results.push(`${entry.title}: AniList error ${res.status}`);
      await sleep(1500);
      continue;
    }

    const json = await res.json();
    const next = json.data?.Media?.nextAiringEpisode;

    const updates: { episodeOffset?: number; pausedUntil?: string | null } = {};

    if (next) {
      const airingAt = new Date(next.airingAt * 1000);
      const daysUntilNext =
        (airingAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

      // Detect pause
      if (daysUntilNext > 9) {
        const pauseDate = airingAt.toISOString().slice(0, 10);
        if (entry.pausedUntil !== pauseDate) {
          updates.pausedUntil = pauseDate;
          results.push(`${entry.title}: paused until ${pauseDate}`);
        }
      } else if (entry.pausedUntil) {
        updates.pausedUntil = null;
        results.push(`${entry.title}: resumed`);
      }

      // Sync episode offset
      const actualEpisode = next.episode - 1;
      const neededOffset = actualEpisode - rawEpisode;
      const currentOffset = entry.episodeOffset ?? 0;

      if (neededOffset !== currentOffset) {
        updates.episodeOffset = neededOffset;
        results.push(
          `${entry.title}: offset ${currentOffset} → ${neededOffset}`
        );
      }
    } else {
      // Finished airing — clean up
      if (entry.pausedUntil) {
        updates.pausedUntil = null;
        results.push(`${entry.title}: cleared pausedUntil (finished)`);
      }
      if (entry.episodeOffset && entry.episodeOffset !== 0) {
        updates.episodeOffset = 0;
        results.push(`${entry.title}: cleared offset (finished)`);
      }
    }

    if (Object.keys(updates).length > 0) {
      await db
        .update(anime)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(anime.id, entry.id));
      updated++;
    }

    await sleep(1500);
  }

  return NextResponse.json({
    success: true,
    checked: airingAnime.length,
    updated,
    details: results,
    timestamp: now.toISOString(),
  });
}
