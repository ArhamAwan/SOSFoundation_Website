// The list screen and the publish box are the same for news posts and success stories.
import Link from 'next/link';
import { TYPES, isLive, issuesOf } from '@/lib/content';
import { Badge, Icon } from './index';
import { ConfirmButton } from './client';
import { deleteItem } from '../actions';

export function statusOf(item, media, preview) {
  const issues = issuesOf(item, media);
  if (item.status !== 'published') return { kind: 'draft', label: 'Draft', issues };
  if (!issues.length) return { kind: 'ok', label: 'Published', issues };
  return preview ? { kind: 'warn', label: 'Published, has issues', issues } : { kind: 'warn', label: 'Hidden until fixed', issues };
}

/** Filter pills + search box. Both work through the address, so they need no script. */
export function ListFilters({ base, params, counts }) {
  const show = params.show || 'all';
  const link = (key) => `${base}?show=${key}${params.q ? '&q=' + encodeURIComponent(params.q) : ''}`;
  return (
    <div className="toolbar">
      <div className="pills">
        {[['all', 'All'], ['published', 'Published'], ['draft', 'Drafts'], ['issues', 'Has issues']].map(([key, label]) => (
          <a key={key} className="pill" href={link(key)} aria-current={show === key ? 'true' : undefined}>{label} {counts[key]}</a>
        ))}
      </div>
      <form className="row" action={base}>
        {show !== 'all' ? <input type="hidden" name="show" value={show} /> : null}
        <label className="search"><span className="sr">Search</span><Icon name="Search" /><input className="ctl" type="search" name="q" placeholder="Search" defaultValue={params.q || ''} /></label>
        <button className="btn plain" type="submit">Search</button>
      </form>
    </div>
  );
}

export function filterItems(items, media, params) {
  const needle = (params.q || '').trim().toLowerCase();
  const groups = {
    all: items, published: items.filter((i) => i.status === 'published'), draft: items.filter((i) => i.status !== 'published'),
    issues: items.filter((i) => issuesOf(i, media).length > 0),
  };
  const counts = Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length]));
  let rows = groups[params.show] || groups.all;
  if (needle) rows = rows.filter((i) => (i.title + ' ' + Object.values(i.data).join(' ')).toLowerCase().includes(needle));
  return { rows, counts };
}

export function RowActions({ item, media, preview, isAdmin }) {
  const def = TYPES[item.type];
  return (
    <div className="acts">
      {isLive(item, media, preview) ? <a className="iconbtn" href={item.data.link || `${def.public}/${item.slug}`} target="_blank" rel="noreferrer" aria-label="View on website"><Icon name="ext" /></a> : null}
      <Link className="iconbtn" href={`${def.admin}/${item.id}`} aria-label="Edit"><Icon name="edit" /></Link>
      {isAdmin ? (
        <form action={deleteItem}>
          <input type="hidden" name="type" value={item.type} />
          <input type="hidden" name="id" value={item.id} />
          <ConfirmButton className="iconbtn danger" aria-label="Delete" message={`Delete "${item.title}"? This cannot be undone.`}><Icon name="trash" /></ConfirmButton>
        </form>
      ) : null}
    </div>
  );
}

/** The box at the top right of every editor: status, what is missing, and the save buttons. */
export function PublishBox({ item, media, preview, isAdmin }) {
  const def = TYPES[item.type];
  const st = item.id ? statusOf(item, media, preview) : { kind: 'draft', label: 'Not saved yet', issues: [] };
  const published = item.status === 'published';
  return (
    <section className="panel">
      <h2>Publish</h2>
      <p style={{ marginBottom: 12 }}><Badge kind={st.kind}>{st.label}</Badge></p>
      {st.issues.length ? (
        <div className="alert note" style={{ marginBottom: 16 }}>
          <b>{preview ? 'Fix before the site goes live' : 'Fix before this can be published'}</b>
          <ul>{st.issues.map((i) => <li key={i}>{i}</li>)}</ul>
        </div>
      ) : null}
      <div className="row">
        <button className="btn" type="submit" name="intent" value={published ? 'save' : 'publish'}>{published ? 'Save changes' : 'Publish'}</button>
        <button className="btn plain" type="submit" name="intent" value={published ? 'unpublish' : 'save'}>{published ? 'Unpublish' : 'Save draft'}</button>
      </div>
      {item.id ? (
        <p className="small muted" style={{ marginTop: 14 }}>
          Last edited {new Date(item.updated_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Karachi' })}{item.editor ? ` by ${item.editor}` : ''}.
          {isLive(item, media, preview) ? <> <a href={item.data.link || `${def.public}/${item.slug}`} target="_blank" rel="noreferrer">View on website</a></> : null}
        </p>
      ) : null}
      {isAdmin && item.id ? <p style={{ marginTop: 14 }}><ConfirmButton className="linkbtn" style={{ color: '#b3161b' }} formAction={deleteItem} formNoValidate message={`Delete "${item.title}"? This cannot be undone.`}>Delete this {def.label.toLowerCase()}</ConfirmButton></p> : null}
    </section>
  );
}
