import Header from "../components/Header";
import { requireAdmin } from "@/lib/auth";
import { getEmployees, unmatched } from "@/lib/queries";
import { addDays, today } from "@/lib/time";
import { hm } from "@/lib/format";
import { linkJira, addFromJira } from "../admin/actions";
import { ALL_TEAMS } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Unmatched({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  await requireAdmin();
  const t = today();
  const [people, unm] = await Promise.all([getEmployees(true), unmatched(addDays(t, -90), t)]);
  return (
    <>
      <Header active="unmatched" />
      <main className="wrap">
        <h1 className="page">Unmatched Jira accounts</h1>
        {searchParams.ok === "added" && <div className="notice ok">Added to the roster and linked. Check their team on Roster &amp; settings.</div>}
        {searchParams.ok === "linked" && <div className="notice ok">Jira account linked.</div>}
        {searchParams.err === "link" && <div className="notice warn">Choose a person to link.</div>}
        <section className="panel">
          <div className="panel-h"><h2>Logged time but not linked to anyone</h2><span className="muted" style={{ fontSize: 12 }}>Last 90 days. Their hours aren&apos;t counted until linked.</span></div>
          <div className="scroll">
            <table className="stack">
              <thead><tr><th>Name in Jira</th><th className="r">Hours</th><th className="r">Worklogs</th><th>Link to</th></tr></thead>
              <tbody>
                {unm.map((u) => (
                  <tr key={u.author_id}>
                    <td>{u.name}<div className="pmeta num">{u.author_id}</div></td>
                    <td className="r num">{hm(u.secs)}</td><td className="r num">{u.n}</td>
                    <td>
                      <form className="form" action={linkJira}>
                        <input type="hidden" name="account_id" value={u.author_id} />
                        <select name="employee_id" aria-label={`Roster person for ${u.name}`} defaultValue="">
                          <option value="" disabled>Choose…</option>
                          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <button className="btn">Link</button>
                      </form>
                      <form className="form" action={addFromJira} style={{ marginTop: 6 }}>
                        <input type="hidden" name="account_id" value={u.author_id} />
                        <select name="team" aria-label={`Team for ${u.name}`} defaultValue="Alpha">{ALL_TEAMS.map((x) => <option key={x}>{x}</option>)}</select>
                        <button className="btn">Not on roster: add as new person</button>
                      </form>
                    </td>
                  </tr>
                ))}
                {!unm.length && <tr><td colSpan={4} className="muted">Everyone who logged time is linked to someone on the roster.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
