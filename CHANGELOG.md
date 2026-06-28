# Changelog

## 2026-06-28

### feat: Track outbound clicks as Vercel Analytics custom events
- Added `src/components/outbound-link.tsx`, a client wrapper that fires `track("outbound_click", { destination, anime })` on click while keeping the existing `target="_blank"` / `rel="noopener noreferrer"` markup
- Used it for the YouTube CTA (`destination: "youtube"`) and the streaming-platform links (`destination: <platform id>`) on the anime detail page, tagging each event with the anime slug
- Measures the directory's real conversion (clicks out to YouTube/platforms) instead of relying on visits/bounce rate; enables per-title and per-destination ranking in the Vercel Analytics dashboard

## 2026-06-02

### feat: Add Vercel Web Analytics
- Added `@vercel/analytics` and mounted `<Analytics />` in the locale layout body to track anonymous, cookieless traffic (visitors, page views, referrers, country/device)
- Needs Web Analytics enabled in the Vercel project dashboard to start collecting

### chore: Clean up and document the migration runner
- Removed the legacy `ensureMigrationHistory()` seed from `scripts/migrate.ts`; it backfilled the pre-history `drizzle-kit push` migrations (`0000`–`0002`) into `__drizzle_migrations` and was a one-off that has long since run in every environment
- Added a header comment to `scripts/migrate.ts` explaining when it runs and what `migrate()` does
- Documented the migration strategy in `docs/database.md` (build-time auto-apply, programmatic `migrate()` over the CLI, how to add a migration) and brought the migrations table up to date (`0003`–`0005`)

### chore: Remove favorites feature
- Removed the favorite-anime functionality to simplify the site
- Deleted `src/actions/favorites.ts` (`getFavoriteSlugs` / `toggleFavorite` server actions)
- Removed the heart toggle buttons, favorite state, and favorite-bubbling sort from the home page (`home-content.tsx`); `page.tsx` no longer fetches favorite slugs
- Dropped the `favorite_anime` table from the schema and added migration `0005_drop_favorite_anime.sql` (`DROP TABLE favorite_anime CASCADE`)
- Removed `favoriteTitle` / `unfavoriteTitle` i18n keys and dropped "favorites" from the login `feature3Desc` copy (en + ja)

## 2026-06-01

### fix: Diamond no Ace act II not showing platforms or recent episodes
- `Diamond no Ace act II -Second Season-` (anilist 177634) had 0 `anime_platform` rows, so `isUnavailableForStreaming` hid it from both the "where it airs" block and the recent-episodes list, even though it has been airing since 2026-04-05
- Root cause: `normalize()` in `scripts/sync-anime.ts` couldn't match uzurea.net's title `ダイヤのA actⅡ Second Season` (Unicode roman numeral `Ⅱ` U+2161, no dashes) against our `ダイヤのA actII -Second Season-` (ASCII `II`, dashes), so the platform-matching step silently skipped it
- Fixed `normalize()` to fold Unicode roman numerals (`Ⅰ`–`Ⅻ` / `ⅰ`–`ⅻ`) to ASCII and strip dashes (`-‐‑‒–—―−`); the chōonpu `ー` is deliberately preserved. Both titles now normalize to `ダイヤのaactiisecondseason`. This also fixes any other anime affected by the same title patterns going forward
- Backfilled the 6 supported platforms uzurea lists for this title (amazon, danime, disney, dmmtv, netflix, unext) in both staging and production so it appears immediately instead of waiting for the Sunday sync. The next sync will fill per-platform schedules

### fix: Scope anime Data Cache to the current deployment
- `loadAnimeData` / `loadAnimeBySlug` are wrapped in `unstable_cache` (1h TTL, tag `anime-data`), but nothing ever calls `revalidateTag`, and Vercel's Data Cache persists across deployments. So out-of-band DB changes (and even the weekly cron's updates) could take up to an extra hour to surface, and a redeploy did not reliably refresh them
- Added `VERCEL_DEPLOYMENT_ID` (unique per deploy/redeploy, `"dev"` locally) to both cache keys. Each deployment now starts with a fresh cache, so a code deploy reflects current data immediately and a redeploy becomes a reliable way to pick up manual DB edits
- Trade-off: the first request after each deploy hits the DB (2 small queries) instead of inheriting the cross-deployment cache — negligible for this dataset

## 2026-05-31

