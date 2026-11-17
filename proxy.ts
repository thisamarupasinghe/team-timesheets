import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const disabled = process.env.AUTH_DISABLED === "1";
const auth = withAuth({ pages: { signIn: "/login" } });

// Open without a login: the sign-in and sign-out pages, the auth routes, and the endpoints that check their own secret (sync, reminder data, health).
// Plus the phone-app files (manifest, icons, offline helper and page), which hold no data.
const OPEN = /^\/(login|signout|offline|api\/auth|api\/demo|api\/sync|api\/reminder-data|api\/health|manifest\.webmanifest|sw\.js|icon-[\w-]+\.png)(\/|$)/;

/**
 * Google only accepts the one site address registered for sign-in. Vercel also serves the site on other addresses
 * (one per deployment, plus aliases), and signing in from those fails with "redirect_uri_mismatch".
 * So anyone arriving on another address is sent to the main one (NEXTAUTH_URL).
 */
export default async function proxy(req: NextRequest, ev: any) {
  const main = process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL) : null;
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").toLowerCase();
  if (main && process.env.VERCEL && host && host !== main.host.toLowerCase() && !req.nextUrl.pathname.startsWith("/api/sync")) {
    const to = new URL(req.nextUrl.pathname + req.nextUrl.search, main.origin);
    return NextResponse.redirect(to, 308);
  }
  if (disabled || OPEN.test(req.nextUrl.pathname)) return NextResponse.next();
  if (process.env.DEMO === "1") {
    // Demo: a plain cookie set by the demo sign-in button stands in for the Google session
    if (req.cookies.get("tt-demo")?.value === "1") return NextResponse.next();
    if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const to = new URL("/login", req.nextUrl.origin);
    if (req.nextUrl.pathname !== "/") to.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(to);
  }
  try {
    return await (auth as any)(req, ev);
  } catch {
    // A garbled login header or cookie: treat it as signed out instead of showing an error page
    if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const to = new URL("/login", req.nextUrl.origin);
    to.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(to);
  }
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
