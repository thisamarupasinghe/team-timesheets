import { sql } from "./db";
import { addDays, today } from "./time";

export type Wl = { id: string; issue_key: string; summary: string; project: string; author_id: string; author_name: string; day: string; hours: number; comment: string };

const base = () => (process.env.JIRA_BASE_URL || "").replace(/\/$/, "");
export const jiraConfigured = () => process.env.DEMO === "1" || !!(process.env.JIRA_BASE_URL && process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN);
export const jiraBase = base;

async function jira(path: string, init?: RequestInit, retry = true): Promise<any> {
  // trim: a stray space pasted with the token or email makes Jira refuse the login
  const auth = Buffer.from(`${(process.env.JIRA_EMAIL || "").trim()}:${(process.env.JIRA_API_TOKEN || "").trim()}`).toString("base64");
  const r = await fetch(base() + path, {
    ...init, cache: "no-store",
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json", "Content-Type": "application/json" },
  });
  if (r.status === 429 && retry) {
    await new Promise((res) => setTimeout(res, (Number(r.headers.get("retry-after")) || 2) * 1000));
    return jira(path, init, false);
  }
  if (!r.ok) {
    const body = (await r.text()).slice(0, 200);
    throw new Error(r.status === 401 || r.status === 403 ? `Jira refused the login (${r.status}). Check JIRA_EMAIL and JIRA_API_TOKEN.` : `Jira error ${r.status}: ${body}`);
  }
  return r.json();
}

function adfText(n: any): string {
  if (!n) return "";
  if (typeof n === "string") return n;
  let s = n.text || "";
  if (Array.isArray(n.content)) s += n.content.map(adfText).join(n.type === "paragraph" || n.type === "doc" ? " " : "");
  return s;
}

