import { NextResponse } from "next/server";
import { noteScriptCall } from "@/lib/script";
import { logChange } from "@/lib/audit";
import { missingFor } from "@/lib/nudge";
import { jiraHealth } from "@/lib/health";
import { jiraConfigured, syncJira } from "@/lib/jira";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const list = (v?: string) => (v || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

/**
 * Who needs a timesheet reminder: this week's Monday–Thursday, up to yesterday (Friday is never chased).
 * Read by the Google Apps Script (run from admin@example.com) every Friday at 2 pm. Protected by REMINDER_TOKEN.
 * Pulls the latest hours from Jira first, so anyone who logged this morning isn't chased.
 */
export async function GET(req: Request) {
  const token = process.env.REMINDER_TOKEN;
  if (!token || req.headers.get("authorization") !== `Bearer ${token}`) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  await noteScriptCall(req);
  // fresh = the hours are up to date (Jira pulled just now, or another sync finished in the last few minutes)
  let synced = false, fresh = !jiraConfigured(), syncError = "";
  if (jiraConfigured()) {
    try { const r = await syncJira(10); synced = !r.skipped; fresh = true; } catch (e: any) { syncError = String(e?.message || e).slice(0, 200); }
  }
  const [n, health] = await Promise.all([missingFor(), jiraHealth()]);
  await logChange("Reminder script", "Reminder list read", `${n.people.length} people with missing days · ${n.week}`);
  return NextResponse.json({
    week: n.week,
    jira: { ok: health.ok, problems: health.problems },
    synced,
    fresh,
    syncError,
    siteUrl: process.env.NEXTAUTH_URL || "",
    managers: [...new Set([...list(process.env.MANAGER_EMAILS), ...list(process.env.ADMIN_EMAILS)])],
    people: n.people.filter((p) => p.email).map((p) => ({ name: p.name, team: p.team, email: p.email, days: p.days })),
    noEmail: n.people.filter((p) => !p.email).map((p) => ({ name: p.name, team: p.team, days: p.days })),
  });
}