### chore: Migrate remaining local images to R2 and delete `public/img`
- `public/img/banner` (50) and `public/img/cover` (114) were leftovers from the original "self-host images" seed. Their bytes were still in use: 50 banner + 111 cover rows in production (and equivalents in staging) had `image`/`banner` pointing at `/img/...`, so Next/Image served them from the static folder
- Migrated every remaining local row to Cloudflare R2 in **both** environments (staging + production), uploading the on-disk files directly and rewriting the DB to the `*.r2.dev` URL. Verified `0` local refs in each DB afterward (161 prod, 161 staging)
- Deleted `public/img/banner` and `public/img/cover` (164 files); `public/img` no longer exists
- Note: cron Step 4 `uploadImages()` could never have migrated these legacy rows — for `/img/...` paths it re-fetches from a *deterministic* AniList URL (`s3.anilist.co/.../{id}.jpg`) which 404s (real AniList URLs carry a hash). This is harmless going forward since new anime are inserted with real AniList image URLs (which Step 4 fetches fine), but the dead `/img/` branch in `route.ts` could be pruned later

### feat: Add "Watch on YouTube" link on YouTube-only anime detail pages
- Genkai anime (`season = "youtube"`) have no platform rows, so the "Available on" block never rendered — the synopsis said "available on YouTube" with no link
- The detail page now shows a "YouTube" link under "Available on" (same pattern as platform links) when `season === "youtube"` and a `trailer` (ep1 video ID) is present, pointing to `https://www.youtube.com/watch?v=<trailer>`
- Added `anime.youtube` i18n key (en + ja)

### chore: Remove one-off recover-synopsis script
- `scripts/recover-synopsis.ts` was a one-time repair for synopses corrupted by an early DeepL run. It has been applied, and the active pipeline's `isJapanese` guard prevents recurrence, so the script is dead code (still recoverable from git history in `a8f965e`)
- Removed its rows from `docs/architecture.md` and `docs/data-pipeline.md`; clarified `seed-genkai.ts` is re-runnable (idempotent), not one-off

### docs: Remove deprecated pipeline references from docs
- The `docs/` described an old JSON-file ETL pipeline that no longer exists. Audit confirmed code, README, ROADMAP, `package.json` and `.env.example` were already clean — only the docs were stale
- `data-pipeline.md`: rewritten around the real flow — a weekly **GitHub Actions** job (`scripts/sync-anime.ts`, Sun 21:00 UTC) running 5 idempotent steps (AniList → uzurea.net schedules → AniList fallback → episode sync → R2 images → DeepL synopses). Dropped ~10 nonexistent scripts (`enrich.ts`, `migrate-to-db.ts`, `translate-synopsis.ts`, …), the "Legacy Scripts" list, the legacy data-flow diagram, and the `data/*.json` structure section
- `architecture.md`: fixed the overview diagram and tech-stack table (translation engine **Anthropic → DeepL**; added R2 + GitHub Actions rows), rewrote the data-pipeline section, and corrected Project Structure to the real `scripts/` (4 files) and `src/` tree
- `database.md`: `synopsis_ja` now correctly states translation via **DeepL** (was Anthropic)
- Corrected the platform-schedule source to **uzurea.net** (the docs said animebb.jp / Claude Haiku; the code parses uzurea.net HTML with no LLM) and the runner to **GitHub Actions** (was "Vercel Cron")

### chore: Add MIT LICENSE file and license field in package.json
- Added a top-level `LICENSE` (MIT) and `"license": "MIT"` in `package.json` to match the README, which already declared MIT

### docs: Drop specific DeepL Free tier quota from README
- Removed the hardcoded "500,000 chars/month" figure (provider quotas change); kept the functional note that translation runs once per anime

## 2026-05-30

### fix: Resolve set-state-in-effect lint errors in CurrentEpisode and SearchBar
- `CurrentEpisode`: the current episode depends on `new Date()` and the detail page is statically generated, so it must be computed client-side. Replaced the `useEffect` + `setState` with `useSyncExternalStore` (server snapshot `null`, client snapshot computes the value) — no hydration mismatch, no setState-in-effect
- `SearchBar`: reset the keyboard selection (`activeIndex`) during render via the prev-value pattern instead of a `useEffect`, avoiding an extra commit
- Both were pre-existing `react-hooks/set-state-in-effect` errors unrelated to the image/search changes

### perf: Slim down the search payload sent to the client
- The `Header` (in the layout, so on every page) passed the full `AnimeEntry[]` to the client `SearchBar`, serializing all 190 anime with every field — synopsis EN+JA, genres, streams, etc. — into the payload of every page
- The search only needs 5 fields: new `SearchItem` type (`slug`, `title`, `titleRomaji`, `titleEnglish`, `image`); the Header maps to it before passing it down
- `getDisplayTitle` now accepts the lighter shape, so it works for both `AnimeEntry` and `SearchItem`
- Cuts the per-page search payload from ~150KB to ~25KB (uncompressed). Client-side instant search kept — correct for this catalog size; revisit toward a debounced server endpoint only past ~1-2k anime

