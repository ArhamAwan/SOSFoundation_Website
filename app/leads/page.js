import { requireLeadsUser } from '@/lib/auth';
import { FORMS, STATUS, emailOf, filters, findLeads, formatWhen, getLead, leadCounts, nameOf, phoneOf, subOf, whatsappOf } from '@/lib/leads';
import { saveLead } from './actions';
import { Flash, Ico, Top, formLook } from './ui';

export const metadata = { title: 'Leads | SOS Foundation' };

const SEG = [['new', 'New'], ['progress', 'In progress'], ['closed', 'Closed']];

export default async function Leads({ searchParams }) {
  const user = await requireLeadsUser();
  const params = await searchParams;
  const f = filters(params);
  const [counts, rows, lead] = await Promise.all([leadCounts(), findLeads(f), params.id ? getLead(params.id) : null]);
  const qs = (parts) => { const s = parts.filter(Boolean).join('&'); return '/leads' + (s ? '?' + s : ''); };
  const part = (k, v) => (v ? k + '=' + encodeURIComponent(v) : '');
  const keep = [part('form', f.form), part('status', f.status), part('q', f.search)].filter(Boolean).join('&');
  const href = (extra) => qs([keep, extra]);
  const tabHref = (form) => qs([part('form', form), part('status', f.status), part('q', f.search)]);
  const forms = [...FORMS, ...Object.keys(counts.byForm).filter((x) => !FORMS.includes(x))];
  const filtered = !!(f.search || f.status);

  return (
    <div className={'lp' + (lead ? ' lp-open' : '')}>
      <Top user={user} />
      <main className="lp-main">
        <div className="lp-chrome">
          <div className="lp-head">
            <div><h1>Leads</h1><p>Everyone who filled in a form on the website. New ones are at the top.</p></div>
            <a className="lp-btn ghost" href={'/leads/export' + (keep ? '?' + keep : '')}><Ico name="download-simple" />Export CSV</a>
          </div>
          <div className="lp-stats">
            <div className="lp-stat new"><b>{counts.fresh}</b><span>new, not yet followed up</span></div>
            <div className="lp-stat"><b>{counts.week}</b><span>this week</span></div>
            <div className="lp-stat"><b>{counts.total}</b><span>in total</span></div>
          </div>
          <nav className="lp-tabs" aria-label="Forms">
            <a className="lp-tab" href={tabHref('')} aria-current={!f.form ? 'true' : undefined}>All <i>{counts.total}</i></a>
            {forms.map((name) => <a key={name} className="lp-tab" href={tabHref(name)} aria-current={f.form === name ? 'true' : undefined}>{name} <i>{counts.byForm[name] || 0}</i></a>)}
          </nav>
          <form className="lp-tools" role="search" method="get" action="/leads">
            {f.form ? <input type="hidden" name="form" value={f.form} /> : null}
            <div className="lp-search"><Ico name="magnifying-glass" /><label className="lp-sr" htmlFor="q">Search leads</label>
              <input className="lp-ctl" id="q" name="q" type="search" defaultValue={f.search} placeholder="Search name, email, phone or city" /></div>
            <label className="lp-sr" htmlFor="st">Status</label>
            <select className="lp-ctl" id="st" name="status" defaultValue={f.status}>
              <option value="">All statuses</option>
              {Object.entries(STATUS).map(([v, [, l]]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button className="lp-btn ghost" type="submit">Search</button>
            {filtered ? <a className="lp-btn ghost" href={'/leads' + (f.form ? '?form=' + encodeURIComponent(f.form) : '')}>Clear</a> : null}
          </form>
          <Flash params={lead ? {} : params} />
        </div>

        <div className="lp-grid">
          <div className="lp-list-wrap">
            {rows.length ? (
              <ul className="lp-list">
                {rows.map((r) => {
                  const look = formLook(r.form);
                  const [cls, label] = STATUS[r.status] || STATUS.new;
                  const sub = subOf(r.data);
                  return (
                    <li key={r.id}>
                      <a className="lp-card" href={href('id=' + r.id)} aria-current={lead?.id === r.id ? 'true' : undefined}>
                        <span className="lp-ic" style={{ '--c': look.colour }}><Ico name={look.icon} /></span>
                        <span>
                          <span className="nm">{r.status === 'new' ? <span className="dot" aria-label="New" /> : null}{nameOf(r.data)}</span>
                          <span className="sub">{r.form}{sub ? ' · ' + sub : ''}</span>
                        </span>
                        <span className="meta"><span className={'lp-pill ' + cls}>{label}</span><span>{formatWhen(r.created_at)}</span></span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="lp-detail lp-empty-box" style={{ position: 'static' }}>
                <div className="lp-empty"><span className="lp-ic"><Ico name="tray" /></span>
                  <b>{filtered ? 'No leads match' : f.form ? 'Nothing from this form yet' : 'No leads yet'}</b>
                  {filtered ? 'Try other words, or clear the search.' : 'Everything sent through a website form appears here straight away.'}
                </div>
              </div>
            )}
          </div>

          {lead ? <LeadView lead={lead} params={params} keep={keep} /> : (
            <div className="lp-detail lp-pick"><div className="lp-empty"><span className="lp-ic"><Ico name="tray" /></span><b>Choose a lead</b>
              Pick one from the list to read it, contact the person and keep track of the follow-up.</div></div>
          )}
        </div>
      </main>
    </div>
  );
}

function LeadView({ lead, params, keep }) {
  const look = formLook(lead.form);
  const name = nameOf(lead.data);
  const email = emailOf(lead.data);
  const phone = phoneOf(lead.data);
  const wa = whatsappOf(phone);
  const current = (STATUS[lead.status] || STATUS.new)[0];
  return (
    <article className="lp-detail" aria-label={name}>
      <a className="lp-back" href={'/leads' + (keep ? '?' + keep : '')}><Ico name="arrow-left" />All leads</a>
      <Flash params={params} />
      <span className="lp-tag" style={{ '--c': look.colour, marginTop: params.ok || params.error ? 14 : 0 }}><Ico name={look.icon} />{lead.form}</span>
      <h2>{name}</h2>
      <p className="lp-when">Received {formatWhen(lead.created_at)}{lead.page ? ' from ' + lead.page : ''}</p>
      {email || phone ? (
        <div className="lp-acts">
          {email ? <a className="lp-btn" href={`mailto:${email}?subject=${encodeURIComponent('SOS Foundation: your ' + lead.form.toLowerCase() + ' form')}`}><Ico name="envelope-simple-open" />Email</a> : null}
          {phone ? <a className="lp-btn ghost" href={'tel:' + phone.replace(/[^\d+]/g, '')}><Ico name="phone" />Call</a> : null}
          {wa ? <a className="lp-btn green" href={'https://wa.me/' + wa} target="_blank" rel="noreferrer"><Ico name="whatsapp-logo" />WhatsApp</a> : null}
        </div>
      ) : null}
      <dl className="lp-fields">
        {lead.data.map(([k, v], i) => <div key={i} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v || <span style={{ color: '#55587f' }}>Empty</span>}</dd></div>)}
      </dl>
      <form className="lp-follow" action={saveLead}>
        <h3>Follow-up</h3>
        <input type="hidden" name="id" value={lead.id} />
        <input type="hidden" name="back" value={keep} />
        <fieldset className="lp-seg"><legend className="lp-sr">Status</legend>
          {SEG.map(([v, l]) => <label key={v}><input type="radio" name="status" value={v} defaultChecked={current === v} /><span>{l}</span></label>)}
        </fieldset>
        <label className="lp-lbl" htmlFor="note">Private note</label>
        <textarea className="lp-ctl" id="note" name="note" defaultValue={lead.note} placeholder="For example: called on Friday, will join the next event." aria-describedby="note-help" />
        <span className="lp-help" id="note-help">Only people signed in to Leads or the admin panel see notes.</span>
        <div className="lp-row"><button className="lp-btn" type="submit"><Ico name="check" />Save</button></div>
      </form>
    </article>
  );
}
