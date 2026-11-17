import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";

const ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle };

export default function Callout({ tone = "info", title, children, actions }: { tone?: keyof typeof ICONS; title?: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  const I = ICONS[tone];
  return (
    <div className={`callout ${tone}`} role={tone === "danger" || tone === "warning" ? "alert" : "status"}>
      <I aria-hidden="true" />
      <div className="callout-body">
        {title && <p className="callout-title">{title}</p>}
        {children && <div>{children}</div>}
      </div>
      {actions && <div className="callout-actions">{actions}</div>}
    </div>
  );
}
