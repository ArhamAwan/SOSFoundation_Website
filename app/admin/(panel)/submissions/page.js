import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { q } from '@/lib/db';
import { sheetFromEnv, sheetUrl } from '@/lib/sheets';
import { Badge, Field, Flash, Head, Icon } from '@/app/admin/_ui';
import { ConfirmButton } from '@/app/admin/_ui/client';
import { deleteSubmission, resendToSheet, saveSheetUrl, testSheet, updateSubmission } from '@/app/admin/actions';

const FORMS = ['Volunteer', 'Partnership / Corporate CSR', 'Ambassador (Youth / Brand)', 'Contact', 'Newsletter'];
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
  const rows = await q(`SELECT id, form, page, data, status, sheet, created_at FROM submissions ${show ? 'WHERE form = $1' : ''} ORDER BY id DESC LIMIT 500`, show ? [show] : []);
  const [selected] = params.id ? await q('SELECT * FROM submissions WHERE id = $1', [Number(params.id) || 0]) : [];
  const [url, [{ n: unsent }]] = await Promise.all([sheetUrl(), q(`SELECT count(*)::int AS n FROM submissions WHERE sheet <> 'sent'`)]);
  const base = (extra) => '/admin/submissions?' + [show ? 'form=' + encodeURIComponent(show) : '', extra].filter(Boolean).join('&');
  const email = selected ? emailOf(selected.data) : '';
  return (
    <>
      <Head title="Form submissions" sub="Everything sent through the website forms: volunteer, partnership and corporate CSR, ambassador, contact and newsletter.">
        <a className="btn plain" href={'/admin/submissions/export' + (show ? '?form=' + encodeURIComponent(show) : '')}><Icon name="Download" />Export CSV</a>
      </Head>
      <Flash params={params} />
      <div className="toolbar">
        <div className="pills">
          <a className="pill" href="/admin/submissions" aria-current={!show ? 'true' : undefined}>All {total}</a>
          {forms.map((f) => <a key={f} className="pill" href={'/admin/submissions?form=' + encodeURIComponent(f)} aria-current={show === f ? 'true' : undefined}>{f} {counts[f] || 0}</a>)}
        </div>
      </div>
      <div className="edit">
        <div className="main">
          <div className="tablewrap">
            <table className="tbl">
              <thead><tr><th scope="col">From</th><th scope="col">Form</th><th scope="col">Received</th><th scope="col">Status</th><th scope="col">Google Sheet</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} aria-current={selected?.id === r.id ? 'true' : undefined}>
                    <td><Link href={base('id=' + r.id)} style={{ fontWeight: r.status === 'new' ? 800 : 600 }}>{nameOf(r.data)}</Link>{emailOf(r.data) ? <span className="small muted" style={{ display: 'block' }}>{emailOf(r.data)}</span> : null}</td>
                    <td>{r.form}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{when.format(new Date(r.created_at))}</td>
                    <td><Badge kind={(STATUS[r.status] || STATUS.new)[0]}>{(STATUS[r.status] || STATUS.new)[1]}</Badge></td>
                    <td>{r.sheet === 'sent' ? <Badge>Copied</Badge> : r.sheet === 'failed' ? <Badge kind="warn">Not copied</Badge> : <Badge kind="draft">Not connected</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 ? <p className="empty-state">{total ? 'Nothing from this form yet.' : 'No submissions yet. Entries from the website forms will appear here.'}</p> : null}
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
                {user.isAdmin ? <ConfirmButton formAction={deleteSubmission} message="Delete this submission? This cannot be undone. A copy already in the Google Sheet stays there.">Delete</ConfirmButton> : null}
              </div>
            </form>
          ) : (
            <section className="panel"><h2>Open a submission</h2><p className="muted">Choose one from the list to read it, set its status or add a private note.</p></section>
          )}
          <section className="panel">
            <h2>Copy to Google Sheet</h2>
            <p className="small muted" style={{ marginBottom: 12 }}>Every new submission is also added as a row in the Google Sheet, on a tab named after the form. Submissions are always kept here too.</p>
            <p style={{ marginBottom: 12 }}>{url ? <Badge>Connected</Badge> : <Badge kind="draft">Not connected</Badge>}</p>
            {user.isAdmin ? (
              sheetFromEnv() ? (
                <p className="small muted">The address is set in Vercel (SHEETS_WEBHOOK_URL), so it is changed there.</p>
              ) : (
                <form action={saveSheetUrl}>
                  <Field label="Google Sheet web app address" id="sheet_url" wide help="From the sheet's Apps Script: Deploy, then Web app. It ends with /exec.">
                    <input className="ctl" id="sheet_url" name="sheet_url" type="url" defaultValue={url} placeholder="https://script.google.com/macros/s/…/exec" />
                  </Field>
                  <div className="row" style={{ marginTop: 10 }}><button className="btn" type="submit">Save</button></div>
                </form>
              )
            ) : <p className="small muted">Only admins can change this.</p>}
            {user.isAdmin && url ? (
              <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                <form action={testSheet}><button className="btn plain" type="submit">Send a test row</button></form>
                {unsent ? <form action={resendToSheet}><button className="btn plain" type="submit">Send {unsent} not yet copied</button></form> : null}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </>
  );
}
