import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function ensureMigrationHistory() {
  await sql`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;

  const existing = await sql`
    SELECT count(*)::int as cnt FROM "__drizzle_migrations"
  `;
  if (existing[0].cnt > 0) return;

  const alreadyApplied = [
    { hash: "0000_even_mandarin", created_at: 1774275194541 },
    { hash: "0001_needy_mattie_franklin", created_at: 1774869447906 },
  ];

  for (const m of alreadyApplied) {
    await sql`
      INSERT INTO "__drizzle_migrations" (hash, created_at)
      VALUES (${m.hash}, ${m.created_at})
    `;
  }

  console.log("Seeded migration history with 2 existing migrations.");
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
