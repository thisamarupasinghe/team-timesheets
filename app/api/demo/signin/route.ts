import { NextResponse } from "next/server";
import { DEMO_COOKIE, demoMode } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Demo only: "signs in" as the fictional read-only viewer by setting a session cookie. */
export async function POST() {
  if (!demoMode) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEMO_COOKIE, "1", { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" });
  return res;
}
