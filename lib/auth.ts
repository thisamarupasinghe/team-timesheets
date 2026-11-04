import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { logLogin } from "./audit";

export const authDisabled = process.env.AUTH_DISABLED === "1";
/** DEMO=1: a public, read-only showcase with fictional data. No sign-in; everyone is a viewer and nothing can be changed. */
export const demoMode = process.env.DEMO === "1";

/**
 * Roles
 *  admin   – listed in ADMIN_EMAILS. Everything, including settings and permanent deletes.
 *  manager – listed in MANAGER_EMAILS. Can view and edit people, leave, holidays and Jira links.
 *  viewer  – any other account on ALLOWED_DOMAIN (default example.com). Read-only.
 * If ADMIN_EMAILS is empty, managers are treated as admins so nothing breaks before it is set.
 */
export type Role = "admin" | "manager" | "viewer";
export type User = { email: string; role: Role };

const list = (v?: string) => (v || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

export function roleOf(email?: string | null): Role | null {
  if (!email) return null;
  const e = email.toLowerCase();
  const admins = list(process.env.ADMIN_EMAILS), mgrs = list(process.env.MANAGER_EMAILS);
  if (admins.includes(e)) return "admin";
  if (mgrs.includes(e)) return admins.length ? "manager" : "admin";
  const dom = (process.env.ALLOWED_DOMAIN ?? "example.com").trim().toLowerCase().replace(/^@/, "");
  if (dom && e.endsWith("@" + dom)) return "viewer";
  return null;
}
export const canEdit = (r?: Role | null) => r === "admin" || r === "manager";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  // Signed in until they sign out, but 30 minutes without activity ends the session (the page keeps it alive while in use)
  session: { strategy: "jwt", maxAge: 30 * 60 },
  pages: { signIn: "/login", signOut: "/signout", error: "/login" },
  callbacks: {
    async signIn({ user, profile }) {
      if ((profile as any)?.email_verified === false) return false;
      const ok = !!roleOf(user.email);
      if (!ok) await logLogin(user.email, "Sign-in refused", null);
      return ok;
    },
  },
  events: {
    async signIn({ user }) { await logLogin(user.email, "Signed in", roleOf(user.email)); },
    async signOut({ token }) { await logLogin((token as any)?.email, "Signed out", roleOf((token as any)?.email)); },
  },
};

/** The signed-in user and their role, or null. Re-checked on every request, so removing someone takes effect at once. */
export async function getUser(): Promise<User | null> {
  if (demoMode) return { email: "demo@example.com", role: "viewer" };
  if (authDisabled) return { email: "local-dev", role: "admin" };
  const s = await getServerSession(authOptions);
  const email = s?.user?.email?.toLowerCase();
  const role = roleOf(email);
  return email && role ? { email, role } : null;
}

/** Any signed-in the team user (viewer, manager or admin). */
export async function requireUser(): Promise<User> {
  const u = await getUser();
  if (!u) redirect("/login");
  return u;
}
/** Admin or manager. Viewers are sent back to the dashboard. */
export async function requireEditor(): Promise<User> {
  const u = await requireUser();
  if (!canEdit(u.role)) redirect("/");
  return u;
}
/** Admin only. */
export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (u.role !== "admin") redirect("/");
  return u;
}

/** For API routes: no redirects, just null when not allowed. */
export const userOrNull = () => getUser();
export async function editorOrNull() { const u = await getUser(); return u && canEdit(u.role) ? u : null; }
export async function adminOrNull() { const u = await getUser(); return u && u.role === "admin" ? u : null; }
