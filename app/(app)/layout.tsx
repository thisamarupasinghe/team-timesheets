import { Suspense } from "react";
import { canEdit, getUser } from "@/lib/auth";
import { getEmployees, getSync } from "@/lib/queries";
import { ownEmployee } from "@/lib/me";
import { jiraConfigured } from "@/lib/jira";
import { sql } from "@/lib/db";
import Sidebar, { type NavItem } from "../components/shell/Sidebar";
import Topbar from "../components/shell/Topbar";
import Callout from "../components/ui/Callout";
import { assessHealth, getTokenExpiry } from "@/lib/health";
import FlashToaster from "../components/shell/FlashToaster";
import ContextMenu from "../components/ContextMenu";
import ErrorReporter from "../components/ErrorReporter";
import { getScriptSeen, scriptStatus } from "@/lib/script";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser().catch(() => null);
  if (!user) return <>{children}</>; // pages redirect to /login themselves

  const editor = canEdit(user.role);
  const admin = user.role === "admin";
  const [sync, own, roster, tokenExpires, seen] = await Promise.all([
    getSync().catch(() => null),
    ownEmployee(user.email).catch(() => null),
    getEmployees(false).catch(() => []),
    admin ? getTokenExpiry().catch(() => null) : Promise.resolve(null),
    admin ? getScriptSeen().catch(() => null) : Promise.resolve(null),
  ]);
  // Admins only: the Google email script is out of date or has stopped checking in
  const script = admin ? scriptStatus(seen) : null;
  const scriptWarn = script && (script.state === "outdated" || script.state === "silent") ? script.text : null;
  // Jira warnings for the people who can act on them: managers see update failures, admins also see token expiry
  const health = editor ? assessHealth({ configured: jiraConfigured(), sync, tokenExpires }) : null;
  const warnings = health ? health.problems.filter((p) => admin || !/token/i.test(p)) : [];
  // Everyone can open the overview and person pages, so everyone can search the roster (inactive people only for editors)
  const people = roster.filter((p) => p.active || editor).map((p) => ({ id: p.id, name: p.name, team: p.team, empNo: p.emp_no, active: p.active }));
  const team = own ? await sql<{ team: string }[]>`select team from employees where id = ${own.id}`.then((r) => r[0]?.team ?? null).catch(() => null) : null;

  const items: NavItem[] = [
    { key: "dash", href: "/", label: "Overview", group: "Insights" },
    { key: "projects", href: "/projects", label: "Projects", group: "Insights" },
    { key: "trends", href: "/trends", label: "Trends", group: "Insights" },
    ...(own && !editor ? [{ key: "mine", href: `/person?id=${own.id}`, label: "My timesheet", group: "You" } as NavItem] : []),
    ...(editor ? [{ key: "people", href: "/admin", label: "People", group: "Manage" } as NavItem] : []),
    ...(admin ? [{ key: "settings", href: "/settings", label: "Settings", group: "Admin" } as NavItem] : []),
    ...(editor ? [{ key: "bin", href: "/bin", label: "Recycle bin", group: "Admin" } as NavItem] : []),
    ...(admin ? [{ key: "activity", href: "/activity", label: "Activity", group: "Admin" } as NavItem] : []),
  ];

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <div className="app">
        <Suspense>
          <Sidebar items={items} ownId={own?.id ?? null} />
        </Suspense>
        <div className="main">
          <Topbar
            items={items}
            people={people}
            user={{ email: user.email, role: user.role, name: own?.name ?? null, team, ownId: own?.id ?? null }}
            sync={{ lastAt: sync?.at ?? null, configured: jiraConfigured(), error: sync && !sync.ok ? sync.error || "Failed" : null }}
          />
          <main id="main" className="content" tabIndex={-1}>
            {warnings.length > 0 && (
              <Callout tone="danger" title={admin ? "Jira needs attention" : "Hours may be out of date"}>
                {warnings.join(" ")}{admin ? <> See <a href="/settings#jira">Settings → Jira connection</a>.</> : " The admin has been told."}
              </Callout>
            )}
            {scriptWarn && (
              <Callout tone="warning" title="Email script needs attention">
                {scriptWarn} <a href="/settings#jira">See Settings</a>.
              </Callout>
            )}
            {children}
          </main>
        </div>
      </div>
      <Suspense><FlashToaster /></Suspense>
      {editor && <ContextMenu />}
      <ErrorReporter />
    </>
  );
}
