/**
 * Recover English synopses corrupted by an early DeepL step that wrote the
 * Japanese translation back into the `synopsis` column (overwriting AniList's
 * English). Re-fetches the English description from AniList by anilistId and
 * restores `synopsis`, clearing the degraded `synopsis_ja` so Step 5 can
 * regenerate it cleanly.
 *
 * Usage:
 *   npx tsx scripts/recover-synopsis.ts          # dry-run (report only)
 *   npx tsx scripts/recover-synopsis.ts --apply  # write changes to the DB
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, isNotNull } from "drizzle-orm";
import { anime } from "../src/lib/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

const ANILIST_URL = "https://graphql.anilist.co";
const APPLY = process.argv.includes("--apply");

const BY_ID_QUERY = `
query ($ids: [Int]) {
  Page(page: 1, perPage: 50) {
    media(id_in: $ids, type: ANIME) {
      id
      description(asHtml: false)
    }
  }
}
`;

const hasJa = (s: string | null | undefined) =>
  !!s && /[぀-ヿ㐀-䶿一-鿿]/.test(s);

function cleanDescription(desc: string | null): string | undefined {
  if (!desc) return undefined;
  return desc
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n\(Source:.*\)/, "")
    .trim();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchDescriptions(ids: number[]): Promise<Map<number, string | null>> {
  const map = new Map<number, string | null>();
  for (const ids50 of chunk(ids, 50)) {
    const res = await fetch(ANILIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: BY_ID_QUERY, variables: { ids: ids50 } }),
    });
    if (!res.ok) {
      if (res.status === 429) {
        console.error("Rate limited (429), waiting 60s...");
        await sleep(60000);
      }
      throw new Error(`AniList error: ${res.status}`);
    }
    const json = await res.json();
    const media: { id: number; description: string | null }[] = json.data?.Page?.media ?? [];
    for (const m of media) map.set(m.id, m.description);
    await sleep(1500);
  }
  return map;
}

async function main() {
  const rows = await db
    .select({ id: anime.id, anilistId: anime.anilistId, title: anime.title, synopsis: anime.synopsis })
    .from(anime)
    .where(isNotNull(anime.anilistId));

  const corrupted = rows.filter((r) => hasJa(r.synopsis) && r.anilistId);
  console.log(`${APPLY ? "APPLY" : "DRY-RUN"} — ${corrupted.length} corrupted rows with anilistId\n`);

  const descs = await fetchDescriptions(corrupted.map((r) => r.anilistId!));

  let restored = 0, stillJa = 0, missing = 0;
  for (const r of corrupted) {
    const raw = descs.get(r.anilistId!);
    const clean = cleanDescription(raw ?? null);
    if (!clean) {
      missing++;
      console.log(`MISSING  #${r.id} [${r.anilistId}] ${r.title} — AniList has no description`);
      continue;
    }
    if (hasJa(clean)) {
      // AniList's own description is Japanese (no English available). Restore the
      // authentic Japanese into both columns so the JA site shows it and Step 5
      // (EN→JA) skips the row instead of re-corrupting it.
      stillJa++;
      console.log(`JA-SRC   #${r.id} [${r.anilistId}] ${r.title} — restoring authentic Japanese`);
      if (APPLY) {
        await db.update(anime)
          .set({ synopsis: clean, synopsisJa: clean, updatedAt: new Date() })
          .where(eq(anime.id, r.id));
      }
      continue;
    }
    restored++;
    console.log(`RESTORE  #${r.id} [${r.anilistId}] ${r.title}`);
    console.log(`         → ${clean.slice(0, 90).replace(/\n/g, " ")}`);
    if (APPLY) {
      await db.update(anime)
        .set({ synopsis: clean, synopsisJa: null, updatedAt: new Date() })
        .where(eq(anime.id, r.id));
    }
  }

  console.log(`\nSummary: ${restored} restored (EN), ${stillJa} restored (authentic JA), ${missing} missing`);
  if (!APPLY) console.log("Dry-run only. Re-run with --apply to write changes.");
}
main();
