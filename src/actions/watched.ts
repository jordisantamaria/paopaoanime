"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { watchedEpisodes } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

async function getUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function getWatchedEpisodes(slug: string): Promise<number[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const rows = await db
    .select({ episode: watchedEpisodes.episode })
    .from(watchedEpisodes)
    .where(
      and(eq(watchedEpisodes.userId, userId), eq(watchedEpisodes.animeSlug, slug)),
    );

  return rows.map((r) => r.episode).sort((a, b) => a - b);
}

export async function setWatchedEpisode(
  slug: string,
  episode: number,
  watched: boolean,
): Promise<{ watched: boolean }> {
  const userId = await getUserId();
  if (!userId) throw new Error("Not authenticated");

  if (watched) {
    await db
      .insert(watchedEpisodes)
      .values({ userId, animeSlug: slug, episode })
      .onConflictDoNothing();
    return { watched: true };
  }

  await db
    .delete(watchedEpisodes)
    .where(
      and(
        eq(watchedEpisodes.userId, userId),
        eq(watchedEpisodes.animeSlug, slug),
        eq(watchedEpisodes.episode, episode),
      ),
    );
  return { watched: false };
}

export async function toggleWatchedEpisode(
  slug: string,
  episode: number,
): Promise<{ watched: boolean }> {
  const userId = await getUserId();
  if (!userId) throw new Error("Not authenticated");

  const existing = await db
    .select()
    .from(watchedEpisodes)
    .where(
      and(
        eq(watchedEpisodes.userId, userId),
        eq(watchedEpisodes.animeSlug, slug),
        eq(watchedEpisodes.episode, episode),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .delete(watchedEpisodes)
      .where(
        and(
          eq(watchedEpisodes.userId, userId),
          eq(watchedEpisodes.animeSlug, slug),
          eq(watchedEpisodes.episode, episode),
        ),
      );
    return { watched: false };
  }

  await db.insert(watchedEpisodes).values({ userId, animeSlug: slug, episode });
  return { watched: true };
}
