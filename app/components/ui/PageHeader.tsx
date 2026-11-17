import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

/** Every page header sits on the deep sign-in teal band; pass hero={false} for a plain one. */
export default function PageHeader({ title, subtitle, actions, crumbs, current, children, hero }: {
  title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; crumbs?: { href: string; label: string }[]; current?: string; children?: ReactNode; hero?: boolean;
}) {
  hero = hero ?? true;
  return (
    <div className={hero ? "stack hero" : "stack"}>
      <header className="page-header">
        <div className="titles">
          {crumbs && crumbs.length > 0 && (
            <nav aria-label="Breadcrumb">
              <ol className="crumbs">
                {crumbs.map((c, i) => (
                  <li key={c.href}>{i > 0 && <ChevronRight aria-hidden="true" />}<Link href={c.href}>{c.label}</Link></li>
                ))}
                {current && <li><ChevronRight aria-hidden="true" /><span aria-current="page">{current}</span></li>}
              </ol>
            </nav>
          )}
          <h1 className="page-title">{title}</h1>
          {subtitle && (typeof subtitle === "string" ? <p className="page-sub is-text">{subtitle}</p> : <div className="page-sub">{subtitle}</div>)}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </header>
      {children && <div className="page-toolbar">{children}</div>}
    </div>
  );
}
