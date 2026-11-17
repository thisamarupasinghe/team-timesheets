// Database changes ("migrations"), applied in order and recorded so each runs exactly once.
//
//   npm run db:migrate            apply anything new (to the database in DATABASE_URL)
//   npm run db:migrate -- --status   list what's applied and what's waiting, change nothing
//   npm run db:seed               apply, then add the starting roster if the database is empty
//
// On Vercel the build runs this for the live site only (--if-production), before the new version goes live.
// If a change fails, the build stops and the old version keeps running. Write changes so the CURRENT live
// version still works after them (add columns/tables first, remove old ones in a later release).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const args = new Set(process.argv.slice(2));
const DIR = join(process.cwd(), "db", "migrations");

if (args.has("--if-production") && process.env.VERCEL_ENV !== "production") {
  console.log(`migrate: skipped (not the live site build${process.env.VERCEL_ENV ? `: ${process.env.VERCEL_ENV}` : ""})`);
  process.exit(0);
}
if (!process.env.DATABASE_URL) {
  console.error("migrate: DATABASE_URL is not set");
  process.exit(1);
}

const files = readdirSync(DIR).filter((f) => /^\d{4}_[\w-]+\.sql$/.test(f)).sort();
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });

try {
  await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
  const done = new Set((await sql`select name from schema_migrations`).map((r) => r.name));
  const todo = files.filter((f) => !done.has(f.replace(/\.sql$/, "")));

  if (args.has("--status")) {
    for (const f of files) console.log(`${done.has(f.replace(/\.sql$/, "")) ? "applied" : "WAITING"}  ${f}`);
  } else {
    for (const f of todo) {
      const name = f.replace(/\.sql$/, "");
      const applied = await sql.begin(async (tx) => {
        // One runner at a time (works through Neon's connection pooler, unlike a session lock); re-check inside the lock
        await tx`select pg_advisory_xact_lock(727274)`;
        if ((await tx`select 1 from schema_migrations where name = ${name}`).length) return false;
        await tx.unsafe(readFileSync(join(DIR, f), "utf8"));
        await tx`insert into schema_migrations (name) values (${name})`;
        return true;
      });
      console.log(applied ? `migrate: applied ${name}` : `migrate: ${name} was applied by another run`);
    }
    if (!todo.length) console.log(`migrate: up to date (${files.length} change${files.length === 1 ? "" : "s"})`);
    if (args.has("--seed")) {
      const [{ n }] = await sql`select count(*)::int as n from employees`;
      if (n === 0) { await sql.unsafe(readFileSync(join(process.cwd(), "db", "seed.sql"), "utf8")); console.log("migrate: added the starting roster"); }
      else console.log(`migrate: roster already has ${n} people, seed skipped`);
    }
    if (args.has("--demo")) { await sql.unsafe(readFileSync(join(process.cwd(), "db", "demo.sql"), "utf8")); console.log("migrate: added the fictional demo worklogs"); }
  }
} catch (e) {
  console.error("migrate: FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
