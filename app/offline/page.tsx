import { WifiOff, RotateCw } from "lucide-react";
import { Brand } from "../components/ui/BrandMark";

export const metadata = { title: "You're offline" };

/** Shown by the phone app (service worker) when there's no internet. Holds no data. */
export default function OfflinePage() {
  return (
    <main className="auth">
      <div className="card auth-card">
        <Brand />
        <div className="stack-sm">
          <h1><WifiOff aria-hidden="true" className="offline-icon" />You&apos;re offline</h1>
          <p className="muted">Timesheets needs the internet to show the latest hours from Jira. Check your connection and try again.</p>
        </div>
        <a className="btn btn-primary btn-lg" href="/"><RotateCw aria-hidden="true" />Try again</a>
      </div>
    </main>
  );
}
