import { sql } from "./db";

let ready = false;
async function ensure() {
  if (ready) return;
  await sql`create table if not exists audit_log (
    id bigserial primary key,
    at timestamptz not null default now(),
    actor text not null,
    action text not null,
    detail text,
    data jsonb
  )`;
  ready = true;
}

/** Record who changed what. Never blocks the change itself if logging fails. */
export async function logChange(actor: string, action: string, detail: string, data?: unknown) {
  try {
    await ensure();
    await sql`insert into audit_log (actor, action, detail, data) values (${actor}, ${action}, ${detail}, ${data === undefined ? null : sql.json(data as any)})`;
  } catch (e) {
    console.error("audit log failed", e);
  }
}

export type AuditRow = { id: number; at: string; actor: string; action: string; detail: string | null; has_data: boolean };
export async function recentChanges(limit = 500, q = "") {
  await ensure();
  const like = `%${q.replace(/[%_]/g, "")}%`;
  return sql<AuditRow[]>`
    select id::int as id, at::text as at, actor, action, detail, (data is not null) as has_data
    from audit_log
    ${q ? sql`where actor ilike ${like} or action ilike ${like} or detail ilike ${like}` : sql``}
    order by id desc limit ${limit}`;
}
export async function auditData(id: number) {
  await ensure();
  const [r] = await sql<{ action: string; data: any }[]>`select action, data from audit_log where id = ${id}`;
  return r || null;
}

// ---- Sign-in history (admin only to view)
let loginReady = false;
async function ensureLogins() {
  if (loginReady) return;
  await sql`create table if not exists login_log (
    id bigserial primary key,
    at timestamptz not null default now(),
    email text not null,
    event text not null,
    role text
  )`;
  loginReady = true;
}
export async function logLogin(email: string | null | undefined, event: string, role?: string | null) {
  if (!email) return;
  try {
    await ensureLogins();
    await sql`insert into login_log (email, event, role) values (${email.toLowerCase()}, ${event}, ${role ?? null})`;
  } catch (e) {
    console.error("login log failed", e);
  }
}
export type LoginRow = { id: number; at: string; email: string; event: string; role: string | null };
export async function recentLogins(limit = 500, q = "") {
  await ensureLogins();
  const like = `%${q.replace(/[%_]/g, "")}%`;
  return sql<LoginRow[]>`select id::int as id, at::text as at, email, event, role from login_log
    ${q ? sql`where email ilike ${like} or event ilike ${like}` : sql``} order by id desc limit ${limit}`;
}
export async function loginSummary() {
  await ensureLogins();
  return sql<{ email: string; last: string; n: number; role: string | null }[]>`
    select email, max(at)::text as last, count(*)::int as n, (array_agg(role order by id desc))[1] as role
    from login_log where event = 'Signed in' group by email order by max(at) desc`;
}
