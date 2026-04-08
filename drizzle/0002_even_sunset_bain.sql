CREATE TABLE "user_platform_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"platforms" text[] NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "user_platform_preferences" ADD CONSTRAINT "user_platform_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;