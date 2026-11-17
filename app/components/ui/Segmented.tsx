import Link from "next/link";
import type { ReactNode } from "react";

export default function Segmented({ items, label }: { items: { href: string; label: ReactNode; on: boolean; count?: number }[]; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {items.map((it) => (
        <Link key={it.href} href={it.href} className={it.on ? "on" : ""} aria-current={it.on ? "page" : undefined} scroll={false}>
          {it.label}{it.count != null && <span className="count num">{it.count}</span>}
        </Link>
      ))}
    </div>
  );
}
