import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, CalendarPlus, Clock3, ExternalLink, FolderKanban, Gauge, Link2Off, ListChecks, UserX, Trash2 } from "lucide-react";
import { requireUser, canEdit } from "@/lib/auth";
import { sql } from "@/lib/db";
import { dailyTotals, getSettings, leaveIn, worklogsFor, type Employee } from "@/lib/queries";
import { jiraBase } from "@/lib/jira";
import { resolvePeriod, daysBetween, isWeekend, today, WD, dow, fmtD, addDays } from "@/lib/time";
import { hm, isOverDay, pct } from "@/lib/format";
import { addLeave, removeLeave } from "../admin/actions";
import PageHeader from "../../components/ui/PageHeader";
import PeriodPicker from "../../components/PeriodPicker";
import StatCard from "../../components/ui/StatCard";
import Meter from "../../components/ui/Meter";
import { Badge, BandBadge } from "../../components/ui/Badge";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import Callout from "../../components/ui/Callout";
import Avatar, { teamColor } from "../../components/ui/Avatar";
import EmptyState from "../../components/ui/EmptyState";
import SubmitButton from "../../components/ui/SubmitButton";
import { ConfirmAction, ModalButton } from "../../components/ui/Dialog";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const id = Number(searchParams.id);
  if (!Number.isInteger(id)) return { title: "Person" };
  const [e] = await sql<{ name: string }[]>`select name from employees where id = ${id}`.catch(() => []);
  return { title: e?.name || "Person" };
}

