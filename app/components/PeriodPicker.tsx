import Link from "next/link";
import { CalendarRange, ChevronLeft, ChevronRight, Undo2 } from "lucide-react";
import { daysBetween, fmtD, fmtDY, isWeekend, today, type Period } from "@/lib/time";

/** Adds a query string to a base that may already have one. */
export const joinQ = (base: string, q: string) => (base.includes("?") ? `${base}&${q.replace(/^\?/, "")}` : `${base}${q.startsWith("?") ? q : `?${q}`}`);

/** Title, secondary line and progress for a period, e.g. "Sprint 42" / "3 Nov – 14 Nov 2026" / "Day 4 of 10". */
export function periodText(P: Period) {
  const [head, rest] = P.label.split(" · ");
  const range = `${fmtD(P.start)} – ${fmtDY(P.end)}`;
  const title = P.mode === "week" ? `Week of ${fmtD(P.start)}` : P.mode === "custom" ? "Custom range" : head;
  const sub = P.mode === "sprint" ? rest || range : range;
  const t = today();
  let progress: string | null = null;
  if (P.start <= t && t <= P.end) {
    const work = daysBetween(P.start, P.end).filter((d) => !isWeekend(d));
    const done = work.filter((d) => d <= t).length;
    progress = `Day ${done} of ${work.length}`;
  }
  return { title, sub, progress, current: P.start <= t && t <= P.end };
}

/**
 * Period controls: Sprint / Week / Month / Custom, previous / next, and a jump back to the current period.
 * `base` is the page (may carry its own query, e.g. /person?id=3); `keep` holds filters to carry along.
 */
export default function PeriodPicker({ P, base = "/", keep = "" }: { P: Period; base?: string; keep?: string }) {
  const modes = [["sprint", "Sprint"], ["week", "Week"], ["month", "Month"]] as const;
  const href = (q: string) => joinQ(base, q.replace(/^\?/, "") + (keep ? `&${keep}` : ""));
  const { title, sub, current } = periodText(P);
  const path = base.split("?")[0];
  const baseParams = [...new URLSearchParams(base.split("?")[1] || ""), ...new URLSearchParams(keep)];

  return (
    <div className="period">
      <div className="seg" role="group" aria-label="Period type">
        {modes.map(([m, l]) => (
          <Link key={m} className={P.mode === m ? "on" : ""} aria-current={P.mode === m ? "true" : undefined} href={href(`mode=${m}`)} scroll={false}>{l}</Link>
        ))}
        <Link className={P.mode === "custom" ? "on" : ""} aria-current={P.mode === "custom" ? "true" : undefined} href={href(`mode=custom&from=${P.start}&to=${P.end}`)} scroll={false}>Custom</Link>
      </div>

      <div className="period-nav">
        <Link className="btn btn-icon btn-sm" href={href(P.prev)} aria-label="Previous period" title="Previous period" scroll={false}><ChevronLeft /></Link>
        <div className="period-label" aria-live="polite">
          <b>{title}</b>
          <span>{sub}</span>
          {!current && P.mode !== "custom" && <Link className="period-back show-mobile" href={href(`mode=${P.mode}`)} scroll={false}>Back to current</Link>}
        </div>
        <Link className="btn btn-icon btn-sm" href={href(P.next)} aria-label="Next period" title="Next period" scroll={false}><ChevronRight /></Link>
      </div>

      {!current && P.mode !== "custom" && (
        <Link className="btn btn-ghost btn-sm hide-mobile" href={href(`mode=${P.mode}`)} scroll={false}><Undo2 />Back to current</Link>
      )}

      {P.mode === "custom" && (
        <form className="period-range" action={path} method="get" aria-label="Custom date range">
          {baseParams.filter(([k]) => !["mode", "from", "to"].includes(k)).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <input type="hidden" name="mode" value="custom" />
          <CalendarRange className="faint" size={16} aria-hidden="true" />
          <label className="sr-only" htmlFor="pr-from">From</label>
          <input id="pr-from" className="input input-sm" type="date" name="from" defaultValue={P.start} required />
          <span className="muted">to</span>
          <label className="sr-only" htmlFor="pr-to">To</label>
          <input id="pr-to" className="input input-sm" type="date" name="to" defaultValue={P.end} required />
          <button className="btn btn-sm btn-primary">Apply</button>
        </form>
      )}
    </div>
  );
}
