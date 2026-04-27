CREATE TABLE "favorite_anime" (
	"user_id" text NOT NULL,
	"anime_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorite_anime_user_id_anime_slug_pk" PRIMARY KEY("user_id","anime_slug")
);
--> statement-breakpoint
ALTER TABLE "favorite_anime" ADD CONSTRAINT "favorite_anime_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_anime" ADD CONSTRAINT "favorite_anime_anime_slug_anime_slug_fk" FOREIGN KEY ("anime_slug") REFERENCES "public"."anime"("slug") ON DELETE cascade ON UPDATE no action;