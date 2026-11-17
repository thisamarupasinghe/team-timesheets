import type { ReactNode } from "react";

export default function EmptyState({ icon, title, text, action, tone, compact }: {
  icon: ReactNode; title: string; text?: ReactNode; action?: ReactNode; tone?: "success"; compact?: boolean;
}) {
  return (
    <div className={`empty${compact ? " empty-compact" : ""}`} role="status">
      <div className={`empty-icon ${tone || ""}`.trim()} aria-hidden="true">{icon}</div>
      <p className="empty-title">{title}</p>
      {text && <p className="empty-text">{text}</p>}
      {action}
    </div>
  );
}
