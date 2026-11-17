import { redirect } from "next/navigation";
import { ChevronRight, FolderKanban } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getSettings, projectTotals } from "@/lib/queries";
import { resolvePeriod } from "@/lib/time";
import { hm } from "@/lib/format";
import PageHeader from "../../components/ui/PageHeader";
import PeriodPicker from "../../components/PeriodPicker";
import { Card, CardHeader } from "../../components/ui/Card";
import Avatar from "../../components/ui/Avatar";
import EmptyState from "../../components/ui/EmptyState";
import InfoTip from "../../components/ui/InfoTip";

export const dynamic = "force-dynamic";
export const metadata = { title: "Projects" };

export default async function Projects(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
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
  list.forEach(([, v]) => v.people.sort((a, b) => b.secs - a.secs));
  const total = list.reduce((s, [, v]) => s + v.secs, 0);
  const max = list[0]?.[1].secs || 1;
  const people = new Set(rows.map((r) => r.name)).size;

  return (
    <div className="stack-lg page-enter">
      <PageHeader title="Projects">
        <PeriodPicker P={P} base="/projects" />
      </PageHeader>

      <Card>
        <CardHeader
          title="Hours per project"
          count={list.length}
          description={<span className="row" style={{ gap: 6 }}><span className="num">{hm(total)}</span> logged by <span className="num">{people}</span> people <InfoTip text="Includes everyone on the roster with a Jira account linked, whatever their team. Jira accounts that aren't linked yet are left out." /></span>}
        />
        {list.length ? (
          <div className="proj-list">
            {list.map(([name, v], i) => (
              <details key={name} className="proj">
                <summary>
                  <span className="proj-rank num">{i + 1}</span>
                  <span className="proj-name truncate" title={name}>{name}</span>
                  <span className="proj-bar"><span className="bar-track"><i style={{ width: `${(v.secs / max) * 100}%` }} /></span></span>
                  <span className="avatar-stack hide-mobile" aria-label={`${v.people.length} people`}>
                    {v.people.slice(0, 4).map((p) => <Avatar key={p.name} name={p.name} team={p.team} size="sm" />)}
                    {v.people.length > 4 && <span className="avatar avatar-sm more">+{v.people.length - 4}</span>}
                  </span>
                  <span className="proj-hours num"><b>{hm(v.secs)}</b><small>{total ? Math.round((v.secs / total) * 100) : 0}%</small></span>
                  <ChevronRight className="proj-chev" aria-hidden="true" />
                </summary>
                <div className="proj-people">
                  {v.people.map((p) => (
                    <div key={p.name} className="proj-person">
                      <Avatar name={p.name} team={p.team} size="sm" />
                      <span className="grow truncate">{p.name}<span className="muted small"> · {p.team}</span></span>
                      <span className="bar-track mini"><i style={{ width: `${(p.secs / v.secs) * 100}%` }} /></span>
                      <span className="num">{hm(p.secs)}</span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        ) : <EmptyState icon={<FolderKanban />} title="No time logged in this period" text="Pick another period, or check that Jira accounts are linked to people on the roster." />}
      </Card>
    </div>
  );
}
