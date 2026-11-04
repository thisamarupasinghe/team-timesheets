// Creates the tables (and with --seed, loads a sample roster + holidays).
// Usage: DATABASE_URL=... node scripts/migrate.mjs [--seed]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const dir = path.dirname(fileURLToPath(import.meta.url));
if (!process.env.DATABASE_URL) { console.error("Set DATABASE_URL first"); process.exit(1); }
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
try {
  await sql.unsafe(fs.readFileSync(path.join(dir, "../db/schema.sql"), "utf8"));
  console.log("Tables ready");
  if (process.argv.includes("--seed")) {
    await sql.unsafe(fs.readFileSync(path.join(dir, "../db/seed.sql"), "utf8"));
    const [{ n }] = await sql`select count(*)::int n from employees`;
    console.log(`Roster loaded: ${n} people`);
  }
} finally {
  await sql.end();
}
