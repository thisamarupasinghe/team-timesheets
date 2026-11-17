"use client";
import Link from "next/link";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Brand } from "../components/ui/BrandMark";

export default function SignOutCard({ demo }: { demo: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <main className="auth">
      <div className="card auth-card">
        <Brand />
        <div className="stack-sm">
          <h1>Sign out?</h1>
          <p className="muted">{demo ? "You can sign back in as the demo viewer any time." : "You'll need your Google account to sign in again."}</p>
        </div>
        <div className="stack-sm">
          <button className={`btn btn-primary btn-lg${busy ? " is-loading" : ""}`} disabled={busy} onClick={() => { setBusy(true); if (demo) fetch("/api/demo/signout", { method: "POST" }).finally(() => { window.location.href = "/login"; }); else signOut({ callbackUrl: "/login" }); }}>
            {busy ? <span className="spinner" aria-hidden="true" /> : <LogOut />}Sign out
          </button>
          <Link className="btn btn-lg" href="/">Stay signed in</Link>
        </div>
      </div>
    </main>
  );
}
