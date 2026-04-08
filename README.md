# PaoPaoAnime

今期アニメ、いつ・どこで配信？パオパオでかんたん確認。

Check which platforms stream this season's anime in Japan, with schedule times for DMM TV, U-NEXT, dアニメストア, ABEMA, Netflix, Disney+, and Amazon Prime Video.

## Tech Stack

- **Framework** — Next.js 16 (App Router)
- **Styling** — Tailwind CSS v4
- **Auth** — Auth.js v5 (Google OAuth, JWT strategy)
- **Database** — Neon PostgreSQL + Drizzle ORM
- **Deploy** — Vercel

## Quick Start

```bash
# Clone
git clone https://github.com/user/paopaoanime.git
cd paopaoanime

# Install dependencies
pnpm install

# Pull environment variables from Vercel
vercel link
vercel env pull .env.local

# Start dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Note:** `vercel env pull` pulls from the Development environment by default. All env vars must be configured in Vercel Dashboard with the **Development** environment selected, or they won't appear in `.env.local`.

## Setup Guide

### 1. Neon Database

1. Create a free account at [neon.tech](https://neon.tech)
2. Create a new project (e.g., `paopaoanime`)
3. Copy the connection string and paste it as `DATABASE_URL` in `.env.local`
4. Create the `dropped_anime` table:

```sql
CREATE TABLE dropped_anime (
  user_id TEXT NOT NULL,
  anime_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, anime_slug)
);
```

You can run this SQL in the Neon Console's **SQL Editor**, or use any PostgreSQL client with your connection string.

### 2. Auth Secret

Generate a random secret for Auth.js:

```bash
openssl rand -base64 33
```

Paste the output as `AUTH_SECRET` in `.env.local`.

### 3. Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Navigate to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth client ID**
5. Application type: **Web application**
6. Add authorized redirect URIs:
   - Local: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://yourdomain.com/api/auth/callback/google`
7. Copy the **Client ID** and **Client Secret**
8. Paste them as `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` in `.env.local`

> If prompted to configure the OAuth consent screen first:
> - User type: **External**
> - App name: `PaoPaoAnime`
> - User support email: your email
> - Scopes: just the defaults (email, profile, openid)
> - Test users: add your own email while in "Testing" mode

### 4. Cloudflare R2 (Image Storage)

Anime cover and banner images are stored in Cloudflare R2 (S3-compatible, 10GB free).

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2** → **Add R2 subscription** (free tier)
2. **Create bucket** → name: `paopaoanime-images`, Location: Automatic, Storage: Standard
3. In the bucket → **Settings** → **Public Development URL** → **Enable**
   - Copy the public URL (e.g., `https://pub-xxx.r2.dev`)
4. Go back to **R2** → **Manage R2 API Tokens** → **Create Account API Token**
   - Permission: **Object Read & Write**
   - Bucket: **Apply to specific buckets only** → `paopaoanime-images`
   - TTL: Forever
   - Copy the **Access Key ID** and **Secret Access Key** (shown only once)
5. Your **Account ID** is in the S3 API endpoint URL: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
6. Add to `.env.local`:

```env
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_R2_ACCESS_KEY_ID=your-access-key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-secret-key
CLOUDFLARE_R2_BUCKET_NAME=paopaoanime-images
CLOUDFLARE_R2_PUBLIC_URL=https://pub-xxx.r2.dev
```

### 5. Cron Secret

Generate a secret for the weekly anime sync cron job:

```bash
openssl rand -base64 32
```

Add to `.env.local` as `CRON_SECRET`. Also add it in Vercel (Production + Preview).

### 6. Anthropic API Key

The cron uses Claude to extract platform data from anime schedule pages.

1. Get an API key from [console.anthropic.com](https://console.anthropic.com)
2. Add to `.env.local` as `ANTHROPIC_API_KEY`

### 7. Verify

```bash
pnpm build    # Should complete with 0 errors
pnpm dev      # Open http://localhost:3000, click login
```

## Environment Variables

| Variable | Description | Where to get it |
|---|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string | [Neon Console](https://console.neon.tech) |
| `AUTH_SECRET` | Random string for signing JWTs | `openssl rand -base64 33` |
| `AUTH_GOOGLE_ID` | Google OAuth Client ID | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |
| `AUTH_GOOGLE_SECRET` | Google OAuth Client Secret | Same as above |
| `CRON_SECRET` | Secret for cron job auth | `openssl rand -base64 32` |
| `ANTHROPIC_API_KEY` | Claude API key for platform extraction | [Anthropic Console](https://console.anthropic.com) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID | R2 S3 API endpoint URL |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | R2 API access key | R2 → Manage API Tokens |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 API secret key | Same as above |
| `CLOUDFLARE_R2_BUCKET_NAME` | R2 bucket name | `paopaoanime-images` |
| `CLOUDFLARE_R2_PUBLIC_URL` | R2 public URL | Bucket Settings → Public Dev URL |

## Commands

```bash
pnpm dev          # Start development server
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # Run ESLint
```

## Project Structure

```
src/
  app/
    page.tsx                    # Home (latest episodes + latest anime)
    anime/[slug]/page.tsx       # Anime detail page
    drops/page.tsx              # Dropped anime management
    schedule/page.tsx           # Weekly schedule
    search/page.tsx             # Search
    api/auth/[...nextauth]/     # Auth API routes
  components/
    header.tsx                  # Navigation header
    auth-button.tsx             # Login / avatar dropdown
    home-content.tsx            # Home page client component
    drop-button-wrapper.tsx     # Drop toggle for detail pages
    drops-content.tsx           # Drops management list
    ...
  lib/
    auth.ts                     # Auth.js config
    db.ts                       # Drizzle + Neon connection
    schema.ts                   # Database schema
    data.ts                     # Anime data loader
    ...
  actions/
    drops.ts                    # Server actions for drop/undrop
```

## Deploy to Vercel

1. Push to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Add all environment variables from the table above
4. **Important:** Add each variable to all 3 environments (Production, Preview, Development). `vercel env pull` only pulls from Development — missing variables there won't appear in `.env.local`
5. Update the Google OAuth redirect URI to your production domain

## License

MIT
