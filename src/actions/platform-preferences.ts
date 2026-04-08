"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userPlatformPreferences } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { PlatformId } from "@/lib/types";
import { PLATFORM_ORDER } from "@/lib/constants";

async function getUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function getPlatformPreferences(): Promise<PlatformId[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const row = await db
    .select({ platforms: userPlatformPreferences.platforms })
    .from(userPlatformPreferences)
    .where(eq(userPlatformPreferences.userId, userId))
    .limit(1);

  if (row.length === 0) return [];

  // Filter out any invalid platform IDs that may have been stored
  const valid = new Set<string>(PLATFORM_ORDER);
  return row[0].platforms.filter((p): p is PlatformId => valid.has(p));
}

export async function savePlatformPreferences(platforms: PlatformId[]): Promise<void> {
  const userId = await getUserId();
  if (!userId) throw new Error("Not authenticated");

  // Validate all platform IDs
  const valid = new Set<string>(PLATFORM_ORDER);
  const filtered = platforms.filter((p) => valid.has(p));

  if (filtered.length === 0) {
    // Remove preferences if empty
    await db
      .delete(userPlatformPreferences)
      .where(eq(userPlatformPreferences.userId, userId));
    return;
  }

  await db
    .insert(userPlatformPreferences)
    .values({ userId, platforms: filtered, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userPlatformPreferences.userId,
      set: { platforms: filtered, updatedAt: new Date() },
    });
}
