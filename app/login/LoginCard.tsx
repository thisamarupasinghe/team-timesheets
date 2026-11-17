"use client";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AlertTriangle, Clock, LogOut, ShieldCheck, UserRound } from "lucide-react";

// Cells of a 5×5 grid that make the T
const CUBES = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [2, 1], [2, 2], [2, 3]];

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/**
 * NextAuth sends ?error=<code>. Only AccessDenied means "this account isn't allowed";
 * the rest are setup or network problems, so don't blame the person signing in.
 */
function errorText(code: string): { title: string; help: string } {
  switch (code) {
    case "AccessDenied":
      return { title: "That Google account isn't on the access list.", help: "Use your work account, or ask the admin to add your email." };
    case "Configuration":
    case "OAuthSignin":
      return { title: "Google sign-in isn't set up on this site yet.", help: "Ask the admin to add the Google sign-in keys, then try again." };
    case "OAuthCallback":
    case "Callback":
    case "OAuthAccountNotLinked":
      return { title: "Google didn't finish signing you in.", help: "Try again. If it keeps happening, sign out of other Google accounts first." };
    default:
      return { title: "Sign-in didn't work.", help: "Try again in a moment." };
  }
}

function Inner({ demo }: { demo: boolean }) {
  const sp = useSearchParams();
  const [busy, setBusy] = useState(false);
  const err = sp.get("error"), timeout = sp.get("timeout"), closed = sp.get("closed");
  const e = err ? errorText(err) : null;

  // Coming back with the browser's Back button restores this page from cache: re-enable the button
  useEffect(() => {
    const onShow = (ev: PageTransitionEvent) => { if (ev.persisted) setBusy(false); };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);
  const go = () => {
    setBusy(true);
    if (demo) {
      // Demo: no Google. The button signs you in as a fictional read-only viewer.
      fetch("/api/demo/signin", { method: "POST" })
        .then((r) => { if (!r.ok) throw new Error(); window.location.href = sp.get("callbackUrl")?.startsWith("/") ? sp.get("callbackUrl")! : "/"; })
        .catch(() => setBusy(false));
      return;
    }
    try { localStorage.setItem("tt-signin", String(Date.now())); } catch { /* private mode */ }
    signIn("google", { callbackUrl: "/" });
  };
  return (
    <div className="lg">
      <main className="lg-main">
        <div className="lg-scene" aria-hidden="true">
          <div className="lg-x">
            {CUBES.map(([c, r], i) => (
              <div key={i} className="lg-cube" style={{ ["--c" as string]: c, ["--r" as string]: r, ["--d" as string]: `${i * -0.35}s` }}>
                <i className="f1" /><i className="f2" /><i className="f3" /><i className="f4" /><i className="f5" /><i className="f6" />
              </div>
            ))}
          </div>
        </div>
        <div className="lg-copy">
          <h1 className="lg-h1">Team <span>Timesheets</span></h1>
          <p className="lg-sub">Hours and utilisation, live from Jira.</p>
        </div>
        <div className="lg-panel">
          {timeout && <div className="lg-note" role="status"><Clock aria-hidden="true" />Signed out after 30 minutes without activity.</div>}
          {closed && <div className="lg-note" role="status"><LogOut aria-hidden="true" />Signed out because the site was closed.</div>}
          {e && (
            <div className="lg-note warn" role="alert">
              <AlertTriangle aria-hidden="true" />
              <span><b>{e.title}</b> {e.help}</span>
            </div>
          )}
          <button type="button" className="lg-google" onClick={go} disabled={busy} aria-busy={busy}>
            {busy ? <span className="spinner" aria-hidden="true" /> : demo ? <UserRound aria-hidden="true" /> : <GoogleG />}
            {busy ? (demo ? "Signing in…" : "Opening Google…") : demo ? "Continue as demo viewer" : err ? "Try again with Google" : "Continue with Google"}
          </button>
          <p className="lg-fine"><ShieldCheck aria-hidden="true" />{demo ? "Demo: you will be signed in as Jordan Blake, a read-only viewer. All data is fictional." : "Only company Google accounts can sign in."}</p>
        </div>
      </main>
    </div>
  );
}

export default function LoginCard({ demo = false }: { demo?: boolean }) {
  return <Suspense><Inner demo={demo} /></Suspense>;
}
