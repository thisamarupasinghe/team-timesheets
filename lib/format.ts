/** seconds -> "6h 33m" */
export function hm(seconds: number): string {
  const t = Math.round((seconds || 0) / 60);
  const h = Math.floor(t / 60), m = t % 60;
  if (!h && !m) return "0h";
  return `${h ? h + "h" : ""}${h && m ? " " : ""}${m ? m + "m" : ""}`;
}
export const pct = (p: number | null) => (p == null ? "–" : Math.round(p * 100) + "%");

export const BANDS = [
  { min: 0, cls: "b0", label: "Critically under" },
  { min: 0.4, cls: "b1", label: "Under" },
  { min: 0.6, cls: "b2", label: "Low" },
  { min: 0.8, cls: "b3", label: "Optimal" },
];
export function band(p: number | null) {
  if (p == null) return { cls: "na", label: "No capacity" };
  if (p > 1) return { cls: "b4", label: "Over" };
  let b = BANDS[0];
  for (const x of BANDS) if (p >= x.min) b = x;
  return b;
}

export const COUNTED = ["Alpha", "Bravo", "Charlie", "Delta", "Echo"];
export const ALL_TEAMS = [...COUNTED, "Platform", "Studio", "Group", "Finance", "HR", "Other"];

const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Rewrites ISO dates inside free text ("2026-11-02 to 2026-11-04") as "2 Nov 2026 to 4 Nov 2026". */
export const humanDates = (s: string) =>
  s.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (m, y, mo, d) => (+mo >= 1 && +mo <= 12 ? `${+d} ${MON3[+mo - 1]} ${y}` : m));

/** More than this in one day is almost certainly a week booked against a single date: flag it for checking in Jira. */
export const OVER_DAY_SECS = 12 * 3600;
export const isOverDay = (secs: number) => secs > OVER_DAY_SECS;
