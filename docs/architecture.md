# Architecture — PaoPaoAnime

## Overview

PaoPaoAnime is a streaming schedule aggregator for anime in Japan. It answers: "Which platform streams this anime and when does it air?"

```
Weekly cron (GitHub Actions → scripts/sync-anime.ts)
  → AniList API (seasonal anime, metadata, episodes)
  + uzurea.net (per-platform schedules)
  + DeepL (Japanese synopsis translation)
  + Cloudflare R2 (cover/banner images)
    → Neon PostgreSQL
      → Next.js App Router (Server Components + Server Actions)
        → UI with React + Tailwind CSS
```

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 16 (App Router) | SSR + SSG, Server Components, Server Actions |
| UI | React 19 + Tailwind CSS v4 | Rapid development, responsive design |
| Database | Neon PostgreSQL (serverless) | See [decision below](#why-neon-postgresql) |
| ORM | Drizzle ORM | Type-safe, lightweight, native SQL migrations |
| Auth | Auth.js v5 (NextAuth) | Google OAuth + email/password credentials |
| Deployment | Vercel | Native Next.js integration, preview deployments |
| Email | Resend | Password reset and email verification |
| Translation | DeepL API | Japanese synopsis translation |
| Image storage | Cloudflare R2 | Cover/banner hosting (S3-compatible) |
| Scheduled sync | GitHub Actions | Weekly data pipeline (no Vercel Function timeout) |

---

## Architecture Decisions

### Why Neon PostgreSQL

**Context:** Anime data was initially stored in JSON files (`/data/*.json`). This worked for development but didn't scale for user features like drops or advanced search.

**Decision:** Migrate to Neon PostgreSQL serverless.

**Reasons:**
- **Serverless HTTP**: poolless connection, ideal for Vercel Functions (no persistent connections needed)
- **Generous free tier**: 0.5 GB storage, more than enough for anime data
- **Branching**: separate DB branches for staging/production
- **Drizzle compatibility**: `@neondatabase/serverless` driver works directly with Drizzle ORM
- **Native PostgreSQL**: support for arrays (`genres` field), timestamps with timezone, etc.

**Alternatives considered:**
- **JSON files**: no support for relations or complex queries, no user data
- **SQLite/Turso**: good option but no branching or direct Vercel integration
- **Supabase**: more features than needed, adds unnecessary complexity

---

### Why Drizzle ORM (not Prisma)

**Reasons:**
- **Lightweight**: no heavy CLI or binary engine like Prisma
- **SQL-first**: migrations are plain SQL, easy to understand and audit
- **Type-safe**: schema defined in TypeScript, types inferred automatically
- **Neon serverless compatible**: works with Neon's HTTP driver without extra adapters

---

### Why Auth.js (NextAuth v5)

**Reasons:**
- **Native integration** with Next.js App Router and Server Actions
- **Drizzle Adapter** available to store users in the same DB
- **Google OAuth + Credentials**: dual support for social and email/password login
- **JWT sessions**: no session table needed, reduces DB queries

---

### Environments: Staging vs Production

- **Production** (`main` branch): production Neon database
- **Staging** (`dev` branch, preview deployments): separate Neon database
- Preview deployments on Vercel use different environment variables
- Preview deployments block Google indexing (`robots: { index: false }`)

---

### Data Pipeline (automated weekly sync)

**Context:** Anime data was originally hand-entered as seasonal JSON files and loaded via
one-off scripts. That manual pipeline is gone — data is now refreshed automatically by a
weekly cron that writes straight to PostgreSQL.

**Runner:** GitHub Actions (`.github/workflows/sync-anime.yml`, Sundays 21:00 UTC) runs
`scripts/sync-anime.ts`. It runs as a plain Node script (not a Vercel Function) so it isn't
bound by the function execution timeout. `src/app/api/cron/sync-anime/route.ts` mirrors the
same logic as a Vercel Function variant.

**Steps (each idempotent):**
1. Fetch current-season anime from AniList; insert new rows
2. Extract per-platform schedules by crawling uzurea.net; match to DB rows
3. Sync episode offsets / pauses from AniList airing data
4. Upload covers and banners from AniList's CDN to Cloudflare R2
5. Translate English synopses to Japanese via DeepL (`synopsis_ja`)

**What stays manual:** anime not on AniList (e.g. indie / YouTube-only works) are seeded
once via a standalone script with `anilist_id = NULL`, so the cron never touches them.
See [data-pipeline.md](data-pipeline.md) for the full step-by-step and script reference.

---

## Project Structure

```
src/
├── app/
│   └── [locale]/               # Localized pages (App Router, next-intl)
│       ├── page.tsx            # Home — recent episodes
│       ├── anime/[slug]/       # Anime detail page
│       ├── schedule/           # Weekly schedule grid
│       ├── search/             # Search
│       ├── drops/              # Dropped anime (requires auth)
│       ├── settings/           # User settings + danger-zone
│       ├── login/              # Login + forgot/reset password
│       ├── about/ privacy/ terms/  # Static pages
│   └── api/
│       ├── auth/[...nextauth]/ # Auth.js API routes
│       └── cron/sync-anime/    # Weekly sync (Vercel Function variant)
├── components/                 # React components
├── lib/                        # Business logic
│   ├── schema.ts               # DB schema (Drizzle)
│   ├── db.ts                   # Neon connection
│   ├── auth.ts                 # Auth.js configuration
│   ├── data.ts                 # Data loaders
│   ├── types.ts                # TypeScript types
│   ├── episodes.ts             # Episode calculation
│   ├── constants.ts            # Constants (platforms, days)
│   ├── platforms.ts            # Platform metadata
│   ├── localized.ts            # Locale-aware title/synopsis helpers
│   ├── translate.ts            # DeepL translation client
│   └── r2.ts                   # Cloudflare R2 upload helper
├── actions/                    # Server Actions
│   ├── drops.ts                # Toggle dropped anime
│   ├── favorites.ts            # Toggle favorite anime
│   ├── platform-preferences.ts # Per-user platform filter
│   ├── signup.ts               # User registration
│   ├── reset-password.ts       # Password reset flow
│   └── user.ts                 # Account management
scripts/                        # Maintenance scripts
├── sync-anime.ts               # Weekly pipeline entrypoint (run by GitHub Actions)
├── migrate.ts                  # Apply Drizzle migrations (runs in build)
├── recover-synopsis.ts         # One-off: restore DeepL-corrupted synopses
└── seed-genkai.ts              # Seed manual (non-AniList) anime entries
```
