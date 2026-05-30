# Changelog

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
