import { sql } from "./db";
import { addDays, daysBetween, isWeekend, today, type Settings } from "./time";
import { COUNTED } from "./format";

export async function getSettings(): Promise<Settings> {
  const rows = await sql<{ key: string; value: any }[]>`select key, value from settings`;
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    hours_per_day: Number(m.hours_per_day ?? 7),
    sprint_anchor: String(m.sprint_anchor ?? "2026-10-12"),
    sprint_anchor_number: Number(m.sprint_anchor_number ?? 63),
    holidays: Array.isArray(m.holidays) ? m.holidays : [],
  };
}

export type SyncInfo = { at: number; ok: boolean; count: number; error?: string; from?: string; to?: string } | null;
export async function getSync(): Promise<SyncInfo> {
  const [r] = await sql<{ value: any }[]>`select value from settings where key = 'last_sync'`;
  return r?.value ?? null;
}

export type Employee = { id: number; name: string; emp_no: string | null; email: string | null; team: string; active: boolean; note: string | null; jira_ids: string[] };
export async function getEmployees(activeOnly = true) {
  return activeOnly
    ? sql<Employee[]>`select id, name, emp_no, email, team, active, note, jira_ids from employees where active order by name`
    : sql<Employee[]>`select id, name, emp_no, email, team, active, note, jira_ids from employees order by name`;
}

/** Logged seconds per person per work date */
export async function dailyTotals(start: string, end: string, employeeId?: number) {
  return sql<{ employee_id: number; day: string; secs: number }[]>`
    select e.id as employee_id, to_char(w.day, 'YYYY-MM-DD') as day, round(sum(w.hours) * 3600)::int as secs
    from worklogs w join employees e on w.author_id = any(e.jira_ids)
    where w.day between ${start}::date and ${end}::date
    ${employeeId ? sql`and e.id = ${employeeId}` : sql``}
    group by 1, 2`;
}

export async function worklogsFor(employeeId: number, start: string, end: string) {
  return sql<{ id: string; issue_key: string; summary: string | null; project: string | null; day: string; secs: number; comment: string | null }[]>`
    select w.id, w.issue_key, w.summary, w.project, to_char(w.day, 'YYYY-MM-DD') as day, round(w.hours * 3600)::int as secs, w.comment
    from worklogs w join employees e on w.author_id = any(e.jira_ids)
    where e.id = ${employeeId} and w.day between ${start}::date and ${end}::date
    order by w.day, w.issue_key`;
}

export async function allWorklogs(start: string, end: string) {
  return sql<{ day: string; issue_key: string; summary: string | null; project: string | null; secs: number; comment: string | null; name: string | null; team: string | null; emp_no: string | null }[]>`
    select to_char(w.day, 'YYYY-MM-DD') as day, w.issue_key, w.summary, w.project, round(w.hours * 3600)::int as secs, w.comment,
           coalesce(e.name, w.author_name) as name, e.team, e.emp_no
    from worklogs w left join employees e on w.author_id = any(e.jira_ids)
    where w.day between ${start}::date and ${end}::date order by w.day, 7, w.issue_key`;
}

/** Jira people who logged time but are not linked to anyone on the roster */
export async function unmatched(start: string, end: string) {
  return sql<{ author_id: string; name: string | null; secs: number; n: number }[]>`
    select w.author_id, max(w.author_name) as name, round(sum(w.hours) * 3600)::int as secs, count(*)::int as n
    from worklogs w
    where w.day between ${start}::date and ${end}::date
      and not exists (select 1 from employees e where w.author_id = any(e.jira_ids))
    group by 1 order by 3 desc`;
}

export async function leaveIn(start: string, end: string, employeeId?: number) {
  return sql<{ employee_id: number; day: string; hours: number; note: string | null }[]>`
    select employee_id, to_char(day, 'YYYY-MM-DD') as day, hours::float as hours, note from leave
    where day between ${start}::date and ${end}::date
    ${employeeId ? sql`and employee_id = ${employeeId}` : sql``} order by day`;
}

export type Row = {
  e: Employee; byDay: Map<string, number>;
  logged: number; cap: number; base: number; util: number | null; missing: number; linked: boolean;
};

/** Everything the dashboard needs for a period */
export async function periodModel(start: string, end: string, showInactive = false) {
  const [settings, everyone, totals, leave] = await Promise.all([
    getSettings(), getEmployees(false), dailyTotals(start, end), leaveIn(start, end),
  ]);
  const employees = everyone;
  const hol = new Map(settings.holidays.map((h) => [h.date, h.name]));
  const days = daysBetween(start, end);
  const t = today();
  const hpd = settings.hours_per_day * 3600;
  const leaveMap = new Map(leave.map((l) => [`${l.employee_id}|${l.day}`, l.hours * 3600]));
  const rows: Row[] = employees.map((e) => ({ e, byDay: new Map(), logged: 0, cap: 0, base: 0, util: null, missing: 0, linked: e.jira_ids.length > 0 }));
  const idx = new Map(rows.map((r) => [r.e.id, r]));
  for (const x of totals) {
    const r = idx.get(x.employee_id);
    if (!r) continue;
    r.byDay.set(x.day, (r.byDay.get(x.day) || 0) + x.secs);
    r.logged += x.secs;
  }
  const finished = end < t;
  for (const r of rows) {
    let cap = 0, capToDate = 0;
    for (const d of days) {
      if (isWeekend(d) || hol.has(d)) continue;
      const avail = Math.max(0, hpd - (leaveMap.get(`${r.e.id}|${d}`) || 0));
      cap += avail;
      if (d <= t) capToDate += avail;
      if (d < t && avail > 0 && !r.byDay.get(d)) r.missing++;
    }
    r.cap = cap; r.base = finished ? cap : capToDate;
    // Someone marked inactive who logged nothing in this period has no capacity and is hidden unless asked for
    if (!r.e.active && r.logged === 0) { r.cap = 0; r.base = 0; r.missing = 0; }
    r.util = r.base > 0 ? r.logged / r.base : null;
  }
  const hiddenInactive = rows.filter((r) => !r.e.active && r.logged === 0).length;
  if (!showInactive) { for (let i = rows.length - 1; i >= 0; i--) if (!rows[i].e.active && rows[i].logged === 0) rows.splice(i, 1); }
  const teams = COUNTED.map((team) => {
    const rs = rows.filter((r) => r.e.team === team);
    const logged = rs.reduce((s, r) => s + r.logged, 0), base = rs.reduce((s, r) => s + r.base, 0);
    return { team, rows: rs, logged, base, util: base > 0 ? logged / base : null, linked: rs.filter((r) => r.linked).length };
  });
  return { settings, days, rows, teams, hol, leaveMap, today: t, inProgress: start <= t && end >= t, hiddenInactive };
}

/** Hours per Jira project for people on the roster, with who logged them */
export async function projectTotals(start: string, end: string) {
  return sql<{ project: string; name: string; team: string; secs: number }[]>`
    select coalesce(w.project, 'No project') as project, e.name, e.team, round(sum(w.hours) * 3600)::int as secs
    from worklogs w join employees e on w.author_id = any(e.jira_ids)
    where w.day between ${start}::date and ${end}::date
    group by 1, 2, 3`;
}

/** The roster person whose work email matches this sign-in (set by the admin), if any */
export async function employeeByEmail(email: string) {
  const [r] = await sql<{ id: number; name: string }[]>`select id, name from employees where lower(email) = ${email.toLowerCase()} limit 1`;
  return r ?? null;
}
