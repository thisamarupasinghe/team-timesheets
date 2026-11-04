"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canEdit, requireAdmin, requireEditor, requireUser } from "@/lib/auth";
import { logChange } from "@/lib/audit";
import { toBin, binItem, binDone } from "@/lib/bin";
import { sql } from "@/lib/db";
import { ALL_TEAMS } from "@/lib/format";
import { EMPLOYEE_LIST } from "@/lib/employee-list";
import { daysBetween, isDate, isWeekend } from "@/lib/time";
import { employeeByEmail, getSettings } from "@/lib/queries";

const str = (f: FormData, k: string) => String(f.get(k) || "").trim();
const ids = (v: string) => [...new Set(v.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean))];
const safeBack = (b: string, fallback: string) => (b.startsWith("/") && !b.startsWith("//") ? b : fallback);
const nameOf = async (id: number) => (await sql<{ name: string }[]>`select name from employees where id = ${id}`)[0]?.name ?? `person #${id}`;
const mail = (v: string) => v.trim().toLowerCase() || null;

/** Admins and managers can change anyone's leave; everyone else can only change their own. */
async function leaveActor(employeeId: number) {
  const u = await requireUser();
  if (canEdit(u.role)) return u;
  const own = await employeeByEmail(u.email);
  if (own && own.id === employeeId) return u;
  redirect("/");
}

export async function addEmployee(f: FormData) {
  const u = await requireEditor();
  const name = str(f, "name");
  const team = ALL_TEAMS.includes(str(f, "team")) ? str(f, "team") : "Other";
  if (!name) redirect("/admin?err=name");
  const jira = u.role === "admin" ? ids(str(f, "jira_ids")) : [];
  const r = await sql`insert into employees (name, emp_no, email, team, jira_ids) values (${name}, ${str(f, "emp_no") || null}, ${u.role === "admin" ? mail(str(f, "email")) : null}, ${team}, ${jira}) on conflict do nothing returning id`;
  if (r.length) await logChange(u.email, "Added person", `${name} · ${team}${jira.length ? ` · Jira ${jira.join(", ")}` : ""}`);
  revalidatePath("/admin");
  redirect(r.length ? "/admin?ok=added" : "/admin?err=exists");
}

export async function updateEmployee(f: FormData) {
  const u = await requireEditor();
  const id = Number(f.get("id"));
  const team = ALL_TEAMS.includes(str(f, "team")) ? str(f, "team") : "Other";
  const active = f.get("active") === "on";
  const [before] = await sql<{ name: string; team: string; active: boolean; jira_ids: string[]; email: string | null }[]>`select name, team, active, jira_ids, email from employees where id = ${id}`;
  if (!before) redirect("/admin");
  const email = u.role === "admin" ? mail(str(f, "email")) : before.email; // only the admin changes work emails
  const jira = u.role === "admin" ? ids(str(f, "jira_ids")) : before.jira_ids; // only the admin changes Jira links
  await sql`update employees set team = ${team}, active = ${active}, jira_ids = ${jira}, email = ${email} where id = ${id}`;
  const ch: string[] = [];
  if (before.team !== team) ch.push(`team ${before.team} → ${team}`);
  if (before.active !== active) ch.push(active ? "marked active" : "marked inactive");
  if ([...before.jira_ids].sort().join() !== [...jira].sort().join()) ch.push(`Jira ids ${before.jira_ids.join(", ") || "none"} → ${jira.join(", ") || "none"}`);
  if ((before.email || "") !== (email || "")) ch.push(`work email ${before.email || "none"} → ${email || "none"}`);
  if (ch.length) await logChange(u.email, "Edited person", `${before.name}: ${ch.join("; ")}`);
  revalidatePath("/admin");
  redirect("/admin?ok=saved");
}

export async function saveSettings(f: FormData) {
  const u = await requireAdmin();
  const hpd = Number(f.get("hours_per_day")), anchor = str(f, "sprint_anchor"), n = Number(f.get("sprint_anchor_number"));
  if (!(hpd > 0 && hpd <= 12) || !isDate(anchor) || !(n > 0)) redirect("/admin?err=settings");
  const old = await getSettings();
  await sql`insert into settings (key, value) values
    ('hours_per_day', ${sql.json(hpd)}), ('sprint_anchor', ${sql.json(anchor)}), ('sprint_anchor_number', ${sql.json(n)})
    on conflict (key) do update set value = excluded.value`;
  await logChange(u.email, "Changed settings", `Hours/day ${old.hours_per_day} → ${hpd}; sprint anchor ${old.sprint_anchor} (#${old.sprint_anchor_number}) → ${anchor} (#${n})`);
  revalidatePath("/", "layout");
  redirect("/admin?ok=settings");
}

