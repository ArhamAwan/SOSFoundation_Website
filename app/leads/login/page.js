import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { leadsLogin } from '../actions';
import { Flash, Ribbon } from '../ui';

export const metadata = { title: 'Sign in | SOS Foundation Leads' };

export default async function LeadsLogin({ searchParams }) {
  const params = await searchParams;
  if (await getUser()) redirect('/leads');
  return (
    <div className="lp">
      <main className="lp-auth">
        <div className="card">
          <img src="/assets/img/sosf-logo-navy.webp" alt="SOS Foundation" />
          <h1>Leads</h1>
          <p className="intro">Sign in to see what people send through the website forms.</p>
          <Flash params={params} />
          <form action={leadsLogin} style={{ marginTop: params.error ? 16 : 0 }}>
            <div className="fld"><label className="lp-lbl" htmlFor="email">Email</label><input className="lp-ctl" id="email" name="email" type="email" autoComplete="username" defaultValue={params.email || ''} required /></div>
            <div className="fld"><label className="lp-lbl" htmlFor="password">Password</label><input className="lp-ctl" id="password" name="password" type="password" autoComplete="current-password" required /></div>
            <label className="lp-check"><input type="checkbox" name="remember" /><span>Keep me signed in<small>Otherwise you are signed out after 30 minutes without activity.</small></span></label>
            <button className="lp-btn wide" type="submit">Sign in</button>
          </form>
          <p className="note">Accounts are made by an SOS Foundation admin. Forgotten your password? Ask an admin to set a new one.</p>
        </div>
        <Ribbon />
      </main>
    </div>
  );
}
