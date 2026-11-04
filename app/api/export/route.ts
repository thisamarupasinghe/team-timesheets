import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { allWorklogs, dailyTotals, getEmployees } from "@/lib/queries";
import { isDate } from "@/lib/time";

export const dynamic = "force-dynamic";
const cell = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const hours = (s: number) => Math.round((s / 3600) * 100) / 100;

export async function GET(req: Request) {
  await requireUser();
  const u = new URL(req.url);
  const from = u.searchParams.get("from"), to = u.searchParams.get("to");
  if (!isDate(from) || !isDate(to)) return NextResponse.json({ error: "from and to are required" }, { status: 400 });
  let rows: unknown[][];
  if (u.searchParams.get("type") === "logs") {
    rows = [["Date", "Person", "Emp no.", "Team", "Ticket", "Summary", "Project", "Hours", "Comment"]];
    for (const w of await allWorklogs(from, to)) rows.push([w.day, w.name, w.emp_no, w.team, w.issue_key, w.summary, w.project, hours(w.secs), w.comment]);
  } else {
    const people = new Map((await getEmployees(false)).map((e) => [e.id, e]));
    rows = [["Date", "Person", "Emp no.", "Team", "Hours logged"]];
    const t = await dailyTotals(from, to);
    t.sort((a, b) => a.day.localeCompare(b.day) || (people.get(a.employee_id)?.name || "").localeCompare(people.get(b.employee_id)?.name || ""));
    for (const x of t) { const e = people.get(x.employee_id); rows.push([x.day, e?.name, e?.emp_no, e?.team, hours(x.secs)]); }
  }
  const body = rows.map((r) => r.map(cell).join(",")).join("\n");
  return new NextResponse(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="tt-timesheet-${from}-to-${to}.csv"` } });
}
