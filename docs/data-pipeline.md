# Data Pipeline — PaoPaoAnime

## Overview

Anime data is refreshed by a single automated job that writes directly to PostgreSQL.
There is no manual JSON-entry step and no per-script data files: a weekly cron fetches
everything from external sources and upserts it into the database.

```
GitHub Actions (weekly)
  → scripts/sync-anime.ts
      Step 1  AniList        → seasonal anime + metadata
      Step 2  uzurea.net     → per-platform schedules
      Step 2b AniList        → fallback for anime still missing platforms
      Step 3  AniList        → episode offsets / pauses
      Step 4  AniList CDN     → Cloudflare R2 (covers, banners)
      Step 5  DeepL          → Japanese synopses
  → Neon PostgreSQL
```

All scripts live in `/scripts/` and run with `npx tsx scripts/<name>.ts`.

---

## How it runs

The pipeline runs as a **GitHub Actions** workflow, not a Vercel Cron:

- **Workflow:** `.github/workflows/sync-anime.yml`
- **Schedule:** `0 21 * * 0` — Sundays 21:00 UTC (Monday 06:00 JST). Also `workflow_dispatch` for manual runs.
- **Command:** `npx tsx scripts/sync-anime.ts`
- **Why GitHub Actions:** it runs as a plain Node script with a 30-min timeout, enough to cover the full sync (image uploads + translation) in one run.
- **Secrets (GitHub Actions):** `DATABASE_URL`, `DEEPL_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_R2_BUCKET_NAME`, `CLOUDFLARE_R2_PUBLIC_URL`

> `src/app/api/cron/sync-anime/route.ts` mirrors the same logic as a Vercel Function
> (protected by `CRON_SECRET`). It exists as an HTTP-triggerable variant; the scheduled
> runner of record is the GitHub Actions script above.

---

## Which seasons a run covers

Steps 1 and 2 are per-season. A run covers:

- the **current** season, derived from the month **in JST** (the cron fires at 21:00 UTC,
  which is already the next day in Japan — using the runner's UTC month would ask for the
  previous season on the last Sunday of a quarter), and
- the **upcoming** season, once it starts within `LOOKAHEAD_DAYS` (30). September runs
  therefore already pull `fall-<year>`.

The lookahead exists because a season's titles must be in the DB *before* its premieres.
Without it the sync only ever asked for the current calendar season, so the first fall run
was the first Sunday of October — days after the season had begun, with the premieres
missing from the site until then.

Entries pulled ahead have a `startDate` in the future. They are filtered out of the weekly
schedule grid (client-side, in `schedule-grid.tsx`) and of the home page's recent-episodes
and latest-anime lists until they premiere.

Two source-specific notes:

- **AniList** publishes a complete seasonal listing weeks ahead, so Step 1 gets everything
  on the first lookahead run.
- **uzurea** fills its season tag page in progressively: in early September the 2026 fall
  page already had 85 anime but only 15 with a platform list, and the per-month schedule
  pages (`.../amazon-primevideo-2026-10/`) 404 until close to the month. This is why the
  lookahead must run *every* week rather than once — each run picks up what uzurea has
  added, and `matchAndUpsertPlatforms` only writes a `day` when the stored one is null.

`ALWAYS_INCLUDE_ANIME` (One Piece and friends) is re-tagged with the **current** season
only — a lookahead season has not started and must not claim those long-running entries.

Override the resolution for a manual catch-up run:

```bash
npx tsx scripts/sync-anime.ts --season=fall-2026
npx tsx scripts/sync-anime.ts --season=fall-2026 --step=1,2
```

---

## AniList outage handling

AniList is the single point of failure of the pipeline and goes down for real: runs on
2026-08-02, 08-23 and 09-06 all died on `AniList error: 403`, whose body reads
*"The AniList API has been temporarily disabled due to severe stability issues."* — an
AniList-side outage, not the Cloudflare bot challenge the `User-Agent` header addresses.

`anilistFetch` handles both:

- Retries 403 / 429 / 5xx with a 15s / 45s / 90s / 180s backoff (429 waits 60s), long
  enough to ride out a short outage instead of giving up after 20 seconds.
- **Circuit breaker.** Steps 2b and 3 call AniList once per anime. Once a call has
  exhausted its retries against a server-side failure, `anilistDown` is set and every
  later call short-circuits, so the run does not burn its 30-minute budget replaying a
  known outage. 429 does not trip the breaker — that is our own request rate.
- The failure is logged with AniList's own error message, not just the status code.

With the breaker plus step isolation, an AniList outage still leaves Step 2 (uzurea),
Step 4 (R2 images) and Step 5 (DeepL) to run normally.

---

## Pipeline Steps

Each step is idempotent — a run can be repeated safely, and partial failures resume on the
next run. Steps can be run selectively: `npx tsx scripts/sync-anime.ts --step=1,2,5`.

