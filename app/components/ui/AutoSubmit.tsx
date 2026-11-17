"use client";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/** A GET form that applies itself whenever a select changes (soft navigation, no full reload). */
export default function AutoSubmitForm({ children, action, className }: { children: ReactNode; action: string; className?: string }) {
  const router = useRouter();
  const go = (f: HTMLFormElement) => {
    const p = new URLSearchParams();
    new FormData(f).forEach((v, k) => { if (typeof v === "string" && v) p.set(k, v); });
    const q = p.toString();
    router.push(`${action}${q ? `?${q}` : ""}`, { scroll: false });
  };
  return (
    <form
      method="get" action={action} className={className}
      onChange={(e) => go(e.currentTarget)}
      onSubmit={(e) => { e.preventDefault(); go(e.currentTarget); }}
    >
      {children}
      <button type="submit" className="sr-only">Apply</button>
    </form>
  );
}
