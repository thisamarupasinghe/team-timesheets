"use client";
import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, ServerCrash } from "lucide-react";
import { reportBrowserError } from "../components/ErrorReporter";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    // Server crashes (with a digest) are already recorded on the server; this catches ones that happened in the browser
    if (!error.digest) reportBrowserError(error.message || String(error), error.stack || "");
  }, [error]);
  return (
    <div className="card">
      <div className="empty">
        <div className="empty-icon" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}><ServerCrash /></div>
        <p className="empty-title">This page couldn&apos;t load</p>
        <p className="empty-text">Something went wrong while fetching the data. It&apos;s usually temporary, like the database or Jira being briefly unreachable.</p>
        <div className="row" style={{ justifyContent: "center", marginTop: 8 }}>
          <button type="button" className="btn btn-primary" onClick={reset}><RotateCcw />Try again</button>
          <Link className="btn" href="/">Go to overview</Link>
        </div>
        {error.digest && <p className="small faint mono" style={{ marginTop: 8 }}>Reference {error.digest}</p>}
      </div>
    </div>
  );
}
