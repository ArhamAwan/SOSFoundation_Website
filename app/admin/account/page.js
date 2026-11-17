import { requireUser } from '@/lib/auth';
import { MIN_PASSWORD } from '@/lib/password';
import { Field, Flash, Head, Shell } from '../_ui';
import { updateAccount } from '../actions';

export default async function AccountPage({ searchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  return (
    <Shell user={user}>
      <Head title="My account" sub={`Signed in as ${user.email}.`} />
      <Flash params={params} />
      <form action={updateAccount} className="panel" style={{ maxWidth: 560 }}>
        <div className="fgrid">
          <Field label="Name" id="name" wide><input className="ctl" id="name" name="name" defaultValue={user.name} required /></Field>
          <Field label="Current password" id="current" wide help="Only needed if you are changing your password."><input className="ctl" id="current" name="current" type="password" autoComplete="current-password" /></Field>
          <Field label="New password" id="password" help={`At least ${MIN_PASSWORD} characters.`}><input className="ctl" id="password" name="password" type="password" autoComplete="new-password" /></Field>
          <Field label="New password again" id="confirm"><input className="ctl" id="confirm" name="confirm" type="password" autoComplete="new-password" /></Field>
        </div>
        <p style={{ marginTop: 20 }}><button className="btn" type="submit">Save</button></p>
      </form>
    </Shell>
  );
}
