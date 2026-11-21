// Small pieces shared by the Leads portal pages. Icons and colours come from gen/leads_portal.py (the approved design).
import design from './design.json';

const FORM = Object.fromEntries(design.forms.map((f) => [f.name, f]));
export const formLook = (name) => FORM[name] || { colour: '#373b73', icon: 'tray' };

export function Ico({ name }) {
  return <span aria-hidden="true" style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: design.icons[name] || '' }} />;
}

export function Ribbon() {
  return <div className="lp-rib" aria-hidden="true" dangerouslySetInnerHTML={{ __html: design.ribbon }} />;
}

export function Top({ user }) {
  return (
    <header className="lp-top">
      <div className="lp-top-in">
        <a className="lp-brand" href="/leads"><img src="/assets/img/sosf-logo-white.webp" alt="SOS Foundation" /><b>Leads</b></a>
        <div className="lp-user">
          <span className="who">Signed in as {user.name}</span>
          {user.leadsOnly ? null : <a href="/admin"><Ico name="squares-four" /><span className="txt">Admin panel</span></a>}
          <a href="/leads/account"><Ico name="key" /><span className="txt">Password</span></a>
          <a href="/leads/logout"><Ico name="sign-out" /><span className="txt">Sign out</span></a>
        </div>
      </div>
    </header>
  );
}

export function Flash({ params }) {
  if (params.ok) return <p className="lp-flash ok" role="status">{params.ok}</p>;
  if (params.error) return <p className="lp-flash error" role="alert">{params.error}</p>;
  return null;
}
