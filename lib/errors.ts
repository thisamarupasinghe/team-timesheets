import { sql } from "./db";

/**
 * Website errors (a page or data link that crashed on the server), kept so the admin hears about them in the
 * daily 9 am email instead of only in Vercel's logs. Only the live site records them. The newest 50 are kept.
 */
export const ERRORS_KEY = "site_errors";
const KEEP = 50;
export type SiteError = { at: number; path: string; kind: string; message: string };

/** Next.js uses thrown values for redirects and "not found"; those are normal, not errors. */
export function isControlFlow(err: unknown): boolean {
  const d = String((err as any)?.digest || (err as any)?.message || "");
  return /^(NEXT_REDIRECT|NEXT_HTTP_ERROR_FALLBACK|NEXT_NOT_FOUND|DYNAMIC_SERVER_USAGE|BAILOUT_TO_CLIENT_SIDE_RENDERING)/.test(d);
}

/**
 * Requests Next.js turns away before any of the site's code runs: an old tab from before a deploy, or a bot,
 * sending page-state data or a form action this version doesn't recognise. The person's page just reloads.
 */
export function isStaleOrBadRequest(err: unknown): boolean {
  const m = String((err as any)?.message || "");
  return /router state header|Failed to find Server Action/i.test(m);
}

/** Keeps the message short and strips anything that looks like a password, token or database address. */
export function scrub(s: string): string {
  return String(s)
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://…")
    .replace(/Bearer\s+\S+/gi, "Bearer …")
    .replace(/ATATT\S+/g, "…")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

/** The page address without the part after "?" (search words, filters). */
export const cleanPath = (p: string) => String(p || "/").split("?")[0].slice(0, 120) || "/";

export async function recordError(e: SiteError) {
  // Newest first, trimmed to KEEP, in one statement so two errors at once can't overwrite each other
  await sql`
    insert into settings (key, value) values (${ERRORS_KEY}, ${sql.json([e] as any)})
    on conflict (key) do update set value = (
      select coalesce(jsonb_agg(x order by i), '[]'::jsonb)
      from jsonb_array_elements(jsonb_build_array(${sql.json(e as any)}::jsonb) || settings.value) with ordinality t(x, i)
      where i <= ${KEEP}
    )`;
}

export async function getErrors(): Promise<SiteError[]> {
  const [r] = await sql<{ value: unknown }[]>`select value from settings where key = ${ERRORS_KEY}`;
  return Array.isArray(r?.value) ? (r.value as SiteError[]) : [];
}

/** Errors in the last `hours`, newest first: how many, plus the latest few to show. */
export function summarise(list: SiteError[], hours: number, now = Date.now(), show = 10) {
  const recent = list.filter((e) => typeof e?.at === "number" && now - e.at <= hours * 3600_000).sort((a, b) => b.at - a.at);
  return { count: recent.length, latest: recent.slice(0, show) };
}

/** Browser errors that aren't the site's fault: extensions, cross-site scripts, harmless resize warnings, old tabs after a deploy. */
export function isBrowserNoise(message: string, source = ""): boolean {
  return /^Script error\.?$|ResizeObserver loop|chrome-extension:|moz-extension:|safari-extension:|Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module|NetworkError|Load failed|Failed to fetch|AbortError|The operation was aborted/i.test(message)
    || /extension:\/\//i.test(source);
}

/**
 * Limits for browser reports (anyone signed in can send one): the same error on the same page only once an hour,
 * and at most 20 browser errors an hour in total, so a broken tab or a bad actor can't flood the list or the email.
 */
export function acceptBrowserError(list: SiteError[], e: SiteError, now = Date.now()): boolean {
  const hour = list.filter((x) => x.kind === "browser" && now - x.at < 3600_000);
  if (hour.length >= 20) return false;
  return !hour.some((x) => x.path === e.path && x.message === e.message);
}
