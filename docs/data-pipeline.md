# Data Pipeline (ETL) — PaoPaoAnime

## Overview

Anime data goes through a multi-stage pipeline: manual JSON entry, enrichment via external APIs, and migration to PostgreSQL. Each script adds a specific layer of data and can be run independently.

```
Manual JSON → Enrich (AniList) → Add Platforms → Download Images → Translate → Migrate to DB
```

All scripts live in `/scripts/` and are run with `npx tsx scripts/<name>.ts`.

---

## Pipeline Stages

### Stage 1 — Base Data

Data starts as a manually created JSON file in `/data/`, one per season (e.g., `winter-2026.json`). Each entry contains the minimum: title, day, time, startDate, and platforms.

```json
{
  "title": "葬送のフリーレン 2nd Season",
  "day": "土",
  "time": "00:00",
  "startDate": "2025-04-05",
  "type": "見放題",
  "platforms": ["dmmtv", "abema", "danime"]
}
```

**Why manual?** Per-platform schedule data (day + time per streaming service) is not available in any public API. It's collected from each platform's official website.

For movies/OVAs, `fetch-seasonal-movies.ts` can bootstrap entries from AniList instead of manual entry.

---

### Stage 2 — Enrichment

#### `enrich.ts`
Queries AniList GraphQL API to add metadata.

| Field Added | Source |
|-------------|--------|
| `anilistId` | AniList media ID |
| `titleRomaji` | Romanized title |
| `titleEnglish` | English title |
| `synopsis` | English synopsis (HTML cleaned) |
| `genres` | Genre array |
| `episodes` | Total episode count |
| `studio` | Animation studio name |
| `image` | Cover image URL |
| `format` | TV, MOVIE, OVA, ONA, SPECIAL, TV_SHORT |

- **Input:** `data/<season>.json`
- **Output:** Same file, updated in-place
- **API:** AniList GraphQL (`https://graphql.anilist.co`)
- **Rate limit:** 1.5s delay between requests
- **Matching:** Searches by full title, falls back to simplified title (removes season suffixes like 第2期)
- **Usage:** `npx tsx scripts/enrich.ts [filename]`

#### `add-format.ts`
Fills in missing `format` fields from AniList for entries that have `anilistId` but no format.

- **Usage:** `npx tsx scripts/add-format.ts [filename]`

#### `fetch-banners.ts`
Fetches banner image URLs from AniList for entries missing them.

- **Usage:** `npx tsx scripts/fetch-banners.ts`

---

### Stage 3 — Platform Schedules