export default async function Person(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const user = await requireUser();
  const editor = canEdit(user.role);
  const id = Number(searchParams.id);
  if (!Number.isInteger(id)) notFound();
  const [e] = await sql<Employee[]>`select id, name, emp_no, email, team, active, note, jira_ids from employees where id = ${id}`;
  if (!e) notFound();
  const own = !!e.email && e.email.toLowerCase() === user.email.toLowerCase();
  const canLeave = editor || own;
  const settings = await getSettings();
  const P = resolvePeriod(searchParams, settings);
  const [totals, logs, leave] = await Promise.all([dailyTotals(P.start, P.end, id), worklogsFor(id, P.start, P.end), leaveIn(P.start, P.end, id)]);
  const hol = new Map(settings.holidays.map((h) => [h.date, h.name]));
  const t = today();
  const days = daysBetween(P.start, P.end);
  const byDay = new Map(totals.map((x) => [x.day, x.secs]));
  const lv = new Map(leave.map((l) => [l.day, l]));
  const hpd = settings.hours_per_day * 3600;
  let cap = 0, capToDate = 0;
  for (const d of days) {
    if (isWeekend(d) || hol.has(d)) continue;
    const a = Math.max(0, hpd - (lv.get(d)?.hours || 0) * 3600);
    cap += a; if (d <= t) capToDate += a;
  }
  const base = P.end < t ? cap : capToDate;
  const logged = totals.reduce((s, x) => s + x.secs, 0);
  const util = base > 0 ? logged / base : null;
  const missing = days.filter((d) => d < t && !isWeekend(d) && !hol.has(d) && !byDay.get(d) && !lv.has(d)).length;

  const byProject = new Map<string, number>();
  for (const l of logs) byProject.set(l.project || "No project", (byProject.get(l.project || "No project") || 0) + l.secs);
  const projects = [...byProject.entries()].sort((a, c) => c[1] - a[1]);
  const maxP = projects[0]?.[1] || 1;

  type Log = (typeof logs)[number];
  const logsByDay = new Map<string, Log[]>();
  for (const l of logs) logsByDay.set(l.day, [...(logsByDay.get(l.day) || []), l]);
  const logDays = [...logsByDay.keys()].sort((a, b) => b.localeCompare(a));

  const self = `/person?id=${id}`;
  const back = `${self}&${P.query}`;
  const jb = jiraBase();

  // Calendar: whole weeks, Monday first
  const calStart = addDays(P.start, -((dow(P.start) + 6) % 7));
  const calEnd = addDays(P.end, (7 - dow(P.end)) % 7);
  const cal = daysBetween(calStart, calEnd);
  const heat = (v: number) => (v < hpd * 0.5 ? "h1" : v < hpd * 0.85 ? "h2" : v <= hpd * 1.05 ? "h3" : "h4");

  const leaveForm = (
    <form action={addLeave} className="drawer-form">
      <input type="hidden" name="employee_id" value={id} />
      <input type="hidden" name="back" value={`${back}&ok=leave`} />
      <div className="modal-body">
        <div className="form-grid two">
          <label className="field"><span className="field-label">From</span><input className="input" name="from" type="date" defaultValue={t >= P.start && t <= P.end ? t : P.start} required /></label>
          <label className="field"><span className="field-label">To</span><input className="input" name="to" type="date" defaultValue={t >= P.start && t <= P.end ? t : P.start} /></label>
        </div>
        <label className="field">
          <span className="field-label">Hours per day</span>
          <input className="input" name="hours" type="number" min="0.5" max="12" step="0.5" defaultValue={settings.hours_per_day} />
          <span className="field-hint">Use {settings.hours_per_day / 2} for a half day. Weekends and public holidays are skipped automatically.</span>
        </label>
        <label className="field">
          <span className="field-label">Note <span className="faint">(optional)</span></span>
          <input className="input" name="note" type="text" placeholder="Annual leave" />
        </label>
      </div>
      <div className="modal-foot">
        <button type="button" className="btn" data-close>Cancel</button>
        <SubmitButton icon={<CalendarPlus />} pendingText="Saving…">Save leave</SubmitButton>
      </div>
    </form>
  );

  return (
    <div className="stack-lg page-enter">
      <PageHeader
        crumbs={editor || !own ? [{ href: `/?${P.query}`, label: "Overview" }] : undefined}
        current={e.name}
        title={<><Avatar name={e.name} team={e.team} size="lg" /><span>{e.name}</span></>}
        subtitle={
          <span className="row">
            <Badge tone="outline" icon={<span className="team-dot" style={{ ["--tc" as string]: teamColor(e.team) }} />}>{e.team}</Badge>
            {e.emp_no && <span className="mono muted">{e.emp_no}</span>}
            {!e.active && <Badge tone="warning">Inactive</Badge>}
            {!e.jira_ids.length && <Badge tone="danger" icon={<Link2Off />}>No Jira account</Badge>}
          </span>
        }
        actions={canLeave ? (
          <ModalButton drawer trigger={{ label: "Add leave", icon: <CalendarPlus />, variant: "primary" }} title={`Add leave for ${e.name}`} description="Leave reduces capacity, so it doesn't count against utilisation." icon={<UserX />}>
            {leaveForm}
          </ModalButton>
        ) : undefined}
      >
        <PeriodPicker P={P} base={self} />
      </PageHeader>

      {!e.jira_ids.length && (
        <Callout tone="warning" title="No Jira account linked">
          No time can be shown for {e.name} until a Jira account is linked{editor ? <> on <Link href="/admin">People</Link></> : ""}.
        </Callout>
      )}

      <section className="stats" aria-label="Summary">
        <StatCard label="Logged" icon={<Clock3 />} value={hm(logged)} sub={`${logs.length} worklog${logs.length === 1 ? "" : "s"}`} />
        <StatCard label={P.end < t ? "Capacity" : "Capacity to date"} icon={<CalendarClock />} value={hm(base)} sub={leave.length ? `after ${leave.length} day${leave.length > 1 ? "s" : ""} of leave` : `${settings.hours_per_day}h per working day`} />
        <StatCard label="Utilisation" icon={<Gauge />} value={pct(util)} sub={<BandBadge util={util} />}><Meter util={util} /></StatCard>
        <StatCard label="Days with no time" icon={<ListChecks />} tone={missing ? "warn" : undefined} value={missing} sub={missing ? "past working days, not on leave" : "All caught up"} />
      </section>

      <div className="split">
        <Card>
          <CardHeader title="Calendar" description="Hours logged each day. Hover a day for its tickets." />
          <CardBody>
            <div className="cal" role="grid" aria-label="Hours by day">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="cal-dow" role="columnheader">{d}</div>)}
              {cal.map((d) => {
                const inP = d >= P.start && d <= P.end;
                const v = byDay.get(d) || 0;
                const l = lv.get(d);
                const h = hol.get(d);
                const we = isWeekend(d);
                const keys = [...new Set((logsByDay.get(d) || []).map((x) => x.issue_key))];
                const state = !inP ? "out" : v ? `${heat(v)}${isOverDay(v) ? " over" : ""}` : l ? "lv" : h ? "hol" : we ? "we" : d < t ? "gap" : d > t ? "future" : "";
                const tip = [`${WD[dow(d)]} ${fmtD(d)}`, v ? hm(v) : null, v && isOverDay(v) ? "Over 12h in one day: probably several days booked to one date. Check in Jira." : null, l ? `Leave ${hm(l.hours * 3600)}${l.note ? ` · ${l.note}` : ""}` : null, h || null, keys.length ? keys.join(", ") : null, !v && !l && !h && !we && d < t && inP ? "Nothing logged" : null].filter(Boolean).join("\n");
                return (
                  <div key={d} role="gridcell" className={`cal-day ${state}${d === t ? " today" : ""}`} title={inP ? tip : undefined} aria-label={inP ? tip.replace(/\n/g, ", ") : undefined}>
                    <span className="cal-date">{+d.slice(8, 10)}</span>
                    {inP && (v ? <span className="cal-hours num">{hm(v)}</span> : l ? <span className="cal-tag leave"><span className="tag-long">Leave</span><span className="tag-short" aria-hidden="true">Lv</span></span> : h ? <span className="cal-tag" title={h}><span className="tag-long">Holiday</span><span className="tag-short" aria-hidden="true">Hol</span></span> : null)}
                    {inP && keys.length > 0 && <span className="cal-meta">{keys.length} ticket{keys.length > 1 ? "s" : ""}</span>}
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="By project" description={projects.length ? `${projects.length} project${projects.length > 1 ? "s" : ""} this period` : undefined} />
          <CardBody>
            {projects.length ? (
              <div className="bars">
                {projects.map(([p, s]) => (
                  <div className="bar-row stacked" key={p}>
                    <span className="label" title={p}>{p}</span>
                    <div className="bar-track"><i style={{ width: `${(s / maxP) * 100}%` }} /></div>
                    <span className="value num"><b>{hm(s)}</b><small>{logged ? Math.round((s / logged) * 100) : 0}%</small></span>
                  </div>
                ))}
              </div>
            ) : <EmptyState compact icon={<FolderKanban />} title="No project time" text="Nothing logged in this period." />}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Worklogs" count={logs.length} description="Every Jira worklog in this period, newest first." />
        {logs.length ? (
          <div className="wl">
            {logDays.map((d) => {
              const ls = logsByDay.get(d)!;
              return (
                <div key={d} className="wl-day">
                  <div className="wl-head"><b>{WD[dow(d)]} {fmtD(d)}</b><span className="num muted">{hm(ls.reduce((s, x) => s + x.secs, 0))}</span></div>
                  {ls.map((l) => (
                    <div key={l.id} className="wl-item">
                      <a className="key" href={`${jb}/browse/${encodeURIComponent(l.issue_key)}`} target="_blank" rel="noopener noreferrer" title="Open in Jira">{l.issue_key}<ExternalLink aria-hidden="true" /></a>
                      <div className="grow">
                        <div className="wl-summary">{l.summary}</div>
                        <div className="small muted">{l.project}{l.comment ? ` · ${l.comment}` : ""}</div>
                      </div>
                      <span className="num strong">{hm(l.secs)}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ) : <EmptyState icon={<ListChecks />} title="Nothing logged in this period" text={e.jira_ids.length ? "Worklogs from Jira appear here a few minutes after they're logged." : "Link a Jira account to see worklogs."} />}
      </Card>

      <Card>
        <CardHeader title="Leave" count={leave.length} description="Leave in this period. It's taken off capacity." />
        {leave.length ? (
          <div className="list">
            {leave.map((l) => (
              <div key={l.day} className="list-item">
                <span className="leave-icon" aria-hidden="true"><UserX size={16} /></span>
                <div className="grow">
                  <div className="title">{WD[dow(l.day)]} {fmtD(l.day)}</div>
                  <div className="sub">{l.note || "Leave"}</div>
                </div>
                <span className="num muted">{hm(l.hours * 3600)}</span>
                {canLeave && (
                  <ConfirmAction
                    trigger={{ label: `Remove leave on ${fmtD(l.day)}`, icon: <Trash2 />, variant: "ghost", size: "sm", iconOnly: true }}
                    action={removeLeave} fields={{ employee_id: id, day: l.day, back: `${back}&ok=leave-removed` }}
                    title={`Remove leave on ${WD[dow(l.day)]} ${fmtD(l.day)}?`} description="Capacity goes back up for that day. You can put it back from the Recycle bin."
                    confirmLabel="Remove leave" icon={<Trash2 />}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState compact icon={<UserX />} title="No leave recorded" text={canLeave ? "Add leave so days off don't count against utilisation." : undefined}
            action={canLeave ? <ModalButton drawer trigger={{ label: "Add leave", icon: <CalendarPlus /> }} title={`Add leave for ${e.name}`} description="Leave reduces capacity, so it doesn't count against utilisation." icon={<UserX />}>{leaveForm}</ModalButton> : undefined} />
        )}
      </Card>
    </div>
  );
}
