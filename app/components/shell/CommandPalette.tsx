"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search, SearchX } from "lucide-react";

export type Command = {
  id: string;
  group: string;
  label: string;
  sub?: string;
  icon?: ReactNode;
  keywords?: string;
  href?: string;
  run?: () => void;
};

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const GROUP_ORDER = ["Pages", "People", "Teams", "Actions"];
const PER_GROUP = 6;

/**
 * Site-wide search (Ctrl/⌘ K or "/"): pages, people, teams and quick actions.
 * Arrow keys move, Enter opens, Esc closes.
 */
export default function CommandPalette({ open, onClose, commands }: { open: boolean; onClose: () => void; commands: Command[] }) {
  const router = useRouter();
  const dlg = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open && !d.open) { d.showModal(); requestAnimationFrame(() => input.current?.focus()); }
    if (!open) {
      if (d.open) d.close();
      // Start fresh next time, whichever way it was closed (Enter, Esc, click outside)
      setQ(""); setActive(0);
      if (input.current) input.current.value = "";
    }
  }, [open]);

  const results = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    const scored = commands.flatMap((c) => {
      if (!words.length) return c.group === "People" || c.group === "Teams" ? [] : [{ c, s: 0 }];
      const label = norm(c.label), hay = `${label} ${norm(c.sub || "")} ${norm(c.keywords || "")}`;
      if (!words.every((w) => hay.includes(w))) return [];
      const s = label.startsWith(words[0]) ? 0 : label.split(/\s+/).some((p) => p.startsWith(words[0])) ? 1 : 2;
      return [{ c, s }];
    });
    const groups = GROUP_ORDER.map((g) => ({
      g, items: scored.filter((x) => x.c.group === g).sort((a, b) => a.s - b.s || a.c.label.localeCompare(b.c.label)).slice(0, PER_GROUP).map((x) => x.c),
    })).filter((x) => x.items.length);
    return { groups, flat: groups.flatMap((x) => x.items) };
  }, [q, commands]);

  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function choose(c: Command | undefined) {
    if (!c) return;
    onClose();
    if (c.href) router.push(c.href);
    else c.run?.();
  }

  function onKey(e: React.KeyboardEvent) {
    const n = results.flat.length;
    if (e.key === "ArrowDown") { e.preventDefault(); if (n) setActive((a) => (a + 1) % n); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (n) setActive((a) => (a - 1 + n) % n); }
    else if (e.key === "Enter") { e.preventDefault(); choose(results.flat[active]); }
  }

  let i = -1;
  return (
    <dialog
      ref={dlg} className="cmdk" aria-label="Search"
      onClose={onClose} onCancel={onClose}
      onMouseDown={(e) => { if (e.target === dlg.current) onClose(); }}
    >
      <div className="cmdk-input">
        <Search aria-hidden="true" />
        <input
          ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
          placeholder="Search people, pages, teams…" aria-label="Search people, pages, teams"
          role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-autocomplete="list"
          aria-activedescendant={results.flat[active] ? `cmdk-${results.flat[active].id}` : undefined}
          autoComplete="off" spellCheck={false}
        />
        <kbd className="hide-mobile">Esc</kbd>
        <button type="button" className="btn btn-ghost btn-sm show-mobile" onClick={onClose}>Cancel</button>
      </div>
      <div className="cmdk-list" id="cmdk-list" role="listbox" ref={list} aria-label="Results">
        {!open ? null : results.flat.length === 0 ? (
          <div className="cmdk-empty">
            <SearchX aria-hidden="true" />
            <b>No results for “{q}”</b>
            <span>Try a first name, a team like “Digital”, or a page like “Trends”.</span>
          </div>
        ) : results.groups.map(({ g, items }) => (
          <div key={g} role="group" aria-label={g} className="cmdk-group">
            <div className="cmdk-group-label" aria-hidden="true">{g}</div>
            {items.map((c) => {
              i += 1;
              const idx = i;
              return (
                <div
                  key={c.id} id={`cmdk-${c.id}`} data-i={idx} role="option" aria-selected={idx === active}
                  className="cmdk-item" onMouseMove={() => setActive(idx)} onClick={() => choose(c)}
                >
                  <span className="cmdk-icon">{c.icon}</span>
                  <span className="cmdk-text"><span className="truncate">{c.label}</span>{c.sub && <small className="truncate">{c.sub}</small>}</span>
                  {idx === active && <CornerDownLeft className="cmdk-enter" aria-hidden="true" />}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="cmdk-foot hide-mobile" aria-hidden="true">
        <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
        <span><kbd>Enter</kbd> open</span>
        <span><kbd>Esc</kbd> close</span>
      </div>
    </dialog>
  );
}
