import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import { Brand } from "./components/ui/BrandMark";

export default function NotFound() {
  return (
    <main className="auth">
      <div className="card auth-card">
        <Brand />
        <div className="empty" style={{ padding: "8px 0" }}>
          <div className="empty-icon"><Compass /></div>
          <h1 className="empty-title">We couldn&apos;t find that page</h1>
          <p className="empty-text">The link may be out of date, or the person may have been deleted. Deleted people can be restored from the Recycle bin.</p>
          <Link className="btn btn-primary" href="/"><ArrowLeft />Back to overview</Link>
        </div>
      </div>
    </main>
  );
}
