import { CalendarDays, UserX, RotateCcw, Trash2, User } from "lucide-react";
import { requireEditor } from "@/lib/auth";
import { binItems, type BinKind } from "@/lib/bin";
import { humanDates } from "@/lib/format";
import { restoreFromBin } from "../admin/actions";
import PageHeader from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import Segmented from "../../components/ui/Segmented";
import EmptyState from "../../components/ui/EmptyState";
import SubmitButton from "../../components/ui/SubmitButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recycle bin" };

const TZ = process.env.APP_TIMEZONE || "UTC";
const fmt = (v: string) => new Date(v).toLocaleString("en-GB", { timeZone: TZ, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const KINDS: { kind: BinKind; label: string; icon: typeof User }[] = [
  { kind: "person", label: "People", icon: User },
  { kind: "leave", label: "Leave", icon: UserX },
  { kind: "holiday", label: "Holidays", icon: CalendarDays },
];

export default async function Bin(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const user = await requireEditor();
  const items = await binItems();
  const kind = KINDS.some((k) => k.kind === searchParams.kind) ? (searchParams.kind as BinKind) : null;
  const rows = items.filter((i) => !kind || i.kind === kind);

  return (
    <div className="stack-lg page-enter">
      <PageHeader title="Recycle bin">
        <Segmented label="Filter by type" items={[
          { href: "/bin", label: "All", on: !kind, count: items.length },
          ...KINDS.map((k) => ({ href: `/bin?kind=${k.kind}`, label: k.label, on: kind === k.kind, count: items.filter((i) => i.kind === k.kind).length })),
        ]} />
      </PageHeader>

      <Card>
        {rows.length ? (
          <div className="list">
            {rows.map((r) => {
              const K = KINDS.find((k) => k.kind === r.kind)!;
              const canRestore = !(r.kind === "holiday" && user.role !== "admin");
              return (
                <div key={r.id} className="list-item">
                  <span className={`kind-icon k-${r.kind}`} aria-hidden="true"><K.icon size={16} /></span>
                  <div className="grow">
                    <div className="title">{r.label}{r.detail && <span className="muted" style={{ fontWeight: 400 }}> · {humanDates(r.detail)}</span>}</div>
                    <div className="sub">Deleted {fmt(r.at)} by {r.actor}</div>
                  </div>
                  {canRestore ? (
                    <form action={restoreFromBin}>
                      <input type="hidden" name="id" value={r.id} />
                      <SubmitButton variant="secondary" size="sm" icon={<RotateCcw />} pendingText="Restoring…">Restore</SubmitButton>
                    </form>
                  ) : <span className="small faint">Admin only</span>}
                </div>
              );
            })}
          </div>
        ) : <EmptyState icon={<Trash2 />} title="The recycle bin is empty" text={kind ? "Nothing of this type has been deleted." : "Deleted people, leave and holidays will show up here so they can be restored."} />}
      </Card>
    </div>
  );
}
