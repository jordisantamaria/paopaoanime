# Architecture — PaoPaoAnime

## Overview

PaoPaoAnime is a streaming schedule aggregator for anime in Japan. It answers: "Which platform streams this anime and when does it air?"

```
JSON (manual data entry)
  → Enrichment scripts (AniList API + Anthropic)
    → Migration to PostgreSQL (Neon)
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
| LLM | Anthropic SDK | Japanese synopsis translation |

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

### Why JSON + Manual Migration for Data

**Context:** Seasonal anime data is manually collected at the start of each season and enriched via scripts.

**Data pipeline:**
1. Create JSON with basic data (title, platforms, schedules)
2. `scripts/enrich.ts` — enrich with AniList API (synopsis, genres, cover image, studio)
3. `scripts/translate-synopsis.ts` — translate synopsis to Japanese via Anthropic
4. `scripts/migrate-to-db.ts` — migrate everything to PostgreSQL

**Why not fully automate:**
- Per-platform schedule data is not available in any public API
- Data is manually collected from each platform's official website
- Human verification is required to ensure accuracy
- **Future goal**: automate with LLM scraping at the start of each season

---

## Project Structure

```
src/
├── app/                    # Pages (App Router)
│   ├── page.tsx            # Home — recent episodes
│   ├── anime/[slug]/       # Anime detail page
│   ├── schedule/           # Weekly schedule grid
│   ├── search/             # Search
│   ├── drops/              # Dropped anime (requires auth)
│   ├── login/              # Login + forgot/reset password
│   └── api/auth/           # Auth.js API routes
├── components/             # React components (~29 files)
├── lib/                    # Business logic
│   ├── schema.ts           # DB schema (Drizzle)
│   ├── db.ts               # Neon connection
│   ├── auth.ts             # Auth.js configuration
│   ├── data.ts             # Data loaders
│   ├── types.ts            # TypeScript types
│   ├── episodes.ts         # Episode calculation
│   ├── constants.ts        # Constants (platforms, days)
│   └── platforms.ts        # Platform metadata
├── actions/                # Server Actions
│   ├── drops.ts            # Toggle drop anime
│   └── signup.ts           # User registration
scripts/                    # Data scripts
├── migrate-to-db.ts        # JSON → PostgreSQL
├── enrich.ts               # Enrich with AniList
├── translate-synopsis.ts   # Translate with Anthropic
└── ...
data/                       # Seasonal JSON files
├── winter-2026.json
└── spring-2026.json
```
