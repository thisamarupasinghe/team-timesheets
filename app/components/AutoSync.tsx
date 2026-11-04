"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const STALE_MS = 10 * 60 * 1000;

function ago(ms: number) {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 48 * 60) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} days ago`;
}

export default function AutoSync({ lastAt, configured, error }: { lastAt: number | null; configured: boolean; error: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(error);
  const ran = useRef(false);

  async function run() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/sync", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.ok === false) setErr(j.error || "Couldn't reach Jira");
      router.refresh();
    } catch {
      setErr("Couldn't reach Jira");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (ran.current || !configured) return;
    ran.current = true;
    if (!lastAt || Date.now() - lastAt > STALE_MS) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="sync">
      <span className={`dot ${busy ? "" : err ? "err" : lastAt ? "live" : ""}`} />
      <span>{busy ? "Updating from Jira…" : err ? "Last update failed" : lastAt ? `Updated ${ago(lastAt)}` : "Not synced yet"}</span>
      <button className="btn primary" onClick={run} disabled={busy || !configured}>Refresh from Jira</button>
    </div>
  );
}
