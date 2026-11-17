"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

export type ToastTone = "success" | "danger" | "warning" | "info";
type Item = { id: number; text: string; tone: ToastTone; leaving?: boolean };

// A tiny global store so any client component can call toast() without a provider.
let items: Item[] = [];
let seq = 0;
const listeners = new Set<(list: Item[]) => void>();
const emit = () => listeners.forEach((l) => l(items));

export function dismissToast(id: number) {
  items = items.map((t) => (t.id === id ? { ...t, leaving: true } : t));
  emit();
  window.setTimeout(() => { items = items.filter((t) => t.id !== id); emit(); }, 200);
}

export function toast(text: string, tone: ToastTone = "success", ms = 4200) {
  const id = ++seq;
  items = [...items.slice(-3), { id, text, tone }];
  emit();
  window.setTimeout(() => dismissToast(id), ms);
  return id;
}

const ICONS = { success: CheckCircle2, danger: XCircle, warning: AlertTriangle, info: Info };

export function Toaster() {
  const [list, setList] = useState<Item[]>([]);
  useEffect(() => {
    listeners.add(setList);
    setList(items);
    return () => { listeners.delete(setList); };
  }, []);
  return (
    <div className="toaster" role="region" aria-label="Notifications" aria-live="polite">
      {list.map((t) => {
        const I = ICONS[t.tone];
        return (
          <div key={t.id} className={`toast ${t.tone}${t.leaving ? " leaving" : ""}`} role={t.tone === "danger" ? "alert" : "status"}>
            <I aria-hidden="true" />
            <span className="grow">{t.text}</span>
            <button type="button" className="x" onClick={() => dismissToast(t.id)} aria-label="Dismiss"><X size={16} /></button>
          </div>
        );
      })}
    </div>
  );
}
