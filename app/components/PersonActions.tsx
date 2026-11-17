"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Menu, { type MenuItem } from "./ui/Menu";
import { Modal } from "./ui/Dialog";
import { toast } from "./ui/Toast";

export type PersonRef = { id: number; name: string; active: boolean };

async function post(body: object) {
  const r = await fetch("/api/people", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return r.ok;
}

export function usePersonActions() {
  const router = useRouter();
  const [deleting, setDeleting] = useState<PersonRef | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const ok = await post({ action: "delete", id: deleting.id });
    setBusy(false);
    toast(ok ? `${deleting.name} deleted. You can restore them from the Recycle bin.` : "Couldn't delete that person.", ok ? "success" : "danger", 6000);
    setDeleting(null);
    router.refresh();
  }

  const dialog = (
    <Modal open={!!deleting} onClose={() => !busy && setDeleting(null)} title={`Delete ${deleting?.name ?? "this person"}?`} icon={<Trash2 />} tone="danger"
      description="They are removed from the roster with their leave. Their Jira worklogs stay but are no longer counted. You can restore them from the Recycle bin.">
      <div className="modal-foot">
        <button type="button" className="btn" data-close disabled={busy}>Cancel</button>
        <button type="button" className={`btn btn-danger${busy ? " is-loading" : ""}`} onClick={confirmDelete} disabled={busy} autoFocus>
          {busy && <span className="spinner" aria-hidden="true" />}Delete person
        </button>
      </div>
    </Modal>
  );

  const items = (p: PersonRef, opts: { href?: string; onEdit?: () => void } = {}): MenuItem[] => [
    ...(opts.href ? [{ label: "View timesheet", icon: <CalendarDays />, href: opts.href } as MenuItem] : []),
    ...(opts.onEdit ? [{ label: "Edit details", icon: <Pencil />, onSelect: opts.onEdit } as MenuItem] : []),
    ...(opts.href || opts.onEdit ? [{ sep: true } as MenuItem] : []),
    { label: "Delete person", icon: <Trash2 />, danger: true, onSelect: () => setDeleting(p) },
  ];

  return { items, dialog, setDeleting };
}

/** The "⋯" row menu for a person: view timesheet, delete (with confirmation). */
export default function PersonMenu({ person, href }: { person: PersonRef; href?: string }) {
  const { items, dialog } = usePersonActions();
  return (
    <>
      <Menu label={`Actions for ${person.name}`} icon={<MoreHorizontal />} variant="ghost" size="sm" items={items(person, { href })} />
      {dialog}
    </>
  );
}
