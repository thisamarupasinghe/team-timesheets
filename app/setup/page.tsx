import Link from "next/link";
import { ArrowRight, Database } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { runSetup } from "./actions";
import { Brand } from "../components/ui/BrandMark";
import Callout from "../components/ui/Callout";
import { Badge } from "../components/ui/Badge";
import SubmitButton from "../components/ui/SubmitButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up" };

export default async function Setup(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
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
    <main className="auth">
      <div className="card auth-card wide">
        <Brand />
        <div className="stack-sm">
          <h1>Set up the database</h1>
          <p className="muted">Signed in as {who}. This creates the tables and loads the roster and 2026 public holidays. It&apos;s safe to run again: it never adds the roster twice or brings back someone you deleted.</p>
        </div>
        {dbError && <Callout tone="danger" title="Can't reach the database">{dbError} Check that DATABASE_URL is set in the site&apos;s environment variables and redeploy.</Callout>}
        {r === "ok" && <Callout tone="success" title="Done" actions={<Link className="btn btn-sm btn-primary" href="/settings#jira">Load from Jira <ArrowRight /></Link>}>Next, load history from Jira on the Settings page.</Callout>}
        {r?.startsWith("err:") && <Callout tone="danger" title="Setup failed">{r.slice(4)}</Callout>}
        {people !== null && <p className="row"><Badge tone="success" dot>Database ready</Badge><span className="muted">{people} people on the roster.</span></p>}
        {!dbError && (
          <form action={runSetup} className="row">
            <SubmitButton icon={<Database />} size="lg" pendingText="Setting up…">{people === null ? "Set up the database" : "Run setup again"}</SubmitButton>
            {people !== null && <Link className="btn btn-lg" href="/">Go to the overview</Link>}
          </form>
        )}
      </div>
    </main>
  );
}
