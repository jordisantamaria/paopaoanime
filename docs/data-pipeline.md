# Data Pipeline — PaoPaoAnime

## Overview

Anime data is refreshed by a single automated job that writes directly to PostgreSQL.
There is no manual JSON-entry step and no per-script data files: a weekly cron fetches
everything from external sources and upserts it into the database.

```
GitHub Actions (weekly)
  → scripts/sync-anime.ts
      Step 1  AniList        → seasonal anime + metadata
              ↳ fallback: AnimeSchedule.net when AniList is down
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
> There is no second implementation. An HTTP variant of this pipeline lived at
> `src/app/api/cron/sync-anime/route.ts`, but nothing ever triggered it (`vercel.json`
> declares no `crons`) and it drifted two fixes behind the script, so it was removed.

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
- **Backoff budget.** The breaker only catches a clean outage — the first ladder that
  exhausts itself against a permanent failure trips it. A *flapping* AniList never
  produces that signal: calls keep succeeding here and there, so no ladder ever reaches
  a verdict, and every flap costs up to 5.5 min of sleeping. That is what consumed the
  30 minutes of the 2026-09-13 run. A run may now spend at most 10 minutes total asleep
  waiting for AniList; past that the breaker opens regardless. Measured against a server
  failing 2 of every 3 requests: 60 calls took the equivalent of 61 minutes before,
  and stop at the 10-minute budget now. The time spent is reported as
  `anilistBackoffMin`.

With the breaker plus step isolation, an AniList outage still leaves Step 2 (uzurea),
Step 4 (R2 images) and Step 5 (DeepL) to run normally.

### Step 1 fallback: AnimeSchedule.net

Surviving an outage is not enough for Step 1: it is the only step that can *create*
anime rows, so while AniList is down a whole season cannot enter the DB at all. When
the AniList seasonal query fails, Step 1 falls back to
[AnimeSchedule.net](https://animeschedule.net) (`src/lib/animeschedule.ts`).

What makes AnimeSchedule usable where Kitsu or Jikan are not: each entry carries its
AniList URL in `websites.aniList`, so rows are created under the same `anilistId` the
schema keys on. No schema change, no duplicates, and AniList data merges on top later.
Entries without that link are skipped (3 of 88 for fall 2026) — there would be no way
to reconcile them afterwards.

What it does not have, and how that resolves:

| Field | Fallback | Resolution |
|---|---|---|
| `synopsis` | absent — the API has no synopsis at all | Backfilled when AniList returns; Step 5 then translates it |
| `banner`, `trailer` | absent | Backfilled when AniList returns |
| `episodes` | only some titles early in a season | Backfilled; Step 3 also keeps it current |
| `startDate` | ~15 of 88 unset a month out (`0001-01-01` sentinel) | Backfilled as AnimeSchedule confirms them |

The backfill is in `upsertAnimeFromAniList`: for a row that already exists it fills
columns that are empty from whatever the current source provides, and **never**
overwrites a value that is already set. Manual corrections and per-platform overrides
therefore survive it. `day` is only derived from the premiere date when the row has no
weekday at all.

`jpnTime` is deliberately unused. It looks like a broadcast slot, but checked against
currently-airing shows its weekday disagreed with `premier` (a title premiering on a
Saturday carrying a Tuesday `jpnTime`), so `day` is derived from the premiere date as
on the AniList path and the real per-platform schedule keeps coming from uzurea.

A run that fell back is **not** a failure: the data is there. It reports `success: true`
with the reason listed under `degraded[]`, and `bySeason.<slug>.source` says which
source produced the rows.

**Token.** AnimeSchedule's documented endpoints want a Bearer token from a registered
application, passed as `ANIMESCHEDULE_TOKEN`. Without it the same path still answers as
an undocumented "public" endpoint with harsher rate limits and no stability guarantee —
workable as a stopgap, not as the steady state. Their terms also require crediting them
in the app; that credit is the `about.dataSources` line on the /about page.

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
| `CRON_SECRET` | GitHub Actions + Vercel | Bearer token the workflow sends to `/api/revalidate` |
| `ANIMESCHEDULE_TOKEN` | GitHub Actions | Optional. Bearer token for AnimeSchedule.net's documented API; without it the Step 1 fallback uses their rate-limited public endpoint |
