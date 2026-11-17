"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "../ui/Toast";

const STALE_MS = 60 * 1000; // update on open if the data is older than this
const POLL_MS = 2 * 60 * 1000; // and keep checking while the tab is open and visible

function ago(ms: number) {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 48 * 60) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} days ago`;
}

/**
 * Jira sync status. Pulls fresh worklogs automatically when the data is more than 10 minutes old,
 * and offers a manual refresh. Same behaviour as before, now a quiet chip instead of a primary button.
 */
export default function SyncStatus({ lastAt, configured, error }: { lastAt: number | null; configured: boolean; error: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(error);
  const [, tick] = useState(0);
  // "N min ago" depends on the clock, so only show it once mounted (server and browser would disagree)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const ran = useRef(false);
  const [lastCheck, setLastCheck] = useState<number | null>(null);
  const busyRef = useRef(false);
  const lastSeen = useRef<number | null>(lastAt);

  useEffect(() => setErr(error), [error]);
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);

  async function run(manual: boolean) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/sync", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.ok === false) {
        const m = j.error || "Couldn't reach Jira";
        setErr(m);
        if (manual) toast(`Update failed: ${m}`, "danger", 6000);
      } else if (manual) {
        const n = (j.count || 0) + (j.deleted || 0);
        toast(j.skipped ? "An update is already running. Fresh data will appear shortly." : n ? `Up to date: ${n} change${n === 1 ? "" : "s"} from Jira.` : "Up to date with Jira. Nothing new.", j.skipped ? "info" : "success");
      }
      // Redraw only when something changed (or on a manual refresh, so the time stamp updates)
      if (manual || j.mode === "full" || j.count || j.deleted || !r.ok) router.refresh();
      else setLastCheck(Date.now());
    } catch {
      setErr("Couldn't reach Jira");
      if (manual) toast("Couldn't reach Jira. Check your connection and try again.", "danger", 6000);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  // Background check every 2 minutes while the tab is visible; also right away when you come back to the tab
  useEffect(() => {
    if (!configured) return;
    const tick = () => { if (document.visibilityState === "visible") run(false); };
    const t = window.setInterval(tick, POLL_MS);
    const onVis = () => { if (document.visibilityState === "visible" && Date.now() - (lastSeen.current || 0) > STALE_MS) tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { window.clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured]);

  // "Refresh from Jira" in the search palette
  useEffect(() => {
    const onSync = () => run(true);
    window.addEventListener("tt:sync", onSync);
    return () => window.removeEventListener("tt:sync", onSync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ran.current || !configured) return;
    ran.current = true;
    if (!lastAt || Date.now() - lastAt > STALE_MS) run(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seen = Math.max(lastAt || 0, lastCheck || 0) || null;
  lastSeen.current = seen;
  const label = !configured ? "Jira not connected" : busy ? "Updating from Jira…" : err ? "Last update failed" : seen ? (mounted ? `Updated ${ago(seen)}` : "Up to date") : "Not synced yet";
  return (
    <div className="sync-chip" title={err || label}>
      <span className={`sync-dot ${busy ? "busy" : err ? "err" : lastAt ? "live" : ""}`} aria-hidden="true" />
      <span className="label" aria-live="polite">{label}</span>
      {configured && (
        <button type="button" className={`btn btn-ghost btn-icon btn-sm${busy ? " spinning" : ""}`} onClick={() => run(true)} disabled={busy} aria-label="Refresh from Jira" title="Refresh from Jira">
          <RefreshCw />
        </button>
      )}
    </div>
  );
}
