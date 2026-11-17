import Link from "next/link";
import { CalendarCheck2, CalendarDays, ExternalLink, Plus } from "lucide-react";
import type { MyWeek } from "@/lib/me";
import { hm, pct } from "@/lib/format";
import { dow, fmtD, WD } from "@/lib/time";
import Meter from "./ui/Meter";

/** "Last week": the signed-in person's own previous Monday–Friday, above the team view. */
export default function MyWeekCard({ name, personId, w, jiraUrl }: { name: string; personId: number; w: MyWeek; jiraUrl: string | null }) {
  const first = name.split(" ")[0];
  const n = w.missing.length;
  const rest = !w.linked ? "your Jira account isn't linked yet" : n ? `you have ${n} day${n === 1 ? "" : "s"} to log` : "you're all caught up";
  // One line on every screen: the font shrinks a little for long names instead of wrapping
  const chars = `Hi ${first}, ${rest}`.length;
  return (
    <section className="card myweek" aria-label="Last week">
      <div className="mw-main">
        <p className="mw-eyebrow">Last week · {fmtD(w.start)} – {fmtD(w.end)}</p>
        <h2 className="mw-title" style={{ ["--chars" as string]: chars }}>
          Hi {first},{" "}
          {!w.linked ? "your Jira account isn't linked yet"
            : n ? <>you have <span className="mw-warn">{n} day{n === 1 ? "" : "s"} to log</span></>
              : <span className="mw-ok">you're all caught up</span>}
        </h2>
        <p className="mw-sub">
          {!w.linked ? "Hours can't show until an admin links your Jira account under People."
            : n ? "If you were off, add it as leave."
              : "Every working day last week has time or leave on it."}
        </p>
        <div className="mw-hours">
          <span className="num"><b>{hm(w.logged)}</b> logged of {hm(w.base)}{w.util != null ? ` · ${pct(w.util)}` : ""}</span>
          <Meter util={w.util} size="sm" label="Your utilisation last week" />
        </div>
      </div>

      <ol className="mw-days" aria-label="Your days last week">
        {w.days.map((x) => (
          <li key={x.d} className={`mw-day ${x.state}`} title={x.note || undefined}>
            <span className="mw-dow">{WD[dow(x.d)]}</span>
            <span className="mw-date num">{+x.d.slice(8, 10)}</span>
            <span className="mw-val num">
              {x.state === "logged" ? hm(x.secs) : x.state === "missing" ? "Missing" : x.state === "leave" ? "Leave" : x.state === "holiday" ? "Holiday" : x.state === "today" ? "Today" : "–"}
            </span>
          </li>
        ))}
      </ol>

      <div className="mw-actions">
        {jiraUrl && <a className="btn btn-primary" href={jiraUrl} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" />Log time in Jira</a>}
        <Link className="btn" href={`/person?id=${personId}`}><Plus aria-hidden="true" />Add leave</Link>
        <Link className="btn mw-soft" href={`/person?id=${personId}`}>{n ? <CalendarDays aria-hidden="true" /> : <CalendarCheck2 aria-hidden="true" />}My timesheet</Link>
      </div>
    </section>
  );
}
