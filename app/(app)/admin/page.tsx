import Link from "next/link";
import { UserPlus, Users } from "lucide-react";
import { requireEditor } from "@/lib/auth";
import { getEmployees } from "@/lib/queries";
import { ALL_TEAMS } from "@/lib/format";
import { addDays, today } from "@/lib/time";
import { addEmployee, updateEmployee } from "./actions";
import PageHeader from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import Callout from "../../components/ui/Callout";
import SubmitButton from "../../components/ui/SubmitButton";
import { ModalButton } from "../../components/ui/Dialog";
import PeopleTable from "./PeopleTable";

export const dynamic = "force-dynamic";
export const metadata = { title: "People" };

export default async function People(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const user = await requireEditor();
  const isAdmin = user.role === "admin";
  const t = today();
  const people = await getEmployees(false);
  const order = (x: string) => { const i = ALL_TEAMS.indexOf(x); return i < 0 ? 99 : i; };
  people.sort((a, b) => order(a.team) - order(b.team) || a.name.localeCompare(b.name));
  const active = people.filter((p) => p.active).length;

  return (
    <div className="stack-lg page-enter">
      <PageHeader
        title="People"
        subtitle={`${active} active people on the roster. Edit teams, Jira links and work emails.`}
        actions={
          <>
            <ModalButton trigger={{ label: "Add person", icon: <UserPlus />, variant: "primary" }} title="Add a person" description="They'll appear on the timesheet once a Jira account is linked." icon={<UserPlus />}>
              <form action={addEmployee}>
                <div className="modal-body">
                  <label className="field"><span className="field-label">Full name</span><input className="input" name="name" required autoFocus placeholder="e.g. Alex Morgan" /></label>
                  <div className="form-grid two">
                    <label className="field"><span className="field-label">Employee no. <span className="faint">(optional)</span></span><input className="input mono" name="emp_no" /></label>
                    <label className="field"><span className="field-label">Team</span><select className="select" name="team" defaultValue="Alpha">{ALL_TEAMS.map((x) => <option key={x}>{x}</option>)}</select></label>
                  </div>
                  {isAdmin && <label className="field"><span className="field-label">Jira account id <span className="faint">(optional)</span></span><input className="input mono" name="jira_ids" /><span className="field-hint">You can also add it later with Edit.</span></label>}
                  {isAdmin && <label className="field"><span className="field-label">Work email <span className="faint">(optional)</span></span><input className="input" name="email" type="email" placeholder="name@example.com" /></label>}
                </div>
                <div className="modal-foot">
                  <button type="button" className="btn" data-close>Cancel</button>
                  <SubmitButton icon={<UserPlus />} pendingText="Adding…">Add person</SubmitButton>
                </div>
              </form>
            </ModalButton>
          </>
        }
      />


      <Card>
        {people.length ? (
          <PeopleTable people={people} teams={ALL_TEAMS} isAdmin={isAdmin} update={updateEmployee} />
        ) : (
          <div className="empty"><div className="empty-icon"><Users /></div><p className="empty-title">No one on the roster yet</p><p className="empty-text">Add people one by one, or check the roster against the employee list.</p></div>
        )}
      </Card>
    </div>
  );
}
