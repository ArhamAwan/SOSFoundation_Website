// The leads list and the opened lead, shared by the Leads portal (/leads) and the admin panel (/admin/submissions).
// Design: gen/leads_portal.py (the Leads boards, and "Admin: Leads" which shows it inside the admin panel).
import { FORMS, STATUS, emailOf, formatWhen, nameOf, phoneOf, subOf, whatsappOf } from '@/lib/leads';
import { Flash, Ico, formLook } from './ui';

const SEG = [['new', 'New'], ['progress', 'In progress'], ['closed', 'Closed']];

/**
 * base: the page's own address ('/leads' or '/admin/submissions').
 * head: the portal's own heading; the admin panel shows its page heading instead.
 * save: server action for status and note. remove: a delete button (admins only), or null.
 */
export function LeadsBoard({ base, params, f, counts, rows, lead, head, exportHref, save, remove }) {
  const part = (k, v) => (v ? k + '=' + encodeURIComponent(v) : '');
  const keep = [part('form', f.form), part('status', f.status), part('q', f.search)].filter(Boolean).join('&');
  const link = (s) => base + (s ? '?' + s : '');
  const href = (extra) => link([keep, extra].filter(Boolean).join('&'));
  const tabHref = (form) => link([part('form', form), part('status', f.status), part('q', f.search)].filter(Boolean).join('&'));
  const forms = [...FORMS, ...Object.keys(counts.byForm).filter((x) => !FORMS.includes(x))];
  const filtered = !!(f.search || f.status);

  return (
    <>
      <div className="lp-chrome">
        {head ? (
          <div className="lp-head">
            <div><h1>Leads</h1><p>Everyone who filled in a form on the website. New ones are at the top.</p></div>
            <a className="lp-btn ghost" href={exportHref}><Ico name="download-simple" />Export CSV</a>
          </div>
        ) : null}
        <div className="lp-stats" style={head ? undefined : { marginTop: 0 }}>
          <div className="lp-stat new"><b>{counts.fresh}</b><span>new, not yet followed up</span></div>
          <div className="lp-stat"><b>{counts.week}</b><span>this week</span></div>
          <div className="lp-stat"><b>{counts.total}</b><span>in total</span></div>
        </div>
        <nav className="lp-tabs" aria-label="Forms">
          <a className="lp-tab" href={tabHref('')} aria-current={!f.form ? 'true' : undefined}>All <i>{counts.total}</i></a>
          {forms.map((name) => <a key={name} className="lp-tab" href={tabHref(name)} aria-current={f.form === name ? 'true' : undefined}>{name} <i>{counts.byForm[name] || 0}</i></a>)}
        </nav>
        <form className="lp-tools" role="search" method="get" action={base}>
          {f.form ? <input type="hidden" name="form" value={f.form} /> : null}
          <div className="lp-search"><Ico name="magnifying-glass" /><label className="lp-sr" htmlFor="q">Search leads</label>
            <input className="lp-ctl" id="q" name="q" type="search" defaultValue={f.search} placeholder="Search name, email, phone or city" /></div>
          <label className="lp-sr" htmlFor="st">Status</label>
          <select className="lp-ctl" id="st" name="status" defaultValue={f.status}>
            <option value="">All statuses</option>
            {Object.entries(STATUS).map(([v, [, l]]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button className="lp-btn ghost" type="submit">Search</button>
          {filtered ? <a className="lp-btn ghost" href={link(part('form', f.form))}>Clear</a> : null}
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

        {lead ? <LeadView lead={lead} params={params} keep={keep} back={link(keep)} save={save} remove={remove} /> : (
          <div className="lp-detail lp-pick"><div className="lp-empty"><span className="lp-ic"><Ico name="tray" /></span><b>Choose a lead</b>
            Pick one from the list to read it, contact the person and keep track of the follow-up.</div></div>
        )}
      </div>
    </>
  );
}

function LeadView({ lead, params, keep, back, save, remove }) {
  const look = formLook(lead.form);
  const name = nameOf(lead.data);
  const email = emailOf(lead.data);
  const phone = phoneOf(lead.data);
  const wa = whatsappOf(phone);
  const current = (STATUS[lead.status] || STATUS.new)[0];
  // Only the questions that were answered; the ones left blank are named in one line underneath.
  const answered = lead.data.filter(([, v]) => v);
  const skipped = lead.data.filter(([, v]) => !v).map(([k]) => k);
  return (
    <article className="lp-detail" aria-label={name}>
      <a className="lp-back" href={back}><Ico name="arrow-left" />All leads</a>
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
        {answered.map(([k, v], i) => (
          <div key={i} style={{ display: 'contents' }}>
            <dt>{k}</dt>
            <dd>{v === email ? <a href={'mailto:' + v}>{v}</a> : v}</dd>
          </div>
        ))}
      </dl>
      {skipped.length ? <p className="lp-skip">Not answered: {skipped.join(', ')}</p> : null}
      <form className="lp-follow" action={save}>
        <h3>Follow-up</h3>
        <input type="hidden" name="id" value={lead.id} />
        <input type="hidden" name="back" value={keep} />
        <fieldset className="lp-seg"><legend className="lp-sr">Status</legend>
          {SEG.map(([v, l]) => <label key={v}><input type="radio" name="status" value={v} defaultChecked={current === v} /><span>{l}</span></label>)}
        </fieldset>
        <label className="lp-lbl" htmlFor="note">Private note</label>
        <textarea className="lp-ctl" id="note" name="note" defaultValue={lead.note} placeholder="For example: called on Friday, will join the next event." aria-describedby="note-help" />
        <span className="lp-help" id="note-help">Only people signed in to Leads or the admin panel see notes.</span>
        <div className="lp-row"><button className="lp-btn" type="submit"><Ico name="check" />Save</button>{remove}</div>
      </form>
    </article>
  );
}
