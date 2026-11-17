import { History, Link2, LogIn, Search, SearchX, ShieldAlert } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { recentChanges, recentLogins, loginSummary } from "@/lib/audit";
import { linkEmail } from "../admin/actions";
import { getEmployees } from "@/lib/queries";
import { bestMatch } from "@/lib/names";
import { humanDates } from "@/lib/format";
import PageHeader from "../../components/ui/PageHeader";
import { Card, CardHeader } from "../../components/ui/Card";
import Segmented from "../../components/ui/Segmented";
import { Badge } from "../../components/ui/Badge";
import Avatar from "../../components/ui/Avatar";
import EmptyState from "../../components/ui/EmptyState";
import SubmitButton from "../../components/ui/SubmitButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activity" };

const TZ = process.env.APP_TIMEZONE || "UTC";
const fmt = (v: string) => new Date(v).toLocaleString("en-GB", { timeZone: TZ, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const time = (v: string) => new Date(v).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const dayKey = (v: string) => new Date(v).toLocaleDateString("en-CA", { timeZone: TZ });
const dayLabel = (k: string) => {
  const todayK = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const y = new Date(Date.now() - 86400000).toLocaleDateString("en-CA", { timeZone: TZ });
  if (k === todayK) return "Today";
  if (k === y) return "Yesterday";
  return new Date(`${k}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
};
const ACTION_TONE = (a: string) => (/delet|remov/i.test(a) ? "danger" : /add|restor|link/i.test(a) ? "success" : /setting|edit|changed/i.test(a) ? "info" : "neutral");
const who = (actor: string) => (actor.includes("@") ? actor.split("@")[0].replace(/[._]/g, " ") : actor);

function SearchBox({ q, placeholder, view }: { q: string; placeholder: string; view?: string }) {
  return (
    <form className="search" action="/activity" method="get" role="search" style={{ width: "min(300px, 100%)" }}>
      {view && <input type="hidden" name="view" value={view} />}
      <Search aria-hidden="true" />
      <input className="input input-sm" name="q" type="search" placeholder={placeholder} defaultValue={q} aria-label={placeholder} />
    </form>
  );
}

export default async function Activity(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  await requireAdmin();
  const logins = searchParams.view === "logins";
  const q = (searchParams.q || "").trim();
  const people = logins ? await getEmployees(true) : [];
  const byEmail = new Map(people.filter((x) => x.email).map((x) => [x.email!.toLowerCase(), x]));
  const [changes, loginRows, summary] = await Promise.all([
    logins ? Promise.resolve([]) : recentChanges(500, q),
    logins ? recentLogins(500, q) : Promise.resolve([]),
    logins ? loginSummary() : Promise.resolve([]),
  ]);
  const days = new Map<string, (typeof changes)[number][]>();
  for (const c of changes) { const k = dayKey(c.at); days.set(k, [...(days.get(k) || []), c]); }

  return (
    <div className="stack-lg page-enter">
      <PageHeader title="Activity">
        <Segmented label="Activity type" items={[
          { href: "/activity", label: <><History size={14} />Changes</>, on: !logins },
          { href: "/activity?view=logins", label: <><LogIn size={14} />Sign-ins</>, on: logins },
        ]} />
      </PageHeader>

      {logins ? (
        <>
          <Card>
            {summary.length ? (
              <div className="table-wrap">
                <table className="table stacked">
                  <thead><tr><th>Account</th><th>Last signed in</th><th className="r">Sign-ins</th><th>Roster person</th></tr></thead>
                  <tbody>
                    {summary.map((r) => {
                      const p = byEmail.get(r.email.toLowerCase());
                      return (
                        <tr key={r.email}>
                          <td><span className="person-cell"><Avatar name={r.email.split("@")[0].replace(/[._]/g, " ")} size="sm" /><span className="who"><span className="name">{r.email}</span>{r.role && <span className="meta">{r.role}</span>}</span></span></td>
                          <td className="num muted nowrap" data-label="Last">{fmt(r.last)}</td>
                          <td className="r num" data-label="Sign-ins">{r.n}</td>
                          <td data-label="Person">
                            {p ? <Badge tone="success" icon={<Link2 />}>{p.name}</Badge> : (
                              <form className="form-inline" action={linkEmail}>
                                <input type="hidden" name="email" value={r.email} />
                                <label className="sr-only" htmlFor={`le-${r.email}`}>Link {r.email} to a person</label>
                                <select id={`le-${r.email}`} className="select select-sm" name="employee_id" style={{ width: "auto", maxWidth: 220 }} defaultValue={bestMatch(r.email, people.filter((x) => !x.email))?.id ?? ""} required>
                                  <option value="" disabled>Link to person…</option>{people.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                                </select>
                                <SubmitButton size="sm" variant="secondary">Link</SubmitButton>
                              </form>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState icon={<LogIn />} title="No sign-ins recorded yet" text="From now on, every sign-in is listed here." />}
          </Card>

          <Card>
            <CardHeader title="Sign-in history" description="Signed out = ended by the user or after 30 minutes without activity. Refused = an account that isn't allowed." actions={<SearchBox q={q} placeholder="Search an email" view="logins" />} />
            {loginRows.length ? (
              <div className="list">
                {loginRows.map((r) => (
                  <div key={r.id} className="list-item">
                    <span className="num small muted nowrap" style={{ width: 150 }}>{fmt(r.at)}</span>
                    <span className="grow truncate">{r.email}</span>
                    {r.event === "Sign-in refused" ? <Badge tone="danger" icon={<ShieldAlert />}>Refused</Badge> : r.event === "Signed in" ? <Badge tone="success" dot>Signed in</Badge> : <Badge dot>{r.event}</Badge>}
                  </div>
                ))}
              </div>
            ) : <EmptyState icon={q ? <SearchX /> : <LogIn />} title={q ? "Nothing matches that search" : "Nothing recorded yet"} />}
          </Card>
        </>
      ) : (
        <Card>
          <div className="card-toolbar"><SearchBox q={q} placeholder="Search changes…" /></div>
          {changes.length ? (
            <div className="timeline">
              {[...days.entries()].map(([k, list]) => (
                <section key={k} className="tl-day">
                  <h3 className="tl-date">{dayLabel(k)}</h3>
                  {list.map((r) => (
                    <div key={r.id} className="tl-item">
                      <Avatar name={who(r.actor)} size="sm" />
                      <div className="grow">
                        <div className="tl-line"><b className="strong">{who(r.actor)}</b><Badge tone={ACTION_TONE(r.action)}>{r.action}</Badge><span className="small faint num">{time(r.at)}</span></div>
                        {r.detail && <p className="tl-detail">{humanDates(r.detail)}</p>}
                      </div>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          ) : <EmptyState icon={q ? <SearchX /> : <History />} title={q ? "Nothing matches that search" : "No changes recorded yet"} text={q ? undefined : "From now on, every edit made on the site is listed here."} />}
        </Card>
      )}
    </div>
  );
}
