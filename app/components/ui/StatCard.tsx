import Link from "next/link";
import type { ReactNode } from "react";

export default function StatCard({ label, value, sub, icon, tone, href, on, children, tip }: {
  label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; tone?: "warn"; href?: string; on?: boolean; children?: ReactNode; tip?: string;
}) {
  const inner = (
    <>
      <div className="stat-head">
        <span className="stat-label">{label}</span>
        {icon && <span className={`stat-icon ${tone || ""}`.trim()} aria-hidden="true">{icon}</span>}
      </div>
      <div className="stat-value num">{value}</div>
      {children}
      {sub && <div className="stat-sub">{sub}</div>}
    </>
  );
  if (href) return <Link href={href} scroll={false} className={`card stat${on ? " is-on" : ""}`} title={tip} aria-pressed={on}>{inner}</Link>;
  return <div className="card stat">{inner}</div>;
}
