import Link from "next/link";
import type { Period } from "@/lib/time";
import { getSync } from "@/lib/queries";
import { jiraConfigured } from "@/lib/jira";
import { getUser, canEdit } from "@/lib/auth";
import { employeeByEmail } from "@/lib/queries";
import AutoSync from "./AutoSync";
import SignOutButton from "./SignOutButton";
import ThemeToggle from "./ThemeToggle";

type Active = "dash" | "projects" | "mine" | "unmatched" | "admin" | "activity" | "bin" | "person";

const ICONS: Record<string, string> = {
  dash: "M3 5h18v15H3zM3 10h18M8 3v4M16 3v4",
  projects: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  mine: "M4 5h16v15H4zM4 10h16M9 15h6",
  unmatched: "M9 15l6-6M10 6l1-1a4 4 0 0 1 6 6l-1 1M14 18l-1 1a4 4 0 0 1-6-6l1-1",
  admin: "M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 19v-1a3 3 0 0 0-2-2.8M17 5.2a3 3 0 0 1 0 5.6",
  bin: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  activity: "M4 6h16M4 12h16M4 18h10",
  more: "M5 12h.01M12 12h.01M19 12h.01",
};
const Icon = ({ k }: { k: string }) => (
  <svg className="tic" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[k]} /></svg>
);

export default async function Header({ active, period, base = "/" }: { active: Active; period?: Period; base?: string }) {
  const modes = [["sprint", "Sprint"], ["week", "Week"], ["month", "Month"]] as const;
  const join = (b: string, q: string) => (b.includes("?") ? `${b}&${q.slice(1)}` : b + q);
  const sync = await getSync().catch(() => null);
  const user = await getUser();
  const editor = canEdit(user?.role);
  const admin = user?.role === "admin";
  const own = user && !editor ? await employeeByEmail(user.email).catch(() => null) : null;
  const q = period ? `?${period.query}` : "";
  const tabs: [Active, string, string, boolean][] = [
    ["dash", "Timesheet", `/${q}`, true],
    ["projects", "By project", `/projects${q}`, true],
    ["mine", "My leave", own ? `/person?id=${own.id}` : "/", !!own],
    ["unmatched", "Unmatched", "/unmatched", admin],
    ["admin", "Roster & settings", "/admin", editor],
    ["bin", "Recycle bin", "/bin", editor],
    ["activity", "Activity", "/activity", admin],
  ];
  const shown = tabs.filter((t) => t[3]);
  const isOn = (k: Active) => active === k || (k === "dash" && active === "person" && !own) || (k === "mine" && active === "person" && !!own);
  const primary = shown.length <= 5 ? shown : shown.slice(0, 4), extra = shown.length <= 5 ? [] : shown.slice(4);
  return (
    <header className="bar">
      <div className="wrap">
        <div className="brand"><b>Team Timesheets</b></div>
        {period && (
          <>
            <div className="seg" role="group" aria-label="Period type">
              {modes.map(([m, l]) => (
                <Link key={m} className={period.mode === m ? "on" : ""} href={join(base, `?mode=${m}`)}>{l}</Link>
              ))}
              <Link className={period.mode === "custom" ? "on" : ""} href={join(base, `?mode=custom&from=${period.start}&to=${period.end}`)}>Custom</Link>
            </div>
            <div className="period">
              <Link className="iconbtn" href={join(base, period.prev)} aria-label="Previous period">‹</Link>
              <span>{period.label}</span>
              <Link className="iconbtn" href={join(base, period.next)} aria-label="Next period">›</Link>
            </div>
          </>
        )}
        {period && period.mode === "custom" && (
          <form className="range" action={base.split("?")[0]} method="get" aria-label="Custom date range">
            {[...new URLSearchParams(base.split("?")[1] || "")].map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <input type="hidden" name="mode" value="custom" />
            <label>From <input type="date" name="from" defaultValue={period.start} required /></label>
            <label>To <input type="date" name="to" defaultValue={period.end} required /></label>
            <button className="btn">Apply</button>
          </form>
        )}
        {process.env.DEMO !== "1" && <AutoSync lastAt={sync?.at ?? null} configured={jiraConfigured()} error={sync && !sync.ok ? sync.error || "Failed" : null} />}
        {user?.role === "admin" && <span className="who-am-i muted" title={user.email}>Admin</span>}
        <ThemeToggle />
        {user && process.env.DEMO !== "1" && <SignOutButton />}
      </div>
      <nav className="tabs wrap" aria-label="Sections">
        {shown.map(([k, label, href]) => (
          <Link key={k} href={href} className={isOn(k) ? "on" : ""} aria-current={isOn(k) ? "page" : undefined}>{label}</Link>
        ))}
      </nav>
      <nav className="bnav" aria-label="Sections">
        {primary.map(([k, label, href]) => (
          <Link key={k} href={href} className={isOn(k) ? "on" : ""} aria-current={isOn(k) ? "page" : undefined}><Icon k={k} /><span>{label}</span></Link>
        ))}
        {extra.length > 0 && (
          <details className={`bmore${extra.some(([k]) => isOn(k)) ? " on" : ""}`}>
            <summary><Icon k="more" /><span>More</span></summary>
            <div className="bsheet">
              {extra.map(([k, label, href]) => <Link key={k} href={href} className={isOn(k) ? "on" : ""}><Icon k={k} /><span>{label}</span></Link>)}
            </div>
          </details>
        )}
      </nav>
    </header>
  );
}
