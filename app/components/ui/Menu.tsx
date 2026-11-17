"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { btnClass, type Size, type Variant } from "./Button";

export type MenuItem =
  | { label: string; icon?: ReactNode; href: string; external?: boolean; download?: boolean; danger?: boolean }
  | { label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean; on?: boolean }
  | { sep: true }
  | { heading: string };

/** Dropdown menu with keyboard support (arrows, Home/End, Esc) that closes on outside click. */
export default function Menu({ label, icon, children, variant = "secondary", size, items, align = "right", iconRight, className }: {
  label: string; icon?: ReactNode; iconRight?: ReactNode; children?: ReactNode; variant?: Variant; size?: Size; items: MenuItem[]; align?: "left" | "right"; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const first = wrap.current?.querySelector<HTMLElement>("[role=menuitem]");
    first?.focus();
    const onDown = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function onKey(e: React.KeyboardEvent) {
    const els = [...(wrap.current?.querySelectorAll<HTMLElement>("[role=menuitem]") || [])];
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); btn.current?.focus(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); els[(i + 1) % els.length]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); }
    else if (e.key === "Home") { e.preventDefault(); els[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); els[els.length - 1]?.focus(); }
    else if (e.key === "Tab") setOpen(false);
  }

  const iconOnly = !children;
  return (
    <div className={`popover-anchor ${className || ""}`.trim()} ref={wrap} onKeyDown={open ? onKey : undefined}>
      <button
        ref={btn} type="button" className={btnClass(variant, size, iconOnly)}
        aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
        aria-label={iconOnly ? label : undefined} title={iconOnly ? label : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === "ArrowDown" && !open) { e.preventDefault(); setOpen(true); } }}
      >
        {icon}{children}{iconRight}
      </button>
      {open && (
        <div className={`menu ${align}`} role="menu" id={id} aria-label={label}>
          {items.map((it, k) => {
            if ("sep" in it) return <div key={k} className="menu-sep" role="separator" />;
            if ("heading" in it) return <div key={k} className="menu-label">{it.heading}</div>;
            const cls = `menu-item${it.danger ? " danger" : ""}${"on" in it && it.on ? " on" : ""}`;
            if ("href" in it) {
              if (it.external || it.download) {
                return <a key={k} role="menuitem" tabIndex={-1} className={cls} href={it.href} download={it.download || undefined} {...(it.external ? { target: "_blank", rel: "noopener noreferrer" } : {})} onClick={() => setOpen(false)}>{it.icon}{it.label}</a>;
              }
              return <Link key={k} role="menuitem" tabIndex={-1} className={cls} href={it.href} onClick={() => setOpen(false)}>{it.icon}{it.label}</Link>;
            }
            return <button key={k} type="button" role="menuitem" tabIndex={-1} className={cls} onClick={() => { setOpen(false); it.onSelect(); }}>{it.icon}{it.label}</button>;
          })}
        </div>
      )}
    </div>
  );
}
