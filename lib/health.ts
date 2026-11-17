import { sql } from "./db";
import { getSync } from "./queries";
import { jiraConfigured } from "./jira";
import { today, toMs } from "./time";

export const TOKEN_EXPIRY_KEY = "jira_token_expires";
const WARN_DAYS = 14; // warn this many days before the Jira token expires
const STALE_HOURS = 26; // the nightly job alone keeps data under 24h old

export type JiraHealth = {
  ok: boolean;
  problems: string[];
  lastSyncAt: number | null;
  lastError: string | null;
  tokenExpires: string | null;
  daysLeft: number | null;
};

export async function getTokenExpiry(): Promise<string | null> {
  const [r] = await sql<{ value: any }[]>`select value from settings where key = ${TOKEN_EXPIRY_KEY}`;
  return typeof r?.value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.value) ? r.value : null;
}

/** Whole days from today until `date` (negative once it has passed). */
export const daysUntil = (date: string, t = today()) => Math.round((toMs(date) - toMs(t)) / 86400000);

/** Is the Jira connection healthy? Used by the admin banner, Settings and the daily alert script. */
export function assessHealth(input: { configured: boolean; sync: { at: number; ok: boolean; error?: string } | null; tokenExpires: string | null; now?: number; t?: string }): JiraHealth {
  const now = input.now ?? Date.now();
  const problems: string[] = [];
  const { sync, tokenExpires } = input;
  if (!input.configured) problems.push("Jira isn't connected: JIRA_BASE_URL, JIRA_EMAIL or JIRA_API_TOKEN is missing.");
  else if (sync && !sync.ok) problems.push(`The last update from Jira failed: ${sync.error || "unknown error"}`);
  else if (!sync) problems.push("Jira has never been synced.");
  else if (now - sync.at > STALE_HOURS * 3600_000) problems.push(`No update from Jira for ${Math.round((now - sync.at) / 3600_000)} hours.`);
  const daysLeft = tokenExpires ? daysUntil(tokenExpires, input.t) : null;
  if (daysLeft != null && daysLeft < 0) problems.push(`The Jira API token expired ${-daysLeft} day${daysLeft === -1 ? "" : "s"} ago. Create a new one and update JIRA_API_TOKEN on Vercel.`);
  else if (daysLeft != null && daysLeft <= WARN_DAYS) problems.push(`The Jira API token expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"} (${tokenExpires}). Create a new one and update JIRA_API_TOKEN on Vercel before then.`);
  return { ok: problems.length === 0, problems, lastSyncAt: sync?.at ?? null, lastError: sync && !sync.ok ? sync.error || null : null, tokenExpires, daysLeft };
}

export async function jiraHealth(): Promise<JiraHealth> {
  const [sync, tokenExpires] = await Promise.all([getSync().catch(() => null), getTokenExpiry().catch(() => null)]);
  return assessHealth({ configured: jiraConfigured(), sync, tokenExpires });
}
