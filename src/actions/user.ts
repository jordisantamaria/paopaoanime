"use server";

import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, droppedAnime, userPlatformPreferences } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function deleteAccount(): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  // Delete user data (cascades handle accounts table, but explicit for user-data tables)
  await db.delete(droppedAnime).where(eq(droppedAnime.userId, userId));
  await db.delete(userPlatformPreferences).where(eq(userPlatformPreferences.userId, userId));
  await db.delete(users).where(eq(users.id, userId));

  await signOut({ redirect: false });
}
