import { CalendarDays, CalendarPlus, Clock3, Mail, PlugZap, ShieldAlert, Trash2, X } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getSettings, getSync } from "@/lib/queries";
import { jiraConfigured } from "@/lib/jira";
import { fmtDY, dow, WD, today } from "@/lib/time";
import { humanDates } from "@/lib/format";
import { addHoliday, matchEmails, removeHoliday, saveSettings, saveTokenExpiry } from "../admin/actions";
import { daysUntil, getTokenExpiry } from "@/lib/health";
import { getErrors, summarise } from "@/lib/errors";
import { getScriptSeen, scriptStatus } from "@/lib/script";
import LoadHistory from "../admin/LoadHistory";
import PageHeader from "../../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import Callout from "../../components/ui/Callout";
import EmptyState from "../../components/ui/EmptyState";
import SubmitButton from "../../components/ui/SubmitButton";
import { ConfirmAction } from "../../components/ui/Dialog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

const TZ = process.env.APP_TIMEZONE || "UTC";
const SECTIONS = [["jira", "Jira connection", PlugZap], ["work", "Work week & sprints", Clock3], ["holidays", "Public holidays", CalendarDays], ["emails", "Work emails", Mail], ["errors", "Website errors", ShieldAlert]] as const;

export default async function Settings(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  await requireAdmin();
  const [settings, sync, tokenExpires, errorList, seen] = await Promise.all([getSettings(), getSync(), getTokenExpiry(), getErrors().catch(() => []), getScriptSeen().catch(() => null)]);
  const script = scriptStatus(seen);
  const errors = summarise(errorList, 7 * 24);
  const dayErrors = summarise(errorList, 24).count;
  const errAt = (ms: number) => new Date(ms).toLocaleString("en-GB", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const left = tokenExpires ? daysUntil(tokenExpires) : null;
  const configured = jiraConfigured();
  const t = today();
  const upcoming = settings.holidays.filter((h) => h.date >= t);
  const past = settings.holidays.filter((h) => h.date < t);
  const syncAt = sync ? new Date(sync.at).toLocaleString("en-GB", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <div className="stack-lg page-enter">
      <PageHeader title="Settings" subtitle="How the site connects to Jira and counts capacity. Only the admin can change these." />

      <div className="settings">
        <nav className="settings-nav" aria-label="Settings sections">
          {SECTIONS.map(([id, label, I]) => <a key={id} href={`#${id}`}><I aria-hidden="true" />{label}</a>)}
        </nav>

        <div className="stack-lg">
          <Card id="jira">
            <CardHeader title="Jira connection" description="While the site is open it asks Jira for new, edited and deleted worklogs every 2 minutes, plus a full reload of the last 60 days every night."
              actions={configured ? <Badge tone="success" dot>Connected</Badge> : <Badge tone="warning" dot>Not set up</Badge>} />
            <CardBody className="stack">
              {sync ? (
                sync.ok
                  ? <p className="muted">Last update <b className="strong">{syncAt}</b>: {(sync as any).mode === "recent"
                      ? <>quick check, <span className="num">{sync.count + ((sync as any).deleted || 0)}</span> change{sync.count + ((sync as any).deleted || 0) === 1 ? "" : "s"} from Jira. The site checks every 2 minutes while it&apos;s open, and reloads the last 60 days every night.</>
                      : <><span className="num">{sync.count}</span> worklogs for {humanDates(`${sync.from} to ${sync.to}`)}.</>}</p>
                  : <Callout tone="danger" title="The last update failed">{sync.error}</Callout>
              ) : <p className="muted">No update has run yet.</p>}
              {!configured && <Callout tone="warning">Add JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN to the site&apos;s environment variables and redeploy.</Callout>}
              <hr className="divider" />
              <form action={saveTokenExpiry} className="stack-sm">
                <p className="strong">When does the Jira API token expire?</p>
                <p className="small muted">Atlassian tokens last at most a year. Enter the date you chose when creating it; the site warns admins two weeks before, and the daily 9 am alert email says so too.</p>
                <div className="form-inline">
                  <label className="field"><span className="sr-only">Token expiry date</span><input className="input" type="date" name="expires" defaultValue={tokenExpires || ""} /></label>
                  <SubmitButton variant="secondary" pendingText="Saving…">Save date</SubmitButton>
                  {left != null && (left < 0 ? <Badge tone="danger" dot>Expired {-left} day{left === -1 ? "" : "s"} ago</Badge>
                    : left <= 14 ? <Badge tone="warning" dot>Expires in {left} day{left === 1 ? "" : "s"}</Badge>
                      : <Badge tone="success" dot>{left} days left</Badge>)}
                </div>
              </form>
              <hr className="divider" />
              <div className="stack-sm">
                <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
                  <p className="strong">Reminder and alert emails</p>
                  {script.state === "ok" ? <Badge tone="success" dot>Up to date</Badge>
                    : script.state === "never" ? <Badge dot>Not heard from yet</Badge>
                      : <Badge tone="warning" dot>{script.state === "silent" ? "Not running" : "Needs updating"}</Badge>}
                </div>
                <p className="small muted">
                  {script.text}
                  {seen && <> Last check-in <b className="strong">{errAt(seen.at)}</b>.</>}
                </p>
              </div>
              <hr className="divider" />
              <div>
                <p className="strong">Bring in older sprints</p>
                <p className="small muted" style={{ marginBottom: 10 }}>Use this once after setup, or after linking accounts that logged time a while ago.</p>
                <LoadHistory configured={configured} />
              </div>
            </CardBody>
          </Card>

          <Card id="work">
            <CardHeader title="Work week & sprints" description="Capacity is hours per working day, less public holidays and leave. Sprints are two weeks, numbered from the anchor below." />
            <form action={saveSettings}>
              <CardBody>
                <div className="form-grid">
                  <label className="field"><span className="field-label">Hours per working day</span><input className="input" name="hours_per_day" type="number" min="1" max="12" step="0.5" defaultValue={settings.hours_per_day} required /></label>
                  <label className="field"><span className="field-label">A sprint&apos;s start date</span><input className="input" name="sprint_anchor" type="date" defaultValue={settings.sprint_anchor} required /></label>
                  <label className="field"><span className="field-label">That sprint&apos;s number</span><input className="input" name="sprint_anchor_number" type="number" min="1" defaultValue={settings.sprint_anchor_number} required /></label>
                </div>
              </CardBody>
              <div className="card-footer form-actions">
                <SubmitButton pendingText="Saving…">Save settings</SubmitButton>
              </div>
            </form>
          </Card>

          <Card id="holidays">
            <CardHeader title="Public holidays" count={settings.holidays.length} description="Excluded from capacity for everyone." />
            <CardBody className="stack">
              {settings.holidays.length ? (
                <div className="hol-list">
                  {[...upcoming, ...past.reverse()].map((h) => (
                    <div key={h.date} className={`hol-item${h.date < t ? " past" : ""}`}>
                      <span className="hol-date"><b className="num">{+h.date.slice(8, 10)}</b><small>{fmtDY(h.date).split(" ")[1]}</small></span>
                      <span className="grow"><span className="strong">{h.name}</span><span className="small muted"> · {WD[dow(h.date)]} {fmtDY(h.date)}</span></span>
                      <ConfirmAction
                        trigger={{ label: `Remove ${h.name}`, icon: <X />, variant: "ghost", size: "sm", iconOnly: true }}
                        action={removeHoliday} fields={{ date: h.date }} icon={<Trash2 />}
                        title={`Remove ${h.name}?`} description="Capacity goes back up for that day. You can restore it from the Recycle bin." confirmLabel="Remove holiday"
                      />
                    </div>
                  ))}
                </div>
              ) : <EmptyState compact icon={<CalendarDays />} title="No public holidays yet" text="Add them below so they don't count as missing days." />}
              <form action={addHoliday} className="form-inline add-row">
                <label className="field"><span className="field-label">Date</span><input className="input" name="date" type="date" required /></label>
                <label className="field" style={{ flex: "1 1 240px" }}><span className="field-label">Name</span><input className="input" name="name" placeholder="e.g. Il Full Moon Poya Day" required /></label>
                <SubmitButton variant="secondary" icon={<CalendarPlus />}>Add holiday</SubmitButton>
              </form>
            </CardBody>
          </Card>

          <Card id="emails">
            <CardHeader title="Link work emails" description="Lets each person sign in and add their own leave. Paste work emails, one per line or separated by commas; each is matched to the one person whose name fits it." />
            <CardBody className="stack">
              {searchParams.ok === "emails" && (
                <Callout tone={searchParams.u ? "warning" : "success"} title={`Linked ${Number(searchParams.m) || 0} ${Number(searchParams.m) === 1 ? "person" : "people"}`}>
                  {Number(searchParams.s) ? `${searchParams.s} were already linked. ` : ""}
                  {searchParams.u ? <>Couldn&apos;t match: <span className="mono">{searchParams.u}</span>. Link these by hand on People or Activity → Sign-ins.</> : "Every email matched someone."}
                </Callout>
              )}
              <form action={matchEmails} className="stack">
                <label className="field">
                  <span className="sr-only">Work emails</span>
                  <textarea className="textarea mono" name="emails" rows={5} placeholder={"alex.morgan@example.com\nsam.rivera@example.com"} required />
                </label>
                <div className="form-actions"><SubmitButton icon={<Mail />} pendingText="Matching…">Match emails to people</SubmitButton></div>
              </form>
            </CardBody>
          </Card>

          <Card id="errors">
            <CardHeader title="Website errors" count={errors.count || undefined}
              description="Pages or data links that crashed on the live site in the last 7 days. If any happen, the daily 9 am email lists them."
              actions={dayErrors ? <Badge tone="danger" dot>{dayErrors} in the last day</Badge> : <Badge tone="success" dot>None in the last day</Badge>} />
            {errors.count ? (
              <CardBody flush>
                <div className="table-wrap">
                  <table className="table stacked">
                    <thead><tr><th>When</th><th>Page</th><th>What happened</th></tr></thead>
                    <tbody>
                      {errors.latest.map((e, i) => (
                        <tr key={`${e.at}-${i}`}>
                          <td className="num nowrap" data-label="When">{errAt(e.at)}</td>
                          <td className="mono small" data-label="Page">{e.path}{e.kind === "browser" && <span className="faint"> · in the browser</span>}</td>
                          <td className="small" data-label="What happened">{e.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            ) : (
              <CardBody><EmptyState compact tone="success" icon={<ShieldAlert />} title="No errors this week" text="Every page and data link has worked for everyone." /></CardBody>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
