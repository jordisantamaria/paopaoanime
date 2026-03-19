import fs from "fs";
import path from "path";

/**
 * Fetches movies, OVAs, specials, and ONAs for a given season from AniList
 * and merges them into the existing seasonal JSON file.
 *
 * Usage: npx tsx scripts/fetch-seasonal-movies.ts winter 2026
 */

const DATA_DIR = path.join(__dirname, "..", "data");
const ANILIST_URL = "https://graphql.anilist.co";

const SEASON_QUERY = `
query ($season: MediaSeason, $seasonYear: Int, $page: Int, $formats: [MediaFormat]) {
  Page(page: $page, perPage: 50) {
    pageInfo {
      hasNextPage
      currentPage
    }
    media(season: $season, seasonYear: $seasonYear, type: ANIME, format_in: $formats, sort: POPULARITY_DESC, countryOfOrigin: "JP") {
      id
      format
      title {
        native
        romaji
        english
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
      startDate {
        year
        month
        day
      }
      status
    }
  }
}
`;

function cleanDescription(desc: string | null): string | undefined {
  if (!desc) return undefined;
  return desc
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n\(Source:.*\)/, "")
    .trim();
}

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function formatStartDate(startDate: { year: number; month: number; day: number }): string {
  if (!startDate?.year) return "未定";
  const y = startDate.year;
  const m = String(startDate.month ?? 1).padStart(2, "0");
  const d = String(startDate.day ?? 1).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getDayOfWeek(dateStr: string): string {
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const date = new Date(dateStr + "T00:00:00+09:00");
  return days[date.getDay()];
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(season: string, year: number, page: number) {
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: SEASON_QUERY,
      variables: {
        season: season.toUpperCase(),
        seasonYear: year,
        page,
        formats: ["MOVIE", "OVA", "SPECIAL", "ONA"],
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`AniList API error: ${res.status}`);
  }

  const json = await res.json();
  return json.data?.Page;
}

async function main() {
  const season = process.argv[2] ?? "winter";
  const year = parseInt(process.argv[3] ?? "2026");
  const filename = `${season}-${year}.json`;
  const filepath = path.join(DATA_DIR, filename);

  // Load existing data
  let existing: any[] = [];
  if (fs.existsSync(filepath)) {
    existing = JSON.parse(fs.readFileSync(filepath, "utf-8"));
  }

  const existingIds = new Set(existing.map((e) => e.anilistId).filter(Boolean));
  const existingSlugs = new Set(existing.map((e) => e.slug || toSlug(e.title)));

  console.log(`Fetching ${season.toUpperCase()} ${year} movies/OVAs/specials/ONAs from AniList...\n`);
  console.log(`Existing entries: ${existing.length} (${existingIds.size} with AniList IDs)\n`);

  let allMedia: any[] = [];
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    console.log(`Fetching page ${page}...`);
    const result = await fetchPage(season, year, page);
    if (!result?.media) break;

    allMedia = allMedia.concat(result.media);
    hasNext = result.pageInfo.hasNextPage;
    page++;
    await sleep(1500);
  }

  console.log(`\nFound ${allMedia.length} entries from AniList\n`);

  const newEntries: any[] = [];

  for (const media of allMedia) {
    // Skip hentai
    if (media.genres?.includes("Hentai")) {
      console.log(`SKIP (hentai): ${media.title.native || media.title.romaji}`);
      continue;
    }

    // Skip if already exists
    if (existingIds.has(media.id)) {
      console.log(`SKIP (exists): ${media.title.native || media.title.romaji}`);
      continue;
    }

    const title = media.title.native || media.title.romaji;
    const slug = toSlug(title);

    if (existingSlugs.has(slug)) {
      console.log(`SKIP (slug exists): ${title}`);
      continue;
    }

    const startDateStr = formatStartDate(media.startDate);
    const day = startDateStr !== "未定" ? getDayOfWeek(startDateStr) : "土"; // default to Saturday

    const entry = {
      title,
      slug,
      day,
      time: null,
      startDate: startDateStr,
      type: "見放題" as const,
      platforms: [] as string[],
      format: media.format, // MOVIE, OVA, SPECIAL, ONA
      anilistId: media.id,
      image: media.coverImage?.large,
      synopsis: cleanDescription(media.description),
      titleRomaji: media.title.romaji,
      titleEnglish: media.title.english,
      genres: media.genres,
      episodes: media.episodes,
      studio: media.studios?.nodes?.[0]?.name,
    };

    newEntries.push(entry);
    console.log(`ADD: [${media.format}] ${title} (${media.title.romaji})`);
  }

  if (newEntries.length === 0) {
    console.log("\nNo new entries to add.");
    return;
  }

  const merged = [...existing, ...newEntries];
  fs.writeFileSync(filepath, JSON.stringify(merged, null, 2), "utf-8");
  console.log(`\nAdded ${newEntries.length} new entries. Total: ${merged.length}`);
  console.log(`Wrote to ${filepath}`);
  console.log(`\nNote: New entries have empty platforms[]. Run add-platforms scripts to populate them.`);
}

main().catch(console.error);
