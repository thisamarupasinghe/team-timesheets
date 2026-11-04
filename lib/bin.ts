import { sql } from "./db";

let ready = false;
async function ensure() {
  if (ready) return;
  await sql`create table if not exists recycle_bin (
    id bigserial primary key,
    at timestamptz not null default now(),
    actor text not null,
    kind text not null,
    label text not null,
    detail text,
    data jsonb not null,
    restored_at timestamptz,
    restored_by text
  )`;
  ready = true;
}

export type BinKind = "person" | "leave" | "holiday";

/** Everything anyone deletes is copied here first, so the admin or a manager can put it back. */
export async function toBin(actor: string, kind: BinKind, label: string, detail: string, data: unknown) {
  try {
    await ensure();
    await sql`insert into recycle_bin (actor, kind, label, detail, data) values (${actor}, ${kind}, ${label}, ${detail}, ${sql.json(data as any)})`;
  } catch (e) {
    console.error("recycle bin failed", e);
  }
}

export type BinRow = { id: number; at: string; actor: string; kind: BinKind; label: string; detail: string | null; data: any };
export async function binItems() {
  await ensure();
  return sql<BinRow[]>`select id::int as id, at::text as at, actor, kind, label, detail, data from recycle_bin where restored_at is null order by id desc limit 500`;
}
export async function binItem(id: number) {
  await ensure();
  const [r] = await sql<BinRow[]>`select id::int as id, at::text as at, actor, kind, label, detail, data from recycle_bin where id = ${id} and restored_at is null`;
  return r || null;
}
export async function binDone(id: number, by: string) {
  await sql`update recycle_bin set restored_at = now(), restored_by = ${by} where id = ${id}`;
}
