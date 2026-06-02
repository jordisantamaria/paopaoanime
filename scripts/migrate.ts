/**
 * Database migration runner.
 *
 * Runs as part of the build (`tsx scripts/migrate.ts && next build`), so every
 * deploy applies any pending migrations before the app is compiled. If a
 * migration fails the build aborts, preventing a deploy against an out-of-sync
 * schema.
 *
 * `migrate()` scans the `./drizzle` folder at runtime, compares it against the
 * `drizzle.__drizzle_migrations` history table, and applies whatever is missing.
 * When the DB is already up to date it is a no-op. The history table is created
 * automatically by `migrate()` on first run.
 *
 * To add a migration: edit `src/lib/schema.ts`, run `npx drizzle-kit generate`,
 * commit the generated SQL — the next deploy applies it.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function main() {
  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations complete.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
