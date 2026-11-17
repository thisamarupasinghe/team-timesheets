"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { btnClass, type Size, type Variant } from "./Button";
import SubmitButton from "./SubmitButton";

/**
 * Modal or side drawer on the native <dialog> element: focus is trapped, Esc and the backdrop close it,
 * and focus returns to the trigger. Any element with data-close inside also closes it.
 */
export function Modal({ open, onClose, title, description, icon, tone, drawer, children }: {
  open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; icon?: ReactNode; tone?: "danger"; drawer?: boolean; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onNativeClose = () => onClose();
    d.addEventListener("close", onNativeClose);
    return () => d.removeEventListener("close", onNativeClose);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      className={`modal${drawer ? " drawer" : ""}`}
      aria-labelledby="modal-title"
      onClick={(e) => {
        const t = e.target as HTMLElement;
        if (t === ref.current || t.closest("[data-close]")) ref.current?.close();
      }}
    >
      {open && (
        <>
          <div className="modal-head">
            {icon && <span className={`icon ${tone || ""}`.trim()} aria-hidden="true">{icon}</span>}
            <div style={{ minWidth: 0 }}>
              <h2 className="modal-title" id="modal-title">{title}</h2>
              {description && <p className="modal-desc">{description}</p>}
            </div>
            <button type="button" className={btnClass("ghost", "sm", true, "close")} data-close aria-label="Close"><X /></button>
          </div>
          {children}
        </>
      )}
    </dialog>
  );
}

/** Closes when the URL's query changes, i.e. after a server action redirects back with ?ok=… */
export function useCloseOnNavigate(setOpen: (v: boolean) => void) {
  const sp = useSearchParams();
  const key = sp.toString();
  const last = useRef(key);
  useEffect(() => {
    if (key !== last.current) { last.current = key; setOpen(false); }
  }, [key, setOpen]);
}

type Trigger = { label: string; icon?: ReactNode; variant?: Variant; size?: Size; iconOnly?: boolean; className?: string };

function TriggerButton({ t, onClick }: { t: Trigger; onClick: () => void }) {
  return (
    <button type="button" className={btnClass(t.variant, t.size, t.iconOnly, t.className)} onClick={onClick} aria-label={t.iconOnly ? t.label : undefined} title={t.iconOnly ? t.label : undefined} aria-haspopup="dialog">
      {t.icon}{t.iconOnly ? null : t.label}
    </button>
  );
}

/** A button that opens a modal or drawer holding server-rendered content (usually a server-action form). */
export function ModalButton({ trigger, title, description, icon, drawer, children }: { trigger: Trigger; title: ReactNode; description?: ReactNode; icon?: ReactNode; drawer?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  useCloseOnNavigate(setOpen);
  return (
    <>
      <TriggerButton t={trigger} onClick={() => setOpen(true)} />
      <Modal open={open} onClose={() => setOpen(false)} title={title} description={description} icon={icon} drawer={drawer}>{children}</Modal>
    </>
  );
}

/** A destructive (or otherwise important) server action behind a confirmation dialog. */
export function ConfirmAction({ trigger, action, fields, title, description, confirmLabel, icon, tone = "danger" }: {
  trigger: Trigger; action: (f: FormData) => void | Promise<void>; fields: Record<string, string | number>;
  title: ReactNode; description?: ReactNode; confirmLabel: string; icon?: ReactNode; tone?: "danger" | "primary";
}) {
  const [open, setOpen] = useState(false);
  useCloseOnNavigate(setOpen);
  return (
    <>
      <TriggerButton t={trigger} onClick={() => setOpen(true)} />
      <Modal open={open} onClose={() => setOpen(false)} title={title} description={description} icon={icon} tone={tone === "danger" ? "danger" : undefined}>
        <form action={action}>
          {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <div className="modal-foot">
            <button type="button" className="btn" data-close>Cancel</button>
            <SubmitButton variant={tone === "danger" ? "danger" : "primary"}>{confirmLabel}</SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
