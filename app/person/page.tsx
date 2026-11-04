import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "../components/Header";
import { requireUser, canEdit } from "@/lib/auth";
import { sql } from "@/lib/db";
import { dailyTotals, getSettings, leaveIn, worklogsFor, type Employee } from "@/lib/queries";
import { jiraBase } from "@/lib/jira";
import { resolvePeriod, daysBetween, isWeekend, today, WD, dow, fmtD } from "@/lib/time";
import { band, hm, pct } from "@/lib/format";
import { addLeave, removeLeave } from "../admin/actions";

export const dynamic = "force-dynamic";

export default async function Person({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const user = await requireUser();
  const editor = canEdit(user.role);
  const id = Number(searchParams.id);
  if (!Number.isInteger(id)) notFound();
  const [e] = await sql<Employee[]>`select id, name, emp_no, email, team, active, note, jira_ids from employees where id = ${id}`;
  if (!e) notFound();
  const canLeave = editor || (!!e.email && e.email.toLowerCase() === user.email.toLowerCase());
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
  const b = band(util);
  const byProject = new Map<string, number>();
  for (const l of logs) byProject.set(l.project || "No project", (byProject.get(l.project || "No project") || 0) + l.secs);
  const projects = [...byProject.entries()].sort((a, c) => c[1] - a[1]);
  const maxP = projects[0]?.[1] || 1;
  const self = `/person?id=${id}`;
  const jb = jiraBase();

  return (
    <>
      <Header active="person" period={P} base={self} />
      <main className="wrap">
        <div>
          <Link href={`/?${P.query}`} className="muted">← Dashboard</Link>
          <h1 className="page">{e.name}</h1>
          <span className="muted">{e.team}{e.emp_no ? ` · ${e.emp_no}` : ""}</span>
        </div>
        {!e.jira_ids.length && <div className="notice warn"><b>No Jira account linked</b><p>No time can be shown for {e.name} until a Jira account is linked{editor ? <> on <Link href="/admin">Roster &amp; settings</Link></> : ""}.</p></div>}
        <section className="kpis">
          <div className="kpi"><div className="k">Logged</div><div className="v num">{hm(logged)}</div><div className="s">{logs.length} worklogs</div></div>
          <div className="kpi"><div className="k">{P.end < t ? "Capacity" : "Capacity to date"}</div><div className="v num">{hm(base)}</div></div>
          <div className="kpi"><div className="k">Utilisation</div><div className="v num">{pct(util)}</div><div className="s"><span className={`pill ${b.cls}`}>{b.label}</span></div></div>
        </section>

        <section className="panel">
          <div className="panel-h"><h2>Day by day</h2></div>
          <div className="scroll">
            <table>
              <thead><tr><th>Day</th><th className="r">Logged</th><th>Tickets</th></tr></thead>
              <tbody>
                {days.map((d) => {
                  const keys = [...new Set(logs.filter((l) => l.day === d).map((l) => l.issue_key))];
                  const tag = hol.has(d) ? hol.get(d) : lv.has(d) ? `Leave ${hm(lv.get(d)!.hours * 3600)}` : isWeekend(d) ? "Weekend" : "";
                  return (
                    <tr key={d} style={isWeekend(d) ? { background: "var(--weekend)" } : undefined}>
                      <td className="num" style={{ whiteSpace: "nowrap" }}>{WD[dow(d)]} {fmtD(d)}{tag ? <div className="pmeta">{tag}</div> : null}</td>
                      <td className="r num"><b>{byDay.get(d) ? hm(byDay.get(d)!) : "–"}</b></td>
                      <td className="num" style={{ fontSize: 12 }}>{keys.join(", ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-h"><h2>By project</h2></div>
          <div className="panel-b">
            {projects.length ? (
              <div className="bars">
                {projects.map(([p, s]) => (
                  <div className="barrow" key={p}><span className="lbl" title={p}>{p}</span><div className="track"><i style={{ width: `${(s / maxP) * 100}%` }} /></div><span className="num">{hm(s)}</span></div>
                ))}
              </div>
            ) : <p className="muted" style={{ margin: 0 }}>No time logged in this period.</p>}
          </div>
        </section>

        <section className="panel">
          <div className="panel-h"><h2>Worklogs ({logs.length})</h2></div>
          <div className="scroll">
            <table>
              <thead><tr><th>Date</th><th>Ticket</th><th className="r">Time</th></tr></thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="num" style={{ whiteSpace: "nowrap" }}>{WD[dow(l.day)]} {fmtD(l.day)}</td>
                    <td>
                      <a className="num" href={`${jb}/browse/${encodeURIComponent(l.issue_key)}`} target="_blank" rel="noopener noreferrer">{l.issue_key}</a> {l.summary}
                      <div className="pmeta">{l.project}{l.comment ? ` · ${l.comment}` : ""}</div>
                    </td>
                    <td className="r num">{hm(l.secs)}</td>
                  </tr>
                ))}
                {!logs.length && <tr><td colSpan={3} className="muted">Nothing logged in this period.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-h"><h2>Leave in this period</h2></div>
          <div className="panel-b">
            {leave.length ? (
              <table><tbody>{leave.map((l) => (
                <tr key={l.day}><td className="num">{WD[dow(l.day)]} {fmtD(l.day)}</td><td>{l.note || "Leave"}</td><td className="r num">{hm(l.hours * 3600)}</td>
                  <td className="r">{canLeave && <form action={removeLeave}><input type="hidden" name="employee_id" value={id} /><input type="hidden" name="day" value={l.day} /><input type="hidden" name="back" value={`${self}&${P.query}`} /><button className="btn danger">Remove</button></form>}</td></tr>
              ))}</tbody></table>
            ) : <p className="muted" style={{ margin: 0 }}>No leave recorded.</p>}
            {canLeave && <form className="form" action={addLeave}>
              <input type="hidden" name="employee_id" value={id} />
              <input type="hidden" name="back" value={`${self}&${P.query}`} />
              <label htmlFor="lf">From<input id="lf" name="from" type="date" defaultValue={P.start} required /></label>
              <label htmlFor="lt">To<input id="lt" name="to" type="date" defaultValue={P.start} /></label>
              <label htmlFor="lh">Hours per day<input id="lh" name="hours" type="number" min="0.5" max="12" step="0.5" defaultValue={settings.hours_per_day} style={{ width: 90 }} /></label>
              <label htmlFor="ln">Note<input id="ln" name="note" type="text" placeholder="Annual leave" /></label>
              <button className="btn">Add leave</button>
            </form>}
          </div>
        </section>
      </main>
    </>
  );
}
