import Header from "../components/Header";
import { requireEditor } from "@/lib/auth";
import { binItems, type BinKind } from "@/lib/bin";
import { restoreFromBin } from "../admin/actions";

export const dynamic = "force-dynamic";
const TZ = process.env.APP_TIMEZONE || "UTC";
const fmt = (v: string) => new Date(v).toLocaleString("en-GB", { timeZone: TZ, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const OK: Record<string, string> = { restored: "Put back." };
const ERR: Record<string, string> = {
  gone: "That item was already restored.",
  exists: "Someone with that name is already on the roster.",
  noperson: "Restore the person first, then their leave.",
  admin: "Only the admin can restore a public holiday.",
};
const GROUPS: [BinKind, string, string][] = [
  ["person", "People", "Deleted from the roster, with their leave."],
  ["leave", "Leave", "Leave days that were removed."],
  ["holiday", "Public holidays", "Only the admin can put these back."],
];

export default async function Bin({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const user = await requireEditor();
  const items = await binItems();
  return (
    <>
      <Header active="bin" />
      <main className="wrap">
        <h1 className="page">Recycle bin</h1>
        <p className="muted" style={{ margin: 0 }}>Anything deleted on the site, by anyone, lands here first. Only the admin and managers can see this page.</p>
        {searchParams.ok && OK[searchParams.ok] && <div className="notice ok">{OK[searchParams.ok]}</div>}
        {searchParams.err && ERR[searchParams.err] && <div className="notice warn">{ERR[searchParams.err]}</div>}
        {GROUPS.map(([kind, title, hint]) => {
          const rows = items.filter((i) => i.kind === kind);
          return (
            <section className="panel" key={kind}>
              <div className="panel-h"><h2>{title} ({rows.length})</h2><span className="muted" style={{ fontSize: 12 }}>{hint}</span></div>
              <div className="scroll">
                <table className="stack">
                  <thead><tr><th>Item</th><th>Deleted</th><th>By</th><th /></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td><b>{r.label}</b>{r.detail ? <div className="pmeta">{r.detail}</div> : null}</td>
                        <td className="num" style={{ whiteSpace: "nowrap" }}>{fmt(r.at)}</td>
                        <td>{r.actor}</td>
                        <td className="r">{kind === "holiday" && user.role !== "admin" ? null : <form action={restoreFromBin}><input type="hidden" name="id" value={r.id} /><button className="btn">Restore</button></form>}</td>
                      </tr>
                    ))}
                    {!rows.length && <tr><td colSpan={4} className="muted">Nothing here.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </main>
    </>
  );
}
