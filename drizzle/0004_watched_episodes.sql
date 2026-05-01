CREATE TABLE "watched_episodes" (
	"user_id" text NOT NULL,
	"anime_slug" text NOT NULL,
	"episode" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watched_episodes_user_id_anime_slug_episode_pk" PRIMARY KEY("user_id","anime_slug","episode")
);
--> statement-breakpoint
ALTER TABLE "watched_episodes" ADD CONSTRAINT "watched_episodes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watched_episodes" ADD CONSTRAINT "watched_episodes_anime_slug_anime_slug_fk" FOREIGN KEY ("anime_slug") REFERENCES "public"."anime"("slug") ON DELETE cascade ON UPDATE no action;