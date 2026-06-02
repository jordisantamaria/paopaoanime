# Database — PaoPaoAnime

## Provider

**Neon PostgreSQL** (serverless, HTTP connection via `@neondatabase/serverless`)

ORM: **Drizzle ORM** — schema in `src/lib/schema.ts`, migrations in `/drizzle/`

---

## Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────────┐
│    user       │       │    account        │
│──────────────│       │──────────────────│
│ id (PK)       │◄──────│ userId (FK)       │
│ name          │       │ provider          │
│ email (UQ)    │       │ providerAccountId │
│ emailVerified │       │ type              │
│ image         │       │ access_token      │
│ password      │       │ refresh_token     │
└──────┬───────┘       │ expires_at        │
       │               └──────────────────┘
       │
       │  userId
       ▼
┌──────────────────┐
│  dropped_anime    │
│──────────────────│
│ userId (PK, FK)   │───► user.id
│ animeSlug (PK)    │───► anime.slug
│ createdAt         │
└──────────────────┘

       │  userId
       ▼
┌──────────────────────────────┐
│  user_platform_preferences    │
│──────────────────────────────│
│ userId (PK, FK)               │───► user.id
│ platforms (text[])            │
│ updatedAt                     │
└──────────────────────────────┘

┌──────────────────┐       ┌────────────────────┐
│     anime         │       │  anime_platform     │
│──────────────────│       │────────────────────│
│ id (PK, serial)   │       │ id (PK, serial)     │
│ slug (UQ)         │◄──────│ animeSlug (FK)      │
│ title             │       │ platform            │
│ titleRomaji       │       │ day                 │
│ titleEnglish      │       │ time                │
│ day               │       └────────────────────┘
│ time              │        UQ: (animeSlug, platform)
│ startDate         │
│ format            │
│ batchRelease      │
│ anilistId (UQ)    │
│ image             │
│ banner            │
│ synopsis          │
│ synopsisJa        │
│ genres (text[])   │
│ episodes          │
│ studio            │
│ trailer           │
│ episodeStart      │
│ episodeOffset     │
│ pausedUntil       │
│ type              │
│ season            │
│ createdAt         │
│ updatedAt         │
└──────────────────┘

