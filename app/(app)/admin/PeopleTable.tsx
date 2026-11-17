"use client";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Link2, Link2Off, MoreHorizontal, Pencil, Search, SearchX, UserCog, X } from "lucide-react";
import type { Employee } from "@/lib/queries";
import Avatar, { teamColor } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import Menu from "../../components/ui/Menu";
import EmptyState from "../../components/ui/EmptyState";
import SubmitButton from "../../components/ui/SubmitButton";
import { Modal, useCloseOnNavigate } from "../../components/ui/Dialog";
import { usePersonActions } from "../../components/PersonActions";

type Status = "active" | "inactive" | "all";

export default function PeopleTable({ people, teams, isAdmin, update }: {
  people: Employee[]; teams: string[]; isAdmin: boolean; update: (f: FormData) => void | Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [team, setTeam] = useState("");
  const [status, setStatus] = useState<Status>("active");
  const [editing, setEditing] = useState<Employee | null>(null);
  const closeEdit = useCallback((v: boolean) => { if (!v) setEditing(null); }, []);
  useCloseOnNavigate(closeEdit);
  const { items, dialog } = usePersonActions();

  const counts = useMemo(() => ({ all: people.length, active: people.filter((p) => p.active).length, inactive: people.filter((p) => !p.active).length }), [people]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return people.filter((p) =>
      (status === "all" || (status === "active") === p.active) &&
      (!team || p.team === team) &&
      (!s || p.name.toLowerCase().includes(s) || (p.emp_no || "").toLowerCase().includes(s) || (p.email || "").toLowerCase().includes(s)));
  }, [people, q, team, status]);
  const filtered = q || team || status !== "active";

  return (
    <>
      <div className="card-toolbar">
        <div className="search" style={{ flex: "1 1 220px", maxWidth: 320 }}>
          <Search aria-hidden="true" />
          <input className="input input-sm" type="search" placeholder="Search name, emp no. or email…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" />
        </div>
        <label className="sr-only" htmlFor="pp-team">Team</label>
        <select id="pp-team" className="select select-sm" value={team} onChange={(e) => setTeam(e.target.value)} style={{ width: "auto" }}>
          <option value="">All teams</option>{teams.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="seg" role="group" aria-label="Status">
          {(["active", "inactive", "all"] as const).map((s) => (
            <button key={s} type="button" className={status === s ? "on" : ""} aria-pressed={status === s} onClick={() => setStatus(s)}>
              {s[0].toUpperCase() + s.slice(1)}<span className="count num">{counts[s]}</span>
            </button>
          ))}
        </div>
        {filtered && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setQ(""); setTeam(""); setStatus("active"); }}><X />Reset</button>}
        <span className="spacer" />
        <span className="small muted" aria-live="polite">{shown.length} shown</span>
      </div>

      {shown.length ? (
        <div className="table-wrap">
          <table className="table stacked people">
            <thead>
              <tr><th>Person</th><th>Emp no.</th><th>Team</th><th>Jira</th>{isAdmin && <th>Work email</th>}<th>Status</th><th><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} className={p.active ? "" : "is-off"} data-eid={p.id} data-ename={p.name} data-eactive={String(p.active)}>
                  <td>
                    <Link className="person-cell" href={`/person?id=${p.id}`}>
                      <Avatar name={p.name} team={p.team} size="sm" />
                      <span className="who"><span className="name">{p.name}</span>{p.note && <span className="meta">{p.note}</span>}</span>
                    </Link>
                  </td>
                  <td className="mono muted emp" data-label="Emp no.">{p.emp_no || "–"}</td>
                  <td data-label="Team"><Badge tone="outline" icon={<span className="team-dot" style={{ ["--tc" as string]: teamColor(p.team) }} />}>{p.team}</Badge></td>
                  <td data-label="Jira">
                    {p.jira_ids.length ? <Badge tone="success" icon={<Link2 />} title={p.jira_ids.join(", ")}>{p.jira_ids.length > 1 ? `${p.jira_ids.length} accounts` : "Linked"}</Badge>
                      : <Badge tone="warning" icon={<Link2Off />}>Not linked</Badge>}
                  </td>
                  {isAdmin && <td className="small email" data-label="Email">{p.email ? <span className="truncate" style={{ display: "block", maxWidth: 240 }}>{p.email}</span> : <span className="faint">–</span>}</td>}
                  <td data-label="Status">{p.active ? <Badge tone="success" dot>Active</Badge> : <Badge dot>Inactive</Badge>}</td>
                  <td className="actions">
                    <span className="row" style={{ flexWrap: "nowrap", gap: 2 }}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}><Pencil /><span className="hide-mobile">Edit</span></button>
                      <Menu label={`More actions for ${p.name}`} icon={<MoreHorizontal />} variant="ghost" size="sm" items={items(p, { href: `/person?id=${p.id}` })} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={<SearchX />} title="No one matches" text="Try a different name, team or status." action={<button type="button" className="btn" onClick={() => { setQ(""); setTeam(""); setStatus("all"); }}>Show everyone</button>} />
      )}

      <Modal drawer open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit ${editing.name}` : "Edit"} description={editing?.emp_no ? `Employee no. ${editing.emp_no}` : undefined} icon={<UserCog />}>
        {editing && (
          <form action={update} className="drawer-form" key={editing.id}>
            <input type="hidden" name="id" value={editing.id} />
            <div className="modal-body">
              <label className="field">
                <span className="field-label">Team</span>
                <select className="select" name="team" defaultValue={editing.team}>{teams.map((x) => <option key={x}>{x}</option>)}</select>
                <span className="field-hint">Only the five delivery teams count towards utilisation.</span>
              </label>
              {isAdmin && (
                <label className="field">
                  <span className="field-label">Jira account ids</span>
                  <input className="input mono" name="jira_ids" defaultValue={editing.jira_ids.join(", ")} placeholder="e.g. 5f1c2…" />
                  <span className="field-hint">Separate several with commas.</span>
                </label>
              )}
              {isAdmin && (
                <label className="field">
                  <span className="field-label">Work email</span>
                  <input className="input" name="email" type="email" defaultValue={editing.email || ""} placeholder="name@example.com" />
                  <span className="field-hint">Lets this person sign in and add their own leave.</span>
                </label>
              )}
              <label className="switch">
                <input type="checkbox" name="active" defaultChecked={editing.active} />
                Active
                <span className="field-hint">Inactive people are hidden from the timesheet but keep their history.</span>
              </label>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn" data-close>Cancel</button>
              <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
      {dialog}
    </>
  );
}
