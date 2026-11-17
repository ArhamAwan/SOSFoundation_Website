import { requireUser } from '@/lib/auth';
import { q } from '@/lib/db';
import { mediaMap } from '@/lib/content';
import { Badge, Check, Field, Flash, Head } from '@/app/admin/_ui';
import { ConfirmButton, Uploader } from '@/app/admin/_ui/client';
import { deleteMedia, saveMedia } from '@/app/admin/actions';

const FOCUS = [['center', 'Centre'], ['center top', 'Top'], ['center 25%', 'Upper'], ['center 75%', 'Lower'], ['center bottom', 'Bottom'], ['left center', 'Left'], ['right center', 'Right']];

export default async function MediaLibrary({ searchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const media = await mediaMap();
  const all = [...media.values()];
  const groups = { all, consent: all.filter((m) => m.shows_people && !m.consent), alt: all.filter((m) => !m.alt.trim()) };
  const show = groups[params.show] ? params.show : 'all';
  const selected = media.get(Number(params.id));
  const usedIn = selected ? await q(`SELECT type, title FROM items WHERE (data->>'image')::int = $1 OR data->'gallery' @> $2::text::jsonb ORDER BY title`, [selected.id, JSON.stringify([selected.id])]) : [];
  const focus = selected && !FOCUS.some(([v]) => v === selected.pos) ? [[selected.pos, `Custom (${selected.pos})`], ...FOCUS] : FOCUS;
  const link = (m) => `/admin/media?${show !== 'all' ? `show=${show}&` : ''}id=${m.id}`;
  return (
    <>
      <Head title="Media library" sub="Every photo used on the website. Photos are resized and converted to WebP when you upload them.">
        <Uploader />
      </Head>
      <Flash params={params} />
      <div className="toolbar">
        <div className="pills">
          {[['all', 'All'], ['consent', 'No consent recorded'], ['alt', 'No alt text']].map(([key, label]) => (
            <a key={key} className="pill" href={`/admin/media?show=${key}`} aria-current={show === key ? 'true' : undefined}>{label} {groups[key].length}</a>
          ))}
        </div>
      </div>
      <div className="edit">
        <div className="main">
          {groups[show].length === 0 ? <p className="panel empty-state">No photos here.</p> : null}
          <div className="mgrid">
            {groups[show].map((m) => (
              <a key={m.id} className="mcard" href={link(m)} aria-current={selected?.id === m.id ? 'true' : undefined}>
                <img src={m.url} alt={m.alt} loading="lazy" style={{ objectPosition: m.pos }} />
                <span>{m.alt || m.filename}</span>
              </a>
            ))}
          </div>
        </div>
        <div className="side">
          {selected ? (
            <form action={saveMedia} className="panel">
              <h2>Selected photo</h2>
              <input type="hidden" name="id" value={selected.id} />
              <img src={selected.url} alt={selected.alt} style={{ display: 'block', width: '100%', borderRadius: 4, marginBottom: 8, background: '#eceef5' }} />
              <p className="small muted" style={{ marginBottom: 16 }}>{selected.filename}{selected.width ? ` · ${selected.width} × ${selected.height} px` : ''}</p>
              <div className="fgrid">
                <Field label="Alt text" id="alt" wide help="Describe what the photo shows, for people who cannot see it. Required before publishing."><textarea className="ctl" id="alt" name="alt" rows={3} defaultValue={selected.alt} /></Field>
                <Field label="Photo credit" id="credit" wide><input className="ctl" id="credit" name="credit" defaultValue={selected.credit} /></Field>
                <Field label="Focal point" id="pos" wide help="Which part stays in view when the photo is cropped.">
                  <select className="ctl" id="pos" name="pos" defaultValue={selected.pos}>{focus.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                </Field>
              </div>
              <Check name="shows_people" label="Shows children or beneficiaries" on={selected.shows_people} />
              <Check name="consent" label="Consent recorded" note="Internal only. Without it, this photo is hidden from the live website." on={selected.consent} />
              <p className="small muted" style={{ margin: '8px 0 16px' }}>
                {usedIn.length ? 'Used in: ' + usedIn.map((u) => u.title).join('; ') + '.' : 'Not used in a news post or success story.'}
              </p>
              <div className="row">
                <button className="btn" type="submit">Save photo details</button>
                {user.isAdmin ? <ConfirmButton formAction={deleteMedia} message="Delete this photo from the library? This cannot be undone.">Delete</ConfirmButton> : null}
              </div>
            </form>
          ) : (
            <section className="panel"><h2>Selected photo</h2><p className="muted">Choose a photo to edit its alt text, credit, consent and focal point.</p><p style={{ marginTop: 12 }}><Badge kind="info">{all.length} photos</Badge></p></section>
          )}
        </div>
      </div>
    </>
  );
}
