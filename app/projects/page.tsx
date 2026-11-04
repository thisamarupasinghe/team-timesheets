import { redirect } from "next/navigation";
import Header from "../components/Header";
import { requireUser } from "@/lib/auth";
import { getSettings, projectTotals } from "@/lib/queries";
import { resolvePeriod } from "@/lib/time";
import { hm } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Projects({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  await requireUser();
  let settings;
  try { settings = await getSettings(); } catch (e: any) { if (e?.code === "42P01") redirect("/"); throw e; }
  const P = resolvePeriod(searchParams, settings);
  const rows = await projectTotals(P.start, P.end);
  const byProject = new Map<string, { secs: number; people: { name: string; team: string; secs: number }[] }>();
  for (const r of rows) {
    const p = byProject.get(r.project) || { secs: 0, people: [] };
    p.secs += r.secs; p.people.push({ name: r.name, team: r.team, secs: r.secs });
    byProject.set(r.project, p);
  }
  const list = [...byProject.entries()].sort((a, b) => b[1].secs - a[1].secs);
  const total = list.reduce((s, [, v]) => s + v.secs, 0);
  const max = list[0]?.[1].secs || 1;
  return (
    <>
      <Header active="projects" period={P} base="/projects" />
      <main className="wrap">
        <h1 className="page">By project</h1>
        <section className="panel">
          <div className="panel-h"><h2>Hours per Jira project</h2><span className="muted" style={{ fontSize: 12 }}>{hm(total)} in total · {P.label}</span></div>
          <div className="scroll">
            <table className="stack">
              <thead><tr><th>Project</th><th style={{ width: "30%" }}>Share</th><th className="r">Hours</th><th className="r">People</th><th>Most hours</th></tr></thead>
              <tbody>
                {list.map(([name, v]) => {
                  const top = v.people.sort((a, b) => b.secs - a.secs).slice(0, 4);
                  return (
                    <tr key={name}>
                      <td><b>{name}</b></td>
                      <td><div className="track"><i style={{ width: `${(v.secs / max) * 100}%` }} /></div></td>
                      <td className="r num">{hm(v.secs)}</td>
                      <td className="r num">{v.people.length}</td>
                      <td style={{ fontSize: 12 }}>{top.map((p) => `${p.name} ${hm(p.secs)}`).join(" · ")}</td>
                    </tr>
                  );
                })}
                {!list.length && <tr><td colSpan={5} className="muted">No time logged in this period.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>Includes everyone on the roster who has a Jira account linked, whatever their team. Jira accounts that aren&apos;t linked yet are left out.</p>
      </main>
    </>
  );
}
