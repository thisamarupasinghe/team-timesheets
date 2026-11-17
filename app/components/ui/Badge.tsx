import type { ReactNode } from "react";
import { band } from "@/lib/format";

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info" | "outline";

export function Badge({ children, tone = "neutral", dot, icon, title }: { children: ReactNode; tone?: Tone | string; dot?: boolean; icon?: ReactNode; title?: string }) {
  return (
    <span className={`badge ${tone === "neutral" ? "" : tone}`.trim()} title={title}>
      {dot && <span className="dot" aria-hidden="true" />}{icon}{children}
    </span>
  );
}

/** Utilisation band badge, e.g. "Optimal" in green. */
export function BandBadge({ util }: { util: number | null }) {
  const b = band(util);
  return <Badge tone={b.cls} dot>{b.label}</Badge>;
}
