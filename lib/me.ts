import { sql } from "./db";
import { previewPersonId } from "./auth";
import { dailyTotals, getSettings, leaveIn } from "./queries";
import { addDays, daysBetween, today } from "./time";
import { monday } from "./nudge";

/** The roster person for the signed-in account (matched by work email). Locally, the previewed person if one is set. */
export async function ownEmployee(email: string): Promise<{ id: number; name: string } | null> {
  const pid = await previewPersonId();
  const [r] = pid
    ? await sql<{ id: number; name: string }[]>`select id, name from employees where id = ${pid} limit 1`
    : await sql<{ id: number; name: string }[]>`select id, name from employees where lower(email) = ${email.toLowerCase()} limit 1`;
  return r ?? null;
}

export type MyDay = { d: string; secs: number; state: "logged" | "missing" | "leave" | "holiday" | "today" | "future"; note?: string };
export type MyWeek = { start: string; end: string; days: MyDay[]; logged: number; base: number; util: number | null; missing: string[]; linked: boolean; hpd: number };

/**
 * Last week (the Monday–Friday before this one) for one person: hours per day, which working days have
 * nothing logged (no leave, no holiday), and hours vs capacity.
 */
export async function myWeek(employeeId: number, t = today()): Promise<MyWeek> {
  const start = addDays(monday(t), -7), end = addDays(start, 4);
  const [settings, totals, leave, [emp]] = await Promise.all([
    getSettings(), dailyTotals(start, end, employeeId), leaveIn(start, end, employeeId),
    sql<{ jira_ids: string[] }[]>`select jira_ids from employees where id = ${employeeId}`,
  ]);
  const hpd = settings.hours_per_day * 3600;
  const hol = new Map(settings.holidays.map((h) => [h.date, h.name]));
  const secs = new Map(totals.map((x) => [x.day, x.secs]));
  const lv = new Map(leave.map((l) => [l.day, l.hours * 3600]));
  let logged = 0, base = 0;
  const missing: string[] = [];
  const days: MyDay[] = daysBetween(start, end).map((d) => {
    const v = secs.get(d) || 0, l = lv.get(d) || 0, h = hol.get(d);
    logged += v;
    const avail = h ? 0 : Math.max(0, hpd - l);
    if (d <= t) base += avail;
    if (v) return { d, secs: v, state: "logged" };
    if (h) return { d, secs: 0, state: "holiday", note: h };
    if (l >= hpd) return { d, secs: 0, state: "leave" };
    if (d === t) return { d, secs: 0, state: "today" };
    if (d > t) return { d, secs: 0, state: "future" };
    missing.push(d);
    return { d, secs: 0, state: "missing" };
  });
  return { start, end, days, logged, base, util: base > 0 ? logged / base : null, missing, linked: (emp?.jira_ids || []).length > 0, hpd };
}
