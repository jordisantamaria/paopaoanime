# Changelog

## 2026-04-08

### feat: Unified weekly anime sync cron pipeline
- New `/api/cron/sync-anime` endpoint automating the full data pipeline
- Step 1: Detect new seasonal anime from AniList and insert into DB
- Step 2: Extract platform availability from animebb.jp via Claude Haiku (LLM)
- Step 3: Sync episodeOffset and pausedUntil from AniList airing data
- Step 4: Upload cover and banner images to Cloudflare R2
- Support `?step=1,2,3,4` query param for running individual steps
- Cron schedule: Sundays 21:00 UTC (Mondays 06:00 JST)

### chore: Cloudflare R2 as image CDN
- Migrate images from local filesystem (`public/img/`) to Cloudflare R2
- R2 client with dedup (skips already-uploaded images via HeadObject)

### docs: Updated setup guide
- README with Cloudflare R2, CRON_SECRET, and ANTHROPIC_API_KEY setup instructions
- Documented `vercel env pull` workflow and Development environment gotcha
- Updated data-pipeline.md with automated pipeline documentation
