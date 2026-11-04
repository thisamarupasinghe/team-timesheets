import Link from "next/link";
import Header from "../components/Header";
import { requireAdmin } from "@/lib/auth";
import { recentChanges, recentLogins, loginSummary } from "@/lib/audit";
import { linkEmail } from "../admin/actions";
import { getEmployees } from "@/lib/queries";

export const dynamic = "force-dynamic";
const TZ = process.env.APP_TIMEZONE || "UTC";
const OK: Record<string, string> = { restored: "Person restored.", email: "Work email linked." };
const ERR: Record<string, string> = { restore: "That entry has no saved copy to restore.", exists: "Someone with that name is already on the roster." };
const fmt = (v: string) => new Date(v).toLocaleString("en-GB", { timeZone: TZ, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function Activity({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const user = await requireAdmin();
  const isAdmin = user.role === "admin";
  const logins = isAdmin && searchParams.view === "logins";
  const q = (searchParams.q || "").trim();
  const people = logins ? await getEmployees(true) : [];
  const known = new Set(people.map((x) => (x.email || "").toLowerCase()));
  const [changes, loginRows, summary] = await Promise.all([
    logins ? Promise.resolve([]) : recentChanges(500, q),
    logins ? recentLogins(500, q) : Promise.resolve([]),
    logins ? loginSummary() : Promise.resolve([]),
  ]);
  return (
    <>
      <Header active="activity" />
      <main className="wrap">
        <h1 className="page">Activity</h1>
        {isAdmin && (
          <div className="seg" style={{ alignSelf: "flex-start" }} role="group" aria-label="Activity type">
            <Link className={!logins ? "on" : ""} href="/activity">Changes</Link>
            <Link className={logins ? "on" : ""} href="/activity?view=logins">Sign-ins</Link>
          </div>
        )}
        {searchParams.ok && OK[searchParams.ok] && <div className="notice ok">{OK[searchParams.ok]}</div>}
        {searchParams.err && ERR[searchParams.err] && <div className="notice warn">{ERR[searchParams.err]}</div>}

        {logins ? (
          <>
            <section className="panel">
              <div className="panel-h"><h2>Who has signed in</h2><span className="muted" style={{ fontSize: 12 }}>Most recent first</span></div>
              <div className="scroll">
                <table className="stack">
                  <thead><tr><th>Person</th><th>Last signed in</th><th className="r">Sign-ins</th><th>Person</th></tr></thead>
                  <tbody>
                    {summary.map((r) => (
                      <tr key={r.email}><td>{r.email}</td><td className="num" style={{ whiteSpace: "nowrap" }}>{fmt(r.last)}</td><td className="r num">{r.n}</td>
                        <td>{known.has(r.email.toLowerCase()) ? <span className="muted">{people.find((x) => (x.email || "").toLowerCase() === r.email.toLowerCase())?.name}</span> : (
                          <form className="form" action={linkEmail}>
                            <input type="hidden" name="email" value={r.email} />
                            <select name="employee_id" aria-label={`Link ${r.email} to a person`} defaultValue=""><option value="" disabled>Link to person…</option>{people.filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
                            <button className="btn">Link</button>
                          </form>)}</td></tr>
                    ))}
                    {!summary.length && <tr><td colSpan={4} className="muted">No sign-ins recorded yet. From now on, every sign-in is listed here.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="panel">
              <div className="panel-h">
                <h2>Sign-in history</h2>
                <form className="form" action="/activity" method="get">
                  <input type="hidden" name="view" value="logins" />
                  <input name="q" type="search" placeholder="Search an email" defaultValue={q} aria-label="Search sign-ins" />
                </form>
              </div>
              <div className="scroll">
                <table className="stack">
                  <thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead>
                  <tbody>
                    {loginRows.map((r) => (
                      <tr key={r.id}>
                        <td className="num" style={{ whiteSpace: "nowrap" }}>{fmt(r.at)}</td>
                        <td>{r.email}</td>
                        <td>{r.event === "Sign-in refused" ? <span className="pill b0">Sign-in refused</span> : r.event}</td>
                      </tr>
                    ))}
                    {!loginRows.length && <tr><td colSpan={3} className="muted">{q ? "Nothing matches that search." : "Nothing recorded yet."}</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>Only the admin can see this. A person who is signed out automatically after 30 minutes without activity shows as &ldquo;Signed out&rdquo;. &ldquo;Sign-in refused&rdquo; means someone tried a Google account that isn&apos;t allowed.</p>
          </>
        ) : (
          <>
            <section className="panel">
              <div className="panel-h">
                <h2>Who changed what</h2>
                <form className="form" action="/activity" method="get">
                  <input name="q" type="search" placeholder="Search name, person or action" defaultValue={q} aria-label="Search activity" />
                </form>
              </div>
              <div className="scroll">
                <table className="stack">
                  <thead><tr><th>When</th><th>Who</th><th>What</th><th>Details</th><th /></tr></thead>
                  <tbody>
                    {changes.map((r) => (
                      <tr key={r.id}>
                        <td className="num" style={{ whiteSpace: "nowrap" }}>{fmt(r.at)}</td>
                        <td>{r.actor}</td>
                        <td><b>{r.action}</b></td>
                        <td>{r.detail}</td>
                        <td className="r">
                        </td>
                      </tr>
                    ))}
                    {!changes.length && <tr><td colSpan={5} className="muted">{q ? "Nothing matches that search." : "No changes recorded yet. From now on, every edit made on the site is listed here."}</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>Shows the latest 500 changes. Hours themselves come from Jira, so changes to worklogs are in Jira&apos;s own history.</p>
          </>
        )}
      </main>
    </>
  );
}
