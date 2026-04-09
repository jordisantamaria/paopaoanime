import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { anime } from "../src/lib/schema";
import { desc, inArray } from "drizzle-orm";


const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function main() {
  // Find the 10 most recently created anime
  const latest = await db
    .select({ id: anime.id, slug: anime.slug, title: anime.title })
    .from(anime)
    .orderBy(desc(anime.createdAt))
    .limit(10);

  if (latest.length === 0) {
    console.log("No anime to delete.");
    return;
  }

  console.log("Deleting these 10 anime:");
  for (const a of latest) {
    console.log(`  - [${a.id}] ${a.title} (${a.slug})`);
  }

  // Delete (anime_platform rows cascade automatically)
  const ids = latest.map((a) => a.id);
  await db.delete(anime).where(inArray(anime.id, ids));

  console.log(`\nDeleted ${latest.length} anime. Cron should re-add them.`);
}

main().catch(console.error);
