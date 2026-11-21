import { requireLeadsUser } from '@/lib/auth';
import { MIN_PASSWORD } from '@/lib/password';
import { changePassword } from '../actions';
import { Flash, Ico, Top } from '../ui';

export const metadata = { title: 'Your password | SOS Foundation Leads' };

export default async function LeadsAccount({ searchParams }) {
  const user = await requireLeadsUser();
  const params = await searchParams;
  return (
    <div className="lp">
      <Top user={user} />
      <main className="lp-main">
        <div className="lp-acct">
          <a className="lp-back" style={{ display: 'flex' }} href="/leads"><Ico name="arrow-left" />All leads</a>
          <div className="lp-head"><div><h1>Your password</h1><p>Choose a password only you know. You stay signed in on this device.</p></div></div>
          <Flash params={params} />
          <form className="lp-panel" action={changePassword}>
            <h2>Change password</h2>
            <div className="fld"><label className="lp-lbl" htmlFor="current">Current password</label><input className="lp-ctl" id="current" name="current" type="password" autoComplete="current-password" required /></div>
            <div className="fld"><label className="lp-lbl" htmlFor="password">New password</label><input className="lp-ctl" id="password" name="password" type="password" autoComplete="new-password" minLength={MIN_PASSWORD} required aria-describedby="pw-help" /><span className="lp-help" id="pw-help">At least {MIN_PASSWORD} characters.</span></div>
            <div className="fld"><label className="lp-lbl" htmlFor="confirm">New password again</label><input className="lp-ctl" id="confirm" name="confirm" type="password" autoComplete="new-password" required /></div>
            <button className="lp-btn" type="submit">Save password</button>
          </form>
        </div>
      </main>
    </div>
  );
}
