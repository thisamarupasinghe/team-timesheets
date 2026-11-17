"use client";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { flashFor, FLASH_PARAMS } from "@/lib/flash";
import { toast } from "../ui/Toast";

let lastHandled = "";

/** Turns ?ok= / ?err= from server-action redirects into a toast, then tidies the address bar so a reload doesn't repeat it. */
export default function FlashToaster() {
  const sp = useSearchParams();
  const path = usePathname();
  const ok = sp.get("ok"), err = sp.get("err");
  useEffect(() => {
    if (!ok && !err) { lastHandled = ""; return; }
    const key = `${path}?${sp.toString()}`;
    if (key === lastHandled) return; // effects can run twice in development
    lastHandled = key;
    const m = ok ? flashFor(path, "ok", ok) : flashFor(path, "err", err!);
    if (m) toast(m.text, m.tone);
    else if (m === undefined && err) toast("Something went wrong. Please try again.", "danger");
    const next = new URLSearchParams(sp.toString());
    FLASH_PARAMS.forEach((k) => next.delete(k));
    const q = next.toString();
    window.history.replaceState(null, "", path + (q ? `?${q}` : ""));
  }, [ok, err, path, sp]);
  return null;
}
