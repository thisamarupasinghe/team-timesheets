import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-ghost";
export type Size = "sm" | "md" | "lg";

export function btnClass(variant: Variant = "secondary", size: Size = "md", iconOnly = false, extra = "") {
  return ["btn", variant !== "secondary" && `btn-${variant}`, size !== "md" && `btn-${size}`, iconOnly && "btn-icon", extra].filter(Boolean).join(" ");
}

type Common = { variant?: Variant; size?: Size; icon?: ReactNode; iconRight?: ReactNode; label?: string; className?: string; children?: ReactNode };

/** A button. With `label` and no children it renders icon-only, using the label for screen readers and the tooltip. */
export function Button({ variant, size, icon, iconRight, label, className, children, type = "button", ...rest }: Common & Omit<ComponentProps<"button">, "children">) {
  const iconOnly = !children && !!label;
  return (
    <button type={type} className={btnClass(variant, size, iconOnly, className)} aria-label={iconOnly ? label : undefined} title={iconOnly ? label : undefined} {...rest}>
      {icon}{children}{iconRight}
    </button>
  );
}

/** A link that looks like a button. External and download links use a plain <a>. */
export function LinkButton({ href, variant, size, icon, iconRight, label, className, children, external, download, ...rest }: Common & { href: string; external?: boolean; download?: boolean } & Omit<ComponentProps<"a">, "href" | "children" | "download">) {
  const iconOnly = !children && !!label;
  const cls = btnClass(variant, size, iconOnly, className);
  const a11y = { "aria-label": iconOnly ? label : undefined, title: iconOnly ? label : undefined };
  if (external || download) {
    return <a href={href} className={cls} {...a11y} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} download={download || undefined} {...rest}>{icon}{children}{iconRight}</a>;
  }
  return <Link href={href} className={cls} {...a11y} {...(rest as object)}>{icon}{children}{iconRight}</Link>;
}
