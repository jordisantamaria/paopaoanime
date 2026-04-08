// Database schema — Auth tables + anime data
import { pgTable, text, timestamp, primaryKey, integer, boolean, serial, unique } from "drizzle-orm/pg-core";

export const users = pgTable("user", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  password: text("password"),
});

export const accounts = pgTable("account", {
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("providerAccountId").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (table) => [primaryKey({ columns: [table.provider, table.providerAccountId] })]);

export const verificationTokens = pgTable("verificationToken", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
}, (table) => [primaryKey({ columns: [table.identifier, table.token] })]);

// --- Anime data tables ---

export const anime = pgTable("anime", {
  id: serial("id").primaryKey(),
  slug: text("slug").unique().notNull(),
  title: text("title").notNull(),
  titleRomaji: text("title_romaji"),
  titleEnglish: text("title_english"),
  day: text("day"),
  time: text("time"),
  startDate: text("start_date"),
  format: text("format"),
  batchRelease: boolean("batch_release").default(false),
  anilistId: integer("anilist_id").unique(),
  image: text("image"),
  banner: text("banner"),
  synopsis: text("synopsis"),
  synopsisJa: text("synopsis_ja"),
  genres: text("genres").array(),
  episodes: integer("episodes"),
  studio: text("studio"),
  trailer: text("trailer"),
  episodeStart: integer("episode_start").default(1),
  episodeOffset: integer("episode_offset").default(0),
  pausedUntil: text("paused_until"),
  type: text("type").default("見放題").notNull(),
  season: text("season").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const animePlatforms = pgTable(
  "anime_platform",
  {
    id: serial("id").primaryKey(),
    animeSlug: text("anime_slug").notNull().references(() => anime.slug, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    day: text("day"),
    time: text("time"),
  },
  (table) => [
    unique("anime_platform_unique").on(table.animeSlug, table.platform),
  ],
);

// --- User data tables ---

export const droppedAnime = pgTable(
  "dropped_anime",
  {
    userId: text("user_id").notNull(),
    animeSlug: text("anime_slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.animeSlug] })],
);
