"use client";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function Inner() {
  const sp = useSearchParams();
  const err = sp.get("error"), timeout = sp.get("timeout"), closed = sp.get("closed");
  return (
    <main className="wrap" style={{ maxWidth: 420, paddingTop: 80 }}>
      <div className="panel"><div className="panel-b">
        <h1 className="page">Team Timesheets</h1>
        <p className="muted" style={{ margin: 0 }}>Sign in with your the team Google account.</p>
        {timeout && <div className="notice">You were signed out after 30 minutes without activity. Sign in again to carry on.</div>}
        {closed && <div className="notice">You were signed out because the site was closed. Sign in again to carry on.</div>}
        {err && <div className="notice warn">That account doesn&apos;t have access. Use your the team Google account.</div>}
        <button className="btn primary" onClick={() => { try { localStorage.setItem("tt-signin", String(Date.now())); } catch {} signIn("google", { callbackUrl: "/" }); }}>Sign in with Google</button>
      </div></div>
    </main>
  );
}
export default function LoginCard() {
  return <Suspense><Inner /></Suspense>;
}
