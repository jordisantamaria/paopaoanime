# Changelog

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