export async function addHoliday(f: FormData) {
  const u = await requireAdmin();
  const date = str(f, "date"), name = str(f, "name");
  if (!isDate(date) || !name) redirect("/admin?err=holiday");
  const s = await getSettings();
  const list = [...s.holidays.filter((h) => h.date !== date), { date, name }].sort((a, b) => a.date.localeCompare(b.date));
  await sql`insert into settings (key, value) values ('holidays', ${sql.json(list)}) on conflict (key) do update set value = excluded.value`;
  await logChange(u.email, "Added holiday", `${date} · ${name}`);
  revalidatePath("/", "layout");
  redirect("/admin?ok=holiday");
}

export async function removeHoliday(f: FormData) {
  const u = await requireAdmin();
  const s = await getSettings();
  const gone = s.holidays.find((h) => h.date === str(f, "date"));
  const list = s.holidays.filter((h) => h.date !== str(f, "date"));
  await sql`insert into settings (key, value) values ('holidays', ${sql.json(list)}) on conflict (key) do update set value = excluded.value`;
  if (gone) { await logChange(u.email, "Removed holiday", `${gone.date} · ${gone.name}`); await toBin(u.email, "holiday", gone.name, gone.date, { holiday: gone }); }
  revalidatePath("/", "layout");
  redirect("/admin?ok=holiday");
}

export async function addLeave(f: FormData) {
  const id = Number(f.get("employee_id"));
  const u = await leaveActor(id);
  const from = str(f, "from"), to = str(f, "to") || from;
  const hours = Number(f.get("hours")), note = str(f, "note") || "Leave";
  const back = safeBack(str(f, "back"), `/person?id=${id}`);
  if (!isDate(from) || !isDate(to) || !(hours > 0)) redirect(back);
  const s = await getSettings();
  const hol = new Set(s.holidays.map((h) => h.date));
  const days = daysBetween(from, to < from ? from : to).filter((d) => !isWeekend(d) && !hol.has(d)).slice(0, 60);
  for (const d of days) {
    await sql`insert into leave (employee_id, day, hours, note) values (${id}, ${d}, ${hours}, ${note})
              on conflict (employee_id, day) do update set hours = excluded.hours, note = excluded.note`;
  }
  if (days.length) await logChange(u.email, "Added leave", `${await nameOf(id)}: ${days[0]}${days.length > 1 ? ` to ${days[days.length - 1]}` : ""} · ${days.length} day${days.length > 1 ? "s" : ""} · ${hours}h/day · ${note}`);
  revalidatePath("/", "layout");
  redirect(back);
}

export async function removeLeave(f: FormData) {
  const id = Number(f.get("employee_id")), day = str(f, "day");
  const u = await leaveActor(id);
  const gone = await sql`delete from leave where employee_id = ${id} and day = ${day}::date returning hours::float as hours, note`;
  if (gone.length) {
    const who = await nameOf(id);
    await logChange(u.email, "Removed leave", `${who}: ${day} · ${gone[0].hours}h · ${gone[0].note || "Leave"}`);
    await toBin(u.email, "leave", who, `${day} · ${gone[0].hours}h · ${gone[0].note || "Leave"}`, { employee_id: id, day, hours: gone[0].hours, note: gone[0].note });
  }
  revalidatePath("/", "layout");
  redirect(safeBack(str(f, "back"), `/person?id=${id}`));
}

export async function linkJira(f: FormData) {
  const u = await requireAdmin();
  const id = Number(f.get("employee_id")), acct = str(f, "account_id");
  if (!Number.isInteger(id) || !acct) redirect("/unmatched?err=link");
  const [jn] = await sql<{ n: string | null }[]>`select max(author_name) as n from worklogs where author_id = ${acct}`;
  await sql`update employees set jira_ids = (select array_agg(distinct x) from unnest(jira_ids || ${acct}::text) x) where id = ${id}`;
  await logChange(u.email, "Linked Jira account", `${jn?.n || acct} (${acct}) → ${await nameOf(id)}`);
  revalidatePath("/", "layout");
  redirect("/unmatched?ok=linked");
}

