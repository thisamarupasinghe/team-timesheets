"use client";
import { useEffect } from "react";
import { signOut } from "next-auth/react";

const IDLE_MS = (Number(process.env.NEXT_PUBLIC_IDLE_MINUTES) || 30) * 60 * 1000;
const PING_MS = Math.min(4 * 60 * 1000, IDLE_MS / 3);

/** Is another tab of this site open in this browser? Open tabs answer a ping. */
function otherTabAlive(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof BroadcastChannel === "undefined") return resolve(false);
    const ch = new BroadcastChannel("tt-timesheets");
    const t = window.setTimeout(() => { ch.close(); resolve(false); }, 500);
    ch.onmessage = (e) => { if (e.data === "pong") { window.clearTimeout(t); ch.close(); resolve(true); } };
    ch.postMessage("ping");
  });
}

/**
 * - Keeps people signed in while they use the site (any click, key, scroll or touch extends the session).
 * - Signs them out after 30 minutes without activity.
 * - Signs them out when the site was closed: opening it again in a fresh tab or browser needs a new sign-in.
 */
export default function IdleGuard() {
  useEffect(() => {
    let dead = false;
    let last = Date.now();
    let lastPing = 0;
    const out = (why: string) => signOut({ callbackUrl: `/login?${why}=1` });

    // Answer "is anyone here?" from tabs that open later
    let ch: BroadcastChannel | null = null;
    const answer = () => { // only start answering once our own check is done, or we would answer ourselves
      try {
        ch = new BroadcastChannel("tt-timesheets");
        ch.onmessage = (e) => { if (e.data === "ping") ch?.postMessage("pong"); };
      } catch { /* older browsers */ }
    };

    async function start() {
      let known = false, justSignedIn = false;
      try {
        known = sessionStorage.getItem("tt-tab") === "1";
        const s = Number(localStorage.getItem("tt-signin") || 0);
        justSignedIn = Date.now() - s < 10 * 60 * 1000;
        localStorage.removeItem("tt-signin");
      } catch { known = true; }
      if (!known && !justSignedIn) {
        // A brand new tab with no other tab open: the site was closed since the last visit
        if (!(await otherTabAlive())) { if (!dead) out("closed"); return; }
      }
      try { sessionStorage.setItem("tt-tab", "1"); } catch { /* ignore */ }
      answer();
      ping();
    }

    async function ping() {
      lastPing = Date.now();
      try {
        const r = await fetch("/api/auth/session", { cache: "no-store" });
        const s = await r.json().catch(() => null);
        if (!s || !s.user) window.location.href = "/login?timeout=1";
      } catch { /* offline: try again on the next activity */ }
    }
    const active = () => {
      last = Date.now();
      if (Date.now() - lastPing > PING_MS) ping();
    };
    const check = () => { if (Date.now() - last > IDLE_MS) out("timeout"); };
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"];
    events.forEach((e) => window.addEventListener(e, active, { passive: true }));
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(check, Math.min(30_000, IDLE_MS / 4));
    start();
    return () => {
      dead = true;
      events.forEach((e) => window.removeEventListener(e, active));
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
      ch?.close();
    };
  }, []);
  return null;
}
