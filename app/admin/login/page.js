import { redirect } from 'next/navigation';
import { countUsers, getUser } from '@/lib/auth';
import { Field, Flash } from '../_ui';
import { login } from '../actions';

export const metadata = { title: 'Sign in | SOS Foundation admin' };

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  if ((await countUsers()) === 0) redirect('/admin/setup');
  if (await getUser()) redirect('/admin');
  return (
    <div className="auth">
      <div className="card">
        <div className="brand">
          <img src="/assets/img/sosf-mark.webp" alt="" />
          <div><b>SOS Foundation</b><span>Website admin</span></div>
        </div>
        <h1>Sign in</h1>
        <Flash params={params} />
        <form action={login}>
          <Field label="Email" id="email"><input className="ctl" id="email" name="email" type="email" autoComplete="username" defaultValue={params.email || ''} required /></Field>
          <Field label="Password" id="password"><input className="ctl" id="password" name="password" type="password" autoComplete="current-password" required /></Field>
          <label className="check" style={{ padding: 0 }}><input type="checkbox" name="remember" /><span>Keep me signed in<small>Otherwise you are signed out after 30 minutes without activity.</small></span></label>
          <button className="btn wide" type="submit" style={{ minHeight: 48, fontSize: 16 }}>Sign in</button>
        </form>
        <p className="small muted" style={{ marginTop: 16 }}>Accounts are created by an admin; there is no public sign-up. Forgotten your password? Ask an admin to set a new one.</p>
      </div>
    </div>
  );
}
