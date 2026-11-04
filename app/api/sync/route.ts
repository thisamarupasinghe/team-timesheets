import { NextResponse } from "next/server";
import { adminOrNull, userOrNull } from "@/lib/auth";
import { logChange } from "@/lib/audit";
import { syncJira } from "@/lib/jira";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(req: Request) {
  const u = new URL(req.url);
  const days = Number(u.searchParams.get("days")) || 21;
  try {
    const r = await syncJira(days);
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 502 });
  }
}

// Called by the daily Vercel cron (sends "Authorization: Bearer CRON_SECRET") or by a signed-in manager
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const cronOk = !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
  if (!cronOk && !(await adminOrNull())) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  return run(new Request(req.url.includes("days=") ? req.url : req.url + (req.url.includes("?") ? "&" : "?") + "days=60"));
}

// Called by the Refresh button and by the page when its data is stale
export async function POST(req: Request) {
  if (process.env.DEMO === "1") return NextResponse.json({ ok: true, demo: true });
  const u = await userOrNull();
  if (!u) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  // Anyone signed in can trigger the normal small refresh; bigger history loads are for admins and managers
  const days = Number(new URL(req.url).searchParams.get("days")) || 21;
  if (days > 31 && u.role !== "admin") return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const res = await run(req);
  if (days > 31 && res.ok) await logChange(u.email, "Loaded from Jira", `Last ${days} days`);
  return res;
}
