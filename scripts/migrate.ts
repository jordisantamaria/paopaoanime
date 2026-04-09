import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function ensureMigrationHistory() {
  // Create the drizzle migrations tracking table if it doesn't exist
  await sql`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;

  // If tracking table is empty, seed it with all migrations that were
  // originally applied via drizzle-kit push (before we had this script)
  const existing = await sql`
    SELECT count(*)::int as cnt FROM "__drizzle_migrations"
  `;

  if (existing[0].cnt === 0) {
    const applied = [
      { hash: "0000_even_mandarin", ts: 1774275194541 },
      { hash: "0001_needy_mattie_franklin", ts: 1774869447906 },
      { hash: "0002_even_sunset_bain", ts: 1775685095563 },
    ];

    for (const m of applied) {
      await sql`
        INSERT INTO "__drizzle_migrations" (hash, created_at)
        VALUES (${m.hash}, ${m.ts})
      `;
    }

    console.log(`Seeded migration history with ${applied.length} entries.`);
  }
}

async function main() {
  await ensureMigrationHistory();
  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations complete.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
