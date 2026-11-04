"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoadHistory({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [days, setDays] = useState("120");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function go() {
    setBusy(true); setMsg("Loading from Jira. This can take a minute…");
    try {
      const r = await fetch(`/api/sync?days=${days}`, { method: "POST" });
      const j = await r.json().catch(() => ({}));
      setMsg(!r.ok || j.ok === false ? `Failed: ${j.error || "couldn't reach Jira"}` : j.skipped ? "Another update is already running. Try again in a few minutes." : `Done. ${j.count} worklogs loaded for ${j.from} to ${j.to}.`);
      router.refresh();
    } catch { setMsg("Failed: couldn't reach the site."); } finally { setBusy(false); }
  }
  return (
    <div className="form">
      <label htmlFor="hist">Load history<select id="hist" value={days} onChange={(e) => setDays(e.target.value)}>
        <option value="60">Last 60 days</option><option value="120">Last 120 days</option><option value="200">Last 200 days</option>
      </select></label>
      <button className="btn" onClick={go} disabled={busy || !configured}>Load from Jira</button>
      <span className="muted" style={{ fontSize: 12 }}>{msg}</span>
    </div>
  );
}
