import { redirect } from 'next/navigation';
import { countUsers } from '@/lib/auth';
import { MIN_PASSWORD } from '@/lib/password';
import { Field, Flash } from '../_ui';
import { setup } from '../actions';

export const metadata = { title: 'Set up | SOS Foundation admin' };

export default async function SetupPage({ searchParams }) {
  const params = await searchParams;
  if ((await countUsers()) > 0) redirect('/admin/login');
  return (
    <div className="auth">
      <div className="card">
        <div className="brand">
          <img src="/assets/img/sosf-mark.webp" alt="" />
          <div><b>SOS Foundation</b><span>Website admin</span></div>
        </div>
        <h1>Create the first admin</h1>
        <p style={{ marginBottom: 16 }}>This screen appears once, while there are no users. The account you create here can add everyone else.</p>
        <Flash params={params} />
        <form action={setup}>
          <Field label="Your name" id="name"><input className="ctl" id="name" name="name" autoComplete="name" required /></Field>
          <Field label="Email" id="email"><input className="ctl" id="email" name="email" type="email" autoComplete="username" required /></Field>
          <Field label="Password" id="password" help={`At least ${MIN_PASSWORD} characters.`}><input className="ctl" id="password" name="password" type="password" autoComplete="new-password" minLength={MIN_PASSWORD} required /></Field>
          <Field label="Password again" id="confirm"><input className="ctl" id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={MIN_PASSWORD} required /></Field>
          <button className="btn wide" type="submit" style={{ minHeight: 48, fontSize: 16 }}>Create account and sign in</button>
        </form>
      </div>
    </div>
  );
}
