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
        {tabs.filter((t) => t[3]).map(([k, label, href]) => (
          <Link key={k} href={href} className={active === k || (k === "dash" && active === "person" && !own) || (k === "mine" && active === "person" && !!own) ? "on" : ""}>{label}</Link>
        ))}
      </nav>
    </header>
  );
}
