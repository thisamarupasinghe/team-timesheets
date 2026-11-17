import { sql } from "./db";
import { demoSql } from "./demo-sql";

/** Demo only: add any fictional leave and worklogs the demo is missing up to today, and stamp "last updated". */
export async function demoTopUp() {
  await sql.unsafe(demoSql);
  await sql`insert into settings (key, value) values ('last_sync', ${sql.json({ at: Date.now(), ok: true, count: 0, mode: "recent" })})
            on conflict (key) do update set value = excluded.value`;
}
