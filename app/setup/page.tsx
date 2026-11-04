import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { runSetup } from "./actions";

export const dynamic = "force-dynamic";

export default async function Setup({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const who = (await requireAdmin()).email;
  let people: number | null = null, dbError: string | null = null;
  try {
    const [r] = await sql<{ n: number }[]>`select count(*)::int as n from employees`;
    people = r.n;
  } catch (e: any) {
    if (e?.code !== "42P01") dbError = String(e?.message || e).slice(0, 200);
  }
  const r = searchParams.r;
  return (
    <main className="wrap" style={{ maxWidth: 640, paddingTop: 60 }}>
      <div className="panel"><div className="panel-b">
        <h1 className="page">Set up the database</h1>
        <p className="muted" style={{ margin: 0 }}>Signed in as {who}. This creates the tables and loads a sample roster and 2026 public holidays. It is safe to press again: it never adds the roster twice or brings back someone you deleted.</p>
        {dbError && <div className="notice warn"><b>Can&apos;t reach the database</b><p>{dbError}</p><p>Check that DATABASE_URL is set in the site&apos;s environment variables and redeploy.</p></div>}
        {r === "ok" && <div className="notice ok"><b>Done.</b> <Link href="/admin">Go to People &amp; settings</Link> and press &ldquo;Load from Jira&rdquo;.</div>}
        {r?.startsWith("err:") && <div className="notice warn"><b>Setup failed</b><p>{r.slice(4)}</p></div>}
        {people !== null && <p style={{ margin: 0 }}><span className="pill b3">Database ready</span> {people} people on the roster.</p>}
        {!dbError && <form action={runSetup}><button className="btn primary">{people === null ? "Set up the database" : "Run setup again"}</button></form>}
      </div></div>
    </main>
  );
}
