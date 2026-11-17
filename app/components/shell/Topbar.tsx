"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LogOut, Menu as MenuIcon, Moon, RefreshCw, Search, Sun, Users } from "lucide-react";
import CommandPalette, { type Command } from "./CommandPalette";
import SyncStatus from "./SyncStatus";
import ThemeToggle from "./ThemeToggle";
import AccountMenu, { type ShellUser } from "./AccountMenu";
import { NAV_ICONS, type NavItem } from "./Sidebar";
import BrandMark from "../ui/BrandMark";
import { initials, teamColor } from "../ui/Avatar";
import { currentTheme, setTheme } from "./theme";
import { COUNTED } from "@/lib/format";

export type SearchPerson = { id: number; name: string; team: string; empNo: string | null; active: boolean };

/** Top bar: search everything, sync status, light/dark, account. On phones it also opens the navigation drawer. */
export default function Topbar({ items, people, user, sync }: {
  items: NavItem[];
  people: SearchPerson[];
  user: ShellUser;
  sync: { lastAt: number | null; configured: boolean; error: string | null };
}) {
  const [open, setOpen] = useState(false);
  const [mac, setMac] = useState(false);

  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform));
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen((o) => !o); }
      else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); setOpen(true); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const commands = useMemo<Command[]>(() => {
    const pages: Command[] = items.map((it) => {
      const I = NAV_ICONS[it.key];
      return { id: `page-${it.key}`, group: "Pages", label: it.label, sub: it.group, icon: <I />, href: it.href, keywords: it.key };
    });
    const ppl: Command[] = people.map((p) => ({
      id: `person-${p.id}`, group: "People", label: p.name,
      sub: [p.team, p.empNo, p.active ? null : "Inactive"].filter(Boolean).join(" · "),
      keywords: `${p.empNo || ""} ${p.team}`,
      icon: <span className="avatar avatar-sm" style={{ ["--av-c" as string]: teamColor(p.team) }}>{initials(p.name)}</span>,
      href: `/person?id=${p.id}`,
    }));
    const teams: Command[] = COUNTED.map((t) => ({
      id: `team-${t}`, group: "Teams", label: t, sub: "Show this team on the overview", keywords: "team",
      icon: <span className="team-dot cmdk-team" style={{ ["--tc" as string]: teamColor(t) }} />, href: `/?team=${encodeURIComponent(t)}`,
    }));
    const dark = typeof document !== "undefined" && currentTheme() === "dark";
    const actions: Command[] = [
      { id: "act-theme", group: "Actions", label: dark ? "Switch to light mode" : "Switch to dark mode", keywords: "theme appearance dark light mode", icon: dark ? <Sun /> : <Moon />, run: () => setTheme(currentTheme() === "dark" ? "light" : "dark") },
      ...(sync.configured ? [{ id: "act-sync", group: "Actions", label: "Refresh from Jira", keywords: "sync update reload", icon: <RefreshCw />, run: () => window.dispatchEvent(new Event("tt:sync")) }] : []),
      ...(items.some((i) => i.key === "people") ? [{ id: "act-people", group: "Actions", label: "Add a person", keywords: "new joiner roster", icon: <Users />, href: "/admin" }] : []),
      ...(user.email !== "local-dev" ? [{ id: "act-out", group: "Actions", label: "Sign out", keywords: "log out logout", icon: <LogOut />, href: "/signout" }] : []),
    ];
    return [...pages, ...ppl, ...teams, ...actions];
    // re-read the theme label each time the palette opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, people, sync.configured, user.email, open]);

  return (
    <header className="topbar">
      <button type="button" className="btn btn-ghost btn-icon tb-icon nav-open" onClick={() => window.dispatchEvent(new Event("tt:open-nav"))} aria-label="Open navigation" aria-controls="sidebar">
        <MenuIcon />
      </button>
      <Link href="/" className="tb-brand" aria-label="Team Timesheets, overview"><BrandMark /></Link>

      <button type="button" className="tb-search" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label="Search people, pages and teams">
        <Search aria-hidden="true" />
        <span className="tb-search-text">Search people, pages, teams…</span>
        <kbd className="tb-kbd">{mac ? "⌘" : "Ctrl"} K</kbd>
      </button>

      <div className="tb-actions">
        <SyncStatus lastAt={sync.lastAt} configured={sync.configured} error={sync.error} />
        <ThemeToggle />
        <span className="tb-sep" aria-hidden="true" />
        <AccountMenu user={user} />
      </div>

      <CommandPalette open={open} onClose={() => setOpen(false)} commands={commands} />
    </header>
  );
}
