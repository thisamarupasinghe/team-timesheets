import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const disabled = process.env.AUTH_DISABLED === "1" || process.env.DEMO === "1";
const auth = withAuth({ pages: { signIn: "/login" } });

// Open without a login: the sign-in and sign-out pages, the auth routes, and the sync endpoint (which checks its own secret).
const OPEN = /^\/(login|signout|api\/auth|api\/sync|manifest\.webmanifest|icon-\d+\.png)(\/|$)/;

/**
 * Google only accepts the one site address registered for sign-in. Vercel also serves the site on other addresses
 * (one per deployment, plus aliases), and signing in from those fails with "redirect_uri_mismatch".
 * So anyone arriving on another address is sent to the main one (NEXTAUTH_URL).
 */
export default function middleware(req: NextRequest, ev: any) {
  const main = process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL) : null;
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").toLowerCase();
  if (main && process.env.VERCEL && host && host !== main.host.toLowerCase() && !req.nextUrl.pathname.startsWith("/api/sync")) {
    const to = new URL(req.nextUrl.pathname + req.nextUrl.search, main.origin);
    return NextResponse.redirect(to, 308);
  }
  if (disabled || OPEN.test(req.nextUrl.pathname)) return NextResponse.next();
  return (auth as any)(req, ev);
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
