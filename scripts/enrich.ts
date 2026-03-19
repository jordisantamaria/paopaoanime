import fs from "fs";
import path from "path";

const DATA_DIR = path.join(__dirname, "..", "data");
const INPUT = path.join(DATA_DIR, "winter-2026.json");
const OUTPUT = path.join(DATA_DIR, "winter-2026.json");

const ANILIST_URL = "https://graphql.anilist.co";

const QUERY = `
query ($search: String) {
  Media(search: $search, type: ANIME) {
    id
    format
    title {
      romaji
      english
      native
    }
    coverImage {
      large
    }
    description(asHtml: false)
    genres
    episodes
    studios(isMain: true) {
      nodes {
        name
      }
    }
  }
}
`;

type RawEntry = {
  title: string;
  day: string;
  time: string | null;
  startDate: string;
  type: string;
  platforms: string[];
  anilistId?: number;
  image?: string;
  synopsis?: string;
  titleRomaji?: string;
  titleEnglish?: string;
  genres?: string[];
  episodes?: number;
  studio?: string;
  format?: string;
};

async function searchAniList(title: string) {
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { search: title } }),
  });

  if (!res.ok) {
    console.warn(`  AniList error for "${title}": ${res.status}`);
    return null;
  }

  const json = await res.json();
  return json.data?.Media ?? null;
}

function cleanDescription(desc: string | null): string | undefined {
  if (!desc) return undefined;
  return desc
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n\(Source:.*\)/, "")
    .trim();
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const raw: RawEntry[] = JSON.parse(fs.readFileSync(INPUT, "utf-8"));

  console.log(`Enriching ${raw.length} anime entries...\n`);

  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];

    if (entry.anilistId && entry.image) {
      console.log(`[${i + 1}/${raw.length}] SKIP ${entry.title} (already enriched)`);
      continue;
    }

    console.log(`[${i + 1}/${raw.length}] Searching: ${entry.title}`);

    // Try full title first, then simplified (remove parenthetical suffixes, season info)
    let media = await searchAniList(entry.title);

    if (!media) {
      const simplified = entry.title
        .replace(/[（(][^）)]*[）)]/g, "")  // remove （第2期） etc
        .replace(/第\d+期/, "")
        .replace(/第\d+クール/, "")
        .replace(/\d+nd Season/, "")
        .replace(/Season\s*\d+/, "")
        .replace(/シーズン\d+/, "")
        .replace(/\s*～.*～\s*$/, "")       // remove trailing ～subtitle～
        .replace(/\s*ご褒美Ver\.?/, "")
        .trim();

      if (simplified !== entry.title && simplified.length > 0) {
        console.log(`  Retrying with: ${simplified}`);
        await sleep(1500);
        media = await searchAniList(simplified);
      }
    }

    if (media) {
      entry.anilistId = media.id;
      entry.format = media.format; // TV, MOVIE, OVA, SPECIAL, ONA, MUSIC
      entry.image = media.coverImage?.large;
      entry.synopsis = cleanDescription(media.description);
      entry.titleRomaji = media.title?.romaji;
      entry.titleEnglish = media.title?.english;
      entry.genres = media.genres;
      entry.episodes = media.episodes;
      entry.studio = media.studios?.nodes?.[0]?.name;
      console.log(`  -> Found: ${media.title.romaji}`);
    } else {
      console.log(`  -> NOT FOUND`);
    }

    // AniList rate limit: 90 req/min — use 1.5s to be safe
    await sleep(1500);
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(raw, null, 2), "utf-8");
  console.log(`\nDone! Wrote enriched data to ${OUTPUT}`);
}

main().catch(console.error);
