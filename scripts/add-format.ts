import fs from "fs";
import path from "path";

/**
 * Adds the `format` field to existing entries by querying AniList by ID.
 * Usage: npx tsx scripts/add-format.ts winter-2026
 */

const DATA_DIR = path.join(__dirname, "..", "data");
const ANILIST_URL = "https://graphql.anilist.co";

const QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    format
  }
}
`;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const file = process.argv[2] ?? "winter-2026";
  const filepath = path.join(DATA_DIR, `${file}.json`);
  const entries = JSON.parse(fs.readFileSync(filepath, "utf-8"));

  const needsFormat = entries.filter((e: any) => e.anilistId && !e.format);
  console.log(`${needsFormat.length} entries need format field\n`);

  for (let i = 0; i < needsFormat.length; i++) {
    const entry = needsFormat[i];
    console.log(`[${i + 1}/${needsFormat.length}] ${entry.title}`);

    const res = await fetch(ANILIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { id: entry.anilistId } }),
    });

    if (res.ok) {
      const json = await res.json();
      const format = json.data?.Media?.format;
      if (format) {
        entry.format = format;
        console.log(`  -> ${format}`);
      }
    } else {
      console.log(`  -> Error: ${res.status}`);
    }

    await sleep(1500);
  }

  fs.writeFileSync(filepath, JSON.stringify(entries, null, 2), "utf-8");
  console.log(`\nDone! Updated ${filepath}`);
}

main().catch(console.error);