/** Admin only: someone logged time in Jira but isn't on the roster yet. Add them and link their Jira account in one go. */
export async function addFromJira(f: FormData) {
  const u = await requireAdmin();
  const acct = str(f, "account_id"), team = ALL_TEAMS.includes(str(f, "team")) ? str(f, "team") : "Other";
  if (!acct) redirect("/unmatched?err=link");
  const [jn] = await sql<{ n: string | null }[]>`select max(author_name) as n from worklogs where author_id = ${acct}`;
  const name = (jn?.n || "").trim();
  if (!name) redirect("/unmatched?err=link");
  const r = await sql`insert into employees (name, team, jira_ids) values (${name}, ${team}, ${[acct]}) on conflict do nothing returning id`;
  if (r.length) await logChange(u.email, "Added person", `${name} · ${team} · from Jira`);
  revalidatePath("/", "layout");
  redirect("/unmatched?ok=added");
}

/** Admin only: tie a sign-in email to a roster person so they can add their own leave. */
export async function linkEmail(f: FormData) {
  const u = await requireAdmin();
  const id = Number(f.get("employee_id")), email = mail(str(f, "email"));
  if (!Number.isInteger(id) || !email) redirect("/activity?view=logins&err=link");
  await sql`update employees set email = ${email} where id = ${id}`;
  await logChange(u.email, "Linked work email", `${email} → ${await nameOf(id)}`);
  revalidatePath("/", "layout");
  redirect("/activity?view=logins&ok=email");
}

/** Admin or manager: put something from the recycle bin back. (Holidays: admin only, like adding them.) */
export async function restoreFromBin(f: FormData) {
  const u = await requireEditor();
  const item = await binItem(Number(f.get("id")));
  if (!item) redirect("/bin?err=gone");
  const d = item!.data;
  if (item!.kind === "person") {
    const p = d.employee;
    const made = await sql`insert into employees (name, emp_no, email, team, active, note, jira_ids)
      values (${p.name}, ${p.emp_no}, ${p.email}, ${p.team}, ${p.active}, ${p.note}, ${p.jira_ids || []}) on conflict do nothing returning id`;
    if (!made.length) redirect("/bin?err=exists");
    for (const l of d.leave || []) {
      await sql`insert into leave (employee_id, day, hours, note) values (${made[0].id}, ${l.day}::date, ${l.hours}, ${l.note}) on conflict do nothing`;
    }
  } else if (item!.kind === "leave") {
    const ok = await sql`select 1 from employees where id = ${d.employee_id}`;
    if (!ok.length) redirect("/bin?err=noperson");
    await sql`insert into leave (employee_id, day, hours, note) values (${d.employee_id}, ${d.day}::date, ${d.hours}, ${d.note}) on conflict do nothing`;
  } else if (item!.kind === "holiday") {
    if (u.role !== "admin") redirect("/bin?err=admin");
    const s = await getSettings();
    const list = [...s.holidays.filter((h) => h.date !== d.holiday.date), d.holiday].sort((x: any, y: any) => x.date.localeCompare(y.date));
    await sql`insert into settings (key, value) values ('holidays', ${sql.json(list)}) on conflict (key) do update set value = excluded.value`;
  }
  await binDone(item!.id, u.email);
  await logChange(u.email, "Restored from recycle bin", `${item!.kind}: ${item!.label}${item!.detail ? ` · ${item!.detail}` : ""}`);
  revalidatePath("/", "layout");
  redirect("/bin?ok=restored");
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Admin only: compare the roster with HR employee list, add anyone missing and make everyone active again. */
export async function checkRoster() {
  const u = await requireAdmin();
  const people = await sql<{ id: number; name: string; emp_no: string | null; active: boolean; note: string | null }[]>`select id, name, emp_no, active, note from employees`;
  const byNo = new Map(people.filter((p) => p.emp_no).map((p) => [norm(p.emp_no!), p]));
  let added = 0, reactivated = 0;
  const names: string[] = [];
  for (const [no, full] of EMPLOYEE_LIST) {
    const hit = byNo.get(norm(no));
    if (!hit) {
      const r = await sql`insert into employees (name, emp_no, team) values (${full}, ${no}, 'Other') on conflict do nothing returning id`;
      if (r.length) { added++; names.push(`${full} (added, team Other)`); }
    } else if (!hit.active && hit.note !== "Yet to join") {
      await sql`update employees set active = true where id = ${hit.id}`;
      reactivated++; names.push(`${hit.name} (made active)`);
    }
  }
  await logChange(u.email, "Checked roster", `${EMPLOYEE_LIST.length} people on the employee list · ${added} added · ${reactivated} made active again${names.length ? ` · ${names.join(", ")}` : ""}`);
  revalidatePath("/", "layout");
  redirect(`/admin?ok=roster&a=${added}&r=${reactivated}`);
}