### perf: Migrate all images to next/image
- Fixes Lighthouse's ~5.7MB image savings and the missing width/height (CLS) warnings: no component used `next/image` — every image was a raw `<img>` served full-size with no resize, WebP/AVIF, or lazy loading
- Migrated all 13 `<img>` usages (anime covers, banners, posters, search thumbnails, Google avatar, YouTube fallback, logo) to `next/image` — grid covers/banners use `fill` + `sizes`, fixed thumbnails/posters use explicit `width`/`height`
- Configured `next.config` `images.remotePatterns` for the R2 bucket (`*.r2.dev`), Google avatars (`lh3.googleusercontent.com`), and the YouTube thumbnail host (`img.youtube.com`)
- Header/login logo gets explicit dimensions + `priority`

### fix: Recover synopses corrupted by an early DeepL run + guard against recurrence
- 112/190 anime had Japanese in both `synopsis` (meant to be English) and `synopsis_ja`: an early, uncommitted version of the DeepL step translated EN→JA and wrote the result back into `synopsis`, overwriting AniList's English; the committed step then re-translated that Japanese into a degraded `synopsis_ja`
- New `scripts/recover-synopsis.ts` (dry-run by default, `--apply` to write): re-fetches the English `description` from AniList by `anilist_id`, restores `synopsis`, and clears `synopsis_ja` so Step 5 regenerates it cleanly. For the 1 title whose AniList description is itself Japanese (Frieren special), restores the authentic Japanese into both columns
- Restored 111 English synopses + 1 authentic Japanese; re-translated all 111 via DeepL
- Hardened Step 5 (`translateSynopses` in the cron route and the script): skip synopses that are already Japanese instead of feeding them to DeepL EN→JA, which would corrupt them — prevents recurrence for AniList JP-source titles

### feat: Add Genkai Anime (限界アニメ「松山あおい物語」) — YouTube-only, search-only
- Adds the indie YouTube anime by Matsuyama Aoi (the origin of the "paopao" name), one entry per season (S1–S5)
- Not on AniList: seeded manually with `anilist_id = NULL`, so the weekly sync cron never touches it (the cron only reads/iterates rows with an `anilist_id`)
- New `hidden` boolean column on `anime` (migration `0004`): entries are searchable and reachable by URL but excluded from the home and schedule listings — `getListableAnimeData()` and the schedule getters filter `hidden`, while search/detail/static-params keep showing it
- No `anime_platform` rows, so YouTube never appears as a streaming filter; `trailer` holds each season's first-episode YouTube video ID and the cover image is that video's thumbnail
- New idempotent `scripts/seed-genkai.ts` (upsert by slug); documented in `docs/data-pipeline.md` and `docs/database.md`

### perf: Cache anime data and pin function region to reduce navigation latency
- Fixes slow navigation introduced by the JSON→DB migration (logo→home, language switch): every navigation re-ran DB queries server-side
- `getAnimeData` was executed ~4× per request (Header in the layout + the page), each a separate `neon-http` round-trip to Neon in Singapore
- Wrap `getAnimeData`/`getAnimeBySlug` in React `cache()` (per-request dedup so Header and page share one call) + `unstable_cache` (cross-request Data Cache, hourly revalidate, `anime-data` tag for on-demand invalidation) — most navigations now hit zero DB queries
- Parallelize the anime + platforms selects in the cache-miss loader
- Pin Vercel functions to `sin1` (Singapore, next to Neon) via `vercel.json` so cache-miss and logged-in user queries no longer cross the planet

### feat: Japanese synopsis via DeepL translation
- Fixes the synopsis always showing in English on the Japanese site: `synopsis_ja` was always NULL (AniList only provides English descriptions), so the JA page fell back to English
- New DeepL client `src/lib/translate.ts` (`translateToJapanese`), auto-detecting Free (`:fx` key suffix) vs Pro endpoints
- New idempotent Step 5 in both `src/app/api/cron/sync-anime/route.ts` and `scripts/sync-anime.ts`: translates every row where `synopsis` is present and `synopsis_ja` is NULL — covers new anime and backfills existing ones
- Stops gracefully on DeepL quota/rate-limit (HTTP 456/429) and resumes on the next run; skipped entirely when `DEEPL_API_KEY` is unset
- Added `DEEPL_API_KEY` to `.env.example` and the GitHub Actions workflow secrets
- Updated `docs/data-pipeline.md` with the translation step and corrected stale env var list
- Documented DeepL setup, the `DEEPL_API_KEY` env var, and the `sync-anime.ts --step` commands in `README.md`

## 2026-04-29

