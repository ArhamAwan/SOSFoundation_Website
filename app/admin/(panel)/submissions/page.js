import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { q } from '@/lib/db';
import { Badge, Field, Flash, Head, Icon } from '@/app/admin/_ui';
import { ConfirmButton } from '@/app/admin/_ui/client';
import { deleteSubmission, updateSubmission } from '@/app/admin/actions';

const FORMS = ['Volunteer Registration', 'Youth Registration', 'Brand Ambassador', 'Partnership', 'Corporate CSR', 'Contact', 'Newsletter'];
const STATUS = { new: ['info', 'New'], 'in progress': ['warn', 'In progress'], closed: ['ok', 'Closed'] };
const when = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const pick = (data, test) => (data.find(([k, v]) => v && test(k.toLowerCase())) || [])[1] || '';
const nameOf = (data) => pick(data, (k) => k.includes('name') || k === 'contact person') || pick(data, (k) => k.includes('email')) || '(no name)';
const emailOf = (data) => pick(data, (k) => k.includes('email'));

export default async function Submissions({ searchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const counts = Object.fromEntries((await q('SELECT form, count(*)::int AS n FROM submissions GROUP BY form')).map((r) => [r.form, r.n]));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const forms = [...FORMS, ...Object.keys(counts).filter((f) => !FORMS.includes(f))];
  const show = forms.includes(params.form) ? params.form : '';
  const search = String(params.q || '').trim().slice(0, 100);
  const status = STATUS[params.status] ? params.status : '';
  const where = [], args = [];
  if (show) { args.push(show); where.push(`form = $${args.length}`); }
  if (status) { args.push(status); where.push(`status = $${args.length}`); }
  if (search) { args.push('%' + search.toLowerCase() + '%'); where.push(`(lower(data::text) LIKE $${args.length} OR lower(note) LIKE $${args.length})`); }
  const rows = await q(`SELECT id, form, page, data, status, created_at FROM submissions ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 500`, args);
  const [selected] = params.id ? await q('SELECT * FROM submissions WHERE id = $1', [Number(params.id) || 0]) : [];
  const keep = (extra) => [show ? 'form=' + encodeURIComponent(show) : '', status ? 'status=' + encodeURIComponent(status) : '', search ? 'q=' + encodeURIComponent(search) : '', extra].filter(Boolean).join('&');
  const base = (extra) => '/admin/submissions?' + keep(extra);
  const email = selected ? emailOf(selected.data) : '';
  return (
    <>
      <Head title="Leads" sub="Everyone who filled in a form on the website: volunteers, youth and brand ambassadors, partners and corporate CSR, contact messages and newsletter sign-ups.">
        <a className="btn plain" href={'/admin/submissions/export' + (keep('') ? '?' + keep('') : '')}><Icon name="Download" />Export CSV</a>
      </Head>
      <Flash params={params} />
      <div className="toolbar">
        <div className="pills">
          <a className="pill" href="/admin/submissions" aria-current={!show ? 'true' : undefined}>All {total}</a>
          {forms.map((f) => <a key={f} className="pill" href={'/admin/submissions?form=' + encodeURIComponent(f)} aria-current={show === f ? 'true' : undefined}>{f} {counts[f] || 0}</a>)}
        </div>
      </div>
      <form className="toolbar" method="get" action="/admin/submissions" role="search" style={{ justifyContent: 'flex-start' }}>
        {show ? <input type="hidden" name="form" value={show} /> : null}
        <label className="sr-only" htmlFor="lead-q">Search leads</label>
        <input className="ctl" id="lead-q" name="q" type="search" defaultValue={search} placeholder="Search name, email, phone or city" style={{ flex: '1 1 260px', maxWidth: 420 }} />
        <label className="sr-only" htmlFor="lead-status">Status</label>
        <select className="ctl" id="lead-status" name="status" defaultValue={status} style={{ flex: '0 1 180px' }}>
          <option value="">All statuses</option>
          {Object.entries(STATUS).map(([v, [, l]]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button className="btn plain" type="submit">Search</button>
        {search || status ? <a className="btn plain" href={'/admin/submissions' + (show ? '?form=' + encodeURIComponent(show) : '')}>Clear</a> : null}
      </form>
      <div className="edit">
        <div className="main">
          <div className="tablewrap">
            <table className="tbl">
              <thead><tr><th scope="col">From</th><th scope="col">Form</th><th scope="col">Received</th><th scope="col">Status</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} aria-current={selected?.id === r.id ? 'true' : undefined}>
                    <td><Link href={base('id=' + r.id)} style={{ fontWeight: r.status === 'new' ? 800 : 600 }}>{nameOf(r.data)}</Link>{emailOf(r.data) ? <span className="small muted" style={{ display: 'block' }}>{emailOf(r.data)}</span> : null}</td>
                    <td>{r.form}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{when.format(new Date(r.created_at))}</td>
                    <td><Badge kind={(STATUS[r.status] || STATUS.new)[0]}>{(STATUS[r.status] || STATUS.new)[1]}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 ? <p className="empty-state">{search || status ? 'No leads match. Try other words or clear the search.' : total ? 'No leads from this form yet.' : 'No leads yet. Everything sent through a website form appears here straight away.'}</p> : null}
          </div>
        </div>
        <div className="side">
          {selected ? (
            <form action={updateSubmission} className="panel">
              <h2>{selected.form}</h2>
              <p className="small muted" style={{ marginBottom: 14 }}>Received {when.format(new Date(selected.created_at))}{selected.page ? ' from ' + selected.page : ''}</p>
              <input type="hidden" name="id" value={selected.id} />
              <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(110px, .8fr) 1.2fr', gap: '8px 12px', fontSize: 14 }}>
                {selected.data.map(([k, v], i) => (
                  <div key={i} style={{ display: 'contents' }}><dt style={{ fontWeight: 700 }}>{k}</dt><dd style={{ margin: 0, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{v || <span className="muted">Empty</span>}</dd></div>
                ))}
              </dl>
              <div className="fgrid" style={{ marginTop: 18 }}>
                <Field label="Status" id="status" wide>
                  <select className="ctl" id="status" name="status" defaultValue={selected.status}>{Object.entries(STATUS).map(([v, [, l]]) => <option key={v} value={v}>{l}</option>)}</select>
                </Field>
                <Field label="Private note" id="note" wide help="Only people signed in to this admin panel see this."><textarea className="ctl" id="note" name="note" rows={3} defaultValue={selected.note} /></Field>
              </div>
              <div className="row" style={{ marginTop: 6, flexWrap: 'wrap' }}>
                <button className="btn" type="submit">Save</button>
                {email ? <a className="btn plain" href={`mailto:${email}?subject=${encodeURIComponent('SOS Foundation: your ' + selected.form.toLowerCase() + ' form')}`}>Reply by email</a> : null}
                {user.isAdmin ? <ConfirmButton formAction={deleteSubmission} message="Delete this lead? This cannot be undone.">Delete</ConfirmButton> : null}
              </div>
            </form>
          ) : (
            <section className="panel"><h2>Open a lead</h2><p className="muted">Choose one from the list to read it, set its status or add a private note.</p></section>
          )}
        </div>
      </div>
    </>
  );
}