Platform data is added via scripts with hardcoded arrays (collected manually from each platform's website).

#### `add-platforms.ts`
Adds dAnime Store, ABEMA, and Netflix schedules.

#### `add-unext.ts`
Adds U-NEXT schedules.

Both scripts:
- **Match by title** using normalized fuzzy matching (removes whitespace, punctuation, season info)
- **Add to `streams` array** with per-platform day/time
- **Update `platforms` array** for backward compatibility
- **Report** matched/unmatched entries for verification

```json
{
  "streams": [
    { "platform": "abema", "day": "土", "time": "00:00" },
    { "platform": "netflix", "day": "金", "time": "00:00" },
    { "platform": "dmmtv", "day": "土", "time": "00:00" }
  ]
}
```

> DMM TV, Amazon Prime Video, and Disney+ schedules are added directly in the base JSON.

---

### Stage 4 — Assets

#### `download-images.ts`
Downloads cover and banner images from external CDNs to `public/img/` and rewrites URLs in JSON to local paths.

- **Output paths:** `public/img/cover/<anilistId>.jpg`, `public/img/banner/<anilistId>.jpg`
- **Skips** already-downloaded images
- **Usage:** `npx tsx scripts/download-images.ts [filename]`

---

### Stage 5 — Translation

#### `translate-synopsis.ts`
Translates English synopses to Japanese using OpenAI API.

- **Detection:** Identifies English text by ASCII character ratio (>70%)
- **Batching:** Processes 10 entries per API call for efficiency
- **Model:** `gpt-4o-mini`
- **Output:** Populates `synopsisJa` field
- **Usage:** `OPENAI_API_KEY=... npx tsx scripts/translate-synopsis.ts [filename]`

---

### Stage 6 — Episode Sync (Maintenance)

#### `sync-episodes.ts` (legacy — JSON files)
Keeps episode calculations accurate by comparing with AniList's actual airing data.

- **Calculates** expected episode number from start date + weekly schedule
- **Compares** with AniList's `nextAiringEpisode`
- **Sets `episodeOffset`** when there's drift (e.g., recap episodes, delays)
- **Detects pauses:** Sets `pausedUntil` when next episode is >9 days away
- **Cleans up:** Removes offset/pause fields when anime finishes airing
- **Rate limit:** 1.5s delay + 60s backoff on 429 errors
- **Usage:** `npx tsx scripts/sync-episodes.ts [filename]`

#### `API: /api/cron/sync-episodes` (fallback — episode sync only)
Vercel Cron that syncs only episode offsets. Replaced by the unified pipeline below.

- **Auth:** Protected by `CRON_SECRET` Bearer token

---

### Stage 7 — Database Migration

#### `migrate-to-db.ts` (legacy — initial load)
One-time migration from JSON files to PostgreSQL. Replaced by the automated pipeline for ongoing updates.

- **Usage:** `npx tsx scripts/migrate-to-db.ts`

---

## Automated Pipeline (Weekly Cron)

### `API: /api/cron/sync-anime`

Unified weekly cron that replaces all manual scripts. Runs every Sunday at 21:00 UTC (Monday 06:00 JST).

| Step | What it does | Source |
|------|-------------|--------|
| 1. Fetch seasonal anime | Queries AniList for current season, inserts new anime to DB | AniList GraphQL API |
| 2. Extract platforms | Crawls animebb.jp, uses Claude Haiku to extract platform data, matches to DB | animebb.jp + Anthropic API |
| 3. Sync episodes | Updates `episodeOffset` and `pausedUntil` from AniList airing data | AniList GraphQL API |
| 4. Upload images | Downloads covers/banners from AniList CDN, uploads to Cloudflare R2 | AniList CDN → Cloudflare R2 |

- **Auth:** `CRON_SECRET` Bearer token
- **Config:** `vercel.json` → `crons` array
- **Env vars:** `DATABASE_URL`, `CRON_SECRET`, `ANTHROPIC_API_KEY`, `CLOUDFLARE_*` (R2)
- **Response:** JSON with counts of new anime, matched platforms, updated episodes, uploaded images

---

## Legacy Scripts

The scripts in `/scripts/` were used for the initial data pipeline. They still work against JSON files but are no longer needed for ongoing maintenance — the cron handles everything.

```
enrich.ts               Add AniList metadata
add-platforms.ts        Add dAnime, ABEMA, Netflix schedules (hardcoded arrays)
add-unext.ts            Add U-NEXT schedules (hardcoded arrays)
add-format.ts           Fill missing format fields
fetch-banners.ts        Fetch banner images
download-images.ts      Download images to local filesystem
translate-synopsis.ts   Translate synopses to Japanese
sync-episodes.ts        Sync episode offsets from AniList
migrate-to-db.ts        Insert JSON data into PostgreSQL
fetch-seasonal-movies.ts  Fetch movies/OVAs from AniList
```

---

## Data Flow Diagram

```
                    ┌─────────────┐
                    │  Manual JSON │
                    │  (base data) │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  enrich.ts   │◄──── AniList GraphQL API
                    │  (metadata)  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──────┐ ┌──▼────────┐ ┌─▼──────────────┐
       │add-platforms │ │ add-unext │ │ fetch-banners   │
       │  (schedules) │ │(schedule) │ │ add-format      │
       └──────┬──────┘ └──┬────────┘ └─┬──────────────┘
              │            │            │
              └────────────┼────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──────┐ ┌──▼──────────┐
       │download-imgs │ │ translate   │◄──── OpenAI API
       │  (localize)  │ │ (synopsis)  │
       └──────┬──────┘ └──┬──────────┘
              │            │
              └─────┬──────┘
                    │
             ┌──────▼──────┐
             │migrate-to-db │───► Neon PostgreSQL
             │  (final load)│
             └──────────────┘

                    ⟳
             ┌──────────────┐
             │sync-episodes  │◄──── AniList API (periodic)
             │  (maintenance)│
             └──────────────┘
```

---

## JSON File Structure

Each `data/<season>.json` contains an array of anime entries:

```typescript
interface AnimeEntry {
  title: string              // Japanese title (required)
  day: string                // Broadcast day: 月火水木金土日
  time: string | null        // Broadcast time (HH:MM)
  startDate: string          // Start date (YYYY-MM-DD)
  type: string               // "見放題" (subscription) or "レンタル" (rental)
  platforms: string[]        // Platform IDs (legacy format)
  streams: Stream[]          // Per-platform schedule (preferred format)
  // — Added by enrich.ts —
  anilistId?: number
  titleRomaji?: string
  titleEnglish?: string
  synopsis?: string
  synopsisJa?: string
  genres?: string[]
  episodes?: number
  studio?: string
  image?: string
  banner?: string
  format?: string            // TV, MOVIE, OVA, ONA, SPECIAL, TV_SHORT
  trailer?: string           // YouTube video ID
  // — Added by sync-episodes.ts —
  episodeOffset?: number
  episodeStart?: number
  pausedUntil?: string
  batchRelease?: boolean
}

interface Stream {
  platform: string           // dmmtv, netflix, abema, amazon, danime, disney, unext, theater
  day: string | null         // May differ from main anime day
  time: string | null        // May differ from main anime time
}
```
