"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, LogOut } from "lucide-react";
import { initials, teamColor } from "../ui/Avatar";

const ROLE: Record<string, string> = { admin: "Admin", manager: "Manager", viewer: "Viewer" };
export type ShellUser = { email: string; role: string; name: string | null; team: string | null; ownId: number | null };

export const displayName = (u: ShellUser) => u.name || (u.email === "local-dev" ? "Local developer" : u.email.split("@")[0]);

/** Avatar button at the top right with the account menu. */
export default function AccountMenu({ user }: { user: ShellUser }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const local = user.email === "local-dev";
  const name = displayName(user);

  // Local only: preview the site as each role (sign-in is off, so there's no real account to switch)
  function preview(role: "admin" | "manager" | "viewer") {
    document.cookie = `tt-preview-role=${role}; path=/; max-age=31536000; samesite=lax`;
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  useEffect(() => {
    if (!open) return;
    wrap.current?.querySelector<HTMLElement>("[role^=menuitem]:not([disabled])")?.focus();
    const onDown = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); btn.current?.focus(); return; }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const els = [...(wrap.current?.querySelectorAll<HTMLElement>("[role^=menuitem]:not([disabled])") || [])];
      const i = els.indexOf(document.activeElement as HTMLElement);
      els[(i + (e.key === "ArrowDown" ? 1 : -1) + els.length) % els.length]?.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div className="acct" ref={wrap}>
      <button
        ref={btn} type="button" className="acct-btn" onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu" aria-expanded={open} aria-label={`Account: ${name}`} title={name}
      >
        <span className="avatar" style={{ ["--av-c" as string]: teamColor(user.team) }} aria-hidden="true">{initials(name)}</span>
      </button>
      {open && (
        <div className="menu acct-menu" role="menu" aria-label="Account">
          <div className="acct-head">
            <span className="avatar avatar-lg" style={{ ["--av-c" as string]: teamColor(user.team) }} aria-hidden="true">{initials(name)}</span>
            <span className="acct-who">
              <b className="truncate">{name}</b>
              <span className="truncate">{local ? "Sign-in is off on this machine" : user.email}</span>
            </span>
          </div>
          <div className="menu-sep" />
          {local && (
            <>
              <div className="menu-label"><Eye aria-hidden="true" className="inline-icon" />Preview as (this computer only)</div>
              {(["admin", "manager", "viewer"] as const).map((r) => (
                <button key={r} type="button" role="menuitemradio" aria-checked={user.role === r} tabIndex={-1} className={`menu-item${user.role === r ? " on" : ""}`} onClick={() => preview(r)}>
                  <span className="menu-check">{user.role === r && <Check aria-hidden="true" />}</span>{ROLE[r]}
                </button>
              ))}
              <div className="menu-sep" />
            </>
          )}
          {local ? (
            <button type="button" role="menuitem" tabIndex={-1} className="menu-item danger" aria-disabled="true" disabled title="Sign-in is off on this computer, so there's no session to end">
              <LogOut aria-hidden="true" />Sign out<span className="menu-note">Off on this computer</span>
            </button>
          ) : (
            <Link role="menuitem" tabIndex={-1} className="menu-item danger" href="/signout" onClick={() => setOpen(false)}><LogOut aria-hidden="true" />Sign out</Link>
          )}
        </div>
      )}
    </div>
  );
}
