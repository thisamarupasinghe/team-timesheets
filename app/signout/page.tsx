"use client";
import Link from "next/link";
import { signOut } from "next-auth/react";

export default function SignOutPage() {
  return (
    <main className="wrap" style={{ maxWidth: 420, paddingTop: 80 }}>
      <div className="panel"><div className="panel-b">
        <h1 className="page">Team Timesheets</h1>
        <p className="muted" style={{ margin: 0 }}>Sign out of your the team Google account on this site?</p>
        <button className="btn primary" onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</button>
        <Link className="btn" href="/" style={{ textAlign: "center" }}>Stay signed in</Link>
      </div></div>
    </main>
  );
}
