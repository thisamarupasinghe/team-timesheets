"use client";
import { humanDates } from "@/lib/format";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { History } from "lucide-react";
import Callout from "../../components/ui/Callout";
import { toast } from "../../components/ui/Toast";

/** One-off backfill: pulls older worklogs from Jira (up to a minute on the free Vercel plan). */
export default function LoadHistory({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [days, setDays] = useState("120");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: "success" | "danger" | "info"; text: string } | null>(null);

  async function go() {
    setBusy(true); setResult(null);
    try {
      const r = await fetch(`/api/sync?days=${days}`, { method: "POST" });
      const j = await r.json().catch(() => ({}));
      const res = !r.ok || j.ok === false
        ? { tone: "danger" as const, text: `Failed: ${j.error || "couldn't reach Jira"}. If it timed out, load 60 days, then run it again.` }
        : j.skipped ? { tone: "info" as const, text: "Another update is already running. Try again in a few minutes." }
          : { tone: "success" as const, text: humanDates(`Done. ${j.count} worklogs loaded for ${j.from} to ${j.to}.`) };
      setResult(res);
      toast(res.tone === "success" ? "History loaded from Jira." : res.text, res.tone);
      router.refresh();
    } catch {
      setResult({ tone: "danger", text: "Failed: couldn't reach the site." });
    } finally { setBusy(false); }
  }

  return (
    <div className="stack-sm">
      <div className="form-inline">
        <label className="field" style={{ minWidth: 180 }}>
          <span className="field-label">Load history</span>
          <select className="select" value={days} onChange={(e) => setDays(e.target.value)} disabled={busy}>
            <option value="60">Last 60 days</option><option value="120">Last 120 days</option><option value="200">Last 200 days</option>
          </select>
        </label>
        <button type="button" className={`btn${busy ? " is-loading" : ""}`} onClick={go} disabled={busy || !configured}>
          {busy ? <span className="spinner" aria-hidden="true" /> : <History />}{busy ? "Loading… this can take a minute" : "Load from Jira"}
        </button>
      </div>
      {result && <Callout tone={result.tone}>{result.text}</Callout>}
    </div>
  );
}
