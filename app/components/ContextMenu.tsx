"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Target = { id: number; name: string; active: boolean; x: number; y: number };

/** Right-click (or press and hold) any row marked data-eid to delete that person. */
export default function ContextMenu() {
  const router = useRouter();
  const [t, setT] = useState<Target | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const press = useRef<number | undefined>(undefined);
  const lastPress = useRef(0);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const find = (el: EventTarget | null) => {
      const row = (el as HTMLElement | null)?.closest?.("[data-eid]") as HTMLElement | null;
      return row ? { id: Number(row.dataset.eid), name: row.dataset.ename || "this person", active: row.dataset.eactive !== "false" } : null;
    };
    const open = (el: EventTarget | null, x: number, y: number) => {
      const f = find(el);
      if (!f) return false;
      setConfirm(false);
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
    document.addEventListener("contextmenu", onCtx);
    document.addEventListener("touchstart", onStart, { passive: true });
    ["touchend", "touchmove", "touchcancel"].forEach((n) => document.addEventListener(n, cancel, { passive: true }));
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", () => setT(null), { passive: true });
    return () => {
      document.removeEventListener("contextmenu", onCtx);
      document.removeEventListener("touchstart", onStart);
      ["touchend", "touchmove", "touchcancel"].forEach((n) => document.removeEventListener(n, cancel));
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => { if (t) menu.current?.querySelector("button")?.focus(); }, [t]);
  const say = (s: string) => { setToast(s); window.setTimeout(() => setToast(null), 3000); };

  async function act(body: object, done: string) {
    setT(null);
    const r = await fetch("/api/people", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    say(r.ok ? done : "Couldn't save that change");
    router.refresh();
  }

  return (
    <>
      {t && (
        <div id="ctx" ref={menu} role="menu" style={{ left: Math.max(8, t.x), top: Math.max(8, t.y) }}>
          <div className="who">{t.name}</div>
          {confirm ? (
            <button role="menuitem" className="del" onClick={() => act({ action: "delete", id: t.id }, `Deleted ${t.name}`)}>Click again to delete</button>
          ) : (
            <button role="menuitem" className="del" onClick={() => setConfirm(true)}>Delete person</button>
          )}
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