A failing step no longer aborts the run: each one is isolated, its error is collected into
`errors[]`, and the remaining steps still execute. The process exits `1` if anything failed,
so a partial run still shows up red in GitHub Actions.

### Step 1 — Seasonal anime (AniList)

Queries the AniList GraphQL API (`https://graphql.anilist.co`) for each season in scope
(see [Which seasons a run covers](#which-seasons-a-run-covers)) and upserts new rows. Populates: `anilistId`, titles (`titleRomaji`, `titleEnglish`),
`synopsis` (English, HTML-cleaned), `genres`, `episodes`, `studio`, `format`, `image`,
`banner`, `trailer`.

### Step 2 — Platform schedules (uzurea.net)

Per-platform day/time is not in any public API, so it is scraped from **uzurea.net**'s
seasonal listing pages (one per platform: DMM TV, dAnime, ABEMA, Amazon, U-NEXT, Netflix,
Disney+) plus the season tag page. HTML is parsed with regex (`parseSchedulePage`) — no LLM.
Extracted `{title, day, time}` entries are fuzzy-matched to DB rows by normalized title and
written to the `anime_platform` join table.

### Step 2b — Platform fallback (AniList)

For anime still missing platform rows after Step 2, AniList's streaming-links data is used
as a fallback so the entry still shows where to watch.

### Step 3 — Episode sync (AniList)

Compares the expected episode number (start date + weekly cadence) against AniList's
`nextAiringEpisode` and sets `episodeOffset` on drift (recaps, delays) and `pausedUntil`
when the next episode is far out. Clears those fields when an anime finishes airing.

### Step 4 — Images (AniList CDN → Cloudflare R2)

Downloads covers and banners from AniList's CDN and uploads them to Cloudflare R2
(S3-compatible). Rewrites the DB `image` / `banner` URLs to the R2 public URLs. Skips
images already uploaded.

### Step 5 — Synopsis translation (DeepL)

Translates English `synopsis` to Japanese and stores it in `synopsis_ja`. Idempotent:
processes every row where `synopsis` is present and `synopsis_ja` is NULL (new anime +
backfill). Already-Japanese synopses are skipped (never re-fed to DeepL EN→JA). Stops
gracefully on DeepL quota / rate-limit (HTTP 456/429) and resumes next run. Skipped
entirely if `DEEPL_API_KEY` is unset. DeepL Free is auto-detected by the `:fx` key suffix.

---

## Scripts

The full set of scripts in `/scripts/`:

| Script | Purpose | Run by |
|--------|---------|--------|
| `sync-anime.ts` | The weekly pipeline (Steps 1–5 above) | GitHub Actions (weekly) / manual |
| `migrate.ts` | Applies Drizzle SQL migrations and seeds migration history | The Vercel build (`pnpm build`) / manual |
| `seed-genkai.ts` | Seeds manual (non-AniList) anime — see below | Manual, re-runnable (idempotent) |

### `migrate.ts`

Runs in the build (`"build": "tsx scripts/migrate.ts && next build"`), so schema changes
apply automatically on every deploy. Uses Drizzle's migrator against the `drizzle/` folder
and tracks applied migrations in `drizzle.__drizzle_migrations`. Can also be run locally:
`npx tsx --env-file=.env.local scripts/migrate.ts`.

---

## Manual Entries (outside AniList)

Some anime are not on AniList and cannot be enriched by the cron — e.g. indie / YouTube-only
works. These are seeded directly and carry `anilist_id = NULL`, so the weekly cron ignores
them entirely (it only reads/iterates rows that have an `anilist_id`).

### `seed-genkai.ts`

Seeds the Genkai Anime (限界アニメ「松山あおい物語」) seasons — an indie YouTube-only anime by
Matsuyama Aoi, one entry per season (S1–S5).

- **Usage:** `npx tsx --env-file=.env.local scripts/seed-genkai.ts` (idempotent — upserts by `slug`)
- **Prerequisite:** the `hidden` column migration must be applied first (`migrate.ts`, or any deploy build)
- Each entry: `hidden = true` (searchable + reachable by URL, but excluded from home/schedule
  listings), `season = "youtube"`, `batchRelease = true`, **no `anime_platform` rows** (so it
  never appears as a YouTube streaming filter), and `trailer` = the YouTube video ID of that
  season's first episode.

---

## Environment Variables

| Variable | Used by | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | all scripts | Neon PostgreSQL connection |
| `DEEPL_API_KEY` | Step 5 | DeepL translation (optional — Step 5 skipped if unset) |
| `CLOUDFLARE_ACCOUNT_ID` | Step 4 | R2 endpoint |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | Step 4 | R2 credentials |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Step 4 | R2 credentials |
| `CLOUDFLARE_R2_BUCKET_NAME` | Step 4 | R2 bucket |
| `CLOUDFLARE_R2_PUBLIC_URL` | Step 4 | Public base URL for stored images |
| `CRON_SECRET` | API route variant | Bearer token auth for `/api/cron/sync-anime` |
