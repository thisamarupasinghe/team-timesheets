import { NextResponse } from "next/server";
import { editorOrNull } from "@/lib/auth";
import { logChange } from "@/lib/audit";
import { toBin } from "@/lib/bin";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const u = await editorOrNull();
  if (!u) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const id = Number(b.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Missing person" }, { status: 400 });
  if (b.action === "delete") {
    const [emp] = await sql`select name, emp_no, email, team, active, note, jira_ids from employees where id = ${id}`;
    if (!emp) return NextResponse.json({ ok: true, name: null });
    const leave = await sql`select to_char(day, 'YYYY-MM-DD') as day, hours::float as hours, note from leave where employee_id = ${id} order by day`;
    await logChange(u.email, "Deleted person", `${emp.name} · ${emp.team}${leave.length ? ` · ${leave.length} leave days` : ""}`, { employee: emp, leave });
    await toBin(u.email, "person", emp.name, `${emp.team}${emp.emp_no ? ` · ${emp.emp_no}` : ""}${leave.length ? ` · ${leave.length} leave days` : ""}`, { employee: emp, leave });
    await sql`delete from employees where id = ${id}`;
    return NextResponse.json({ ok: true, name: emp.name });
  }
  if (b.action === "active") {
    const r = await sql`update employees set active = ${!!b.active} where id = ${id} returning name`;
    if (r.length) await logChange(u.email, "Edited person", `${r[0].name}: marked ${b.active ? "active" : "inactive"}`);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
