import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarX2, Clock3, Download, FileSpreadsheet, Gauge, ListChecks, Search, SearchX, Sparkles, Users, X } from "lucide-react";
import { requireUser, canEdit, authDisabled } from "@/lib/auth";
import { periodModel, getSettings } from "@/lib/queries";
import { resolvePeriod, isWeekend, WD, dow, fmtD, today } from "@/lib/time";
import { band, hm, pct, isOverDay, COUNTED, ALL_TEAMS } from "@/lib/format";
import PageHeader from "../components/ui/PageHeader";
import PeriodPicker, { periodText } from "../components/PeriodPicker";
import StatCard from "../components/ui/StatCard";
import Meter from "../components/ui/Meter";
import { BandBadge, Badge } from "../components/ui/Badge";
import { Card, CardHeader } from "../components/ui/Card";
import Avatar, { teamColor } from "../components/ui/Avatar";
import EmptyState from "../components/ui/EmptyState";
import InfoTip from "../components/ui/InfoTip";
import Menu from "../components/ui/Menu";
import PersonMenu from "../components/PersonActions";
import MyWeekCard from "../components/MyWeekCard";
import { myWeek, ownEmployee } from "@/lib/me";
import { jiraBase } from "@/lib/jira";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview" };

const heat = (v: number, hpd: number) => (v <= 0 ? "" : v < hpd * 0.5 ? "h1" : v < hpd * 0.85 ? "h2" : v <= hpd * 1.05 ? "h3" : "h4");

