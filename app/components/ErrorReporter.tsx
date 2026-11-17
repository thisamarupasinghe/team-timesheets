"use client";
import { useEffect } from "react";

const sent = new Set<string>();

/** Sends a short note when something crashes inside the browser, so the admin hears about it in the 9 am email. */
export function reportBrowserError(message: string, source = "") {
  const key = message.slice(0, 200);
  if (!message || sent.has(key) || sent.size >= 3) return; // at most 3 different errors per page load
  sent.add(key);
  const body = JSON.stringify({ message: message.slice(0, 500), path: location.pathname, source: source.slice(0, 200) });
  fetch("/api/client-error", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
}

export default function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => reportBrowserError(e.message || String(e.error), e.filename || "");
    const onRejection = (e: PromiseRejectionEvent) => reportBrowserError((e.reason && (e.reason.message || String(e.reason))) || "Unhandled promise rejection", (e.reason && e.reason.stack) || "");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRejection); };
  }, []);
  return null;
}
