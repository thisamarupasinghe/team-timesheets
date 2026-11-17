import { periodModel } from "./queries";
import { addDays, dow, fmtD, today, daysBetween, isWeekend, WD } from "./time";
import { COUNTED } from "./format";

export type Missing = { name: string; team: string; email: string | null; days: string[] };
export type Nudge = { week: string; weekStart: string; people: Missing[] };

/** Monday of the week that contains `d` */
export const monday = (d: string) => addDays(d, -((dow(d) + 6) % 7));

/**
 * The working days the weekly reminder covers: Monday up to yesterday, so the Friday email covers Monday–Thursday.
 * Friday is never chased. Weekends and public holidays are never included.
 */
export function reminderDays(t: string, holidays: Set<string>): string[] {
  const start = monday(t);
  return daysBetween(start, addDays(start, 3)).filter((d) => d < t && !isWeekend(d) && !holidays.has(d));
}

/** Who may ever get a reminder email: active (not marked inactive under People), linked to Jira, on one of the five delivery teams. */
export const remindable = (r: { e: { active: boolean; team: string }; linked: boolean }) => r.e.active && r.linked && COUNTED.includes(r.e.team);

/** Who has a reminder day with nothing logged and no leave. Only active, Jira-linked people on the five delivery teams. */
export async function missingFor(t = today()): Promise<Nudge> {
  const first = monday(t), last = addDays(first, 3);
  const M = await periodModel(first, last);
  const days = reminderDays(t, new Set(M.hol.keys()));
  const people = M.rows
    .filter(remindable)
    .map((r) => ({
      name: r.e.name,
      team: r.e.team,
      email: r.e.email,
      days: days.filter((d) => !r.byDay.get(d) && !(M.leaveMap.get(`${r.e.id}|${d}`) || 0)).map((d) => `${WD[dow(d)]} ${fmtD(d)}`),
    }))
    .filter((p) => p.days.length > 0)
    .sort((a, b) => b.days.length - a.days.length || a.name.localeCompare(b.name));
  const label = days.length ? (days.length === 1 ? fmtD(days[0]) : `${fmtD(days[0])} – ${fmtD(days[days.length - 1])}`) : "";
  return { week: label, weekStart: first, people };
}
