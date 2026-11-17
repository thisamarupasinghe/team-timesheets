"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity, CalendarDays, FolderKanban, LayoutDashboard,
  PanelLeftClose, PanelLeftOpen, Settings, Trash2, TrendingUp, Users, X,
} from "lucide-react";
import BrandMark from "../ui/BrandMark";

export type NavKey = "dash" | "projects" | "trends" | "people" | "mine" | "settings" | "bin" | "activity";
export type NavItem = { key: NavKey; href: string; label: string; group: "Insights" | "You" | "Manage" | "Admin"; badge?: number };

export const NAV_ICONS: Record<NavKey, typeof Users> = {
  dash: LayoutDashboard, projects: FolderKanban, trends: TrendingUp, people: Users,
  mine: CalendarDays, settings: Settings, bin: Trash2, activity: Activity,
};
const PERIOD_KEYS = ["mode", "n", "d", "m", "from", "to"];


export default function Sidebar({ items, ownId }: { items: NavItem[]; ownId: number | null }) {
  const path = usePathname();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => { setCollapsed(document.documentElement.dataset.sb === "collapsed"); }, []);
  useEffect(() => { setOpen(false); }, [path, sp]);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("tt:open-nav", onOpen);
    return () => window.removeEventListener("tt:open-nav", onOpen);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    if (next) document.documentElement.dataset.sb = "collapsed";
    else delete document.documentElement.dataset.sb;
    try { localStorage.setItem("tt-sb", next ? "collapsed" : "open"); } catch { /* private mode */ }
  }

  const personId = Number(sp.get("id"));
  const isActive = (k: NavKey) => {
    switch (k) {
      case "dash": return path === "/" || (path === "/person" && personId !== ownId);
      case "mine": return path === "/person" && personId === ownId;
      case "people": return path === "/admin";
      default: return path === `/${k}`;
    }
  };
  // Keep the selected period when hopping between the period-based views
  const period = new URLSearchParams();
  PERIOD_KEYS.forEach((k) => { const v = sp.get(k); if (v) period.set(k, v); });
  const pq = period.toString();
  const hrefFor = (it: NavItem) => ((it.key === "dash" || it.key === "projects") && pq ? `${it.href}?${pq}` : it.href);

  const groups = (["Insights", "You", "Manage", "Admin"] as const).map((g) => ({ g, list: items.filter((i) => i.group === g) })).filter((x) => x.list.length);

  return (
    <>
      <div className={`sb-backdrop${open ? " open" : ""}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <aside id="sidebar" className={`sidebar${open ? " open" : ""}`} aria-label="Main navigation">
        <div className="sb-head">
          <Link href="/" className="brand" aria-label="Team Timesheets, overview">
            <BrandMark />
            <span className="brand-text"><b>Team</b><span>Timesheets</span></span>
          </Link>
          <button type="button" className="btn btn-ghost btn-icon btn-sm sb-collapse" onClick={toggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </button>
          <button type="button" className="btn btn-ghost btn-icon sb-close" onClick={() => setOpen(false)} aria-label="Close navigation">
            <X />
          </button>
        </div>
        <nav className="sb-nav">
          {groups.map(({ g, list }) => (
            <div className="sb-group" key={g}>
              <div className="sb-group-label">{g}</div>
              {list.map((it) => {
                const I = NAV_ICONS[it.key];
                const on = isActive(it.key);
                return (
                  <Link key={it.key} href={hrefFor(it)} className="sb-link" aria-current={on ? "page" : undefined} title={collapsed ? it.label : undefined}>
                    <I aria-hidden="true" />
                    <span className="text">{it.label}</span>
                    {!!it.badge && <><span className="sb-badge num" aria-label={`${it.badge} to review`}>{it.badge}</span><span className="dot-badge" aria-hidden="true" /></>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
