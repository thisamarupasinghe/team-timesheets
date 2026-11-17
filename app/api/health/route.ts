import { NextResponse } from "next/server";
import { noteScriptCall } from "@/lib/script";
import { jiraHealth } from "@/lib/health";
import { getErrors, summarise } from "@/lib/errors";

export const dynamic = "force-dynamic";

const list = (v?: string) => (v || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

/**
 * Jira connection health plus website errors from the last 24 hours, read once a day (9 am) by the Google Apps Script (run from admin@example.com),
 * which emails the admins when something is wrong. Protected by REMINDER_TOKEN (Authorization: Bearer ...).
 */
export async function GET(req: Request) {
  const token = process.env.REMINDER_TOKEN;
  if (!token || req.headers.get("authorization") !== `Bearer ${token}`) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  await noteScriptCall(req);
  const [h, errors] = await Promise.all([jiraHealth(), getErrors().catch(() => [])]);
  const admins = list(process.env.ADMIN_EMAILS);
  return NextResponse.json({ ...h, siteErrors: summarise(errors, 24), admins: admins.length ? admins : list(process.env.MANAGER_EMAILS), siteUrl: process.env.NEXTAUTH_URL || "" });
}
