"use client";
/// <reference types="react-dom/canary" />
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { btnClass, type Size, type Variant } from "./Button";

/** Submit button for server-action forms: shows a spinner and blocks double submits while the action runs. */
export default function SubmitButton({ children, variant = "primary", size, icon, pendingText, className, label, disabled, name, value }: {
  children?: ReactNode; variant?: Variant; size?: Size; icon?: ReactNode; pendingText?: string; className?: string; label?: string; disabled?: boolean; name?: string; value?: string;
}) {
  const { pending } = useFormStatus();
  const iconOnly = !children && !!label;
  return (
    <button
      type="submit" name={name} value={value}
      className={btnClass(variant, size, iconOnly, `${pending ? "is-loading" : ""} ${className || ""}`.trim())}
      disabled={disabled || pending} aria-busy={pending || undefined}
      aria-label={iconOnly ? label : undefined} title={iconOnly ? label : undefined}
    >
      {pending ? <span className="spinner" aria-hidden="true" /> : icon}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
