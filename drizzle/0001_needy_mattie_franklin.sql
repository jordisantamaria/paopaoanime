CREATE TABLE "anime" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"title_romaji" text,
	"title_english" text,
	"day" text,
	"time" text,
	"start_date" text,
	"format" text,
	"batch_release" boolean DEFAULT false,
	"anilist_id" integer,
	"image" text,
	"banner" text,
	"synopsis" text,
	"synopsis_ja" text,
	"genres" text[],
	"episodes" integer,
	"studio" text,
	"trailer" text,
	"episode_start" integer DEFAULT 1,
	"episode_offset" integer DEFAULT 0,
	"paused_until" text,
	"type" text DEFAULT '見放題' NOT NULL,
	"season" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "anime_slug_unique" UNIQUE("slug"),
	CONSTRAINT "anime_anilist_id_unique" UNIQUE("anilist_id")
);
--> statement-breakpoint
CREATE TABLE "anime_platform" (
	"id" serial PRIMARY KEY NOT NULL,
	"anime_slug" text NOT NULL,
	"platform" text NOT NULL,
	"day" text,
	"time" text,
	CONSTRAINT "anime_platform_unique" UNIQUE("anime_slug","platform")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "password" text;--> statement-breakpoint
ALTER TABLE "anime_platform" ADD CONSTRAINT "anime_platform_anime_slug_anime_slug_fk" FOREIGN KEY ("anime_slug") REFERENCES "public"."anime"("slug") ON DELETE cascade ON UPDATE no action;