export async function fetchWorklogs(start: string, end: string): Promise<Wl[]> {
  // Jira's search answers "200, no results" to a wrong or missing login instead of refusing it.
  // /myself does refuse (401), so check the login first or a bad token would look like "nobody logged time".
  await jira("/rest/api/3/myself");
  const jql = `worklogDate >= "${start}" AND worklogDate <= "${end}" ORDER BY key ASC`;
  const issues: any[] = [];
  let token: string | undefined, guard = 0;
  do {
    const body: any = { jql, fields: ["summary", "project", "worklog"], maxResults: 100 };
    if (token) body.nextPageToken = token;
    const p = await jira("/rest/api/3/search/jql", { method: "POST", body: JSON.stringify(body) });
    issues.push(...(p.issues || []));
    token = p.isLast === false || (p.isLast === undefined && p.nextPageToken) ? p.nextPageToken : undefined;
  } while (token && ++guard < 100);

  // The search returns at most 20 worklogs per issue; fetch the rest for busy issues
  const full = new Map<string, any[]>();
  const need = issues.filter((i) => (i.fields?.worklog?.total || 0) > (i.fields?.worklog?.worklogs?.length || 0));
  let next = 0;
  async function worker() {
    while (next < need.length) {
      const it = need[next++];
      const all: any[] = [];
      let startAt = 0;
      for (let g = 0; g < 50; g++) {
        const p = await jira(`/rest/api/3/issue/${encodeURIComponent(it.key)}/worklog?startAt=${startAt}&maxResults=100`);
        const w = p.worklogs || [];
        all.push(...w);
        startAt += w.length;
        if (!w.length || startAt >= (p.total || 0)) break;
      }
      full.set(it.key, all);
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);

  const out = new Map<string, Wl>();
  for (const it of issues) {
    const f = it.fields || {};
    for (const w of full.get(it.key) || f.worklog?.worklogs || []) {
      const day = String(w.started || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < start || day > end) continue;
      out.set(String(w.id), {
        id: String(w.id), issue_key: it.key, summary: String(f.summary || "").slice(0, 160), project: f.project?.name || "",
        author_id: w.author?.accountId || "", author_name: w.author?.displayName || "Unknown",
        day, hours: (w.timeSpentSeconds || 0) / 3600, comment: adfText(w.comment).replace(/\s+/g, " ").trim().slice(0, 300),
      });
    }
  }
  return [...out.values()].filter((w) => w.author_id);
}

/** Pull the last `days` days of worklogs from Jira and replace what we hold for that window. */
export async function syncJira(days = 21) {
  if (!jiraConfigured()) throw new Error("Jira is not set up yet. Add JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN.");
  const now = Date.now();
  // one sync at a time: claim the slot unless another started in the last 3 minutes
  const claim = await sql`
    insert into settings (key, value) values ('sync_started', ${sql.json(now)})
    on conflict (key) do update set value = excluded.value
    where (settings.value #>> '{}')::bigint < ${now - 180000} returning key`;
  if (!claim.length) return { skipped: true as const };
  const to = today(), from = addDays(to, -Math.min(Math.max(days, 1), 366));
  try {
    const logs = await fetchWorklogs(from, to);
    // Safety: a login that works but can't see the projects looks like "zero worklogs".
    // Never let that wipe data we already hold for the window.
    if (!logs.length) {
      const [held] = await sql<{ n: number }[]>`select count(*)::int as n from worklogs where day between ${from}::date and ${to}::date`;
      if (held.n > 0) throw new Error(`Jira returned no worklogs for ${from} to ${to}, but ${held.n} are stored. Nothing was changed. Check that JIRA_EMAIL's account can browse every project.`);
    }
    await sql.begin(async (tx: any) => {
      await tx`delete from worklogs where day between ${from}::date and ${to}::date`;
      for (let i = 0; i < logs.length; i += 400) {
        const chunk = logs.slice(i, i + 400);
        await tx`insert into worklogs ${tx(chunk, "id", "issue_key", "summary", "project", "author_id", "author_name", "day", "hours", "comment")}
                 on conflict (id) do update set issue_key = excluded.issue_key, summary = excluded.summary, project = excluded.project,
                 author_id = excluded.author_id, author_name = excluded.author_name, day = excluded.day, hours = excluded.hours, comment = excluded.comment`;
      }
    });
    await sql`insert into settings (key, value) values ('last_sync', ${sql.json({ at: Date.now(), ok: true, count: logs.length, from, to })})
              on conflict (key) do update set value = excluded.value`;
    return { skipped: false as const, count: logs.length, from, to };
  } catch (e: any) {
    await sql`insert into settings (key, value) values ('last_sync', ${sql.json({ at: Date.now(), ok: false, count: 0, error: String(e.message || e).slice(0, 300) })})
              on conflict (key) do update set value = excluded.value`;
    throw e;
  } finally {
    await sql`update settings set value = ${sql.json(0)} where key = 'sync_started'`;
  }
}

/* ==========================================================================
   Quick update: ask Jira only for worklogs added, edited or deleted since the
   last update (2–4 small requests instead of re-downloading three weeks).
   The full window sync above stays for "Load from Jira" and the nightly job.
   ========================================================================== */
const SINCE_KEY = "jira_since";

async function setSetting(key: string, value: unknown) {
  await sql`insert into settings (key, value) values (${key}, ${sql.json(value as any)}) on conflict (key) do update set value = excluded.value`;
}

/** Follows Jira's worklog/updated or worklog/deleted pages from `since`; returns the ids and the point to continue from next time. */
async function changedIds(kind: "updated" | "deleted", since: number) {
  const ids: string[] = [];
  let path = `/rest/api/3/worklog/${kind}?since=${since}`, until = since;
  for (let g = 0; g < 100; g++) {
    const p = await jira(path);
    ids.push(...(p.values || []).map((v: any) => String(v.worklogId)));
    if (p.until) until = Number(p.until);
    if (p.lastPage !== false || !p.nextPage) break;
    path = String(p.nextPage).replace(base(), "");
  }
  return { ids, until };
}

/** Issue key, summary and project for a set of Jira issue ids. */
async function issueInfo(issueIds: string[]) {
  const out = new Map<string, { key: string; summary: string; project: string }>();
  for (let i = 0; i < issueIds.length; i += 100) {
    const chunk = issueIds.slice(i, i + 100);
    let token: string | undefined, guard = 0;
    do {
      const body: any = { jql: `id in (${chunk.join(",")})`, fields: ["summary", "project"], maxResults: 100 };
      if (token) body.nextPageToken = token;
      const p = await jira("/rest/api/3/search/jql", { method: "POST", body: JSON.stringify(body) });
      for (const it of p.issues || []) out.set(String(it.id), { key: it.key, summary: String(it.fields?.summary || "").slice(0, 160), project: it.fields?.project?.name || "" });
      token = p.isLast === false ? p.nextPageToken : undefined;
    } while (token && ++guard < 20);
  }
  return out;
}

export async function syncRecent() {
  if (!jiraConfigured()) throw new Error("Jira is not set up yet. Add JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN.");
  const [row] = await sql<{ value: any }[]>`select value from settings where key = ${SINCE_KEY}`;
  const since = row ? Number(row.value) : 0;
  // First run (or after a reset): do the normal 3-week sync once, then switch to quick updates
  if (!since) {
    const started = Date.now();
    const r = await syncJira(21);
    if (!r.skipped) await setSetting(SINCE_KEY, started - 60_000);
    return { ...r, mode: "full" as const };
  }
  const now = Date.now();
  const claim = await sql`
    insert into settings (key, value) values ('sync_started', ${sql.json(now)})
    on conflict (key) do update set value = excluded.value
    where (settings.value #>> '{}')::bigint < ${now - 180000} returning key`;
  if (!claim.length) return { skipped: true as const };
  try {
    // The login check runs alongside: a wrong login must fail loudly, not look like "nothing changed"
    const [, upd, del] = await Promise.all([jira("/rest/api/3/myself"), changedIds("updated", since), changedIds("deleted", since)]);
    const raw: any[] = [];
    for (let i = 0; i < upd.ids.length; i += 1000) {
      raw.push(...(await jira("/rest/api/3/worklog/list", { method: "POST", body: JSON.stringify({ ids: upd.ids.slice(i, i + 1000).map(Number) }) })));
    }
    const info = await issueInfo([...new Set(raw.map((w) => String(w.issueId)))]);
    const rows: Wl[] = raw.map((w) => {
      const it = info.get(String(w.issueId));
      return {
        id: String(w.id), issue_key: it?.key || "", summary: it?.summary || "", project: it?.project || "",
        author_id: w.author?.accountId || "", author_name: w.author?.displayName || "Unknown",
        day: String(w.started || "").slice(0, 10), hours: (w.timeSpentSeconds || 0) / 3600,
        comment: adfText(w.comment).replace(/\s+/g, " ").trim().slice(0, 300),
      };
    }).filter((w) => w.author_id && w.issue_key && /^\d{4}-\d{2}-\d{2}$/.test(w.day));
    if (rows.length || del.ids.length) {
      await sql.begin(async (tx: any) => {
        if (del.ids.length) await tx`delete from worklogs where id in ${tx(del.ids)}`;
        for (let i = 0; i < rows.length; i += 400) {
          const chunk = rows.slice(i, i + 400);
          await tx`insert into worklogs ${tx(chunk, "id", "issue_key", "summary", "project", "author_id", "author_name", "day", "hours", "comment")}
                   on conflict (id) do update set issue_key = excluded.issue_key, summary = excluded.summary, project = excluded.project,
                   author_id = excluded.author_id, author_name = excluded.author_name, day = excluded.day, hours = excluded.hours, comment = excluded.comment`;
        }
      });
    }
    // Continue from the earlier of the two cursors so nothing between them is skipped
    await Promise.all([
      setSetting(SINCE_KEY, Math.min(upd.until || now, del.until || now)),
      setSetting("last_sync", { at: Date.now(), ok: true, count: rows.length, deleted: del.ids.length, mode: "recent", from: new Date(since).toISOString().slice(0, 10), to: today() }),
    ]);
    return { skipped: false as const, count: rows.length, deleted: del.ids.length, mode: "recent" as const };
  } catch (e: any) {
    await setSetting("last_sync", { at: Date.now(), ok: false, count: 0, error: String(e.message || e).slice(0, 300) });
    throw e;
  } finally {
    await sql`update settings set value = ${sql.json(0)} where key = 'sync_started'`;
  }
}