export default async function Dashboard(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const user = await requireUser();
  const editor = canEdit(user.role);
  let settings;
  try { settings = await getSettings(); } catch (e: any) {
    if (e?.code === "42P01") {
      if (user.role === "admin") redirect("/setup");
      return <EmptyState icon={<Sparkles />} title="The site isn't set up yet" text="Ask the admin to finish the setup, then reload this page." />;
    }
    throw e;
  }
  const P = resolvePeriod(searchParams, settings);
  const showInactive = searchParams.inactive === "1";
  const [M, me] = await Promise.all([periodModel(P.start, P.end, showInactive), ownEmployee(user.email).catch(() => null)]);
  // "Your week" for anyone whose work email is linked to their name on the roster
  // Local only (sign-in off): ?asof=YYYY-MM-DD previews the card as it looked on another day
  const asof = authDisabled && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.asof || "") ? searchParams.asof : undefined;
  const mine = me ? await myWeek(me.id, asof).catch(() => null) : null;
  const team = COUNTED.includes(searchParams.team || "") ? searchParams.team! : null;
  const qRaw = (searchParams.q || "").trim();
  const q = qRaw.toLowerCase();
  const gaps = searchParams.gaps === "1";
  const hpd = settings.hours_per_day * 3600;
  const t = today();

  const counted = M.rows.filter((r) => COUNTED.includes(r.e.team));
  const logged = counted.reduce((s, r) => s + r.logged, 0);
  const base = counted.reduce((s, r) => s + r.base, 0);
  const util = base > 0 ? logged / base : null;
  const loggers = counted.filter((r) => r.logged > 0).length;
  const missing = counted.reduce((s, r) => s + r.missing, 0);
  const capLbl = M.inProgress ? "capacity to date" : "capacity";

  // Links keep the period and every other filter, changing only what's given
  const filters = { team: team || undefined, inactive: showInactive ? "1" : undefined, q: qRaw || undefined, gaps: gaps ? "1" : undefined };
  const link = (over: Partial<Record<keyof typeof filters, string | undefined>>) => {
    const p = new URLSearchParams(P.query);
    Object.entries({ ...filters, ...over }).forEach(([k, v]) => { if (v) p.set(k, v); });
    return `/?${p}`;
  };
  const keep = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString();

  const groups = ALL_TEAMS.filter((x) => !team || x === team).map((g) => {
    let rs = M.rows.filter((r) => (ALL_TEAMS.includes(r.e.team) ? r.e.team : "Other") === g);
    if (q) rs = rs.filter((r) => r.e.name.toLowerCase().includes(q));
    if (gaps) rs = rs.filter((r) => r.missing > 0);
    rs.sort((a, b) => b.logged - a.logged || a.e.name.localeCompare(b.e.name));
    return { g, rs, tl: rs.reduce((s, r) => s + r.logged, 0), tb: rs.reduce((s, r) => s + r.base, 0) };
  }).filter((x) => x.rs.length);
  const shown = groups.reduce((s, x) => s + x.rs.length, 0);
  // Days over 12h in this period (managers and admins see a list to follow up)
  const overDays = editor ? M.rows.flatMap((r) => M.days.filter((d) => isOverDay(r.byDay.get(d) || 0)).map((d) => ({ id: r.e.id, name: r.e.name, team: r.e.team, d, v: r.byDay.get(d) || 0 })))
    .sort((a, b) => b.v - a.v) : [];
  const cols = M.days.length + (editor ? 6 : 5);

  const dayState = (id: number, d: string, v: number) => {
    const lv = M.leaveMap.get(`${id}|${d}`) || 0;
    const we = isWeekend(d), hd = M.hol.has(d);
    if (lv && !v) return { cls: "lv", txt: "L", tip: `Leave · ${hm(lv * 3600)}` };
    if (v) return isOverDay(v)
      ? { cls: `${heat(v, hpd)} over`, txt: hm(v), tip: `${hm(v)} · over 12h in one day, probably several days booked to one date. Check in Jira.` }
      : { cls: heat(v, hpd), txt: hm(v), tip: hm(v) };
    if (hd) return { cls: "", txt: "", tip: M.hol.get(d) || "Public holiday" };
    if (we) return { cls: "", txt: "", tip: "Weekend" };
    if (d < M.today) return { cls: "gap", txt: "", tip: "Nothing logged" };
    return { cls: d > M.today ? "future" : "", txt: "", tip: "" };
  };

  const exportItems = [
    { heading: `${fmtD(P.start)} – ${fmtD(P.end)}` },
    { label: "Timesheet (daily hours)", icon: <FileSpreadsheet />, href: `/api/export?from=${P.start}&to=${P.end}&type=daily`, download: true },
    { label: "All worklogs", icon: <ListChecks />, href: `/api/export?from=${P.start}&to=${P.end}&type=logs`, download: true },
  ];

  return (
    <div className="stack-lg page-enter">
      <PageHeader
        hero
        title="Overview"
        subtitle={team ? <>Showing <b className="strong">{team}</b> · <Link href={link({ team: undefined })}>show all teams</Link></> : "Hours logged and utilisation across the delivery teams."}
        actions={<Menu label="Export" icon={<Download />} items={exportItems}>Export CSV</Menu>}
      >
        <PeriodPicker P={P} base="/" keep={keep} />
      </PageHeader>


      {me && mine && (
        <>
          <div className="section-head">
            <h2>You</h2>
            <p>Just your own hours</p>
          </div>
          <MyWeekCard name={me.name} personId={me.id} w={mine} jiraUrl={jiraBase() ? `${jiraBase()}/jira/your-work` : null} />
          {/* Everything below is the whole team, not just you */}
          <div className="section-head">
            <h2>Everyone</h2>
            <p>{team ? <>The {team} team</> : "All five delivery teams"} · {periodText(P).title}, {periodText(P).sub}</p>
          </div>
        </>
      )}

      <div className="ov-summary">
      <section className="stats" aria-label="Summary">
        <StatCard label="Hours logged" icon={<Clock3 />} value={hm(logged)} sub={<>of <span className="num">{hm(base)}</span> {capLbl}</>} />
        <StatCard label="Utilisation" icon={<Gauge />} value={pct(util)} sub={<><BandBadge util={util} /><span>target 80% · {settings.hours_per_day}h/day</span></>}>
          <Meter util={util} />
        </StatCard>
        <StatCard label="People logging" icon={<Users />} value={<>{loggers}<small> / {counted.length}</small></>} sub="across the five delivery teams" />
        <StatCard
          label="Days with no time" icon={<CalendarX2 />} tone={missing ? "warn" : undefined} value={missing}
          sub={gaps ? "Showing only people with gaps · click to clear" : missing ? "Click to see who" : "Everyone is up to date"}
          href={missing || gaps ? `${link({ gaps: gaps ? undefined : "1" })}#timesheet` : undefined} on={gaps}
          tip="Past working days with nothing logged and no leave"
        />
      </section>

      <Card className="teams-card">
        <CardHeader
          title="Teams"
          description="Select a team to filter the timesheet."
          actions={team ? <Link className="btn btn-ghost btn-sm" href={link({ team: undefined })} scroll={false}><X />Show all</Link> : undefined}
        />
        <div className="team-rows">
          {M.teams.map((x) => {
            const on = team === x.team;
            const logging = x.rows.filter((r) => r.logged > 0).length;
            return (
              <Link key={x.team} href={link({ team: on ? undefined : x.team })} scroll={false} className={`team-row${on ? " is-on" : ""}${team && !on ? " is-dim" : ""}`} aria-pressed={on} style={{ ["--tc" as string]: teamColor(x.team) }}>
                <span className="team-id">
                  <span className="team-name"><span className="team-dot" aria-hidden="true" />{x.team}</span>
                  <span className="small muted">{x.rows.length} people · {logging} logging</span>
                </span>
                <span className="team-bar">
                  <Meter util={x.util} size="sm" label={`${x.team} utilisation`} />
                  <span className="small muted num">{hm(x.logged)} of {hm(x.base)}</span>
                </span>
                <span className="team-pct num">{pct(x.util)}</span>
                <span className="team-band"><BandBadge util={x.util} /></span>
              </Link>
            );
          })}
        </div>
      </Card>
      </div>

      {overDays.length > 0 && (
        <details className="card over-list">
          <summary>
            <span className="over-icon" aria-hidden="true">!</span>
            <span className="grow"><b>{overDays.length} day{overDays.length === 1 ? "" : "s"} with over 12 hours logged</b><span className="muted"> · usually a whole week booked to one date. Ask them to spread it across the right days in Jira.</span></span>
            <span className="btn btn-sm">Show</span>
          </summary>
          <ul>
            {overDays.map((o) => (
              <li key={`${o.id}-${o.d}`}>
                <Link className="person-cell" href={`/person?id=${o.id}&${P.query}`}><Avatar name={o.name} team={o.team} size="sm" /><span className="who"><span className="name">{o.name}</span><span className="meta">{o.team}</span></span></Link>
                <span className="muted">{WD[dow(o.d)]} {fmtD(o.d)}</span>
                <b className="num">{hm(o.v)}</b>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Card id="timesheet">
        <CardHeader
          title="Timesheet"
          description={<span className="row" style={{ gap: 6 }}>Hours logged per person, per day <InfoTip text={`From Jira worklogs, counted on the date the work was logged against. Capacity is ${settings.hours_per_day}h per working day, less public holidays and leave.`} /></span>}
          count={shown}
        />
        <div className="card-toolbar">
          <form className="search" action="/" method="get" role="search">
            {Object.entries({ ...Object.fromEntries(new URLSearchParams(P.query)), team: team || undefined, inactive: showInactive ? "1" : undefined, gaps: gaps ? "1" : undefined })
              .filter(([, v]) => v).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <Search aria-hidden="true" />
            <input className="input input-sm" name="q" type="search" placeholder="Find a person…" defaultValue={qRaw} aria-label="Find a person" />
          </form>
          {team && <Link className="chip on" href={link({ team: undefined })} scroll={false}><span className="team-dot" style={{ ["--tc" as string]: teamColor(team) }} />{team}<X className="x" aria-label="Clear team filter" /></Link>}
          <Link className={`chip${gaps ? " on" : ""}`} href={link({ gaps: gaps ? undefined : "1" })} scroll={false} aria-pressed={gaps}><CalendarX2 />Only missing days</Link>
          {(M.hiddenInactive > 0 || showInactive) && (
            <Link className={`chip${showInactive ? " on" : ""}`} href={link({ inactive: showInactive ? undefined : "1" })} scroll={false} aria-pressed={showInactive}>
              {showInactive ? "Showing inactive" : `Show inactive (${M.hiddenInactive})`}
            </Link>
          )}

        </div>

        <div className="tkey" role="note" aria-label="What the cell colours mean">
          <span className="tkey-item"><span className="tkey-scale" aria-hidden="true"><i className="h1" /><i className="h2" /><i className="h3" /><i className="h4" /></span>Hours logged (darkest = full day)</span>
          <span className="tkey-item"><i className="tkey-sw gap" aria-hidden="true" />No time logged</span>
          <span className="tkey-item"><i className="tkey-sw lv" aria-hidden="true">L</i>Leave</span>
          <span className="tkey-item"><i className="tkey-sw hol" aria-hidden="true" />Public holiday</span>
          <span className="tkey-item"><i className="tkey-sw we" aria-hidden="true" />Weekend</span>
          <span className="tkey-item"><i className="tkey-sw over" aria-hidden="true" />Over 12h in one day</span>
        </div>

        {shown === 0 ? (
          q ? <EmptyState icon={<SearchX />} title={`No one matches “${qRaw}”`} text="Check the spelling, or search all teams." action={<Link className="btn" href={link({ q: undefined, team: undefined })}>Clear search</Link>} />
            : gaps ? <EmptyState tone="success" icon={<Sparkles />} title="No missing days" text="Everyone has logged time or leave for every past working day in this period." action={<Link className="btn" href={link({ gaps: undefined })}>Show everyone</Link>} />
              : <EmptyState icon={<Users />} title="No one to show" text="Nobody on the roster matches these filters." />
        ) : (
          <>
            <div className="table-wrap tgrid-wrap hide-mobile">
              <table className="tgrid">
                <thead>
                  <tr>
                    <th className="person" scope="col">Person</th>
                    {M.days.map((d) => (
                      <th key={d} scope="col" className={`day${isWeekend(d) ? " we" : ""}${M.hol.has(d) ? " hol" : ""}${d === t ? " today" : ""}`} title={M.hol.get(d) || (d === t ? "Today" : "")}>
                        <span>{WD[dow(d)].slice(0, 2)}</span><small>{+d.slice(8, 10)}</small>
                      </th>
                    ))}
                    <th className="r" scope="col">Logged</th>
                    <th className="r cap" scope="col">Capacity</th>
                    <th className="r" scope="col">Util.</th>
                    <th scope="col" className="status">Status</th>
                    {editor && <th scope="col"><span className="sr-only">Actions</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {groups.map(({ g, rs, tl, tb }) => [
                    <tr key={`g-${g}`} className="grp">
                      <td className="person" style={{ ["--tc" as string]: teamColor(g) }}><span className="team-dot" />{g}</td>
                      <td colSpan={cols - 1}>
                        <span className="grp-meta num">{hm(tl)} of {hm(tb)} · {pct(tb > 0 ? tl / tb : null)}{COUNTED.includes(g) ? "" : " · not counted in utilisation"}</span>
                      </td>
                    </tr>,
                    ...rs.map((r) => (
                      <tr key={r.e.id} className={`prow${r.e.active ? "" : " is-off"}`} data-eid={editor ? r.e.id : undefined} data-ename={r.e.name} data-eactive={String(r.e.active)}>
                        <td className="person">
                          <Link className="person-cell" href={`/person?id=${r.e.id}&${P.query}`}>
                            <Avatar name={r.e.name} team={r.e.team} size="sm" />
                            <span className="who">
                              <span className="name">{r.e.name}</span>
                              {!r.e.active ? <span className="meta">Inactive{r.logged ? " · logged time in this period" : ""}</span>
                                : !r.linked ? <span className="meta warn">No Jira account linked</span>
                                  : r.missing ? <span className="meta miss">{r.missing} day{r.missing > 1 ? "s" : ""} with no time</span> : null}
                            </span>
                          </Link>
                        </td>
                        {M.days.map((d) => {
                          const v = r.byDay.get(d) || 0;
                          const s = dayState(r.e.id, d, v);
                          return (
                            <td key={d} className={`day num ${s.cls}${isWeekend(d) ? " we" : ""}${M.hol.has(d) ? " hol" : ""}${d === t ? " today" : ""}`} title={s.tip ? `${WD[dow(d)]} ${fmtD(d)} · ${s.tip}` : undefined}>
                              <i className="dc">{s.txt}{s.cls === "gap" && <span className="sr-only">Nothing logged</span>}</i>
                            </td>
                          );
                        })}
                        <td className="r num strong">{hm(r.logged)}</td>
                        <td className="r num cap muted">{hm(r.base)}</td>
                        <td className={`r num util-txt ${band(r.util).cls}`} title={band(r.util).label}>{pct(r.util)}</td>
                        <td className="status"><BandBadge util={r.util} /></td>
                        {editor && <td className="actions"><PersonMenu person={{ id: r.e.id, name: r.e.name, active: r.e.active }} href={`/person?id=${r.e.id}&${P.query}`} /></td>}
                      </tr>
                    )),
                  ])}
                </tbody>
              </table>
            </div>

            <div className="pcards show-mobile">
              {groups.map(({ g, rs, tl, tb }) => (
                <div key={g} className="pcards-group">
                  <div className="pcards-head" style={{ ["--tc" as string]: teamColor(g) }}><span className="team-dot" />{g}<span className="muted num">{hm(tl)} of {hm(tb)}</span></div>
                  {rs.map((r) => (
                    <Link key={r.e.id} className={`pcard${r.e.active ? "" : " is-off"}`} href={`/person?id=${r.e.id}&${P.query}`} data-eid={editor ? r.e.id : undefined} data-ename={r.e.name} data-eactive={String(r.e.active)}>
                      <Avatar name={r.e.name} team={r.e.team} />
                      <span className="pcard-main">
                        <span className="row-between"><b className="truncate">{r.e.name}</b><span className="num strong">{pct(r.util)}</span></span>
                        <span className="row-between small muted"><span className="num">{hm(r.logged)} of {hm(r.base)}</span><BandBadge util={r.util} /></span>
                        <span className="dots" aria-hidden="true">
                          {M.days.filter((d) => !isWeekend(d)).map((d) => <i key={d} className={dayState(r.e.id, d, r.byDay.get(d) || 0).cls || (M.hol.has(d) ? "hol" : "")} />)}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
