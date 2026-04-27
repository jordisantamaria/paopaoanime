"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { favoriteAnime } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

async function getUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function getFavoriteSlugs(): Promise<string[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const rows = await db
    .select({ slug: favoriteAnime.animeSlug })
    .from(favoriteAnime)
    .where(eq(favoriteAnime.userId, userId));

  return rows.map((r) => r.slug);
}

export async function toggleFavorite(slug: string): Promise<{ favorited: boolean }> {
  const userId = await getUserId();
  if (!userId) throw new Error("Not authenticated");

  const existing = await db
    .select()
    .from(favoriteAnime)
    .where(and(eq(favoriteAnime.userId, userId), eq(favoriteAnime.animeSlug, slug)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .delete(favoriteAnime)
      .where(and(eq(favoriteAnime.userId, userId), eq(favoriteAnime.animeSlug, slug)));
    return { favorited: false };
  } else {
    await db.insert(favoriteAnime).values({ userId, animeSlug: slug });
    return { favorited: true };
  }
}