### feat: Always-include long-running anime in seasonal sync
- New `ALWAYS_INCLUDE_ANIME` allowlist in both `src/app/api/cron/sync-anime/route.ts` and `scripts/sync-anime.ts`
- Added One Piece (AniList ID 21, 日 09:30 JST) to the allowlist
- New `BY_ID_QUERY` + `fetchAnimeByIds` to pull these by AniList ID alongside the seasonal fetch
- Existing rows from the allowlist get re-tagged with the current season slug each sync, so long-runners always appear in the current-season views
- First-time inserts respect optional `day`/`time` overrides so episode math is correct from the start

## 2026-04-27

### feat: Favorite anime
- New `favorite_anime` table (userId + animeSlug, cascading deletes from user/anime)
- Server actions `getFavoriteSlugs` and `toggleFavorite` in `src/actions/favorites.ts`
- Heart badge on home cards: filled red and always visible when favorited, hover-only outline when not
- Favorites bubble to the top of "最新エピソード" and "最新追加アニメ" so users can spot what they're currently watching at a glance
- Coexists with the existing drop (×) button on hover
- i18n keys for favorite/unfavorite tooltips (ja + en)

## 2026-04-16

### fix: AniList fallback for anime missing platform data
- Added Step 2b to sync pipeline: queries AniList `externalLinks` for anime that uzurea.net doesn't cover
- Maps AniList streaming site names (Netflix, Amazon, ABEMA, etc.) to internal platform IDs
- Runs automatically after uzurea scraping, only for anime with 0 platforms in current season
- Applied to both `scripts/sync-anime.ts` and `src/app/api/cron/sync-anime/route.ts`
- Hide "視聴可能" section on anime detail page when no platforms exist

## 2026-04-09

### feat: i18n support (English + Japanese)
- Added `next-intl` with URL-based locale routing (`/en/*` for English, `/*` for Japanese default)
- Extracted ~300 hardcoded Japanese strings into `messages/ja.json` and `messages/en.json`
- All pages moved under `[locale]` dynamic segment
- Middleware handles locale detection from Accept-Language header
- Locale switcher (JA/EN toggle) in the footer
- Localized metadata and SEO (hreflang alternate links, locale-specific titles/descriptions)
- Database content uses `titleEnglish`/`synopsis` for English, `title`/`synopsisJa` for Japanese
- Platform names, day labels, format labels all translated
- All internal links are locale-aware (preserve current locale on navigation)

### feat: User account management pages
- Settings page with tab navigation (General / Danger Zone)
- Change display name form in general settings
- Delete account with confirmation (type "削除" to confirm)
- Account deletion cascades all user data (drops, platform preferences)
- Settings link added to user dropdown menu

### feat: User platform preferences
- Logged-in users can configure their preferred streaming platforms in `/settings`
- Home page sorts anime by platform preference (preferred platforms first)
- Platform filter chips reordered to show preferred platforms first
- New `user_platform_preferences` table stores ordered platform list per user
- All platforms remain visible — preferences only affect sort order

## 2026-04-08

### feat: Unified weekly anime sync cron pipeline
- New `/api/cron/sync-anime` endpoint automating the full data pipeline
- Step 1: Detect new seasonal anime from AniList and insert into DB
- Step 2: Extract platform availability from uzurea.net via HTML parsing ($0/run, no LLM)
- Step 3: Sync episodeOffset, pausedUntil, and episode counts from AniList
- Step 4: Upload cover and banner images to Cloudflare R2
- Support `?step=1,2,3,4` query param for running individual steps
- Cron schedule: Sundays 21:00 UTC (Mondays 06:00 JST)
- Per-platform schedule extraction (day/time) from uzurea.net individual platform pages

### feat: Per-platform episode calculation
- Episode counts now based on streaming platform schedules, not TV broadcast
- Platform filter recalculates episodes using only the selected platform's schedule
- First publication date calculated per platform to avoid showing unavailable episodes
- Anime without platforms still appear in recent episodes

### feat: Consistent platform ordering
- Platforms always displayed in the same order: DMM TV → dAnime → ABEMA → Amazon → U-NEXT → Netflix → Disney+
- Applied across anime cards, detail pages, and platform chips

### fix: Home page improvements
- Fixed flash on load (episodes now calculated server-side, passed as prop)
- Theater-only filter no longer hides anime with no platforms assigned

### chore: Cloudflare R2 as image CDN
- Migrate images from local filesystem (`public/img/`) to Cloudflare R2
- R2 client with dedup (skips already-uploaded images via HeadObject)

### docs: Updated setup guide
- README with Cloudflare R2, CRON_SECRET setup instructions
- Documented `vercel env pull` workflow and Development environment gotcha
- Updated data-pipeline.md with automated pipeline documentation
