# Database changes

Each file here is one change to the database, applied once, in number order, and recorded in the
`schema_migrations` table. Never edit a file that has already gone live: add a new one instead.

- New change: copy the next number, e.g. `0002_add_counts_toward_utilisation.sql`.
- Try it on the test database first: `npm run db:migrate` (uses DATABASE_URL in .env.local).
- See what's applied: `npm run db:migrate -- --status`.
- The live site applies new changes automatically during the Vercel build, before the new version goes live.
  If a change fails, the build stops and the current version keeps running.
- Keep changes safe for the version that's still live: add first, remove later (in a separate release).
