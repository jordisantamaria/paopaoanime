/**
 * AnimeSchedule.net client — the fallback source for the sync's Step 1.
 *
 * AniList is the primary source, but it is a single point of failure and it does
 * go down for days at a time (403 "The AniList API has been temporarily disabled").
 * Step 1 is the only step that can create anime rows, so an AniList outage means a
 * whole season cannot enter the DB. AnimeSchedule covers the same seasonal listing
 * and, unlike other alternatives, links each title to its AniList page — which lets
 * rows keep the `anilistId` key the schema is built on.
 *
 * This module is transport only: fetching, paging and retrying. Mapping its shape
 * onto our domain lives in `scripts/sync-anime.ts` next to the AniList mapping.
 *
 * Attribution: AnimeSchedule.net's API terms require crediting them in the app.
 * That credit lives on the /about page (`about.dataSources`).
 */

const API_URL = "https://animeschedule.net/api/v3/anime";

// Their documented endpoints want a Bearer token from a registered application.
// Without one the same path still answers, but as an undocumented "public"
// endpoint with harsher rate limiting and no stability guarantee — fine as a
// stopgap, not as the steady state.
function authHeaders(): Record<string, string> {
  const token = process.env.ANIMESCHEDULE_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const BACKOFF_MS = [5000, 15000, 45000];

/** Page size is fixed by the API; used only to cap the paging loop. */
const MAX_PAGES = 40;

export interface AnimeScheduleEntry {
  title?: string;
  route?: string;
  names?: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
  } | null;
  /** ISO date. `0001-01-01T00:00:00Z` is their "unset" sentinel, not a real date. */
  premier?: string | null;
  episodes?: number | null;
  status?: string | null;
  mediaTypes?: { name: string }[] | null;
  genres?: { name: string }[] | null;
  studios?: { name: string }[] | null;
  /** Path under img.animeschedule.net, e.g. "anime/jpg/default/<route>-<hash>.jpg". */
  imageVersionRoute?: string | null;
  /** Cross-links to other databases; `aniList` is what makes this source usable. */
  websites?: Record<string, string> | null;
}

interface SeasonPage {
  page: number;
  totalAmount: number;
  anime: AnimeScheduleEntry[];
}

export class AnimeScheduleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnimeScheduleError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(seasonSlug: string, page: number): Promise<SeasonPage> {
  const url = `${API_URL}?seasons=${encodeURIComponent(seasonSlug)}&page=${page}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "PaoPaoAnime/1.0 (+https://paopaoanime.com)",
        ...authHeaders(),
      },
    });
    if (res.ok) {
      try {
        return (await res.json()) as SeasonPage;
      } catch {
        throw new AnimeScheduleError(`invalid JSON from ${url}`);
      }
    }
    // 429 is the likely one on the unauthenticated endpoint; 5xx is theirs.
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= BACKOFF_MS.length) {
      throw new AnimeScheduleError(`${res.status} ${res.statusText} for ${url}`);
    }
    await sleep(BACKOFF_MS[attempt]);
  }
}

/**
 * Every anime AnimeSchedule lists for a season, e.g. "fall-2026".
 * The slug is the same `<season>-<year>` shape the DB uses for `anime.season`.
 */
export async function fetchSeasonFromAnimeSchedule(
  seasonSlug: string,
): Promise<AnimeScheduleEntry[]> {
  const entries: AnimeScheduleEntry[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await fetchPage(seasonSlug, page);
    if (!data.anime?.length) break;
    entries.push(...data.anime);
    if (entries.length >= data.totalAmount) break;
    // Be a good citizen, especially on the unauthenticated endpoint.
    await sleep(1500);
  }
  return entries;
}

/** True when a date field carries their "unset" sentinel instead of a real date. */
export function isUnsetDate(value: string | null | undefined): boolean {
  return !value || value.startsWith("0001-01-01");
}

/** Extracts the AniList id from `websites.aniList` ("anilist.co/anime/159042/Slug"). */
export function anilistIdFromEntry(entry: AnimeScheduleEntry): number | null {
  const url = entry.websites?.aniList;
  if (!url) return null;
  const match = url.match(/anilist\.co\/anime\/(\d+)/);
  return match ? Number(match[1]) : null;
}

/** Absolute URL for an entry's cover image, or null when it has none. */
export function coverUrl(entry: AnimeScheduleEntry): string | null {
  if (!entry.imageVersionRoute) return null;
  return `https://img.animeschedule.net/production/assets/public/img/${entry.imageVersionRoute}`;
}
