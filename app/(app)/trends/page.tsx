import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronRight, LineChart } from "lucide-react";
import { canEdit, requireUser } from "@/lib/auth";
import { getSettings, periodModel } from "@/lib/queries";
import { COUNTED, pct } from "@/lib/format";
import { addDays, fmtD, today, toMs } from "@/lib/time";
import PageHeader from "../../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import Avatar from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import EmptyState from "../../components/ui/EmptyState";
import AutoSubmitForm from "../../components/ui/AutoSubmit";
import TrendChart from "./TrendChart";

export const dynamic = "force-dynamic";
export const metadata = { title: "Trends" };

const SPRINTS = 8;

export default async function Trends(props: { searchParams: Promise<{ team?: string; sort?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await requireUser();
  const showPeople = canEdit(user.role);
  const s = await getSettings();
  const t = today();
  const cur = s.sprint_anchor_number + Math.floor((toMs(t) - toMs(s.sprint_anchor)) / 86400000 / 14);
  const nums = Array.from({ length: SPRINTS }, (_, i) => cur - SPRINTS + 1 + i).filter((n) => n >= 1);
  const data = await Promise.all(nums.map(async (n) => {
    const start = addDays(s.sprint_anchor, (n - s.sprint_anchor_number) * 14);
    const end = addDays(start, 11);
    const M = await periodModel(start, end);
    const counted = M.rows.filter((r) => COUNTED.includes(r.e.team));
    const logged = counted.reduce((a, r) => a + r.logged, 0), base = counted.reduce((a, r) => a + r.base, 0);
    const people = counted.map((r) => ({ id: r.e.id, name: r.e.name, team: r.e.team, logged: r.logged, base: r.base }));
    return { n, start, partial: end >= t, people, all: base > 0 && logged > 0 ? logged / base : null, teams: M.teams.map((x) => (x.logged > 0 ? x.util : null)) }; // sprints with no data stay blank
  }));

  // ---- Per-person (admin and managers only) ----
  type Pt = { util: number | null; logged: number; base: number };
  const person = new Map<number, { id: number; name: string; team: string; pts: Pt[] }>();
  if (showPeople) {
    data.forEach((d, i) => d.people.forEach((p) => {
      const e = person.get(p.id) ?? { id: p.id, name: p.name, team: p.team, pts: data.map(() => ({ util: null, logged: 0, base: 0 })) };
      e.pts[i] = { util: p.base > 0 && p.logged > 0 ? p.logged / p.base : null, logged: p.logged, base: p.base };
      person.set(p.id, e);
    }));
  }
  const fin = data.map((d, i) => (d.partial ? -1 : i)).filter((i) => i >= 0); // finished sprints only
  const agg = (pts: Pt[], idxs: number[]) => {
    const u = idxs.map((i) => pts[i]).filter((q) => q.util != null);
    const base = u.reduce((a, q) => a + q.base, 0);
    return u.length >= 2 && base > 0 ? u.reduce((a, q) => a + q.logged, 0) / base : null;
  };
  const people = [...person.values()].map((p) => {
    const lastI = fin[fin.length - 1], prevI = fin[fin.length - 2];
    const last = lastI != null ? p.pts[lastI].util : null, prev = prevI != null ? p.pts[prevI].util : null;
    const change = last != null && prev != null ? last - prev : null;
    const recent = agg(p.pts, fin.slice(-3)), before = agg(p.pts, fin.slice(-6, -3));
    const dir = recent != null && before != null ? recent - before : null; // 3-sprint average vs the 3 before
    return { ...p, last, change, dir };
  }).filter((p) => p.pts.some((q) => q.util != null));
  const team = COUNTED.includes(searchParams.team || "") ? searchParams.team! : "";
  const sort = ["name", "latest", "change"].includes(searchParams.sort || "") ? searchParams.sort! : "team";
  const shown = people.filter((p) => !team || p.team === team).sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "latest") return (b.last ?? -1) - (a.last ?? -1);
    if (sort === "change") return (b.change ?? -9) - (a.change ?? -9);
    return COUNTED.indexOf(a.team) - COUNTED.indexOf(b.team) || a.name.localeCompare(b.name);
  });
  const pts = (v: number | null) => (v == null ? "–" : `${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v * 100))} pts`);
  const tone = (v: number | null) => (v == null || Math.abs(v) < 0.05 ? "neutral" : v > 0 ? "success" : "danger");
  const SW = 120, SH = 32, sx = (i: number) => 4 + (i * (SW - 8)) / Math.max(1, data.length - 1), sy = (v: number) => SH - 4 - (Math.min(v, 1.2) / 1.2) * (SH - 8);
  const spark = (arr: Pt[]) => {
    let path = "", pen = false;
    arr.forEach((q, i) => { if (q.util == null) { pen = false; return; } path += `${pen ? "L" : "M"}${sx(i).toFixed(1)},${sy(q.util).toFixed(1)} `; pen = true; });
    return path.trim();
  };
  const latest = [...data].reverse().find((d) => !d.partial && d.all != null);

  return (
    <div className="stack-lg page-enter">
      <PageHeader title="Trends" subtitle={`Utilisation over the last ${data.length} sprints. The current sprint counts only the days so far.`} />

      <Card>
        <CardHeader title="Utilisation by sprint" description={latest ? <>Last finished sprint (S{latest.n}): <b className="strong num">{pct(latest.all)}</b> across all teams</> : undefined} />
        <CardBody>
          <TrendChart
            labels={data.map((d) => `S${d.n}`)}
            partial={data.map((d) => d.partial)}
            all={data.map((d) => d.all)}
            teams={COUNTED.map((name, k) => ({ name, color: `var(--team-${k + 1})`, values: data.map((d) => d.teams[k] ?? null) }))}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="The numbers" description="Per sprint, newest first." />
        <div className="table-wrap">
          <table className="table sticky-first">
            <thead><tr><th>Sprint</th><th>Starts</th><th className="r">All teams</th>{COUNTED.map((n) => <th key={n} className="r">{n}</th>)}</tr></thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.n}>
                  <td className="nowrap"><b>Sprint {d.n}</b>{d.partial && <> <Badge tone="accent">In progress</Badge></>}</td>
                  <td className="num muted" data-label="Starts">{fmtD(d.start)}</td>
                  <td className="r num strong" data-label="All teams">{pct(d.all)}</td>
                  {d.teams.map((v, k) => <td key={k} className="r num" data-label={COUNTED[k]}>{pct(v)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {showPeople && (
        <Card>
          <CardHeader
            title="By person" count={shown.length}
            description="Visible to the admin and managers only."
            actions={
              <AutoSubmitForm action="/trends" className="row">
                <label className="sr-only" htmlFor="tr-team">Team</label>
                <select id="tr-team" className="select select-sm" name="team" defaultValue={team} style={{ width: "auto" }}>
                  <option value="">All teams</option>{COUNTED.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <label className="sr-only" htmlFor="tr-sort">Sort by</label>
                <select id="tr-sort" className="select select-sm" name="sort" defaultValue={sort} style={{ width: "auto" }}>
                  <option value="team">Sort by team</option><option value="name">Sort by name</option><option value="latest">Sort by latest sprint</option><option value="change">Sort by change</option>
                </select>
              </AutoSubmitForm>
            }
          />
          <div className="card-toolbar">
            <details className="disclosure">
              <summary><ChevronRight aria-hidden="true" />How these numbers work</summary>
              <div className="disclosure-body stack-sm">
                <p><b className="strong">Utilisation</b> = logged ÷ capacity, with leave and public holidays already removed.</p>
                <p><b className="strong">Change</b> = latest finished sprint vs the one before.</p>
                <p><b className="strong">Trend</b> = average of the last 3 finished sprints vs the 3 before; an arrow shows when it moves 5 points or more.</p>
                <p>It shows how closely logged time matches capacity, not how well someone works. Blank = no capacity or nothing logged.</p>
              </div>
            </details>
          </div>
          {shown.length ? (
            <div className="table-wrap">
              <table className="table stacked people-trend">
                <thead><tr><th>Person</th><th>Last {data.length} sprints</th>{data.map((d) => <th key={d.n} className="r sprint-col">S{d.n}{d.partial ? "*" : ""}</th>)}<th className="r">Change</th><th className="r">Trend</th></tr></thead>
                <tbody>
                  {shown.map((p) => (
                    <tr key={p.id}>
                      <td><Link className="person-cell" href={`/person?id=${p.id}`}><Avatar name={p.name} team={p.team} size="sm" /><span className="who"><span className="name">{p.name}</span><span className="meta">{p.team}</span></span></Link></td>
                      <td data-label={`Last ${data.length} sprints`}>
                        <svg width={SW} height={SH} viewBox={`0 0 ${SW} ${SH}`} role="img" aria-label={`${p.name}: utilisation over the last ${data.length} sprints`}>
                          <line x1="0" x2={SW} y1={sy(0.8)} y2={sy(0.8)} stroke="var(--border-strong)" strokeDasharray="3 3" />
                          <path d={spark(p.pts)} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                          {p.pts.map((q, i) => q.util != null && <circle key={i} cx={sx(i)} cy={sy(q.util)} r={i === p.pts.length - 1 ? 3 : 1.6} fill="var(--accent)" />)}
                        </svg>
                      </td>
                      {p.pts.map((q, i) => <td key={i} className="r num sprint-col">{pct(q.util)}</td>)}
                      <td className="r" data-label="Change"><Badge tone={tone(p.change)}><span className="num">{pts(p.change)}</span></Badge></td>
                      <td className="r" data-label="Trend">
                        {p.dir == null ? <span className="faint">–</span>
                          : p.dir >= 0.05 ? <Badge tone="success" icon={<ArrowUpRight />}>Up</Badge>
                            : p.dir <= -0.05 ? <Badge tone="danger" icon={<ArrowDownRight />}>Down</Badge>
                              : <Badge icon={<ArrowRight />}>Steady</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState icon={<LineChart />} title="No data for this selection" text="Try another team." />}
        </Card>
      )}
    </div>
  );
}
