import { sql } from "./db";

/**
 * The Google Apps Script (reminders + 9 am check) is pasted by hand, so it can fall behind the site.
 * It sends its version with every call; the site remembers the last one and warns the admin when it's
 * old, or when the 9 am check hasn't called in for over a day (schedule removed, Google account issue).
 * Bump this together with SCRIPT_VERSION in apps-script/Reminders.gs (a test checks they match).
 */
export const SCRIPT_VERSION = "2026-11-10";
export const SCRIPT_SEEN_KEY = "script_seen";
const SILENT_HOURS = 30; // the 9 am check runs daily

export type ScriptSeen = { version: string; at: number } | null;

export async function noteScriptCall(req: Request) {
  const version = (req.headers.get("x-script-version") || "none").slice(0, 20);
  await sql`insert into settings (key, value) values (${SCRIPT_SEEN_KEY}, ${sql.json({ version, at: Date.now() })})
    on conflict (key) do update set value = excluded.value`.catch(() => {});
}

export async function getScriptSeen(): Promise<ScriptSeen> {
  const [r] = await sql<{ value: any }[]>`select value from settings where key = ${SCRIPT_SEEN_KEY}`;
  return r?.value && typeof r.value.at === "number" ? { version: String(r.value.version), at: r.value.at } : null;
}

export type ScriptStatus = { state: "ok" | "outdated" | "silent" | "never"; text: string };

export function scriptStatus(seen: ScriptSeen, now = Date.now()): ScriptStatus {
  if (!seen) return { state: "never", text: "The email script hasn't called the site yet." };
  const hours = Math.round((now - seen.at) / 3600_000);
  if (now - seen.at > SILENT_HOURS * 3600_000) return { state: "silent", text: `The 9 am check hasn't run for ${hours} hours, so reminder and alert emails may have stopped. Open the script at script.google.com (admin@example.com) and run setupTriggers once.` };
  if (seen.version !== SCRIPT_VERSION) return { state: "outdated", text: "The email script in Google is an older version. Paste the latest apps-script/Reminders.gs into script.google.com (admin@example.com) and save; nothing needs to run." };
  return { state: "ok", text: "The email script is up to date and checked in on schedule." };
}
