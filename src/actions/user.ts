"use server";

import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, droppedAnime, userPlatformPreferences } from "@/lib/schema";
import { eq } from "drizzle-orm";

async function getUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function updateUserName(name: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) throw new Error("Not authenticated");

  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 100) {
    throw new Error("Name must be between 1 and 100 characters");
  }

  await db.update(users).set({ name: trimmed }).where(eq(users.id, userId));
}

export async function deleteAccount(): Promise<void> {
  const userId = await getUserId();
  if (!userId) throw new Error("Not authenticated");

  // Delete user data (cascades handle accounts table, but explicit for user-data tables)
  await db.delete(droppedAnime).where(eq(droppedAnime.userId, userId));
  await db.delete(userPlatformPreferences).where(eq(userPlatformPreferences.userId, userId));
  await db.delete(users).where(eq(users.id, userId));

  await signOut({ redirect: false });
}
