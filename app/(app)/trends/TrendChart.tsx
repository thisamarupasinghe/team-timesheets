"use client";
import { useEffect, useRef, useState } from "react";

type Series = { name: string; color: string; values: (number | null)[] };

/** Utilisation per sprint: overall line plus one per team. Legend chips toggle teams; hover shows the numbers. */
export default function TrendChart({ labels, partial, all, teams }: { labels: string[]; partial: boolean[]; all: (number | null)[]; teams: Series[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<number | null>(null);
  // Drawn at the container's real width so text stays 11px on phones and the plot fills wide screens
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(760);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // Measure now, then on every size change (ResizeObserver, with window resize as a backup)
    const measure = () => { const w = Math.round(el.getBoundingClientRect().width); if (w > 0) setW(Math.max(300, w)); };
    measure();
    const raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  const H = Math.round(Math.min(340, Math.max(230, W * 0.34))), L = 44, R = 16, T = 18, B = 34;
  const visible = teams.filter((s) => !hidden.has(s.name));
  const vals = [...all, ...visible.flatMap((s) => s.values)].filter((v): v is number => v != null);
  const top = Math.max(1, Math.ceil(Math.max(0.9, ...vals) * 10) / 10);
  const n = labels.length;
  const x = (i: number) => L + (n > 1 ? (i * (W - L - R)) / (n - 1) : (W - L - R) / 2);
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  const path = (arr: (number | null)[]) => {
    let d = "", pen = false;
    arr.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `; pen = true; });
    return d.trim();
  };
  const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1, 1.2].filter((v) => v <= top + 0.001);
  const pct = (v: number | null) => (v == null ? "–" : `${Math.round(v * 100)}%`);
  const toggle = (name: string) => setHidden((h) => { const s = new Set(h); if (s.has(name)) s.delete(name); else s.add(name); return s; });
  const colW = n > 1 ? (W - L - R) / (n - 1) : W - L - R;

  return (
    <div className="trend">
      <div className="trend-legend" role="group" aria-label="Series">
        <span className="chip on static"><i className="sw line" style={{ background: "var(--fg)" }} />All teams</span>
        {teams.map((s) => {
          const on = !hidden.has(s.name);
          return (
            <button key={s.name} type="button" className={`chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => toggle(s.name)}>
              <i className="sw line" style={{ background: on ? s.color : "var(--border-strong)" }} />{s.name}
            </button>
          );
        })}
      </div>
      <div className="trend-plot" ref={box} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Utilisation per sprint, overall and by team">
          <rect x={L} width={W - L - R} y={y(Math.min(1, top))} height={y(0.8) - y(Math.min(1, top))} fill="var(--b3)" opacity="0.08" />
          {ticks.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeDasharray={v === 0.8 ? "5 4" : undefined} strokeWidth={v === 0.8 ? 1.5 : 1} />
              <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{Math.round(v * 100)}%</text>
            </g>
          ))}
          <text x={W - R} y={y(0.8) - 6} textAnchor="end" fontSize="10.5" fill="var(--b3)" fontWeight="600">80% target</text>
          {labels.map((l, i) => <text key={l} x={x(i)} y={H - 10} textAnchor="middle" fontSize="11" fill={hover === i ? "var(--fg)" : "var(--muted)"} fontWeight={hover === i ? 600 : 400}>{l}{partial[i] ? "*" : ""}</text>)}
          {hover != null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--border-strong)" />}
          {visible.map((s) => <path key={s.name} d={path(s.values)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />)}
          <path d={path(all)} fill="none" stroke="var(--fg)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          {all.map((v, i) => v != null && <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 5 : 3.5} fill="var(--fg)" stroke="var(--surface)" strokeWidth="2" />)}
          {hover != null && visible.map((s) => s.values[hover] != null && <circle key={s.name} cx={x(hover)} cy={y(s.values[hover]!)} r="4" fill={s.color} stroke="var(--surface)" strokeWidth="2" />)}
          {labels.map((l, i) => (
            <rect key={l} x={x(i) - colW / 2} y={T} width={colW} height={H - T - B} fill="transparent" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${l}: all teams ${pct(all[i])}`} />
          ))}
        </svg>
        {hover != null && (
          <div className="trend-tip" style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > n / 2 ? "calc(-100% - 12px)" : "12px"})` }} role="status">
            <b>{labels[hover]}{partial[hover] ? " · in progress" : ""}</b>
            <span className="row-between"><span>All teams</span><b className="num">{pct(all[hover])}</b></span>
            {visible.map((s) => (
              <span key={s.name} className="row-between"><span><i className="sw line" style={{ background: s.color }} /> {s.name}</span><span className="num">{pct(s.values[hover])}</span></span>
            ))}
          </div>
        )}
      </div>
      <p className="small muted">Dashed line and green band: 80–100%, the optimal range. * = sprint in progress, counting the days so far.</p>
    </div>
  );
}