┌─────────────────────┐
│  verificationToken   │
│─────────────────────│
│ identifier (PK)      │
│ token (PK)           │
│ expires              │
└─────────────────────┘
```

---

## Tables

### `anime` — Main anime table

Each row represents one anime in a season.

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial PK | Auto-increment ID |
| `slug` | text UQ NOT NULL | URL-friendly identifier (generated from titleRomaji) |
| `title` | text NOT NULL | Title in Japanese |
| `titleRomaji` | text | Title in romaji |
| `titleEnglish` | text | Title in English |
| `day` | text | Primary broadcast day (月火水木金土日) |
| `time` | text | Broadcast time (HH:MM) |
| `startDate` | text | Start date (YYYY-MM-DD) |
| `format` | text | Format: TV, TV_SHORT, MOVIE, OVA, SPECIAL, ONA, MUSIC |
| `batchRelease` | boolean | Whether all episodes drop at once (e.g. Netflix) |
| `anilistId` | integer UQ | AniList ID for data enrichment |
| `image` | text | Cover image URL |
| `banner` | text | Banner image URL |
| `synopsis` | text | Synopsis in English (from AniList) |
| `synopsisJa` | text | Synopsis in Japanese (translated via DeepL) |
| `genres` | text[] | Genre array (Action, Romance, etc.) |
| `episodes` | integer | Total episode count |
| `studio` | text | Animation studio |
| `trailer` | text | YouTube video ID |
| `episodeStart` | integer (default 1) | First episode number |
| `episodeOffset` | integer (default 0) | Offset for skipped weeks/pauses |
| `pausedUntil` | text | Date until which the show is paused |
| `type` | text NOT NULL (default "見放題") | Model: 見放題 (subscription) or レンタル (rental) |
| `season` | text NOT NULL | Season identifier: winter-2026, spring-2026, etc. |
| `hidden` | boolean NOT NULL (default false) | Hidden from home/schedule listings but still searchable and reachable by URL. Used for special entries like the YouTube-only Genkai Anime seasons (`season = "youtube"`, no platform rows). |
| `createdAt` | timestamp with tz | Creation timestamp |
| `updatedAt` | timestamp with tz | Last update timestamp |

---

### `anime_platform` — Per-platform streaming data

**Junction table** linking each anime to its streaming platforms. A single anime can be on multiple platforms, and each platform may have a different schedule.

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial PK | Auto-increment ID |
| `animeSlug` | text FK NOT NULL | References `anime.slug` (CASCADE on delete) |
| `platform` | text NOT NULL | Platform ID (dmmtv, netflix, abema, etc.) |
| `day` | text | Broadcast day on this platform (may differ from main schedule) |
| `time` | text | Broadcast time on this platform |

**Unique constraint:** `(animeSlug, platform)` — each anime appears at most once per platform.

**Why a separate table instead of an array on `anime`:**
- Each platform can have a **different day and time** for the same anime
- Example: Frieren airs on ABEMA on Saturday at 00:00 but on Netflix on Friday at 00:00
- A string array couldn't store per-platform schedules
- Enables efficient queries: "Which anime does Netflix have?" without parsing arrays

**Current platforms (8):**

| ID | Name | Anime Count |
|----|------|-------------|
| `danime` | dAnime Store | 86 |
| `dmmtv` | DMM TV | 85 |
| `abema` | ABEMA | 82 |
| `amazon` | Prime Video | 71 |
| `unext` | U-NEXT | 63 |
| `netflix` | Netflix | 32 |
| `disney` | Disney+ | 19 |
| `theater` | Theatrical release | 12 |

---

### `user` — Users

| Column | Type | Description |
|--------|------|-------------|
| `id` | text PK | Auto-generated UUID |
| `name` | text | Display name |
| `email` | text UQ | Email address (login identifier) |
| `emailVerified` | timestamp | Verification date |
| `image` | text | Avatar URL |
| `password` | text | bcrypt hash (credentials login only) |

---

### `account` — OAuth accounts

Managed by Auth.js / Drizzle Adapter.

| Column | Type | Description |
|--------|------|-------------|
| `userId` | text FK | References `user.id` (CASCADE on delete) |
| `provider` | text PK | OAuth provider (google) |
| `providerAccountId` | text PK | User ID at the provider |
| `type` | text | Account type (oauth) |
| `access_token` | text | Access token |
| `refresh_token` | text | Refresh token |
| `expires_at` | integer | Token expiration |

---

### `dropped_anime` — User's dropped anime

Allows users to hide anime they're not interested in.

| Column | Type | Description |
|--------|------|-------------|
| `userId` | text PK | References `user.id` |
| `animeSlug` | text PK | References `anime.slug` |
| `createdAt` | timestamp with tz | Drop timestamp |

**Composite PK:** `(userId, animeSlug)` — a user can only drop an anime once.

---

### `user_platform_preferences` — User's preferred platforms

Stores an ordered list of streaming platforms the user subscribes to. Used to sort anime on the home page (preferred platforms first).

| Column | Type | Description |
|--------|------|-------------|
| `userId` | text PK FK | References `user.id` (CASCADE on delete) |
| `platforms` | text[] NOT NULL | Ordered list of platform IDs (first = highest priority) |
| `updatedAt` | timestamp with tz | Last update timestamp |

---

### `verificationToken` — Verification tokens

Managed by Auth.js for email verification and password reset.

| Column | Type | Description |
|--------|------|-------------|
| `identifier` | text PK | User email |
| `token` | text PK | Unique token |
| `expires` | timestamp | Expiration |

---

## Migrations

Migrations are stored in `/drizzle/`:

| File | Contents |
|------|----------|
| `0000_even_mandarin.sql` | Auth tables: user, account, verificationToken |
| `0001_needy_mattie_franklin.sql` | Anime tables: anime, anime_platform + password field on user |
| `0002_even_sunset_bain.sql` | User platform preferences table |
| `0003_lethal_rage.sql` | favorite_anime table (later dropped in `0005`) |
| `0004_thankful_joshua_kane.sql` | `hidden` column on anime |
| `0005_drop_favorite_anime.sql` | Drop favorite_anime table |

### How migrations are applied

Migrations run automatically on every deploy. The build script is
`tsx scripts/migrate.ts && next build`, so `scripts/migrate.ts` applies any
pending migrations before Next.js compiles. If a migration fails the build
aborts, so a deploy can never ship against an out-of-sync schema. When the DB
is already up to date the script is a no-op.

`scripts/migrate.ts` uses Drizzle's programmatic `migrate()` (via the Neon
`neon-http` driver) rather than the `drizzle-kit migrate` CLI, which fits the
serverless build environment better. It scans `/drizzle/` at runtime and
applies whatever is not yet recorded in the `drizzle.__drizzle_migrations`
history table.

### Adding a migration

1. Edit the schema in `src/lib/schema.ts`.
2. Generate the SQL: `npx drizzle-kit generate`.
3. Commit the generated file in `/drizzle/`.

The next deploy applies it automatically — no manual step against the database.

> **Note:** the first three migrations (`0000`–`0002`) were originally applied
> with `npx drizzle-kit push`, which does not record history. A one-off seed in
> `migrate.ts` backfilled those entries into `__drizzle_migrations`; that seed
> has since been removed as it is no longer needed.
