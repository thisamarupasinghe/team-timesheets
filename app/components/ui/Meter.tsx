import { band } from "@/lib/format";

/** Utilisation meter. The scale runs to 120% so "Over" is visible; the tick marks the 80% target. */
export default function Meter({ util, size, label }: { util: number | null; size?: "sm"; label?: string }) {
  const b = band(util);
  const w = Math.min(1, (util || 0) / 1.2) * 100;
  return (
    <div
      className={`meter ${b.cls}${size ? " meter-sm" : ""}`}
      role="meter" aria-valuemin={0} aria-valuemax={120}
      aria-valuenow={util == null ? undefined : Math.round(util * 100)} aria-label={label || "Utilisation"}
    >
      <i style={{ width: `${w}%` }} />
      <span className="target" style={{ left: `${(0.8 / 1.2) * 100}%` }} />
    </div>
  );
}
