import { NextResponse } from "next/server";
import { DEMO_COOKIE, demoMode } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Demo only: ends the demo session. */
export async function POST() {
  if (!demoMode) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEMO_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
