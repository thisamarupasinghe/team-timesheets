import Link from "next/link";
import Header from "./components/Header";
import { requireUser, canEdit, requireAdmin } from "@/lib/auth";
import { periodModel, getSettings, getSync } from "@/lib/queries";
import { jiraConfigured } from "@/lib/jira";
import { redirect } from "next/navigation";
import { resolvePeriod, isWeekend, WD, dow } from "@/lib/time";
import { band, hm, pct, COUNTED, ALL_TEAMS, BANDS } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const user = await requireUser();
  const editor = canEdit(user.role);
  let settings;
  try { settings = await getSettings(); } catch (e: any) {
    if (e?.code === "42P01") {
      if (user.role === "admin") redirect("/setup");
      return <main className="wrap" style={{ maxWidth: 520, paddingTop: 80 }}><div className="notice"><b>The site isn&apos;t set up yet</b><p>Ask the admin to finish the setup, then reload this page.</p></div></main>;
    }
    throw e;
  }
  const P = resolvePeriod(searchParams, settings);
  const [M, sync] = await Promise.all([periodModel(P.start, P.end, searchParams.inactive === "1"), getSync()]);
  const team = COUNTED.includes(searchParams.team || "") ? searchParams.team! : null;
  const q = (searchParams.q || "").toLowerCase();

  const counted = M.rows.filter((r) => COUNTED.includes(r.e.team));
  const logged = counted.reduce((s, r) => s + r.logged, 0);
  const base = counted.reduce((s, r) => s + r.base, 0);
  const util = base > 0 ? logged / base : null;
  const loggers = counted.filter((r) => r.logged > 0).length;
  const missing = counted.reduce((s, r) => s + r.missing, 0);
    const capLbl = M.inProgress ? "capacity to date" : "capacity";
  const ub = band(util);
  const showInactive = searchParams.inactive === "1";
  const teamHref = (t: string | null) => `/?${P.query}${t ? `&team=${encodeURIComponent(t)}` : ""}${showInactive ? "&inactive=1" : ""}`;
  const groups = ALL_TEAMS.filter((t) => !team || t === team);

  return (
    <>
      <Header active="dash" period={P} />
      <main className="wrap">
        {editor && !jiraConfigured() && (
          <div className="notice warn"><b>Jira isn&apos;t connected yet</b><p>Add JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN in the site&apos;s settings, then press Refresh from Jira.</p></div>
        )}
        {editor && sync && !sync.ok && (
          <div className="notice warn"><b>The last update from Jira failed</b><p>{sync.error}</p></div>
        )}
        <section className="kpis">
          <div className="kpi"><div className="k">Hours logged</div><div className="v num">{hm(logged)}</div><div className="s">of {hm(base)} {capLbl}</div></div>
          <div className="kpi"><div className="k">Utilisation</div><div className="v num">{pct(util)}</div><div className="s"><span className={`pill ${ub.cls}`}>{ub.label}</span> at {settings.hours_per_day}h/day</div></div>
          <div className="kpi"><div className="k">People logging</div><div className="v num">{loggers} / {counted.length}</div><div className="s">across the delivery teams</div></div>
          <div className="kpi"><div className="k">Days with no time</div><div className="v num">{missing}</div><div className="s">past working days, not on leave</div></div>
        </section>

        <section className="teams">
          {M.teams.map((t) => {
            const b = band(t.util);
            return (
              <Link key={t.team} href={teamHref(team === t.team ? null : t.team)} className={`team ${team === t.team ? "on" : ""}`}>
                <div className="top"><span className="name">{t.team}</span><span className="pct num">{pct(t.util)}</span></div>
                <div className="meter"><i style={{ width: `${Math.min(1, (t.util || 0) / 1.2) * 100}%`, background: `var(--${b.cls === "na" ? "faint" : b.cls})` }} /><span className="mark" /></div>
                <div className="meta"><span className="num">{hm(t.logged)} / {hm(t.base)}</span><span className={`pill ${b.cls}`}>{b.label}</span></div>
                <div className="meta"><span>{t.rows.length} people · {t.rows.filter((r) => r.logged > 0).length} logging</span></div>
              </Link>
            );
          })}
        </section>

        <section className="panel">
          <div className="panel-h">
            <h2>{team ? `${team}: hours logged per day` : "Hours logged per day"}</h2>
            <div className="form">
              {editor && <span className="muted" style={{ fontSize: 12 }}>Right-click a person for options</span>}
              <form className="form" action="/" method="get">
                {Object.entries({ mode: P.mode, n: searchParams.n, d: searchParams.d, m: searchParams.m, from: searchParams.from, to: searchParams.to, inactive: showInactive ? "1" : undefined, team: team || undefined }).filter(([, v]) => v).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
                <input name="q" type="search" placeholder="Find a person" defaultValue={searchParams.q || ""} aria-label="Find a person" />
              </form>
              {(M.hiddenInactive > 0 || showInactive) && (
                <Link className="btn" href={`/?${P.query}${team ? `&team=${encodeURIComponent(team)}` : ""}${showInactive ? "" : "&inactive=1"}`}>{showInactive ? "Hide inactive" : `Show inactive (${M.hiddenInactive})`}</Link>
              )}
              <a className="btn exp" href={`/api/export?from=${P.start}&to=${P.end}&type=daily`}>Export timesheet CSV</a>
              <a className="btn exp" href={`/api/export?from=${P.start}&to=${P.end}&type=logs`}>Export worklogs CSV</a>
            </div>
          </div>
          <div className="panel-h keyrow" style={{ borderBottomColor: "var(--line-2)" }}>
            <div className="legend">
              <span><i className="sw" style={{ background: "var(--gap)" }} />Working day, nothing logged</span>
              <span><i className="sw" style={{ background: "var(--leave)" }} />Leave</span>
              <span><i className="sw" style={{ background: "var(--hol)" }} />Public holiday</span>
              <span><i className="sw" style={{ background: "var(--weekend)" }} />Weekend</span>
            </div>
            <div className="legend">
              {[...BANDS, { min: 1, cls: "b4", label: "Over" }].map((b) => <span key={b.cls} className={`pill ${b.cls}`}>{b.label} {b.cls === "b4" ? ">100%" : b.cls === "b0" ? "<40%" : `≥${Math.round(b.min * 100)}%`}</span>)}
            </div>
          </div>
          <div className="scroll">
            <table className="grid">
              <thead>
                <tr>
                  <th className="person">Person</th>
                  {M.days.map((d) => (
                    <th key={d} className={`day ${isWeekend(d) ? "we" : ""} ${M.hol.has(d) ? "hol" : ""}`} title={M.hol.get(d) || ""}>
                      {WD[dow(d)].slice(0, 2)}<small>{+d.slice(8, 10)}</small>
                    </th>
                  ))}
                  <th className="r">Logged</th><th className="r cap">Capacity</th><th className="r">Util.</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((t) => {
                  let rs = M.rows.filter((r) => (ALL_TEAMS.includes(r.e.team) ? r.e.team : "Other") === t);
                  if (q) rs = rs.filter((r) => r.e.name.toLowerCase().includes(q));
                  if (!rs.length) return null;
                  rs.sort((a, b) => b.logged - a.logged || a.e.name.localeCompare(b.e.name));
                  const tl = rs.reduce((s, r) => s + r.logged, 0), tb = rs.reduce((s, r) => s + r.base, 0);
                  return [
                    <tr key={`g-${t}`} className="grp"><td colSpan={M.days.length + 5}>{t}<span className="sub">{hm(tl)} of {hm(tb)}{COUNTED.includes(t) ? "" : " · not counted in utilisation"}</span></td></tr>,
                    ...rs.map((r) => {
                      const b = band(r.util);
                      return (
                        <tr key={r.e.id} className={`row${r.e.active ? "" : " off"}`} data-eid={r.e.id} data-ename={r.e.name} data-eactive={String(r.e.active)}>
                          <td className="person">
                            <Link className="pname" href={`/person?id=${r.e.id}&${P.query}`}>{r.e.name}</Link>
                            <span className="pmeta">{!r.e.active ? "Inactive" + (r.logged ? " · logged time in this period" : "") : r.linked ? (r.missing ? `${r.missing} day${r.missing > 1 ? "s" : ""} with no time` : " ") : <span className="warn-t">No Jira account linked</span>}</span>
                          </td>
                          {M.days.map((d) => {
                            const v = r.byDay.get(d) || 0;
                            const lv = M.leaveMap.get(`${r.e.id}|${d}`) || 0;
                            const we = isWeekend(d), hd = M.hol.has(d);
                            let cls = "day num" + (we ? " we" : "") + (hd ? " hol" : "");
                            let txt = v ? hm(v) : "";
                            if (lv && !v) { cls += " lv"; txt = "L"; }
                            else if (!v && !we && !hd && d < M.today) { cls += " gap"; txt = "·"; }
                            else if (d > M.today) cls += " future";
                            return <td key={d} className={cls}>{txt}</td>;
                          })}
                          <td className="r num"><b>{hm(r.logged)}</b></td>
                          <td className="r num cap">{hm(r.base)}</td>
                          <td className="r num">{pct(r.util)}</td>
                          <td><span className={`pill ${b.cls}`}>{b.label}</span></td>
                        </tr>
                      );
                    }),
                  ];
                })}
              </tbody>
            </table>
          </div>
        </section>
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>
          Hours come from Jira worklogs, counted on the date the work was logged against. Capacity is {settings.hours_per_day}h per working day, less public holidays and leave.
        </p>
      </main>
    </>
  );
}
