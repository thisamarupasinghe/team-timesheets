"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, Trash2 } from "lucide-react";
import { usePersonActions, type PersonRef } from "./PersonActions";

type Target = PersonRef & { x: number; y: number };

/**
 * Shortcut: right-click (or press and hold on a phone) any row marked data-eid for the same actions
 * as its visible "⋯" menu.
 */
export default function ContextMenu() {
  const [t, setT] = useState<Target | null>(null);
  const press = useRef<number | undefined>(undefined);
  const lastPress = useRef(0);
  const menu = useRef<HTMLDivElement>(null);
  const { dialog, setDeleting } = usePersonActions();

  useEffect(() => {
    const find = (el: EventTarget | null) => {
      const row = (el as HTMLElement | null)?.closest?.("[data-eid]") as HTMLElement | null;
      return row ? { id: Number(row.dataset.eid), name: row.dataset.ename || "this person", active: row.dataset.eactive !== "false" } : null;
    };
    const open = (el: EventTarget | null, x: number, y: number) => {
      const f = find(el);
      if (!f) return false;
      setT({ ...f, x: Math.min(x, window.innerWidth - 230), y: Math.min(y, window.innerHeight - 150) });
      return true;
    };
    const onCtx = (e: MouseEvent) => { if (open(e.target, e.clientX, e.clientY)) e.preventDefault(); };
    const onStart = (e: TouchEvent) => {
      const tt = e.touches[0];
      press.current = window.setTimeout(() => { if (open(e.target, tt.clientX, tt.clientY)) lastPress.current = Date.now(); }, 600);
    };
    const cancel = () => window.clearTimeout(press.current);
    const onClick = (e: MouseEvent) => {
      if (Date.now() - lastPress.current < 700) { e.preventDefault(); e.stopPropagation(); return; }
      if (!menu.current?.contains(e.target as Node)) setT(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setT(null); };
    const onScroll = () => setT(null);
    document.addEventListener("contextmenu", onCtx);
    document.addEventListener("touchstart", onStart, { passive: true });
    ["touchend", "touchmove", "touchcancel"].forEach((n) => document.addEventListener(n, cancel, { passive: true }));
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener("contextmenu", onCtx);
      document.removeEventListener("touchstart", onStart);
      ["touchend", "touchmove", "touchcancel"].forEach((n) => document.removeEventListener(n, cancel));
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, []);

  useEffect(() => { if (t) menu.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus(); }, [t]);

  return (
    <>
      {t && (
        <div className="menu" ref={menu} role="menu" aria-label={`Actions for ${t.name}`} style={{ position: "fixed", left: Math.max(8, t.x), top: Math.max(8, t.y) }}>
          <div className="menu-label">{t.name}</div>
          <Link role="menuitem" className="menu-item" href={`/person?id=${t.id}`} onClick={() => setT(null)}><CalendarDays />View timesheet</Link>
          <div className="menu-sep" />
          <button role="menuitem" className="menu-item danger" onClick={() => { setT(null); setDeleting(t); }}><Trash2 />Delete person</button>
        </div>
      )}
      {dialog}
    </>
  );
}
