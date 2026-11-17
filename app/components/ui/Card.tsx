import type { ReactNode } from "react";

export function Card({ children, className = "", id, as: Tag = "section" }: { children: ReactNode; className?: string; id?: string; as?: "section" | "div" | "article" }) {
  return <Tag id={id} className={`card ${className}`.trim()}>{children}</Tag>;
}

export function CardHeader({ title, description, actions, count, plain, icon }: {
  title: ReactNode; description?: ReactNode; actions?: ReactNode; count?: number | string; plain?: boolean; icon?: ReactNode;
}) {
  return (
    <div className={`card-header${plain ? " plain" : ""}`}>
      <div className="truncate" style={{ whiteSpace: "normal" }}>
        <h2 className="card-title">{icon}{title}{count != null && <span className="count num">{count}</span>}</h2>
        {description && <p className="card-desc">{description}</p>}
      </div>
      {actions && <div className="card-actions">{actions}</div>}
    </div>
  );
}

export function CardBody({ children, flush, className = "" }: { children: ReactNode; flush?: boolean; className?: string }) {
  return <div className={`card-body${flush ? " flush" : ""} ${className}`.trim()}>{children}</div>;
}
