import { sql } from "./db";
import { addDays, today } from "./time";

export type Wl = { id: string; issue_key: string; summary: string; project: string; author_id: string; author_name: string; day: string; hours: number; comment: string };

const base = () => (process.env.JIRA_BASE_URL || "").replace(/\/$/, "");
export const jiraConfigured = () => !!(process.env.JIRA_BASE_URL && process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN);
export const jiraBase = base;

async function jira(path: string, init?: RequestInit, retry = true): Promise<any> {
  const auth = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString("base64");
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
