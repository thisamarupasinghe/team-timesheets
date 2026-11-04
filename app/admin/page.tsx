import Link from "next/link";
import Header from "../components/Header";
import { requireEditor } from "@/lib/auth";
import { getEmployees, getSettings, getSync, unmatched } from "@/lib/queries";
import { jiraConfigured } from "@/lib/jira";
import { ALL_TEAMS } from "@/lib/format";
import { addDays, fmtDY, today } from "@/lib/time";
import { hm } from "@/lib/format";
import { addEmployee, addHoliday, checkRoster, removeHoliday, saveSettings, updateEmployee } from "./actions";
import LoadHistory from "./LoadHistory";

export const dynamic = "force-dynamic";

const OK: Record<string, string> = { added: "Person added.", saved: "Saved.", settings: "Settings saved.", holiday: "Holidays updated.", linked: "Jira account linked." };

const ERR: Record<string, string> = { name: "Add a name.", settings: "Check the settings: hours 1–12, a valid date and sprint number.", holiday: "Add a date and a name for the holiday.", link: "Choose a person to link.", exists: "Someone with that name is already on the roster." };

export default async function Admin({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const user = await requireEditor();
  const isAdmin = user.role === "admin";
  const t = today();
  const [people, settings, sync, unm] = await Promise.all([getEmployees(false), getSettings(), getSync(), isAdmin ? unmatched(addDays(t, -90), t) : Promise.resolve([])]);
  const order = (x: string) => { const i = ALL_TEAMS.indexOf(x); return i < 0 ? 99 : i; };
  people.sort((a, b) => order(a.team) - order(b.team) || a.name.localeCompare(b.name));
  const activePeople = people.filter((p) => p.active);

  return (
    <>
      <Header active="admin" />
      <main className="wrap">
        <h1 className="page">Roster &amp; settings</h1>
        {searchParams.ok === "roster" && <div className="notice ok">Roster checked: {Number(searchParams.a) || 0} added, {Number(searchParams.r) || 0} made active.</div>}
        {searchParams.ok && OK[searchParams.ok] && <div className="notice ok">{OK[searchParams.ok]}</div>}
        {searchParams.err && ERR[searchParams.err] && <div className="notice warn">{ERR[searchParams.err]}</div>}

        {isAdmin && <section className="panel">
          <div className="panel-h"><h2>Jira connection</h2></div>
          <div className="panel-b">
            <p style={{ margin: 0 }}>
              {jiraConfigured() ? <span className="pill b3">Connected</span> : <span className="pill b1">Not set up</span>}{" "}
              {sync ? (sync.ok ? `Last update ${new Date(sync.at).toLocaleString("en-GB", { timeZone: process.env.APP_TIMEZONE || "UTC", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}, ${sync.count} worklogs for ${sync.from} to ${sync.to}.` : `Last update failed: ${sync.error}`) : "No update has run yet."}
            </p>
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>The site refreshes the last 3 weeks automatically whenever someone opens it and the data is more than 10 minutes old. Use Load history once to bring in older sprints.</p>
            <LoadHistory configured={jiraConfigured()} />
          </div>
        </section>}

        {isAdmin && unm.length > 0 && <div className="notice"><b>{unm.length} Jira account{unm.length > 1 ? "s" : ""} not linked to anyone</b><p><Link href="/unmatched">Open Unmatched</Link> to link them.</p></div>}

        <section className="panel">
          <div className="panel-h"><h2>People</h2><span className="muted" style={{ fontSize: 12 }}>{activePeople.length} active · right-click a person to delete</span></div>
          <div className="scroll">
            <table className="stack">
              <thead><tr><th>Name</th><th>Emp no.</th><th>Team, Jira account ids &amp; status</th></tr></thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.id} data-eid={p.id} data-ename={p.name} data-eactive={String(p.active)} style={p.active ? undefined : { opacity: 0.6 }}>
                    <td><b>{p.name}</b>{p.note ? <div className="pmeta">{p.note}</div> : null}</td>
                    <td className="num">{p.emp_no || ""}</td>
                    <td>
                      <form className="form" action={updateEmployee}>
                        <input type="hidden" name="id" value={p.id} />
                        <select name="team" defaultValue={p.team} aria-label={`Team for ${p.name}`}>{ALL_TEAMS.map((x) => <option key={x}>{x}</option>)}</select>
                        {isAdmin && <input name="jira_ids" defaultValue={p.jira_ids.join(", ")} placeholder="Jira account id" aria-label={`Jira account ids for ${p.name}`} style={{ width: 230 }} />}
                        {isAdmin && <input name="email" type="email" defaultValue={p.email || ""} placeholder="Work email" aria-label={`Work email for ${p.name}`} style={{ width: 200 }} />}
                        <label style={{ display: "flex", gap: 4, alignItems: "center" }}><input type="checkbox" name="active" defaultChecked={p.active} /> Active</label>
                        <button className="btn">Save</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel-b" style={{ borderTop: "1px solid var(--line)" }}>
            <form className="form" action={addEmployee}>
              <label htmlFor="nn">Name<input id="nn" name="name" required /></label>
              <label htmlFor="ne">Emp no.<input id="ne" name="emp_no" style={{ width: 110 }} /></label>
              <label htmlFor="nt">Team<select id="nt" name="team" defaultValue="Alpha">{ALL_TEAMS.map((x) => <option key={x}>{x}</option>)}</select></label>
              {isAdmin && <label htmlFor="nj">Jira account id (optional)<input id="nj" name="jira_ids" style={{ width: 230 }} /></label>}
              {isAdmin && <label htmlFor="nm">Work email (optional)<input id="nm" name="email" type="email" style={{ width: 200 }} /></label>}
              <button className="btn primary">Add person</button>
            </form>
            {isAdmin && <form action={checkRoster}><button className="btn">Check roster against the employee list</button> <span className="muted" style={{ fontSize: 12 }}>Adds anyone missing and makes inactive people active again (except “Yet to join”).</span></form>}
          </div>
        </section>

        {isAdmin && <section className="panel">
          <div className="panel-h"><h2>Settings</h2></div>
          <div className="panel-b">
            {isAdmin ? <form className="form" action={saveSettings}>
              <label htmlFor="sh">Hours per working day<input id="sh" name="hours_per_day" type="number" min="1" max="12" step="0.5" defaultValue={settings.hours_per_day} /></label>
              <label htmlFor="sa">A sprint start date<input id="sa" name="sprint_anchor" type="date" defaultValue={settings.sprint_anchor} /></label>
              <label htmlFor="sn">That sprint&apos;s number<input id="sn" name="sprint_anchor_number" type="number" min="1" defaultValue={settings.sprint_anchor_number} /></label>
              <button className="btn">Save settings</button>
            </form> : null}
            <div>
              <b style={{ fontSize: 13 }}>Public holidays</b> <span className="muted" style={{ fontSize: 12 }}>(excluded from capacity)</span>
              <div className="legend" style={{ marginTop: 6 }}>
                {settings.holidays.map((h) => (
                  <form key={h.date} action={removeHoliday} style={{ display: "inline" }}>
                    <input type="hidden" name="date" value={h.date} />
                    <span className="pill na">{fmtDY(h.date)} · {h.name} <button className="btn" style={{ padding: "0 6px", border: 0, background: "none" }} aria-label={`Remove ${h.name}`}>×</button></span>
                  </form>
                ))}
              </div>
            </div>
            <form className="form" action={addHoliday}>
              <label htmlFor="hd">Date<input id="hd" name="date" type="date" required /></label>
              <label htmlFor="hn">Name<input id="hn" name="name" placeholder="e.g. Ill Full Moon Poya Day" required /></label>
              <button className="btn">Add holiday</button>
            </form>
          </div>
        </section>}
      </main>
    </>
  );
}
