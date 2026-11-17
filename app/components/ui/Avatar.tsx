import { COUNTED } from "@/lib/format";

export function initials(name: string) {
  const w = name.replace(/[^\p{L}\s.-]/gu, "").split(/[\s.-]+/).filter(Boolean);
  if (!w.length) return "?";
  return ((w[0][0] || "") + (w.length > 1 ? w[w.length - 1][0] : w[0][1] || "")).toUpperCase();
}

/** Team colour: delivery teams use the series colours, everyone else a neutral tone. */
export function teamColor(team?: string | null) {
  const i = COUNTED.indexOf(team || "");
  return i >= 0 ? `var(--team-${i + 1})` : "var(--muted)";
}

export default function Avatar({ name, team, size }: { name: string; team?: string | null; size?: "sm" | "lg" }) {
  return (
    <span className={`avatar${size ? ` avatar-${size}` : ""}`} style={{ ["--av-c" as string]: teamColor(team) }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
