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

export const COUNTED = ["Alpha", "Bravo", "Charlie"];
export const ALL_TEAMS = [...COUNTED, "Support", "Other"];
