// Small building blocks used by every admin screen.
import Link from 'next/link';
import icons from '@/lib/generated/icons.json';
import nav from '@/lib/generated/nav.json';
import { SideNav } from './client';

export const Icon = ({ name, html }) => <span className="ic" aria-hidden="true" dangerouslySetInnerHTML={{ __html: html || icons[name] || '' }} />;

export function Shell({ user, children }) {
  const groups = nav.map((group) => ({ group: group.group, items: group.items.filter((item) => user.isAdmin || item.href !== '/admin/users') }));
  return (
    <div className="adm">
      <aside className="adm-side">
        <Link className="adm-brand" href="/admin">
          <img src="/assets/img/sosf-mark.webp" alt="" />
          <span>
            <b>SOS Foundation</b>
            <span>Website admin</span>
          </span>
        </Link>
        <SideNav groups={groups} />
        <div className="adm-foot">
          <a href="/" target="_blank" rel="noreferrer"><Icon name="ext" />View website</a>
        </div>
      </aside>
      <div className="adm-body">
        <div className="adm-top">
          <Link className="who" href="/admin/account">
            <span className="avatar" aria-hidden="true">{user.name.trim().charAt(0).toUpperCase() || 'A'}</span>
            {user.name}
            <span className="badge info">{user.isAdmin ? 'Admin' : 'Editor'}</span>
          </Link>
          <a className="out" href="/admin/logout"><Icon name="out" />Sign out</a>
        </div>
        <main className="adm-main">{children}</main>
      </div>
    </div>
  );
}

export function Head({ title, sub, crumb, children }) {
  return (
    <div className="head">
      <div style={{ minWidth: 0 }}>
        {crumb ? <p className="crumb">{crumb}</p> : null}
        <h1>{title}</h1>
        {sub ? <p className="sub">{sub}</p> : null}
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}

/** Shows the message a save or sign-in action sent back in the address (?ok=… or ?error=…). */
export function Flash({ params }) {
  if (params?.error) return <div className="alert error" role="alert">{params.error}</div>;
  if (params?.ok) return <div className="alert" role="status">{params.ok}</div>;
  return null;
}

export const Badge = ({ kind = 'ok', children }) => <span className={'badge ' + kind}>{children}</span>;

export function Field({ label, id, help, wide, children }) {
  return (
    <div className={'field' + (wide ? ' wide' : '')}>
      <label htmlFor={id}>{label}</label>
      {children}
      {help ? <span className="help">{help}</span> : null}
    </div>
  );
}

export function Select({ id, name, value, options, blank }) {
  return (
    <select className="ctl" id={id} name={name || id} defaultValue={value || ''}>
      {blank !== undefined ? <option value="">{blank}</option> : null}
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export function Check({ name, label, note, on, disabled }) {
  return (
    <label className="check">
      <input type="checkbox" name={name} defaultChecked={!!on} disabled={disabled} />
      <span>{label}{note ? <small>{note}</small> : null}</span>
    </label>
  );
}
