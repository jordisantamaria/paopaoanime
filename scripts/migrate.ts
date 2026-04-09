import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("Running migrations...");

  // Create user_platform_preferences if it doesn't exist
  await sql`
    CREATE TABLE IF NOT EXISTS "user_platform_preferences" (
      "user_id" text PRIMARY KEY NOT NULL,
      "platforms" text[] NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now()
    )
  `;

  // Add FK constraint if it doesn't exist
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'user_platform_preferences_user_id_user_id_fk'
      ) THEN
        ALTER TABLE "user_platform_preferences"
          ADD CONSTRAINT "user_platform_preferences_user_id_user_id_fk"
          FOREIGN KEY ("user_id") REFERENCES "public"."user"("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$
  `;

  console.log("Migrations complete.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
